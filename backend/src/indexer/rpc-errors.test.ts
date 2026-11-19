import { describe, expect, test } from "bun:test";
import { rpcRangeLimit, safeRpcFailure } from "./rpc-errors";

describe("RPC failure handling", () => {
  test("extracts an explicit provider block-range cap", () => {
    expect(rpcRangeLimit({ cause: { details: "ranges over 100 blocks are not supported on free plan" } })).toBe(100n);
    expect(rpcRangeLimit({ details: "range over 75 block is not supported" })).toBe(75n);
  });

  test("does not infer a range cap from unrelated errors", () => {
    expect(rpcRangeLimit(new Error("connection timeout"))).toBeNull();
    expect(rpcRangeLimit({ cause: { details: "request rate limit exceeded" } })).toBeNull();
    expect(rpcRangeLimit(null)).toBeNull();
  });

  test("returns useful diagnostics without leaking raw provider error details", () => {
    const details = "ranges over 100 blocks are not supported. URL: https://rpc.example/secret-token";
    const safe = safeRpcFailure({ name: "RpcRequestError", cause: { code: 35, details } });
    expect(safe).toEqual({ name: "RpcRequestError", code: 35, detail: "ranges over 100 blocks are not supported" });
    expect(JSON.stringify(safe)).not.toContain("secret-token");
  });

  test("handles primitive failures", () => {
    expect(safeRpcFailure("failed")).toEqual({ name: "UnknownError" });
  });
});
