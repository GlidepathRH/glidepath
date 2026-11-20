import React, { useEffect, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import { apiGet } from "./api-client.mjs";

const intervals = ["5m", "1h", "4h", "1d"];

export function GlidyPriceChart({ tokenAddress }) {
  const container = useRef(null);
  const [interval, setInterval] = useState("5m");
  const [state, setState] = useState({ kind: "loading", candles: [] });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, kind: current.candles.length ? "refreshing" : "loading" }));
    const load = () => apiGet(`api/v1/launches/${tokenAddress}/chart?interval=${interval}`, controller.signal)
      .then((result) => setState({ kind: "ready", candles: result.data ?? [] }))
      .catch((error) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, kind: "error", error: error.message }));
      });
    void load();
    const timer = setInterval(load, 15_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [tokenAddress, interval]);

  useEffect(() => {
    if (!container.current || !state.candles.length) return;
    const chart = createChart(container.current, {
      width: container.current.clientWidth,
      height: 280,
      layout: { background: { type: ColorType.Solid, color: "#fbf9fc" }, textColor: "#736b78", fontFamily: "Matter, sans-serif" },
      grid: { vertLines: { color: "#eee9f1" }, horzLines: { color: "#eee9f1" } },
      rightPriceScale: { borderColor: "#e8e1eb" },
      timeScale: { borderColor: "#e8e1eb", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#9d80b1" }, horzLine: { color: "#9d80b1" } },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3c8c70", downColor: "#c15f72", borderVisible: false,
      wickUpColor: "#3c8c70", wickDownColor: "#c15f72",
      priceFormat: { type: "price", precision: 12, minMove: 1e-12 },
    });
    series.setData(state.candles);
    chart.timeScale().fitContent();
    const observer = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.remove(); };
  }, [state.candles]);

  return <section className="glidy-price-chart" aria-label="Onchain pool price chart">
    <div className="glidy-chart-head"><div><span>POOL PRICE</span><small>Robinhood Chain · indexed swaps</small></div>
      <div className="glidy-chart-intervals" aria-label="Chart interval">{intervals.map((item) => <button key={item} type="button" className={item === interval ? "active" : ""} onClick={() => setInterval(item)}>{item}</button>)}</div>
    </div>
    <div ref={container} className="glidy-chart-canvas" />
    {state.kind === "loading" && <p className="glidy-chart-message">Loading onchain price history…</p>}
    {state.kind === "error" && <p className="glidy-chart-message is-error">{state.error || "Chart data is temporarily unavailable."}</p>}
    {state.kind === "ready" && !state.candles.length && <p className="glidy-chart-message">No pool price data has been indexed yet.</p>}
  </section>;
}
