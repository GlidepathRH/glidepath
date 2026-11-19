import React, { useMemo, useState, useId, useRef } from "react";
import {
  Search,
  Star,
  Plus,
  LayoutGrid,
  List,
  ArrowUpRight,
  ArrowRight,
  RotateCcw,
  X,
  Compass,
  BookOpen,
  ShieldQuestion,
} from "lucide-react";
import { Link, useSaved } from "./ui";
import { compact } from "./tax.mjs";
import {
  marketSnapshot,
  priceLabel,
  changeLabel,
  creatorFee,
  selectMarkets,
  marketChange,
  marketStage,
  ageAtCapture,
  addressLabel,
} from "./marketSnapshot";
import {
  useMarketFeed,
  MarketValue,
  useRankMotion,
  RankMarker,
  useHeldOrder,
} from "./MarketFeed.jsx";
import { GlidyLaunches } from "./GlidyLaunches.jsx";
import { HeroVideo } from "./ProDashboard";
import {
  RiskChecks,
  RiskStatus,
  RugCheckReport,
  riskShare,
} from "./RiskChecks";
import { useWorkspace } from "./Workspace";

export function TokenChange({ market: m }) {
  const c = marketChange(m);
  return (
    <span
      className={
        Number.isFinite(c.value)
          ? c.value >= 0
            ? "positive"
            : "negative"
          : "neutral"
      }
      title={c.label + " quote-price change in " + c.unit}
    >
      {changeLabel(c.value)}
      <small>
        {c.label} · {c.unit}
      </small>
    </span>
  );
}
function QuickFacts({ market: m }) {
  return (
    <div className="quick-facts">
      <div className="quick-facts-head">
        <RealTokenImage market={m} />
        <strong>{m.symbol} · the details</strong>
      </div>
      <div className="quick-tax">
        {creatorFee(m)}
        <small>creator tax</small>
      </div>
      <p>Reported by Pons. Other trading costs may apply.</p>
      <RiskChecks market={m} />
      <dl>
        <div>
          <dt>Launch status</dt>
          <dd>{marketStage(m)}</dd>
        </div>
        <div>
          <dt>Quote asset</dt>
          <dd>{m.quote}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd>
            <a
              href={"https://robin.etherscan.io/token/" + m.address}
              target="_blank"
              rel="noreferrer"
            >
              {addressLabel(m.address)}
              <ArrowUpRight size={11} />
            </a>
          </dd>
        </div>
      </dl>
      <p className="quick-note">
        External token. No GLIDY tax path is applied.
      </p>
    </div>
  );
}

export function RealTokenImage({ market, className = "" }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span
      className={"real-token-fallback " + className}
      aria-label={market.name + " image unavailable"}
    >
      {market.symbol.slice(0, 2)}
    </span>
  ) : (
    <img
      className={"real-token-image " + className}
      src={market.image}
      alt={market.name + " token artwork"}
      width="96"
      height="96"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function MiniPrice({ market }) {
  const values = (market.sparkline || market.candles?.["1h"] || [])
      .slice(-24)
      .map((c) => c.close),
    min = Math.min(...values),
    max = Math.max(...values),
    range = max - min || max * 0.01 || 1;
  if (values.length < 2) return <span className="mini-price-empty">—</span>;
  const points = values
      .map(
        (v, i) =>
          `${(i / (values.length - 1)) * 110},${31 - ((v - min) / range) * 25}`,
      )
      .join(" "),
    up = values.at(-1) >= values[0];
  return (
    <svg
      className={"mini-price " + (up ? "positive" : "negative")}
      viewBox="0 0 110 38"
      role="img"
      aria-label={
        market.symbol + " captured price history in " + market.chartUnit
      }
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function SaveToken({ market, saved, setSaved }) {
  const active = saved.includes(market.id);
  return (
    <button
      type="button"
      className={"save-real " + (active ? "active" : "")}
      aria-label={
        (active ? "Remove " : "Save ") +
        market.name +
        (active ? " from watchlist" : " to watchlist")
      }
      aria-pressed={active}
      onClick={() =>
        setSaved(
          active
            ? saved.filter((id) => id !== market.id)
            : [...saved, market.id],
        )
      }
    >
      <Star size={17} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
export function RealTaxDetails({ market }) {
  return (
    <div className="real-tax-details">
      <span className="micro-label">REPORTED TOKEN FEES</span>
      <h3>{market.name}</h3>
      <div className="real-tax-number">
        {creatorFee(market)}
        <span>creator tax</span>
      </div>
      <p>
        This is the creator tax reported by Pons. It is not the full cost of a
        trade; pool fees, gas and slippage may also apply.
      </p>
      <dl>
        <div>
          <dt>GLIDY schedule</dt>
          <dd>Not applied</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>Captured snapshot</dd>
        </div>
      </dl>
      <p className="real-tax-note">
        This external token is shown for the mockup. It is not a GLIDY
        launch.
      </p>
      <Link to="/examples">
        Explore a GLIDY tax example
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}
export function RealMarketRow({ market: m, saved, setSaved, rank, rankScope }) {
  const [flipped, setFlipped] = useState(false),
    [report, setReport] = useState(false),
    reportTrigger = useRef(),
    trigger = useRef(),
    id = useId();
  const flip = (e) => {
    if (e.target.closest("dialog")) return;
    e.preventDefault();
    setFlipped((v) => !v);
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <article
      data-market-id={m.id}
      className={"real-market-row " + (flipped ? "is-flipped" : "")}
      onContextMenu={flip}
      onClick={(e) => {
        if (!e.target.closest("a,button,input,select,dialog"))
          location.hash = "/market/" + m.id;
      }}
      onKeyDown={(e) => {
        if (e.target.closest("dialog")) return;
        if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") flip(e);
        if (e.key === "Escape" && flipped) {
          setFlipped(false);
          trigger.current?.focus({ preventScroll: true });
        }
      }}
    >
      <div className="real-row-stage" id={id}>
        <div className="real-row-rotor">
          <div
            className="real-row-face real-row-main"
            aria-hidden={flipped}
            inert={flipped}
          >
            <Link
              className="real-row-link"
              to={"/market/" + m.id}
              aria-label={"Open " + m.name + " price chart"}
            />
            <div className="real-row-identity">
              {rank && <RankMarker rank={rank} scope={rankScope} />}
              <RealTokenImage market={m} />
              <div>
                <h2>{m.name}</h2>
                <span>
                  {m.symbol}
                  <i /> {m.quote} pair
                </span>
              </div>
            </div>
            <div className="real-row-graph">
              <MiniPrice market={m} />
              <TokenChange market={m} />
            </div>
            <div className="real-row-value">
              <small>Market cap</small>
              <strong>
                <MarketValue
                  revision={m.feedRevision}
                  direction={m.capDirection}
                >
                  {compact(m.marketCap)}
                </MarketValue>
              </strong>
            </div>
            <div className="real-row-volume">
              <small>24h volume</small>
              <span>
                <MarketValue
                  revision={m.feedRevision}
                  direction={m.volumeDirection}
                >
                  {compact(m.volume24h)}
                </MarketValue>
              </span>
            </div>
            <div className="real-row-fee">
              <small>Creator tax</small>
              <span>{creatorFee(m)}</span>
            </div>
            <SaveToken market={m} saved={saved} setSaved={setSaved} />
          </div>
          <div
            className="real-row-face real-row-back"
            aria-hidden={!flipped}
            inert={!flipped}
          >
            <Link
              className="real-row-back-identity"
              to={"/market/" + m.id}
              aria-label={"Open " + m.name + " price chart"}
            >
              <RealTokenImage market={m} />
              <span>
                <strong>{m.symbol}</strong>
                <small>Quick checks</small>
              </span>
            </Link>
            <div className="row-check-stat">
              <small>Creator tax</small>
              <strong>{creatorFee(m)}</strong>
              <span>Reported</span>
            </div>
            <div className="row-check-stat">
              <small>Top 10 holders</small>
              <strong>{riskShare(m.risk?.top10Bps)}</strong>
              <span>
                {m.risk?.simulated
                  ? "Demo supply"
                  : m.risk
                    ? "Supply share"
                    : "Not checked"}
              </span>
            </div>
            <div className="row-check-stat">
              <small>Possible bundles</small>
              <strong>{riskShare(m.risk?.bundledBps)}</strong>
              <span>
                {m.risk?.simulated
                  ? "Demo supply"
                  : m.risk
                    ? "Supply share"
                    : "Not checked"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <footer className="real-row-footer">
        {flipped ? (
          <span className="row-contract-note">
            Contract <b>Not checked</b>
          </span>
        ) : (
          <RiskStatus market={m} />
        )}
        <div className="row-check-actions">
          {flipped && (
            <button
              className="row-full-report"
              ref={reportTrigger}
              onClick={() => setReport(true)}
              aria-label={"Open rug check report for " + m.name}
            >
              Full report
              <ArrowUpRight size={12} />
            </button>
          )}
          <button
            ref={trigger}
            className="row-flip"
            aria-label={
              (flipped ? "Show front of " : "Flip to rug checks for ") + m.name
            }
            aria-expanded={flipped}
            aria-controls={id}
            onClick={flip}
          >
            {flipped ? <RotateCcw size={13} /> : <ShieldQuestion size={13} />}
            {flipped ? "Back" : "Rug checks"}
            {!flipped && <RotateCcw size={11} />}
          </button>
        </div>
      </footer>
      {report && (
        <RugCheckReport
          market={m}
          onClose={() => {
            setReport(false);
            requestAnimationFrame(() =>
              reportTrigger.current?.focus({ preventScroll: true }),
            );
          }}
        />
      )}
    </article>
  );
}
export function RealMarketCard({ market: m, saved, setSaved }) {
  const [flipped, setFlipped] = useState(false),
    trigger = useRef(),
    id = useId(),
    workspace = useWorkspace();
  const flip = (e) => {
    if (e.target.closest("dialog")) return;
    e.preventDefault();
    setFlipped((v) => !v);
  };
  const open = (e) => {
    if (e.target.closest("a,button,input,select,dialog")) return;
    location.hash = "/market/" + m.id;
  };
  const light = (e) => {
    if (!workspace?.motion || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    e.currentTarget.style.setProperty("--shine-x", x * 100 + "%");
    e.currentTarget.style.setProperty("--shine-y", y * 100 + "%");
    e.currentTarget.style.setProperty("--rx", (0.5 - y) * 2 + "deg");
    e.currentTarget.style.setProperty("--ry", (x - 0.5) * 2 + "deg");
  };
  const resetLight = (e) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };
  return (
    <article
      data-market-id={m.id}
      className={"real-market-card " + (flipped ? "is-flipped" : "")}
      onContextMenu={flip}
      onClick={open}
      onPointerMove={light}
      onPointerLeave={resetLight}
      onKeyDown={(e) => {
        if (e.target.closest("dialog")) return;
        if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
          flip(e);
          return;
        }
        if (e.key === "Escape" && flipped) {
          setFlipped(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="real-card-top">
        <span className="card-serial">
          <i /> {m.symbol}
          <small>{m.quote}</small>
        </span>
        <SaveToken market={m} saved={saved} setSaved={setSaved} />
      </div>
      <div id={id} className="real-card-stage">
        <div className="real-card-rotor">
          <div
            className="real-card-face real-card-front"
            aria-hidden={flipped}
            inert={flipped}
          >
            <Link to={"/market/" + m.id} className="real-card-image">
              <RealTokenImage market={m} />
            </Link>
            <div className="real-card-body">
              <Link to={"/market/" + m.id}>
                <h2>
                  {m.name}
                  <ArrowUpRight size={15} />
                </h2>
              </Link>
              <div className="real-card-numbers">
                <span>
                  Market cap
                  <strong>
                    <MarketValue
                      revision={m.feedRevision}
                      direction={m.capDirection}
                    >
                      {compact(m.marketCap)}
                    </MarketValue>
                  </strong>
                </span>
                <span>
                  24h volume
                  <strong>
                    <MarketValue
                      revision={m.feedRevision}
                      direction={m.volumeDirection}
                    >
                      {compact(m.volume24h)}
                    </MarketValue>
                  </strong>
                </span>
              </div>
              <div className="real-card-basics">
                <TokenChange market={m} />
                <span>
                  {creatorFee(m)}
                  <small>creator tax</small>
                </span>
              </div>
              <div className="card-progress" aria-hidden="true">
                <span
                  style={{
                    width:
                      (m.stage === "graduated"
                        ? 100
                        : Math.max(0, Math.min(100, (m.progress || 0) * 100))) +
                      "%",
                  }}
                />
              </div>
              <div className="card-stage-label">
                <span>{marketStage(m)}</span>
                <span>
                  {m.stage === "curve"
                    ? ((m.progress || 0) * 100).toFixed(2) +
                      "% of source target"
                    : "External market"}
                </span>
              </div>
              <div className="card-mini-chart">
                <span>
                  <small>Price USD</small>
                  <MarketValue
                    revision={m.feedRevision}
                    direction={m.priceDirection}
                  >
                    ${priceLabel(m.priceUsd)}
                  </MarketValue>
                </span>
                <MiniPrice market={m} />
              </div>
            </div>
          </div>
          <div
            className="real-card-face real-card-back"
            aria-hidden={!flipped}
            inert={!flipped}
          >
            <QuickFacts market={m} />
          </div>
        </div>
      </div>
      <div className="card-check-status">
        <RiskStatus market={m} />
      </div>
      <footer>
        <button
          ref={trigger}
          aria-label={
            (flipped ? "Show front of " : "Flip to rug checks for ") + m.name
          }
          aria-expanded={flipped}
          aria-controls={id}
          onClick={() => setFlipped(!flipped)}
        >
          {flipped ? <RotateCcw size={13} /> : <ShieldQuestion size={14} />}
          {flipped ? "Back to token" : "Rug checks"}
          {!flipped && <RotateCcw size={11} />}
        </button>
        <Link to={"/market/" + m.id}>
          Open chart
          <ArrowUpRight size={13} />
        </Link>
      </footer>
    </article>
  );
}
export function MarketBrowser({ watchlist = false }) {
  const { markets } = useMarketFeed(),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("featured"),
    [category, setCategory] = useState("featured"),
    [view, setView] = useSaved("glidepath-browse-view-v5", "grid"),
    [saved, setSaved] = useSaved("glidepath-real-watchlist", []),
    [count, setCount] = useState(9),
    [quote, setQuote] = useState("all");
  const grid = useRef(null),
    source = watchlist
      ? markets
      : markets.filter(
          (m) =>
            category === "all" ||
            (category === "featured" && m.kind === "featured") ||
            (category === "new" && m.stage === "curve") ||
            (category === "dex" && m.pairAddress),
        );
  const list = useMemo(
    () =>
      selectMarkets(
        source.filter((m) => quote === "all" || m.quote === quote),
        { query, sort, savedOnly: watchlist, saved },
      ),
    [markets, category, quote, query, sort, watchlist, saved],
  );
  const held = useHeldOrder(list, category + quote + query + sort + watchlist),
    shown = held.items.slice(0, count);
  useRankMotion(
    grid,
    shown.map((m) => m.id),
    category + quote + query + sort + view,
  );
  const fresh = selectMarkets(
    markets.filter((m) => m.kind === "recent"),
    { sort: "newest" },
  ).slice(0, 4);
  const clear = () => {
    setQuery("");
    setQuote("all");
    setCategory("all");
    setCount(9);
  };
  return (
    <div className="market-browser">
      <header className="browse-heading">
        <div>
          <div className="browse-eyebrow">
            <span />
            ROBINHOOD CHAIN
          </div>
          <h1>
            {watchlist ? "Saved launches" : "Launches"}
            <span>{watchlist ? list.length : markets.length}</span>
          </h1>
          <p>
            {watchlist
              ? "The tokens you want to come back to."
              : "Find a launch. Flip for the details. Follow its next move."}
          </p>
        </div>
        <Link to="/launch" className="browse-create">
          <Plus size={16} />
          Create a launch
        </Link>
      </header>
      {!watchlist && <GlidyLaunches />}
      {!watchlist && (
        <section className="fresh-section" aria-label="Recent launch snapshots">
          <div className="section-caption">
            <h2>Fresh launches</h2>
            <Link to="/trending">
              Explore trending
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="fresh-rail">
            {fresh.map((m) => (
              <Link key={m.id} to={"/market/" + m.id} className="fresh-launch">
                <RealTokenImage market={m} />
                <div>
                  <strong>{m.name}</strong>
                  <span>
                    {ageAtCapture(m)} at capture · {m.quote}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {!watchlist && (
        <div className="launch-categories" aria-label="Launch category">
          {[
            ["featured", "Featured"],
            ["all", "All launches"],
            ["new", "On curve"],
            ["dex", "On DEX"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
                setCount(9);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="browse-toolbar">
        <label className="browse-search">
          <Search size={17} />
          <input
            aria-label="Search launches"
            placeholder="Name, ticker or contract address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCount(9);
            }}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </label>
        <div className="browse-toolbar-right">
          <label className="browse-sort">
            <select
              aria-label="Quote asset"
              value={quote}
              onChange={(e) => {
                setQuote(e.target.value);
                setCount(9);
              }}
            >
              <option value="all">Any pair</option>
              {[...new Set(markets.map((m) => m.quote))].map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
          </label>
          <label className="browse-sort">
            <select
              aria-label="Sort launches"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setCount(9);
              }}
            >
              <option value="featured">Featured</option>
              <option value="cap">Market cap</option>
              <option value="volume">24h volume</option>
              <option value="newest">Newest</option>
            </select>
          </label>
          <div className="browse-views" aria-label="View style">
            <button
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={17} />
            </button>
            <button
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="browse-source">
        <span>Real identities · simulated market updates</span>
        <span>
          {list.length} launches · left-click to open · right-click to flip
        </span>
      </div>
      {list.length ? (
        <div
          ref={grid}
          {...held.handlers}
          className={view === "grid" ? "real-market-grid" : "real-market-list"}
        >
          {shown.map((m) =>
            view === "grid" ? (
              <RealMarketCard
                key={m.id}
                market={m}
                saved={saved}
                setSaved={setSaved}
              />
            ) : (
              <RealMarketRow
                key={m.id}
                market={m}
                saved={saved}
                setSaved={setSaved}
              />
            ),
          )}
        </div>
      ) : (
        <div className="browse-empty">
          <Compass size={27} />
          <h2>
            {watchlist && !query ? "Nothing saved yet." : "No launches found."}
          </h2>
          <p>
            {watchlist && !query
              ? "Tap a token’s star to keep it here."
              : "Try another name, pair or contract address."}
          </p>
          {query || quote !== "all" ? (
            <button onClick={clear}>Clear filters</button>
          ) : (
            <Link to="/explore">
              Browse launches
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      )}
      {count < list.length && (
        <button
          className="trending-more"
          onClick={() => setCount((v) => v + 9)}
        >
          Show {Math.min(9, list.length - count)} more launches
          <ArrowRight size={14} />
        </button>
      )}
      {!watchlist && (
        <section className="launch-toolstrip" aria-label="Launch tools">
          <div>
            <HeroVideo />
            <h2>
              Your launch.
              <br />
              Your tax path.
            </h2>
            <p>
              Choose the starting tax. Set how it falls. Walk through every
              setting with the guide.
            </p>
            <Link to="/launch">
              Open launch designer
              <ArrowRight size={14} />
            </Link>
          </div>
          <div>
            <h2>Try the numbers first.</h2>
            <p>
              Move through time and see what a trade would cost. No wallet
              needed.
            </p>
            <Link to="/lab">
              Explore the tax lab
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      )}
      <footer className="browse-bottom">
        <span>
          Source snapshots:{" "}
          {new Date(marketSnapshot.capturedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "America/Los_Angeles",
          })}
          . External tokens, not GLIDY launches.
        </span>
        <Link to="/examples">
          <BookOpen size={13} />
          How GLIDY taxes work
          <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
