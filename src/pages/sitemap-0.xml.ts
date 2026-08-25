import { site } from "../data/site";
import { getPosts, getPublicPath } from "../utils/posts";

const staticPages = [
  "/",
  "/life",
  "/culture",
  "/past-present-future",
  "/memory",
  "/about",
  "/author",
  "/editorial-policy",
  "/reading-guide",
  "/field-notes",
  "/trip-checklist",
  "/attractions",
  "/downtown-attractions",
  "/where-to-stay",
  "/travel-costs",
  "/food-guide",
  "/money-guide",
  "/shopping-guide",
  "/connectivity-guide",
  "/travel-apps-guide",
  "/driving-guide",
  "/intercity-guide",
  "/al-ain-guide",
  "/liwa-guide",
  "/contact",
  "/privacy",
  "/terms"
];

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

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
  const urls: SitemapEntry[] = [
    ...staticPages.map((path) => ({
      loc: new URL(path, site.url).toString()
    })),
    ...posts.map((post) => ({
      loc: new URL(getPublicPath(post.data.permalink), site.url).toString(),
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString()
    }))
  ];

  const seen = new Set<string>();
  const uniqueUrls = urls.filter(({ loc }) => {
    if (seen.has(loc)) return false;
    seen.add(loc);
    return true;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map(
    (url) => `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ""}\n  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8"
    }
  });
}
