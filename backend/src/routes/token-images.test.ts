import { describe, expect, test } from "bun:test";
import express from "express";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Pool } from "pg";
import { config } from "../config";
import { tokenImageAuthorizationMessage, tokenImageSha256 } from "../media/cloudinary";
import { createTokenImageRouter } from "./token-images";

process.env.DATABASE_URL ??= "postgres://unit:unit@127.0.0.1:5432/unit";
process.env.RHC_RPC_URL ??= "http://127.0.0.1:8545";
process.env.MASTER_API_KEY ??= "unit-test-master-api-key-with-more-than-32-characters";
process.env.GLIDEPATH_FACTORY_ADDRESS ??= "0x69531E368B9236c2ed7c6da054e8705506c7FA8d";
process.env.GLIDEPATH_HOOK_ADDRESS ??= "0xd9C3FA83fdeDe47784a9FC62ECf11A4FBd24AaCc";

const account = privateKeyToAccount(`0x${"01".repeat(32)}`);
const token = "0x00000000000000000000000000000000000000ab" as Address;
const poolId = `0x${"11".repeat(32)}` as Hex;
const transactionHash = `0x${"22".repeat(32)}` as Hex;
const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const launchAbi = parseAbi([
  "event LaunchCreated(address indexed token, bytes32 indexed poolId, address indexed creator, address quoteCurrency, uint256 totalSupply, uint256 liquidityTokenAmount, uint256 liquidityQuoteAmount, uint256 creatorFirstBuyTokenAmount, uint256 creatorFirstBuyQuoteAmount, uint160 sqrtPriceX96)",
]);
const launchTopics = encodeEventTopics({
  abi: launchAbi,
  eventName: "LaunchCreated",
  args: { token, poolId, creator: account.address },
});
const launchData = encodeAbiParameters(
  [
    { type: "address" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint160" },
  ],
  ["0x0000000000000000000000000000000000000000", 1n, 1n, 0n, 0n, 1n],
);

async function withImageRoute(
  existingImage = false,
  onChainCalls: { transaction?: () => void; receipt?: () => void } = {},
  run: (base: string, dbCalls: string[]) => Promise<void>,
) {
  const dbCalls: string[] = [];
  const db = {
    query: async (sql: string) => {
      dbCalls.push(sql);
      if (sql.includes("SELECT creator_address, image_url")) {
          return { rows: existingImage ? [{ creator_address: account.address.toLowerCase(), image_url: "https://res.cloudinary.com/test/image/upload/existing.png", image_sha256: tokenImageSha256(image) }] : [], rowCount: existingImage ? 1 : 0 };
      }
      return { rows: [{ image_url: "https://res.cloudinary.com/test/image/upload/saved.png" }], rowCount: 1 };
    },
  };
  const chain = {
    getTransaction: async () => { onChainCalls.transaction?.(); return { to: config.GLIDEPATH_FACTORY_ADDRESS, from: account.address }; },
    getTransactionReceipt: async () => {
      onChainCalls.receipt?.();
      return {
        status: "success",
        logs: [{ address: config.GLIDEPATH_FACTORY_ADDRESS, topics: launchTopics, data: launchData }],
      };
    },
  };
  const app = express();
  app.use("/api/v1/launches", createTokenImageRouter(
    db as unknown as Pool,
    chain as unknown as PublicClient,
    async () => ({ publicId: "glidy/tokens/test", imageUrl: "https://res.cloudinary.com/test/image/upload/saved.png" }),
  ));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an ephemeral listener");
  try {
    await run(`http://127.0.0.1:${address.port}`, dbCalls);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("creator-authorized token image endpoint", () => {
  test("stores a valid image bound to the creator's successful launch transaction", async () => {
    let uploadCount = 0;
    await withImageRoute(false, {}, async (base, dbCalls) => {
      const digest = tokenImageSha256(image);
      const message = tokenImageAuthorizationMessage(4663, token, transactionHash, digest);
      const signature = await account.signMessage({ message });
      const response = await fetch(`${base}/api/v1/launches/${token}/image`, {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Glidy-Creator": account.address,
          "X-Glidy-Launch-Tx": transactionHash,
          "X-Glidy-Image-Signature": signature,
        },
        body: image,
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ data: { image_url: "https://res.cloudinary.com/test/image/upload/saved.png" } });
      expect(dbCalls.some((sql) => sql.includes("INSERT INTO launch_token_images"))).toBe(true);
      uploadCount++;
    });
    expect(uploadCount).toBe(1);
  });

  test("rejects invalid file bytes and mismatched wallet signatures before chain or storage work", async () => {
    let chainCalls = 0;
    await withImageRoute(false, { transaction: () => { chainCalls++; }, receipt: () => { chainCalls++; } }, async (base, dbCalls) => {
      const invalid = await fetch(`${base}/api/v1/launches/${token}/image`, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: new TextEncoder().encode("not png"),
      });
      expect(invalid.status).toBe(415);
      const other = privateKeyToAccount(`0x${"02".repeat(32)}`);
      const digest = tokenImageSha256(image);
      const wrongSignature = await other.signMessage({
        message: tokenImageAuthorizationMessage(4663, token, transactionHash, digest),
      });
      const unauthorized = await fetch(`${base}/api/v1/launches/${token}/image`, {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Glidy-Creator": account.address,
          "X-Glidy-Launch-Tx": transactionHash,
          "X-Glidy-Image-Signature": wrongSignature,
        },
        body: image,
      });
      expect(unauthorized.status).toBe(403);
      expect(chainCalls).toBe(0);
      expect(dbCalls).toHaveLength(0);
    });
  });

  test("returns the existing image idempotently to the creator", async () => {
    let chainCalls = 0;
    await withImageRoute(true, { transaction: () => { chainCalls++; }, receipt: () => { chainCalls++; } }, async (base) => {
      const digest = tokenImageSha256(image);
      const signature = await account.signMessage({
        message: tokenImageAuthorizationMessage(4663, token, transactionHash, digest),
      });
      const response = await fetch(`${base}/api/v1/launches/${token}/image`, {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Glidy-Creator": account.address,
          "X-Glidy-Launch-Tx": transactionHash,
          "X-Glidy-Image-Signature": signature,
        },
        body: image,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { image_url: "https://res.cloudinary.com/test/image/upload/existing.png" } });
      expect(chainCalls).toBe(2);
    });
  });
});
