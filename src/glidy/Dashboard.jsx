import React, { useState, useMemo, useId, useRef } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Star,
  Plus,
  Info,
  ArrowLeft,
  ArrowRight,
  TrendingDown,
  Lock,
  Check,
  Download,
  Shield,
  Upload,
  ChevronDown,
} from "lucide-react";
import {
  DEFAULT_PATH,
  rateAt,
  floorDay,
  nextStep,
  effectiveRate,
  fees,
  validatePath,
  pct,
  usd,
  compact,
} from "./tax.mjs";
import { markets } from "./data";
import { FieldHeading, LaunchCoach, ReviewCommitment } from "./LaunchGuide";
import {
  QuoteAssetPicker,
  QuoteLogo,
  DesignerChoices,
  LaunchIdentity,
} from "./LaunchDesignerParts";
import { isQuoteAsset } from "./quote-assets.mjs";
import {
  Arrow,
  Link,
  Button,
  Tag,
  Panel,
  PathStats,
  TaxChart,
  MarketCard,
  useSaved,
} from "./ui";
export function AppShell({ children }) {
  return <div className="legacy-workspace-content">{children}</div>;
}
export function Explore({ watchlist = false }) {
  let [q, setQ] = useState(""),
    [style, setStyle] = useState("All paths"),
    [sort, setSort] = useState("Featured"),
    [view, setView] = useState("cards"),
    [saved] = useSaved("glidepath-watchlist", []);
  let filtered = useMemo(
    () =>
      markets
        .filter(
          (m) =>
            (!watchlist || saved.includes(m.id)) &&
            (m.name + " " + m.symbol).toLowerCase().includes(q.toLowerCase()) &&
            (style === "All paths" || m.style === style),
        )
        .sort((a, b) =>
          sort === "Lowest tax"
            ? effectiveRate(a.path, a.day, 10000, a.milestoneCap) -
              effectiveRate(b.path, b.day, 10000, b.milestoneCap)
            : sort === "Market cap"
              ? b.fdv - a.fdv
              : sort === "Days to floor"
                ? (floorDay(a.path) === null
                    ? Infinity
                    : Math.max(0, floorDay(a.path) - a.day)) -
                  (floorDay(b.path) === null
                    ? Infinity
                    : Math.max(0, floorDay(b.path) - b.day))
                : 0,
        ),
    [q, style, sort, saved, watchlist],
  );
  return (
    <AppShell route={watchlist ? "watchlist" : "explore"}>
      <div className="app-heading">
        <div>
          <p className="eyebrow">[ THE MARKET EXPLORER ]</p>
          <h1>{watchlist ? "Your watchlist." : "Every launch has a path."}</h1>
          <p>
            {watchlist
              ? "Keep the tax paths you want to follow in one place."
              : "Read the current tax, the next step and the floor before you trade."}
          </p>
        </div>
        <Button variant="dark" to="/launch">
          design a launch <Plus size={14} />
        </Button>
      </div>
      <div className="explore-overview">
        <div>
          <span>MARKETS IN PREVIEW</span>
          <strong>06</strong>
          <small>illustrative launches</small>
        </div>
        <div>
          <span>MAXIMUM STARTING TAX</span>
          <strong>
            5<span>%</span>
          </strong>
          <small>per side, fixed at creation</small>
        </div>
        <div>
          <span>BASE FEE</span>
          <strong>
            0.3<span>%</span>
          </strong>
          <small>on every trade</small>
        </div>
        <div className="overview-note">
          <TrendingDown size={24} />
          <p>
            Tax can only go down.
            <br />
            <span>Price can move either way.</span>
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} />
          <input
            aria-label="Search markets"
            placeholder="Search name or ticker..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setQ("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <label className="select-control">
          <SlidersHorizontal size={14} />
          <select
            aria-label="Filter by path style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            {["All paths", "Glide", "Glide + milestone", "Flat"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="select-control sort-control">
          <span>sort:</span>
          <select
            aria-label="Sort markets"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {["Featured", "Lowest tax", "Days to floor", "Market cap"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
        <div className="view-switch">
          {[
            ["cards", LayoutGrid, "Card view"],
            ["table", List, "Table view"],
          ].map(([v, I, l]) => (
            <button
              key={v}
              aria-label={l}
              aria-pressed={view === v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              <I size={15} />
            </button>
          ))}
        </div>
      </div>
      <div className="result-caption">
        <span>
          {String(filtered.length).padStart(2, "0")}{" "}
          {watchlist ? "saved" : "sample"} markets
        </span>
        <span>
          <i className="status-dot" /> tax paths visible by default
        </span>
      </div>
      {filtered.length ? (
        view === "cards" ? (
          <div className="explore-grid">
            {filtered.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Market",
                    "Style",
                    "Current tax",
                    "Next cut",
                    "Floor",
                    "Days to floor",
                    "FDV",
                    "",
                  ].map((t, i) => (
                    <th key={i}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link className="table-token" to={"/market/" + m.id}>
                        <span
                          className="token-icon"
                          style={{ background: m.color }}
                        >
                          <img
                            src={"/tokens/" + m.id + ".svg"}
                            alt={m.name + " demo logo"}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        </span>
                        <span>
                          {m.name}
                          <small>${m.symbol}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Tag>{m.style}</Tag>
                    </td>
                    <td>
                      {pct(effectiveRate(m.path, m.day, 10000, m.milestoneCap))}
                    </td>
                    <td>
                      {nextStep(m.path, m.day)
                        ? "day " + nextStep(m.path, m.day).day
                        : "creator only"}
                    </td>
                    <td>{pct(m.path.floor)}</td>
                    <td>
                      {floorDay(m.path) === null
                        ? "—"
                        : Math.max(0, floorDay(m.path) - m.day)}
                    </td>
                    <td>{compact(m.fdv)}</td>
                    <td>
                      <Link
                        to={"/market/" + m.id}
                        aria-label={"View " + m.name}
                      >
                        <Arrow />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="empty">
          <Search size={28} />
          <h2>
            {watchlist && !q ? "Nothing saved yet." : "No markets match."}
          </h2>
          <p>
            {watchlist && !q
              ? "Save a market with the star to follow its path."
              : "Try another name or clear the filters."}
          </p>
          <Button
            to={watchlist ? "/explore" : undefined}
            onClick={() => {
              setQ("");
              setStyle("All paths");
            }}
          >
            {watchlist ? "explore markets" : "clear filters"}
            <Arrow />
          </Button>
        </div>
      )}
      <div className="explore-disclaimer">
        <Info size={15} />
        <p>
          Market data is illustrative. No project vetting or live trading is
          offered in this preview. Tax applies only in the GLIDY pool. A
          0.3% base fee is additional to the displayed tax.
        </p>
        <Link to="/docs/risks">
          read the limits <Arrow />
        </Link>
      </div>
    </AppShell>
  );
}
export function Market({ id }) {
  let m = markets.find((m) => m.id === id),
    [cap, setCap] = useState(10000),
    [cut, setCut] = useState("1"),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState("path");
  if (!m)
    return (
      <AppShell>
        <h1>Market not found.</h1>
        <Link to="/explore">Back to markets</Link>
      </AppShell>
    );
  let rate = effectiveRate(m.path, m.day, cap, m.milestoneCap),
    n = nextStep(m.path, m.day);
  return (
    <AppShell route="market">
      <Link className="back-link" to="/explore">
        <ArrowLeft size={13} /> all markets
      </Link>
      <div className="market-heading">
        <div className="market-identity">
          <span className="token-icon large" style={{ background: m.color }}>
            <img
              src={"/tokens/" + m.id + ".svg"}
              alt={m.name + " demo logo"}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </span>
          <div>
            <h1>
              {m.name} <span>${m.symbol}</span>
            </h1>
            <p>
              {m.quote} market · <Tag>{m.style}</Tag> <Tag>sample</Tag>
            </p>
          </div>
        </div>
        <Tag>
          <Lock size={12} /> lower-only tax path
        </Tag>
      </div>
      <div className="market-detail-grid">
        <div>
          <Panel
            title={"[ " + m.symbol.toLowerCase() + " · committed tax path ]"}
          >
            <PathStats
              path={m.path}
              day={m.day}
              creatorCap={cap}
              milestoneCap={m.milestoneCap}
            />
            <TaxChart
              path={m.path}
              day={m.day}
              creatorCap={cap}
              milestoneCap={m.milestoneCap}
            />
            <div className="panel-foot">
              <span>Current sample: day {m.day}</span>
              <span>tax + 0.3% base fee</span>
            </div>
          </Panel>
          <div className="metric-strip">
            {[
              ["FDV", compact(m.fdv)],
              ["24H VOLUME", compact(m.volume)],
              ["HOLDERS", m.holders],
              ["LIQUIDITY TARGET", m.progress + "%"],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div
            className="detail-tabs"
            role="tablist"
            aria-label="Market information"
          >
            {["path", "activity", "creator tools"].map((t) => (
              <button
                role="tab"
                id={"detail-" + t.replace(" ", "-")}
                aria-controls="market-panel"
                aria-selected={tab === t}
                key={t}
                onClick={() => setTab(t)}
                className={tab === t ? "active" : ""}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="detail-body"
            id="market-panel"
            role="tabpanel"
            aria-labelledby={"detail-" + tab.replace(" ", "-")}
          >
            {tab === "path" ? (
              <>
                <h3>Fixed before the first trade.</h3>
                <p>
                  {m.style === "Flat"
                    ? "A Flat launch has no automatic tax reduction. Only a voluntary creator cut can lower the rate."
                    : "This illustrative path commits each scheduled cut before trading. The time path continues unchanged when liquidity reaches its target."}
                </p>
                <dl className="path-definition">
                  {[
                    ["Starting tax", pct(m.path.start) + " buy / sell"],
                    ["Hold time", m.path.hold + " days"],
                    [
                      "Scheduled step",
                      m.path.step
                        ? "-" +
                          pct(m.path.step) +
                          " every " +
                          m.path.interval +
                          " days"
                        : "none · Flat",
                    ],
                    ["Scheduled floor", pct(m.path.floor)],
                    [
                      "Reaches floor",
                      floorDay(m.path) === null
                        ? "creator cuts only"
                        : "day " + floorDay(m.path),
                    ],
                    ["Next time step", n ? "day " + n.day : "none"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                {m.milestoneCap && (
                  <div className="info-note">
                    <Check size={15} />
                    <p>
                      Sample reached milestone cap: {pct(m.milestoneCap)}.
                      Unreached milestones are excluded from the chart.
                    </p>
                  </div>
                )}
              </>
            ) : tab === "activity" ? (
              <>
                <h3>Sample path events</h3>
                <div className="event-list">
                  {Array.from(
                    {
                      length: m.path.step
                        ? Math.min(
                            4,
                            Math.floor(
                              (m.day - m.path.hold) / m.path.interval,
                            ) + 1,
                          )
                        : 0,
                    },
                    (_, i) => ({
                      d: m.path.hold + i * m.path.interval,
                      r: rateAt(m.path, m.path.hold + i * m.path.interval),
                    }),
                  )
                    .reverse()
                    .map((e) => (
                      <div key={e.d}>
                        <span>
                          <TrendingDown size={14} />
                          time step
                        </span>
                        <span>day {e.d}</span>
                        <b>{pct(e.r)}</b>
                      </div>
                    ))}
                  <div>
                    <span>
                      <Lock size={14} />
                      path committed
                    </span>
                    <span>creation</span>
                    <b>{pct(m.path.start)}</b>
                  </div>
                </div>
                <p className="fine-print">
                  Time steps require no onchain transaction. Events shown here
                  are derived from the sample schedule.
                </p>
              </>
            ) : (
              <>
                <h3>Undercut the path.</h3>
                <p>
                  Simulate a creator cut. The new ceiling must be below the
                  current tax.
                </p>
                <label className="field">
                  New ceiling (%)
                  <input
                    type="number"
                    min="0"
                    max={rate / 100}
                    step="0.01"
                    value={cut}
                    onChange={(e) => setCut(e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <Button
                    variant="dark"
                    onClick={() => {
                      let b = Math.round(Number(cut) * 100);
                      if (
                        cut === "" ||
                        !Number.isFinite(b) ||
                        b < 0 ||
                        b >= rate
                      ) {
                        setNotice("Enter a ceiling below " + pct(rate) + ".");
                        return;
                      }
                      setCap(b);
                      setNotice(
                        "Sample ceiling lowered to " +
                          pct(b) +
                          ". No transaction sent.",
                      );
                    }}
                  >
                    simulate cut <TrendingDown size={14} />
                  </Button>
                  <Button
                    onClick={() => {
                      setCap(10000);
                      setNotice("Sample ceiling reset.");
                    }}
                  >
                    reset simulation
                  </Button>
                </div>
                <p role="status">{notice}</p>
              </>
            )}
          </div>
        </div>
        <aside>
          <QuoteBox rate={rate} name={m.name} />
          <div className="market-aside-note">
            <Shield size={18} />
            <h3>The tax only goes down.</h3>
            <p>
              That does not protect the price or prevent the creator from
              selling tokens they hold.
            </p>
            <Link to="/docs/risks">
              read honest limits <Arrow />
            </Link>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
function QuoteBox({ rate, name }) {
  let [amount, setAmount] = useState("1000"),
    [side, setSide] = useState("buy"),
    [notice, setNotice] = useState(""),
    n = Number(amount),
    valid = amount !== "" && Number.isFinite(n) && n > 0 && n <= 1e12,
    f = fees(valid ? n : 0, rate);
  return (
    <div className="quote-box">
      <div className="quote-heading">
        <h3>See the all-in cost.</h3>
        <Tag>estimate</Tag>
      </div>
      <div className="quote-side">
        {["buy", "sell"].map((t) => (
          <button
            key={t}
            aria-pressed={side === t}
            className={side === t ? "active" : ""}
            onClick={() => {
              setSide(t);
              setNotice("");
            }}
          >
            {t} {name}
          </button>
        ))}
      </div>
      <label className="amount-label">
        Quote value (USD equivalent)
        <div>
          <input
            aria-label="Trade quote value"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setNotice("");
            }}
          />
          <span>USD</span>
        </div>
      </label>
      <div className="quick-amounts">
        {[100, 1000, 10000].map((a) => (
          <button
            key={a}
            onClick={() => {
              setAmount("" + a);
              setNotice("");
            }}
          >
            {compact(a)}
          </button>
        ))}
      </div>
      {!valid && (
        <p role="alert" className="error">
          Enter a positive amount up to $1 trillion.
        </p>
      )}
      <dl className="quote-lines">
        {[
          ["Creator tax · " + pct(rate), f.tax],
          ["Base fee · 0.30%", f.base],
          ["Total fees", f.total],
          ["Creator receives", f.creator],
          ["GLIDY receives", f.platform],
        ].map(([k, v], i) => (
          <div key={k} className={i === 2 ? "total" : ""}>
            <dt>{k}</dt>
            <dd>{usd(v)}</dd>
          </div>
        ))}
      </dl>
      <Button
        className="full-width"
        variant="dark"
        disabled={!valid}
        onClick={() =>
          setNotice(
            "Preview only. Live V4Quoter and wallet execution are not connected.",
          )
        }
      >
        preview {side} breakdown <ArrowRight size={14} />
      </Button>
      <p className="quote-note" role="status">
        {notice ||
          "Fee illustration only. Excludes price impact, slippage, gas and opening tax. No tokens are bought or sold."}
      </p>
    </div>
  );
}
function Num({ label, value, onChange, help, guideData, hint, ...p }) {
  const id = useId();
  return (
    <div className="field">
      {help ? (
        <FieldHeading
          label={label}
          field={help}
          data={guideData}
          htmlFor={id}
        />
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <input
        id={id}
        type="number"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) =>
          onChange(e.target.value === "" ? NaN : +e.target.value)
        }
        {...p}
      />
      {hint && <small className="field-caption">{hint}</small>}
    </div>
  );
}
export function Launch() {
  const formHeading = useRef();
  let [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [logo, setLogo] = useState(null),
    [symbol, setSymbol] = useState(""),
    [style, setStyle] = useState("Glide"),
    [path, setPath] = useState({ ...DEFAULT_PATH }),
    [snipe, setSnipe] = useState("Off"),
    [longStart, setLongStart] = useState(99),
    [windowSecs, setWindow] = useState(60),
    [quote, setQuote] = useState("ETH"),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [saved, setSaved] = useSaved("glidepath-launch-draft", null);
  let errors = [
      ...validatePath(path),
      ...(style === "Glide" && path.step === 0
        ? ["A Glide needs a positive step. Choose Flat for no scheduled cuts."]
        : []),
    ],
    update = (k, v) => {
      setPath((p) => ({ ...p, [k]: v }));
      setDone(false);
    },
    config = () => ({
      schemaVersion: 1,
      name: name.trim(),
      symbol,
      quote,
      style,
      buyPath: path,
      sellPath: path,
      snipe: {
        mode: snipe,
        startBps:
          snipe === "Quick"
            ? 9900
            : snipe === "Long"
              ? Math.round(longStart * 100)
              : 0,
        windowSecs: snipe === "Quick" ? 3 : snipe === "Long" ? windowSecs : 0,
      },
      logo: logo
        ? {
            dataUrl: logo.dataUrl,
            fileName: logo.fileName,
            source: "creator-provided",
            verification: "unverified",
          }
        : null,
      status: "frontend-preview-only",
    });
  const guideData = {
    path,
    name,
    symbol,
    quote,
    style,
    snipe,
    longStart,
    windowSecs,
  };
  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1048576
    ) {
      setMessage("Choose a PNG, JPG or WebP image up to 1 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setLogo({ dataUrl: reader.result, fileName: file.name });
        setMessage("Logo added to this local draft.");
        setDone(false);
      };
      img.onerror = () =>
        setMessage("This file could not be read as an image.");
      img.src = reader.result;
    };
    reader.onerror = () =>
      setMessage("Could not read that image. Try another file.");
    reader.readAsDataURL(file);
  }
  function check(detailsOnly = false) {
    if (!name.trim() || !symbol.trim()) return "Enter a token name and ticker.";
    if (!/^[A-Z0-9]{1,10}$/.test(symbol))
      return "Ticker must contain 1–10 letters or numbers.";
    if (!isQuoteAsset(quote)) return "Choose ETH or USDG as the quote asset.";
    if (detailsOnly) return "";
    if (errors.length) return errors[0];
    if (
      snipe === "Long" &&
      (!Number.isFinite(longStart) ||
        longStart < 25 ||
        longStart > 99 ||
        !Number.isInteger(windowSecs) ||
        windowSecs < 30 ||
        windowSecs > 300)
    )
      return "Custom opening protection needs a 25–99% tax and 30–300 whole seconds.";
    return "";
  }
  function advance(i) {
    let e = check(i === 1);
    if (e) {
      setMessage(e);
      return;
    }
    setStep(i);
    setMessage("");
    setDone(false);
    requestAnimationFrame(() => {
      formHeading.current?.focus({ preventScroll: true });
      formHeading.current?.scrollIntoView({ block: "nearest" });
    });
  }
  function download() {
    const error = check();
    if (error) {
      setMessage(error);
      setDone(false);
      return;
    }
    let url = URL.createObjectURL(
        new Blob([JSON.stringify(config(), null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "glidy-launch-draft.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AppShell route="launch">
      <div className="launch-designer">
        <div className="app-heading">
          <div>
            <p className="eyebrow">
              <i /> ROBINHOOD CHAIN <span>Draft preview</span>
            </p>
            <h1>Create your launch.</h1>
            <p>Name your token. Set its tax. Check the details.</p>
          </div>
          <div className="button-row">
            {saved && (
              <Button
                onClick={() => {
                  setName(saved.name || "");
                  setLogo(saved.logo || null);
                  setSymbol(saved.symbol || "");
                  setPath(saved.path || DEFAULT_PATH);
                  setStyle(saved.style || "Glide");
                  setSnipe(saved.snipe || "Off");
                  setLongStart(saved.longStart ?? 99);
                  setWindow(saved.windowSecs ?? 60);
                  setQuote(isQuoteAsset(saved.quote) ? saved.quote : "ETH");
                  setStep(0);
                  setDone(false);
                  setMessage(
                    saved.quote && !isQuoteAsset(saved.quote)
                      ? "Draft restored. Its old quote asset is unavailable, so ETH is selected. Check your trading pair."
                      : "Saved draft restored.",
                  );
                }}
              >
                Restore draft
              </Button>
            )}
            <Button
              onClick={() => {
                const persisted = setSaved({
                  logo,
                  name,
                  symbol,
                  style,
                  path,
                  snipe,
                  longStart,
                  windowSecs,
                  quote,
                });
                setMessage(
                  persisted
                    ? "Draft saved in this browser."
                    : "Browser storage is unavailable or full. Review the draft and download it to keep a copy.",
                );
              }}
            >
              Save draft <Download size={13} />
            </Button>
          </div>
        </div>
        <div className="launch-steps">
          {["Token details", "Tax path", "Review launch"].map((s, i) => (
            <button
              key={s}
              className={step === i ? "active" : ""}
              aria-current={step === i ? "step" : undefined}
              onClick={() =>
                i > step
                  ? advance(i)
                  : (setStep(i), setDone(false), setMessage(""))
              }
            >
              <span>
                {i < step ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <div>
                <strong>{s}</strong>
                <small>
                  {
                    [
                      "Name, artwork & pair",
                      "Rates & opening settings",
                      "Check & export your draft",
                    ][i]
                  }
                </small>
              </div>
            </button>
          ))}
        </div>
        <div className="launch-grid">
          <div
            className="launch-form"
            onChangeCapture={() => {
              setDone(false);
              setMessage("");
            }}
          >
            <div className="designer-section-top">
              <span>STEP {String(step + 1).padStart(2, "0")} / 03</span>
              <span>
                {step === 0
                  ? "The basics"
                  : step === 1
                    ? "Your tax rules"
                    : "Final check"}
              </span>
            </div>
            {step === 0 ? (
              <>
                <h2 ref={formHeading} tabIndex={-1}>
                  Make it your launch.
                </h2>
                <p>
                  Give it a name, add your artwork and choose its trading pair.
                </p>
                <div className="designer-names">
                  <div className="field">
                    <FieldHeading
                      label="Token name"
                      field="name"
                      data={guideData}
                      htmlFor="launch-name"
                    />
                    <input
                      id="launch-name"
                      autoComplete="off"
                      maxLength="50"
                      placeholder="e.g. Orbit"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <FieldHeading
                      label="Ticker"
                      field="symbol"
                      data={guideData}
                      htmlFor="launch-symbol"
                    />
                    <input
                      id="launch-symbol"
                      autoComplete="off"
                      maxLength="10"
                      placeholder="e.g. ORBT"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <div className="field">
                  <FieldHeading
                    label="Token artwork"
                    field="logo"
                    data={guideData}
                    htmlFor="launch-logo"
                  />
                  <div className="logo-upload">
                    {logo ? (
                      <img
                        src={logo.dataUrl}
                        alt={(name || "Your launch") + " uploaded logo"}
                      />
                    ) : (
                      <div className="logo-placeholder">
                        {symbol.slice(0, 2) || "+"}
                      </div>
                    )}
                    <div>
                      <label htmlFor="launch-logo" className="upload-button">
                        <Upload size={14} />
                        {logo ? "Change artwork" : "Choose artwork"}
                      </label>
                      <input
                        id="launch-logo"
                        className="upload-native"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={uploadLogo}
                      />
                      <small>
                        {logo ? logo.fileName : "PNG, JPG or WebP · up to 1 MB"}
                      </small>
                      {logo && (
                        <button
                          type="button"
                          className="ws-text-button"
                          onClick={() => {
                            setLogo(null);
                            setDone(false);
                          }}
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <QuoteAssetPicker
                  value={quote}
                  onChange={setQuote}
                  guideData={guideData}
                />
                <div className="info-note">
                  <Info size={16} />
                  <p>
                    Plain ERC-20 token. Tax lives in the GLIDY pool.
                    Wallet-to-wallet transfers are free.
                  </p>
                </div>
              </>
            ) : step === 1 ? (
              <>
                <h2 ref={formHeading} tabIndex={-1}>
                  Set the rules once.
                </h2>
                <p>
                  Choose how your tax falls. These settings apply to both buys
                  and sells.
                </p>
                <DesignerChoices
                  kind="style"
                  value={style}
                  guideData={guideData}
                  onChange={(value) => {
                    setStyle(value);
                    setPath(
                      value === "Flat"
                        ? { ...path, floor: path.start, step: 0 }
                        : { ...DEFAULT_PATH },
                    );
                  }}
                />
                <div className="form-two">
                  <Num
                    label="Starting tax (%)"
                    hint="Normal buys and sells · max 5%"
                    help="start"
                    guideData={guideData}
                    value={path.start / 100}
                    min={0}
                    max={5}
                    step={0.01}
                    onChange={(v) =>
                      setPath((p) => ({
                        ...p,
                        start: Math.round(v * 100),
                        ...(style === "Flat"
                          ? { floor: Math.round(v * 100) }
                          : {}),
                      }))
                    }
                  />
                  <Num
                    label="Floor (%)"
                    hint={
                      style === "Flat"
                        ? "Matches the starting tax"
                        : "Where scheduled cuts stop"
                    }
                    help="floor"
                    guideData={guideData}
                    value={path.floor / 100}
                    min={0}
                    max={5}
                    step={0.01}
                    disabled={style === "Flat"}
                    onChange={(v) => update("floor", Math.round(v * 100))}
                  />
                </div>
                {style === "Glide" && (
                  <>
                    <div className="form-two">
                      <Num
                        label="Hold (days)"
                        help="hold"
                        guideData={guideData}
                        value={path.hold}
                        min={0}
                        max={30}
                        onChange={(v) => update("hold", v)}
                      />
                      <Num
                        label="Step down (%)"
                        help="step"
                        guideData={guideData}
                        value={path.step / 100}
                        min={0.01}
                        max={5}
                        step={0.01}
                        onChange={(v) => update("step", Math.round(v * 100))}
                      />
                    </div>
                    <Num
                      label="Step interval (days)"
                      help="interval"
                      guideData={guideData}
                      value={path.interval}
                      min={1}
                      max={30}
                      onChange={(v) => update("interval", v)}
                    />
                  </>
                )}
                <div className="designer-divider" />
                <DesignerChoices
                  kind="protection"
                  value={snipe}
                  onChange={setSnipe}
                  guideData={guideData}
                />
                {snipe === "Long" && (
                  <div className="form-two">
                    <Num
                      label="Opening tax (%)"
                      help="opening"
                      guideData={guideData}
                      value={longStart}
                      min={25}
                      max={99}
                      step={0.01}
                      onChange={setLongStart}
                    />
                    <Num
                      label="Window (seconds)"
                      help="window"
                      guideData={guideData}
                      value={windowSecs}
                      min={30}
                      max={300}
                      onChange={setWindow}
                    />
                  </div>
                )}
                <div className="info-note">
                  <Info size={16} />
                  <p>
                    {snipe === "Off"
                      ? "Normal tax applies from the open."
                      : snipe === "Quick"
                        ? "Buy-only opening tax starts at 99%, falling to zero over 3 seconds."
                        : "Buy-only opening tax starts at " +
                          longStart +
                          "%, falling over " +
                          windowSecs +
                          " seconds."}{" "}
                    {snipe !== "Off" &&
                      "Buys pay the higher of opening and normal tax, plus the base fee. 90% of opening tax goes to the creator."}
                  </p>
                </div>
                {errors.length > 0 && (
                  <ul className="error" role="alert">
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <p className="fine-print">
                  Market-cap steps, hidden launches, batches, streams and holder
                  sharing are later rollout stages.
                </p>
              </>
            ) : (
              <>
                <h2 ref={formHeading} tabIndex={-1}>
                  Read the commitment.
                </h2>
                <p>
                  Review this local configuration. Deployment and signing are
                  not connected.
                </p>
                <LaunchIdentity
                  name={name}
                  symbol={symbol}
                  logo={logo}
                  quote={quote}
                  review
                />
                <ReviewCommitment path={path} style={style} snipe={snipe} />
                <dl className="path-definition">
                  {[
                    ["Token", name + " / $" + symbol],
                    [
                      "Quote asset",
                      <span className="review-quote">
                        <QuoteLogo symbol={quote} decorative />
                        {quote}
                      </span>,
                    ],
                    ["Style", style],
                    ["Starting buy / sell tax", pct(path.start)],
                    ["Floor", pct(path.floor)],
                    [
                      "Reaches floor",
                      floorDay(path) === null
                        ? "creator cuts only"
                        : "day " + floorDay(path),
                    ],
                    ["Base fee", "0.3% per trade"],
                    [
                      "Anti-snipe",
                      snipe === "Off"
                        ? "Off"
                        : snipe === "Quick"
                          ? "99% / 3 seconds"
                          : longStart + "% / " + windowSecs + " seconds",
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="info-note">
                  <Lock size={16} />
                  <p>
                    Once deployed, the path cannot be rewritten. Creators may
                    only lower the tax. The path does not protect the token
                    price.
                  </p>
                </div>
                {done && (
                  <div className="success" role="status">
                    <Check size={20} />
                    <p>
                      Configuration validated. Download it for developer review.
                      No token was deployed or fee paid.
                    </p>
                  </div>
                )}
              </>
            )}
            {message && (
              <p role="status" className="form-message">
                {message}
              </p>
            )}
            <div className="form-actions">
              {step > 0 && (
                <Button
                  onClick={() => {
                    setStep(step - 1);
                    setDone(false);
                  }}
                >
                  <ArrowLeft size={14} />
                  Back
                </Button>
              )}
              <Button
                variant="dark"
                disabled={step === 1 && errors.length > 0}
                onClick={() => {
                  if (step < 2) advance(step + 1);
                  else {
                    let e = check();
                    setMessage(e);
                    if (!e) setDone(true);
                  }
                }}
              >
                {step === 2
                  ? "Validate draft"
                  : step === 0
                    ? "Set the tax path"
                    : "Review launch"}
                <ArrowRight size={14} />
              </Button>
            </div>
            {done && (
              <Button onClick={download} className="full-width">
                Download configuration <Download size={14} />
              </Button>
            )}
          </div>
          <div className="launch-preview">
            <LaunchIdentity
              name={name}
              symbol={symbol}
              logo={logo}
              quote={quote}
            />
            <LaunchCoach step={step} />
            <Panel title="Your tax path" action={<Tag>Preview</Tag>}>
              <div className="launch-preview-title">
                <span>
                  {name || "Your next launch"}{" "}
                  <small>{symbol ? "$" + symbol : "TOKEN"}</small>
                </span>
                <Tag tone="violet">{style}</Tag>
              </div>
              {errors.length ? (
                <div className="chart-invalid">
                  Adjust your path to see a valid preview.
                </div>
              ) : (
                <>
                  <PathStats path={path} day={0} />
                  <TaxChart
                    key={JSON.stringify(path)}
                    path={path}
                    day={0}
                    interactive={false}
                  />
                </>
              )}
              <div className="panel-foot">
                First trade starts the clock.
                <Lock size={12} />
              </div>
            </Panel>
            <details className="designer-fee-details">
              <summary>
                <span>
                  Fee example <small>$10,000 buy + $10,000 sell</small>
                </span>
                <ChevronDown size={15} />
              </summary>
              <Panel title="Fee breakdown" action={<span>Illustration</span>}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tax</th>
                        <th>Round-trip tax</th>
                        <th>With base fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.length ? (
                        <tr>
                          <td colSpan="3">Enter a valid path.</td>
                        </tr>
                      ) : (
                        [
                          path.start,
                          Math.round((path.start + path.floor) / 2),
                          path.floor,
                        ]
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .map((v) => (
                            <tr key={v}>
                              <td>{pct(v)}</td>
                              <td>{usd(fees(10000, v).tax * 2)}</td>
                              <td>{usd(fees(10000, v).total * 2)}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="panel-foot">
                  Excludes gas, slippage, price moves and opening tax.
                </div>
              </Panel>
            </details>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
