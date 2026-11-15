import { isAddress } from "viem";
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
  FRONTEND_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
  RHC_CHAIN_ID: positiveInteger(4663),
  GLIDEPATH_FACTORY_ADDRESS: nonEmpty.refine(isAddress, "must be an EVM address"),
  GLIDEPATH_HOOK_ADDRESS: nonEmpty.refine(isAddress, "must be an EVM address"),
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
};
