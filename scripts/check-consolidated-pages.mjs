import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const origin = "https://www.onearthtrip.com";
const failures = [];
const normalize = (value) => value.replace(/\.html$/, "");
const sitemap = fs.readFileSync(path.join(dist, "sitemap-0.xml"), "utf8");
const indexed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
const redirects = new Map();
for (const line of fs.readFileSync("public/_redirects", "utf8").split(/\r?\n/)) {
  const [from, to, status] = line.trim().split(/\s+/);
  if (from?.startsWith("/")) redirects.set(from, { to, status });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith(".html") ? [file] : [];
  });
}

const consolidated = new Map();
const pages = walk(dist).map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const route = normalize(`/${path.relative(dist, file).split(path.sep).join("/")}`);
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  if (/^\/\d{4}\/\d{2}\//.test(route) && canonical) {
    const target = new URL(canonical);
    if (target.pathname !== route) {
      consolidated.set(route, target.pathname);
      if (target.origin !== origin || !indexed.has(target.pathname)) failures.push(`${route}: target is not a canonical indexed page`);
      if (indexed.has(route)) failures.push(`${route}: consolidated URL remains in sitemap`);
      if (!/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html)) failures.push(`${route}: missing noindex`);
      for (const old of [route, `${route}.html`]) {
        const rule = redirects.get(old);
        if (rule?.to !== target.pathname || rule?.status !== "301") failures.push(`${old}: missing direct 301 to ${target.pathname}`);
      }
    }
  }
  return { route, html };
});

// Public navigation must point directly to representatives, not retired articles.
for (const { route, html } of pages) {
  if (!indexed.has(route) && route !== "/index") continue;
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
    const url = new URL(match[1], origin);
    if (url.origin === origin && consolidated.has(normalize(url.pathname))) failures.push(`${route}: links to retired ${url.pathname}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Consolidation checks passed: ${consolidated.size} retired articles, direct redirects and public links verified.`);
