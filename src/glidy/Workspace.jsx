import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Command,
  Compass,
  FlaskConical,
  Home,
  Layers,
  Menu,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Wallet,
  X,
  Check,
  Lock,
  Terminal,
  Zap,
} from "lucide-react";
import { Link, Logo, useSaved } from "./ui";
import { markets } from "./data";
import { PathAssistant } from "./PathBot";
import { FeedControl, useMarketFeed, MarketMoments } from "./MarketFeed.jsx";
import { WorkspaceNav } from "./WorkspaceNav";
import { TokenLogo } from "./TokenLogo";
import { pct, effectiveRate, nextStep } from "./tax.mjs";

const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);
export function Modal({ title, subtitle, onClose, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"ws-modal " + className}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ws-modal-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="ws-icon" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const links = [
  {
    group: "Workspace",
    items: [
      ["explore", "Launches", Home],
      ["trending", "Trending", Activity],
      ["markets", "All markets", Compass],
      ["watchlist", "Watchlist", Star],
      ["activity", "Path activity", Activity],
    ],
  },
  {
    group: "Create & simulate",
    items: [
      ["launch", "Launch designer", Plus],
      ["lab", "Tax lab", FlaskConical],
    ],
  },
];
const commands = [
  {
    title: "Launch designer",
    description: "Build a committed tax schedule",
    to: "/launch",
    icon: Plus,
  },
  {
    title: "Tax lab",
    description: "Scrub time, adjust caps and compare fees",
    to: "/lab",
    icon: FlaskConical,
  },
  {
    title: "All markets",
    description: "Filter and compare sample launches",
    to: "/markets",
    icon: Compass,
  },
  {
    title: "Watchlist",
    description: "Your browser-local saved markets",
    to: "/watchlist",
    icon: Star,
  },
  {
    title: "Path activity",
    description: "Explore derived schedule events",
    to: "/activity",
    icon: Activity,
  },
  {
    title: "Documentation",
    description: "Mechanics, fees and honest limits",
    to: "/docs",
    icon: BookOpen,
  },
];
export function CommandPalette({ onClose }) {
  const { markets: feedMarkets } = useMarketFeed();
  const [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const entries = [
    ...commands,
    ...feedMarkets.map((m) => ({
      title: m.name + " / " + m.symbol,
      description: m.symbol + " / " + m.quote + " · Robinhood market",
      to: "/market/" + m.id,
      icon: Layers,
    })),
  ].filter((v) =>
    (v.title + " " + v.description).toLowerCase().includes(query.toLowerCase()),
  );
  const go = (v) => {
    location.hash = v.to;
    onClose();
  };
  return (
    <Modal
      title="Command center"
      subtitle="Jump to a market, tool or page."
      onClose={onClose}
      className="command-modal"
    >
      <div className="command-input">
        <Search size={20} />
        <input
          autoFocus
          placeholder="Search markets and tools…"
          aria-label="Search commands"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, entries.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && entries[index]) go(entries[index]);
          }}
        />
        <kbd>ESC</kbd>
      </div>
      <div className="command-results">
        {entries.length ? (
          entries.map((v, i) => (
            <button
              key={v.to}
              className={i === index ? "selected" : ""}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(v)}
            >
              <v.icon size={17} />
              <span>
                <b>{v.title}</b>
                <small>{v.description}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))
        ) : (
          <div className="ws-empty">
            <Search />
            <p>No matching tools or markets.</p>
          </div>
        )}
      </div>
      <div className="command-foot">
        <span>↑ ↓ navigate</span>
        <span>↵ open</span>
        <span>Local search · no AI service</span>
      </div>
    </Modal>
  );
}
export function Workspace({ route, children }) {
  const [collapsed, setCollapsed] = useSaved("glidepath-sidebar-v4", true),
    [motion, setMotion] = useSaved("glidepath-motion", true),
    [mobile, setMobile] = useState(false),
    [palette, setPalette] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [groups, setGroups] = useState({}),
    [reduced, setReduced] = useState(false),
    [saved] = useSaved("glidepath-watchlist", []),
    [draft] = useSaved("glidepath-launch-draft", null);
  const timer = useRef();
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    setMobile(false);
  }, [route]);
  const notify = (message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 4000);
  };
  const current =
    [
      ...links.flatMap((g) => g.items),
      ["market", "Market detail"],
      ["lab", "Tax lab"],
    ].find((l) => l[0] === route)?.[1] || "Workspace";
  const events = markets
    .filter((m) => nextStep(m.path, m.day))
    .map((m) => ({ market: m, ...nextStep(m.path, m.day) }))
    .sort((a, b) => a.day - a.market.day - (b.day - b.market.day));
  return (
    <WorkspaceContext.Provider
      value={{
        motion: motion && !reduced,
        notify,
        openCommand: () => setPalette(true),
        openStatus: () => setModal("status"),
      }}
    >
      <div
        className={
          "workspace " +
          (collapsed ? "is-collapsed " : "") +
          (mobile ? "mobile-open" : "")
        }
        data-motion={motion && !reduced ? "on" : "off"}
      >
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
        {mobile && (
          <button
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <WorkspaceNav
          route={route}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobile={mobile}
          setMobile={setMobile}
        />
        <div className="ws-main">
          <header className="ws-topbar">
            <div className="ws-breadcrumb">
              <button
                className="ws-icon mobile-toggle"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              {collapsed ? <Logo /> : <strong>{current}</strong>}
              <span className="workspace-preview-label">Preview</span>
            </div>
            <div className="ws-top-actions">
              <button
                className="ws-search-trigger"
                onClick={() => setPalette(true)}
              >
                <Search size={14} />
                <span>Search</span>
                <kbd>⌘ K</kbd>
              </button>
              <FeedControl />
              <span className="ws-network">
                <i />
                Robinhood Chain
              </span>
              <button
                className="ws-icon"
                title={motion ? "Pause animations" : "Play animations"}
                aria-label={motion ? "Pause animations" : "Play animations"}
                aria-pressed={!motion}
                onClick={() => setMotion(!motion)}
              >
                {motion ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="ws-content">
            {children}
          </main>
          <footer className="ws-footer">
            <span>
              <i className="preview-led" /> MOCK PREVIEW{" "}
              <b>No live transactions</b>
            </span>
            <Link to="/docs/fees">
              Fee schedule <ArrowUpRight size={11} />
            </Link>
            <span>Simulated updates · no wallet connected.</span>
          </footer>
        </div>
        <button
          className="ws-command-orb"
          aria-label="Open command center"
          onClick={() => setPalette(true)}
        >
          <Command size={20} />
          <span>Command center</span>
          <kbd>⌘ K</kbd>
        </button>
        {toast && (
          <div className="ws-toast" role="status">
            <Check size={16} />
            {toast}
          </div>
        )}
        <MarketMoments />
        <PathAssistant route={route} />
        {palette && <CommandPalette onClose={() => setPalette(false)} />}
        {modal && (
          <Modal
            title={
              {
                wallet: "Your wallet, when the pool is ready.",
                status: "A clear view of what is connected.",
                draft: "Your saved launch draft",
                activity: "Upcoming path steps",
              }[modal]
            }
            subtitle={
              modal === "activity"
                ? "Derived from the sample schedules. These are not live alerts."
                : undefined
            }
            onClose={() => setModal(null)}
            className={modal === "activity" ? "activity-modal" : ""}
          >
            {modal === "wallet" ? (
              <div className="modal-pad">
                <div className="wallet-orbit">
                  <Wallet size={34} />
                  <i />
                  <i />
                  <i />
                </div>
                <p>
                  This workspace is a product preview. Wallet signing, the
                  factory and the trade router are awaiting production
                  integration.
                </p>
                <div className="status-list">
                  <span>
                    <Check />
                    Explore every sample path
                  </span>
                  <span>
                    <Check />
                    Simulate fees and creator cuts
                  </span>
                  <span>
                    <Lock />
                    Connect and sign: unavailable
                  </span>
                </div>
                <Link
                  to="/launch"
                  className="ws-primary"
                  onClick={() => setModal(null)}
                >
                  Design a launch <ArrowRight size={15} />
                </Link>
              </div>
            ) : modal === "status" ? (
              <div className="modal-pad">
                <div className="status-grid">
                  {[
                    ["Frontend", "Interactive"],
                    ["Market data", "Sample"],
                    ["Tax arithmetic", "Local calculation"],
                    ["Wallet & contracts", "Not connected"],
                    ["Indexer / API", "Not connected"],
                    ["Audit status", "Not verified"],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <span>{a}</span>
                      <b>{b}</b>
                    </div>
                  ))}
                </div>
                <p>
                  Use this workspace to explore the specified mechanics. The tax
                  path does not protect token prices or vet projects.
                </p>
                <Link
                  to="/docs/status"
                  className="ws-secondary"
                  onClick={() => setModal(null)}
                >
                  Read integration notes <ArrowUpRight size={14} />
                </Link>
              </div>
            ) : modal === "draft" ? (
              <div className="modal-pad">
                {draft ? (
                  <>
                    <div className="draft-preview">
                      <Layers size={30} />
                      <h3>{draft.name || "Untitled draft"}</h3>
                      <span>
                        ${draft.symbol || "TOKEN"} · {draft.style}
                      </span>
                    </div>
                    <p>
                      Your draft is stored in this browser. Open the designer
                      and select Restore draft to continue.
                    </p>
                    <Link
                      to="/launch"
                      className="ws-primary"
                      onClick={() => setModal(null)}
                    >
                      Continue designing <ArrowRight size={14} />
                    </Link>
                  </>
                ) : (
                  <div className="ws-empty">
                    <Layers />
                    <h3>No draft saved yet</h3>
                    <p>
                      Save a configuration in the launch designer to keep it
                      here.
                    </p>
                    <Link
                      to="/launch"
                      className="ws-primary"
                      onClick={() => setModal(null)}
                    >
                      Create a launch <Plus size={15} />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="notification-list">
                {events.map((e) => (
                  <Link
                    key={e.market.id}
                    to={"/market/" + e.market.id}
                    onClick={() => setModal(null)}
                  >
                    <TokenLogo market={e.market} />
                    <span>
                      <b>{e.market.name}</b>
                      <small>Next scheduled step · day {e.day}</small>
                    </span>
                    <strong>
                      {pct(e.rate)}
                      <small>in {e.day - e.market.day}d</small>
                    </strong>
                  </Link>
                ))}
              </div>
            )}
          </Modal>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
