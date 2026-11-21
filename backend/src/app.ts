import express from "express";
import { healthRouter } from "./routes/health";
import { createReadinessRouter } from "./routes/ready";
import { createLaunchRouter } from "./routes/launches";
import { createTokenImageRouter } from "./routes/token-images";
import { db } from "./db";
import { publicClient } from "./chain/client";
import { indexerStatus } from "./indexer/status";
import { config } from "./config";
import { createMasterApiAuth } from "./middleware/auth";

export const app = express();
app.disable("x-powered-by");
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && config.FRONTEND_URL === origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});
app.use("/health", healthRouter);
app.use(createMasterApiAuth(config.MASTER_API_KEY, db));
app.use(express.json({ limit: "32kb" }));
app.use("/ready", createReadinessRouter(db, publicClient));
app.use("/api/v1/launches", createLaunchRouter(db, publicClient));
app.use("/api/v1/launches", createTokenImageRouter(db, publicClient));
app.get("/api/v1/indexer", (_request, response) => response.json(indexerStatus.snapshot()));
