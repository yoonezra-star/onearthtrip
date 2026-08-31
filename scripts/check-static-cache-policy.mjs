import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const headersPath = path.join(root, "public", "_headers");
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(headersPath)) {
  fail("public/_headers is missing");
} else {
  const text = fs.readFileSync(headersPath, "utf8");

  const requiredGlobalHeaders = [
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Permissions-Policy: camera=(), microphone=(), geolocation=()"
  ];

  for (const header of requiredGlobalHeaders) {
    if (!text.includes(header)) fail(`missing global security header: ${header}`);
  }

  const policies = [
    {
      path: "/_astro/*",
      required: ["public", "max-age=31536000", "immutable"]
    },
    {
      path: "/images/*",
      required: ["public", "max-age=86400", "stale-while-revalidate=604800"]
    },
    {
      path: "/videos/*",
      required: ["public", "max-age=86400", "stale-while-revalidate=604800"]
    }
  ];

  for (const policy of policies) {
    const escapedPath = policy.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockMatch = text.match(new RegExp(`(?:^|\\n)${escapedPath}\\s*\\n((?:[ \\t]+[^\\n]+\\n?)*)`, "m"));
    if (!blockMatch) {
      fail(`missing cache policy block for ${policy.path}`);
      continue;
    }

    const cacheControl = blockMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .find((line) => /^Cache-Control:/i.test(line));

    if (!cacheControl) {
      fail(`${policy.path}: Cache-Control header is missing`);
      continue;
    }

    const normalized = cacheControl.toLowerCase();
    for (const token of policy.required) {
      if (!normalized.includes(token.toLowerCase())) {
        fail(`${policy.path}: Cache-Control must include ${token}`);
      }
    }
  }

  const rootBlock = text.match(/^\/\*\s*\n((?:[ \t]+[^\n]+\n?)*)/m)?.[1] ?? "";
  if (/Cache-Control:\s*[^\n]*immutable/i.test(rootBlock)) {
    fail("global /* headers must not mark HTML responses immutable");
  }
}

if (failures.length > 0) {
  console.error(`Static cache policy validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Static cache policy passed: hashed Astro assets are immutable for one year; first-party images and videos use one-day browser caching with stale-while-revalidate."
);
