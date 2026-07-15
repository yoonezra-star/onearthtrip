import { site } from "../data/site";
import { getPosts, getPublicPath } from "../utils/posts";

const staticPages = [
  "/",
  "/life",
  "/culture",
  "/past-present-future",
  "/memory",
  "/about",
  "/contact",
  "/privacy",
  "/terms"
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const posts = await getPosts();
  const urls = [
    ...staticPages.map((path) => ({
      loc: new URL(path, site.url).toString(),
      lastmod: new Date().toISOString()
    })),
    ...posts.map((post) => ({
      loc: new URL(getPublicPath(post.data.permalink), site.url).toString(),
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString()
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
}
