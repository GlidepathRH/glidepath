import { Router } from "express";
import type { Pool } from "pg";
import { getAddress, isAddress, type PublicClient } from "viem";
import { hookReadAbi } from "../chain/abi";
import { config } from "../config";

export function createLaunchRouter(db: Pool, publicClient: PublicClient) {
  const router = Router();

  router.get("/", async (request, response) => {
    const parsedLimit = Number(request.query.limit ?? 50);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      response.status(400).json({ error: "limit must be an integer from 1 to 100" });
      return;
    }

    try {
      const result = await db.query(
        `SELECT token_address, pool_id, creator_address, quote_currency,
                token_name, token_symbol, token_decimals, total_supply,
                liquidity_token_amount, liquidity_quote_amount,
                creator_first_buy_token_amount, creator_first_buy_quote_amount,
                sqrt_price_x96, trading_opens_at, buy_path, sell_path,
                creator_buy_ceiling_pips, creator_sell_ceiling_pips,
                snipe_config, snipe_ended, payout_recipients,
                payout_weights_bps, launch_block_number,
                launch_block_timestamp, launch_transaction_hash
         FROM launches WHERE chain_id = $1
         ORDER BY launch_block_number DESC, launch_log_index DESC
         LIMIT $2`,
        [config.RHC_CHAIN_ID, parsedLimit],
      );
      response.json({ data: result.rows });
    } catch {
      response.status(503).json({ error: "launch index is temporarily unavailable" });
    }
  });

  router.get("/:tokenAddress/events", async (request, response) => {
    const tokenAddress = request.params.tokenAddress;
    if (!isAddress(tokenAddress)) {
      response.status(400).json({ error: "tokenAddress must be an EVM address" });
      return;
    }

    try {
      const launchResult = await db.query<{ pool_id: string }>(
        "SELECT pool_id FROM launches WHERE chain_id = $1 AND token_address = $2",
        [config.RHC_CHAIN_ID, getAddress(tokenAddress).toLowerCase()],
      );
      if (!launchResult.rowCount) {
        response.status(404).json({ error: "launch not found" });
        return;
      }
      const events = await db.query(
        `SELECT event_name, args, block_number, block_timestamp,
                transaction_hash, log_index, contract_address
         FROM launch_events
         WHERE chain_id = $1 AND pool_id = $2
         ORDER BY block_number DESC, log_index DESC
         LIMIT 200`,
        [config.RHC_CHAIN_ID, launchResult.rows[0].pool_id],
      );
      response.json({ data: events.rows });
    } catch {
      response.status(503).json({ error: "launch event index is temporarily unavailable" });
    }
  });

  router.get("/:tokenAddress", async (request, response) => {
    const tokenAddress = request.params.tokenAddress;
    if (!isAddress(tokenAddress)) {
      response.status(400).json({ error: "tokenAddress must be an EVM address" });
      return;
    }

    try {
      const launchResult = await db.query(
        "SELECT * FROM launches WHERE chain_id = $1 AND token_address = $2",
        [config.RHC_CHAIN_ID, getAddress(tokenAddress).toLowerCase()],
      );
      if (!launchResult.rowCount) {
        response.status(404).json({ error: "launch not found" });
        return;
      }
      const launch = launchResult.rows[0] as { pool_id: `0x${string}` };
      const [buyTaxPips, sellTaxPips] = await Promise.all([
        publicClient.readContract({
          address: config.GLIDEPATH_HOOK_ADDRESS,
          abi: hookReadAbi,
          functionName: "buyTaxNow",
          args: [launch.pool_id],
        }),
        publicClient.readContract({
          address: config.GLIDEPATH_HOOK_ADDRESS,
          abi: hookReadAbi,
          functionName: "sellTaxNow",
          args: [launch.pool_id],
        }),
      ]);
      response.json({
        data: {
          ...launchResult.rows[0],
          buy_tax_pips: Number(buyTaxPips),
          sell_tax_pips: Number(sellTaxPips),
        },
      });
    } catch {
      response.status(503).json({ error: "launch data is temporarily unavailable" });
    }
  });

  return router;
}
