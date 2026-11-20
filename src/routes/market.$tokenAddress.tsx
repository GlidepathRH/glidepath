import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import GlidyApp from "../glidy/main.jsx";

const loadLaunchMetadata = createServerFn({ method: "GET" })
  .validator((tokenAddress: unknown) =>
    typeof tokenAddress === "string" && /^0x[\da-f]{40}$/i.test(tokenAddress) ? tokenAddress : null,
  )
  .handler(async ({ data: tokenAddress }) => {
  if (!tokenAddress) return null;
  try {
    const base = process.env["GLIDY_API_BASE_URL"];
    const key = process.env["MASTER_API_KEY"];
    if (!base || !key) return null;
    const endpoint = new URL(`/api/v1/launches/${tokenAddress}`, base).toString();
    const headers = { Accept: "application/json", Authorization: `Bearer ${key}` };
    const response = await fetch(endpoint, { headers, cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.data as { token_name?: string; token_symbol?: string; token_address?: string } | undefined;
  } catch {
    return null;
  }
});

export const Route = createFileRoute("/market/$tokenAddress")({
  loader: ({ params }) => loadLaunchMetadata({ data: params.tokenAddress }),
  head: ({ loaderData, params }) => {
    const tokenName = loaderData?.token_name || `Token ${params.tokenAddress.slice(0, 6)}…${params.tokenAddress.slice(-4)}`;
    const symbol = loaderData?.token_symbol ? ` ($${loaderData.token_symbol})` : "";
    const title = `${tokenName}${symbol} · GLIDY`;
    const description = `View ${tokenName}${symbol} on GLIDY: inspect its live tax path, pool price, and trade directly on Robinhood Chain.`;
    const url = `https://glidy.fun/market/${params.tokenAddress}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "GLIDY" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:image", content: "https://glidy.fun/brand/glidy-og.svg" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: "https://glidy.fun/brand/glidy-og.svg" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: GlidyApp,
});
