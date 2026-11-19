export type IndexerSnapshot = {
  status: "starting" | "syncing" | "idle" | "error";
  chainId: number;
  nextBlock: string | null;
  indexedThroughBlock: string | null;
  lastPollAt: string | null;
  lastError: string | null;
};

export class IndexerStatus {
  #value: IndexerSnapshot = {
    status: "starting",
    chainId: 4663,
    nextBlock: null,
    indexedThroughBlock: null,
    lastPollAt: null,
    lastError: null,
  };

  configure(chainId: number): void {
    this.#value = { ...this.#value, chainId };
  }

  begin(nextBlock: bigint): void {
    this.#value = {
      ...this.#value,
      status: "syncing",
      nextBlock: nextBlock.toString(),
      lastError: null,
    };
  }

  complete(nextBlock: bigint, indexedThroughBlock: bigint | null): void {
    this.#value = {
      ...this.#value,
      status: "idle",
      nextBlock: nextBlock.toString(),
      indexedThroughBlock: indexedThroughBlock?.toString() ?? this.#value.indexedThroughBlock,
      lastPollAt: new Date().toISOString(),
      lastError: null,
    };
  }

  fail(error: unknown): void {
    this.#value = {
      ...this.#value,
      status: "error",
      lastPollAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.name : "UnknownError",
    };
  }

  snapshot(): IndexerSnapshot {
    return { ...this.#value };
  }
}

export const indexerStatus = new IndexerStatus();
