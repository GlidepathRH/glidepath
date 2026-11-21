import { describe, expect, test } from "bun:test";
import express from "express";
import type { Pool } from "pg";
import type { PublicClient } from "viem";

process.env.DATABASE_URL ??= "postgres://unit:unit@127.0.0.1:5432/unit";
process.env.RHC_RPC_URL ??= "http://127.0.0.1:8545";
process.env.GLIDEPATH_FACTORY_ADDRESS ??= "0x69531E368B9236c2ed7c6da054e8705506c7FA8d";
process.env.GLIDEPATH_HOOK_ADDRESS ??= "0xd9C3FA83fdeDe47784a9FC62ECf11A4FBd24AaCc";
process.env.RHC_DEPLOYMENT_BLOCK ??= "1000";

const [{ createReadinessRouter }, { createLaunchRouter, marketCapInQuoteWei, marketCapUsdRaw, usdgRawPerEth }] = await Promise.all([
  import("./ready"),
  import("./launches"),
]);

const TOKEN = "0x00000000000000000000000000000000000000ab" as const;
const POOL = `0x${"11".repeat(32)}` as const;

function mockDb({ rows = [], fail = false }: { rows?: Array<Record<string, unknown>>; fail?: boolean } = {}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (fail) throw new Error("database unavailable");
      return { rows, rowCount: rows.length };
    },
  };
}

async function withRoutes(
  db: ReturnType<typeof mockDb>,
  chain: { getChainId: () => Promise<number>; readContract?: (args: unknown) => Promise<bigint>; multicall?: (args: unknown) => Promise<unknown[]> },
  run: (base: string) => Promise<void>,
) {
  const app = express();
  app.use("/ready", createReadinessRouter(db as unknown as Pool, chain as unknown as PublicClient));
  app.use("/api/v1/launches", createLaunchRouter(db as unknown as Pool, chain as unknown as PublicClient));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an ephemeral TCP listener");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("readiness and launch routes", () => {
  test("computes fully diluted quote market cap from fixed supply and pool price", () => {
    const q96 = 1n << 96n;
    expect(marketCapInQuoteWei(1_000_000_000_000_000_000n, q96)).toBe("1000000000000000000");
    expect(marketCapInQuoteWei(1_000_000_000_000_000_000n, 0n)).toBeNull();
    const sqrtForTwoThousandUsd = BigInt(Math.floor(Math.sqrt(2_000 / 1e12) * Number(q96)));
    const usdgPerEth = usdgRawPerEth(sqrtForTwoThousandUsd);
    expect(Number(usdgPerEth) / 1e6).toBeCloseTo(2_000, 3);
    expect(Number(marketCapUsdRaw("1000000000000000000", usdgPerEth)) / 1e6).toBeCloseTo(2_000, 3);
    expect(marketCapUsdRaw(null, usdgPerEth)).toBeNull();
  });
  test("readiness checks both the database and expected chain", async () => {
    const db = mockDb();
    await withRoutes(db, { getChainId: async () => 4663 }, async (base) => {
      const ready = await fetch(`${base}/ready`);
      expect(ready.status).toBe(200);
      expect(await ready.json()).toEqual({ status: "ready", chainId: 4663 });
    });

    await withRoutes(mockDb(), { getChainId: async () => 1 }, async (base) => {
      const wrongChain = await fetch(`${base}/ready`);
      expect(wrongChain.status).toBe(503);
      expect(await wrongChain.json()).toEqual({ status: "unavailable", dependency: "chain" });
    });
  });

  test("readiness fails closed when its database dependency is down", async () => {
    await withRoutes(mockDb({ fail: true }), { getChainId: async () => 4663 }, async (base) => {
      const response = await fetch(`${base}/ready`);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable" });
    });
  });

  test("validates launch-list limits and returns the database envelope", async () => {
      const db = mockDb({ rows: [{
        token_address: TOKEN,
        token_name: "Test",
        pool_id: POOL,
        quote_currency: "0x0000000000000000000000000000000000000001",
        total_supply: "1000000000000000000",
      }] });
    await withRoutes(db, {
      getChainId: async () => 4663,
      multicall: async (args: unknown) => (args as { contracts: unknown[] }).contracts.map(() => ({ status: "success", result: 30_000n })),
    }, async (base) => {
      for (const limit of ["0", "101", "abc", "1.5"]) {
        const invalid = await fetch(`${base}/api/v1/launches?limit=${limit}`);
        expect(invalid.status).toBe(400);
      }
      const response = await fetch(`${base}/api/v1/launches?limit=10`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [{
        token_address: TOKEN,
        token_name: "Test",
        pool_id: POOL,
        quote_currency: "0x0000000000000000000000000000000000000001",
        total_supply: "1000000000000000000",
        buy_tax_pips: 30_000,
        sell_tax_pips: 30_000,
        market_cap_quote_wei: null,
        market_cap_quote_symbol: null,
        market_cap_usd_raw: null,
        market_cap_usd_source: null,
      }] });
      expect(db.calls.at(-1)?.values).toEqual([4663, 10]);
    });
  });

  test("rejects malformed token addresses without querying storage", async () => {
    const db = mockDb();
    await withRoutes(db, { getChainId: async () => 4663 }, async (base) => {
      const detail = await fetch(`${base}/api/v1/launches/not-an-address`);
      const events = await fetch(`${base}/api/v1/launches/not-an-address/events`);
      expect(detail.status).toBe(400);
      expect(events.status).toBe(400);
      expect(db.calls).toHaveLength(0);
    });
  });

  test("returns 404 for a valid token address absent from the index", async () => {
    const db = mockDb();
    await withRoutes(db, { getChainId: async () => 4663 }, async (base) => {
      const detail = await fetch(`${base}/api/v1/launches/${TOKEN}`);
      expect(detail.status).toBe(404);
      expect(await detail.json()).toEqual({ error: "launch not found" });
      expect(db.calls[0].values).toEqual([4663, TOKEN]);
    });
  });

  test("chart endpoint validates intervals and reports an unindexed launch", async () => {
    const db = mockDb();
    await withRoutes(db, { getChainId: async () => 4663 }, async (base) => {
      const invalidInterval = await fetch(`${base}/api/v1/launches/${TOKEN}/chart?interval=15m`);
      expect(invalidInterval.status).toBe(400);
      for (const interval of ["5m", "1h", "4h", "1d"]) {
        const missing = await fetch(`${base}/api/v1/launches/${TOKEN}/chart?interval=${interval}`);
        expect(missing.status).toBe(404);
      }
      const normalized = await fetch(`${base}/api/v1/launches/${TOKEN}/chart?interval=1H`);
      expect(normalized.status).toBe(404);
      expect(db.calls).toHaveLength(5);
    });
  });

  test("detail reads current taxes from the hook instead of stored launch values", async () => {
    const db = mockDb({ rows: [{
      token_address: TOKEN,
      pool_id: POOL,
      quote_currency: "0x0000000000000000000000000000000000000000",
      total_supply: "1000000000000000000",
      buy_tax_pips: 99,
    }] });
    const readCalls: unknown[] = [];
    const chain = {
      getChainId: async () => 4663,
      readContract: async (args: unknown) => {
        readCalls.push(args);
        const functionName = (args as { functionName: string }).functionName;
        if (functionName === "buyTaxNow") return 30_000n;
        if (functionName === "sellTaxNow") return 20_000n;
        if (readCalls.length === 3) return BigInt(`0x${(1n << 96n).toString(16).padStart(64, "0")}`);
        const q96 = Number(1n << 96n);
        const sqrtForTwoThousandUsd = BigInt(Math.floor(Math.sqrt(2_000 / 1e12) * q96));
        return BigInt(`0x${sqrtForTwoThousandUsd.toString(16).padStart(64, "0")}`);
      },
    };
    await withRoutes(db, chain, async (base) => {
      const response = await fetch(`${base}/api/v1/launches/${TOKEN}`);
      expect(response.status).toBe(200);
      const payload = await response.json() as { data: { buy_tax_pips: number; sell_tax_pips: number; market_cap_quote_wei: string; market_cap_quote_symbol: string; market_cap_usd_raw: string; market_cap_usd_source: string } };
      expect(payload.data.buy_tax_pips).toBe(30_000);
      expect(payload.data.sell_tax_pips).toBe(20_000);
      expect(payload.data.market_cap_quote_wei).toBe("1000000000000000000");
      expect(payload.data.market_cap_quote_symbol).toBe("ETH");
      expect(Number(payload.data.market_cap_usd_raw) / 1e6).toBeCloseTo(2_000, 3);
      expect(payload.data.market_cap_usd_source).toBe("USDG");
      expect(readCalls).toHaveLength(4);
    });
  });
});
