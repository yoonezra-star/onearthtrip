import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");

const replacements = [
  ["/2026/08/uae-personal-photo-archive.html", "/2026/08/uae-personal-photo-archive"],
  ["/2014/05/abu-dhabi-water-delivery-2014.html", "/2014/09/abu-dhabi-water-delivery-2014"],
  ["/2014/05/abu-dhabi-water-delivery-2014", "/2014/09/abu-dhabi-water-delivery-2014"]
];

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

const files = (await walk(srcDir)).filter((file) => {
  const extension = extname(file);
  return extension === ".md" || extension === ".astro";
});

let changedFiles = 0;
let changedLinks = 0;

for (const file of files) {
  const original = await readFile(file, "utf8");
  let next = original;

  for (const [from, to] of replacements) {
    const count = next.split(from).length - 1;
    if (count > 0) {
      next = next.split(from).join(to);
      changedLinks += count;
    }
  }

  if (next !== original) {
    await writeFile(file, next, "utf8");
    changedFiles += 1;
    console.log(`normalized ${relative(root, file)}`);
  }
}

console.log(`Normalized ${changedLinks} link occurrence(s) across ${changedFiles} file(s).`);
