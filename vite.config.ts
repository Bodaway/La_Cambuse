import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { aiDevServerPlugin } from "./src/server/ai-dev-server.js";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    aiDevServerPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "La Cambuse",
        short_name: "Cambuse",
        description: "Assistant culinaire familial",
        lang: "fr",
        theme_color: "#1c1917",
        background_color: "#fafaf9",
        display: "standalone",
        start_url: "/",
      },
    }),
  ],
  test: {
    // globals: true -> expose afterEach globalement, ce qui déclenche
    // l'auto-cleanup de React Testing Library entre les tests.
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
