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

if (!fs.existsSync(sitemapPath)) {
  console.error("Indexable page validation failed: dist/sitemap-0.xml is missing. Run the build first.");
  process.exit(1);
}

const sitemap = fs.readFileSync(sitemapPath, "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());

if (locs.length === 0) {
  console.error("Indexable page validation failed: sitemap contains no <loc> entries.");
  process.exit(1);
}

const seen = new Set();
let articlePages = 0;

for (const loc of locs) {
  if (seen.has(loc)) {
    fail(`duplicate sitemap URL: ${loc}`);
    continue;
  }
  seen.add(loc);

  let url;
  try {
    url = new URL(loc);
  } catch {
    fail(`invalid sitemap URL: ${loc}`);
    continue;
  }

  if (url.origin !== canonicalOrigin) {
    fail(`${loc}: expected canonical origin ${canonicalOrigin}`);
  }
  if (url.search || url.hash) {
    fail(`${loc}: sitemap URL must not contain query or fragment`);
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    fail(`${loc}: canonical sitemap path must not end with /`);
  }
  if (url.pathname.endsWith(".html")) {
    fail(`${loc}: canonical sitemap URL must not use legacy .html suffix`);
  }

  const builtFile = routeToBuiltFile(url.pathname);
  if (!fs.existsSync(builtFile)) {
    fail(`${loc}: built HTML is missing at ${path.relative(root, builtFile)}`);
    continue;
  }

  const html = fs.readFileSync(builtFile, "utf8");

  if (!/<html\b[^>]*\blang=["']ko["']/i.test(html)) {
    fail(`${loc}: html lang=ko is missing`);
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch || titleMatch[1].trim().length === 0) {
    fail(`${loc}: non-empty <title> is missing`);
  }

  const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (!descriptionMatch || descriptionMatch[1].trim().length === 0) {
    fail(`${loc}: non-empty meta description is missing`);
  }

  const canonicalMatch = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)
    ?? html.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["']/i);
  if (!canonicalMatch) {
    fail(`${loc}: canonical link is missing`);
  } else if (canonicalMatch[1] !== loc) {
    fail(`${loc}: canonical mismatch, found ${canonicalMatch[1]}`);
  }

  const robotsMatch = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']+)["']/i)
    ?? html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']robots["']/i);
  if (!robotsMatch) {
    fail(`${loc}: robots meta is missing`);
  } else if (/\bnoindex\b/i.test(robotsMatch[1])) {
    fail(`${loc}: sitemap URL unexpectedly contains noindex`);
  }

  const h1Count = (html.match(/<h1(?:\s|>)/gi) ?? []).length;
  if (h1Count !== 1) {
    fail(`${loc}: expected exactly one H1, found ${h1Count}`);
  }

  if (/^\/\d{4}\//.test(url.pathname)) {
    articlePages += 1;
    if (!html.includes('"@type":"BlogPosting"')) {
      fail(`${loc}: article route is missing BlogPosting structured data`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Indexable page validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Indexable page validation passed: ${locs.length} sitemap URL(s) checked, including ${articlePages} article page(s). Canonical, robots, title, description, H1, language, and article structured data are consistent.`
);
