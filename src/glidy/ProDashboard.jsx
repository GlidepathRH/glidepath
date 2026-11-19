import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Eye,
  FlaskConical,
  GitCompareArrows,
  LayoutGrid,
  List,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingDown,
  X,
  Zap,
} from "lucide-react";
import { Link, useSaved } from "./ui";
import { Modal, useWorkspace } from "./Workspace";
import { LaunchCard } from "./LaunchCard";
import { LaunchRules } from "./LaunchRules";
import { TokenLogo } from "./TokenLogo";
import { markets } from "./data";
import {
  DEFAULT_PATH,
  compact,
  effectiveRate,
  fees,
  floorDay,
  nextStep,
  pct,
  rateAt,
  usd,
  validatePath,
} from "./tax.mjs";

const current = (m) => effectiveRate(m.path, m.day, 10000, m.milestoneCap);
export function PathVisual({
  path = DEFAULT_PATH,
  day = 0,
  onDay,
  cap = 10000,
  small = false,
}) {
  const id = useId().replaceAll(":", ""),
    end = Math.min(365, Math.max(30, (floorDay(path) || 30) + 10)),
    max = Math.max(path.start, 100),
    x = (d) => 24 + (Math.min(d, end) / end) * 552,
    y = (r) => 22 + (1 - r / max) * 130;
  const points = [{ d: 0, r: path.start }];
  if (path.step > 0)
    for (let d = path.hold; d <= end; d += path.interval) {
      points.push(
        { d, r: rateAt(path, Math.max(0, d - 0.001)) },
        { d, r: rateAt(path, d) },
      );
      if (rateAt(path, d) <= path.floor) break;
    }
  points.push({ d: end, r: rateAt(path, end) });
  const line = points
      .map((p, i) => (i ? "L" : "M") + x(p.d) + "," + y(p.r))
      .join(" "),
    r = effectiveRate(path, day, cap),
    cx = x(day),
    cy = y(r);
  return (
    <div className={"path-visual " + (small ? "small" : "")}>
      <svg
        viewBox="0 0 600 180"
        role="img"
        aria-label={
          "Tax schedule from " +
          pct(path.start) +
          " to " +
          pct(path.floor) +
          ". Day " +
          day +
          ": " +
          pct(r)
        }
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#9872ff" stopOpacity=".25" />
            <stop offset="1" stopColor="#9872ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="24"
            x2="576"
            y1={22 + i * 43}
            y2={22 + i * 43}
            stroke="currentColor"
            strokeOpacity=".08"
            strokeDasharray="3 5"
          />
        ))}
        <path d={line + " L576,160 L24,160 Z"} fill={"url(#" + id + ")"} />
        <path
          d={line}
          fill="none"
          stroke="#ac8bff"
          strokeWidth={small ? 3 : 2.5}
          strokeLinejoin="round"
        />
        {cap < path.start && (
          <path
            d={"M24," + y(cap) + " H576"}
            stroke="#bfe98e"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
        )}
        {!small && (
          <>
            <line
              x1={cx}
              x2={cx}
              y1="14"
              y2="160"
              stroke="#b9a0ff"
              strokeDasharray="3 4"
            />
            <circle cx={cx} cy={cy} r="9" fill="#a382ff" fillOpacity=".15" />
            <circle
              cx={cx}
              cy={cy}
              r="4"
              fill="#d8c8ff"
              stroke="#18141f"
              strokeWidth="2"
            />
            <text x="24" y="178">
              DAY 0
            </text>
            <text x="576" y="178" textAnchor="end">
              DAY {end}
            </text>
          </>
        )}
      </svg>
      {onDay && (
        <input
          className="path-scrubber"
          type="range"
          aria-label="Preview day"
          min="0"
          max={end}
          value={Math.min(day, end)}
          onChange={(e) => onDay(+e.target.value)}
        />
      )}
    </div>
  );
}
export function HeroVideo() {
  const ref = useRef(),
    { motion } = useWorkspace();
  useEffect(() => {
    const v = ref.current;
    let visible = true;
    const sync = () => {
      if (motion && visible && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    const ob = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    ob.observe(v);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      ob.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [motion]);
  return (
    <video
      ref={ref}
      className="hero-video"
      muted
      loop
      playsInline
      preload="metadata"
      poster="/media/glidepath-loop-poster.jpg"
      aria-label="Violet glass modules float along a descending path"
    >
      <source src="/media/glidepath-loop.mp4" type="video/mp4" />
    </video>
  );
}
function StarButton({ m, saved, setSaved }) {
  const active = saved.includes(m.id);
  return (
    <button
      className={"ws-icon star-button " + (active ? "selected" : "")}
      aria-label={
        (active ? "Remove " : "Save ") +
        m.name +
        (active ? " from watchlist" : " to watchlist")
      }
      aria-pressed={active}
      onClick={() =>
        setSaved(active ? saved.filter((x) => x !== m.id) : [...saved, m.id])
      }
    >
      <Star size={15} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
function QuickView({ m, onClose }) {
  const [d, setD] = useState(m.day),
    [amount, setAmount] = useState(1000),
    rate = effectiveRate(m.path, d, 10000, m.milestoneCap),
    f = fees(amount, rate);
  return (
    <Modal
      title={m.name + " / " + m.symbol}
      subtitle="Illustrative launch · original demo identity"
      onClose={onClose}
      className="quick-view"
    >
      <div className="modal-pad">
        <div className="quick-title">
          <TokenLogo market={m} />
          <div>
            <span className="micro-label">TAX AT DAY {d}</span>
            <h3>
              {pct(rate)}
              <small>buy / sell</small>
            </h3>
          </div>
          <span className="ws-chip">{m.style}</span>
        </div>
        <PathVisual path={m.path} day={d} cap={m.milestoneCap} onDay={setD} />
        <div className="quick-metrics">
          <div>
            <span>Sample market cap</span>
            <b>{compact(m.fdv)}</b>
          </div>
          <div>
            <span>Scheduled floor</span>
            <b>{pct(m.path.floor)}</b>
          </div>
          <div>
            <span>Reaches floor</span>
            <b>
              {floorDay(m.path) === null
                ? "No auto-cuts"
                : "Day " + floorDay(m.path)}
            </b>
          </div>
        </div>
        <div className="quick-fee">
          <label>
            Trade size (USD)
            <input
              type="number"
              min="1"
              max="1000000000"
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(0, Math.min(1e9, +e.target.value)))
              }
            />
          </label>
          <span>
            Tax + base fee<strong>{usd(f.total)}</strong>
          </span>
        </div>
        <p className="ws-muted">
          Fee illustration excludes gas, slippage, price moves and opening tax.
        </p>
        <Link to={"/market/" + m.id} className="ws-primary" onClick={onClose}>
          Open full market <ArrowUpRight size={15} />
        </Link>
      </div>
    </Modal>
  );
}
function Compare({ ids, onClose }) {
  const selected = markets.filter((m) => ids.includes(m.id)),
    [day, setDay] = useState(30);
  return (
    <Modal
      title="Compare the paths"
      subtitle="Same age. Same $1,000 trade. Sample configurations."
      onClose={onClose}
      className="compare-modal"
    >
      <div className="modal-pad">
        <label className="lab-range">
          <span>
            Time since first trade <b>Day {day}</b>
          </span>
          <input
            type="range"
            min="0"
            max="180"
            value={day}
            onChange={(e) => setDay(+e.target.value)}
          />
        </label>
        <div className="compare-grid">
          {selected.map((m) => (
            <div key={m.id}>
              <TokenLogo market={m} />
              <h3>{m.name}</h3>
              <span className="ws-muted">
                {m.symbol} · {m.style}
              </span>
              <PathVisual path={m.path} day={day} />
              <dl>
                {[
                  [
                    "Tax",
                    pct(effectiveRate(m.path, day, 10000, m.milestoneCap)),
                  ],
                  [
                    "Fee on $1,000",
                    usd(
                      fees(
                        1000,
                        effectiveRate(m.path, day, 10000, m.milestoneCap),
                      ).total,
                    ),
                  ],
                  ["Scheduled floor", pct(m.path.floor)],
                  ["Floor day", floorDay(m.path) ?? "No auto-cuts"],
                ].map(([a, b]) => (
                  <div key={a}>
                    <dt>{a}</dt>
                    <dd>{b}</dd>
                  </div>
                ))}
              </dl>
              <Link to={"/market/" + m.id} onClick={onClose}>
                View market <ArrowUpRight size={12} />
              </Link>
            </div>
          ))}
        </div>
        <p className="ws-muted">
          Base fee included. Gas, slippage, price impact and opening tax
          excluded. Relay includes its illustrative reached milestone cap.
        </p>
      </div>
    </Modal>
  );
}

export function ProExplore({ mode = "overview" }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All paths"),
    [quote, setQuote] = useState("All quotes"),
    [sort, setSort] = useState("volume"),
    [view, setView] = useState("cards"),
    [advanced, setAdvanced] = useState(false),
    [maxTax, setMaxTax] = useState(5),
    [locked, setLocked] = useState(false),
    [saved, setSaved] = useSaved("glidepath-watchlist", []),
    [inspect, setInspect] = useState(null),
    [compare, setCompare] = useState([]),
    [comparing, setComparing] = useState(false);
  const { notify } = useWorkspace();
  const list = useMemo(
    () =>
      markets
        .filter(
          (m) =>
            (mode !== "watchlist" || saved.includes(m.id)) &&
            (m.name + " " + m.symbol)
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === "All paths" || m.style === filter) &&
            (quote === "All quotes" || m.quote === quote) &&
            current(m) <= maxTax * 100 &&
            (!locked || m.progress >= 100),
        )
        .sort((a, b) =>
          sort === "tax"
            ? current(a) - current(b)
            : sort === "cap"
              ? b.fdv - a.fdv
              : sort === "floor"
                ? (floorDay(a.path) ?? 999) - (floorDay(b.path) ?? 999)
                : b.volume - a.volume,
        ),
    [mode, saved, query, filter, quote, maxTax, locked, sort],
  );
  const toggle = (id) =>
    setCompare((v) =>
      v.includes(id)
        ? v.filter((x) => x !== id)
        : v.length < 3
          ? [...v, id]
          : (notify("Compare up to three paths at a time."), v),
    );
  const reset = () => {
    setQuery("");
    setFilter("All paths");
    setQuote("All quotes");
    setMaxTax(5);
    setLocked(false);
  };
  return (
    <>
      {mode === "overview" ? (
        <>
          <section className="workspace-hero">
            <HeroVideo />
            <div className="hero-shade" />
            <div className="workspace-hero-copy">
              <span className="hero-kicker">
                <i /> THE LOWER-ONLY LAUNCHPAD
              </span>
              <h1>
                Launch with a tax.
                <br />
                <em>Lock how it falls.</em>
              </h1>
              <p>
                A clear path from the first trade.
                <br />
                Explore the rules. Run the numbers. Build your launch.
              </p>
              <div className="hero-actions">
                <Link to="/launch" className="ws-primary">
                  <Plus size={17} />
                  Create a launch
                </Link>
                <Link to="/lab" className="ws-secondary">
                  Try the tax lab <ArrowUpRight size={15} />
                </Link>
              </div>
              <span className="hero-note">
                <ShieldCheck size={13} />
                Interactive preview · first trade starts the clock
              </span>
            </div>
            <div className="hero-live-card">
              <span>
                <i /> THE PATH, VISUALIZED
              </span>
              <b>
                3.00% <ArrowDownRight size={20} /> 1.00%
              </b>
              <small>Sample schedule · 65 days to floor</small>
              <div className="hero-mini-steps">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="page-heading">
          <div>
            <span className="micro-label">
              {mode === "watchlist" ? "YOUR SAVED PATHS" : "MARKET EXPLORER"}
            </span>
            <h1>
              {mode === "watchlist"
                ? "Keep your eyes on the path."
                : "Every launch. Every step."}
            </h1>
            <p>
              {mode === "watchlist"
                ? "Your watchlist stays in this browser."
                : "Compare tax schedules, inspect fees and find the next scheduled cut."}
            </p>
          </div>
          <Link to="/launch" className="ws-primary">
            <Plus size={16} />
            Create a launch
          </Link>
        </div>
      )}
      <section className="market-board">
        <div className="board-heading">
          <div>
            <h2>
              {mode === "watchlist" ? "Watchlist" : "Explore launches"}{" "}
              <span>{list.length}</span>
            </h2>
            <p>
              Sample market data and original demo logos. No live tokens listed.
            </p>
          </div>
          <div className="view-toggle">
            <button
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <List size={16} />
            </button>
            <button
              aria-label="Card view"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
        <div className="market-tools">
          <div className="market-filters">
            {["All paths", "Glide", "Flat", "Glide + milestone"].map((v) => (
              <button
                key={v}
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
              >
                {v === "Glide + milestone" ? "Milestone" : v}
              </button>
            ))}
          </div>
          <div className="market-tools-right">
            <label className="ws-search">
              <Search size={15} />
              <input
                aria-label="Search markets"
                placeholder="Search launches…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={13} />
                </button>
              )}
            </label>
            <button
              className={"filter-trigger " + (advanced ? "active" : "")}
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
            </button>
          </div>
        </div>
        {advanced && (
          <div className="advanced-filters">
            <label>
              Quote asset
              <select value={quote} onChange={(e) => setQuote(e.target.value)}>
                <option>All quotes</option>
                <option>ETH</option>
                <option>USDG</option>
              </select>
            </label>
            <label className="filter-range">
              Maximum current tax <b>{maxTax}%</b>
              <input
                aria-label="Maximum current tax"
                type="range"
                min="0"
                max="5"
                step=".1"
                value={maxTax}
                onChange={(e) => setMaxTax(+e.target.value)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              At liquidity target
            </label>
            <button className="ws-text-button" onClick={reset}>
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        )}
        <div className="table-controls">
          <span>
            <i className="preview-led" /> Sample snapshot <b>•</b> Select up to
            3 to compare
          </span>
          <label>
            Sort by{" "}
            <select
              aria-label="Sort markets"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="volume">24h volume</option>
              <option value="tax">Lowest tax</option>
              <option value="cap">Market cap</option>
              <option value="floor">Time to floor</option>
            </select>
          </label>
        </div>
        {!list.length ? (
          <div className="ws-empty">
            <Compass size={30} />
            <h3>
              {mode === "watchlist" && saved.length === 0
                ? "Start with a path you like."
                : "No launches match these filters."}
            </h3>
            <p>
              {mode === "watchlist" && saved.length === 0
                ? "Save a launch using its star to find it here."
                : "Try another search or widen the tax range."}
            </p>
            {mode === "watchlist" && saved.length === 0 ? (
              <Link to="/markets" className="ws-primary">
                Browse launches <ArrowRight size={14} />
              </Link>
            ) : (
              <button className="ws-secondary" onClick={reset}>
                Clear filters
              </button>
            )}
          </div>
        ) : view === "table" ? (
          <div className="market-table-scroll">
            <table className="pro-market-table">
              <thead>
                <tr>
                  <th className="select-cell">
                    <GitCompareArrows size={14} />
                  </th>
                  <th>Launch</th>
                  <th>Tax now / floor</th>
                  <th>Committed path</th>
                  <th>Market cap</th>
                  <th>24h volume</th>
                  <th>Liquidity target</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Compare " + m.name}
                        checked={compare.includes(m.id)}
                        onChange={() => toggle(m.id)}
                      />
                    </td>
                    <td>
                      <div className="table-token">
                        <TokenLogo market={m} />
                        <Link to={"/market/" + m.id}>
                          <b>{m.name}</b>
                          <small>
                            {m.symbol}
                            <i /> {m.quote}
                          </small>
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div className="tax-cell">
                        <b>{pct(current(m))}</b>
                        <ArrowDownRight size={13} />
                        <small>{pct(m.path.floor)}</small>
                      </div>
                      <span className="table-sub">{m.style}</span>
                    </td>
                    <td>
                      <div className="table-spark">
                        <PathVisual path={m.path} day={m.day} small />
                      </div>
                      <span className="table-sub">
                        {nextStep(m.path, m.day)
                          ? "Next step in " +
                            (nextStep(m.path, m.day).day - m.day) +
                            "d"
                          : "No scheduled cut"}
                      </span>
                    </td>
                    <td>
                      <b>{compact(m.fdv)}</b>
                      <span className="table-sub">
                        {m.holders.toLocaleString()} sample holders
                      </span>
                    </td>
                    <td>
                      <b>{compact(m.volume)}</b>
                      <span className="table-sub">illustrative</span>
                    </td>
                    <td>
                      <div className="liquidity-label">
                        <span>{m.progress}%</span>
                        {m.progress === 100 && <Lock size={11} />}
                      </div>
                      <div className="liquidity-bar">
                        <i style={{ width: m.progress + "%" }} />
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <StarButton m={m} saved={saved} setSaved={setSaved} />
                        <button
                          className="inspect-button"
                          aria-label={"Inspect " + m.name}
                          onClick={() => setInspect(m)}
                        >
                          <Eye size={15} />
                        </button>
                        <Link
                          to={"/market/" + m.id}
                          className="ws-icon"
                          aria-label={"Open " + m.name + " market"}
                        >
                          <ArrowUpRight size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="market-card-grid launch-card-grid">
            {list.map((m) => (
              <LaunchCard
                key={m.id}
                market={m}
                saved={saved}
                setSaved={setSaved}
                compared={compare.includes(m.id)}
                onCompare={() => toggle(m.id)}
              />
            ))}
          </div>
        )}
        <div className="board-foot">
          <span>
            <ShieldCheck size={13} />A committed tax path does not guarantee a
            token’s value.
          </span>
          <Link to="/docs/risks">
            Understand the limits <ArrowUpRight size={12} />
          </Link>
        </div>
      </section>
      {mode === "overview" && <LaunchRules />}
      {compare.length > 0 && (
        <div className="compare-tray">
          <GitCompareArrows size={18} />
          <span>{compare.length} paths selected</span>
          <div>
            {compare.map((id) => (
              <TokenLogo key={id} market={markets.find((m) => m.id === id)} />
            ))}
          </div>
          <button
            className="ws-primary"
            disabled={compare.length < 2}
            onClick={() => setComparing(true)}
          >
            Compare paths
          </button>
          <button
            className="ws-icon"
            aria-label="Clear comparison"
            onClick={() => setCompare([])}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {inspect && <QuickView m={inspect} onClose={() => setInspect(null)} />}
      {comparing && (
        <Compare ids={compare} onClose={() => setComparing(false)} />
      )}
    </>
  );
}

export function TaxLab() {
  const [path, setPath] = useState({ ...DEFAULT_PATH }),
    [day, setDay] = useState(16),
    [cap, setCap] = useState(500),
    [amount, setAmount] = useState(1000),
    [playing, setPlaying] = useState(false);
  const { motion } = useWorkspace(),
    end = Math.min(365, Math.max(30, (floorDay(path) || 30) + 10)),
    errors = validatePath(path),
    rate = effectiveRate(path, day, cap),
    f = fees(amount, rate),
    original = fees(amount, path.start);
  useEffect(() => {
    if (!playing || !motion) return;
    const t = setInterval(() => setDay((d) => (d >= end ? 0 : d + 1)), 180);
    return () => clearInterval(t);
  }, [playing, motion, end]);
  const preset = (p) => {
    setPath(p);
    setDay(0);
    setCap(500);
    setPlaying(false);
  };
  const update = (k, v) =>
    setPath((p) => ({
      ...p,
      [k]: v,
      ...(k === "start" && v < p.floor ? { floor: v } : {}),
    }));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="micro-label">
            <FlaskConical size={13} /> TAX LAB
          </span>
          <h1>Move time. Watch the fee fall.</h1>
          <p>
            A local simulator for the specified tax rules. Every number responds
            to your settings.
          </p>
        </div>
        <button
          className="ws-secondary"
          onClick={() => preset({ ...DEFAULT_PATH })}
        >
          <RotateCcw size={14} />
          Reset lab
        </button>
      </div>
      <div className="lab-grid">
        <section className="lab-controls ws-panel">
          <div className="panel-heading">
            <h2>Build a scenario</h2>
            <SlidersHorizontal size={17} />
          </div>
          <div className="lab-presets">
            {[
              ["Standard glide", DEFAULT_PATH],
              [
                "Fast glide",
                { start: 400, floor: 100, hold: 1, step: 50, interval: 3 },
              ],
              [
                "Flat",
                { start: 150, floor: 150, hold: 0, step: 0, interval: 7 },
              ],
            ].map(([name, p]) => (
              <button key={name} onClick={() => preset({ ...p })}>
                {name}
              </button>
            ))}
          </div>
          {[
            ["start", "Starting tax", 0, 500, 10, "%"],
            ["floor", "Scheduled floor", 0, path.start, 10, "%"],
            ["hold", "Initial hold", 0, 30, 1, "days"],
            ["step", "Reduction per step", 0, 100, 5, "%"],
            ["interval", "Days between steps", 1, 30, 1, "days"],
          ].map(([key, label, min, max, step, unit]) => (
            <label className="lab-range" key={key}>
              <span>
                {label}
                <b>{unit === "%" ? pct(path[key]) : path[key] + "d"}</b>
              </span>
              <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={path[key]}
                onChange={(e) => update(key, +e.target.value)}
              />
            </label>
          ))}
          <div className="creator-cap-control">
            <span className="ws-chip">
              <TrendingDown size={12} />
              CREATOR CUT
            </span>
            <p>
              A creator can lower the ceiling at any time, even below the
              scheduled floor.
            </p>
            <label className="lab-range">
              <span>
                Creator ceiling<b>{pct(cap)}</b>
              </span>
              <input
                type="range"
                aria-label="Creator ceiling"
                min="0"
                max="500"
                step="10"
                value={cap}
                onChange={(e) => setCap(+e.target.value)}
              />
            </label>
            <small>Experimental control. A real cut is permanent.</small>
          </div>
        </section>
        <div className="lab-results">
          <section className="lab-chart ws-panel">
            <div className="panel-heading">
              <div>
                <span className="micro-label">EFFECTIVE TOKEN TAX</span>
                <h2>
                  {errors.length ? "—" : pct(rate)}
                  <small>at day {day}</small>
                </h2>
              </div>
              <span className="ws-chip">
                <Lock size={12} />
                LOWER ONLY
              </span>
            </div>
            {errors.length ? (
              <div className="lab-errors" role="alert">
                {errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            ) : (
              <PathVisual path={path} day={day} cap={cap} onDay={setDay} />
            )}
            <div className="timeline-controls">
              <button
                className="ws-secondary"
                disabled={!motion || errors.length > 0}
                onClick={() => setPlaying(!playing)}
              >
                {playing && motion ? <Pause size={14} /> : <Play size={14} />}{" "}
                {playing && motion ? "Pause timeline" : "Play timeline"}
              </button>
              <div>
                {[0, 7, 30, 65]
                  .filter((d) => d <= end)
                  .map((d) => (
                    <button
                      key={d}
                      aria-pressed={day === d}
                      onClick={() => {
                        setDay(d);
                        setPlaying(false);
                      }}
                    >
                      Day {d}
                    </button>
                  ))}
              </div>
            </div>
            <div className="chart-legend">
              <span>
                <i />
                Scheduled path
              </span>
              <span>
                <i className="lime" />
                Creator ceiling
              </span>
              <span>First trade starts day 0</span>
            </div>
          </section>
          <section className="lab-fees ws-panel">
            <div className="panel-heading">
              <h2>What a trade costs</h2>
              <label className="lab-amount">
                $
                <input
                  aria-label="Trade amount in dollars"
                  type="number"
                  min="1"
                  max="1000000000"
                  value={amount}
                  onChange={(e) =>
                    setAmount(Math.max(0, Math.min(1e9, +e.target.value)))
                  }
                />
              </label>
            </div>
            <div className="fee-total">
              <div>
                <span>Total fee at day {day}</span>
                <strong>{errors.length ? "—" : usd(f.total)}</strong>
              </div>
              <div>
                <span>At starting tax</span>
                <b>{usd(original.total)}</b>
              </div>
              <span className="fee-saving">
                {errors.length
                  ? "Adjust path"
                  : usd(Math.max(0, original.total - f.total)) + " less"}
              </span>
            </div>
            <div className="fee-allocation">
              <i style={{ flex: Math.max(0, f.creator) }} />
              <i style={{ flex: Math.max(0, f.platform - f.base) }} />
              <i style={{ flex: Math.max(0, f.base) }} />
            </div>
            <div className="fee-breakdown">
              {[
                ["Creator", f.creator],
                ["Platform tax share", f.platform - f.base],
                ["Base fee · 0.30%", f.base],
              ].map(([a, b], i) => (
                <div key={a}>
                  <span>
                    <i className={"allocation-" + i} />
                    {a}
                  </span>
                  <b>{errors.length ? "—" : usd(b)}</b>
                </div>
              ))}
            </div>
            <p className="ws-muted">
              Normal trading only. Opening tax, gas, slippage and price impact
              are excluded. Amounts are fee illustrations, not trade quotes.
            </p>
          </section>
          <div className="lab-rule">
            <ShieldCheck size={21} />
            <p>
              <b>The smallest ceiling wins.</b> Effective tax is the lowest of
              the scheduled rate, the creator’s ceiling and any reached
              milestone cap. This lab varies the first two.
            </p>
            <Link to="/docs/overview">
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export function PathActivity() {
  const [filter, setFilter] = useState("Upcoming"),
    [query, setQuery] = useState("");
  const rows = markets
    .flatMap((m) => {
      let list = [{ kind: "Launch", day: 0, rate: m.path.start, m }];
      if (m.path.step)
        for (
          let d = m.path.hold;
          d <= Math.min(365, floorDay(m.path));
          d += m.path.interval
        )
          list.push({
            kind:
              rateAt(m.path, d) === m.path.floor
                ? "Floor reached"
                : "Scheduled cut",
            day: d,
            rate: rateAt(m.path, d),
            m,
          });
      return list;
    })
    .filter(
      (e) =>
        (filter === "All events" ||
          (filter === "Upcoming" ? e.day > e.m.day : e.day <= e.m.day)) &&
        (e.m.name + " " + e.m.symbol)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      filter === "Past"
        ? b.day - b.m.day - (a.day - a.m.day)
        : a.day - a.m.day - (b.day - b.m.day),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="micro-label">
            <Activity size={13} /> PATH ACTIVITY
          </span>
          <h1>The next step is already written.</h1>
          <p>
            Events calculated from sample schedules. Each launch has its own
            first-trade clock.
          </p>
        </div>
        <span className="sample-badge">DERIVED EVENTS · NOT LIVE</span>
      </div>
      <section className="ws-panel activity-board">
        <div className="market-tools">
          <div className="market-filters">
            {["Upcoming", "Past", "All events"].map((t) => (
              <button
                key={t}
                aria-pressed={filter === t}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="ws-search">
            <Search size={15} />
            <input
              placeholder="Find a launch…"
              aria-label="Filter path activity"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="activity-timeline">
          {rows.length ? (
            rows.map((e) => (
              <Link
                key={e.m.id + "-" + e.day + "-" + e.kind}
                to={"/market/" + e.m.id}
                className="activity-event"
              >
                <div className="event-dot">
                  {e.kind === "Floor reached" ? (
                    <Lock size={16} />
                  ) : e.kind === "Launch" ? (
                    <Plus size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                </div>
                <TokenLogo market={e.m} />
                <div className="event-copy">
                  <h3>
                    {e.m.name}
                    <small>{e.kind}</small>
                  </h3>
                  <p>
                    {e.kind === "Launch"
                      ? "Initial committed rate"
                      : e.kind === "Floor reached"
                        ? "Last scheduled reduction"
                        : "Time-based rate reduction"}{" "}
                    · day {e.day}
                  </p>
                </div>
                <div className="event-rate">
                  <b>{pct(e.rate)}</b>
                  <small>
                    {e.day > e.m.day
                      ? "in " + (e.day - e.m.day) + " days"
                      : e.day === e.m.day
                        ? "at sample snapshot"
                        : e.m.day - e.day + " days before snapshot"}
                  </small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <div className="ws-empty">
              <Search />
              <p>No matching schedule events.</p>
            </div>
          )}
        </div>
        <div className="board-foot">
          Milestone and discretionary creator cuts are excluded from this
          time-based event list.
        </div>
      </section>
    </>
  );
}
