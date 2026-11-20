import { getAddress, isAddress } from "viem";
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const positiveInteger = (fallback: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : value),
    z.coerce.number().int().positive(),
  );

const configSchema = z.object({
  DATABASE_URL: z.url(),
  RHC_RPC_URL: z.url(),
  MASTER_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32, "must contain at least 32 characters").optional(),
  ),
  FRONTEND_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
  RHC_CHAIN_ID: positiveInteger(4663),
  GLIDEPATH_FACTORY_ADDRESS: nonEmpty
    .refine((value) => isAddress(value, { strict: false }), "must be a 20-byte EVM address")
    .transform((value) => getAddress(value.toLowerCase())),
  GLIDEPATH_HOOK_ADDRESS: nonEmpty
    .refine((value) => isAddress(value, { strict: false }), "must be a 20-byte EVM address")
    .transform((value) => getAddress(value.toLowerCase())),
  GLIDEPATH_POOL_MANAGER_ADDRESS: z.preprocess(
    (value) => value === undefined || value === "" ? "0x8366a39cc670b4001a1121b8f6a443a643e40951" : value,
    z.string().refine((value) => isAddress(value, { strict: false }), "must be a 20-byte EVM address")
      .transform((value) => getAddress(value.toLowerCase())),
  ),
  RHC_DEPLOYMENT_BLOCK: z.preprocess(
    (value) => (value === undefined || value === "" ? "0" : value),
    z.coerce.bigint().nonnegative(),
  ),
  INDEXER_CONFIRMATIONS: positiveInteger(2),
  INDEXER_BLOCK_RANGE: positiveInteger(1000),
  INDEXER_POLL_INTERVAL_MS: positiveInteger(15000),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`);
  throw new Error(`Invalid backend configuration: ${issues.join("; ")}`);
}

export const config = {
  ...parsed.data,
  GLIDEPATH_FACTORY_ADDRESS: parsed.data.GLIDEPATH_FACTORY_ADDRESS as `0x${string}`,
  GLIDEPATH_HOOK_ADDRESS: parsed.data.GLIDEPATH_HOOK_ADDRESS as `0x${string}`,
  GLIDEPATH_POOL_MANAGER_ADDRESS: parsed.data.GLIDEPATH_POOL_MANAGER_ADDRESS as `0x${string}`,
};
