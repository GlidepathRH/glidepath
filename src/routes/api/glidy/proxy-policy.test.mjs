import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedGlidyReadPath } from "./proxy-policy.mjs";

test("proxy allows only the documented read endpoints", () => {
  const address = `0x${"aB".repeat(20)}`;
  for (const path of ["ready", "api/v1/indexer", "api/v1/launches", `api/v1/launches/${address}`, `api/v1/launches/${address}/events`, `api/v1/launches/${address}/chart`]) {
    assert.equal(isAllowedGlidyReadPath(path), true, path);
  }
});

test("proxy rejects unknown endpoints, malformed addresses and write paths", () => {
  const address = `0x${"a".repeat(40)}`;
  for (const path of ["", "health", "api/v1/launches/abc", "api/v1/launches/0x123", `api/v1/launches/${address}/events/extra`, `api/v1/launches/${address}/claims`]) {
    assert.equal(isAllowedGlidyReadPath(path), false, path);
  }
});
