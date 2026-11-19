/** Display-only event seam. Use integer/decimal chain units in the backend adapter. */
export type MarketId = `0x${string}`;
interface Envelope {
  id: MarketId;
  sequence: number;
  at: number;
}
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface Trade {
  id: string;
  timestamp: number;
  side: "buy" | "sell";
  priceQuote: number;
  volumeQuote: number;
  txHash: string | null;
  simulated?: boolean;
}
export interface HolderRisk {
  simulated: boolean;
  top10Bps: number;
  bundledBps: number;
  holders: Array<{ id: string; label: string; shareBps: number }>;
  groups: Array<{
    id: string;
    walletCount: number;
    shareBps: number;
    signal: string;
  }>;
}
export type MarketEvent = Envelope &
  (
    | {
        type: "market.tick";
        values: Partial<
          Record<
            | "priceUsd"
            | "priceQuote"
            | "marketCap"
            | "volume24h"
            | "change24h"
            | "changeSinceLaunch"
            | "progress",
            number
          >
        >;
      }
    | { type: "candle.upsert"; candle: Candle }
    | { type: "trade.append"; trade: Trade }
    | { type: "launch.stage"; stage: "curve" | "graduated" }
    | { type: "risk.updated"; risk: HolderRisk }
  );
export interface MarketSource {
  start(): void;
  stop(): void;
  replay?(): void;
}
