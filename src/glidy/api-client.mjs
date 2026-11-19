const API_ROOT = "/api/glidy";

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
