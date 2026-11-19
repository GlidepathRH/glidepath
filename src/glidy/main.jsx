import React, { useEffect, useState } from "react";
import Docs from "./Docs";
import { GlidyApiProvider } from "./GlidyApi";
import { GlidyLaunchDetailPage, GlidyLaunches } from "./GlidyLaunches";
import { Workspace } from "./Workspace";

function App() {
  const [route, setRoute] = useState("/");
  useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash.slice(1) || "/");
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  const parts = route.split("/").filter(Boolean);
  const requested = parts[0] || "explore";
  const page = ["docs", "watchlist", "market"].includes(requested) ? requested : "explore";
  const title = page === "docs" ? `How it works · ${parts[1] || "overview"} · GLIDY` : `${page === "watchlist" ? "Saved launches" : "GLIDY launches"} · GLIDY`;
  useEffect(() => { document.title = title; }, [title]);

  return (
    <Workspace route={page}>
      {page === "docs" ? <Docs page={parts[1] || "overview"} /> : page === "market" ? (
        <GlidyLaunchDetailPage tokenAddress={parts[1]} />
      ) : (
        <GlidyApiProvider>
          <GlidyLaunches savedOnly={page === "watchlist"} />
        </GlidyApiProvider>
      )}
    </Workspace>
  );
}

export default function GlidyApp() {
  return <App />;
}
