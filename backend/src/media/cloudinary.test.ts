import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL ??= "postgres://unit:unit@127.0.0.1:5432/unit";
process.env.RHC_RPC_URL ??= "http://127.0.0.1:8545";
process.env.MASTER_API_KEY ??= "unit-test-master-api-key-with-more-than-32-characters";
process.env.GLIDEPATH_FACTORY_ADDRESS ??= "0x69531E368B9236c2ed7c6da054e8705506c7FA8d";
process.env.GLIDEPATH_HOOK_ADDRESS ??= "0xd9C3FA83fdeDe47784a9FC62ECf11A4FBd24AaCc";

const { cloudinaryUploadSignature, isTokenImage, tokenImageAuthorizationMessage, tokenImageSha256 } = await import("./cloudinary");

describe("token image uploads", () => {
  test("accepts matching PNG, JPEG, and WebP file signatures only", () => {
    expect(isTokenImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(isTokenImage(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toBe(true);
    expect(isTokenImage(new TextEncoder().encode("RIFFxxxxWEBP"), "image/webp")).toBe(true);
    expect(isTokenImage(new TextEncoder().encode("not an image"), "image/png")).toBe(false);
    expect(isTokenImage(new TextEncoder().encode("RIFFxxxxWEBP"), "image/png")).toBe(false);
    expect(isTokenImage(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg; charset=utf-8")).toBe(false);
  });

  test("binds a signed image authorization to chain, token, launch transaction, and digest", () => {
    const message = tokenImageAuthorizationMessage(4663, "0xAbC", `0x${"11".repeat(32)}`, "AABB");
    expect(message).toContain("Chain ID: 4663");
    expect(message).toContain("Token: 0xabc");
    expect(message).toContain(`Launch transaction: 0x${"11".repeat(32)}`);
    expect(message).toContain("Image SHA-256: aabb");
    expect(tokenImageSha256(new TextEncoder().encode("hello"))).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  test("matches Cloudinary's sorted parameter signature format", () => {
    expect(cloudinaryUploadSignature({ timestamp: "123", folder: "glidy/tokens", public_id: "abc" }, "secret"))
      .toBe(cloudinaryUploadSignature({ public_id: "abc", timestamp: "123", folder: "glidy/tokens" }, "secret"));
  });
});
