import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link, Button, Tag, Arrow, Footer, CostStudy } from "./ui";
const pages = {
  overview: [
    "The path is the product.",
    "GLIDY is a proposed token launchpad on Robinhood Chain. A creator can fund a build with a trade tax while committing how that tax falls before the first trade.",
    [
      [
        "A lower-only rule",
        "Each trade pays the lowest of the time schedule, creator ceiling and reached market-cap cap. None can increase the effective tax. The rule belongs to the Uniswap v4 pool hook; the token remains a plain ERC-20.",
      ],
      [
        "The first trade starts the clock",
        "For a 3% start, two-day hold, 0.2 percentage point step and seven-day interval, the first cut lands at day 2. The path reaches 1% on day 65. A Flat path has no automatic reduction.",
      ],
      [
        "Creation limits",
        "Starting tax is at most 5% per side. Buy and sell starting rates differ by at most 2 percentage points. A glide holds at most 30 days, steps every 1–30 days and reaches its floor within 365 days.",
      ],
      [
        "Recipients and optional features",
        "Creator proceeds can be paid in ETH or USDG to up to three launch-defined wallets. Later planned stages add a public 30–365 day build-fund stream and optional holder sharing weighted by holding time.",
      ],
    ],
  ],
  fees: [
    "Every fee, visible.",
    "Each trade has the applicable pool tax plus a 0.3% base fee. Lower taxes also reduce GLIDY’s absolute tax share.",
    [
      [
        "Normal tax split",
        "GLIDY’s share in basis points is zero at zero tax; otherwise min(tax / 2, 10 + tax / 10), using integer arithmetic. At 3% tax, GLIDY receives 0.4% and the creator 2.6%. At 1%, the split is 0.2% and 0.8%. The 0.3% base fee is additional.",
      ],
      [
        "Opening tax",
        "Opening tax is split 90% to the creator and 10% to GLIDY. Buys pay the higher of opening and normal tax, never both added. Sells have no opening tax. Quick falls from 99% to zero over 3 seconds. Long starts at 25–99% over 30–300 seconds.",
      ],
      [
        "Creation fee",
        "A small flat creation fee in ETH is set at deployment. Its final amount has not been provided and is not quoted here.",
      ],
    ],
  ],
  risks: [
    "Know what the path can’t do.",
    "Lower-only describes the pool tax. It does not make a project good or protect its token price.",
    [
      [
        "Market and creator risk",
        "Buyers carry market risk. GLIDY does not vet projects. A committed tax path cannot stop the creator selling tokens they hold. No audit or production contract deployment has been verified in this frontend build.",
      ],
      [
        "The pool boundary",
        "Tax applies only inside the GLIDY pool. Anyone can create a separate pool for the plain ERC-20 token. Wallet-to-wallet transfers are free; a 0.3% base fee remains on pool trades even at zero creator tax.",
      ],
      [
        "Opening tax can be expensive",
        "At the start of a 99% Long window, about 1% of a buy remains before the base fee. The live buy box must display the rate. There are no exempt wallets in the window except a disclosed creator first buy of at most 5% of supply in the creation transaction.",
      ],
      [
        "Market-cap steps",
        "Planned steps use the pool’s time-weighted price and require a full observation window, so quiet markets can latch late. A price held for the window can trigger an early cut, which only lowers the tax. Thresholds use quote-asset units; USD values displayed for ETH thresholds drift with ETH.",
      ],
      [
        "Sample markets",
        "All markets here are illustrative. No wallet execution, live liquidity, production quote provider or live market API is connected.",
      ],
    ],
  ],
  api: [
    "A readable tax path.",
    "The specification defines these integration contracts for markets, wallets, scanners and routers. They are not live endpoints in this frontend.",
    [
      [
        "Markets and paths",
        "GET /v1/markets returns current buy/sell tax, next step, floor and style. GET /v1/markets/:id/path returns the full path, milestones, creator cuts and chart points.",
      ],
      [
        "Tax and quotes",
        "GET /v1/markets/:id/tax returns buyBps, sellBps, nextStepAt, floorAt and style with a 30-second cache. GET /v1/markets/:id/quote?side=&amount= requires all-in results from a verified V4Quoter.",
      ],
      [
        "Preview and events",
        "POST /v1/preview validates a path and returns its schedule and fee table without a chain call. GET /v1/markets/:id/events returns steps, cuts, milestones and payouts.",
      ],
      [
        "Onchain views",
        "taxNow, taxAt, nextStep, timeToFloor, pathOf, snipeNow and allInCost are specified. taxAt is an upper bound that excludes unreached milestones. timeToFloor returns zero for Flat paths.",
      ],
    ],
  ],
  status: [
    "Explore the product.",
    "This is an interactive frontend built from the supplied GLIDY briefs.",
    [
      [
        "Available in this preview",
        "Market search and comparison, command search, tax-path charts, a tax lab, schedule activity, browser-local watchlists, fee arithmetic, creator-cut simulation, a guided launch designer and downloadable configuration.",
      ],
      [
        "Production integration remains",
        "Contracts, factory, locker, payout splitter, indexer, V4Quoter, public API and wallet signing need implementation and verification before live use. The preview does not send blockchain transactions.",
      ],
      [
        "Planned rollout",
        "Market-cap steps, hidden launch, opening batch and build-fund streams follow the core pad. Holder sharing and agent tools follow. $GLIDE and builder rebates are conditional on real launch volume.",
      ],
    ],
  ],
  privacy: [
    "This preview stays in your browser.",
    "The frontend has no signup, analytics or server-side form collection. It stores watchlist IDs, launch drafts, uploaded draft logos and display preferences locally.",
    [
      [
        "Browser storage",
        "Watchlists, drafts (including uploaded logos), sidebar and motion preferences use localStorage on this origin. Others using the same browser profile can see them. Avoid sensitive information in draft fields.",
      ],
      [
        "Removing local data",
        "The button below clears the watchlist and launch draft stored by this preview. It does not affect a wallet or onchain records.",
      ],
      [
        "Production policy",
        "Authentication, live APIs and wallet providers are not connected. This page describes this preview only.",
      ],
    ],
  ],
};
export default function Docs({ page = "overview" }) {
  let d = pages[page] || pages.overview,
    [notice, setNotice] = useState("");
  return (
    <>
      <main id="main" tabIndex={-1} className="container docs-layout">
        <aside className="docs-nav">
          <p className="eyebrow">GLIDY / DOCS</p>
          {Object.entries({
            overview: "Overview",
            fees: "Fees & proceeds",
            risks: "Honest limits",
            api: "Tax-path API",
            status: "Integration status",
            privacy: "Preview privacy",
          }).map(([k, n]) => (
            <Link
              key={k}
              className={page === k ? "active" : ""}
              to={"/docs/" + k}
            >
              {n}
              <ChevronRight size={13} />
            </Link>
          ))}
          <Link to="/explore" className="back-to-app">
            Launchpad <Arrow />
          </Link>
        </aside>
        <article className="docs-article">
          <Tag>product documentation</Tag>
          <h1>{d[0]}</h1>
          <p className="docs-intro">{d[1]}</p>
          {d[2].map(([h, p]) => (
            <section key={h}>
              <h2>{h}</h2>
              <p>{p}</p>
            </section>
          ))}
          {page === "fees" && <CostStudy />}
          {page === "overview" && (
            <div className="button-row">
              <Button to="/launch" variant="dark">
                try the path designer <Arrow />
              </Button>
              <Button to="/docs/risks">
                read the limits <Arrow />
              </Button>
            </div>
          )}
          {page === "privacy" && (
            <>
              <Button
                onClick={() => {
                  try {
                    localStorage.removeItem("glidepath-watchlist");
                    localStorage.removeItem("glidepath-launch-draft");
                    setNotice("Watchlist and draft cleared from this browser.");
                  } catch {
                    setNotice("Browser storage is unavailable.");
                  }
                }}
              >
                clear local preview data
              </Button>
              <p role="status">{notice}</p>
            </>
          )}
          <div className="doc-meta">
            Based on supplied product briefs dated 13 November 2026.
            Implementation status is stated separately.
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
