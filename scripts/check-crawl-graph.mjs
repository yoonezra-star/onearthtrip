import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const sitemapPath = path.join(dist, "sitemap-0.xml");
const canonicalOrigin = "https://www.onearthtrip.com";
const failures = [];

function fail(message) {
  failures.push(message);
}

function routeToBuiltFile(pathname) {
  if (pathname === "/") return path.join(dist, "index.html");
  return path.join(dist, `${pathname.replace(/^\//, "")}.html`);
}

function normalizeInternalHref(raw) {
  if (!raw || raw.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(raw)) return null;

  let url;
  try {
    url = new URL(raw, canonicalOrigin);
  } catch {
    return null;
  }

  if (url.origin !== canonicalOrigin) return null;

  const pathname = url.pathname
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "")
    .replace(/\/$/, "");

  return pathname || "/";
}

if (!fs.existsSync(sitemapPath)) {
  console.error("Crawl graph validation failed: dist/sitemap-0.xml is missing. Run the build first.");
  process.exit(1);
}

const sitemap = fs.readFileSync(sitemapPath, "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const indexableRoutes = new Set();

for (const loc of sitemapUrls) {
  try {
    const url = new URL(loc);
    if (url.origin !== canonicalOrigin) continue;
    indexableRoutes.add(url.pathname.replace(/\/$/, "") || "/");
  } catch {
    // Invalid sitemap URLs are handled by check-indexable-pages.mjs.
  }
}

if (!indexableRoutes.has("/")) {
  console.error("Crawl graph validation failed: canonical homepage is missing from sitemap.");
  process.exit(1);
}

const graph = new Map();
const inbound = new Map([...indexableRoutes].map((route) => [route, new Set()]));

for (const route of indexableRoutes) {
  const builtFile = routeToBuiltFile(route);
  if (!fs.existsSync(builtFile)) {
    fail(`${route}: built HTML is missing`);
    graph.set(route, new Set());
    continue;
  }

  const html = fs.readFileSync(builtFile, "utf8");
  const links = new Set();

  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const target = normalizeInternalHref(match[1]);
    if (!target || !indexableRoutes.has(target) || target === route) continue;
    links.add(target);
    inbound.get(target)?.add(route);
  }

  graph.set(route, links);
}

const depth = new Map([["/", 0]]);
const queue = ["/"];

while (queue.length > 0) {
  const current = queue.shift();
  const currentDepth = depth.get(current) ?? 0;

  for (const target of graph.get(current) ?? []) {
    if (depth.has(target)) continue;
    depth.set(target, currentDepth + 1);
    queue.push(target);
  }
}

const unreachable = [...indexableRoutes].filter((route) => !depth.has(route)).sort();
for (const route of unreachable) {
  fail(`${route}: sitemap URL is not reachable from the homepage through other indexable pages`);
}

for (const route of indexableRoutes) {
  if (route === "/") continue;
  if ((inbound.get(route)?.size ?? 0) === 0) {
    fail(`${route}: indexable page has no inbound link from another indexable page`);
  }
}

const articleRoutes = [...indexableRoutes].filter((route) => /^\/\d{4}\//.test(route));
const deepArticles = articleRoutes
  .filter((route) => (depth.get(route) ?? Number.POSITIVE_INFINITY) > 4)
  .sort((a, b) => (depth.get(b) ?? 99) - (depth.get(a) ?? 99));

for (const route of deepArticles) {
  fail(`${route}: article requires ${depth.get(route)} clicks from homepage; expected at most 4`);
}

if (failures.length > 0) {
  console.error(`Crawl graph validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const maxDepth = Math.max(...depth.values());
const maxArticleDepth = articleRoutes.length
  ? Math.max(...articleRoutes.map((route) => depth.get(route) ?? 0))
  : 0;

console.log(
  `Crawl graph validation passed: ${indexableRoutes.size} indexable page(s) are reachable from homepage; ${articleRoutes.length} article page(s) are within ${maxArticleDepth} click(s). Maximum site depth: ${maxDepth}.`
);
