import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_LIMIT = 10;
const MAX_TRACKED_CLIENTS = 10_000;

type FailureBucket = {
  windowStartedAt: number;
  failures: number;
};

const failuresByIp = new Map<string, FailureBucket>();

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

  return request.socket.remoteAddress ?? "unknown";
}

function recordFailedAttempt(ip: string, now: number): number {
  let bucket = failuresByIp.get(ip);
  if (!bucket || now - bucket.windowStartedAt >= FAILURE_WINDOW_MS) {
    bucket = { windowStartedAt: now, failures: 0 };
  }
  bucket.failures += 1;

  // Bound memory if requests arrive from many distinct addresses.
  failuresByIp.delete(ip);
  if (failuresByIp.size >= MAX_TRACKED_CLIENTS) {
    for (const [trackedIp, trackedBucket] of failuresByIp) {
      if (now - trackedBucket.windowStartedAt >= FAILURE_WINDOW_MS) {
        failuresByIp.delete(trackedIp);
      }
    }
  }
  if (failuresByIp.size >= MAX_TRACKED_CLIENTS) {
    const oldestIp = failuresByIp.keys().next().value;
    if (oldestIp !== undefined) failuresByIp.delete(oldestIp);
  }
  failuresByIp.set(ip, bucket);

  if (bucket.failures > FAILURE_LIMIT) {
    return Math.max(1, Math.ceil((bucket.windowStartedAt + FAILURE_WINDOW_MS - now) / 1000));
  }
  return 0;
}

export function createMasterApiAuth(masterKey: string | undefined): RequestHandler {
  const expectedDigest = masterKey
    ? createHash("sha256").update(masterKey).digest()
    : undefined;

  return (request, response, next) => {
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

    const retryAfter = recordFailedAttempt(clientIp(request), Date.now());
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
