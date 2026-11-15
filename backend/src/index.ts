import "dotenv/config";
import { app } from "./app";
import { db } from "./db";
import { migrate } from "./db/migrate";
import { publicClient } from "./chain/client";
import { startIndexer } from "./indexer/worker";

const port = Number(process.env.PORT ?? 3001);

await migrate();
const stopIndexer = startIndexer(db, publicClient);
const server = app.listen(port, () => {
  console.info(`Glidepath API listening on port ${port}`);
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
