import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const repoBase = "/quick-slides/";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? repoBase : "/",
  plugins: [react(), tailwindcss()],
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
    proxy: {
      // Browser cannot call github.com/login/* (CORS). Proxy Device Flow endpoints in dev.
      "/github-oauth": {
        target: "https://github.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-oauth/, ""),
      },
    },
  },
});
