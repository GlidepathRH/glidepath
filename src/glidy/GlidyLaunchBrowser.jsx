import React, { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Compass, LayoutGrid, List, RotateCw, Search, Star, X } from "lucide-react";
import { Link, useSaved } from "./storage";
import { useGlidyApi } from "./GlidyApi";

function pct(value) {
  const pips = Number(value);
  return Number.isFinite(pips) ? `${(pips / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : "—";
}
function short(value) { return typeof value === "string" && value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value || "—"; }

function LaunchCard({ launch, saved, setSaved }) {
  const id = launch.token_address.toLowerCase();
  const isSaved = saved.includes(id);
  const created = Number(launch.launch_block_timestamp);
  const createdLabel = Number.isFinite(created) && created > 0 ? new Date(created * 1000).toLocaleDateString() : "Indexed launch";
  return <article className="real-market-card" onClick={(event) => { if (!event.target.closest("a,button")) location.hash = `/market/${id}`; }}>
    <div className="real-card-top"><span className="card-serial"><i />{launch.token_symbol}<small>Robinhood Chain</small></span><button type="button" className="save-real" aria-label={`${isSaved ? "Remove" : "Save"} ${launch.token_name}`} aria-pressed={isSaved} onClick={() => setSaved((current) => isSaved ? current.filter((item) => item !== id) : [...current, id])}><Star size={17} fill={isSaved ? "currentColor" : "none"} /></button></div>
    <div className="real-card-stage"><div className="real-card-rotor"><div className="real-card-face real-card-front">
      <Link to={`/market/${id}`} className="real-card-image" aria-label={`Open ${launch.token_name} launch`}><span className="glidy-token-mark">{String(launch.token_symbol || "G").slice(0, 2).toUpperCase()}</span></Link>
      <div className="real-card-body"><Link to={`/market/${id}`}><h2>{launch.token_name}<ArrowUpRight size={15} /></h2></Link><div className="real-card-numbers"><span>Current buy tax<strong>{pct(launch.buy_tax_pips)}</strong></span><span>Current sell tax<strong>{pct(launch.sell_tax_pips)}</strong></span></div>
        <div className="real-card-basics"><span>Buy path<small>{pct(launch.buy_path?.startPips)} start · {pct(launch.buy_path?.floorPips)} floor</small></span><span>Sell path<small>{pct(launch.sell_path?.startPips)} start · {pct(launch.sell_path?.floorPips)} floor</small></span></div>
        <div className="card-mini-chart"><span><small>Created on Robinhood Chain</small>{createdLabel}</span><span className="launch-address" title={id}>{short(id)}</span></div>
      </div>
    </div></div></div>
    <footer><Link to={`/market/${id}`}>Launch details <ArrowUpRight size={13} /></Link><a href={`https://robinhoodchain.blockscout.com/address/${id}`} target="_blank" rel="noreferrer">View onchain <ArrowUpRight size={13} /></a></footer>
  </article>;
}

export function GlidyLaunchBrowser({ watchlist = false }) {
  const { kind, error, launches, indexer, updatedAt, refresh } = useGlidyApi();
  const [saved, setSaved] = useSaved("glidepath-real-watchlist", []);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useSaved("glidepath-browse-view-v5", "grid");
  const savedIds = new Set(saved.map((item) => String(item).toLowerCase()));
  const visible = useMemo(() => launches
    .filter((launch) => !watchlist || savedIds.has(launch.token_address.toLowerCase()))
    .filter((launch) => `${launch.token_name} ${launch.token_symbol} ${launch.token_address}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === "name" ? a.token_name.localeCompare(b.token_name) : Number(b.launch_block_timestamp) - Number(a.launch_block_timestamp)), [launches, watchlist, saved, query, sort]);
  const clear = () => { setQuery(""); setSort("newest"); };

  return <div className="market-browser">
    <header className="browse-heading"><div><div className="browse-eyebrow"><span />ROBINHOOD CHAIN · 4663</div><h1>{watchlist ? "Saved launches" : "Launches"}<span>{kind === "ready" ? visible.length : "—"}</span></h1><p>{watchlist ? "The launches you want to come back to." : "Explore GLIDY factory launches and inspect their live tax paths."}</p></div><Link to="/docs/overview" className="browse-create"><Compass size={16} />How launches work</Link></header>
    <div className="browse-toolbar"><label className="browse-search"><Search size={17} /><input aria-label="Search launches" placeholder="Name, ticker or contract address" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label><div className="browse-toolbar-right"><label className="browse-sort"><select aria-label="Sort launches" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="name">Name</option></select></label><div className="browse-views" aria-label="View style"><button aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={17} /></button><button aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={16} /></button></div><button type="button" className="ws-icon" aria-label="Refresh launches" onClick={refresh}><RotateCw size={15} /></button></div></div>
    <div className="browse-source"><span>{indexer ? `Indexer ${indexer.status} · through block ${indexer.indexedThroughBlock || "—"}` : "GLIDY factory launches"}</span><span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : `${visible.length} ${watchlist ? "saved " : ""}launches`}</span></div>
    {kind === "loading" || kind === "refreshing" ? <p className="glidy-api-state">Loading launches from the GLIDY API…</p> : null}
    {kind === "error" && <div className="glidy-api-state is-error" role="status"><span>{error}</span><button type="button" onClick={refresh}><RotateCw size={14} />Retry</button></div>}
    {kind === "ready" && visible.length > 0 && <div className={view === "grid" ? "real-market-grid" : "real-market-list"}>{visible.map((launch) => <LaunchCard key={launch.token_address.toLowerCase()} launch={launch} saved={saved} setSaved={setSaved} />)}</div>}
    {kind === "ready" && visible.length === 0 && <div className="browse-empty"><Compass size={27} /><h2>{watchlist && !query ? "Nothing saved yet." : query ? "No launches found." : "No launches indexed yet."}</h2><p>{watchlist && !query ? "Save a launch to keep it here." : query ? "Try another name, ticker or contract address." : "Launches registered with the GLIDY factory will appear here."}</p>{query ? <button onClick={clear}>Clear search</button> : watchlist ? <Link to="/explore">Browse launches <ArrowRight size={15} /></Link> : null}</div>}
  </div>;
}
