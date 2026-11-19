import React, { useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "./storage";

const docs = {
  overview: {
    title: "Launch with a tax. Lock how it falls.",
    intro: "GLIDY is a token launchpad on Robinhood Chain. Launch settings are registered with the GLIDY hook, and the indexer makes launch configuration and pool activity easy to inspect.",
    sections: [
      ["A lower-only tax path", "Each launch defines buy and sell tax paths. The hook applies the current path and creator ceiling; the committed schedule can lower the tax over time. Pool trading also pays the configured platform fee."],
      ["Fixed-supply tokens", "The factory creates a plain ERC-20 and initializes its GLIDY pool. Token transfers remain standard ERC-20 transfers; GLIDY pool rules apply to swaps routed through that pool."],
      ["Indexed launch details", "GLIDY indexes factory and hook events, reads the current buy and sell taxes from the hook, and presents the launch parameters and pool events in one place."],
    ],
  },
  fees: {
    title: "Fees and proceeds",
    intro: "The pool hook collects the configured base fee and applicable tax in the pool quote asset. Creator and platform shares accrue as claimable balances.",
    sections: [
      ["Base fee", "Each pool swap has a 0.3% base fee. It is separate from the launch’s tax path."],
      ["Normal tax split", "For a normal tax, the platform share is the smaller of half the tax and 0.1% plus 10% of the tax. The rest of the tax is allocated to the creator. At 3% tax, the platform receives 0.4% and the creator receives 2.6%, in addition to the 0.3% base fee."],
      ["Opening protection", "When an opening protection schedule applies to a buy, its tax replaces the normal buy tax when higher. Opening tax is split 10% to the platform and 90% to creator proceeds. Sells use the normal sell tax."],
      ["Claims and creation fee", "Platform and creator amounts accrue for later withdrawal. The deployed factory creation fee is 0 ETH."],
    ],
  },
  risks: {
    title: "Pool and market risks",
    intro: "A committed tax path describes the GLIDY pool’s fee rules. It does not predict token performance or remove market risk.",
    sections: [
      ["Pool boundary", "The hook enforces tax rules only for its GLIDY pool. The token is a standard ERC-20 and can be traded through other venues with different rules."],
      ["Price and liquidity", "Token prices and available liquidity can change quickly. A lower tax does not guarantee liquidity, demand, or a sale at a particular price."],
      ["Project assessment", "GLIDY displays onchain launch data. It does not provide a project endorsement, holder-concentration report, or automated safety score."],
      ["Read the chain state", "The API indexer can lag the chain by its confirmation and polling interval. Current tax values are read from the hook when the detail endpoint is requested."],
    ],
  },
  api: {
    title: "GLIDY API",
    intro: "The website uses a same-origin server proxy to read the authenticated backend API. The master API key stays in the server environment and is never sent to browser code.",
    sections: [
      ["Launch list", "GET /api/glidy/api/v1/launches?limit=100 returns indexed GLIDY launches. The limit parameter accepts integers from 1 to 100."],
      ["Launch detail", "GET /api/glidy/api/v1/launches/{tokenAddress} returns indexed launch settings plus current buy_tax_pips and sell_tax_pips read from the hook. One million pips equals 100%."],
      ["Pool events", "GET /api/glidy/api/v1/launches/{tokenAddress}/events returns up to 200 indexed launch and pool events, newest first."],
      ["Indexer and readiness", "GET /api/glidy/api/v1/indexer reports indexer status and indexed block progress. GET /api/glidy/ready checks the backend database and Robinhood Chain RPC."],
      ["Responses and limits", "Launch data is returned in a { data: ... } envelope. Token amounts and block numbers are decimal strings; preserve them as strings or BigInt. Authenticated requests are limited by client IP. On HTTP 429, retry after the number of seconds in the Retry-After header."],
    ],
  },
  privacy: {
    title: "Privacy and browser data",
    intro: "Saved launch addresses and interface preferences are stored in this browser. They are not written to the GLIDY API.",
    sections: [
      ["Saved launches", "The saved-launch list uses local browser storage and is available to other people who use the same browser profile."],
      ["API key handling", "The backend key is held by the server-side website proxy. It is not a browser setting and should never be added to a VITE_* environment variable."],
      ["Clear saved launches", "Use the control below to remove the saved launch list from this browser."],
    ],
  },
};

const navigation = [["overview", "Overview"], ["fees", "Fees and proceeds"], ["risks", "Risks"], ["api", "API"], ["privacy", "Privacy"]];

export default function Docs({ page = "overview" }) {
  const current = docs[page] ? page : "overview";
  const doc = docs[current];
  const [notice, setNotice] = useState("");
  return (
    <div className="glidy-docs">
      <aside className="glidy-docs-nav">
        <p className="glidy-api-kicker">GLIDY · DOCUMENTATION</p>
        <nav aria-label="Documentation">
          {navigation.map(([key, label]) => <Link key={key} to={`/docs/${key}`} className={current === key ? "active" : ""}>{label}<ChevronRight size={14} /></Link>)}
        </nav>
      </aside>
      <article className="glidy-docs-article">
        <p className="glidy-api-kicker">ROBINHOOD CHAIN · 4663</p>
        <h1>{doc.title}</h1>
        <p className="glidy-docs-intro">{doc.intro}</p>
        {doc.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
        {current === "privacy" && <div className="glidy-docs-control"><button type="button" onClick={() => { try { localStorage.removeItem("glidepath-real-watchlist"); window.dispatchEvent(new Event("glidepath-storage")); setNotice("Saved launches cleared from this browser."); } catch { setNotice("Browser storage is unavailable."); } }}>Clear saved launches</button><span role="status">{notice}</span></div>}
        {current === "api" && <a className="glidy-docs-external" href="https://glidepath-api-mym0.onrender.com/health/" target="_blank" rel="noreferrer">Backend health <ArrowUpRight size={14} /></a>}
      </article>
    </div>
  );
}
