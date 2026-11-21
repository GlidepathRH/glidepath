import { createHash } from "node:crypto";
import { config } from "../config";

export const TOKEN_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const TOKEN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type TokenImageType = (typeof TOKEN_IMAGE_TYPES)[number];

export function isTokenImage(bytes: Uint8Array, contentType: string): contentType is TokenImageType {
  if (contentType === "image/png") {
    return bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12
      && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  return false;
}

export function tokenImageSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function tokenImageAuthorizationMessage(
  chainId: number,
  tokenAddress: string,
  transactionHash: string,
  imageSha256: string,
): string {
  return [
    "GLIDY token image upload",
    `Chain ID: ${chainId}`,
    `Token: ${tokenAddress.toLowerCase()}`,
    `Launch transaction: ${transactionHash.toLowerCase()}`,
    `Image SHA-256: ${imageSha256.toLowerCase()}`,
  ].join("\n");
}

export function cloudinaryUploadSignature(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

export async function uploadTokenImage(
  bytes: Uint8Array,
  contentType: TokenImageType,
  tokenAddress: string,
  imageSha256: string,
  fetcher: typeof fetch = fetch,
): Promise<{ publicId: string; imageUrl: string }> {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_SECRET: apiSecret } = config;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Token image storage is not configured.");

  const publicId = `${tokenAddress.slice(2).toLowerCase()}-${imageSha256.slice(0, 16)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { folder: "glidy/tokens", overwrite: "true", public_id: publicId, timestamp };
  const signature = cloudinaryUploadSignature(signedParams, apiSecret);
  const form = new FormData();
  form.set("file", new Blob([bytes.slice()], { type: contentType }), `token.${contentType.split("/")[1]}`);
  form.set("api_key", apiKey);
  for (const [key, value] of Object.entries(signedParams)) form.set(key, value);
  form.set("signature", signature);

  let response: Response;
  try {
    response = await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Image upload to Cloudinary failed. Try again.");
  }
  if (!response.ok) throw new Error("Image upload to Cloudinary failed. Try again.");
  const result = await response.json() as { secure_url?: string; public_id?: string };
  const expectedPrefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!result.secure_url?.startsWith(expectedPrefix) || result.public_id !== `glidy/tokens/${publicId}`) {
    throw new Error("Cloudinary returned an unexpected image URL.");
  }
  const imageUrl = result.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_512,h_512/");
  return { publicId: result.public_id, imageUrl };
}
