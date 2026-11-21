import { parseAbi } from "viem";

export const poolManagerSwapAbi = parseAbi([
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
]);

export const poolManagerStateAbi = parseAbi([
  "function extsload(bytes32 slot) view returns (bytes32 value)",
]);

export const indexedEvents = parseAbi([
  "event LaunchCreated(address indexed token, bytes32 indexed poolId, address indexed creator, address quoteCurrency, uint256 totalSupply, uint256 liquidityTokenAmount, uint256 liquidityQuoteAmount, uint256 creatorFirstBuyTokenAmount, uint256 creatorFirstBuyQuoteAmount, uint160 sqrtPriceX96)",
  "event PoolRegistered(bytes32 indexed poolId, address indexed creator, address token, address quoteCurrency)",
  "event CreatorTaxCeilingLowered(bytes32 indexed poolId, bool indexed isBuy, uint24 previousPips, uint24 newPips)",
  "event SnipeEndedEarly(bytes32 indexed poolId, address indexed creator)",
  "event FeeAccrued(bytes32 indexed poolId, address indexed quoteCurrency, uint128 totalAmount, uint128 platformAmount, uint128 creatorAmount, uint24 taxPips, bool snipeTax)",
  "event FeesClaimed(address indexed recipient, address indexed currency, uint256 amount)",
]);

const taxPathComponents = [
  { name: "startPips", type: "uint24" },
  { name: "floorPips", type: "uint24" },
  { name: "stepPips", type: "uint24" },
  { name: "holdSeconds", type: "uint32" },
  { name: "stepIntervalSeconds", type: "uint32" },
] as const;

const snipeComponents = [
  { name: "mode", type: "uint8" },
  { name: "startPips", type: "uint24" },
  { name: "durationSeconds", type: "uint32" },
] as const;

export const hookReadAbi = [
  {
    type: "function",
    name: "launchConfig",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "registered", type: "bool" },
          { name: "creator", type: "address" },
          { name: "tokenCurrency", type: "address" },
          { name: "quoteCurrency", type: "address" },
          { name: "tradingOpensAt", type: "uint64" },
          { name: "buyPath", type: "tuple", components: taxPathComponents },
          { name: "sellPath", type: "tuple", components: taxPathComponents },
          { name: "creatorBuyCeilingPips", type: "uint24" },
          { name: "creatorSellCeilingPips", type: "uint24" },
          { name: "snipe", type: "tuple", components: snipeComponents },
          { name: "snipeEnded", type: "bool" },
          { name: "payoutRecipients", type: "address[3]" },
          { name: "payoutWeightsBps", type: "uint16[3]" },
          { name: "lastPayoutRecipient", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "buyTaxNow",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint24" }],
  },
  {
    type: "function",
    name: "sellTaxNow",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint24" }],
  },
] as const;

export const tokenReadAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);
