import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const postsDir = path.join(root, "src", "content", "posts");
const distDir = path.join(root, "dist");
const failures = [];
let heroArticleCount = 0;
let cardImageCount = 0;

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

function hasIntrinsicSize(tag) {
  const width = Number(getAttribute(tag, "width"));
  const height = Number(getAttribute(tag, "height"));
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

function isHighPriorityImage(tag) {
  return getAttribute(tag, "loading") === "eager"
    && getAttribute(tag, "fetchpriority") === "high"
    && getAttribute(tag, "decoding") === "async"
    && hasIntrinsicSize(tag);
}

function isDeferredCardImage(tag) {
  return getAttribute(tag, "loading") === "lazy"
    && getAttribute(tag, "decoding") === "async"
    && getAttribute(tag, "fetchpriority") !== "high"
    && hasIntrinsicSize(tag);
}

if (!fs.existsSync(distDir)) {
  console.error("Rendered image priority validation failed: dist is missing. Run the build first.");
  process.exit(1);
}

const homeFile = path.join(distDir, "index.html");
if (!fs.existsSync(homeFile)) {
  fail("homepage build output is missing");
} else {
  const homeHtml = fs.readFileSync(homeFile, "utf8");
  const heroMatch = homeHtml.match(/<a\b[^>]*class=["'][^"']*\bhero-feature\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const heroImg = heroMatch?.[1]?.match(/<img\b[^>]*>/i)?.[0];
  if (!heroImg) {
    fail("homepage: hero-feature must contain an image");
  } else if (!isHighPriorityImage(heroImg)) {
    fail("homepage: hero image must render with loading=eager, fetchpriority=high, decoding=async, width, and height");
  }
}

const postFiles = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md")).sort();
for (const name of postFiles) {
  const source = fs.readFileSync(path.join(postsDir, name), "utf8");
  if (/^draft:\s*true\s*$/m.test(source)) continue;

  const permalink = source.match(/^permalink:\s*["']([^"']+)["']/m)?.[1];
  const heroImage = source.match(/^heroImage:\s*["']([^"']+)["']/m)?.[1];
  if (!permalink || !heroImage) continue;

  const builtFile = routeToBuiltFile(getPublicPath(permalink));
  if (!fs.existsSync(builtFile)) {
    fail(`${name}: published hero article build output is missing`);
    continue;
  }

  const html = fs.readFileSync(builtFile, "utf8");
  const matchingTags = [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => getAttribute(tag, "src") === heroImage);

  if (matchingTags.length === 0) {
    fail(`${name}: rendered article is missing hero image ${heroImage}`);
    continue;
  }

  if (!matchingTags.some(isHighPriorityImage)) {
    fail(`${name}: hero image ${heroImage} must have an eager/high-priority intrinsically-sized rendered instance`);
    continue;
  }

  heroArticleCount += 1;
}

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(fullPath);
  }
}
walk(distDir);

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const cards = [...html.matchAll(/<article\b[^>]*class=["'][^"']*\bpost-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)];
  for (const card of cards) {
    const images = [...card[1].matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    for (const img of images) {
      cardImageCount += 1;
      if (!isDeferredCardImage(img)) {
        fail(`${path.relative(root, htmlFile)}: post-card image must render with loading=lazy, decoding=async, intrinsic dimensions, and without fetchpriority=high`);
      }
    }
  }
}

if (heroArticleCount === 0) fail("no published article hero images were found to validate");
if (cardImageCount === 0) fail("no rendered post-card images were found to validate");

if (failures.length > 0) {
  console.error(`Rendered image priority validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Rendered image priority passed: homepage plus ${heroArticleCount} published article hero image(s) keep eager/high LCP priority, while ${cardImageCount} rendered post-card image instance(s) remain lazy/deferred.`
);
