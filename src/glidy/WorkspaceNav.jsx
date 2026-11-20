import React, { useRef, useState } from "react";
import { GripVertical, PanelLeftOpen, PanelLeftClose, ArrowUpRight, X, ArrowLeftRight } from "lucide-react";
import { Link, useSaved } from "./storage";
import { SoftDockIcon } from "./SoftDockIcon";
import { DiscoverGlyph, SavedGlyph, GuideGlyph, CreateGlyph } from "./LaunchIcons";

const navigation = [
  ["trade", "Trade", ArrowLeftRight],
  ["explore", "Launches", DiscoverGlyph],
  ["watchlist", "Saved launches", SavedGlyph],
  ["launch", "Create a launch", CreateGlyph],
  ["docs", "How it works", GuideGlyph],
];

export function clampDock(position, width, height, dockHeight = 260) {
  return {
    x: Math.max(10, Math.min(Number.isFinite(position?.x) ? position.x : 14, Math.max(10, width - 76))),
    y: Math.max(10, Math.min(Number.isFinite(position?.y) ? position.y : 112, Math.max(10, height - dockHeight - 10))),
  };
}

function Brand() {
  return <Link to="/explore" className="brand logo eyes-brand" aria-label="GLIDY launches"><span className="brand-eye-crop"><img className="brand-symbol" src="/brand/glidey-soft-eyes-transparent.png" alt="" width="34" height="34" /></span></Link>;
}

export function WorkspaceNav({ route, collapsed, setCollapsed, mobile, setMobile }) {
  const [stored, setStored] = useSaved("glidepath-dock-position-v1", { x: 14, y: 112 });
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(null);
  const dock = useRef(null);
  const drag = useRef(null);
  const pos = position || stored || { x: 14, y: 112 };
  const apply = (next, save = false) => {
    const value = clampDock(next, innerWidth, innerHeight, dock.current?.offsetHeight);
    setPosition(value);
    if (save) setStored(value);
    return value;
  };
  React.useEffect(() => {
    const resize = () => apply(position || stored);
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [stored]);
  const begin = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, start: pos };
    setDragging(true);
  };
  const move = (event) => {
    if (!drag.current) return;
    apply({ x: drag.current.start.x + event.clientX - drag.current.x, y: drag.current.start.y + event.clientY - drag.current.y });
  };
  const finish = () => {
    if (!drag.current) return;
    drag.current = null; setDragging(false); apply(pos, true);
  };
  const reset = () => { setPosition(null); setStored({ x: 14, y: 112 }); };
  return <>
    {collapsed && !mobile && <nav ref={dock} className={`compact-dock ${dragging ? "is-dragging" : ""} ${pos.x > 600 ? "labels-left" : ""}`} aria-label="Main navigation" style={{ left: pos.x, top: pos.y }}>
      <button className="dock-grip" aria-label="Move navigation. Drag, or use arrow keys. Home resets position." onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onDoubleClick={reset} onKeyDown={(event) => { const shifts = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }; if (event.key === "Home") { event.preventDefault(); reset(); } else if (shifts[event.key]) { event.preventDefault(); apply({ x: pos.x + shifts[event.key][0], y: pos.y + shifts[event.key][1] }, true); } }}><GripVertical size={15} /><span className="dock-tooltip">Drag to move · Home to reset</span></button>
      {navigation.map(([to, label], index) => <Link key={to} to={`/${to}`} className={`dock-bubble ${route === to || (to === "explore" && route === "market") ? "active" : ""}`} aria-label={label} aria-current={route === to ? "page" : undefined} style={{ "--dock-index": index }}><SoftDockIcon kind={to === "docs" ? "docs" : to} /><span className="dock-shimmer" /><span className="dock-tooltip">{label}</span></Link>)}
      <button className="dock-expand" onClick={() => setCollapsed(false)} aria-label="Expand navigation"><PanelLeftOpen size={19} /><span className="dock-tooltip">Expand navigation</span></button>
    </nav>}
    {(!collapsed || mobile) && <aside className="ws-sidebar calm-sidebar"><div className="ws-brand"><Brand /><button className="ws-icon" onClick={() => { setCollapsed(true); setMobile(false); }} aria-label={mobile ? "Close navigation" : "Minimize navigation"}>{mobile ? <X size={18} /> : <PanelLeftClose size={17} />}</button></div><nav aria-label="Main navigation" className="calm-nav">{navigation.map(([to, label, Icon]) => <Link key={to} to={`/${to}`} className={`ws-nav-item ${route === to ? "active" : ""}`} aria-current={route === to ? "page" : undefined} onClick={() => setMobile(false)}><Icon size={18} /><span>{label}</span></Link>)}</nav><div className="calm-nav-secondary"><Link to="/"><ArrowUpRight size={15} />GLIDY website</Link></div><div className="calm-sidebar-bottom">Robinhood Chain</div></aside>}
  </>;
}
