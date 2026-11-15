import type { Pool, PoolClient } from "pg";
import {
  decodeEventLog,
  getAddress,
  type Address,
  type Log,
  type PublicClient,
} from "viem";
import { indexedEvents, hookReadAbi, tokenReadAbi } from "../chain/abi";
import { config } from "../config";
import { indexerStatus } from "./status";

const INDEXER_NAME = "glidepath-launches-v1";
const HOOK_ADDRESS = config.GLIDEPATH_HOOK_ADDRESS;
const FACTORY_ADDRESS = config.GLIDEPATH_FACTORY_ADDRESS;

type TaxPath = {
  startPips: bigint | number;
  floorPips: bigint | number;
  stepPips: bigint | number;
  holdSeconds: bigint | number;
  stepIntervalSeconds: bigint | number;
};

type OnchainLaunchConfig = {
  registered: boolean;
  creator: Address;
  quoteCurrency: Address;
  tradingOpensAt: bigint;
  buyPath: TaxPath;
  sellPath: TaxPath;
  creatorBuyCeilingPips: bigint | number;
  creatorSellCeilingPips: bigint | number;
  snipe: { mode: bigint | number; startPips: bigint | number; durationSeconds: bigint | number };
  snipeEnded: boolean;
  payoutRecipients: readonly Address[];
  payoutWeightsBps: readonly (bigint | number)[];
};

type DecodedEvent = {
  log: Log;
  eventName: string;
  args: Record<string, unknown>;
  poolId: string | null;
  tokenAddress: string | null;
};

type IndexedLaunch = {
  tokenAddress: string;
  poolId: string;
  creatorAddress: string;
  quoteCurrency: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalSupply: string;
  liquidityTokenAmount: string;
  liquidityQuoteAmount: string;
  creatorFirstBuyTokenAmount: string;
  creatorFirstBuyQuoteAmount: string;
  sqrtPriceX96: string;
  tradingOpensAt: string;
  buyPath: string;
  sellPath: string;
  creatorBuyCeilingPips: number;
  creatorSellCeilingPips: number;
  snipeConfig: string;
  snipeEnded: boolean;
  payoutRecipients: string;
  payoutWeightsBps: string;
  launchBlockNumber: string;
  launchBlockTimestamp: string;
  launchTransactionHash: string;
  launchLogIndex: number;
};

function jsonString(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === "bigint" ? entry.toString() : entry,
  );
}

function numeric(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function decode(log: Log): DecodedEvent | null {
  try {
    const event = decodeEventLog({
      abi: indexedEvents,
      data: log.data,
      topics: log.topics,
      strict: false,
    });
    const args = event.args as Record<string, unknown>;
    const poolIdValue = args.poolId;
    const tokenValue = args.token;
    return {
      log,
      eventName: event.eventName,
      args,
      poolId: typeof poolIdValue === "string" ? poolIdValue.toLowerCase() : null,
      tokenAddress:
        typeof tokenValue === "string" && tokenValue.startsWith("0x")
          ? getAddress(tokenValue).toLowerCase()
          : null,
    };
  } catch {
    return null;
  }
}

async function readLaunch(
  publicClient: PublicClient,
  event: DecodedEvent,
  blockTimestamp: bigint,
): Promise<IndexedLaunch | null> {
  const args = event.args;
  if (
    event.eventName !== "LaunchCreated" ||
    event.log.blockNumber === null ||
    event.log.logIndex === null ||
    !event.log.transactionHash ||
    !event.poolId ||
    !event.tokenAddress
  ) {
    return null;
  }

  const tokenAddress = getAddress(event.tokenAddress);
  const poolId = event.poolId as `0x${string}`;
  const [rawConfig, tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
    publicClient.readContract({
      address: HOOK_ADDRESS,
      abi: hookReadAbi,
      functionName: "launchConfig",
      args: [poolId],
    }),
    publicClient.readContract({ address: tokenAddress, abi: tokenReadAbi, functionName: "name" }),
    publicClient.readContract({ address: tokenAddress, abi: tokenReadAbi, functionName: "symbol" }),
    publicClient.readContract({ address: tokenAddress, abi: tokenReadAbi, functionName: "decimals" }),
  ]);
  const launchConfig = rawConfig as unknown as OnchainLaunchConfig;
  if (!launchConfig.registered) return null;

  return {
    tokenAddress: tokenAddress.toLowerCase(),
    poolId,
    creatorAddress: getAddress(String(args.creator)).toLowerCase(),
    quoteCurrency: getAddress(String(args.quoteCurrency)).toLowerCase(),
    tokenName,
    tokenSymbol,
    tokenDecimals,
    totalSupply: String(args.totalSupply),
    liquidityTokenAmount: String(args.liquidityTokenAmount),
    liquidityQuoteAmount: String(args.liquidityQuoteAmount),
    creatorFirstBuyTokenAmount: String(args.creatorFirstBuyTokenAmount),
    creatorFirstBuyQuoteAmount: String(args.creatorFirstBuyQuoteAmount),
    sqrtPriceX96: String(args.sqrtPriceX96),
    tradingOpensAt: String(launchConfig.tradingOpensAt),
    buyPath: jsonString(launchConfig.buyPath),
    sellPath: jsonString(launchConfig.sellPath),
    creatorBuyCeilingPips: numeric(launchConfig.creatorBuyCeilingPips),
    creatorSellCeilingPips: numeric(launchConfig.creatorSellCeilingPips),
    snipeConfig: jsonString(launchConfig.snipe),
    snipeEnded: launchConfig.snipeEnded,
    payoutRecipients: jsonString(launchConfig.payoutRecipients),
    payoutWeightsBps: jsonString(launchConfig.payoutWeightsBps),
    launchBlockNumber: event.log.blockNumber.toString(),
    launchBlockTimestamp: blockTimestamp.toString(),
    launchTransactionHash: event.log.transactionHash,
    launchLogIndex: event.log.logIndex,
  };
}

async function saveLaunch(client: PoolClient, launch: IndexedLaunch): Promise<void> {
  await client.query(
    `INSERT INTO launches (
      chain_id, token_address, pool_id, creator_address, quote_currency,
      token_name, token_symbol, token_decimals, total_supply,
      liquidity_token_amount, liquidity_quote_amount,
      creator_first_buy_token_amount, creator_first_buy_quote_amount,
      sqrt_price_x96, trading_opens_at, buy_path, sell_path,
      creator_buy_ceiling_pips, creator_sell_ceiling_pips, snipe_config,
      snipe_ended, payout_recipients, payout_weights_bps,
      launch_block_number, launch_block_timestamp, launch_transaction_hash,
      launch_log_index
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
      $15, $16::jsonb, $17::jsonb, $18, $19, $20::jsonb, $21, $22::jsonb,
      $23::jsonb, $24, $25, $26, $27
    )
    ON CONFLICT (chain_id, token_address) DO UPDATE SET
      pool_id = EXCLUDED.pool_id,
      creator_address = EXCLUDED.creator_address,
      quote_currency = EXCLUDED.quote_currency,
      token_name = EXCLUDED.token_name,
      token_symbol = EXCLUDED.token_symbol,
      token_decimals = EXCLUDED.token_decimals,
      total_supply = EXCLUDED.total_supply,
      liquidity_token_amount = EXCLUDED.liquidity_token_amount,
      liquidity_quote_amount = EXCLUDED.liquidity_quote_amount,
      creator_first_buy_token_amount = EXCLUDED.creator_first_buy_token_amount,
      creator_first_buy_quote_amount = EXCLUDED.creator_first_buy_quote_amount,
      sqrt_price_x96 = EXCLUDED.sqrt_price_x96,
      trading_opens_at = EXCLUDED.trading_opens_at,
      buy_path = EXCLUDED.buy_path,
      sell_path = EXCLUDED.sell_path,
      creator_buy_ceiling_pips = EXCLUDED.creator_buy_ceiling_pips,
      creator_sell_ceiling_pips = EXCLUDED.creator_sell_ceiling_pips,
      snipe_config = EXCLUDED.snipe_config,
      snipe_ended = EXCLUDED.snipe_ended,
      payout_recipients = EXCLUDED.payout_recipients,
      payout_weights_bps = EXCLUDED.payout_weights_bps,
      launch_block_number = EXCLUDED.launch_block_number,
      launch_block_timestamp = EXCLUDED.launch_block_timestamp,
      launch_transaction_hash = EXCLUDED.launch_transaction_hash,
      launch_log_index = EXCLUDED.launch_log_index,
      indexed_at = now()`,
    [
      config.RHC_CHAIN_ID,
      launch.tokenAddress,
      launch.poolId,
      launch.creatorAddress,
      launch.quoteCurrency,
      launch.tokenName,
      launch.tokenSymbol,
      launch.tokenDecimals,
      launch.totalSupply,
      launch.liquidityTokenAmount,
      launch.liquidityQuoteAmount,
      launch.creatorFirstBuyTokenAmount,
      launch.creatorFirstBuyQuoteAmount,
      launch.sqrtPriceX96,
      launch.tradingOpensAt,
      launch.buyPath,
      launch.sellPath,
      launch.creatorBuyCeilingPips,
      launch.creatorSellCeilingPips,
      launch.snipeConfig,
      launch.snipeEnded,
      launch.payoutRecipients,
      launch.payoutWeightsBps,
      launch.launchBlockNumber,
      launch.launchBlockTimestamp,
      launch.launchTransactionHash,
      launch.launchLogIndex,
    ],
  );
}

export class GlidepathIndexer {
  constructor(
    private readonly db: Pool,
    private readonly publicClient: PublicClient,
  ) {
    indexerStatus.configure(config.RHC_CHAIN_ID);
  }

  async pollOnce(): Promise<void> {
    const client = await this.db.connect();
    let lockAcquired = false;
    try {
      const lock = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [config.RHC_CHAIN_ID],
      );
      lockAcquired = lock.rows[0]?.locked === true;
      if (!lockAcquired) return;

      await client.query(
        `INSERT INTO chain_indexer_state (chain_id, indexer_name, next_block)
         VALUES ($1, $2, $3) ON CONFLICT (chain_id, indexer_name) DO NOTHING`,
        [config.RHC_CHAIN_ID, INDEXER_NAME, config.RHC_DEPLOYMENT_BLOCK.toString()],
      );
      const cursorResult = await client.query<{ next_block: string }>(
        "SELECT next_block FROM chain_indexer_state WHERE chain_id = $1 AND indexer_name = $2",
        [config.RHC_CHAIN_ID, INDEXER_NAME],
      );
      const fromBlock = BigInt(cursorResult.rows[0].next_block);
      const head = await this.publicClient.getBlockNumber();
      const confirmations = BigInt(config.INDEXER_CONFIRMATIONS);
      const finalizedHead = head > confirmations ? head - confirmations : 0n;
      if (fromBlock > finalizedHead) {
        indexerStatus.complete(fromBlock, null);
        return;
      }

      const toBlock = fromBlock + BigInt(config.INDEXER_BLOCK_RANGE) - 1n;
      const endBlock = toBlock < finalizedHead ? toBlock : finalizedHead;
      indexerStatus.begin(fromBlock);
      const logs = await this.publicClient.getLogs({
        address: [FACTORY_ADDRESS, HOOK_ADDRESS],
        fromBlock,
        toBlock: endBlock,
      });

      const events = logs.flatMap((log) => {
        const event = decode(log);
        return event ? [event] : [];
      });
      const blockNumbers = [
        ...new Set(
          events
            .map((event) => event.log.blockNumber)
            .filter((blockNumber): blockNumber is bigint => typeof blockNumber === "bigint")
            .map((blockNumber) => blockNumber.toString()),
        ),
      ];
      const timestamps = new Map<string, bigint>();
      await Promise.all(
        blockNumbers.map(async (blockNumber) => {
          const block = await this.publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
          timestamps.set(blockNumber, block.timestamp);
        }),
      );
      const launches: IndexedLaunch[] = [];
      for (const event of events) {
        const timestamp = event.log.blockNumber
          ? timestamps.get(event.log.blockNumber.toString())
          : undefined;
        const launch = await readLaunch(this.publicClient, event, timestamp ?? 0n);
        if (launch) launches.push(launch);
      }

      await client.query("BEGIN");
      try {
        for (const event of events) {
          const blockNumber = event.log.blockNumber;
          const blockTimestamp = blockNumber
            ? (timestamps.get(blockNumber.toString()) ?? 0n).toString()
            : "0";
          const txHash = event.log.transactionHash;
          const logIndex = event.log.logIndex;
          if (blockNumber === null || !txHash || logIndex === null) continue;
          await client.query(
            `INSERT INTO launch_events (
              chain_id, transaction_hash, log_index, block_number,
              block_timestamp, contract_address, event_name, pool_id,
              token_address, args
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
            ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING`,
            [
              config.RHC_CHAIN_ID,
              txHash,
              logIndex,
              blockNumber.toString(),
              blockTimestamp,
              event.log.address.toLowerCase(),
              event.eventName,
              event.poolId,
              event.tokenAddress,
              jsonString(event.args),
            ],
          );
          if (event.eventName === "CreatorTaxCeilingLowered" && event.poolId) {
            const newPips = Number(event.args.newPips);
            if (Number.isSafeInteger(newPips)) {
              const column = event.args.isBuy === true
                ? "creator_buy_ceiling_pips"
                : "creator_sell_ceiling_pips";
              await client.query(
                `UPDATE launches SET ${column} = $3, indexed_at = now()
                 WHERE chain_id = $1 AND pool_id = $2`,
                [config.RHC_CHAIN_ID, event.poolId, newPips],
              );
            }
          } else if (event.eventName === "SnipeEndedEarly" && event.poolId) {
            await client.query(
              `UPDATE launches SET snipe_ended = true, indexed_at = now()
               WHERE chain_id = $1 AND pool_id = $2`,
              [config.RHC_CHAIN_ID, event.poolId],
            );
          }
        }
        for (const launch of launches) await saveLaunch(client, launch);
        await client.query(
          `UPDATE chain_indexer_state SET next_block = $3, updated_at = now()
           WHERE chain_id = $1 AND indexer_name = $2`,
          [config.RHC_CHAIN_ID, INDEXER_NAME, (endBlock + 1n).toString()],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      indexerStatus.complete(endBlock + 1n, endBlock);
    } finally {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock($1)", [config.RHC_CHAIN_ID]);
      }
      client.release();
    }
  }
}

export function startIndexer(db: Pool, publicClient: PublicClient): () => Promise<void> {
  const indexer = new GlidepathIndexer(db, publicClient);
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = indexer
      .pollOnce()
      .catch((error: unknown) => {
        indexerStatus.fail(error);
        const name = error instanceof Error ? error.name : "UnknownError";
        console.error(`Robinhood indexer poll failed (${name})`);
      })
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, config.INDEXER_POLL_INTERVAL_MS);
  run();
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (inFlight) await inFlight;
  };
}
