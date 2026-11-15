import { createPublicClient, defineChain, http } from "viem";
import { config } from "../config";

export const robinhoodChain = defineChain({
  id: config.RHC_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.RHC_RPC_URL] } },
});

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(config.RHC_RPC_URL, { retryCount: 2, timeout: 12_000 }),
});
