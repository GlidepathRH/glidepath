import { Router, raw } from "express";
import type { Pool } from "pg";
import {
  decodeEventLog,
  getAddress,
  isAddress,
  recoverMessageAddress,
  type Hex,
  type PublicClient,
} from "viem";
import { indexedEvents } from "../chain/abi";
import { config } from "../config";
import {
  isTokenImage,
  tokenImageAuthorizationMessage,
  tokenImageSha256,
  TOKEN_IMAGE_MAX_BYTES,
  uploadTokenImage,
  type TokenImageType,
} from "../media/cloudinary";

type ImageUploader = (
  bytes: Uint8Array,
  contentType: TokenImageType,
  tokenAddress: string,
  imageSha256: string,
) => Promise<{ publicId: string; imageUrl: string }>;

export function createTokenImageRouter(
  db: Pool,
  publicClient: PublicClient,
  uploader: ImageUploader = uploadTokenImage,
) {
  const router = Router();

  router.post(
    "/:tokenAddress/image",
    raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: TOKEN_IMAGE_MAX_BYTES }),
    async (request, response) => {
      const tokenAddress = request.params.tokenAddress;
      const contentType = request.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
      const bytes = request.body as Buffer | undefined;
      if (!isAddress(tokenAddress)) {
        response.status(400).json({ error: "tokenAddress must be an EVM address" });
        return;
      }
      if (!bytes || !Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > TOKEN_IMAGE_MAX_BYTES || !isTokenImage(bytes, contentType)) {
        response.status(415).json({ error: "Upload a PNG, JPEG, or WebP image up to 2 MB." });
        return;
      }

      const creatorHeader = request.get("x-glidy-creator") ?? "";
      const transactionHash = request.get("x-glidy-launch-tx") ?? "";
      const signature = request.get("x-glidy-image-signature") ?? "";
      if (!isAddress(creatorHeader) || !/^0x[\da-f]{64}$/i.test(transactionHash) || !/^0x[\da-f]+$/i.test(signature)) {
        response.status(400).json({ error: "A creator wallet, launch transaction, and wallet signature are required." });
        return;
      }

      const normalizedToken = getAddress(tokenAddress).toLowerCase();
      const normalizedCreator = getAddress(creatorHeader).toLowerCase();
      const normalizedTransaction = transactionHash.toLowerCase() as Hex;
      const digest = tokenImageSha256(bytes);
      const message = tokenImageAuthorizationMessage(config.RHC_CHAIN_ID, normalizedToken, normalizedTransaction, digest);

      try {
        const recovered = await recoverMessageAddress({ message, signature: signature as Hex });
        if (recovered.toLowerCase() !== normalizedCreator) {
          response.status(403).json({ error: "The wallet signature does not match the launch creator." });
          return;
        }
      } catch {
        response.status(400).json({ error: "The wallet signature is invalid." });
        return;
      }

      try {
        const [transaction, receipt] = await Promise.all([
          publicClient.getTransaction({ hash: normalizedTransaction }),
          publicClient.getTransactionReceipt({ hash: normalizedTransaction }),
        ]);
        if (
          receipt.status !== "success"
          || transaction.to?.toLowerCase() !== config.GLIDEPATH_FACTORY_ADDRESS.toLowerCase()
          || transaction.from.toLowerCase() !== normalizedCreator
        ) {
          response.status(403).json({ error: "The transaction is not a successful launch from this creator wallet." });
          return;
        }

        const launchEvent = receipt.logs
          .filter((log) => log.address.toLowerCase() === config.GLIDEPATH_FACTORY_ADDRESS.toLowerCase())
          .flatMap((log) => {
            try {
              const decoded = decodeEventLog({ abi: indexedEvents, data: log.data, topics: log.topics, strict: false });
              return decoded.eventName === "LaunchCreated"
                ? [decoded.args as { token: string; creator: string }]
                : [];
            } catch {
              return [];
            }
          })
          .find((event) => event.token.toLowerCase() === normalizedToken);
        if (!launchEvent || launchEvent.creator.toLowerCase() !== normalizedCreator) {
          response.status(403).json({ error: "The token was not created by this wallet in the supplied transaction." });
          return;
        }

        const existing = await db.query<{ creator_address: string; image_url: string; image_sha256: string }>(
          "SELECT creator_address, image_url, image_sha256 FROM launch_token_images WHERE chain_id = $1 AND token_address = $2",
          [config.RHC_CHAIN_ID, normalizedToken],
        );
        if (
          existing.rowCount
          && existing.rows[0].creator_address === normalizedCreator
          && existing.rows[0].image_sha256 === digest
        ) {
          response.status(200).json({ data: { image_url: existing.rows[0].image_url } });
          return;
        }
        if (existing.rowCount) {
          response.status(409).json({ error: "This token already has an image." });
          return;
        }

        const uploaded = await uploader(bytes, contentType, normalizedToken, digest);
        const inserted = await db.query<{ image_url: string }>(
          `INSERT INTO launch_token_images (
             chain_id, token_address, creator_address, transaction_hash, cloudinary_public_id, image_url, image_sha256
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (chain_id, token_address) DO NOTHING
           RETURNING image_url`,
          [config.RHC_CHAIN_ID, normalizedToken, normalizedCreator, normalizedTransaction, uploaded.publicId, uploaded.imageUrl, digest],
        );
        if (!inserted.rowCount) {
          response.status(409).json({ error: "This token already has an image." });
          return;
        }
        response.status(201).json({ data: { image_url: inserted.rows[0].image_url } });
      } catch (error) {
        const name = error instanceof Error ? error.message : "";
        if (name === "Token image storage is not configured.") {
          response.status(503).json({ error: name });
          return;
        }
        response.status(502).json({ error: "Token image could not be saved. Try again." });
      }
    },
  );

  return router;
}
