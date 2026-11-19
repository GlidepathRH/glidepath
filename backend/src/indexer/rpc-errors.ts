export function rpcRangeLimit(error: unknown): bigint | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { details?: unknown; cause?: unknown };
  const cause = value.cause && typeof value.cause === "object"
    ? value.cause as { details?: unknown; shortMessage?: unknown }
    : undefined;
  for (const message of [value.details, cause?.details, cause?.shortMessage]) {
    if (typeof message !== "string") continue;
    const match = message.match(/ranges? over (\d+) blocks? (?:are|is) not supported/i);
    if (match) return BigInt(match[1]);
  }
  return null;
}

export function safeRpcFailure(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { name: "UnknownError" };
  const value = error as { name?: unknown; cause?: unknown };
  const cause = value.cause && typeof value.cause === "object"
    ? value.cause as { code?: unknown; details?: unknown }
    : undefined;
  const allowedDetails = typeof cause?.details === "string"
    ? cause.details.match(/ranges? over \d+ blocks? (?:are|is) not supported/i)?.[0]
    : undefined;
  return {
    name: typeof value.name === "string" ? value.name : "UnknownError",
    ...(cause?.code !== undefined && ["string", "number"].includes(typeof cause.code) ? { code: cause.code } : {}),
    ...(allowedDetails ? { detail: allowedDetails } : {}),
  };
}
