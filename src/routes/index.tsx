import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="/">glidepath<span>↘</span></a>
        <span className="network-pill"><i /> Robinhood Chain</span>
        <a className="nav-link" href="#how-it-works">How it works</a>
      </nav>

      <section className="hero">
        <p className="eyebrow">A launchpad with a written promise</p>
        <h1>Launch with a tax.<br /><em>Lock how it falls.</em></h1>
        <p className="intro">
          Fund the build from day one. Set the tax path before the first trade.
          After launch, it can only move down.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#how-it-works">Explore the launchpad <span>↗</span></a>
          <a className="button button-quiet" href="#tax-path">See a sample tax path <span>↓</span></a>
        </div>
        <div className="path-card" id="tax-path">
          <div className="path-head"><span>ILLUSTRATIVE GLIDE</span><span>3.0% <b>→</b> 1.0%</span></div>
          <div className="path-track"><i /><i /><i /><i /><i /></div>
          <div className="path-dates"><span>Launch</span><span>Day 2</span><span>Day 16</span><span>Day 30</span><span>Floor</span></div>
          <p>Example only · each launch commits its own path onchain</p>
        </div>
      </section>

      <section className="principles" id="how-it-works">
        <article><span className="number">01</span><h2>Set the path</h2><p>Choose the starting rate, hold, steps, floor and any market-cap milestones before launch.</p></article>
        <article><span className="number">02</span><h2>Launch the pool</h2><p>The tax lives in the pool hook. The token stays a plain ERC-20 with free wallet transfers.</p></article>
        <article><span className="number">03</span><h2>Watch it fall</h2><p>Time, reached milestones, or a creator cut can lower the rate. Nothing can raise it.</p></article>
      </section>

      <footer><span>Built on Uniswap v4 on Robinhood Chain.</span><span>Unaudited · launch mechanics are under development</span></footer>
    </main>
  );
}
