import { createFileRoute } from "@tanstack/react-router";
import GlidyApp from "../glidy/main.jsx";

export const Route = createFileRoute("/")({ component: GlidyApp });
