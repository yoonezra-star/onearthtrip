import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const archivePath = join(
  process.cwd(),
  "src",
  "content",
  "posts",
  "uae-personal-photo-archive.md"
);

const original = await readFile(archivePath, "utf8");
const next = original.replace(
  'permalink: "/2026/08/uae-personal-photo-archive"',
  'permalink: "/2026/08/uae-personal-photo-archive.html"'
);

if (next !== original) {
  await writeFile(archivePath, next, "utf8");
  console.log("Restored the established personal photo archive permalink.");
} else {
  console.log("Personal photo archive permalink already preserved.");
}
