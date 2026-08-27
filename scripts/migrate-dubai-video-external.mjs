import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

const sourcePath = "public/videos/actual/dubai-fountain-2012-mosaic-v3.mp4";
const destPath = "media/dubai-fountain-2012-mosaic-v3.mp4";
const rawUrl = "https://raw.githubusercontent.com/yoonezra-star/onearthtrip/main/media/dubai-fountain-2012-mosaic-v3.mp4";
const expectedSize = 64463666;
const expectedSha = "fbadd3e1b653a83083467f03603c271e76c60f633a6f1f0f79a7307c7b824632";

const source = await readFile(sourcePath);
const sourceStat = await stat(sourcePath);
const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceStat.size !== expectedSize) throw new Error(`Unexpected source size: ${sourceStat.size}`);
if (sourceSha !== expectedSha) throw new Error(`Unexpected source SHA-256: ${sourceSha}`);

await mkdir("media", { recursive: true });
await rename(sourcePath, destPath);

const moved = await readFile(destPath);
const movedStat = await stat(destPath);
const movedSha = createHash("sha256").update(moved).digest("hex");
if (movedStat.size !== expectedSize) throw new Error(`Unexpected moved size: ${movedStat.size}`);
if (movedSha !== expectedSha) throw new Error(`Unexpected moved SHA-256: ${movedSha}`);

const postPath = "src/content/posts/dubai-burj-khalifa-2012.md";
let post = await readFile(postPath, "utf8");
const oldVideoPath = "/videos/actual/dubai-fountain-2012-mosaic-v3.mp4";
if (!post.includes(oldVideoPath)) throw new Error(`Article source not found: ${oldVideoPath}`);
post = post.replace(oldVideoPath, rawUrl);
await writeFile(postPath, post, "utf8");

const mediaCheckPath = "scripts/check-media.mjs";
let mediaCheck = await readFile(mediaCheckPath, "utf8");
const oldExact = 'const exactDubaiVideo = "public/videos/actual/dubai-fountain-2012-mosaic-v3.mp4";';
const newExact = `const exactDubaiVideo = "media/dubai-fountain-2012-mosaic-v3.mp4";\nconst exactDubaiVideoSource = "${rawUrl}";`;
if (!mediaCheck.includes(oldExact)) throw new Error("Expected exactDubaiVideo declaration not found");
mediaCheck = mediaCheck.replace(oldExact, newExact);

const oldSourceBlock = `      const filePath = await requirePublicFile(src, "/videos/", label, "video");\n      if (filePath) referencedVideos.add(filePath);`;
const newSourceBlock = `      let filePath;\n      if (src === exactDubaiVideoSource) {\n        filePath = resolve(root, exactDubaiVideo);\n        try {\n          await stat(filePath);\n        } catch {\n          issues.push(\`\${label}: missing exact external Dubai video source file \${exactDubaiVideo}\`);\n          filePath = undefined;\n        }\n      } else {\n        filePath = await requirePublicFile(src, "/videos/", label, "video");\n      }\n      if (filePath) referencedVideos.add(filePath);`;
if (!mediaCheck.includes(oldSourceBlock)) throw new Error("Expected check-media source block not found");
mediaCheck = mediaCheck.replace(oldSourceBlock, newSourceBlock);
await writeFile(mediaCheckPath, mediaCheck, "utf8");

const livePath = "scripts/check-live-site.mjs";
let live = await readFile(livePath, "utf8");
const oldLiveConst = 'const dubaiMosaicVideoPath = "/videos/actual/dubai-fountain-2012-mosaic-v3.mp4";';
const newLiveConst = `const dubaiMosaicVideoUrl = "${rawUrl}";`;
if (!live.includes(oldLiveConst)) throw new Error("Expected live video path declaration not found");
live = live.replace(oldLiveConst, newLiveConst);

const oldHtmlCheck = `      test: (html) => html.includes(\`src=\\"\${dubaiMosaicVideoPath}\\"\`)\n        || html.includes(\`src='\${dubaiMosaicVideoPath}'\`)`;
const newHtmlCheck = `      test: (html) => html.includes(\`src=\\"\${dubaiMosaicVideoUrl}\\"\`)\n        || html.includes(\`src='\${dubaiMosaicVideoUrl}'\`)`;
if (!live.includes(oldHtmlCheck)) throw new Error("Expected live HTML video-source check not found");
live = live.replace(oldHtmlCheck, newHtmlCheck);

const oldAssetCall = `  \`\${canonicalOrigin}\${dubaiMosaicVideoPath}\`,\n  "Dubai fountain mosaic video",`;
const newAssetCall = `  dubaiMosaicVideoUrl,\n  "Dubai fountain mosaic video",`;
if (!live.includes(oldAssetCall)) throw new Error("Expected live video asset call not found");
live = live.replace(oldAssetCall, newAssetCall);

const oldMimeCheck = `    if (!contentType.toLowerCase().includes("video/mp4")) {\n      fail(\`\${label}: expected video/mp4, got \${contentType || "no content-type"}.\`);\n      return;\n    }`;
const newMimeCheck = `    const normalizedType = contentType.toLowerCase();\n    if (!normalizedType.includes("video/mp4") && !normalizedType.includes("application/octet-stream")) {\n      fail(\`\${label}: expected video/mp4 or application/octet-stream, got \${contentType || "no content-type"}.\`);\n      return;\n    }`;
if (!live.includes(oldMimeCheck)) throw new Error("Expected live MIME check not found");
live = live.replace(oldMimeCheck, newMimeCheck);
if (live.includes("dubaiMosaicVideoPath")) throw new Error("Stale dubaiMosaicVideoPath reference remains");
await writeFile(livePath, live, "utf8");

for (const path of [
  ".github/workflows/test-github-video-stream.yml",
  ".github/workflows/move-exact-dubai-video.yml",
  ".github/workflows/run-dubai-video-migration.yml",
  "scripts/migrate-dubai-video-external.mjs",
]) {
  await rm(path, { force: true });
}

console.log(`Exact Dubai video moved outside Pages assets: ${expectedSize} bytes, SHA-256 ${expectedSha}`);
console.log(`Article source now uses ${rawUrl}`);
