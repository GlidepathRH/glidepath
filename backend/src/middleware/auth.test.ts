import { afterEach, describe, expect, test } from "bun:test";
import express from "express";
import type { Pool } from "pg";
import { createMasterApiAuth } from "./auth";

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number };
type MockDbOptions = {
  failureCount?: number;
  requestCount?: number;
  retryAfter?: number;
  fail?: boolean;
};

function mockDb(options: MockDbOptions = {}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, values?: unknown[]): Promise<QueryResult> => {
      calls.push({ sql, values });
      if (options.fail) throw new Error("database unavailable");
      if (sql.startsWith("INSERT INTO api_auth_rate_limits")) {
        return { rows: [{ failure_count: options.failureCount ?? 1, retry_after_seconds: options.retryAfter ?? 60 }], rowCount: 1 };
      }
      if (sql.startsWith("INSERT INTO api_client_rate_limits")) {
        return { rows: [{ request_count: options.requestCount ?? 1, retry_after_seconds: options.retryAfter ?? 45 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

async function withApi(key: string | undefined, db: ReturnType<typeof mockDb>, run: (base: string) => Promise<void>) {
  const app = express();
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.use(createMasterApiAuth(key, db as unknown as Pool));
  app.get("/protected", (_request, response) => response.json({ data: "private" }));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an ephemeral TCP listener");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const KEY = "unit-test-master-api-key-with-more-than-32-characters";

describe("master API authentication", () => {
  test("leaves health public and requires a bearer token for protected routes", async () => {
    const db = mockDb();
    await withApi(KEY, db, async (base) => {
      const health = await fetch(`${base}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: "ok" });

      const protectedResponse = await fetch(`${base}/protected`, { headers: { "x-forwarded-for": "198.51.100.7, 10.0.0.3" } });
      expect(protectedResponse.status).toBe(401);
      expect(await protectedResponse.json()).toEqual({ error: "A valid bearer token is required" });
      const attempt = db.calls.find((call) => call.sql.startsWith("INSERT INTO api_auth_rate_limits"));
      expect(attempt?.values?.[0]).toBe("198.51.100.7");
    });
  });

  test("accepts only the configured bearer key and allows a valid request", async () => {
    const db = mockDb();
    await withApi(KEY, db, async (base) => {
      const invalid = await fetch(`${base}/protected`, { headers: { authorization: "Bearer wrong" } });
      expect(invalid.status).toBe(401);

      const valid = await fetch(`${base}/protected`, { headers: { authorization: `Bearer ${KEY}`, "cf-connecting-ip": "203.0.113.9" } });
      expect(valid.status).toBe(200);
      expect(await valid.json()).toEqual({ data: "private" });
      const request = db.calls.find((call) => call.sql.startsWith("INSERT INTO api_client_rate_limits"));
      expect(request?.values?.[0]).toBe("203.0.113.9");
    });
  });

  test("returns 429 and Retry-After when an authenticated IP exceeds its limit", async () => {
    const db = mockDb({ requestCount: 121, retryAfter: 45 });
    await withApi(KEY, db, async (base) => {
      const response = await fetch(`${base}/protected`, { headers: { authorization: `Bearer ${KEY}` } });
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("45");
      expect(await response.json()).toEqual({ error: "API request limit exceeded for this IP" });
    });
  });

  test("returns 429 for the failed-authentication limit", async () => {
    const db = mockDb({ failureCount: 11, retryAfter: 71 });
    await withApi(KEY, db, async (base) => {
      const response = await fetch(`${base}/protected`);
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("71");
    });
  });

  test("fails closed when the rate-limit database is unavailable", async () => {
    const db = mockDb({ fail: true });
    await withApi(KEY, db, async (base) => {
      const response = await fetch(`${base}/protected`, { headers: { authorization: `Bearer ${KEY}` } });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "API request limit is temporarily unavailable" });
    });
  });

  test("does not allow protected access when the master key is unset", async () => {
    const db = mockDb();
    await withApi(undefined, db, async (base) => {
      const response = await fetch(`${base}/protected`);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "API authentication is not configured" });
    });
  });
});
