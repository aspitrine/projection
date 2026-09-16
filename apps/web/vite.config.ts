import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import viteReact from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

const bibleArchive = fileURLToPath(
  new URL("../../packages/bible/assets/fraLSG_usfm.zip", import.meta.url),
);
const builtBibleAssets = fileURLToPath(new URL("./.output/assets", import.meta.url));

/** Conserve l'archive serveur à l'emplacement résolu par `import.meta.url` après bundling. */
const copyBibleAssets = () => ({
  name: "copy-bible-assets",
  apply: "build" as const,
  closeBundle() {
    mkdirSync(builtBibleAssets, { recursive: true });
    copyFileSync(bibleArchive, `${builtBibleAssets}/fraLSG_usfm.zip`);
  },
});

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      // Un seul locale pour l'instant : pas de détection (URL, cookie) nécessaire.
      strategy: ["baseLocale"],
      emitTsDeclarations: true,
    }),
    varlockVitePlugin({ ssrInjectMode: "auto-load" }),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "node-server" }),
    viteReact(),
    copyBibleAssets(),
  ],
});
