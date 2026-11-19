import { describe, expect, test } from "bun:test";
import { IndexerStatus } from "./status";

describe("indexer status", () => {
  test("tracks startup, active, completed, and failed polling", () => {
    const status = new IndexerStatus();
    status.configure(4663);
    expect(status.snapshot()).toMatchObject({ status: "starting", chainId: 4663, indexedThroughBlock: null });

    status.begin(100n);
    expect(status.snapshot()).toMatchObject({ status: "syncing", nextBlock: "100", lastError: null });

    status.complete(201n, 200n);
    expect(status.snapshot()).toMatchObject({ status: "idle", nextBlock: "201", indexedThroughBlock: "200", lastError: null });
    expect(status.snapshot().lastPollAt).not.toBeNull();

    status.fail(new Error("provider rejected request"));
    expect(status.snapshot()).toMatchObject({ status: "error", lastError: "Error", nextBlock: "201", indexedThroughBlock: "200" });
  });

  test("preserves indexed-through block when a poll has no finalized range", () => {
    const status = new IndexerStatus();
    status.complete(301n, 300n);
    status.complete(301n, null);
    expect(status.snapshot()).toMatchObject({ status: "idle", nextBlock: "301", indexedThroughBlock: "300" });
  });
});
