import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { cubeLut } from "./plugins/cubeLut.mjs";

export default defineConfig({
  site: "https://hypertext.tv",
  output: "server",
  devToolbar: {
    enabled: false,
  },
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  prefetch: true,
  session: false,
  redirects: {
    "/ch/00": "/",
    "/about": "/credits",
    "/ch/999": "/credits",
  },
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [cubeLut()],
    build: {
      assetsInlineLimit: (file) =>
        /\/src\/fonts\/(BetterVCR|DSEG14)/.test(file) || undefined,
    },
    css: {
      transformer: "lightningcss",
      lightningcss: {
        targets: browserslistToTargets(browserslist()),
      },
    },
  },
});
