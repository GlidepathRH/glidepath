import { createFileRoute } from "@tanstack/react-router";
import { isIP } from "node:net";
import { isAllowedGlidyReadPath } from "./proxy-policy.mjs";

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/glidy/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const path = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
        if (!isAllowedGlidyReadPath(path)) return jsonError(404, "API route not found");

        const apiBase = process.env["GLIDY_API_BASE_URL"];
        const apiKey = process.env["MASTER_API_KEY"];
        if (!apiBase || !apiKey) {
          return jsonError(503, "Glidy API proxy is not configured");
        }

        const incomingUrl = new URL(request.url);
        const targetUrl = new URL(path, apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
        if (path === "api/v1/launches" && incomingUrl.searchParams.has("limit")) {
          targetUrl.searchParams.set("limit", incomingUrl.searchParams.get("limit") ?? "");
        }

        const forwardedFor = request.headers.get("x-vercel-forwarded-for")
          ?? request.headers.get("x-forwarded-for");
        const clientIp = forwardedFor
          ?.split(",")
          .map((value) => value.trim())
          .find((value) => isIP(value));

        try {
          const requestHeaders: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          };
          if (clientIp) requestHeaders["X-Glidy-Client-IP"] = clientIp;
          const upstream = await fetch(targetUrl, {
            headers: requestHeaders,
            signal: AbortSignal.timeout(8_000),
          });
          if (upstream.status === 401) {
            return jsonError(503, "Glidy API credentials are not configured correctly");
          }
          const body = await upstream.text();
          const headers = new Headers({
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
            "Cache-Control": "no-store",
          });
          const retryAfter = upstream.headers.get("retry-after");
          if (retryAfter) headers.set("Retry-After", retryAfter);
          return new Response(body, {
            status: upstream.status,
            headers,
          });
        } catch {
          return jsonError(503, "Glidy API is temporarily unavailable");
        }
      },
    },
  },
});
