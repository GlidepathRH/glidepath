import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import "@rainbow-me/rainbowkit/styles.css";
import { GlidyWalletProviders } from "../glidy/GlidyWallet";
import { GlidyToastProvider } from "../glidy/GlidyToast";
import "../glidy/toast.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GLIDY — Launch with a tax. Lock how it falls." },
      {
        name: "description",
        content: "GLIDY is a Robinhood Chain launchpad with a tax path committed before the first trade.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/brand/glidey-soft-eyes-transparent.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <GlidyWalletProviders><GlidyToastProvider><Outlet /></GlidyToastProvider></GlidyWalletProviders>
        <Scripts />
      </body>
    </html>
  );
}
