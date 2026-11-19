import test from "node:test";
import assert from "node:assert/strict";
import { apiGet } from "./api-client.mjs";

function withFetch(implementation, run) {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  return Promise.resolve().then(run).finally(() => { globalThis.fetch = original; });
}

test("apiGet calls the same-origin proxy with no-store JSON headers", async () => {
  const controller = new AbortController();
  await withFetch(async (url, init) => {
    assert.equal(url, "/api/glidy/api/v1/launches?limit=10");
    assert.equal(init.headers.Accept, "application/json");
    assert.equal(init.cache, "no-store");
    assert.equal(init.signal, controller.signal);
    return Response.json({ data: [] });
  }, async () => {
    assert.deepEqual(await apiGet("api/v1/launches?limit=10", controller.signal), { data: [] });
  });
});

test("apiGet returns an empty object for successful non-JSON bodies", async () => {
  await withFetch(async () => new Response("ok", { status: 200 }), async () => {
    assert.deepEqual(await apiGet("ready"), {});
  });
});

test("apiGet surfaces the server retry window for rate limiting", async () => {
  await withFetch(async () => new Response(JSON.stringify({ error: "limited" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "37" },
  }), async () => {
    await assert.rejects(apiGet("api/v1/launches"), (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, "37");
      assert.match(error.message, /37 seconds/);
      return true;
    });
  });
});

test("apiGet gives a stable message for service outages", async () => {
  await withFetch(async () => Response.json({ error: "private upstream detail" }, { status: 503 }), async () => {
    await assert.rejects(apiGet("ready"), (error) => {
      assert.equal(error.status, 503);
      assert.match(error.message, /temporarily unavailable/);
      assert.doesNotMatch(error.message, /private upstream/);
      return true;
    });
  });
});

test("apiGet preserves safe API error messages for other failures", async () => {
  await withFetch(async () => Response.json({ error: "launch not found" }, { status: 404 }), async () => {
    await assert.rejects(apiGet("api/v1/launches/0x0"), (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.message, "launch not found");
      return true;
    });
  });
});
