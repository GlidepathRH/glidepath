// Transport-independent market state. All monetary fields are numbers in their named unit.
// Adapters call apply(event); components never subscribe directly to a socket or timer.
const NUMERIC = [
  "priceUsd",
  "priceQuote",
  "marketCap",
  "volume24h",
  "change24h",
  "changeSinceLaunch",
  "progress",
];
export function createMarketStore(initial) {
  const base = initial.map((m) => ({
    ...m,
    feedRevision: 0,
    feedCandles: [],
    feedTrades: [],
  }));
  let state = {
    markets: base,
    revision: 0,
    status: "paused",
    mode: "mock",
    lastEventAt: null,
    moment: null,
  };
  const listeners = new Set(),
    sequences = new Map();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => state,
    setStatus(status, mode = "mock") {
      state = { ...state, status, mode };
      emit();
    },
    reset() {
      sequences.clear();
      state = {
        ...state,
        markets: base,
        revision: state.revision + 1,
        lastEventAt: null,
        moment: null,
      };
      emit();
    },
    apply(event) {
      if (
        !event ||
        ![
          "market.tick",
          "candle.upsert",
          "trade.append",
          "launch.stage",
          "risk.updated",
        ].includes(event.type)
      )
        return false;
      const index = state.markets.findIndex((m) => m.id === event.id);
      if (
        index < 0 ||
        !Number.isSafeInteger(event.sequence) ||
        !Number.isFinite(event.at) ||
        event.at <= 0
      )
        return false;
      const key = event.id + ":" + event.type;
      if (event.sequence <= (sequences.get(key) ?? -1)) return false;
      const old = state.markets[index];
      let next = { ...old },
        moment = state.moment;
      if (event.type === "market.tick") {
        if (!event.values || !Object.keys(event.values).length) return false;
        for (const [key, value] of Object.entries(event.values)) {
          if (
            !NUMERIC.includes(key) ||
            !Number.isFinite(value) ||
            (!key.startsWith("change") && value < 0) ||
            (key === "progress" && value > 1)
          )
            return false;
          next[key] = value;
        }
        next.priceDirection = Math.sign(
          (next.priceUsd ?? 0) - (old.priceUsd ?? 0),
        );
        next.capDirection = Math.sign(
          (next.marketCap ?? 0) - (old.marketCap ?? 0),
        );
        next.volumeDirection = Math.sign(
          (next.volume24h ?? 0) - (old.volume24h ?? 0),
        );
        next.previousCap = old.marketCap;
        const crossed = [
          10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000,
          5000000, 10000000, 25000000, 50000000, 100000000,
        ]
          .filter((n) => old.marketCap < n && next.marketCap >= n)
          .at(-1);
        if (crossed)
          moment = {
            id: event.id + ":" + event.sequence,
            at: event.at,
            type: "market-cap",
            symbol: old.symbol,
            amount: crossed,
            simulated: state.mode === "mock",
          };
      } else if (event.type === "candle.upsert") {
        const c = event.candle;
        if (
          !c ||
          !["time", "open", "high", "low", "close", "volume"].every((k) =>
            Number.isFinite(c[k]),
          ) ||
          c.time <= 0 ||
          c.low <= 0 ||
          c.high < Math.max(c.open, c.close, c.low) ||
          c.low > Math.min(c.open, c.close) ||
          c.volume < 0
        )
          return false;
        next.feedCandles = [
          ...old.feedCandles.filter((v) => v.time !== c.time),
          { ...c },
        ]
          .sort((a, b) => a.time - b.time)
          .slice(-240);
        next.sparkline = [
          ...(old.sparkline || []).filter((v) => v.time !== c.time),
          { time: c.time, close: c.close },
        ].slice(-24);
      } else if (event.type === "trade.append") {
        const t = event.trade;
        if (
          !t ||
          typeof t.id !== "string" ||
          !["buy", "sell"].includes(t.side) ||
          ![t.timestamp, t.priceQuote, t.volumeQuote].every(
            (n) => Number.isFinite(n) && n > 0,
          )
        )
          return false;
        if (!t.simulated && !/^0x[0-9a-f]{64}$/i.test(t.txHash || ""))
          return false;
        if (old.feedTrades.some((v) => v.id === t.id)) return false;
        next.feedTrades = [{ ...t }, ...old.feedTrades].slice(0, 30);
      } else if (event.type === "risk.updated") {
        const r = event.risk,
          validBps = (n) => Number.isInteger(n) && n >= 0 && n <= 10000;
        if (
          !r ||
          !validBps(r.top10Bps) ||
          !validBps(r.bundledBps) ||
          !Array.isArray(r.holders) ||
          r.holders.length !== 10 ||
          !r.holders.every(
            (h) =>
              typeof h.id === "string" &&
              typeof h.label === "string" &&
              validBps(h.shareBps),
          ) ||
          r.holders.reduce((sum, h) => sum + h.shareBps, 0) !== r.top10Bps ||
          !Array.isArray(r.groups) ||
          !r.groups.every(
            (g) =>
              typeof g.id === "string" &&
              typeof g.signal === "string" &&
              Number.isInteger(g.walletCount) &&
              g.walletCount > 0 &&
              validBps(g.shareBps),
          )
        )
          return false;
        next.risk = { ...r };
      } else {
        if (!["curve", "graduated"].includes(event.stage)) return false;
        next.stage = event.stage;
        next.stageChanged = true;
        if (old.stage !== event.stage && event.stage === "graduated")
          moment = {
            id: event.id + ":" + event.sequence,
            at: event.at,
            type: "graduation",
            symbol: old.symbol,
            simulated: state.mode === "mock",
          };
        if (event.stage === "graduated") next.progress = 1;
      }
      next.feedRevision = state.revision + 1;
      next.updatedAt = event.at;
      const markets = [...state.markets];
      markets[index] = next;
      sequences.set(key, event.sequence);
      state = {
        ...state,
        markets,
        revision: state.revision + 1,
        lastEventAt: event.at,
        moment,
      };
      emit();
      return true;
    },
  };
}

// Local demonstration transport. Replace this factory with a WebSocket/SSE adapter.
// It intentionally labels every generated trade and never invents a transaction hash.
export function createMockMarketSource({ store }) {
  let timer = null,
    sequence = 0,
    turn = 0;
  const tick = (id, factor) => {
    const m = store.getSnapshot().markets.find((v) => v.id === id);
    if (!m) return;
    const at = Date.now(),
      baseQuote = m.priceQuote || m.priceUsd / (m.quoteUsd || 1);
    const priceQuote = baseQuote * factor,
      priceUsd = m.priceUsd * factor,
      volumeUsd = 25 + (sequence % 11) * 17;
    const values = {
      priceQuote,
      priceUsd,
      marketCap: m.marketCap * factor,
      volume24h: m.volume24h + volumeUsd,
    };
    if (Number.isFinite(m.change24h))
      values.change24h = ((1 + m.change24h / 100) * factor - 1) * 100;
    else if (Number.isFinite(m.changeSinceLaunch))
      values.changeSinceLaunch =
        ((1 + m.changeSinceLaunch / 100) * factor - 1) * 100;
    if (m.stage === "curve" && Number.isFinite(m.progress))
      values.progress = Math.min(0.99, m.progress + 0.0002);
    store.apply({ type: "market.tick", id, sequence: ++sequence, at, values });
    const time = Math.floor(at / 60000) * 60,
      previous = m.feedCandles.find((c) => c.time === time),
      quoteVolume = volumeUsd / (m.quoteUsd || 1);
    store.apply({
      type: "candle.upsert",
      id,
      sequence: ++sequence,
      at,
      candle: {
        time,
        open: previous?.open || baseQuote,
        high: Math.max(previous?.high || baseQuote, priceQuote),
        low: Math.min(previous?.low || baseQuote, priceQuote),
        close: priceQuote,
        volume: (previous?.volume || 0) + quoteVolume,
      },
    });
    store.apply({
      type: "trade.append",
      id,
      sequence: ++sequence,
      at,
      trade: {
        id: "demo-" + sequence,
        timestamp: Math.floor(at / 1000),
        side: factor >= 1 ? "buy" : "sell",
        priceQuote,
        volumeQuote: quoteVolume,
        txHash: null,
        simulated: true,
      },
    });
  };
  const pulse = () => {
    if (document.hidden) return;
    const markets = store.getSnapshot().markets;
    // Cycle through all markets without reshuffling lists on every tick.
    for (let i = 0; i < 3; i++) {
      const m = markets[(turn * 3 + i) % markets.length];
      tick(m.id, 1 + Math.sin((turn * 3 + i + 1) * 1.7) * 0.008);
    }
    turn++;
  };
  return {
    start() {
      if (timer) return;
      store.setStatus("running", "mock");
      store.getSnapshot().markets.forEach((m, index) => {
        if (!m.risk)
          store.apply({
            type: "risk.updated",
            id: m.id,
            sequence: ++sequence,
            at: Date.now(),
            risk: createDemoRisk(index),
          });
      });
      timer = setInterval(pulse, 2600);
      pulse();
    },
    stop() {
      clearInterval(timer);
      timer = null;
      store.setStatus("paused", "mock");
    },
    replay() {
      const sorted = store
        .getSnapshot()
        .markets.filter((m) => m.kind === "featured")
        .sort((a, b) => b.marketCap - a.marketCap);
      const lower = sorted[3],
        upper = sorted[2];
      if (lower && upper) {
        tick(lower.id, (upper.marketCap * 1.025) / lower.marketCap);
        const m = store.getSnapshot().markets.find((v) => v.id === lower.id);
        store.apply({
          type: "market.tick",
          id: m.id,
          sequence: ++sequence,
          at: Date.now(),
          values: { volume24h: Math.max(m.volume24h, upper.volume24h * 1.025) },
        });
      }
      const curve = store
        .getSnapshot()
        .markets.find((m) => m.stage === "curve");
      if (curve)
        store.apply({
          type: "launch.stage",
          id: curve.id,
          sequence: ++sequence,
          at: Date.now(),
          stage: "graduated",
        });
    },
  };
}
export function createDemoRisk(index) {
  const top10Bps = [3420, 1860, 6280, 2570][index % 4],
    bundledBps = [1240, 420, 2380, 1120][index % 4],
    weights = [24, 17, 13, 11, 9, 8, 6, 5, 4, 3];
  let allocated = 0;
  const holders = weights.map((w, i) => {
    const shareBps =
      i === 9 ? top10Bps - allocated : Math.floor((top10Bps * w) / 100);
    allocated += shareBps;
    return {
      id: "demo-wallet-" + i,
      label: "Demo wallet " + String(i + 1).padStart(2, "0"),
      shareBps,
    };
  });
  return {
    simulated: true,
    top10Bps,
    bundledBps,
    holders,
    groups: [
      {
        id: "demo-cluster-a",
        shareBps: Math.floor(bundledBps * 0.65),
        walletCount: 4,
        signal: "Shared funding in this example",
      },
      {
        id: "demo-cluster-b",
        shareBps: bundledBps - Math.floor(bundledBps * 0.65),
        walletCount: 3,
        signal: "Closely timed buys in this example",
      },
    ],
  };
}
