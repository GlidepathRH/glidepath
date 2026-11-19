import index from "./marketIndex.json";
export const realMarkets = index;
export const marketSnapshot = { capturedAt: index[0]?.capturedAt };
const detailCache = new Map();
export async function loadMarketDetail(id, signal) {
  const meta = realMarkets.find((m) => m.id === id);
  if (!meta) throw Error("Unknown market");
  if (detailCache.has(id)) return detailCache.get(id);
  const response = await fetch(meta.detailPath, { signal });
  if (!response.ok) throw Error("Market snapshot unavailable");
  const data = await response.json();
  if (data.id !== id || data.chain !== "robinhood")
    throw Error("Market identity mismatch");
  detailCache.set(id, data);
  return data;
}
export const priceLabel = (value) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumSignificantDigits: 5 }).format(
        value,
      )
    : "—";
export const changeLabel = (value) =>
  Number.isFinite(value)
    ? (value > 0 ? "+" : "") + value.toFixed(2) + "%"
    : "—";
export const addressLabel = (address) =>
  address ? address.slice(0, 6) + "…" + address.slice(-4) : "—";
export const creatorFee = (m) =>
  Number.isFinite(m.creatorTaxBps)
    ? m.creatorTaxBps / 100 + "%"
    : "Not reported";
export const marketChange = (m) =>
  Number.isFinite(m.change24h)
    ? { value: m.change24h, label: "24h", unit: m.change24hUnit || m.chartUnit }
    : {
        value: m.changeSinceLaunch,
        label: "since launch",
        unit: m.changeSinceLaunchUnit || m.chartUnit,
      };
export const marketStage = (m) =>
  m.stageChanged
    ? "Graduated · demo"
    : m.stage === "graduated"
      ? "On DEX"
      : "On curve";
export function ageAtCapture(m) {
  const seconds = Math.max(0, Date.parse(m.capturedAt) / 1000 - m.createdAt);
  return seconds < 3600
    ? Math.max(1, Math.floor(seconds / 60)) + "m"
    : seconds < 86400
      ? Math.floor(seconds / 3600) + "h"
      : Math.floor(seconds / 86400) + "d";
}
export function mergeFeedDetail(detail, live) {
  if (!detail) return live;
  const candles = { ...detail.candles };
  for (const [interval, seconds] of [
    ["1m", 60],
    ["1h", 3600],
    ["1d", 86400],
  ]) {
    if (!candles[interval]) continue;
    const merged = new Map(
      cleanCandles(candles[interval]).map((c) => [c.time, c]),
    );
    for (const c of aggregateCandles(live.feedCandles || [], seconds)) {
      const old = merged.get(c.time);
      merged.set(
        c.time,
        old
          ? {
              ...c,
              open: old.open,
              high: Math.max(old.high, c.high),
              low: Math.min(old.low, c.low),
              volume: old.volume + c.volume,
            }
          : c,
      );
    }
    candles[interval] = [...merged.values()].sort((a, b) => a.time - b.time);
  }
  return {
    ...detail,
    ...live,
    candles,
    trades: [...(live.feedTrades || []), ...(detail.trades || [])].slice(0, 30),
  };
}
export const safeExternal = (value) => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
export function cleanCandles(values) {
  const byTime = new Map();
  for (const row of values || []) {
    const c = {
      time: Number(row.time),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume) || 0,
    };
    if (
      Object.values(c).every(Number.isFinite) &&
      c.time > 0 &&
      c.low > 0 &&
      c.high >= Math.max(c.open, c.close, c.low) &&
      c.low <= Math.min(c.open, c.close) &&
      c.volume >= 0
    )
      byTime.set(c.time, c);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
export function aggregateCandles(values, seconds) {
  const out = new Map();
  for (const c of cleanCandles(values)) {
    const time = Math.floor(c.time / seconds) * seconds,
      old = out.get(time);
    if (old) {
      old.high = Math.max(old.high, c.high);
      old.low = Math.min(old.low, c.low);
      old.close = c.close;
      old.volume += c.volume;
    } else out.set(time, { ...c, time });
  }
  return [...out.values()];
}
export function selectMarkets(
  markets,
  { query = "", sort = "featured", savedOnly = false, saved = [] } = {},
) {
  const q = query.trim().toLowerCase();
  return markets
    .filter(
      (m) =>
        (!savedOnly || saved.includes(m.id)) &&
        [m.name, m.symbol, m.address].some((v) => v?.toLowerCase().includes(q)),
    )
    .slice()
    .sort((a, b) =>
      sort === "cap"
        ? (b.marketCap ?? 0) - (a.marketCap ?? 0)
        : sort === "volume"
          ? (b.volume24h ?? 0) - (a.volume24h ?? 0)
          : sort === "newest"
            ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
            : 0,
    );
}
