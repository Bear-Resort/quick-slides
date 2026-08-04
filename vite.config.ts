import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { githubOauthProxyPlugin } from "./vite.github-oauth-proxy";

const repoBase = "/quick-slides/";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? repoBase : "/",
  plugins: [react(), tailwindcss(), githubOauthProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      html2canvas: "html2canvas-pro",
    },
  },
  server: {
    host: true,
    port: 5173,
    open: true,
  },
});
