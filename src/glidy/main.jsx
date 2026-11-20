import React, { useEffect, useState } from "react";
import Docs from "./Docs";
import Home from "./Home";
import { GlidyApiProvider } from "./GlidyApi";
import { GlidyLaunchDetailPage } from "./GlidyLaunches";
import { GlidyLaunchBrowser } from "./GlidyLaunchBrowser";
import { LaunchCreator } from "./LaunchCreator";
import { Workspace } from "./Workspace";
import { GlidyTradePage } from "./GlidyTrade";
import "./launch-designer.css";

function App() {
  const [route, setRoute] = useState("/");
  useEffect(() => {
    const syncRoute = () => {
      const marketPath = window.location.pathname.match(/^\/market\/(0x[\da-f]{40})\/?$/i);
      setRoute(marketPath ? `/market/${marketPath[1]}` : window.location.hash.slice(1) || "/");
    };
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  const parts = route.split("/").filter(Boolean);
  const requested = parts[0] || "home";
  const page = ["home", "explore", "docs", "watchlist", "market", "launch", "trade"].includes(requested) ? requested : "home";
  const title = page === "docs" ? `How it works · ${parts[1] || "overview"} · GLIDY` : page === "home" ? "GLIDY · Launch with a tax. Lock how it falls." : page === "launch" ? "Create a launch · GLIDY" : page === "trade" ? "Trade launches · GLIDY" : `${page === "watchlist" ? "Saved launches" : "GLIDY launches"} · GLIDY`;
  useEffect(() => { document.title = title; }, [title]);

  if (page === "home") return <Home />;

  return (
    <Workspace route={page}>
      <GlidyApiProvider>
        {page === "launch" ? <LaunchCreator /> : page === "docs" ? <Docs page={parts[1] || "overview"} /> : page === "market" ? (
          <GlidyLaunchDetailPage tokenAddress={parts[1]} />
        ) : page === "trade" ? <GlidyTradePage /> : <GlidyLaunchBrowser watchlist={page === "watchlist"} />}
      </GlidyApiProvider>
    </Workspace>
  );
}

export default function GlidyApp() {
  return <App />;
}
