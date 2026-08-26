import fs from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");
const adsenseLoaderMarker = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
const publisherId = "ca-pub-6918910185244897";
const accountMetaMarker = `name=\"google-adsense-account\" content=\"${publisherId}\"`;

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
  if (html.includes(adsenseLoaderMarker)) {
    violations.push(`${route}: AdSense loader script must not be present`);
  }
  if (!html.includes(accountMetaMarker)) {
    violations.push(`${route}: AdSense account verification meta should remain present`);
  }
}

const homeHtml = readRoute("/");
if (!homeHtml.includes(adsenseLoaderMarker)) {
  violations.push("/: expected AdSense loader is missing from the main content surface");
}
if (!homeHtml.includes(accountMetaMarker)) {
  violations.push("/: expected AdSense account verification meta is missing");
}

if (violations.length > 0) {
  console.error("AdSense page-boundary validation failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`AdSense page-boundary validation passed: ${adFreeRoutes.length} utility/trust pages keep account verification meta without loading the ad script; homepage keeps both.`);
