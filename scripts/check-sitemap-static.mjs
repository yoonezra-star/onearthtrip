import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const root = process.cwd();
const pagesDir = join(root, "src", "pages");
const sitemapPath = join(pagesDir, "sitemap-0.xml.ts");
const sitemapExcludedRoutes = new Set(["/search"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }

  return files;
}

function pageFileToRoute(file) {
  const relativePath = relative(pagesDir, file).split(sep).join("/");
  if (extname(relativePath) !== ".astro") return null;
  if (relativePath === "404.astro") return null;
  if (relativePath.includes("[")) return null;

  const withoutExtension = relativePath.replace(/\.astro$/, "");
  const route = withoutExtension
    .replace(/(^|\/)index$/, "$1")
    .replace(/\/$/, "");

  return route ? `/${route}` : "/";
}

const pageFiles = await walk(pagesDir);
const staticRoutes = pageFiles
  .map(pageFileToRoute)
  .filter(Boolean)
  .sort();
const indexableStaticRoutes = staticRoutes.filter((route) => !sitemapExcludedRoutes.has(route));

const invalidExclusions = [...sitemapExcludedRoutes].filter((route) => !staticRoutes.includes(route));
if (invalidExclusions.length) {
  console.error("Static sitemap validation failed: excluded route has no static Astro page.");
  for (const route of invalidExclusions) console.error(`- invalid exclusion: ${route}`);
  process.exit(1);
}

const sitemapText = await readFile(sitemapPath, "utf8");
const staticPagesBlock = sitemapText.match(/const staticPages = \[([\s\S]*?)\];/);

if (!staticPagesBlock) {
  console.error("Static sitemap validation failed: could not find staticPages array.");
  process.exit(1);
}

const sitemapRoutes = [...staticPagesBlock[1].matchAll(/["'](\/[^"']*)["']/g)]
  .map((match) => match[1].replace(/\/$/, "") || "/")
  .sort();

const sitemapSet = new Set(sitemapRoutes);
const staticSet = new Set(indexableStaticRoutes);
const missing = indexableStaticRoutes.filter((route) => !sitemapSet.has(route));
const stale = sitemapRoutes.filter((route) => !staticSet.has(route));

if (missing.length || stale.length) {
  console.error("Static sitemap validation failed:");
  for (const route of missing) console.error(`- missing from sitemap: ${route}`);
  for (const route of stale) console.error(`- sitemap route has no indexable static Astro page: ${route}`);
  process.exit(1);
}

console.log(
  `Static sitemap validation passed: ${indexableStaticRoutes.length} indexable static Astro routes checked; ${sitemapExcludedRoutes.size} noindex route excluded.`
);
