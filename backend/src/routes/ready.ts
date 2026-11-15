import { Router } from "express";
import type { Pool } from "pg";

export function createReadinessRouter(db: Pool) {
  const router = Router();
  router.get("/", async (_request, response) => {
    try {
      await db.query("SELECT 1");
      response.json({ status: "ready" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });
  return router;
}
