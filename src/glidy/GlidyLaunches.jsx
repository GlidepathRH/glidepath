import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, LoaderCircle, RotateCw } from "lucide-react";

const API_ROOT = "/api/glidy";

async function apiGet(path, signal) {
  const response = await fetch(`${API_ROOT}/${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function percentFromPips(value) {
  const pips = Number(value);
  if (!Number.isFinite(pips)) return "—";
  return `${(pips / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function shortAddress(address) {
  return typeof address === "string" && address.length > 13
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address || "—";
}

function dateLabel(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0
    ? new Date(value * 1000).toLocaleString()
    : "Date unavailable";
}

function snipeLabel(config, ended) {
  if (ended) return "Ended early";
  const mode = Number(config?.mode);
  const name = ["Off", "Quick", "Long"][mode] ?? "Unknown";
  return name === "Off" || !config?.durationSeconds
    ? name
    : `${name} · ${config.durationSeconds}s`;
}

function StatusMessage({ state, retry }) {
  if (state.kind === "loading") {
    return <p className="glidy-api-state"><LoaderCircle size={15} className="glidy-spin" /> Loading indexed GLIDY launches…</p>;
  }
  if (state.kind === "error") {
    return (
      <div className="glidy-api-state is-error" role="status">
        <span>{state.message}</span>
        <button type="button" onClick={retry}><RotateCw size={14} /> Retry</button>
      </div>
    );
  }
  return null;
}

function LaunchDetail({ tokenAddress, onClose }) {
  const [state, setState] = useState({ kind: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiGet(`api/v1/launches/${tokenAddress}`, controller.signal),
      apiGet(`api/v1/launches/${tokenAddress}/events`, controller.signal),
    ])
      .then(([launch, events]) => setState({
        kind: "ready",
        launch: launch.data,
        events: events.data,
      }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ kind: "error", message: error.message || "Launch details are unavailable." });
        }
      });
    return () => controller.abort();
  }, [tokenAddress, retryKey]);

  if (state.kind === "loading") return <StatusMessage state={state} />;
  if (state.kind === "error") return <StatusMessage state={state} retry={() => { setState({ kind: "loading" }); setRetryKey((value) => value + 1); }} />;

  const launch = state.launch;
  return (
    <div className="glidy-launch-detail">
      <div className="glidy-launch-detail-head">
        <div>
          <p className="glidy-api-kicker">ONCHAIN LAUNCH · ROBINHOOD CHAIN</p>
          <h3>{launch.token_name} <span>${launch.token_symbol}</span></h3>
          <p>Created {dateLabel(launch.launch_block_timestamp)} · {shortAddress(launch.token_address)}</p>
        </div>
        <button type="button" className="glidy-detail-close" onClick={onClose}>Close</button>
      </div>
      <div className="glidy-tax-now">
        <article><span>Current buy tax</span><strong>{percentFromPips(launch.buy_tax_pips)}</strong></article>
        <ArrowDownRight size={18} aria-hidden="true" />
        <article><span>Current sell tax</span><strong>{percentFromPips(launch.sell_tax_pips)}</strong></article>
      </div>
      <dl className="glidy-launch-facts">
        <div><dt>Creator</dt><dd title={launch.creator_address}>{shortAddress(launch.creator_address)}</dd></div>
        <div><dt>Quote asset</dt><dd>{shortAddress(launch.quote_currency)}</dd></div>
        <div><dt>Buy path start / floor</dt><dd>{percentFromPips(launch.buy_path?.startPips)} / {percentFromPips(launch.buy_path?.floorPips)}</dd></div>
        <div><dt>Sell path start / floor</dt><dd>{percentFromPips(launch.sell_path?.startPips)} / {percentFromPips(launch.sell_path?.floorPips)}</dd></div>
        <div><dt>Trading opens</dt><dd>{dateLabel(launch.trading_opens_at)}</dd></div>
        <div><dt>Creator cut ceilings</dt><dd>Buy {percentFromPips(launch.creator_buy_ceiling_pips)} · Sell {percentFromPips(launch.creator_sell_ceiling_pips)}</dd></div>
        <div><dt>Anti-snipe</dt><dd>{snipeLabel(launch.snipe_config, launch.snipe_ended)}</dd></div>
        <div><dt>Pool ID</dt><dd title={launch.pool_id}>{shortAddress(launch.pool_id)}</dd></div>
      </dl>
      {Array.isArray(launch.payout_recipients) && launch.payout_recipients.length > 0 && (
        <div className="glidy-payouts">
          <h4>Creator tax split</h4>
          {launch.payout_recipients.map((recipient, index) => (
            <div key={`${recipient}-${index}`}>
              <span title={recipient}>{shortAddress(recipient)}</span>
              <strong>{(Number(launch.payout_weights_bps?.[index] ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</strong>
            </div>
          ))}
        </div>
      )}
      <div className="glidy-event-list">
        <h4>Recent pool events <span>{state.events.length}</span></h4>
        {state.events.length ? state.events.slice(0, 8).map((event) => (
          <div className="glidy-event-row" key={`${event.transaction_hash}:${event.log_index}`}>
            <strong>{event.event_name}</strong>
            <span>{dateLabel(event.block_timestamp)}</span>
            <a href={`https://robinhoodchain.blockscout.com/tx/${event.transaction_hash}`} target="_blank" rel="noreferrer" aria-label={`View ${event.event_name} transaction`}><ArrowUpRight size={13} /></a>
          </div>
        )) : <p>No indexed events yet.</p>}
      </div>
    </div>
  );
}

export function GlidyLaunches() {
  const [state, setState] = useState({ kind: "loading" });
  const [selected, setSelected] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiGet("api/v1/launches?limit=100", controller.signal),
      apiGet("api/v1/indexer", controller.signal).catch(() => null),
    ])
      .then(([result, indexer]) => setState({ kind: "ready", launches: result.data, indexer }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ kind: "error", message: error.message || "GLIDY launches are temporarily unavailable." });
        }
      });
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <section className="glidy-chain-section" aria-labelledby="glidy-chain-heading">
      <div className="glidy-chain-heading">
        <div>
          <p className="glidy-api-kicker"><span /> GLIDY ONCHAIN</p>
          <h2 id="glidy-chain-heading">GLIDY launches</h2>
          <p>Launches created in GLIDY pools. Tax values are read from the Robinhood Chain hook.</p>
        </div>
        <div className="glidy-chain-meta">
          {state.kind === "ready" && state.indexer && <span>{state.indexer.status} · indexed through {state.indexer.indexedThroughBlock ?? "starting"}</span>}
          <button type="button" aria-label="Refresh GLIDY launches" onClick={reload}><RotateCw size={14} /></button>
        </div>
      </div>

      <StatusMessage state={state} retry={reload} />

      {state.kind === "ready" && (state.launches.length ? (
        <div className="glidy-chain-grid">
          {state.launches.map((launch) => (
            <article className="glidy-chain-card" key={launch.token_address}>
              <div className="glidy-chain-card-top"><span className="glidy-onchain-pill">ONCHAIN</span><span>{dateLabel(launch.launch_block_timestamp)}</span></div>
              <h3>{launch.token_name}</h3>
              <p className="glidy-chain-symbol">${launch.token_symbol} <span>·</span> {shortAddress(launch.token_address)}</p>
              <div className="glidy-card-tax-row">
                <span>Buy {percentFromPips(launch.buy_path?.startPips)} <ArrowRight size={12} /> {percentFromPips(launch.buy_path?.floorPips)}</span>
                <span>Sell {percentFromPips(launch.sell_path?.startPips)} <ArrowRight size={12} /> {percentFromPips(launch.sell_path?.floorPips)}</span>
              </div>
              <button type="button" className="glidy-view-launch" onClick={() => setSelected(launch.token_address)}>
                View tax path and events <ArrowUpRight size={14} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="glidy-chain-empty">
          <span className="glidy-empty-mark">G</span>
          <div><strong>No GLIDY launches indexed yet.</strong><p>When a token is created in a GLIDY pool, its committed tax path will appear here.</p></div>
        </div>
      ))}

      {selected && <LaunchDetail tokenAddress={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
