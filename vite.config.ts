import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    viteReact(),
  ],
  server: {
    host: true,
  },
  build: {
    outDir: "dist",
  },
});
