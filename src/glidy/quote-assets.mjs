// Display metadata only. Chain addresses and deployment allowlists belong to the backend.
export const QUOTE_ASSETS = Object.freeze([
  {
    symbol: "ETH",
    name: "Ether",
    kind: "Native asset",
    image: "/quote-assets/eth.png",
  },
  {
    symbol: "USDG",
    name: "Global Dollar",
    kind: "Stablecoin",
    image: "/quote-assets/usdg.png",
  },
]);
export const isQuoteAsset = (symbol) =>
  QUOTE_ASSETS.some((asset) => asset.symbol === symbol);
export const quoteAsset = (symbol) =>
  QUOTE_ASSETS.find((asset) => asset.symbol === symbol);
