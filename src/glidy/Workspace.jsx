import React, { useState } from "react";
import { Menu } from "lucide-react";
import { Link } from "./storage";
import { WorkspaceNav } from "./WorkspaceNav";

const routeTitles = { explore: "Launches", watchlist: "Saved launches", market: "Launch details", docs: "How it works" };

export function Workspace({ route, children }) {
  const [mobile, setMobile] = useState(false);
  return (
    <div className="glidy-shell">
      <WorkspaceNav route={route} mobile={mobile} setMobile={setMobile} />
      <div className="glidy-shell-main">
        <header className="glidy-topbar">
          <button type="button" className="glidy-mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20} /></button>
          <span>{routeTitles[route] || "GLIDY"}</span>
          <span className="glidy-network"><i /> Robinhood Chain · 4663</span>
        </header>
        <main id="main" tabIndex={-1} className="glidy-content">{children}</main>
        <footer className="glidy-footer">
          <span>Launch with a tax. Lock how it falls.</span>
          <Link to="/docs/api">API documentation</Link>
        </footer>
      </div>
    </div>
  );
}
