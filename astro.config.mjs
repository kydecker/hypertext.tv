import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

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
  redirects: {
    "/ch/00": "/",
    "/about": "/credits",
    "/ch/999": "/credits",
  },
  integrations: [mdx(), sitemap()],
  vite: {
    css: {
      transformer: "lightningcss",
      lightningcss: {
        targets: browserslistToTargets(browserslist()),
      },
    },
  },
});
