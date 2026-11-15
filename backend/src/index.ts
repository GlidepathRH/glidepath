import "dotenv/config";
import { app } from "./app";
import { db } from "./db";
import { migrate } from "./db/migrate";

const port = Number(process.env.PORT ?? 3001);

await migrate();
const server = app.listen(port, () => {
  console.info(`Glidepath API listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void db.end().finally(() => process.exit(0));
    });
  });
}
