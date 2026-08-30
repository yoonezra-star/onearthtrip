import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const postsDir = path.join(root, "src", "content", "posts");
const distDir = path.join(root, "dist");
const publicDir = path.join(root, "public");
const sizeCache = new Map();
let modifiedFiles = 0;
let modifiedTags = 0;

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

function addAttribute(tag, name, value) {
  if (new RegExp(`\\b${name}=`, "i").test(tag)) return tag;
  if (/\/>$/.test(tag)) return tag.replace(/\/>$/, ` ${name}="${value}" />`);
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function getPngSize(buffer) {
  if (buffer.length < 24 || buffer[0] !== 0x89 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return undefined;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getGifSize(buffer) {
  if (buffer.length < 10 || !buffer.toString("ascii", 0, 6).startsWith("GIF8")) return undefined;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function getWebpSize(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return undefined;
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (chunkType === "VP8L" && buffer[20] === 0x2f) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + b0 + ((b1 & 0x3f) << 8),
      height: 1 + ((b1 & 0xc0) >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10)
    };
  }
  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  return undefined;
}

function getJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    if (offset + 4 > buffer.length) return undefined;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) return undefined;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }

    offset += 2 + segmentLength;
  }
  return undefined;
}

function getPublicImageSize(src) {
  if (sizeCache.has(src)) return sizeCache.get(src);

  const clean = src.split("#", 1)[0].split("?", 1)[0];
  if (!clean.startsWith("/images/")) return undefined;
  const file = path.join(publicDir, clean.replace(/^\//, ""));
  if (!fs.existsSync(file)) return undefined;

  try {
    const buffer = fs.readFileSync(file);
    const extension = path.extname(file).toLowerCase();
    const size =
      extension === ".webp"
        ? getWebpSize(buffer)
        : extension === ".png"
          ? getPngSize(buffer)
          : extension === ".jpg" || extension === ".jpeg"
            ? getJpegSize(buffer)
            : extension === ".gif"
              ? getGifSize(buffer)
              : undefined;
    sizeCache.set(src, size);
    return size;
  } catch {
    sizeCache.set(src, undefined);
    return undefined;
  }
}

if (!fs.existsSync(distDir)) {
  console.error("Rendered image optimization failed: dist is missing. Run Astro build first.");
  process.exit(1);
}

const postFiles = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md")).sort();

for (const name of postFiles) {
  const source = fs.readFileSync(path.join(postsDir, name), "utf8");
  if (/^draft:\s*true\s*$/m.test(source)) continue;

  const permalink = source.match(/^permalink:\s*["']([^"']+)["']/m)?.[1];
  if (!permalink) continue;

  const imageRefs = new Set(
    [...source.matchAll(/!\[[^\]]*\]\((\/images\/[^)\s]+)(?:\s+["'][^)]*["'])?\)/g)].map((match) => match[1])
  );
  if (imageRefs.size === 0) continue;

  const builtFile = routeToBuiltFile(getPublicPath(permalink));
  if (!fs.existsSync(builtFile)) continue;

  const original = fs.readFileSync(builtFile, "utf8");
  const optimized = original.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = getAttribute(tag, "src");
    if (!src || !imageRefs.has(src)) return tag;

    const currentLoading = getAttribute(tag, "loading");
    if (currentLoading === "eager") return tag;

    let next = tag;
    next = addAttribute(next, "loading", "lazy");
    next = addAttribute(next, "decoding", "async");

    const size = getPublicImageSize(src);
    if (size) {
      next = addAttribute(next, "width", String(size.width));
      next = addAttribute(next, "height", String(size.height));
    }

    if (next !== tag) modifiedTags += 1;
    return next;
  });

  if (optimized !== original) {
    fs.writeFileSync(builtFile, optimized);
    modifiedFiles += 1;
  }
}

console.log(`Rendered image optimization complete: ${modifiedTags} image tag(s) updated across ${modifiedFiles} published article file(s).`);
