import React, { useId, useState, useRef } from "react";
import {
  ShieldQuestion,
  ArrowUpRight,
  Users,
  Layers,
  Info,
  CircleHelp,
} from "lucide-react";
import { Modal } from "./Workspace";
import { creatorFee } from "./marketSnapshot";

export const riskShare = (bps) =>
  Number.isFinite(bps) ? (bps / 100).toFixed(1) + "%" : "—";
export function riskLevel(risk) {
  if (!risk) return "Unknown";
  return risk.top10Bps >= 5000 || risk.bundledBps >= 2000
    ? "Elevated"
    : risk.top10Bps >= 2500 || risk.bundledBps >= 1000
      ? "Review"
      : "Lower concentration";
}
export function RiskStatus({ market }) {
  const r = market.risk,
    level = riskLevel(r);
  return (
    <span className={"risk-status " + (level === "Elevated" ? "elevated" : "")}>
      <ShieldQuestion size={12} />
      {r ? (
        <>
          <span>
            {level === "Lower concentration"
              ? "More distributed"
              : level + " concentration"}
          </span>
          <b>{r.simulated ? "DEMO" : "HOLDERS"}</b>
        </>
      ) : (
        <span>Not checked</span>
      )}
    </span>
  );
}

// No scan provider is connected. Missing checks must never become a pass.
export const contractChecks = [
  [
    "Sell restrictions",
    "Can holders sell? Includes honeypot and transfer restrictions.",
  ],
  ["Liquidity lock", "Is liquidity locked, and when can it be withdrawn?"],
  ["Mint permissions", "Can an owner create more tokens?"],
  ["Freeze / blacklist", "Can an owner block a wallet from trading?"],
  ["Tax controls", "Can someone change the buy or sell tax?"],
];

export function RugCheckReport({ market, onClose }) {
  const [tab, setTab] = useState("contract"),
    id = useId(),
    r = market.risk,
    level = riskLevel(r);
  const tabs = [
    ["contract", "Contract"],
    ["holders", "Top 10 holders"],
    ["bundles", "Bundles"],
  ];
  return (
    <Modal
      title="Rug checks"
      subtitle={
        market.symbol + " · " + (r?.simulated ? "demo report" : "scan coverage")
      }
      onClose={onClose}
      className="risk-modal"
    >
      <div className="risk-modal-body">
        <div className="risk-demo-note">
          <Info size={16} />
          <p>
            {r?.simulated ? (
              <>
                Demo report. Holder and bundle numbers are made up to show the
                interface. They do not describe {market.name}.
              </>
            ) : (
              <>
                Contract scanning is not connected. These checks cannot
                establish whether {market.name} is safe.
              </>
            )}
          </p>
        </div>
        <div className="rug-report-summary">
          <RiskStatus market={market} />
          <span>
            Contract scan <b>Not connected</b>
          </span>
        </div>
        <div className="risk-overview">
          <div>
            <Users size={18} />
            <span>Top 10 holders</span>
            <strong>{riskShare(r?.top10Bps)}</strong>
            <small>
              {r
                ? "share of supply · " + (r.simulated ? "demo" : "holder data")
                : "No holder data"}
            </small>
          </div>
          <div>
            <Layers size={18} />
            <span>Possible bundles</span>
            <strong>{riskShare(r?.bundledBps)}</strong>
            <small>
              {r
                ? r.groups.length +
                  (r.simulated ? " example clusters" : " flagged clusters")
                : "No bundle data"}
            </small>
          </div>
        </div>
        <div
          className="risk-tabs"
          role="tablist"
          aria-label="Rug check breakdown"
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            const n = tabs.findIndex((t) => t[0] === tab),
              next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? 2
                    : (n + (e.key === "ArrowRight" ? 1 : 2)) % 3;
            setTab(tabs[next][0]);
            e.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
          }}
        >
          {tabs.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              id={id + key}
              aria-controls={id + "panel"}
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          id={id + "panel"}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={id + tab}
        >
          {tab === "contract" ? (
            <div className="contract-checks">
              <div className="reported-tax">
                <span>
                  Creator tax{" "}
                  <small>
                    Captured from Pons. Pool fees, gas and slippage are extra.
                  </small>
                </span>
                <strong>{creatorFee(market)}</strong>
              </div>
              {contractChecks.map(([label, help]) => (
                <div className="contract-check" key={label}>
                  <CircleHelp size={15} />
                  <span>
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </span>
                  <b>Not checked</b>
                </div>
              ))}
              <p className="risk-method">
                No contract scan or buy/sell simulation has run. A low holder
                concentration alone is not a safety verdict.
              </p>
            </div>
          ) : !r ? (
            <p className="risk-empty">
              {tab === "holders" ? "Holder" : "Bundle"} data has not been
              connected.
            </p>
          ) : (
            <>
              <div className="risk-explanation">
                <strong>
                  {tab === "holders"
                    ? level === "Elevated"
                      ? "A few wallets hold a lot."
                      : level === "Review"
                        ? "Supply is concentrated in some wallets."
                        : "Supply is more spread out."
                    : "Wallets that may be linked."}
                </strong>
                <p>
                  {tab === "holders"
                    ? "This measures how much supply the ten largest included wallets hold. It does not show whether they will sell."
                    : "Shared funding or closely timed buys can suggest a bundle. They do not prove the wallets have the same owner."}
                  {r.simulated && " All values below are examples."}
                </p>
              </div>
              {tab === "holders" ? (
                <div className="holder-rows">
                  {r.holders.map((h, i) => (
                    <div key={h.id}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <span>
                        {h.label}
                        <small>
                          {r.simulated
                            ? "Illustrative wallet"
                            : "Included wallet"}
                        </small>
                      </span>
                      <div className="holder-meter">
                        <i
                          style={{
                            width:
                              (h.shareBps /
                                (Math.max(
                                  ...r.holders.map((h) => h.shareBps),
                                ) || 1)) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                      <strong>{riskShare(h.shareBps)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bundle-rows">
                  {r.groups.map((g, i) => (
                    <article key={g.id}>
                      <div>
                        <Layers size={17} />
                        <strong>
                          {r.simulated ? "Example cluster " : "Cluster "}
                          {i + 1}
                        </strong>
                        <b>{riskShare(g.shareBps)}</b>
                      </div>
                      <p>
                        {g.walletCount} wallets · {g.signal}
                      </p>
                      <span>
                        Possible connection, not confirmed common ownership.
                      </span>
                    </article>
                  ))}
                </div>
              )}
              <p className="risk-method">
                {r.simulated
                  ? "Example methodology excludes"
                  : "Check provider exclusions for"}{" "}
                pool, locker and burn addresses. Holder and bundle shares may
                overlap; do not add them. Real reports need a source, block and
                scan time.
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function RiskChecks({ market }) {
  const [open, setOpen] = useState(false),
    trigger = useRef(),
    r = market.risk;
  return (
    <>
      <div className="risk-mini">
        <div className="risk-mini-heading">
          <span>
            <ShieldQuestion size={14} />
            Rug checks
          </span>
          <b>{r?.simulated ? "DEMO" : r ? "HOLDERS" : "NOT CHECKED"}</b>
        </div>
        <div className="risk-mini-grid">
          <div>
            <span>Top 10 holders</span>
            <strong>{riskShare(r?.top10Bps)}</strong>
          </div>
          <div>
            <span>Possible bundles</span>
            <strong>{riskShare(r?.bundledBps)}</strong>
          </div>
        </div>
        <div className="risk-contract-status">
          <span>Contract scan</span>
          <b>Not connected</b>
        </div>
        <button
          className="risk-inspect"
          ref={trigger}
          aria-label={"Open rug check report for " + market.name}
          onClick={() => setOpen(true)}
        >
          <span>
            {r
              ? riskLevel(r) + (r.simulated ? " · demo" : " · holders")
              : "No scan results"}
          </span>
          Full report
          <ArrowUpRight size={12} />
        </button>
      </div>
      {open && (
        <RugCheckReport
          market={market}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() =>
              trigger.current?.focus({ preventScroll: true }),
            );
          }}
        />
      )}
    </>
  );
}
