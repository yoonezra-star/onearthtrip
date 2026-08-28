import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "src", "data", "media-privacy-reviews.json");
const postsDir = join(root, "src", "content", "posts");
const publicDir = join(root, "public");
const actualDirs = [
  join(publicDir, "images", "actual"),
  join(publicDir, "videos", "actual")
];
const allowedStatuses = new Set(["needs-review", "reviewed", "privacy-edited", "privacy-action-needed"]);
const allowedPriorities = new Set(["normal", "high"]);
const failures = [];

function fail(message) {
  failures.push(message);
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(path));
    else files.push(path);
  }
  return files;
}

function toWebPath(file) {
  return `/${relative(publicDir, file).split(sep).join("/")}`;
}

function getFrontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  return match?.[1] ?? "";
}

function isFieldNote(text) {
  return /^contentType:\s*["']?field-note["']?\s*$/m.test(getFrontmatter(text));
}

function collectActualMediaRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(/\/(?:images|videos)\/actual\/[A-Za-z0-9._/-]+/g)) {
    refs.add(match[0]);
  }
  return refs;
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`Media privacy validation failed: cannot read manifest (${error.message}).`);
  process.exit(1);
}

if (manifest?.version !== 1 || !manifest.media || typeof manifest.media !== "object") {
  console.error("Media privacy validation failed: manifest must have version=1 and a media object.");
  process.exit(1);
}

const entries = manifest.media;
const inventoryFiles = (await Promise.all(actualDirs.map(walkFiles))).flat();
const inventoryPaths = inventoryFiles.map(toWebPath).sort();
const inventorySet = new Set(inventoryPaths);
const manifestPaths = Object.keys(entries).sort();

for (const mediaPath of inventoryPaths) {
  if (!entries[mediaPath]) {
    fail(`${mediaPath}: first-party /actual/ media is missing from privacy manifest`);
  }
}

for (const mediaPath of manifestPaths) {
  const entry = entries[mediaPath];

  if (!inventorySet.has(mediaPath)) {
    fail(`${mediaPath}: privacy manifest entry points to a missing /actual/ file`);
  }
  if (!allowedStatuses.has(entry?.status)) {
    fail(`${mediaPath}: invalid privacy status ${JSON.stringify(entry?.status)}`);
  }
  if (typeof entry?.note !== "string" || entry.note.trim().length < 12) {
    fail(`${mediaPath}: privacy manifest note must explain the recorded status`);
  }
  if (entry?.status !== "needs-review") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry?.reviewedDate ?? "")) {
      fail(`${mediaPath}: ${entry.status} requires reviewedDate in YYYY-MM-DD format`);
    }
  }
  if (entry?.status === "privacy-action-needed") {
    if (!allowedPriorities.has(entry?.priority)) {
      fail(`${mediaPath}: privacy-action-needed requires priority=normal or high`);
    }
  }
}

const postNames = (await readdir(postsDir)).filter((name) => name.endsWith(".md")).sort();
const fieldNoteRefs = new Map();

for (const name of postNames) {
  const file = join(postsDir, name);
  const text = await readFile(file, "utf8");
  if (!isFieldNote(text)) continue;

  for (const mediaPath of collectActualMediaRefs(text)) {
    const sources = fieldNoteRefs.get(mediaPath) ?? [];
    sources.push(name);
    fieldNoteRefs.set(mediaPath, sources);

    if (!entries[mediaPath]) {
      fail(`${name}: field-note references untracked first-party media ${mediaPath}`);
      continue;
    }

    try {
      const info = await stat(join(publicDir, mediaPath.replace(/^\//, "")));
      if (!info.isFile()) fail(`${name}: referenced first-party media is not a file: ${mediaPath}`);
    } catch {
      fail(`${name}: referenced first-party media file is missing: ${mediaPath}`);
    }
  }
}

if (fieldNoteRefs.size === 0) {
  fail("no field-note /images/actual/ or /videos/actual/ references were found");
}

if (failures.length > 0) {
  console.error(`Media privacy validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const reviewedInventory = manifestPaths.filter((mediaPath) => entries[mediaPath].status === "reviewed");
const editedInventory = manifestPaths.filter((mediaPath) => entries[mediaPath].status === "privacy-edited");
const actionInventory = manifestPaths.filter((mediaPath) => entries[mediaPath].status === "privacy-action-needed");
const fieldNoteNeedsReview = [...fieldNoteRefs.keys()]
  .filter((mediaPath) => entries[mediaPath].status === "needs-review")
  .sort();
const fieldNoteActionNeeded = [...fieldNoteRefs.keys()]
  .filter((mediaPath) => entries[mediaPath].status === "privacy-action-needed")
  .sort((a, b) => {
    const aPriority = entries[a].priority === "high" ? 0 : 1;
    const bPriority = entries[b].priority === "high" ? 0 : 1;
    return aPriority - bPriority || a.localeCompare(b);
  });
const fieldNoteCleared = [...fieldNoteRefs.keys()]
  .filter((mediaPath) => entries[mediaPath].status === "reviewed" || entries[mediaPath].status === "privacy-edited")
  .sort();

console.log(
  `Media privacy inventory passed: ${inventoryPaths.length} first-party /actual/ file(s) tracked; ${fieldNoteRefs.size} unique field-note media reference(s).`
);
console.log(
  `Documented review status: ${reviewedInventory.length} reviewed, ${editedInventory.length} privacy-edited, ${actionInventory.length} privacy-action-needed; ${fieldNoteNeedsReview.length} field-note media item(s) remain unreviewed.`
);

if (fieldNoteCleared.length > 0) {
  console.log("Cleared or privacy-edited field-note media:");
  for (const mediaPath of fieldNoteCleared) {
    console.log(`- ${entries[mediaPath].status}: ${mediaPath}`);
  }
}

if (fieldNoteActionNeeded.length > 0) {
  console.log("Privacy action queue (manual review completed; does not fail CI):");
  for (const mediaPath of fieldNoteActionNeeded) {
    const sources = fieldNoteRefs.get(mediaPath) ?? [];
    console.log(`- ${entries[mediaPath].priority}: ${mediaPath} <- ${sources.join(", ")}`);
  }
}

if (fieldNoteNeedsReview.length > 0) {
  console.log("Unreviewed field-note privacy queue (does not fail CI):");
  for (const mediaPath of fieldNoteNeedsReview) {
    const sources = fieldNoteRefs.get(mediaPath) ?? [];
    console.log(`- ${mediaPath} <- ${sources.join(", ")}`);
  }
}
