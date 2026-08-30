import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const postsDir = path.join(root, "src", "content", "posts");
const distDir = path.join(root, "dist");
const failures = [];
let articleCount = 0;
let imageReferenceCount = 0;

function fail(message) {
  failures.push(message);
}

function getPublicPath(value) {
  const normalized = value
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "")
    .replace(/\/$/, "");
  return normalized || "/";
}

function routeToBuiltFile(route) {
  if (route === "/") return path.join(distDir, "index.html");
  return path.join(distDir, `${route.replace(/^\//, "")}.html`);
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match?.[1];
}

if (!fs.existsSync(distDir)) {
  console.error("Rendered image performance validation failed: dist is missing. Run the build first.");
  process.exit(1);
}

const postFiles = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md")).sort();

for (const name of postFiles) {
  const sourcePath = path.join(postsDir, name);
  const source = fs.readFileSync(sourcePath, "utf8");
  if (/^draft:\s*true\s*$/m.test(source)) continue;

  const permalink = source.match(/^permalink:\s*["']([^"']+)["']/m)?.[1];
  if (!permalink) continue;

  const imageRefs = [...source.matchAll(/!\[[^\]]*\]\((\/images\/[^)\s]+)(?:\s+["'][^)]*["'])?\)/g)]
    .map((match) => match[1]);
  const uniqueRefs = [...new Set(imageRefs)];
  if (uniqueRefs.length === 0) continue;

  articleCount += 1;
  imageReferenceCount += uniqueRefs.length;

  const route = getPublicPath(permalink);
  const builtFile = routeToBuiltFile(route);
  if (!fs.existsSync(builtFile)) {
    fail(`${name}: published article is missing at ${path.relative(root, builtFile)}`);
    continue;
  }

  const html = fs.readFileSync(builtFile, "utf8");
  const tags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);

  for (const src of uniqueRefs) {
    const matchingTags = tags.filter((tag) => getAttribute(tag, "src") === src);
    if (matchingTags.length === 0) {
      fail(`${name}: rendered HTML is missing Markdown image ${src}`);
      continue;
    }

    const optimized = matchingTags.some((tag) => {
      const loading = getAttribute(tag, "loading");
      const decoding = getAttribute(tag, "decoding");
      const width = Number(getAttribute(tag, "width"));
      const height = Number(getAttribute(tag, "height"));
      return loading === "lazy"
        && decoding === "async"
        && Number.isFinite(width)
        && width > 0
        && Number.isFinite(height)
        && height > 0;
    });

    if (!optimized) {
      fail(`${name}: Markdown image ${src} must render with loading=lazy, decoding=async, width, and height`);
    }
  }
}

if (articleCount === 0 || imageReferenceCount === 0) {
  fail("no rendered Markdown article images were found to validate");
}

if (failures.length > 0) {
  console.error(`Rendered image performance validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Rendered image performance passed: ${imageReferenceCount} unique Markdown image reference(s) across ${articleCount} published article(s) render with lazy loading, async decoding, and intrinsic dimensions.`
);
