// Basis points and whole days. Backend PDF §§2.1–2.7.
export const DEFAULT_PATH = {
  start: 300,
  floor: 100,
  step: 20,
  hold: 2,
  interval: 7,
};
export function rateAt(p, day) {
  if (!p.step || day < p.hold) return p.start;
  return Math.max(
    p.floor,
    p.start - (1 + Math.floor((day - p.hold) / p.interval)) * p.step,
  );
}
export function floorDay(p) {
  return !p.step
    ? null
    : p.start === p.floor
      ? 0
      : p.hold +
        Math.max(0, Math.ceil((p.start - p.floor) / p.step) - 1) * p.interval;
}
export function nextStep(p, day) {
  if (!p.step || rateAt(p, day) <= p.floor) return null;
  let at =
    day < p.hold
      ? p.hold
      : p.hold + (1 + Math.floor((day - p.hold) / p.interval)) * p.interval;
  return { day: at, rate: rateAt(p, at) };
}
export const effectiveRate = (p, d, c = 10000, m = 10000) =>
  Math.min(rateAt(p, d), c, m);
export const platformShare = (b) =>
  b === 0 ? 0 : Math.min(Math.floor(b / 2), 10 + Math.floor(b / 10));
export function fees(amount, bps, snipe = 0) {
  let active = Math.max(bps, snipe),
    tax = (amount * active) / 10000,
    base = amount * 0.003,
    share = snipe > bps ? tax * 0.1 : (amount * platformShare(active)) / 10000;
  return {
    tax,
    base,
    total: tax + base,
    creator: tax - share,
    platform: share + base,
  };
}
export function validatePath(p) {
  let e = [];
  if (Object.values(p).some((v) => !Number.isFinite(v)))
    return ["Enter a number in every field."];
  if (p.start < 0 || p.start > 500) e.push("Starting tax must be 0–5%.");
  if (p.floor < 0 || p.floor > p.start)
    e.push("Floor must be between 0% and the starting tax.");
  if (p.hold < 0 || p.hold > 30) e.push("Hold must be 0–30 days.");
  if (p.step < 0 || p.step > 500) e.push("Step must be 0–5%.");
  if (!p.step && p.floor !== p.start)
    e.push("Flat paths have the same start and floor.");
  if (p.step && (p.interval < 1 || p.interval > 30))
    e.push("Steps must be 1–30 days apart.");
  if (p.step && floorDay(p) > 365)
    e.push("The glide must reach its floor within 365 days.");
  if (Object.values(p).some((v) => !Number.isInteger(v)))
    e.push("Use whole days and rates in 0.01% increments.");
  return e;
}
export const pct = (b) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(b / 100) +
  "%";
export const usd = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export const compact = (n) =>
  n >= 1e6
    ? "$" + (n / 1e6).toFixed(2) + "M"
    : n >= 1e3
      ? "$" + (n / 1e3).toFixed(1) + "K"
      : usd(n);
