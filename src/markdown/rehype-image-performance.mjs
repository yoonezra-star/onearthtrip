import { existsSync, readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const publicRoot = resolve(process.cwd(), "public");
const sizeCache = new Map();

function getPublicFilePath(src) {
  const pathOnly = src.split("#", 1)[0].split("?", 1)[0];
  if (!pathOnly.startsWith("/images/")) return undefined;

  const filePath = resolve(publicRoot, `.${pathOnly}`);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) return undefined;
  return filePath;
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
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
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

  const filePath = getPublicFilePath(src);
  if (!filePath || !existsSync(filePath)) {
    sizeCache.set(src, undefined);
    return undefined;
  }

  try {
    const buffer = readFileSync(filePath);
    const extension = extname(filePath).toLowerCase();
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

function visit(node) {
  if (!node || typeof node !== "object") return;

  if (node.type === "element" && node.tagName === "img") {
    node.properties ??= {};
    node.properties.loading ??= "lazy";
    node.properties.decoding ??= "async";

    const src = typeof node.properties.src === "string" ? node.properties.src : undefined;
    if (src?.startsWith("/images/") && (node.properties.width == null || node.properties.height == null)) {
      const size = getPublicImageSize(src);
      if (size) {
        node.properties.width ??= size.width;
        node.properties.height ??= size.height;
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child);
  }
}

export default function rehypeImagePerformance() {
  return (tree) => visit(tree);
}
