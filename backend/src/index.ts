import "dotenv/config";
import { app } from "./app";
import { db } from "./db";
import { migrate } from "./db/migrate";
import { publicClient } from "./chain/client";
import { startIndexer } from "./indexer/worker";
import { config } from "./config";

const port = Number(process.env.PORT ?? 3001);

console.info(JSON.stringify({
  level: "info",
  event: "backend.starting",
  version: "0.1.0",
  commit: process.env.APP_COMMIT_SHA ?? "unknown",
  chainId: config.RHC_CHAIN_ID,
  factory: config.GLIDEPATH_FACTORY_ADDRESS,
  hook: config.GLIDEPATH_HOOK_ADDRESS,
  deploymentBlock: config.RHC_DEPLOYMENT_BLOCK.toString(),
  configuredIndexerBatchBlocks: config.INDEXER_BLOCK_RANGE,
  indexerPollIntervalMs: config.INDEXER_POLL_INTERVAL_MS,
}));
await migrate();
console.info(JSON.stringify({ level: "info", event: "backend.migrations_complete" }));
const stopIndexer = startIndexer(db, publicClient);
const server = app.listen(port, () => {
  console.info(JSON.stringify({ level: "info", event: "backend.listening", port }));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void stopIndexer()
        .then(() => db.end())
        .finally(() => process.exit(0));
    });
  });
}
