import React, { lazy, Suspense, useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Star,
  Copy,
  Check,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Link, useSaved } from "./ui";
import { compact } from "./tax.mjs";
import {
  realMarkets,
  marketSnapshot,
  priceLabel,
  changeLabel,
  addressLabel,
  creatorFee,
  loadMarketDetail,
} from "./marketSnapshot";
import { RealTokenImage, RealTaxDetails } from "./MarketBrowser";
import { useMarketFeed, MarketValue } from "./MarketFeed.jsx";
import { RiskChecks } from "./RiskChecks";
import { mergeFeedDetail, marketChange, marketStage } from "./marketSnapshot";
import { useWorkspace } from "./Workspace";
const PriceChart = lazy(() =>
  import("./PriceChart").then((m) => ({ default: m.PriceChart })),
);
export function TokenMarket({ id }) {
  const { markets } = useMarketFeed(),
    meta = markets.find((m) => m.id === id),
    [detail, setDetail] = useState(null),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    m = useMemo(() => mergeFeedDetail(detail, meta), [detail, meta]),
    [saved, setSaved] = useSaved("glidepath-real-watchlist", []),
    [tab, setTab] = useState("trades"),
    [copied, setCopied] = useState(false),
    { notify } = useWorkspace();
  useEffect(() => {
    const abort = new AbortController();
    setDetail(null);
    setLoading(true);
    setFailed(false);
    loadMarketDetail(id, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setLoading(false);
          setFailed(true);
        }
      });
    return () => abort.abort();
  }, [id, attempt]);
  if (!m)
    return (
      <div className="browse-empty">
        <h1>Launch not found.</h1>
        <Link to="/explore">Back to launches</Link>
      </div>
    );
  const isSaved = saved.includes(m.id),
    copy = async () => {
      try {
        await navigator.clipboard.writeText(m.address);
        setCopied(true);
        notify("Contract address copied.");
      } catch {
        notify(
          "Copy is unavailable. The full address is shown in token details.",
        );
      }
    };
  return (
    <div className="token-market">
      <Link to="/explore" className="token-back">
        <ArrowLeft size={14} />
        Launches
      </Link>
      <header className="token-detail-heading">
        <div className="token-detail-identity">
          <RealTokenImage market={m} />
          <div>
            <h1>
              {m.name}
              <span>{m.symbol}</span>
            </h1>
            <div className="token-identity-meta">
              <span className="chain-label">Robinhood Chain</span>
              <button onClick={copy} aria-label="Copy token contract address">
                {addressLabel(m.address)}
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>
        <button
          className={"token-save " + (isSaved ? "active" : "")}
          aria-pressed={isSaved}
          onClick={() =>
            setSaved(
              isSaved ? saved.filter((id) => id !== m.id) : [...saved, m.id],
            )
          }
        >
          <Star size={15} fill={isSaved ? "currentColor" : "none"} />
          {isSaved ? "Saved" : "Save token"}
        </button>
      </header>
      <div className="token-price-strip">
        <div>
          <span>Price USD</span>
          <strong>
            <MarketValue revision={m.feedRevision} direction={m.priceDirection}>
              ${priceLabel(m.priceUsd)}
            </MarketValue>
          </strong>
        </div>
        <div>
          <span>Market cap</span>
          <strong>
            <MarketValue revision={m.feedRevision} direction={m.capDirection}>
              {compact(m.marketCap)}
            </MarketValue>
          </strong>
        </div>
        <div>
          <span>24h volume</span>
          <strong>
            <MarketValue
              revision={m.feedRevision}
              direction={m.volumeDirection}
            >
              {compact(m.volume24h)}
            </MarketValue>
          </strong>
        </div>
        <div>
          <span>
            {marketChange(m).label} · {m.chartUnit}
          </span>
          <strong
            className={
              Number.isFinite(marketChange(m).value)
                ? marketChange(m).value >= 0
                  ? "positive"
                  : "negative"
                : "neutral"
            }
          >
            {changeLabel(marketChange(m).value)}
          </strong>
        </div>
      </div>
      <div className="token-detail-layout">
        <div className="token-chart-column">
          <Suspense
            fallback={
              <div className="chart-loading" role="status">
                Loading price chart…
              </div>
            }
          >
            {loading ? (
              <div className="chart-loading" role="status">
                Loading market history...
              </div>
            ) : failed ? (
              <div className="chart-loading">
                <p>Could not load this snapshot.</p>
                <button onClick={() => setAttempt((v) => v + 1)}>Retry</button>
              </div>
            ) : (
              <PriceChart market={m} />
            )}
          </Suspense>
          <section className="token-lower-panel">
            <div
              className="token-detail-tabs"
              role="tablist"
              aria-label="Token information"
            >
              {[
                ["trades", "Transactions"],
                ["fees", "Tax details"],
                ["about", "Token details"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  id={"tab-" + value}
                  role="tab"
                  aria-selected={tab === value}
                  aria-controls={"panel-" + value}
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
              <span>Mock feed</span>
            </div>
            <div
              role="tabpanel"
              id={"panel-" + tab}
              aria-labelledby={"tab-" + tab}
            >
              {tab === "trades" ? (
                <>
                  <div className="trade-table-wrap">
                    {loading ? (
                      <p className="token-no-trades">Loading transactions...</p>
                    ) : m.trades?.length ? (
                      <table className="snapshot-trades">
                        <thead>
                          <tr>
                            <th>Time (UTC)</th>
                            <th>Type</th>
                            <th>Price ({m.chartUnit})</th>
                            <th>Amount ({m.chartUnit})</th>
                            <th>Transaction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.trades.map((t) => (
                            <tr
                              key={t.id || t.txHash}
                              className={t.simulated ? "simulated-trade" : ""}
                            >
                              <td>
                                {new Date(t.timestamp * 1000).toLocaleString(
                                  "en-GB",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "UTC",
                                  },
                                )}
                              </td>
                              <td>
                                <span
                                  className={
                                    "trade-side " +
                                    (t.side === "buy" ? "positive" : "negative")
                                  }
                                >
                                  {t.side === "buy"
                                    ? "Buy"
                                    : t.side === "sell"
                                      ? "Sell"
                                      : t.side}
                                </span>
                              </td>
                              <td>{priceLabel(t.priceQuote)}</td>
                              <td>{priceLabel(t.volumeQuote)}</td>
                              <td>
                                {t.simulated ? (
                                  <span className="simulated-label">
                                    Simulated
                                  </span>
                                ) : (
                                  <a
                                    href={
                                      "https://robin.etherscan.io/tx/" +
                                      t.txHash
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={"View transaction " + t.txHash}
                                  >
                                    {addressLabel(t.txHash)}
                                    <ArrowUpRight size={11} />
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="token-no-trades">
                        No transaction snapshot is available for this token.
                      </p>
                    )}
                  </div>
                  <p className="snapshot-caption">
                    Simulated trades arrive above the captured Pons
                    transactions. Simulated rows have no on-chain transaction.
                  </p>
                </>
              ) : tab === "fees" ? (
                <RealTaxDetails market={m} />
              ) : (
                <div className="token-about">
                  <h2>Contract details</h2>
                  <dl>
                    <div>
                      <dt>Network</dt>
                      <dd>Robinhood Chain</dd>
                    </div>
                    <div>
                      <dt>Token contract</dt>
                      <dd>
                        <a
                          href={"https://robin.etherscan.io/token/" + m.address}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {m.address}
                          <ArrowUpRight size={12} />
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Quote asset</dt>
                      <dd>{m.quote}</dd>
                    </div>
                    <div>
                      <dt>Captured</dt>
                      <dd>
                        {new Date(m.capturedAt)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}{" "}
                        UTC
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Real token identity and captured market history, used in a
                    GLIDY interface mockup. No affiliation or GLIDY
                    launch is implied.
                  </p>
                  <a href={m.sourceUrl} target="_blank" rel="noreferrer">
                    Pons data source
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="token-detail-aside">
          <section className="token-summary">
            <h2>At a glance</h2>
            <dl>
              <div>
                <dt>Source stage</dt>
                <dd>{marketStage(m)}</dd>
              </div>
              <div>
                <dt>Pair</dt>
                <dd>
                  {m.symbol} / {m.quote}
                </dd>
              </div>
              <div>
                <dt>Creator tax</dt>
                <dd>{creatorFee(m)}</dd>
              </div>
              <div>
                <dt>Chart currency</dt>
                <dd>{m.chartUnit}</dd>
              </div>
              <div>
                <dt>Trading here</dt>
                <dd>Mock only</dd>
              </div>
            </dl>
            <a
              className="source-market-link"
              href={m.dexUrl || m.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {m.dexUrl ? "View on DEX Screener" : "View launch source"}
              <ArrowUpRight size={14} />
            </a>
            <p>
              Real identity, simulated activity. Source values may have changed
              since capture.
            </p>
          </section>
          <RiskChecks market={m} />
          <section className="token-learn">
            <span>BUILDING SOMETHING?</span>
            <h2>Set your own path.</h2>
            <p>Choose a starting tax and decide how it falls.</p>
            <Link to="/launch">
              Try the launch designer
              <ArrowRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
