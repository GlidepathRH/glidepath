import React, { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Copy, LoaderCircle, RotateCw, Star } from "lucide-react";
import { Link, useSaved } from "./storage";
import { apiGet, useGlidyApi } from "./GlidyApi";
import { formatTaxPips as percentFromPips, shortAddress } from "./launch-data.mjs";
import { GlidyPriceChart } from "./GlidyPriceChart";
import { useGlidyToast } from "./GlidyToast";
import { TradePanel } from "./GlidyTrade";

function dateLabel(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0
    ? new Date(value * 1000).toLocaleString()
    : "—";
}

function StatusMessage({ kind, error, retry }) {
  if (kind === "loading" || kind === "refreshing") {
    return <p className="glidy-api-state"><LoaderCircle size={15} className="glidy-spin" /> {kind === "refreshing" ? "Refreshing launches…" : "Loading launches…"}</p>;
  }
  if (kind === "indexing") {
    return <p className="glidy-api-state" role="status"><LoaderCircle size={15} className="glidy-spin" /> Waiting for the launch index to catch up; checking automatically…</p>;
  }
  if (kind === "error") {
    return (
      <div className="glidy-api-state is-error" role="status">
        <span>{error}</span>
        <button type="button" onClick={retry}><RotateCw size={14} /> Retry</button>
      </div>
    );
  }
  return null;
}

function LaunchDetail({ tokenAddress, copied, onCopy }) {
  const [state, setState] = useState({ kind: "loading" });
  const [retryKey, setRetryKey] = useState(0);
  const [indexAttempt, setIndexAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let retryTimer;
    async function load() {
      try {
        const launch = await apiGet(`api/v1/launches/${tokenAddress}`, controller.signal);
        const events = await apiGet(`api/v1/launches/${tokenAddress}/events`, controller.signal);
        if (!controller.signal.aborted) setState({ kind: "ready", launch: launch.data, events: events.data || [] });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 404 && indexAttempt < 24) {
          setState({ kind: "indexing" });
          retryTimer = setTimeout(() => setIndexAttempt((attempt) => attempt + 1), 5000);
          return;
        }
        setState({ kind: "error", error: error.status === 404
          ? "This launch is still not in the index. If it was just created, wait a bit and retry."
          : error.message || "Launch details are unavailable." });
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(retryTimer); };
  }, [tokenAddress, retryKey, indexAttempt]);

  if (state.kind !== "ready") return <StatusMessage kind={state.kind} error={state.error} retry={() => { setState({ kind: "loading" }); setIndexAttempt(0); setRetryKey((value) => value + 1); }} />;

  const launch = state.launch;
  const buy = launch.buy_path || {};
  const sell = launch.sell_path || {};
  const snipe = launch.snipe_config || {};
  const snipeName = ["Off", "Quick", "Long"][Number(snipe.mode)] || "—";
  const explorer = "https://robinhoodchain.blockscout.com";
  return (
    <section className="glidy-launch-detail" aria-labelledby="launch-detail-title">
      <div className="glidy-launch-detail-head">
        <div>
          <div className="glidy-detail-title-row">
            {launch.image_url && <img className="glidy-launch-token-image" src={launch.image_url} alt={`${launch.token_name} token`} />}
            <h2 id="launch-detail-title">{launch.token_name} <span>${launch.token_symbol}</span></h2>
            <button type="button" className="glidy-detail-action glidy-copy-token" onClick={onCopy} aria-label="Copy token address">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy address"}
            </button>
          </div>
          <p>Created {dateLabel(launch.launch_block_timestamp)} · {shortAddress(launch.token_address)}</p>
        </div>
      </div>
      <div className="glidy-tax-now">
        <article><span>Current buy tax</span><strong>{percentFromPips(launch.buy_tax_pips)}</strong></article>
        <ArrowDownRight size={18} aria-hidden="true" />
        <article><span>Current sell tax</span><strong>{percentFromPips(launch.sell_tax_pips)}</strong></article>
      </div>
      <GlidyPriceChart tokenAddress={tokenAddress} />
      <TradePanel initialLaunch={launch} />
      <dl className="glidy-launch-facts">
        <div><dt>Token</dt><dd title={launch.token_address}>{shortAddress(launch.token_address)}</dd></div>
        <div><dt>Creator</dt><dd title={launch.creator_address}>{shortAddress(launch.creator_address)}</dd></div>
        <div><dt>Quote asset</dt><dd title={launch.quote_currency}>{shortAddress(launch.quote_currency)}</dd></div>
        <div><dt>Buy path start / floor</dt><dd>{percentFromPips(buy.startPips)} / {percentFromPips(buy.floorPips)}</dd></div>
        <div><dt>Sell path start / floor</dt><dd>{percentFromPips(sell.startPips)} / {percentFromPips(sell.floorPips)}</dd></div>
        <div><dt>Trading opens</dt><dd>{dateLabel(launch.trading_opens_at)}</dd></div>
        <div><dt>Creator cut ceilings</dt><dd>Buy {percentFromPips(launch.creator_buy_ceiling_pips)} · Sell {percentFromPips(launch.creator_sell_ceiling_pips)}</dd></div>
        <div><dt>Anti-snipe</dt><dd>{snipeName}{snipeName !== "Off" && snipe.durationSeconds ? ` · ${snipe.durationSeconds}s` : ""}{launch.snipe_ended ? " · ended early" : ""}</dd></div>
        <div><dt>Pool ID</dt><dd title={launch.pool_id}>{shortAddress(launch.pool_id)}</dd></div>
      </dl>
      {Array.isArray(launch.payout_recipients) && launch.payout_recipients.some((recipient, index) =>
        Number(launch.payout_weights_bps?.[index] ?? 0) > 0 && !/^0x0{40}$/i.test(recipient)
      ) && (
        <div className="glidy-payouts">
          <h3>Creator proceeds split</h3>
          {launch.payout_recipients.map((recipient, index) => ({ recipient, index, weight: Number(launch.payout_weights_bps?.[index] ?? 0) }))
            .filter(({ recipient, weight }) => weight > 0 && !/^0x0{40}$/i.test(recipient))
            .map(({ recipient, index, weight }) => (
              <div key={`${recipient}-${index}`}><span title={recipient}>{shortAddress(recipient)}</span><strong>{(weight / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</strong></div>
            ))}
        </div>
      )}
      <div className="glidy-event-list">
        <h3>Indexed pool events <span>{state.events.length}</span></h3>
        {state.events.length ? state.events.slice(0, 12).map((event) => (
          <div className="glidy-event-row" key={`${event.transaction_hash}:${event.log_index}`}>
            <strong>{event.event_name}</strong><span>{dateLabel(event.block_timestamp)}</span>
            <a href={`${explorer}/tx/${event.transaction_hash}`} target="_blank" rel="noreferrer" aria-label={`View ${event.event_name} transaction`}><ArrowUpRight size={13} /></a>
          </div>
        )) : <p>No events indexed for this pool.</p>}
      </div>
      <a className="glidy-explorer-link" href={`${explorer}/address/${launch.token_address}`} target="_blank" rel="noreferrer">View token on Robinhood Chain explorer <ArrowUpRight size={14} /></a>
    </section>
  );
}

export function GlidyLaunchDetailPage({ tokenAddress }) {
  const [saved, setSaved] = useSaved("glidepath-real-watchlist", []);
  const [copied, setCopied] = useState(false);
  const toast = useGlidyToast();
  const id = String(tokenAddress || "").toLowerCase();
  const isSaved = saved.map((item) => String(item).toLowerCase()).includes(id);
  async function copyTokenAddress() {
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      toast("Token address copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      toast("Could not copy token address", "error");
    }
  }
  function toggleSaved() {
    setSaved((current) => current.map((item) => String(item).toLowerCase()).includes(id)
      ? current.filter((item) => String(item).toLowerCase() !== id)
      : [...current, id]);
    toast(isSaved ? "Launch removed from saved" : "Launch saved");
  }
  return (
    <>
      <div className="glidy-detail-tools">
        <Link to="/explore">← Back to launches</Link>
        {/^0x[\da-f]{40}$/i.test(id) && <>
          <button type="button" className="glidy-detail-action" onClick={toggleSaved} aria-pressed={isSaved} aria-label={isSaved ? "Remove from saved launches" : "Save launch"}>
            <Star size={14} fill={isSaved ? "currentColor" : "none"} /> {isSaved ? "Saved" : "Save"}
          </button>
        </>}
      </div>
      {/^0x[\da-f]{40}$/i.test(id) ? <LaunchDetail tokenAddress={tokenAddress} copied={copied} onCopy={copyTokenAddress} key={id} /> : <div className="glidy-chain-empty"><span className="glidy-empty-mark">G</span><div><strong>Enter a token address</strong><p>Open a launch from the indexed launches list to view its details.</p></div></div>}
    </>
  );
}

export function GlidyLaunches({ savedOnly = false }) {
  const { kind, error, launches, indexer, updatedAt, refresh } = useGlidyApi();
  const [saved, setSaved] = useSaved("glidepath-real-watchlist", []);
  const [query, setQuery] = useState("");
  const savedIds = new Set(saved.map((id) => String(id).toLowerCase()));
  const visible = launches
    .filter((launch) => !savedOnly || savedIds.has(launch.token_address.toLowerCase()))
    .filter((launch) => !query || `${launch.token_name} ${launch.token_symbol} ${launch.token_address}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="glidy-chain-section" aria-labelledby="glidy-chain-heading">
      <>
          <div className="glidy-chain-heading">
            <div>
              <p className="glidy-api-kicker"><span /> ROBINHOOD CHAIN</p>
              <h1 id="glidy-chain-heading">{savedOnly ? "Saved launches" : "GLIDY launches"}</h1>
              <p>{savedOnly ? "Launches you saved in this browser." : "Launches indexed from the GLIDY factory, with current tax data read from the hook."}</p>
            </div>
            <div className="glidy-chain-meta">
              {indexer && <span>Indexer {indexer.status} · through block {indexer.indexedThroughBlock || "—"}</span>}
              {updatedAt && kind === "ready" && <span>Updated {updatedAt.toLocaleTimeString()}</span>}
              <button type="button" aria-label="Refresh launches" onClick={refresh}><RotateCw size={14} /></button>
            </div>
          </div>
          {kind !== "ready" && <StatusMessage kind={kind} error={error} retry={refresh} />}
          {kind === "ready" && visible.length > 0 && (
            <div className="glidy-launch-tools"><label><span>Search launches</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ticker or address" /></label><span>{visible.length} {visible.length === 1 ? "launch" : "launches"}</span></div>
          )}
          {kind === "ready" && visible.length > 0 && (
            <div className="glidy-chain-grid">
              {visible.map((launch) => {
                const id = launch.token_address.toLowerCase();
                return (
                  <article className="glidy-chain-card" key={id}>
                    <div className="glidy-chain-card-top"><span className="glidy-onchain-pill">INDEXED</span><time>{dateLabel(launch.launch_block_timestamp)}</time></div>
                    <h2>{launch.token_name}</h2>
                    <p className="glidy-chain-symbol">${launch.token_symbol} <span>·</span> {shortAddress(id)}</p>
                    <div className="glidy-card-tax-row">
                      <span>Buy {percentFromPips(launch.buy_path?.startPips)} <ArrowRight size={12} /> {percentFromPips(launch.buy_path?.floorPips)}</span>
                      <span>Sell {percentFromPips(launch.sell_path?.startPips)} <ArrowRight size={12} /> {percentFromPips(launch.sell_path?.floorPips)}</span>
                    </div>
                    <div className="glidy-card-actions"><Link to={`/market/${id}`}>Launch details <ArrowUpRight size={14} /></Link><button type="button" aria-label={`${savedIds.has(id) ? "Remove" : "Save"} ${launch.token_name}`} aria-pressed={savedIds.has(id)} onClick={() => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}><Star size={15} fill={savedIds.has(id) ? "currentColor" : "none"} /></button></div>
                  </article>
                );
              })}
            </div>
          )}
          {kind === "ready" && visible.length === 0 && (
            <div className="glidy-chain-empty"><span className="glidy-empty-mark">G</span><div><strong>{savedOnly ? "No saved launches" : query ? "No matching launches" : "No launches indexed yet"}</strong><p>{savedOnly ? "Save a launch to keep it in this list." : query ? "Try another name, ticker or address." : "When launches are created through the GLIDY factory, their onchain details will appear here."}</p>{savedOnly && <Link to="/explore">Browse launches <ArrowRight size={13} /></Link>}</div></div>
          )}
      </>
    </section>
  );
}
