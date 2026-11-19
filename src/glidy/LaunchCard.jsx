import React, { useId, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  RotateCcw,
  Star,
  Users,
} from "lucide-react";
import { Link } from "./ui";
import { TokenLogo } from "./TokenLogo";
import {
  effectiveRate,
  fees,
  floorDay,
  nextStep,
  pct,
  compact,
  usd,
} from "./tax.mjs";

export function LaunchArtwork({ market }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="launch-artwork" style={{ "--launch-tint": market.color }}>
      {failed ? (
        <div className="launch-art-fallback">
          <TokenLogo market={market} />
          <span>{market.name}</span>
        </div>
      ) : (
        <img
          src={market.image || "/tokens/" + market.id + ".svg"}
          alt={market.name + " illustrative launch artwork"}
          loading="lazy"
          decoding="async"
          width="640"
          height="400"
          onError={() => setFailed(true)}
        />
      )}
      <span className="launch-art-tag">{market.quote} pair</span>
      <span className="launch-art-age">DAY {market.day}</span>
    </div>
  );
}
export function nextEffectiveCut(m) {
  const current = effectiveRate(m.path, m.day, 10000, m.milestoneCap);
  let next = nextStep(m.path, m.day);
  while (next) {
    const rate = Math.min(next.rate, m.milestoneCap ?? 10000);
    if (rate < current) return { ...next, rate };
    next = nextStep(m.path, next.day);
  }
  return null;
}
export function CardTaxDetails({ market: m }) {
  const rate = effectiveRate(m.path, m.day, 10000, m.milestoneCap),
    next = nextEffectiveCut(m),
    floor = floorDay(m.path),
    quote = fees(100, rate),
    end = Math.max(30, (floor || 30) + 5),
    x = (d) => 12 + (Math.min(d, end) / end) * 276,
    y = (r) => 12 + (1 - r / Math.max(100, m.path.start)) * 55;
  const points = [`M${x(0)},${y(m.path.start)}`];
  if (m.path.step)
    for (let day = m.path.hold; day <= end; day += m.path.interval) {
      const rate = Math.max(
        m.path.floor,
        m.path.start -
          (1 + Math.floor((day - m.path.hold) / m.path.interval)) * m.path.step,
      );
      points.push(`H${x(day)}V${y(rate)}`);
      if (rate === m.path.floor) break;
    }
  points.push("H288");
  return (
    <div className="card-tax-details">
      <div className="card-tax-head">
        <span>THE COMMITTED PATH</span>
        <Lock size={13} />
      </div>
      <div className="card-tax-current">
        <strong>{pct(rate)}</strong>
        <span>
          current buy & sell tax<small>+ 0.30% base fee per trade</small>
        </span>
      </div>
      <svg
        className="card-tax-chart"
        viewBox="0 0 300 82"
        role="img"
        aria-label={
          m.name +
          " tax schedule, " +
          pct(m.path.start) +
          " starting rate and " +
          pct(m.path.floor) +
          " scheduled floor"
        }
      >
        <path
          d="M12 24H288M12 48H288M12 72H288"
          stroke="#e9e3f1"
          strokeDasharray="3 4"
        />
        <path
          d={points.join(" ")}
          stroke="#9c7bc7"
          strokeWidth="2.6"
          fill="none"
          strokeLinejoin="round"
        />
        <circle
          cx={x(m.day)}
          cy={y(rate)}
          r="4"
          fill="#c9ce57"
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>
      <dl className="card-tax-metrics">
        <div>
          <dt>Starts at</dt>
          <dd>{pct(m.path.start)}</dd>
        </div>
        <div>
          <dt>Scheduled floor</dt>
          <dd>{pct(m.path.floor)}</dd>
        </div>
        <div>
          <dt>Next cut</dt>
          <dd>
            {next
              ? pct(Math.min(next.rate, m.milestoneCap ?? 10000)) +
                " in " +
                (next.day - m.day) +
                "d"
              : "No scheduled cut"}
          </dd>
        </div>
        <div>
          <dt>Reaches floor</dt>
          <dd>{floor === null ? "Creator cuts only" : "Day " + floor}</dd>
        </div>
      </dl>
      <div className="card-fee-example">
        <span>
          On a $100 trade<strong>{usd(quote.total)} total fee</strong>
        </span>
        <p>
          {usd(quote.tax)} token tax + {usd(quote.base)} base fee
        </p>
        <small>Excludes gas, slippage and opening tax.</small>
      </div>
      <p className="card-tax-rule">
        <ArrowDownRight size={13} />
        {m.path.step
          ? `${m.path.step / 100} percentage-point cuts every ${m.path.interval}d after a ${m.path.hold}d hold.`
          : "Flat path. Only a voluntary creator cut can lower the rate."}
      </p>
      {m.milestoneCap && (
        <p className="card-milestone-note">
          Includes the sample reached {pct(m.milestoneCap)} milestone cap.
        </p>
      )}
    </div>
  );
}
export function LaunchCard({
  market: m,
  saved,
  setSaved,
  compared = false,
  onCompare,
}) {
  const [flipped, setFlipped] = useState(false),
    flip = useRef(),
    id = useId(),
    rate = effectiveRate(m.path, m.day, 10000, m.milestoneCap),
    isSaved = saved.includes(m.id);
  return (
    <article
      className={"launch-card " + (flipped ? "is-flipped" : "")}
      aria-label={m.name + " launch"}
      onKeyDown={(e) => {
        if (e.key === "Escape" && flipped) {
          e.stopPropagation();
          setFlipped(false);
          flip.current?.focus();
        }
      }}
    >
      <div className="launch-card-top">
        <div>
          <TokenLogo market={m} />
          <Link to={"/market/" + m.id}>
            <h3>{m.name}</h3>
            <span>${m.symbol}</span>
          </Link>
        </div>
        <button
          className={"ws-icon launch-save " + (isSaved ? "is-saved" : "")}
          aria-label={
            (isSaved ? "Remove " : "Save ") +
            m.name +
            (isSaved ? " from watchlist" : " to watchlist")
          }
          aria-pressed={isSaved}
          onClick={() =>
            setSaved(
              isSaved ? saved.filter((v) => v !== m.id) : [...saved, m.id],
            )
          }
        >
          <Star size={15} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="launch-card-stage" id={id}>
        <div className="launch-card-rotor">
          <div
            className="launch-card-face launch-card-front"
            aria-hidden={flipped}
            inert={flipped}
          >
            <LaunchArtwork market={m} />
            <div className="launch-card-front-body">
              <div className="launch-main-stat">
                <div>
                  <span>
                    MARKET CAP <small>(FDV)</small>
                  </span>
                  <strong title={usd(m.fdv)}>{compact(m.fdv)}</strong>
                </div>
                <span className="launch-basic-tax">
                  <i />
                  {pct(rate)} tax<small>buy / sell</small>
                </span>
              </div>
              <div className="launch-secondary-stats">
                <span>
                  24h volume<b>{compact(m.volume)}</b>
                </span>
                <span>
                  <Users size={11} />
                  Holders<b>{m.holders.toLocaleString()}</b>
                </span>
              </div>
              <div className="launch-progress-label">
                <span>Liquidity target</span>
                <b>
                  {m.progress === 100 ? (
                    <>
                      <Lock size={10} />
                      Reached
                    </>
                  ) : (
                    m.progress + "%"
                  )}
                </b>
              </div>
              <div
                className="launch-progress"
                role="progressbar"
                aria-label={m.name + " liquidity target progress"}
                aria-valuenow={m.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: m.progress + "%" }} />
              </div>
              <div className="launch-card-meta">
                <span>{m.style}</span>
                <span>Illustrative launch</span>
              </div>
            </div>
          </div>
          <div
            className="launch-card-face launch-card-back"
            aria-hidden={!flipped}
            inert={!flipped}
          >
            <CardTaxDetails market={m} />
          </div>
        </div>
      </div>
      <div className="launch-card-actions">
        <button
          ref={flip}
          type="button"
          className="card-flip-button"
          aria-expanded={flipped}
          aria-controls={id}
          aria-label={
            (flipped ? "Show launch overview for " : "Show tax details for ") +
            m.name
          }
          onClick={() => setFlipped((v) => !v)}
        >
          <RotateCcw size={13} />
          {flipped ? "Back to launch" : "Tax details"}
        </button>
        <Link
          to={"/market/" + m.id}
          className="card-open-market"
          aria-label={"Open " + m.name + " market"}
        >
          Open market
          <ArrowUpRight size={13} />
        </Link>
      </div>
      {onCompare && (
        <label className="launch-card-compare">
          <input
            type="checkbox"
            checked={compared}
            onChange={onCompare}
            aria-label={"Compare " + m.name}
          />
          Compare path
        </label>
      )}
    </article>
  );
}
