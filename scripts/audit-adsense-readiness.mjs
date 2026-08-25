import fs from "node:fs";
import path from "node:path";

const postsDir = path.join(process.cwd(), "src", "content", "posts");
const files = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"));

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function field(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*["']?([^\\n"']+)["']?\\s*$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function visibleText(body) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const rows = files.map((file) => {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  const { frontmatter, body } = parseFrontmatter(source);
  const text = visibleText(body);
  const contentType = field(frontmatter, "contentType") || "guide";
  const title = field(frontmatter, "title") || file;
  const permalink = field(frontmatter, "permalink");
  const internalLinks = (body.match(/\]\(\/(?!\/)[^)]+\)/g) ?? []).length;
  const externalLinks = (body.match(/\]\(https:\/\/[^)]+\)/g) ?? []).length;
  const media = (body.match(/!\[[^\]]*\]\([^)]+\)|<video\b/gi) ?? []).length;
  const h2 = (body.match(/^##\s+/gm) ?? []).length;
  const hasUpdatedDate = /^updatedDate:/m.test(frontmatter);
  const hasOfficialSection = /##\s+(확인한 공식 자료|공식 자료|출처|참고 자료)/i.test(body);

  return {
    file,
    title,
    permalink,
    contentType,
    chars: text.length,
    internalLinks,
    externalLinks,
    media,
    h2,
    hasUpdatedDate,
    hasOfficialSection
  };
});

const guides = rows.filter((row) => row.contentType !== "field-note");
const fieldNotes = rows.filter((row) => row.contentType === "field-note");
const thinCandidates = guides
  .filter((row) => row.chars < 2200 || row.h2 < 3 || (row.externalLinks === 0 && row.internalLinks < 2))
  .sort((a, b) => a.chars - b.chars);
const weakSourceCandidates = guides
  .filter((row) => row.externalLinks === 0)
  .sort((a, b) => a.chars - b.chars);
const weakNavigationCandidates = guides
  .filter((row) => row.internalLinks < 2)
  .sort((a, b) => a.internalLinks - b.internalLinks || a.chars - b.chars);
const mediaRich = rows.filter((row) => row.media > 0).length;

console.log("\n=== AdSense readiness content audit ===");
console.log(`Posts: ${rows.length} total / ${guides.length} guides / ${fieldNotes.length} field notes`);
console.log(`Posts with first-party or embedded media markup: ${mediaRich}`);
console.log(`Potential thin/structure candidates: ${thinCandidates.length}`);
console.log(`Guides with no external HTTPS reference: ${weakSourceCandidates.length}`);
console.log(`Guides with fewer than 2 internal links: ${weakNavigationCandidates.length}`);

function printCandidates(label, items, limit = 20) {
  console.log(`\n${label}`);
  if (items.length === 0) {
    console.log("- none");
    return;
  }
  for (const row of items.slice(0, limit)) {
    console.log(
      `- ${row.file} | chars=${row.chars} h2=${row.h2} internal=${row.internalLinks} external=${row.externalLinks} media=${row.media} | ${row.title}`
    );
  }
  if (items.length > limit) console.log(`- ...and ${items.length - limit} more`);
}

printCandidates("Thin/structure review queue (first 20)", thinCandidates);
printCandidates("No external reference queue (first 15)", weakSourceCandidates, 15);
printCandidates("Weak internal-navigation queue (first 15)", weakNavigationCandidates, 15);

console.log("\nAudit is advisory only. Review candidates manually before merging, noindexing, redirecting, or deleting content.\n");
