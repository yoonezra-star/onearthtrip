import type { APIRoute } from "astro";
import { site } from "../data/site";
import { getPosts, getPublicPath } from "../utils/posts";

const staticPaths = [
  "/",
  "/life",
  "/culture",
  "/past-present-future",
  "/memory",
  "/field-notes",
  "/reading-guide",
  "/trip-checklist",
  "/about",
  "/author",
  "/editorial-policy"
];

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const staticUrls = staticPaths.map((path) => ({
    loc: new URL(path, site.url).toString()
  }));
  const postUrls = posts.map((post) => ({
    loc: new URL(getPublicPath(post.data.permalink), site.url).toString(),
    lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString()
  }));
  const seen = new Set<string>();
  const urls = [...staticUrls, ...postUrls].filter(({ loc }) => {
    if (seen.has(loc)) return false;
    seen.add(loc);
    return true;
  });

  const entries = urls
    .map(({ loc, lastmod }) => [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
      "  </url>"
    ].filter(Boolean).join("\n"))
    .join("\n");

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>"
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
