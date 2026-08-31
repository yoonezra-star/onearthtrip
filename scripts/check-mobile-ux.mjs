import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const layoutPath = path.join(root, "src", "layouts", "BaseLayout.astro");
const mobileCssPath = path.join(root, "src", "styles", "mobile-ux.css");
const homePath = path.join(root, "dist", "index.html");
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(file, label) {
  if (!fs.existsSync(file)) {
    fail(`${label} is missing: ${path.relative(root, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function selectorHas(css, selector, property, valuePattern) {
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  return blocks.some((match) => {
    const selectors = match[1]
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!selectors.includes(selector)) return false;
    const declaration = new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*${valuePattern}`, "i");
    return declaration.test(match[2]);
  });
}

const layout = read(layoutPath, "BaseLayout");
const css = read(mobileCssPath, "mobile UX stylesheet");
const home = read(homePath, "built homepage");

if (!layout.includes('import "../styles/mobile-ux.css";')) {
  fail("BaseLayout must import mobile-ux.css after global.css");
}

const requiredTouchSelectors = [
  ".brand",
  ".nav a",
  ".header-contact",
  ".header-search-form input",
  ".header-search-form button",
  ".read-more",
  ".reset-button"
];

for (const selector of requiredTouchSelectors) {
  if (!selectorHas(css, selector, "min-height", "44px")) {
    fail(`${selector}: primary touch target must have min-height: 44px`);
  }
}

if (!selectorHas(css, ".header-search-form button", "min-width", "48px")) {
  fail("header search button must keep at least 48px width");
}

if (!selectorHas(css, ".nav", "overscroll-behavior-inline", "contain")) {
  fail("horizontal navigation must contain overscroll within the nav strip");
}

for (const selector of [".article-body pre", ".article-body table"]) {
  if (!selectorHas(css, selector, "max-width", "100%")) {
    fail(`${selector}: wide content must be bounded by the article width`);
  }
  if (!selectorHas(css, selector, "overflow-x", "auto")) {
    fail(`${selector}: wide content must scroll locally instead of widening the page`);
  }
}

if (!/@media\s*\(max-width:\s*420px\)[\s\S]*?\.header-actions[\s\S]*?min-width:\s*0/s.test(css)) {
  fail("<=420px layout must allow header actions to shrink instead of forcing body overflow");
}
if (!/@media\s*\(max-width:\s*420px\)[\s\S]*?\.header-search-form input[\s\S]*?width:\s*min\(80px,\s*24vw\)/s.test(css)) {
  fail("<=420px search input must use viewport-aware width");
}
if (!/@media\s*\(max-width:\s*640px\)[\s\S]*?\.footer-links a[\s\S]*?min-height:\s*44px/s.test(css)) {
  fail("mobile footer links must expose 44px touch height");
}

const htmlChecks = [
  [/<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1"\s*\/?>/i, "responsive viewport meta"],
  [/<nav\s+class="nav"\s+aria-label="주요 메뉴">/i, "labelled primary navigation"],
  [/<form\s+class="header-search-form"\s+role="search"[^>]*>/i, "semantic header search"],
  [/<input[^>]+type="search"[^>]+name="q"[^>]*>/i, "search input"],
  [/<button\s+type="submit">검색<\/button>/i, "search submit button"],
  [/<a\s+class="skip-link"\s+href="#content">/i, "skip link"]
];

for (const [pattern, label] of htmlChecks) {
  if (!pattern.test(home)) fail(`built homepage is missing ${label}`);
}

if (failures.length > 0) {
  console.error(`Mobile UX validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Mobile UX validation passed: primary header/navigation controls meet 44px touch sizing, narrow header content can shrink, horizontal nav/pre/table overflow stays local, and responsive search/navigation semantics are present."
);
