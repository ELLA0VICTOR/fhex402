import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: "globalThis",
  },
  build: {
    target: "esnext",
  },
  server: {
    port: 5173,
    proxy: {
      "/api/roster": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/roster/, ""),
      },
      "/api/compliance": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/compliance/, ""),
      },
      "/api/disburse": {
        target: "http://localhost:3003",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/disburse/, ""),
      },
    },
  },
});
