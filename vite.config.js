import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": backend,
      "/admin": backend,
      "/health": backend,
      "/files": backend,
      "/upload": backend,
      "/conversations": backend,
      "/chat": backend,
    },
  },
});
