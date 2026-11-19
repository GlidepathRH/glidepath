import React, { useRef, useState } from "react";
import {
  Compass,
  Star,
  Plus,
  FlaskConical,
  BookOpen,
  GripVertical,
  PanelLeftOpen,
  PanelLeftClose,
  ArrowUpRight,
  Activity,
  Layers,
  X,
  RotateCcw,
} from "lucide-react";
import { Link, Logo, useSaved } from "./ui";
import { SoftDockIcon } from "./SoftDockIcon";
import {
  DiscoverGlyph,
  TrendingGlyph,
  SavedGlyph,
  CreateGlyph,
  LabGlyph,
  GuideGlyph,
} from "./LaunchIcons";

const navigation = [
  ["explore", "Launches", DiscoverGlyph],
  ["trending", "Trending", TrendingGlyph],
  ["watchlist", "Saved launches", SavedGlyph],
  ["launch", "Create a launch", CreateGlyph],
  ["lab", "Tax lab", LabGlyph],
  ["docs", "How it works", GuideGlyph],
];
export function clampDock(position, width, height, dockHeight = 410) {
  return {
    x: Math.max(
      10,
      Math.min(
        Number.isFinite(position?.x) ? position.x : 14,
        Math.max(10, width - 76),
      ),
    ),
    y: Math.max(
      10,
      Math.min(
        Number.isFinite(position?.y) ? position.y : 112,
        Math.max(10, height - dockHeight - 10),
      ),
    ),
  };
}
export function WorkspaceNav({
  route,
  collapsed,
  setCollapsed,
  mobile,
  setMobile,
}) {
  const [stored, setStored] = useSaved("glidepath-dock-position-v1", {
      x: 14,
      y: 112,
    }),
    [dragging, setDragging] = useState(false),
    [position, setPosition] = useState(null),
    [tools, setTools] = useState(false);
  const dock = useRef(),
    drag = useRef(),
    pos =
      position ||
      (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)
        ? stored
        : { x: 14, y: 112 });
  const apply = (next, save = false) => {
    const value = clampDock(
      next,
      innerWidth,
      innerHeight,
      dock.current?.offsetHeight,
    );
    setPosition(value);
    if (save) setStored(value);
    return value;
  };
  React.useEffect(() => {
    const resize = () => apply(position || stored);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [stored]);
  const begin = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: pos };
    setDragging(true);
  };
  const move = (e) => {
    if (!drag.current) return;
    apply({
      x: drag.current.start.x + e.clientX - drag.current.x,
      y: drag.current.start.y + e.clientY - drag.current.y,
    });
  };
  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    apply(pos, true);
  };
  const reset = () => {
    setPosition(null);
    setStored({ x: 14, y: 112 });
  };
  return (
    <>
      {collapsed && !mobile && (
        <nav
          ref={dock}
          className={
            "compact-dock " +
            (dragging ? "is-dragging" : "") +
            (pos.x > 600 ? " labels-left" : "")
          }
          aria-label="Main navigation"
          style={{ left: pos.x, top: pos.y }}
        >
          <button
            className="dock-grip"
            aria-label="Move navigation. Drag, or use arrow keys. Home resets position."
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={finish}
            onLostPointerCapture={finish}
            onDoubleClick={reset}
            onKeyDown={(e) => {
              if (e.key === "Home") {
                e.preventDefault();
                reset();
                return;
              }
              const shifts = {
                ArrowLeft: [-16, 0],
                ArrowRight: [16, 0],
                ArrowUp: [0, -16],
                ArrowDown: [0, 16],
              };
              if (shifts[e.key]) {
                e.preventDefault();
                apply(
                  { x: pos.x + shifts[e.key][0], y: pos.y + shifts[e.key][1] },
                  true,
                );
              }
            }}
          >
            <GripVertical size={15} />
            <span className="dock-tooltip">Drag to move · Home to reset</span>
          </button>
          {navigation.map(([to, label, Icon], i) => (
            <Link
              key={to}
              to={"/" + to}
              className={
                "dock-bubble " +
                (route === to ||
                (to === "explore" && ["markets", "market"].includes(route))
                  ? "active"
                  : "")
              }
              aria-label={label}
              aria-current={route === to ? "page" : undefined}
              style={{ "--dock-index": i }}
            >
              <SoftDockIcon kind={to} />
              <span className="dock-shimmer" />
              <span className="dock-tooltip">
                {label}
                <small>
                  {i === 3
                    ? "Build your tax path"
                    : i === 0
                      ? "Find your next launch"
                      : ""}
                </small>
              </span>
            </Link>
          ))}
          <button
            className="dock-expand"
            onClick={() => setCollapsed(false)}
            aria-label="Expand navigation"
          >
            <PanelLeftOpen size={19} />
            <span className="dock-tooltip">Expand navigation</span>
          </button>
        </nav>
      )}
      {(!collapsed || mobile) && (
        <aside className="ws-sidebar calm-sidebar">
          <div className="ws-brand">
            <Logo />
            <button
              className="ws-icon"
              onClick={() => {
                setCollapsed(true);
                setMobile(false);
              }}
              aria-label={mobile ? "Close navigation" : "Minimize navigation"}
            >
              {mobile ? <X size={18} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
          <nav aria-label="Main navigation" className="calm-nav">
            {navigation.map(([to, label, Icon]) => (
              <Link
                key={to}
                to={"/" + to}
                className={"ws-nav-item " + (route === to ? "active" : "")}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="calm-nav-secondary">
            <button
              className="calm-tools-toggle"
              aria-expanded={tools}
              onClick={() => setTools(!tools)}
            >
              More tools{" "}
              <Plus
                size={13}
                style={{ transform: tools ? "rotate(45deg)" : "none" }}
              />
            </button>
            {tools && (
              <div className="calm-tools">
                <Link to="/examples">
                  <Layers size={15} />
                  Demo tax paths
                </Link>
                <Link to="/activity">
                  <Activity size={15} />
                  Schedule activity
                </Link>
                <button onClick={reset}>
                  <RotateCcw size={15} />
                  Reset dock position
                </button>
              </div>
            )}
            <Link to="/">
              <ArrowUpRight size={15} />
              GLIDY website
            </Link>
          </div>
          <div className="calm-sidebar-bottom">
            <span className="calm-preview-dot" />
            Mock preview<span>Robinhood Chain</span>
          </div>
        </aside>
      )}
    </>
  );
}
