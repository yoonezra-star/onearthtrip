import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");
const publicRoot = resolve(root, "public");
const publicVideoDir = resolve(publicRoot, "videos", "actual");
const maxVideoBytes = 25 * 1024 * 1024;
const minVideoBytes = 100 * 1024;
const issues = [];
const referencedVideos = new Set();

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filePath));
    else files.push(filePath);
  }
  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function normalizePublicPath(value) {
  return value.split("#", 1)[0].split("?", 1)[0];
}

function publicFilePath(value, prefix) {
  const normalized = normalizePublicPath(value);
  if (!normalized.startsWith(prefix)) return undefined;
  const filePath = resolve(publicRoot, `.${normalized}`);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) return undefined;
  return filePath;
}

async function requirePublicFile(value, prefix, label, kind) {
  const filePath = publicFilePath(value, prefix);
  if (!filePath) {
    issues.push(`${label}: ${kind} must use a local ${prefix} path (${value})`);
    return undefined;
  }
  try {
    await stat(filePath);
    return filePath;
  } catch {
    issues.push(`${label}: missing ${kind} file ${normalizePublicPath(value)}`);
    return undefined;
  }
}

const sourceFiles = (await walk(srcDir)).filter((file) => {
  const extension = extname(file);
  return extension === ".md" || extension === ".astro";
});

for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  const relativePath = relative(root, file);

  for (const match of text.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi)) {
    const attributes = match[1];
    const body = match[2];
    const label = `${relativePath}:${lineNumber(text, match.index ?? 0)}`;

    if (!/\bcontrols(?:\s|=|$)/i.test(attributes)) {
      issues.push(`${label}: video must expose native controls`);
    }
    if (!/\bpreload=["']metadata["']/i.test(attributes)) {
      issues.push(`${label}: video must use preload=\"metadata\"`);
    }
    if (!/\bplaysinline(?:\s|=|$)/i.test(attributes)) {
      issues.push(`${label}: video must use playsinline for mobile UX`);
    }
    if (/\bautoplay(?:\s|=|$)/i.test(attributes)) {
      issues.push(`${label}: autoplay is not allowed for article video`);
    }

    const poster = attributes.match(/\bposter=["']([^"']+)["']/i)?.[1];
    if (!poster) {
      issues.push(`${label}: video must declare a poster image`);
    } else {
      await requirePublicFile(poster, "/images/", label, "poster image");
    }

    const sources = [...body.matchAll(/<source\b([^>]*)>/gi)];
    if (sources.length === 0) {
      issues.push(`${label}: video must contain at least one <source>`);
    }

    for (const sourceMatch of sources) {
      const sourceAttrs = sourceMatch[1];
      const src = sourceAttrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const type = sourceAttrs.match(/\btype=["']([^"']+)["']/i)?.[1];

      if (!src) {
        issues.push(`${label}: video source is missing src`);
        continue;
      }
      if (type !== "video/mp4") {
        issues.push(`${label}: local article video source must declare type=\"video/mp4\"`);
      }

      const filePath = await requirePublicFile(src, "/videos/", label, "video");
      if (filePath) referencedVideos.add(filePath);
    }

    const contextStart = Math.max(0, (match.index ?? 0) - 400);
    const contextEnd = Math.min(text.length, (match.index ?? 0) + match[0].length + 400);
    const context = text.slice(contextStart, contextEnd);
    if (!/<figure\b[^>]*class=["'][^"']*article-media[^"']*["'][^>]*>[\s\S]*<figcaption>[^<]+<\/figcaption>[\s\S]*<\/figure>/i.test(context)) {
      issues.push(`${label}: article video must be wrapped in .article-media with a non-empty figcaption`);
    }
  }
}

for (const filePath of referencedVideos) {
  const info = await stat(filePath);
  if (info.size > maxVideoBytes) {
    issues.push(`${relative(root, filePath)}: ${(info.size / 1024 / 1024).toFixed(2)} MB exceeds the 25 MB article-video limit`);
  }
  if (info.size < minVideoBytes) {
    issues.push(`${relative(root, filePath)}: video is unexpectedly small (${(info.size / 1024).toFixed(0)} KB)`);
  }
  if (extname(filePath).toLowerCase() !== ".mp4") {
    issues.push(`${relative(root, filePath)}: article videos must be MP4`);
  }
}

try {
  const actualVideos = (await readdir(publicVideoDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(publicVideoDir, entry.name));

  for (const filePath of actualVideos) {
    if (!referencedVideos.has(filePath)) {
      issues.push(`${relative(root, filePath)}: unreferenced first-party video asset`);
    }
  }
} catch {
  issues.push("public/videos/actual: expected first-party video directory is missing");
}

if (issues.length > 0) {
  console.error(`Media validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Media validation passed: ${referencedVideos.size} first-party article video file(s) checked.`);
