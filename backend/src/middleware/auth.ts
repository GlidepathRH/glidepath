import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
import type { Pool } from "pg";

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_LIMIT = 10;
const RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanupAt = 0;

function clientIp(request: Request): string {
  // Render sends public traffic through Cloudflare, which supplies the client IP.
  const cloudflareIp = request.get("cf-connecting-ip")?.trim();
  if (cloudflareIp && isIP(cloudflareIp)) return cloudflareIp;

  // Render documents X-Forwarded-For for the client IP. Use its first valid entry.
  const forwardedFor = request.get("x-forwarded-for");
  const forwardedIp = forwardedFor
    ?.split(",")
    .map((entry) => entry.trim())
    .find((entry) => isIP(entry));
  if (forwardedIp) return forwardedIp;

  const socketIp = request.socket.remoteAddress;
  return socketIp && isIP(socketIp) ? socketIp : "0.0.0.0";
}

async function recordFailedAttempt(db: Pool, ip: string): Promise<number> {
  const result = await db.query<{ failure_count: number; retry_after_seconds: number }>(
    `INSERT INTO api_auth_rate_limits (client_ip, window_started_at, failure_count)
     VALUES ($1::inet, now(), 1)
     ON CONFLICT (client_ip) DO UPDATE SET
       window_started_at = CASE
         WHEN api_auth_rate_limits.window_started_at <= now() - ($2 * interval '1 millisecond')
           THEN now()
         ELSE api_auth_rate_limits.window_started_at
       END,
       failure_count = CASE
         WHEN api_auth_rate_limits.window_started_at <= now() - ($2 * interval '1 millisecond')
           THEN 1
         ELSE api_auth_rate_limits.failure_count + 1
       END,
       updated_at = now()
     RETURNING failure_count,
       GREATEST(
         0,
         CEIL(EXTRACT(EPOCH FROM (
           window_started_at + ($2 * interval '1 millisecond') - now()
         )))::integer
       ) AS retry_after_seconds`,
    [ip, FAILURE_WINDOW_MS],
  );
  const row = result.rows[0];

  if (row.failure_count <= FAILURE_LIMIT) return 0;
  return Math.max(1, row.retry_after_seconds);
}

function cleanupExpiredBuckets(db: Pool, now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  void db
    .query(
      `DELETE FROM api_auth_rate_limits
       WHERE window_started_at < now() - ($1 * interval '1 millisecond')`,
      [RATE_LIMIT_RETENTION_MS],
    )
    .catch((error: unknown) => {
      const name = error instanceof Error ? error.name : "UnknownError";
      console.error(`API auth rate-limit cleanup failed (${name})`);
    });
}

export function createMasterApiAuth(
  masterKey: string | undefined,
  db: Pool,
): RequestHandler {
  const expectedDigest = masterKey
    ? createHash("sha256").update(masterKey).digest()
    : undefined;

  return async (request, response, next) => {
    const authorization = request.get("authorization");
    const suppliedKey = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const suppliedDigest = suppliedKey
      ? createHash("sha256").update(suppliedKey).digest()
      : undefined;
    const authenticated = Boolean(
      expectedDigest && suppliedDigest && timingSafeEqual(expectedDigest, suppliedDigest),
    );

    if (authenticated) {
      next();
      return;
    }

    const now = Date.now();
    cleanupExpiredBuckets(db, now);
    let retryAfter: number;
    try {
      retryAfter = await recordFailedAttempt(db, clientIp(request));
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";
      console.error(`API auth rate-limit check failed (${name})`);
      response.status(503).json({ error: "API authentication is temporarily unavailable" });
      return;
    }
    if (retryAfter > 0) {
      response.setHeader("Retry-After", String(retryAfter));
      response.status(429).json({ error: "Too many failed authentication attempts" });
      return;
    }

    if (!masterKey) {
      response.status(503).json({ error: "API authentication is not configured" });
      return;
    }
    response.status(401).json({ error: "A valid bearer token is required" });
  };
}
