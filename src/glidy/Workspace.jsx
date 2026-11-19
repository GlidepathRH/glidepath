import React, { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { Link, useSaved } from "./storage";
import { WorkspaceNav } from "./WorkspaceNav";

const routeTitles = { explore: "Launches", watchlist: "Saved launches", market: "Launch details", docs: "How it works" };

export function Workspace({ route, children }) {
  const [collapsed, setCollapsed] = useSaved("glidepath-sidebar-v4", true);
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(false), [route]);
  return <div className={`workspace ${collapsed ? "is-collapsed" : ""} ${mobile ? "mobile-open" : ""}`}>
    <a className="skip" href="#main" onClick={(event) => { event.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
    {mobile && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <WorkspaceNav route={route} collapsed={collapsed} setCollapsed={setCollapsed} mobile={mobile} setMobile={setMobile} />
    <div className="ws-main">
      <header className="ws-topbar"><div className="ws-breadcrumb"><button className="ws-icon mobile-toggle" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20} /></button><strong>{routeTitles[route] || "GLIDY"}</strong></div><div className="ws-top-actions"><Link to="/explore" className="ws-search-trigger"><Search size={14} /><span>Explore launches</span></Link><span className="ws-network"><i />Robinhood Chain · 4663</span></div></header>
      <main id="main" tabIndex={-1} className="ws-content">{children}</main>
      <footer className="ws-footer"><span>Launch with a tax. Lock how it falls.</span><Link to="/docs/api">API documentation</Link><span>Launch data indexed from Robinhood Chain.</span></footer>
    </div>
  </div>;
}
