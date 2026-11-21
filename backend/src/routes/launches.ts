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
        `SELECT launches.token_address, launches.pool_id, launches.creator_address, launches.quote_currency,
                launches.token_name, launches.token_symbol, launches.token_decimals, launches.total_supply,
                launches.liquidity_token_amount, launches.liquidity_quote_amount,
                launches.creator_first_buy_token_amount, launches.creator_first_buy_quote_amount,
                launches.sqrt_price_x96, launches.trading_opens_at, launches.buy_path, launches.sell_path,
                launches.creator_buy_ceiling_pips, launches.creator_sell_ceiling_pips,
                launches.snipe_config, launches.snipe_ended, launches.payout_recipients,
                launches.payout_weights_bps, launches.launch_block_number,
                launches.launch_block_timestamp, launches.launch_transaction_hash,
                token_images.image_url AS image_url
         FROM launches LEFT JOIN launch_token_images AS token_images
           ON token_images.chain_id = launches.chain_id AND token_images.token_address = launches.token_address
         WHERE launches.chain_id = $1
         ORDER BY launches.launch_block_number DESC, launches.launch_log_index DESC
         LIMIT $2`,
        [config.RHC_CHAIN_ID, parsedLimit],
      );
      const launches = result.rows as Array<Record<string, unknown> & { pool_id: `0x${string}` }>;
      const taxCalls = launches.flatMap((launch) => ["buyTaxNow", "sellTaxNow"].map((functionName) => ({
        address: config.GLIDEPATH_HOOK_ADDRESS,
        abi: hookReadAbi,
        functionName,
        args: [launch.pool_id],
      })));
      const taxResults = (taxCalls.length
        ? await publicClient.multicall({
          contracts: taxCalls as never,
          allowFailure: true,
          multicallAddress: "0xca11bde05977b3631167028862be2a173976ca11",
        })
        : []) as unknown as Array<{ status: string; result?: unknown }>;
      response.json({
        data: launches.map((launch, index) => ({
          ...launch,
          buy_tax_pips: taxResults[index * 2]?.status === "success" ? Number(taxResults[index * 2].result) : null,
          sell_tax_pips: taxResults[index * 2 + 1]?.status === "success" ? Number(taxResults[index * 2 + 1].result) : null,
        })),
      });
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

  router.get("/:tokenAddress/chart", async (request, response) => {
    const tokenAddress = request.params.tokenAddress;
    const bucketSeconds: Record<string, number> = { "5m": 300, "1h": 3600, "4h": 14400, "1d": 86400 };
    const requestedIntervals = Array.isArray(request.query.interval)
      ? request.query.interval
      : [request.query.interval ?? "5m"];
    const interval = requestedIntervals
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase())
      .find((value) => Object.hasOwn(bucketSeconds, value));
    if (!isAddress(tokenAddress)) {
      response.status(400).json({ error: "tokenAddress must be an EVM address" });
      return;
    }
    if (!interval) {
      response.status(400).json({ error: "interval must be one of 5m, 1h, 4h, 1d" });
      return;
    }
    try {
      const launchResult = await db.query<{
        pool_id: string; quote_currency: string; sqrt_price_x96: string; launch_block_timestamp: string;
      }>(
        `SELECT pool_id, quote_currency, sqrt_price_x96, launch_block_timestamp FROM launches
         WHERE chain_id = $1 AND token_address = $2`,
        [config.RHC_CHAIN_ID, getAddress(tokenAddress).toLowerCase()],
      );
      if (!launchResult.rowCount) {
        response.status(404).json({ error: "launch not found" });
        return;
      }
      const launch = launchResult.rows[0];
      if (!/^0x0{40}$/i.test(launch.quote_currency)) {
        response.status(422).json({ error: "chart currently supports native ETH quote pools" });
        return;
      }
      const swaps = await db.query<{
        block_timestamp: string; block_number: string; log_index: number; sqrt_price_x96: string; amount0: string;
      }>(
        `SELECT block_timestamp, sqrt_price_x96, amount0 FROM (
           SELECT block_timestamp, block_number, log_index, sqrt_price_x96, amount0 FROM pool_swaps
           WHERE chain_id = $1 AND pool_id = $2
           ORDER BY block_timestamp DESC, block_number DESC, log_index DESC LIMIT 20000
         ) recent_swaps ORDER BY block_timestamp, block_number, log_index`,
        [config.RHC_CHAIN_ID, launch.pool_id],
      );
      const points = [
        ...swaps.rows.map((swap) => ({
          timestamp: Number(swap.block_timestamp), sqrt: swap.sqrt_price_x96,
          volume: Math.abs(Number(swap.amount0)) / 1e18,
        })),
      ].filter((point) => Number.isFinite(point.timestamp) && point.timestamp > 0);
      const intervalSeconds = bucketSeconds[interval];
      const candles = new Map<number, { time: number; open: number; high: number; low: number; close: number; volume: number }>();
      for (const point of points) {
        const sqrt = Number(point.sqrt) / 2 ** 96;
        const price = 1 / (sqrt * sqrt);
        if (!Number.isFinite(price) || price <= 0) continue;
        const time = Math.floor(point.timestamp / intervalSeconds) * intervalSeconds;
        const candle = candles.get(time);
        if (!candle) candles.set(time, { time, open: price, high: price, low: price, close: price, volume: point.volume });
        else {
          candle.high = Math.max(candle.high, price);
          candle.low = Math.min(candle.low, price);
          candle.close = price;
          candle.volume += point.volume;
        }
      }
      response.json({ data: [...candles.values()], interval, indexed_swaps: swaps.rowCount ?? 0 });
    } catch {
      response.status(503).json({ error: "pool chart is temporarily unavailable" });
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
        `SELECT launches.*, token_images.image_url AS image_url
         FROM launches LEFT JOIN launch_token_images AS token_images
           ON token_images.chain_id = launches.chain_id AND token_images.token_address = launches.token_address
         WHERE launches.chain_id = $1 AND launches.token_address = $2`,
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
