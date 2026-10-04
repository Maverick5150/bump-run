import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on LAN, not just localhost -- phones need to reach this during dev
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});
