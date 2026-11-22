// Configuration Vite : TanStack Start (rendu serveur), React, Tailwind CSS, alias « @ » → src/,
// et Nitro pour le build de production (serveur Node.js, port 3000 — voir Dockerfile).
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // point d'entrée serveur : src/server.ts (page d'erreur générique, sans détail technique)
      server: { entry: "server" },
      // le code « serveur » ne doit jamais se retrouver dans le navigateur
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // build : serveur Node.js (NITRO_PRESET permet d'en choisir un autre)
    ...(command === "build" ? [nitro({ defaultPreset: "node-server" })] : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  // développement : http://localhost:8080 (et l'adresse réseau du PC pour tester sur téléphone)
  server: { host: "::", port: 8080 },
}));
