import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createChart,
  CrosshairMode,
} from "lightweight-charts";
import { Maximize2, Minimize2, Plus, Minus, RotateCcw } from "lucide-react";
import { cleanCandles, aggregateCandles, priceLabel } from "./marketSnapshot";

export function chartBars(market, interval) {
  return interval === "4h"
    ? aggregateCandles(market.candles?.["1h"], 14400)
    : interval === "5m"
      ? aggregateCandles(market.candles?.["1m"], 300)
      : cleanCandles(market.candles?.[interval]);
}
export function PriceChart({ market }) {
  const [interval, setInterval] = useState(
      market.candles?.["1m"]?.length ? "1m" : "1h",
    ),
    [style, setStyle] = useState("candles"),
    [expanded, setExpanded] = useState(false),
    [hovered, setHovered] = useState(null),
    [error, setError] = useState(false);
  const host = useRef(),
    api = useRef(),
    seriesRef = useRef(),
    cursor = useRef(null),
    volumeRef = useRef(),
    byTimeRef = useRef(new Map()),
    bars = useMemo(() => chartBars(market, interval), [market, interval]);
  useEffect(() => {
    if (!host.current || !bars.length) return;
    let chart;
    setError(false);
    setHovered(null);
    cursor.current = null;
    try {
      chart = createChart(host.current, {
        autoSize: true,
        height: expanded ? 620 : 430,
        layout: {
          background: { color: "#ffffff" },
          textColor: "#6b6277",
          fontFamily: "MatterMono, monospace",
          fontSize: 10,
          attributionLogo: true,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "#f2eff5" },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.13, bottom: 0.12 },
        },
        timeScale: {
          borderColor: "#ece7f0",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 4,
          barSpacing: 7,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#b1a4c5", labelBackgroundColor: "#453959" },
          horzLine: { color: "#b1a4c5", labelBackgroundColor: "#453959" },
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
      });
      const min = Math.min(...bars.map((b) => b.low)),
        precision = Math.min(12, Math.max(2, Math.ceil(-Math.log10(min)) + 4));
      const series = chart.addSeries(
        style === "candles" ? CandlestickSeries : LineSeries,
        {
          upColor: "#3e977c",
          downColor: "#c96979",
          wickUpColor: "#3e977c",
          wickDownColor: "#c96979",
          borderVisible: false,
          color: "#7861aa",
          lineWidth: 2,
          priceFormat: { type: "price", precision, minMove: 10 ** -precision },
        },
      );
      series.setData(
        style === "candles"
          ? bars
          : bars.map((b) => ({ time: b.time, value: b.close })),
      );
      const volume = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceLineVisible: false,
          lastValueVisible: false,
        },
        1,
      );
      volume.setData(
        bars.map((b) => ({
          time: b.time,
          value: b.volume,
          color: b.close >= b.open ? "#a9cfc158" : "#dba7b458",
        })),
      );
      chart.panes()[1].setHeight(expanded ? 110 : 82);
      chart.timeScale().fitContent();
      byTimeRef.current = new Map(bars.map((b) => [b.time, b]));
      chart.subscribeCrosshairMove((param) =>
        setHovered(
          param.time ? byTimeRef.current.get(param.time) || null : null,
        ),
      );
      api.current = chart;
      seriesRef.current = series;
      volumeRef.current = volume;
    } catch {
      chart?.remove();
      chart = null;
      setError(true);
    }
    return () => {
      api.current = null;
      seriesRef.current = null;
      chart?.remove();
    };
  }, [market.id, interval, style, expanded]);
  useEffect(() => {
    if (!api.current || !seriesRef.current || !volumeRef.current) return;
    byTimeRef.current = new Map(bars.map((b) => [b.time, b]));
    seriesRef.current.setData(
      style === "candles"
        ? bars
        : bars.map((b) => ({ time: b.time, value: b.close })),
    );
    volumeRef.current.setData(
      bars.map((b) => ({
        time: b.time,
        value: b.volume,
        color: b.close >= b.open ? "#a9cfc158" : "#dba7b458",
      })),
    );
  }, [bars, style]);
  const zoom = (factor) => {
    const scale = api.current?.timeScale(),
      range = scale?.getVisibleLogicalRange();
    if (!range) return;
    const middle = (range.from + range.to) / 2,
      half = Math.max(5, ((range.to - range.from) * factor) / 2);
    scale.setVisibleLogicalRange({ from: middle - half, to: middle + half });
  };
  const key = (e) => {
    if (["+", "=", "-"].includes(e.key)) {
      e.preventDefault();
      zoom(e.key === "-" ? 1.3 : 0.75);
    } else if (e.key === "End" || e.key === "Home") {
      e.preventDefault();
      api.current?.timeScale().fitContent();
      cursor.current = null;
      api.current?.clearCrosshairPosition();
    } else if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      cursor.current = Math.max(
        0,
        Math.min(
          bars.length - 1,
          (cursor.current ?? bars.length - 1) +
            (e.key === "ArrowLeft" ? -1 : 1),
        ),
      );
      const row = bars[cursor.current];
      if (row) {
        setHovered(row);
        api.current?.setCrosshairPosition(
          row.close,
          row.time,
          seriesRef.current,
        );
        const range = api.current?.timeScale().getVisibleLogicalRange();
        if (
          range &&
          (cursor.current < range.from || cursor.current > range.to)
        ) {
          const width = range.to - range.from;
          api.current.timeScale().setVisibleLogicalRange({
            from: cursor.current - width / 2,
            to: cursor.current + width / 2,
          });
        }
      }
    }
  };
  const current = hovered || bars.at(-1);
  return (
    <section
      className={"price-chart-panel " + (expanded ? "is-expanded" : "")}
      aria-label={market.name + " price chart"}
    >
      <header className="chart-toolbar">
        <div className="chart-periods" aria-label="Candle interval">
          {[
            ...(market.candles?.["1m"]?.length
              ? [
                  ["1m", "1M"],
                  ["5m", "5M"],
                ]
              : []),
            ["1h", "1H"],
            ["4h", "4H"],
            ["1d", "1D"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="chart-display">
          <button
            aria-pressed={style === "candles"}
            onClick={() => setStyle("candles")}
          >
            Candles
          </button>
          <button
            aria-pressed={style === "line"}
            onClick={() => setStyle("line")}
          >
            Line
          </button>
          <button
            className="chart-icon"
            aria-label={expanded ? "Reduce chart" : "Expand chart"}
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>
      <div className="chart-readout" aria-label="Selected candle values">
        <strong>
          {market.symbol} / {market.chartUnit}
        </strong>
        {current && (
          <>
            <span>
              O <b>{priceLabel(current.open)}</b>
            </span>
            <span>
              H <b>{priceLabel(current.high)}</b>
            </span>
            <span>
              L <b>{priceLabel(current.low)}</b>
            </span>
            <span>
              C{" "}
              <b
                className={
                  current.close >= current.open ? "positive" : "negative"
                }
              >
                {priceLabel(current.close)}
              </b>
            </span>
          </>
        )}
      </div>
      <div
        ref={host}
        className="price-chart-canvas"
        style={{ height: expanded ? 620 : 430 }}
        tabIndex={0}
        role="img"
        aria-label={
          market.name +
          " price and volume in " +
          market.chartUnit +
          ". Drag to pan, scroll or use plus/minus to zoom. Arrow keys inspect candles. Home resets."
        }
        onKeyDown={key}
      />
      {(error || !bars.length) && (
        <div className="price-chart-fallback">
          <p>
            {error
              ? "The chart could not load."
              : "No captured price history is available."}
          </p>
          <a
            href={market.dexUrl || market.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open the source chart
          </a>
        </div>
      )}
      <footer className="chart-footer">
        <span>
          Price & volume in {market.chartUnit} · history + simulated updates
        </span>
        <div>
          <button aria-label="Zoom chart in" onClick={() => zoom(0.75)}>
            <Plus size={13} />
          </button>
          <button aria-label="Zoom chart out" onClick={() => zoom(1.3)}>
            <Minus size={13} />
          </button>
          <button
            aria-label="Reset chart view"
            onClick={() => api.current?.timeScale().fitContent()}
          >
            <RotateCcw size={13} />
          </button>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView
          </a>
        </div>
      </footer>
      <p className="chart-attribution">
        TradingView Lightweight Charts™. Copyright (c) 2025 TradingView, Inc.
      </p>
    </section>
  );
}
