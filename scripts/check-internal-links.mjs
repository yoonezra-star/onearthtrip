import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");
const postsDir = join(srcDir, "content", "posts");
const redirectsPath = join(root, "public", "_redirects");

const staticRoutes = new Set([
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
  "/contact",
  "/privacy",
  "/terms"
]);

const ignoredPrefixes = [
  "/images/",
  "/videos/",
  "/fonts/",
  "/favicon",
  "/ads.txt",
  "/robots.txt",
  "/sitemap-"
];

function normalizePath(value) {
  const clean = value.split("#", 1)[0].split("?", 1)[0];
  if (!clean.startsWith("/")) return null;

  const normalized = clean
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "")
    .replace(/\/$/, "");

  return normalized || "/";
}

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

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function collectLiteralLinks(text) {
  const links = [];
  const patterns = [
    /\[[^\]]*\]\((\/[^)\s]+)\)/g,
    /href\s*=\s*["'](\/[^"']+)["']/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      links.push({ value: match[1], index: match.index ?? 0 });
    }
  }

  return links;
}

const postFiles = (await readdir(postsDir))
  .filter((name) => name.endsWith(".md"))
  .map((name) => join(postsDir, name));

const canonicalRoutes = new Set(staticRoutes);
const permalinkOwners = new Map();
const issues = [];

for (const file of postFiles) {
  const text = await readFile(file, "utf8");
  const match = text.match(/^permalink:\s*["']([^"']+)["']/m);

  if (!match) {
    issues.push(`${relative(root, file)}: frontmatter permalink missing`);
    continue;
  }

  const canonical = normalizePath(match[1]);
  if (!canonical) {
    issues.push(`${relative(root, file)}: invalid permalink ${match[1]}`);
    continue;
  }

  if (permalinkOwners.has(canonical)) {
    issues.push(
      `${relative(root, file)}: duplicate permalink ${canonical} (also ${permalinkOwners.get(canonical)})`
    );
  } else {
    permalinkOwners.set(canonical, relative(root, file));
    canonicalRoutes.add(canonical);
  }
}

const redirectText = await readFile(redirectsPath, "utf8");
const redirects = new Map();
for (const rawLine of redirectText.split("\n")) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const [source, target] = line.split(/\s+/);
  if (source?.startsWith("/") && target?.startsWith("/")) {
    redirects.set(source, target);
  }
}

const sourceFiles = (await walk(srcDir)).filter((file) => {
  const extension = extname(file);
  return extension === ".md" || extension === ".astro";
});

for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");

  for (const link of collectLiteralLinks(text)) {
    const raw = link.value;
    const pathOnly = raw.split("#", 1)[0].split("?", 1)[0];
    if (!pathOnly || ignoredPrefixes.some((prefix) => pathOnly.startsWith(prefix))) continue;

    const fileLabel = `${relative(root, file)}:${lineNumber(text, link.index)}`;
    const normalized = normalizePath(raw);
    if (!normalized) continue;

    if (pathOnly.endsWith(".html")) {
      issues.push(`${fileLabel}: non-canonical .html internal link ${raw} -> ${normalized}`);
      continue;
    }

    if (redirects.has(pathOnly)) {
      issues.push(`${fileLabel}: internal link hits redirect ${raw} -> ${redirects.get(pathOnly)}`);
      continue;
    }

    if (!canonicalRoutes.has(normalized)) {
      issues.push(`${fileLabel}: broken internal link ${raw}`);
    }
  }
}

if (issues.length > 0) {
  console.error(`Internal link validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Internal link validation passed: ${canonicalRoutes.size} canonical routes checked.`);
