import { Router } from "express";
import type { Pool } from "pg";
import type { PublicClient } from "viem";
import { config } from "../config";

export function createReadinessRouter(db: Pool, publicClient: PublicClient) {
  const router = Router();
  router.get("/", async (_request, response) => {
    try {
      await db.query("SELECT 1");
      const chainId = await publicClient.getChainId();
      if (chainId !== config.RHC_CHAIN_ID) {
        response.status(503).json({ status: "unavailable", dependency: "chain" });
        return;
      }
      response.json({ status: "ready", chainId });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });
  return router;
}
