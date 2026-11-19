import React, { useState, useId, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Check,
  Plus,
  Minus,
  Menu,
  X,
  Copy,
  Star,
  TrendingDown,
  Lock,
  Terminal,
  LayoutGrid,
  Globe,
  Layers,
  FileCode2,
} from "lucide-react";
import {
  DEFAULT_PATH,
  rateAt,
  floorDay,
  nextStep,
  effectiveRate,
  fees,
  pct,
  usd,
  compact,
} from "./tax.mjs";
import { roadmap, faqs } from "./data";
export const Arrow = () => <ArrowUpRight size={14} />;
export const Link = ({ to = "/", children, className = "", ...p }) => (
  <a href={"#" + to} className={className} {...p}>
    {children}
  </a>
);
export const Button = ({ to, children, variant = "", className = "", ...p }) =>
  to ? (
    <Link to={to} className={"button " + variant + " " + className} {...p}>
      {children}
    </Link>
  ) : (
    <button className={"button " + variant + " " + className} {...p}>
      {children}
    </button>
  );
export const Tag = ({ children, tone = "" }) => (
  <span className={"tag " + tone}>{children}</span>
);
export const Logo = () => (
  <Link to="/" className="brand eyes-brand" aria-label="GLIDY home">
    <span className="brand-eye-crop">
      <img
        className="brand-symbol"
        src="/brand/glidey-soft-eyes-transparent.png"
        alt=""
        width="34"
        height="34"
      />
    </span>
  </Link>
);
export function useSaved(key, initial) {
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null || (Array.isArray(initial) && !Array.isArray(value))
        ? initial
        : value;
    } catch {
      return initial;
    }
  };
  const [value, setValue] = useState(read);
  useEffect(() => {
    const sync = (e) => {
      if (!e.key || e.key === key) setValue(read());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("glidepath-storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("glidepath-storage", sync);
    };
  }, [key]);
  return [
    value,
    (fn) => {
      const next = typeof fn === "function" ? fn(read()) : fn;
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event("glidepath-storage"));
      } catch {}
    },
  ];
}
export function Panel({ title, children, className = "", action }) {
  return (
    <div className={"panel " + className}>
      <div className="panel-head">
        <span className="terminal-dot">&gt;_</span>
        <span>{title}</span>
        <span className="panel-action">{action || "⊞"}</span>
      </div>
      {children}
    </div>
  );
}
export function Heading({ label, title, description, level = 2 }) {
  const Title = level === 1 ? "h1" : "h2";
  return (
    <div className="section-heading">
      {label && <p className="eyebrow">[ {label} ]</p>}
      <Title>{title}</Title>
      {description && <p>{description}</p>}
    </div>
  );
}
export function Header({ isApp }) {
  let [open, setOpen] = useState(false),
    [drop, setDrop] = useState(false);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setDrop(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner">
          <Logo />
          <nav
            aria-label="Main navigation"
            className={"nav " + (open ? "opened" : "")}
          >
            <div className="nav-dropdown">
              <button aria-expanded={drop} onClick={() => setDrop(!drop)}>
                product <ChevronDown size={10} />
              </button>
              {drop && (
                <div className="dropdown">
                  {[
                    ["/explore", "Explore markets"],
                    ["/launch", "Launch designer"],
                    ["/docs", "The tax path"],
                  ].map(([t, n]) => (
                    <Link
                      to={t}
                      key={t}
                      onClick={() => {
                        setDrop(false);
                        setOpen(false);
                      }}
                    >
                      {n}
                      <Arrow />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {[
              ["/about", "about"],
              ["/how-it-works", "how it works"],
              ["/roadmap", "roadmap"],
              ["/docs", "docs"],
            ].map(([t, n]) => (
              <Link key={t} to={t} onClick={() => setOpen(false)}>
                {n}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <span className="network">
              <i /> Robinhood Chain
            </span>
            <Button
              variant="dark"
              className={!isApp ? "button-satin" : ""}
              to={isApp ? "/" : "/explore"}
            >
              {isApp ? "website" : "Launchpad"}
              <Arrow />
            </Button>
            <button
              className="menu-toggle icon-button"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Logo />
            <p>
              Launch with a tax.
              <br />
              Lock how it falls.
            </p>
          </div>
          {[
            [
              "Product",
              [
                ["/explore", "Explore markets"],
                ["/launch", "Launch designer"],
                ["/how-it-works", "How it works"],
              ],
            ],
            [
              "Learn",
              [
                ["/about", "About GLIDY"],
                ["/case-study", "The $10,000 trade"],
                ["/roadmap", "Roadmap"],
              ],
            ],
            [
              "Resources",
              [
                ["/docs", "Documentation"],
                ["/docs/api", "Tax-path API"],
                ["/docs/risks", "Fees & risks"],
              ],
            ],
            [
              "Preview",
              [
                ["/docs/status", "Integration status"],
                ["/docs/privacy", "Privacy"],
              ],
            ],
          ].map(([t, ls]) => (
            <div key={t}>
              <h3>{t}</h3>
              {ls.map(([to, n]) => (
                <Link key={to} to={to}>
                  {n}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 GLIDY</span>
          <span>Built on Uniswap v4 on Robinhood Chain</span>
          <span>
            <i className="status-dot" /> interactive preview
          </span>
        </div>
      </div>
    </footer>
  );
}
export function TaxChart({
  path = DEFAULT_PATH,
  day = 16,
  creatorCap = 10000,
  milestoneCap = 10000,
  interactive = true,
}) {
  let [cursor, setCursor] = useState(null),
    id = useId(),
    end = Math.max(20, (floorDay(path) || 60) + 7),
    active = cursor ?? Math.min(day, end),
    max = Math.max(100, path.start),
    x = (d) => 60 + (d / end) * 810,
    y = (r) => 32 + ((max - r) / max) * 205;
  let d = `M ${x(0)} ${y(effectiveRate(path, 0, creatorCap, milestoneCap))}`;
  for (let t = 0; t <= end; t += 0.25)
    d += ` L ${x(t).toFixed(2)} ${y(effectiveRate(path, t, creatorCap, milestoneCap)).toFixed(2)}`;
  let val = effectiveRate(path, active, creatorCap, milestoneCap);
  return (
    <div className="tax-chart">
      <svg
        viewBox="0 0 910 290"
        role="img"
        aria-label={`Tax path: ${pct(path.start)} start, ${pct(path.floor)} floor, ${path.step ? "day " + floorDay(path) : "Flat, no scheduled cuts"}. Day ${active}: ${pct(val)}.`}
      >
        <defs>
          <linearGradient id={"fill" + id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#7861e0" stopOpacity=".25" />
            <stop offset="100%" stopColor="#7861e0" stopOpacity=".04" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="60"
              y1={32 + (i * 205) / 4}
              x2="870"
              y2={32 + (i * 205) / 4}
              stroke="#e4e1eb"
              strokeDasharray="3 4"
            />
            <text x="43" y={36 + (i * 205) / 4} textAnchor="end">
              {((max / 100) * (1 - i / 4)).toFixed(1)}%
            </text>
            <line
              x1={60 + (i * 810) / 4}
              x2={60 + (i * 810) / 4}
              y1="32"
              y2="237"
              stroke="#efedf4"
            />
            <text x={60 + (i * 810) / 4} y="267" textAnchor="middle">
              {i ? "DAY " + Math.round((end * i) / 4) : "LAUNCH"}
            </text>
          </g>
        ))}
        <path d={d + " L 870 237 L 60 237 Z"} fill={`url(#fill${id})`} />
        <path d={d} fill="none" stroke="#6950dd" strokeWidth="2.3" />
        <line
          x1="60"
          x2="870"
          y1={y(path.floor)}
          y2={y(path.floor)}
          stroke="#aaa188"
          strokeDasharray="3 5"
        />
        <line
          x1={x(active)}
          x2={x(active)}
          y1="28"
          y2="237"
          stroke="#6950dd"
          opacity=".3"
        />
        <circle
          cx={x(active)}
          cy={y(val)}
          r="6"
          fill="#6950dd"
          stroke="white"
          strokeWidth="3"
        />
        <g
          transform={`translate(${Math.min(x(active), 770)},${Math.max(11, y(val) - 34)})`}
        >
          <rect x="-30" y="-8" width="102" height="26" rx="2" fill="#1a1522" />
          <text
            x="21"
            y="9"
            textAnchor="middle"
            fill="white"
            className="tooltip-label"
          >
            {pct(val)} · D{Math.floor(active)}
          </text>
        </g>
      </svg>
      {interactive && (
        <div className="chart-scrubber">
          <label htmlFor={id}>
            preview day <b>{Math.floor(active)}</b>
          </label>
          <input
            id={id}
            aria-label="Preview day"
            type="range"
            min="0"
            max={end}
            value={active}
            onChange={(e) => setCursor(+e.target.value)}
          />
          <button className="text-button" onClick={() => setCursor(null)}>
            reset
          </button>
        </div>
      )}
    </div>
  );
}
export function PathStats({
  path = DEFAULT_PATH,
  day = 16,
  creatorCap = 10000,
  milestoneCap = 10000,
}) {
  let r = effectiveRate(path, day, creatorCap, milestoneCap),
    n = nextStep(path, day),
    f = floorDay(path);
  return (
    <div className="path-stats">
      {[
        ["current tax", pct(r), "buy / sell"],
        [
          "next scheduled step",
          n ? pct(Math.min(n.rate, creatorCap, milestoneCap)) : "—",
          n ? "in " + (n.day - day) + " days" : "creator cut only",
        ],
        [
          "scheduled floor",
          pct(path.floor),
          f !== null ? "day " + f : "Flat path",
        ],
        [
          "days to floor",
          f !== null ? Math.max(0, f - day) : "—",
          f !== null ? "time path" : "no scheduled cut",
        ],
      ].map(([k, v, t], i) => (
        <div key={k}>
          <span>{k}</span>
          <strong>
            {v}
            {i === 0 && <TrendingDown size={17} />}
          </strong>
          <small>{t}</small>
        </div>
      ))}
    </div>
  );
}
export function PathDemo() {
  return (
    <Panel
      title="[ fig. 1 · the tax path ]"
      className="hero-panel"
      action={
        <Tag>
          <i className="status-dot" /> sample path
        </Tag>
      }
    >
      <div className="chart-intro">
        <div>
          <span className="eyebrow">COMMITTED AT CREATION</span>
          <p>One direction. Written in the pool.</p>
        </div>
        <div className="chart-legend">
          <span>
            <i /> creator tax
          </span>
          <span>
            <i className="floor" /> 1% floor
          </span>
        </div>
      </div>
      <PathStats />
      <TaxChart />
      <div className="panel-foot">
        <span>
          <Lock size={12} /> 3% start · 2 day hold · −0.2% every 7 days
        </span>
        <Link to="/launch">
          design your path <Arrow />
        </Link>
      </div>
    </Panel>
  );
}
export function CodePanel() {
  let [tab, setTab] = useState(0),
    [copy, setCopy] = useState(false),
    code = tab
      ? `function taxNow(pool, side) {\n  return min(\n    timePath(pool, side),\n    creatorCeiling(pool, side),\n    reachedMilestoneCap(pool)\n  );\n}\n\n// Each component can only fall.\n// The lowest rate wins.`
      : `name: my-next-launch\nchain: robinhood\nquote: ETH\n\ntax_path:\n  start: 3.0%\n  hold: 2 days\n  step: -0.2%\n  every: 7 days\n  floor: 1.0%\n\n# first cut: day 2\n# floor reached: day 65\n# raises: impossible`;
  return (
    <div className="code-panel">
      <div className="code-head">
        <div>
          {["launch.yaml", "tax-path.ts"].map((t, i) => (
            <button
              key={t}
              className={tab === i ? "selected" : ""}
              aria-pressed={tab === i}
              onClick={() => {
                setTab(i);
                setCopy(false);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label={copy ? "Copied code" : "Copy code"}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopy(true);
            } catch {
              setCopy(false);
            }
          }}
        >
          {copy ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="code-content">
        {code.split("\n").map((l, i) => (
          <div key={i}>
            <span className="line-number">{i + 1}</span>
            <code
              className={
                l.startsWith("#") || l.includes("//")
                  ? "comment"
                  : l.includes(":")
                    ? "syntax"
                    : ""
              }
            >
              {l || " "}
            </code>
          </div>
        ))}
      </div>
      <div className="code-footer">
        <span>
          <i className="status-dot" /> fixed at creation
        </span>
        <span>illustrative config</span>
      </div>
    </div>
  );
}
export function MiniChart({ path, color = "#7861e0" }) {
  let end = floorDay(path) || 65,
    d = `M 0 ${58 - (path.start / 500) * 50}`;
  for (let t = 0; t <= end; t += 0.5)
    d += ` L ${((t / end) * 260).toFixed(1)} ${(58 - (rateAt(path, t) / 500) * 50).toFixed(1)}`;
  return (
    <svg className="mini-chart" viewBox="0 0 260 70" aria-hidden="true">
      <line x1="0" x2="260" y1="58" y2="58" stroke="#e6e3eb" />
      <path d={d + " L 260 58 L 0 58 Z"} fill={color} fillOpacity=".08" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
export function MarketCard({ market: m }) {
  let [saved, setSaved] = useSaved("glidepath-watchlist", []),
    r = effectiveRate(m.path, m.day, 10000, m.milestoneCap),
    n = nextStep(m.path, m.day);
  return (
    <article className="market-card">
      <div className="market-card-top">
        <Link to={"/market/" + m.id} className="market-identity">
          <span className="token-icon" style={{ background: m.color }}>
            <img
              src={"/tokens/" + m.id + ".svg"}
              alt={m.name + " demo logo"}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </span>
          <span>
            <h3>{m.name}</h3>
            <small>
              ${m.symbol} · {m.quote}
            </small>
          </span>
        </Link>
        <button
          className={
            "icon-button star " + (saved.includes(m.id) ? "saved" : "")
          }
          aria-label={(saved.includes(m.id) ? "Remove " : "Save ") + m.name}
          aria-pressed={saved.includes(m.id)}
          onClick={() =>
            setSaved((s) =>
              s.includes(m.id) ? s.filter((v) => v !== m.id) : [...s, m.id],
            )
          }
        >
          <Star size={15} />
        </button>
      </div>
      <div className="market-rate">
        <strong>{pct(r)}</strong>
        <Tag tone={m.style === "Flat" ? "" : "violet"}>{m.style}</Tag>
      </div>
      <div className="market-label">current buy / sell tax</div>
      <MiniChart
        path={m.path}
        color={m.style === "Flat" ? "#a99a79" : "#7861e0"}
      />
      <div className="market-facts">
        <span>
          next cut <b>{n ? "day " + n.day : "creator only"}</b>
        </span>
        <span>
          floor <b>{pct(m.path.floor)}</b>
        </span>
        <span>
          days to floor{" "}
          <b>
            {floorDay(m.path) === null
              ? "—"
              : Math.max(0, floorDay(m.path) - m.day)}
          </b>
        </span>
      </div>
      <div className="market-card-bottom">
        <span>
          FDV <b>{compact(m.fdv)}</b>
        </span>
        <Link to={"/market/" + m.id}>
          view path <Arrow />
        </Link>
      </div>
    </article>
  );
}
export function CostStudy() {
  let [r, setR] = useState(300),
    f = fees(10000, r);
  return (
    <Panel title="[ fig. 2 · round-trip costs ]">
      <div className="cost-title">
        <span>$10,000 buy + $10,000 sell</span>
        <Tag>worked example</Tag>
      </div>
      <div className="cost-options">
        {[300, 200, 100, 50, 0].map((v) => (
          <button
            key={v}
            aria-pressed={r === v}
            className={r === v ? "active" : ""}
            onClick={() => setR(v)}
          >
            {pct(v)}
          </button>
        ))}
      </div>
      <div className="cost-output">
        <span>creator tax + base fee</span>
        <strong>{usd(f.total * 2)}</strong>
        <p>
          {usd(f.tax * 2)} tax <Plus size={12} /> {usd(f.base * 2)} base fee
        </p>
      </div>
      <div className="cost-bar">
        <span style={{ width: ((f.tax * 2) / 660) * 100 + "%" }} />
        <i style={{ width: "9.09%" }} />
      </div>
      <div className="panel-foot">
        Equal trade sizes; excludes price moves, slippage and gas.
      </div>
    </Panel>
  );
}
export function Roadmap() {
  let [active, setActive] = useState(0),
    r = roadmap[active];
  return (
    <div className="roadmap">
      <div className="roadmap-tabs" role="tablist" aria-label="Rollout stages">
        {roadmap.map((s, i) => (
          <button
            key={i}
            role="tab"
            id={"stage-" + i}
            aria-selected={active === i}
            aria-controls="stage-panel"
            className={active === i ? "active" : ""}
            onClick={() => setActive(i)}
          >
            <span>0{i + 1}</span>
            {s[0]}
            <Arrow />
          </button>
        ))}
      </div>
      <div
        className="roadmap-panel"
        role="tabpanel"
        id="stage-panel"
        aria-labelledby={"stage-" + active}
      >
        <div className="roadmap-counter">
          0{active + 1}
          <span>/05</span>
        </div>
        <div>
          <Tag tone="yellow">
            stage {active + 1} · {active === 4 ? "conditional" : "planned"}
          </Tag>
          <h3>{r[1]}</h3>
          <p>{r[2]}</p>
          <ul>
            {r[3].map((t) => (
              <li key={t}>
                <Check size={13} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
export const FAQ = () => (
  <div className="faq">
    {faqs.map(([q, a]) => (
      <details key={q}>
        <summary>
          <span>&gt;</span>
          {q}
          <Plus className="plus" size={14} />
          <Minus className="minus" size={14} />
        </summary>
        <p>{a}</p>
      </details>
    ))}
  </div>
);
