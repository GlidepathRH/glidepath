import React, { useState, useEffect } from "react";
import Home, { InfoPage } from "./Home";
import { Header, Button } from "./ui";
import { Market, Launch } from "./Dashboard";
import Docs from "./Docs";
import { Workspace } from "./Workspace";
import { ProExplore, TaxLab, PathActivity } from "./ProDashboard";
import { MarketBrowser } from "./MarketBrowser";
import { TokenMarket } from "./TokenMarket";
import { Trending } from "./Trending";
import { realMarkets } from "./marketSnapshot";
import { MarketFeedProvider } from "./MarketFeed.jsx";
const localPreview = import.meta.env.DEV ||
  (typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("preview") === "1");
function App() {
  let [route, setRoute] = useState("/");
  useEffect(() => {
    const navigateTabs = (event) => {
      const list = event.target.closest?.('[role="tablist"]');
      if (
        !list ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(event.target);
      if (index < 0) return;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    };
    document.addEventListener("keydown", navigateTabs);
    return () => document.removeEventListener("keydown", navigateTabs);
  }, []);
  useEffect(() => {
    setRoute(window.location.hash.slice(1) || "/");
    let change = () => {
      if (window.location.hash === "#main") {
        document.getElementById("main")?.focus();
        return;
      }
      setRoute(window.location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  let parts = route.split("/").filter(Boolean),
    page = parts[0] || "home",
    isApp = [
      "explore",
      "markets",
      "watchlist",
      "market",
      "launch",
      "lab",
      "activity",
      "examples",
      "trending",
    ].includes(page);
  useEffect(() => {
    document.title = localPreview
      ? "LIVE preview"
      : (page === "home"
          ? "Launch with a tax. Lock how it falls."
          : page[0].toUpperCase() + page.slice(1)) + " · GLIDY";
  }, [page]);
  return (
    <>
      {!isApp && <Header key={"header-" + page} isApp={false} />}
      {isApp ? (
        <Workspace route={page}>
          {page === "market" ? (
            realMarkets.some((m) => m.id === parts[1]) ? (
              <TokenMarket key={parts[1]} id={parts[1]} />
            ) : (
              <Market key={parts[1]} id={parts[1]} />
            )
          ) : page === "launch" ? (
            <Launch />
          ) : page === "lab" ? (
            <TaxLab />
          ) : page === "activity" ? (
            <PathActivity />
          ) : page === "trending" ? (
            <Trending />
          ) : page === "examples" ? (
            <ProExplore mode="overview" />
          ) : (
            <MarketBrowser key={page} watchlist={page === "watchlist"} />
          )}
        </Workspace>
      ) : page === "home" ? (
        <Home />
      ) : page === "docs" ? (
        <Docs key={parts[1]} page={parts[1] || "overview"} />
      ) : ["about", "how-it-works", "roadmap", "case-study"].includes(page) ? (
        <InfoPage type={page} />
      ) : (
        <main id="main" tabIndex={-1} className="empty container">
          <h1>This path doesn’t exist.</h1>
          <Button to="/explore">back to markets</Button>
        </main>
      )}
    </>
  );
}
export default function GlidyApp() {
  return (
    <MarketFeedProvider>
      <App />
    </MarketFeedProvider>
  );
}
