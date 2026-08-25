import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");
const publicRoot = resolve(root, "public");
const maxImageBytes = 1024 * 1024;
const issues = [];
const referencedImages = new Set();

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

function normalizeImagePath(value) {
  return value.split("#", 1)[0].split("?", 1)[0];
}

function getPublicFilePath(src) {
  const pathOnly = normalizeImagePath(src);
  if (!pathOnly.startsWith("/images/")) return undefined;

  const filePath = resolve(publicRoot, `.${pathOnly}`);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) return undefined;

  return filePath;
}

async function checkImageReference(src, fileLabel) {
  const filePath = getPublicFilePath(src);
  if (!filePath) return;

  referencedImages.add(filePath);
  try {
    await stat(filePath);
  } catch {
    issues.push(`${fileLabel}: missing image file ${normalizeImagePath(src)}`);
  }
}

const sourceFiles = (await walk(srcDir)).filter((file) => {
  const extension = extname(file);
  return extension === ".md" || extension === ".astro";
});

for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  const relativePath = relative(root, file);

  if (file.endsWith(".md")) {
    const heroMatch = text.match(/^heroImage:\s*["']([^"']+)["']/m);
    if (heroMatch) {
      await checkImageReference(heroMatch[1], `${relativePath}:heroImage`);
    }
  }

  for (const match of text.matchAll(/!\[([^\]]*)\]\((\/images\/[^)\s]+)(?:\s+["'][^)]*["'])?\)/g)) {
    const alt = match[1].trim();
    const src = match[2];
    const label = `${relativePath}:${lineNumber(text, match.index ?? 0)}`;

    if (!alt) issues.push(`${label}: Markdown image has empty alt text ${src}`);
    await checkImageReference(src, label);
  }

  for (const match of text.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = tag.match(/\bsrc=["'](\/images\/[^"']+)["']/i)?.[1];
    if (!src) continue;

    const label = `${relativePath}:${lineNumber(text, match.index ?? 0)}`;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    if (!altMatch || !altMatch[1].trim()) {
      issues.push(`${label}: HTML image has missing or empty alt text ${src}`);
    }

    await checkImageReference(src, label);
  }
}

for (const filePath of referencedImages) {
  try {
    const info = await stat(filePath);
    if (info.size > maxImageBytes) {
      issues.push(
        `${relative(root, filePath)}: referenced image is ${(info.size / 1024 / 1024).toFixed(2)} MB; keep public images at or below 1 MB`
      );
    }
  } catch {
    // Missing files are reported at the reference location above.
  }
}

if (issues.length > 0) {
  console.error(`Image validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Image validation passed: ${referencedImages.size} referenced public image file(s) checked.`);
