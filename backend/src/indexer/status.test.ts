import { describe, expect, test } from "bun:test";
import { indexerStatus } from "./status";

describe("indexer status", () => {
  test("tracks startup, active, completed, and failed polling", () => {
    indexerStatus.configure(4663);
    expect(indexerStatus.snapshot()).toMatchObject({ status: "starting", chainId: 4663, indexedThroughBlock: null });

    indexerStatus.begin(100n);
    expect(indexerStatus.snapshot()).toMatchObject({ status: "syncing", nextBlock: "100", lastError: null });

    indexerStatus.complete(201n, 200n);
    expect(indexerStatus.snapshot()).toMatchObject({ status: "idle", nextBlock: "201", indexedThroughBlock: "200", lastError: null });
    expect(indexerStatus.snapshot().lastPollAt).not.toBeNull();

    indexerStatus.fail(new Error("provider rejected request"));
    expect(indexerStatus.snapshot()).toMatchObject({ status: "error", lastError: "Error", nextBlock: "201", indexedThroughBlock: "200" });
  });

  test("preserves indexed-through block when a poll has no finalized range", () => {
    indexerStatus.complete(301n, 300n);
    indexerStatus.complete(301n, null);
    expect(indexerStatus.snapshot()).toMatchObject({ status: "idle", nextBlock: "301", indexedThroughBlock: "300" });
  });
});
