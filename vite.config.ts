import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "127.0.0.1", port: 5184, strictPort: true },
  preview: { host: "127.0.0.1", port: 5185, strictPort: true },
  plugins: [tanstackStart(), nitro(), viteReact(), tailwindcss()],
});
