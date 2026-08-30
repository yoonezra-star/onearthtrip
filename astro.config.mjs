import { defineConfig } from "astro/config";
import rehypeImagePerformance from "./src/markdown/rehype-image-performance.mjs";

export default defineConfig({
  site: "https://www.onearthtrip.com",
  build: {
    format: "file"
  },
  markdown: {
    rehypePlugins: [rehypeImagePerformance],
    shikiConfig: {
      theme: "github-light"
    }
  }
});
