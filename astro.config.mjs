import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.onearthtrip.com",
  build: {
    format: "file"
  },
  integrations: [
    sitemap({
      changefreq: "weekly",
      priority: 0.7
    })
  ],
  markdown: {
    shikiConfig: {
      theme: "github-light"
    }
  }
});
