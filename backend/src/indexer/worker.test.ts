import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Pool, PoolClient } from "pg";
import type { PublicClient } from "viem";
import { indexerStatus } from "./status";

process.env.DATABASE_URL ??= "postgres://unit:unit@127.0.0.1:5432/unit";
process.env.RHC_RPC_URL ??= "http://127.0.0.1:8545";
process.env.MASTER_API_KEY ??= "unit-test-master-api-key-with-more-than-32-characters";
process.env.GLIDEPATH_FACTORY_ADDRESS ??= "0x69531E368B9236c2ed7c6da054e8705506c7FA8d";
process.env.GLIDEPATH_HOOK_ADDRESS ??= "0xd9C3FA83fdeDe47784a9FC62ECf11A4FBd24AaCc";
process.env.RHC_DEPLOYMENT_BLOCK ??= "1000";
process.env.INDEXER_BLOCK_RANGE ??= "1000";
process.env.INDEXER_CONFIRMATIONS ??= "2";

const { GlidepathIndexer } = await import("./worker");
let log: ReturnType<typeof mockLogger>;

function mockLogger() {
  const original = { info: console.info, warn: console.warn, error: console.error };
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  return () => Object.assign(console, original);
}

afterEach(() => { log?.(); });

function mockDatabase(initialCursor = 1000n, poolRows: Array<{ pool_id: string; launch_block_number: string }> = []) {
  let cursor = initialCursor;
  const poolCursors = new Map<string, bigint>();
  const updates: string[] = [];
  const query = async (sql: string, values?: unknown[]) => {
    if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: true }], rowCount: 1 };
    if (sql.includes("SELECT pool_id, launch_block_number FROM launches")) return { rows: poolRows, rowCount: poolRows.length };
    if (sql.includes("INSERT INTO pool_swap_indexer_state")) {
      const poolId = String(values?.[1]);
      if (!poolCursors.has(poolId)) poolCursors.set(poolId, BigInt(String(values?.[2])));
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT next_block FROM pool_swap_indexer_state")) {
      const nextBlock = poolCursors.get(String(values?.[1]));
      return { rows: nextBlock === undefined ? [] : [{ next_block: nextBlock.toString() }], rowCount: nextBlock === undefined ? 0 : 1 };
    }
    if (sql.includes("UPDATE pool_swap_indexer_state SET next_block")) {
      poolCursors.set(String(values?.[1]), BigInt(String(values?.[2])));
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT next_block FROM chain_indexer_state")) return { rows: [{ next_block: cursor.toString() }], rowCount: 1 };
    if (sql.includes("UPDATE chain_indexer_state SET next_block")) {
      cursor = BigInt(String(values?.[2]));
      updates.push(cursor.toString());
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const client = { query, release: () => {} } as unknown as PoolClient;
  return {
    pool: { connect: async () => client } as unknown as Pool,
    cursor: () => cursor,
    poolCursor: (poolId: string) => poolCursors.get(poolId),
    updates,
  };
}

function mockChain(getLogs: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<[]> | []) {
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  const client = {
    getBlockNumber: async () => 10_000n,
    getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      ranges.push({ fromBlock, toBlock });
      return getLogs({ fromBlock, toBlock });
    },
  } as unknown as PublicClient;
  return { client, ranges };
}

describe("GlidepathIndexer polling", () => {
  beforeAll(() => { log = mockLogger(); });

  test("splits 1,000-block batches to the RPC cap and remembers it", async () => {
    const database = mockDatabase();
    let rejectsOversizedRange = true;
    const chain = mockChain(({ fromBlock, toBlock }) => {
      if (toBlock - fromBlock + 1n > 100n) {
        if (rejectsOversizedRange) {
          rejectsOversizedRange = false;
          throw { name: "RpcRequestError", details: "ranges over 100 blocks are not supported on free plan" };
        }
        throw new Error("Indexer requested an oversized RPC range");
      }
      return [];
    });
    const indexer = new GlidepathIndexer(database.pool, chain.client);

    await indexer.pollOnce();
    expect(database.cursor()).toBe(2000n);
    expect(database.updates).toEqual(["2000"]);
    expect(chain.ranges).toHaveLength(11);
    expect(chain.ranges[0].toBlock - chain.ranges[0].fromBlock + 1n).toBe(1000n);
    expect(chain.ranges.slice(1).every(({ fromBlock, toBlock }) => toBlock - fromBlock + 1n <= 100n)).toBe(true);
    expect(indexerStatus.snapshot()).toMatchObject({ status: "idle", indexedThroughBlock: "1999", lastError: null });

    chain.ranges.length = 0;
    await indexer.pollOnce();
    expect(database.cursor()).toBe(3000n);
    expect(chain.ranges).toHaveLength(10);
    expect(chain.ranges[0]).toEqual({ fromBlock: 2000n, toBlock: 2099n });
  });

  test("does not advance the database cursor when the provider call fails", async () => {
    log = mockLogger();
    const database = mockDatabase();
    const chain = mockChain(() => { throw new Error("provider unavailable"); });
    const indexer = new GlidepathIndexer(database.pool, chain.client);

    await expect(indexer.pollOnce()).rejects.toThrow("provider unavailable");
    expect(database.cursor()).toBe(1000n);
    expect(database.updates).toHaveLength(0);
    expect(indexerStatus.snapshot()).toMatchObject({ status: "error", nextBlock: "1000", lastError: "Error" });
  });

  test("keeps pool-swap cursors advancing by the configured batch after learning an RPC cap", async () => {
    log = mockLogger();
    const poolId = `0x${"11".repeat(32)}`;
    const database = mockDatabase(1000n, [{ pool_id: poolId, launch_block_number: "1000" }]);
    let rejectsOversizedRange = true;
    const chain = mockChain(({ fromBlock, toBlock }) => {
      if (toBlock - fromBlock + 1n > 100n) {
        if (rejectsOversizedRange) {
          rejectsOversizedRange = false;
          throw { name: "RpcRequestError", details: "ranges over 100 blocks are not supported on free plan" };
        }
        throw new Error("Indexer requested an oversized RPC range");
      }
      return [];
    });
    const indexer = new GlidepathIndexer(database.pool, chain.client);

    await indexer.pollOnce();
    expect(database.poolCursor(poolId)).toBe(2000n);
    await indexer.pollOnce();
    expect(database.poolCursor(poolId)).toBe(3000n);
  });
});
