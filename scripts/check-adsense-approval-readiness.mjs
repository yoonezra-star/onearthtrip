import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const postsDir = path.join(root, "src", "content", "posts");
const failures = [];

function requireFile(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) failures.push(`missing required file: ${relativePath}`);
  return full;
}

function read(relativePath) {
  const full = requireFile(relativePath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

const trustPages = [
  "src/pages/about.astro",
  "src/pages/author.astro",
  "src/pages/editorial-policy.astro",
  "src/pages/contact.astro",
  "src/pages/privacy.astro",
  "src/pages/terms.astro"
];
for (const page of trustPages) requireFile(page);

const robots = read("public/robots.txt");
if (!robots.includes("User-agent: *") || !robots.includes("Allow: /")) {
  failures.push("robots.txt must allow normal crawling");
}
if (!robots.includes("https://www.onearthtrip.com/sitemap-index.xml")) {
  failures.push("robots.txt must point to the canonical sitemap index");
}

requireFile("src/pages/sitemap-index.xml.ts");
requireFile("src/pages/sitemap-0.xml.ts");

const searchSource = read("src/pages/search.astro");
if (!searchSource.includes('robots="noindex,follow"')) {
  failures.push("/search must remain noindex,follow");
}

const postLayout = read("src/layouts/PostLayout.astro");
for (const marker of ["/author", "/editorial-policy", "content-basis", "field-note-meta"]) {
  if (!postLayout.includes(marker)) failures.push(`PostLayout trust marker missing: ${marker}`);
}

const baseLayout = read("src/layouts/BaseLayout.astro");
for (const route of ["/search", "/contact", "/privacy", "/terms", "/about", "/author", "/editorial-policy"]) {
  if (!baseLayout.includes(`"${route}"`)) failures.push(`BaseLayout ad-free route missing: ${route}`);
}

const markdownFiles = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"));
let guides = 0;
let fieldNotes = 0;
const weakGuides = [];
for (const file of markdownFiles) {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = fmMatch?.[1] ?? "";
  const body = fmMatch ? source.slice(fmMatch[0].length) : source;
  const isFieldNote = /^contentType:\s*["']?field-note["']?\s*$/m.test(frontmatter);
  if (isFieldNote) {
    fieldNotes += 1;
    continue;
  }

  guides += 1;
  const internalLinks = (body.match(/\]\(\/(?!\/)[^)]+\)/g) ?? []).length;
  const externalLinks = (body.match(/\]\(https:\/\/[^)]+\)/g) ?? []).length;
  const media = (body.match(/!\[[^\]]*\]\([^)]+\)|<video\b/gi) ?? []).length;
  const headings = (body.match(/^##\s+/gm) ?? []).length;
  const visible = body
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const riskSignals = [
    visible.length < 1200,
    headings < 3,
    externalLinks === 0 && media === 0,
    internalLinks < 2
  ].filter(Boolean).length;

  if (visible.length < 900 || riskSignals >= 2 || (externalLinks === 0 && media === 0) || internalLinks < 2) {
    weakGuides.push(`${file} (risk=${riskSignals}, chars=${visible.length}, internal=${internalLinks}, external=${externalLinks}, media=${media})`);
  }
}

if (weakGuides.length > 0) {
  failures.push(`guide quality gate found ${weakGuides.length} priority candidate(s):\n  ${weakGuides.join("\n  ")}`);
}

const searchHtml = path.join(dist, "search.html");
if (!fs.existsSync(searchHtml)) {
  failures.push("built /search.html is missing");
} else {
  const html = fs.readFileSync(searchHtml, "utf8");
  if (!/name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*follow/i.test(html)) {
    failures.push("built /search.html does not contain noindex,follow robots metadata");
  }
}

if (failures.length > 0) {
  console.error("\nAdSense approval readiness gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\n=== AdSense approval readiness gate ===");
console.log(`Content: ${markdownFiles.length} posts / ${guides} guides / ${fieldNotes} field notes`);
console.log("Priority guide quality candidates: 0");
console.log("Trust/legal pages: present");
console.log("Author/editorial trust links: present on articles");
console.log("Search indexing: noindex,follow");
console.log("Robots + sitemap discovery: configured");
console.log("Ad-free utility/trust routes: declared");
console.log("Final source/build readiness gate passed.\n");
