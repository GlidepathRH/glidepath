import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_ROOT = "/api/glidy";
const GlidyApiContext = createContext(null);

export async function apiGet(path, signal) {
  const response = await fetch(`${API_ROOT}/${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? `Request limit reached. Try again in ${response.headers.get("retry-after") || "a little while"} seconds.`
        : response.status === 503
          ? "The GLIDY API is temporarily unavailable. Try again shortly."
          : payload.error || `Request failed (${response.status})`,
    );
    error.status = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }
  return payload;
}

export function GlidyApiProvider({ children }) {
  const [state, setState] = useState({ kind: "loading", launches: [], indexer: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, kind: current.launches.length ? "refreshing" : "loading", error: null }));
    Promise.all([
      apiGet("api/v1/launches?limit=100", controller.signal),
      apiGet("api/v1/indexer", controller.signal).catch(() => null),
    ])
      .then(([result, indexer]) => {
        if (!controller.signal.aborted) {
          setState({ kind: "ready", launches: Array.isArray(result.data) ? result.data : [], indexer, updatedAt: new Date() });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState((current) => ({ ...current, kind: "error", error: error.message || "Could not load GLIDY launches." }));
        }
      });
    return () => controller.abort();
  }, [refreshKey]);

  return <GlidyApiContext.Provider value={{ ...state, refresh }}>{children}</GlidyApiContext.Provider>;
}

export function useGlidyApi() {
  const value = useContext(GlidyApiContext);
  if (!value) throw new Error("useGlidyApi must be used inside GlidyApiProvider");
  return value;
}
