import fs from "node:fs";
import path from "node:path";

const postsDir = path.join(process.cwd(), "src", "content", "posts");
const files = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"));

function parsePost(source, file) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = match?.[1] ?? "";
  const body = match ? source.slice(match[0].length) : source;
  const field = (name) => frontmatter.match(new RegExp(`^${name}:\\s*["']?([^\\r\\n"']+)["']?\\s*$`, "m"))?.[1]?.trim() ?? "";
  const visibleText = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    file,
    title: field("title"),
    date: field("pubDate").slice(0, 10),
    category: field("category"),
    type: field("contentType") || "guide",
    draft: /^draft:\s*true\s*$/m.test(frontmatter),
    chars: visibleText.length,
    h2: (body.match(/^##\s+/gm) ?? []).length,
    internal: (body.match(/\]\(\/(?!\/)[^)]+\)/g) ?? []).length,
    external: (body.match(/\]\(https:\/\/[^)]+\)/g) ?? []).length,
    media: (body.match(/!\[[^\]]*\]\([^)]*\)|<video\b/gi) ?? []).length
  };
}

const rows = files.map((file) => {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  return parsePost(source, file);
});

const topicGroups = {
  "공항·도착": /공항|airport|자이드 국제공항|zayed airport/i,
  "교통·이동": /교통|버스|택시|렌터카|운전|이동|transport|taxi|rental|driving|bus/i,
  "예산·결제": /예산|비용|환전|현금|카드|ATM|환율|budget|cost|exchange|payment/i,
  "숙박·지역": /숙박|호텔|숙소|머물|지역|where to stay|hotel|stay/i,
  "음식·쇼핑": /음식|식비|식사|쇼핑|마트|기념품|food|shopping|souvenir/i,
  "야스·관광": /야스|Yas|테마파크|관광|박물관|루브르|Louvre|museum/i,
  "알아인·리와": /알아인|Al Ain|리와|Liwa|Jebel Hafeet/i,
  "시르바니야스": /시르바니야스|Sir Bani Yas/i
};

const publicRows = rows.filter((row) => !row.draft);
const guides = publicRows.filter((row) => row.type !== "field-note");
const fieldNotes = publicRows.filter((row) => row.type === "field-note");
const compact = publicRows.filter((row) => row.chars < 1800);
const weakExperience = guides.filter((row) => row.media === 0 && row.external > 0);

console.log("=== On Earth Trip content inventory ===");
console.log(`Public posts: ${publicRows.length} / guides: ${guides.length} / field notes: ${fieldNotes.length}`);
console.log(`Draft posts: ${rows.filter((row) => row.draft).length}`);
console.log(`Compact public posts under 1,800 chars: ${compact.length}`);
console.log(`Guides with external sources but no first-party media: ${weakExperience.length}`);

console.log("\n=== Topic groups for consolidation review ===");
for (const [name, pattern] of Object.entries(topicGroups)) {
  const matches = guides.filter((row) => pattern.test(`${row.title} ${row.file}`));
  if (matches.length >= 2) {
    console.log(`\n[${name}] ${matches.length} posts`);
    for (const row of matches) console.log(`- ${row.file} | ${row.title}`);
  }
}

console.log("\n=== Highest-priority manual review queue ===");
const reviewQueue = [...publicRows]
  .filter((row) => row.chars < 1800 || row.internal < 2 || (row.type === "guide" && row.media === 0))
  .sort((a, b) => (b.type === "guide") - (a.type === "guide") || a.chars - b.chars);
for (const row of reviewQueue.slice(0, 30)) {
  console.log(`- ${row.file} | ${row.type} | chars=${row.chars} h2=${row.h2} internal=${row.internal} external=${row.external} media=${row.media} | ${row.title}`);
}

console.log("\nInventory is advisory. It does not automatically hide, delete, or redirect content.");
