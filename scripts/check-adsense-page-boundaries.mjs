import fs from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");
const adsenseMarkers = [
  "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
  "ca-pub-6918910185244897"
];

const adFreeRoutes = [
  "/search",
  "/404",
  "/contact",
  "/privacy",
  "/terms",
  "/about",
  "/author",
  "/editorial-policy"
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

const violations = [];
for (const route of adFreeRoutes) {
  const html = readRoute(route);
  const found = adsenseMarkers.filter((marker) => html.includes(marker));
  if (found.length > 0) violations.push(`${route}: ${found.join(", ")}`);
}

const homeHtml = readRoute("/");
if (!adsenseMarkers.every((marker) => homeHtml.includes(marker))) {
  violations.push("/: expected AdSense loader/client marker is missing from the main content surface");
}

if (violations.length > 0) {
  console.error("AdSense page-boundary validation failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`AdSense page-boundary validation passed: ${adFreeRoutes.length} utility/trust pages are ad-free; homepage keeps the site-level loader.`);
