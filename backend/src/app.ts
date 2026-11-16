import express from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { healthRouter } from "./routes/health";
import { createReadinessRouter } from "./routes/ready";
import { createLaunchRouter } from "./routes/launches";
import { db } from "./db";
import { publicClient } from "./chain/client";
import { indexerStatus } from "./indexer/status";
import { config } from "./config";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
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
app.use((request, response, next) => {
  const masterKey = config.MASTER_API_KEY;
  if (!masterKey) {
    response.status(503).json({ error: "API authentication is not configured" });
    return;
  }

  const authorization = request.get("authorization");
  const suppliedKey = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!suppliedKey) {
    response.status(401).json({ error: "A valid bearer token is required" });
    return;
  }

  const expectedDigest = createHash("sha256").update(masterKey).digest();
  const suppliedDigest = createHash("sha256").update(suppliedKey).digest();
  if (!timingSafeEqual(expectedDigest, suppliedDigest)) {
    response.status(401).json({ error: "A valid bearer token is required" });
    return;
  }
  next();
});
app.use("/ready", createReadinessRouter(db, publicClient));
app.use("/api/v1/launches", createLaunchRouter(db, publicClient));
app.get("/api/v1/indexer", (_request, response) => response.json(indexerStatus.snapshot()));
