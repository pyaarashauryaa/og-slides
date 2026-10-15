import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, requests to /api go to the sign-in server (npm run server) so the browser only ever talks to one address.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
});
