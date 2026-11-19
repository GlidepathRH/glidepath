import React from "react";
import { BookOpen, Compass, Star } from "lucide-react";
import { Link } from "./storage";

const items = [
  ["explore", "Launches", Compass],
  ["watchlist", "Saved launches", Star],
  ["docs", "How it works", BookOpen],
];

export function WorkspaceNav({ route, mobile, setMobile }) {
  return (
    <>
      {mobile && <button className="glidy-nav-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
      <aside className={`glidy-nav ${mobile ? "is-open" : ""}`}>
        <Link to="/explore" className="glidy-brand" aria-label="GLIDY launches">
          <img src="/brand/glidey-soft-eyes-transparent.png" alt="" width="38" height="38" />
        </Link>
        <nav aria-label="Main navigation">
          {items.map(([to, label, Icon]) => (
            <Link key={to} to={`/${to}`} className={route === to || (to === "explore" && route === "market") ? "active" : ""} aria-current={route === to ? "page" : undefined} onClick={() => setMobile(false)}>
              <Icon size={17} />{label}
            </Link>
          ))}
        </nav>
        <div className="glidy-nav-foot">Robinhood Chain <span>4663</span></div>
      </aside>
    </>
  );
}
