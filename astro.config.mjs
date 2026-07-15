import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.onearthtrip.com",
  build: {
    format: "file"
  },
  markdown: {
    shikiConfig: {
      theme: "github-light"
    }
  }
});
