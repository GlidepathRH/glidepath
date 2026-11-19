import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Pause, Play, Radio, RotateCcw, Zap } from "lucide-react";
import { realMarkets } from "./marketSnapshot";
import {
  createMarketStore,
  createMockMarketSource,
} from "./market-feed-store.mjs";
import { useWorkspace } from "./Workspace";
import { compact } from "./tax.mjs";
const Context = createContext(null);
export function MarketFeedProvider({
  children,
  sourceFactory = createMockMarketSource,
}) {
  const store = useRef(null);
  if (!store.current) store.current = createMarketStore(realMarkets);
  const source = useRef(null),
    [running, setRunning] = useState(true);
  useEffect(() => {
    source.current = sourceFactory({ store: store.current });
    return () => {
      source.current?.stop();
      source.current = null;
    };
  }, [sourceFactory]);
  useEffect(() => {
    if (running) source.current?.start();
    else source.current?.stop();
  }, [running, sourceFactory]);
  const state = useSyncExternalStore(
    store.current.subscribe,
    store.current.getSnapshot,
    store.current.getSnapshot,
  );
  return (
    <Context.Provider
      value={{
        ...state,
        running,
        toggle: () => setRunning((v) => !v),
        replay: () => source.current?.replay?.(),
        reset: () => store.current.reset(),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useMarketFeed() {
  const value = useContext(Context);
  return (
    value || {
      markets: realMarkets,
      revision: 0,
      status: "paused",
      mode: "mock",
      running: false,
      toggle: () => {},
      replay: () => {},
      reset: () => {},
    }
  );
}
export function FeedControl() {
  const feed = useMarketFeed(),
    [open, setOpen] = useState(false),
    root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (
        e.type === "keydown"
          ? e.key === "Escape"
          : !root.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="feed-control" ref={root}>
      <button
        className={"feed-status " + (feed.running ? "running" : "")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Radio size={13} />
        <span>Mock feed</span>
        <i />
      </button>
      {open && (
        <div className="feed-popover">
          <strong>Live motion. Simulated values.</strong>
          <p>
            Real token identities, with generated price moves and trades.
            Updates stay in sync across every view.
          </p>
          <div>
            <button onClick={feed.toggle}>
              {feed.running ? <Pause size={13} /> : <Play size={13} />}{" "}
              {feed.running ? "Pause updates" : "Resume updates"}
            </button>
            <button onClick={feed.reset}>
              <RotateCcw size={13} />
              Reset values
            </button>
          </div>
          <button className="feed-replay" onClick={feed.replay}>
            <Zap size={13} />
            Preview a rank change & graduation
          </button>
        </div>
      )}
    </div>
  );
}
export function MarketValue({
  children,
  direction = 0,
  revision = 0,
  className = "",
}) {
  const ref = useRef(),
    workspace = useWorkspace();
  useEffect(() => {
    if (!revision || !workspace?.motion || document.hidden || !ref.current)
      return;
    const color = direction < 0 ? "#f6e4e9" : "#e5f2e9";
    const animation = ref.current.animate(
      [
        { backgroundColor: color, transform: "translateY(2px)" },
        { backgroundColor: "transparent", transform: "translateY(0)" },
      ],
      { duration: 850, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    return () => animation.cancel();
  }, [revision, direction, workspace?.motion]);
  return (
    <span ref={ref} className={"market-value " + className}>
      {children}
    </span>
  );
}
export function MarketMoments() {
  const { moment } = useMarketFeed(),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!moment) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5200);
    return () => clearTimeout(timer);
  }, [moment?.id]);
  return visible && moment ? (
    <div className="market-moment" role="status" key={moment.id}>
      <span className="moment-symbol">
        <Zap size={15} />
      </span>
      <span>
        <b>
          {moment.symbol}{" "}
          {moment.type === "graduation"
            ? "graduated"
            : "crossed " + compact(moment.amount) + " market cap"}
        </b>
        <small>
          {moment.simulated
            ? "Simulated event · preview only"
            : "Confirmed source event"}
          {moment.type === "market-cap" ? " · not a tax milestone" : ""}
        </small>
      </span>
      <button
        aria-label="Dismiss market update"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  ) : null;
}
export function RankMarker({ rank, scope }) {
  const previous = useRef({ rank, scope }),
    [delta, setDelta] = useState(0);
  useEffect(() => {
    const last = previous.current;
    previous.current = { rank, scope };
    if (last.scope !== scope) {
      setDelta(0);
      return;
    }
    if (last.rank === rank) return;
    setDelta(last.rank - rank);
    const timer = setTimeout(() => setDelta(0), 4500);
    return () => clearTimeout(timer);
  }, [rank, scope]);
  return (
    <span
      className={
        "rank-marker " + (delta > 0 ? "rank-up" : delta < 0 ? "rank-down" : "")
      }
      title={
        delta
          ? "Moved " +
            Math.abs(delta) +
            (delta > 0 ? " up" : " down") +
            " in this demo ranking"
          : "Position in the selected ranking"
      }
    >
      <b>{String(rank).padStart(2, "0")}</b>
      {delta !== 0 && (
        <small>
          {delta > 0 ? "↑" : "↓"}
          {Math.abs(delta)}
        </small>
      )}
    </span>
  );
}
export function useHeldOrder(items, scope) {
  const [hold, setHold] = useState(null),
    pointer = useRef(false),
    focus = useRef(false);
  const ordered =
    hold?.scope === scope
      ? [
          ...hold.ids
            .map((id) => items.find((m) => m.id === id))
            .filter(Boolean),
          ...items.filter((m) => !hold.ids.includes(m.id)),
        ]
      : items;
  const lock = () =>
      setHold((old) =>
        old?.scope === scope ? old : { scope, ids: items.map((m) => m.id) },
      ),
    unlock = () => {
      if (!pointer.current && !focus.current) setHold(null);
    };
  return {
    items: ordered,
    handlers: {
      onPointerEnter: (e) => {
        if (e.pointerType === "touch") return;
        pointer.current = true;
        lock();
      },
      onPointerLeave: () => {
        pointer.current = false;
        unlock();
      },
      onFocusCapture: () => {
        focus.current = true;
        lock();
      },
      onBlurCapture: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          focus.current = false;
          unlock();
        }
      },
    },
  };
}
export function useRankMotion(ref, ids, scope = "") {
  const old = useRef(new Map()),
    lastScope = useRef(scope),
    workspace = useWorkspace(),
    key = ids.join("|");
  useLayoutEffect(() => {
    if (!ref.current) return;
    if (lastScope.current !== scope) {
      old.current = new Map();
      lastScope.current = scope;
    }
    const next = new Map();
    for (const el of ref.current.querySelectorAll("[data-market-id]")) {
      const id = el.dataset.marketId,
        rect = el.getBoundingClientRect(),
        last = old.current.get(id);
      const x = rect.x + window.scrollX,
        y = rect.y + window.scrollY;
      next.set(id, { x, y });
      if (last && workspace?.motion && !document.hidden) {
        const dx = last.x - x,
          dy = last.y - y;
        if (dx || dy) {
          el.getAnimations().forEach((a) => a.cancel());
          el.animate(
            [
              { transform: `translate(${dx}px,${dy}px)` },
              { transform: "translate(0,0)" },
            ],
            { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
        }
      }
    }
    old.current = next;
  }, [key, workspace?.motion, scope]);
}
