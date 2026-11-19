import React, { useState } from "react";
import {
  Plus,
  TrendingDown,
  Layers,
  Globe,
  FileCode2,
  Lock,
  Shield,
  ChevronRight,
} from "lucide-react";
import { DEFAULT_PATH } from "./tax.mjs";
import { markets } from "./data";
import {
  Arrow,
  Link,
  Button,
  Tag,
  Panel,
  Heading,
  Footer,
  PathDemo,
  TaxChart,
  CodePanel,
  MarketCard,
  CostStudy,
  Roadmap,
  FAQ,
} from "./ui";
function StyleTabs() {
  let [tab, setTab] = useState(1),
    s = [
      [
        "Flat",
        "A starting tax. A creator decision.",
        "Keep the rate until the creator voluntarily lowers it. No automatic cuts. It is labelled Flat on every screen.",
        { start: 300, floor: 300, step: 0, hold: 0, interval: 7 },
      ],
      [
        "Glide",
        "The way down is already written.",
        "Hold 3% for two days. Drop 0.2 percentage points when the hold ends, then every seven days. Reach 1% on day 65.",
        DEFAULT_PATH,
      ],
      [
        "Milestone",
        "Growth can lower the ceiling.",
        "Planned: cap the tax at 2% after a $1M FDV holds the configured window, then 1% at $5M. Reached caps stay latched.",
        { start: 300, floor: 100, step: 100, hold: 20, interval: 30 },
      ],
    ];
  return (
    <div className="style-layout">
      <div className="style-options" role="tablist" aria-label="Launch styles">
        {s.map((v, i) => (
          <button
            key={v[0]}
            role="tab"
            id={"style-" + i}
            aria-selected={tab === i}
            aria-controls="style-panel"
            onClick={() => setTab(i)}
            className={tab === i ? "active" : ""}
          >
            <span className="eyebrow">
              0{i + 1} / {v[0].toUpperCase()}
            </span>
            <h3>{v[1]}</h3>
            {tab === i && <p>{v[2]}</p>}
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="style-panel"
        aria-labelledby={"style-" + tab}
        className="style-visual"
      >
        <Panel title={s[tab][0].toLowerCase() + ".path"}>
          <div className="style-visual-heading">
            <h3>{s[tab][0]}</h3>
            <Tag tone="yellow">
              {tab === 2
                ? "planned · sample timing"
                : tab === 0
                  ? "creator cuts only"
                  : "scheduled step-down"}
            </Tag>
          </div>
          <TaxChart key={tab} path={s[tab][3]} day={0} interactive={false} />
          <div className="panel-foot">
            {tab === 2
              ? "Market-cap triggers have no promised date."
              : "Path fixed before the first trade."}
          </div>
        </Panel>
      </div>
    </div>
  );
}
export default function Home() {
  return (
    <>
      <main id="main" tabIndex={-1}>
        <section className="hero-grid">
          <div className="container">
            <div className="hero">
              <h1>
                Launch with a tax.
                <br />
                Lock how it falls.
              </h1>
              <p className="hero-description">
                Fund the build from the first trade. Set a tax that steps down.
                <br className="desktop-only" /> Commit the path before launch.
                Nobody can raise it.
              </p>
              <div className="button-row">
                <Button to="/explore" variant="dark" className="button-satin">
                  explore markets <Arrow />
                </Button>
                <Button to="/launch">
                  design a launch <Plus size={14} />
                </Button>
              </div>
              <p className="hero-note">
                <span className="tiny-square" /> Built on Robinhood Chain ·
                interactive preview
              </p>
            </div>
            <PathDemo />
          </div>
        </section>
        <div className="container architecture-strip">
          <span>THE GLIDY STACK</span>
          <div>
            <Layers size={18} /> Uniswap v4
          </div>
          <div>
            <Globe size={18} /> Robinhood Chain
          </div>
          <div>
            <FileCode2 size={18} /> Plain ERC-20
          </div>
          <div>
            <TrendingDown size={18} /> Lower-only hook
          </div>
        </div>
        <section className="container section">
          <Heading
            label="01 / the mechanism"
            title="Your tax path, defined before trade one."
            description="A time schedule, reached market-cap steps and a creator ceiling. Every trade pays the lowest of the three."
          />
          <div className="mechanism-grid">
            <CodePanel />
            <div className="mechanism-list">
              {[
                [
                  "01",
                  "Time does the work.",
                  "Set the start, hold, step, interval and floor. When the hold ends, the first cut lands. No keeper or transaction is needed.",
                ],
                [
                  "02",
                  "Growth can cut it faster.",
                  "Planned market-cap steps latch lower caps when the pool’s time-weighted price holds a threshold. Reached steps never reset.",
                ],
                [
                  "03",
                  "Creators can always undercut.",
                  "Lower the ceiling from the first block, even before the liquidity target. A creator cut can never lift the tax back up.",
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span>{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
              <Link to="/how-it-works" className="inline-link">
                understand the mechanism <Arrow />
              </Link>
            </div>
          </div>
        </section>
        <section className="soft-section">
          <div className="container section">
            <Heading
              label="02 / launch styles"
              title="A launch can have a plan."
              description="Three ways to fund a build. The path stays visible on every market."
            />
            <StyleTabs />
          </div>
        </section>
        <section className="container section">
          <Heading
            label="03 / explore"
            title="Read the path. Then make your call."
            description="Current tax, the next cut and the floor, before you open a market."
          />
          <div className="three-grid">
            {markets.slice(0, 3).map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
          <div className="section-end">
            <span className="muted small-copy">
              Illustrative markets for exploring the product.
            </span>
            <Button to="/explore">
              view all markets <Arrow />
            </Button>
          </div>
        </section>
        <section className="container section case-section">
          <div>
            <p className="eyebrow">[ 04 / THE $10,000 TRADE ]</p>
            <h2>
              Give bigger trades
              <br />a smaller tax bill.
            </h2>
            <p>
              A $10,000 buy and a $10,000 sell cost $600 in tax at 3%. At 1%,
              that falls to $200. The 0.3% base fee adds $60 across the two
              trades.
            </p>
            <Link to="/case-study" className="inline-link">
              work through the numbers <Arrow />
            </Link>
          </div>
          <CostStudy />
        </section>
        <section className="soft-section">
          <div className="container section">
            <Heading
              label="05 / launch rules"
              title="Funding with the limits in plain sight."
              description="The creator gets a build budget. Buyers can read exactly how the tax changes."
            />
            <div className="three-grid feature-grid">
              {[
                [
                  TrendingDown,
                  "5% maximum at launch",
                  "At most 5% on each side. Buy and sell rates can differ by at most 2 percentage points at creation.",
                ],
                [
                  Lock,
                  "Liquidity locked for good",
                  "A fixed supply and a Uniswap v4 pool from block one. At the target, liquidity is permanently locked.",
                ],
                [
                  Shield,
                  "Creator-chosen anti-snipe",
                  "Off, Quick or Long. Opening tax applies to buys only. A creator can end the window early, never extend it.",
                ],
              ].map(([Icon, t, d]) => (
                <article className="feature-card" key={t}>
                  <Icon size={28} strokeWidth={1.2} />
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
            <p className="fine-print">
              Lower-only describes the tax, not the token price. Projects are
              not vetted. Market risk remains.
            </p>
          </div>
        </section>
        <section className="container section">
          <Heading
            label="06 / open by design"
            title="A public path, on every surface."
            description="A plain ERC-20 token. A pool hook that carries the rules. A readable path for people and, in the planned SDK, agents."
          />
          <div className="surface-grid">
            <div className="light-terminal">
              <div className="terminal-title">
                &gt;_ tax-path / preview response <Tag>sample</Tag>
              </div>
              <pre>{`{\n  "style": "glide",\n  "buyBps": 240,\n  "sellBps": 240,\n  "floorBps": 100,\n  "nextStepDay": 23,\n  "floorDay": 65\n}`}</pre>
            </div>
            <div className="surface-rows">
              {[
                ["01", "The launchpad", "Explore the tax on each market card."],
                ["02", "The pool", "The lower-only rule lives in the v4 hook."],
                [
                  "03",
                  "The public API",
                  "Planned feeds for scanners and routers.",
                ],
                [
                  "04",
                  "SDK + MCP",
                  "Planned tools for agent-driven workflows.",
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                  <Arrow />
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="soft-section">
          <div className="container section">
            <Heading
              label="07 / the rollout"
              title="Build the core. Then widen the path."
              description="Core launchpad first. Additional capabilities follow in five planned stages."
            />
            <Roadmap />
          </div>
        </section>
        <section className="container section">
          <Heading title="Frequently asked questions" />
          <FAQ />
        </section>
        <section className="cta container">
          <p className="eyebrow">[ YOUR NEXT LAUNCH ]</p>
          <h2>
            Set the tax.
            <br />
            Show the way down.
          </h2>
          <div className="button-row">
            <Button to="/launch" variant="dark">
              design your path <Arrow />
            </Button>
            <Button to="/docs">
              read the docs <Arrow />
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
export function InfoPage({ type }) {
  return (
    <>
      <main className="container section" id="main" tabIndex={-1}>
        {type === "roadmap" ? (
          <>
            <Heading
              label="THE ROLLOUT"
              level={1}
              title="One commitment. Five stages."
              description="The core path comes first. Later features depend on verified work and real launch volume."
            />
            <Roadmap />
            <div className="roadmap-extra">
              <h2>Planned means planned.</h2>
              <p>
                No production dates, market volume or deployed contracts are
                claimed here. Contract and service integration remain separate
                work.
              </p>
              <Button to="/docs">
                read documentation <Arrow />
              </Button>
            </div>
          </>
        ) : type === "case-study" ? (
          <>
            <Heading
              label="WORKED EXAMPLE / NOT A CUSTOMER RESULT"
              level={1}
              title="What a $10,000 trade actually pays."
              description="Equal buy and sell sizes make the tax difference visible. This illustration excludes price changes, price impact, slippage and gas."
            />
            <div className="two-grid">
              <CostStudy />
              <div className="editorial">
                <h2>
                  The tax gets smaller.
                  <br />
                  The base fee stays.
                </h2>
                <p>
                  At 3%, a $10,000 buy and a $10,000 sell pay $600 in tax. At
                  1%, they pay $200. The additional 0.3% base fee totals $60 for
                  the same two trades.
                </p>
                <p>
                  A glide commits the steps in advance. Reached market-cap steps
                  can reduce the ceiling sooner. A Flat path has no scheduled
                  cut.
                </p>
                <Link className="inline-link" to="/launch">
                  try your own schedule <Arrow />
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <Heading
              label={type === "about" ? "ABOUT GLIDY" : "HOW IT WORKS"}
              level={1}
              title={
                type === "about"
                  ? "A build budget. A written way down."
                  : "Three ceilings. The lowest rate wins."
              }
              description={
                type === "about"
                  ? "A creator wants funding from early trades. A buyer wants to know what that tax can become. GLIDY puts the path in the pool before either one trades."
                  : "The effective tax is the minimum of the time path, reached market-cap steps and the creator’s lower-only ceiling."
              }
            />
            <div className="two-grid">
              <div className="editorial">
                <h2>The commitment lives in the pool.</h2>
                <p>
                  The creator sets a starting rate, hold, step size, interval
                  and floor at creation. The schedule cannot be rewritten
                  upward. A creator can cut below it from the first block.
                </p>
                <p>
                  For a 3% start, two-day hold and 0.2 percentage point weekly
                  step, the first drop is on day 2. The floor of 1% arrives on
                  day 65.
                </p>
                <p>
                  The token stays a plain ERC-20. The tax belongs to the Uniswap
                  v4 pool hook. Wallet-to-wallet transfers are free.
                </p>
                <Button to="/launch" variant="dark">
                  preview a path <Arrow />
                </Button>
              </div>
              <CodePanel />
            </div>
            <div className="section">
              <PathDemo />
            </div>
            <Heading
              title="Read the limits with the rules."
              description="Tax applies only in this pool. A falling tax does not remove market risk, vet a project or stop a creator selling their holdings."
            />
            <Button to="/docs/risks">
              honest limits <Arrow />
            </Button>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
