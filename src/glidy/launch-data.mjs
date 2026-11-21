export function formatTaxPips(value) {
  if (value === null || value === undefined || value === "") return "—";
  const pips = Number(value);
  if (!Number.isFinite(pips)) return "—";
  return `${(pips / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function shortAddress(address) {
  return typeof address === "string" && address.length > 13
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address || "—";
}

export function formatMarketCap(ethWei, usdRaw, currency = "ETH") {
  const raw = currency === "USD" ? usdRaw : ethWei;
  if (raw === null || raw === undefined || raw === "") return "—";
  const decimals = currency === "USD" ? 6 : 18;
  const value = Number(raw) / 10 ** decimals;
  if (!Number.isFinite(value)) return currency === "USD" ? "— USD" : "— ETH";
  if (currency === "USD") {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: "USD", notation: "compact", maximumSignificantDigits: 4,
    }).format(value);
  }
  return `${new Intl.NumberFormat(undefined, { notation: "compact", maximumSignificantDigits: 4 }).format(value)} ETH`;
}

export function filterAndSortLaunches(launches, { watchlist = false, saved = [], query = "", sort = "newest" } = {}) {
  const savedIds = new Set(saved.map((value) => String(value).toLowerCase()));
  const normalizedQuery = query.trim().toLowerCase();
  return launches
    .filter((launch) => !watchlist || savedIds.has(String(launch.token_address).toLowerCase()))
    .filter((launch) => `${launch.token_name} ${launch.token_symbol} ${launch.token_address}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => sort === "name"
      ? String(left.token_name).localeCompare(String(right.token_name))
      : Number(right.launch_block_timestamp) - Number(left.launch_block_timestamp));
}
