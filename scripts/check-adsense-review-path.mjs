import fs from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");
const siteUrl = "https://www.onearthtrip.com";

const representativeRoutes = [
  "/",
  "/reading-guide",
  "/life",
  "/culture",
  "/field-notes",
  "/2026/08/uae-entry-checklist-before-travel",
  "/2026/08/abu-dhabi-3-day-itinerary",
  "/2026/08/sheikh-zayed-grand-mosque-visit-guide",
  "/2026/04/blog-post_11",
  "/about",
  "/author",
  "/editorial-policy",
  "/contact",
  "/privacy",
  "/terms"
];

function routeToFile(route) {
  if (route === "/") return path.join(distDir, "index.html");
  return path.join(distDir, `${route.replace(/^\//, "")}.html`);
}

function readRoute(route) {
  const file = routeToFile(route);
  if (!fs.existsSync(file)) {
    throw new Error(`Built HTML not found for ${route}: ${path.relative(process.cwd(), file)}`);
  }
  return fs.readFileSync(file, "utf8");
}

function canonicalFor(route) {
  return route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`;
}

function countMatches(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

const violations = [];

for (const route of representativeRoutes) {
  const html = readRoute(route);
  const canonical = canonicalFor(route);

  if (!html.includes(`<link rel="canonical" href="${canonical}"`)) {
    violations.push(`${route}: canonical is missing or does not match ${canonical}`);
  }

  if (!/<meta name="description" content="[^\"]+"/.test(html)) {
    violations.push(`${route}: meta description is missing or empty`);
  }

  const h1Count = countMatches(html, /<h1(?:\s|>)/g);
  if (h1Count !== 1) {
    violations.push(`${route}: expected exactly one H1, found ${h1Count}`);
  }

  const hasNoindex = /<meta name="robots" content="[^"]*noindex/i.test(html);
  if (hasNoindex) {
    violations.push(`${route}: representative indexable page unexpectedly has noindex`);
  }
}

const searchHtml = readRoute("/search");
const searchHasNoindex = /<meta name="robots" content="[^"]*noindex/i.test(searchHtml);
if (!searchHasNoindex || !searchHtml.includes("noindex,follow")) {
  violations.push("/search: expected noindex,follow robots directive");
}

const homeHtml = readRoute("/");
for (const href of ["/reading-guide", "/field-notes", "/author", "/editorial-policy"]) {
  if (!homeHtml.includes(`href="${href}"`)) {
    violations.push(`/: expected reviewer trust/navigation link to ${href}`);
  }
}

for (const route of ["/life", "/culture"]) {
  const html = readRoute(route);
  if (!html.includes('href="/search"')) {
    violations.push(`${route}: expected site-search escape hatch`);
  }
  if (!html.includes('href="/editorial-policy"')) {
    violations.push(`${route}: expected editorial-policy trust link`);
  }
}

for (const route of [
  "/2026/08/uae-entry-checklist-before-travel",
  "/2026/08/abu-dhabi-3-day-itinerary",
  "/2026/08/sheikh-zayed-grand-mosque-visit-guide"
]) {
  const html = readRoute(route);
  for (const marker of [
    "공식 정보 확인형 가이드",
    "정보 기준",
    'href="/author"',
    'href="/editorial-policy"',
    '"@type":"BlogPosting"',
    '"@type":"BreadcrumbList"'
  ]) {
    if (!html.includes(marker)) {
      violations.push(`${route}: expected guide trust marker ${marker}`);
    }
  }
}

const fieldNoteHtml = readRoute("/2026/04/blog-post_11");
for (const marker of [
  "직접 경험·기록 기반",
  "기록 범위",
  'href="/author"',
  'href="/editorial-policy"',
  '"@type":"BlogPosting"',
  '"@type":"BreadcrumbList"'
]) {
  if (!fieldNoteHtml.includes(marker)) {
    violations.push(`/2026/04/blog-post_11: expected field-note trust marker ${marker}`);
  }
}

const representativeArticleRoutes = [
  "/2026/08/uae-entry-checklist-before-travel",
  "/2026/08/abu-dhabi-3-day-itinerary",
  "/2026/08/sheikh-zayed-grand-mosque-visit-guide",
  "/2026/04/blog-post_11"
];

for (const route of representativeArticleRoutes) {
  const html = readRoute(route);
  if (!html.includes('rel="author"')) {
    violations.push(`${route}: expected visible rel=author link in article header metadata`);
  }
  if (!html.includes('>작성 ') || !html.includes('>게시 <time')) {
    violations.push(`${route}: expected explicit author and publication labels in article header metadata`);
  }
}

const fieldNotesHtml = readRoute("/field-notes");
for (const marker of ["CollectionPage", "ItemList", "2012~2022 개인 사진 색인"]) {
  if (!fieldNotesHtml.includes(marker)) {
    violations.push(`/field-notes: expected archive marker ${marker}`);
  }
}

if (violations.length > 0) {
  console.error("AdSense reviewer-path validation failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`AdSense reviewer-path validation passed: ${representativeRoutes.length} representative built routes plus /search indexing boundary checked.`);
