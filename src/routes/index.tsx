import { createFileRoute } from "@tanstack/react-router";
import GlidyApp from "../glidy/main.jsx";

export const Route = createFileRoute("/")({
  head: () => ({ links: [{ rel: "canonical", href: "https://glidy.fun/" }] }),
  component: GlidyApp,
});
