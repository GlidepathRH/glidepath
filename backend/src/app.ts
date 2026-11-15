import express from "express";
import { healthRouter } from "./routes/health";
import { createReadinessRouter } from "./routes/ready";
import { db } from "./db";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use("/health", healthRouter);
app.use("/ready", createReadinessRouter(db));
