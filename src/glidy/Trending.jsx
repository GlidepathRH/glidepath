import React, { useMemo, useState, useRef } from "react";
import { Search, ArrowUpRight, ArrowRight, Plus, Star, X } from "lucide-react";
import { Link, useSaved } from "./ui";
import { realMarkets, selectMarkets, changeLabel } from "./marketSnapshot";
import { RealMarketRow, RealTokenImage } from "./MarketBrowser";
import { useMarketFeed, useRankMotion, useHeldOrder } from "./MarketFeed.jsx";
import { TrendingGlyph } from "./LaunchIcons";

export function Trending() {
  const { markets: realMarkets } = useMarketFeed(),
    grid = useRef(null);
  const [sort, setSort] = useState("volume");
  const [tab, setTab] = useState("active"),
    [query, setQuery] = useState(""),
    [saved, setSaved] = useSaved("glidepath-real-watchlist", []),
    [count, setCount] = useState(12);
  const recent = realMarkets.filter((m) => m.kind === "recent"),
    featured = realMarkets.filter((m) => m.kind === "featured");
  const list = useMemo(
    () =>
      selectMarkets(tab === "new" ? recent : realMarkets, {
        query,
        sort: tab === "new" ? "newest" : sort,
        savedOnly: tab === "saved",
        saved,
      }),
    [realMarkets, tab, query, saved, sort],
  );
  const held = useHeldOrder(list, tab + query + sort);
  useRankMotion(
    grid,
    held.items.slice(0, count).map((m) => m.id),
    tab + query + sort,
  );
  return (
    <div className="market-browser trending-page">
      <header className="browse-heading">
        <div>
          <div className="browse-eyebrow">
            <TrendingGlyph size={14} />
            ROBINHOOD CHAIN
          </div>
          <h1>
            Trending<span>{realMarkets.length}</span>
          </h1>
          <p>Established names. Fresh launches. A closer look at both.</p>
        </div>
        <Link to="/launch" className="browse-create">
          <Plus size={16} />
          Create a launch
        </Link>
      </header>
      <div className="trending-picks" aria-label="Featured market snapshots">
        {featured.slice(0, 3).map((m, i) => (
          <Link key={m.id} to={"/market/" + m.id} className="trending-pick">
            <span className="trending-pick-number">0{i + 1}</span>
            <RealTokenImage market={m} />
            <div>
              <strong>{m.name}</strong>
              <span>{m.symbol} · spotlight</span>
            </div>
            <ArrowUpRight size={15} />
          </Link>
        ))}
      </div>
      <div className="trending-controls">
        <div
          className="trending-tabs"
          role="tablist"
          aria-label="Trending categories"
        >
          {[
            ["active", "Most active", realMarkets.length],
            ["new", "New launches", recent.length],
            ["saved", "Saved", saved.length],
          ].map(([value, label, n]) => (
            <button
              key={value}
              id={"trending-tab-" + value}
              role="tab"
              tabIndex={tab === value ? 0 : -1}
              aria-selected={tab === value}
              aria-controls="trending-results"
              onClick={() => {
                setTab(value);
                setCount(12);
              }}
            >
              {label}
              <span>{n}</span>
            </button>
          ))}
        </div>
        <label className="browse-search">
          <Search size={16} />
          <input
            placeholder="Find a token"
            aria-label="Search trending launches"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCount(12);
            }}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={13} />
            </button>
          )}
        </label>
      </div>
      <div className="trending-sort">
        <label>
          Rank by{" "}
          <select
            aria-label="Rank trending markets"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            disabled={tab === "new"}
          >
            <option value="volume">24h volume</option>
            <option value="cap">Market cap</option>
          </select>
        </label>
      </div>
      <div className="browse-source">
        <span>Mock feed · simulated activity</span>
        <span>
          {tab === "new"
            ? "Recent launches from Pons"
            : sort === "cap"
              ? "Sorted by market cap"
              : "Sorted by 24h volume"}{" "}
          · no live ranking
        </span>
      </div>
      <div
        role="tabpanel"
        id="trending-results"
        aria-labelledby={"trending-tab-" + tab}
      >
        {list.length ? (
          <div ref={grid} {...held.handlers} className="real-market-list">
            {held.items.slice(0, count).map((m, i) => (
              <RealMarketRow
                key={m.id}
                market={m}
                rank={i + 1}
                rankScope={tab + query + sort}
                saved={saved}
                setSaved={setSaved}
              />
            ))}
          </div>
        ) : (
          <div className="browse-empty">
            <Star size={26} />
            <h2>
              {tab === "saved"
                ? "Save something worth following."
                : "No launches found."}
            </h2>
            <p>
              {tab === "saved"
                ? "Tap a token’s star to build your list."
                : "Try another ticker or contract address."}
            </p>
          </div>
        )}
      </div>
      {count < list.length && (
        <button
          className="trending-more"
          onClick={() => setCount((v) => v + 12)}
        >
          Show {Math.min(12, list.length - count)} more launches
          <ArrowRight size={14} />
        </button>
      )}
      <footer className="browse-bottom">
        <span>
          Real identities. Simulated updates. New launches have limited source
          history.
        </span>
        <Link to="/explore">
          Back to launches
          <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
