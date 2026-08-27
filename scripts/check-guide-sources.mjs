import fs from "node:fs";
import path from "node:path";

const postsDir = path.join(process.cwd(), "src", "content", "posts");
const files = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"));
const failures = [];
let guides = 0;

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function field(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*["']?([^\\n"']+)["']?\\s*$`, "m"));
  return match?.[1]?.trim() ?? "";
}

const sourceHeadingPattern = /^#{2,4}\s+(?:공식\s*(?:확인\s*)?(?:출처|자료)|확인한\s*공식\s*자료|출처|참고\s*(?:자료|출처)|정보\s*출처)\s*$/im;
const freshnessPattern = /(?:확인일|기준일|최종\s*확인|정보\s*확인일)\s*[:：]|\d{4}년\s*\d{1,2}월(?:\s*\d{1,2}일)?\s*(?:기준|기준으로\s*확인|확인)/i;
const recheckPattern = /(?:출발|방문|이용|예약|신청|구매)?\s*(?:전|직전)?[^\n.]{0,50}(?:공식|원문|운영\s*주체)[^\n.]{0,50}(?:다시|재)\s*확인/i;

for (const file of files) {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  const { frontmatter, body } = parseFrontmatter(source);
  const contentType = field(frontmatter, "contentType") || "guide";
  if (contentType === "field-note") continue;

  guides += 1;
  const title = field(frontmatter, "title") || file;
  const externalLinks = body.match(/\]\(https:\/\/[^)]+\)/g) ?? [];
  const hasUpdatedDate = /^updatedDate:\s*.+$/m.test(frontmatter);
  const hasSourceHeading = sourceHeadingPattern.test(body);
  const hasFreshnessMarker = freshnessPattern.test(body) || (hasUpdatedDate && recheckPattern.test(body));

  const issues = [];
  if (externalLinks.length === 0) issues.push("HTTPS 외부 출처 없음");
  if (!hasSourceHeading) issues.push("공식 출처/참고 자료 섹션 없음");
  if (!hasUpdatedDate) issues.push("updatedDate 없음");
  if (!hasFreshnessMarker) issues.push("확인일/기준일 또는 공식 정보 재확인 안내 없음");

  if (issues.length > 0) failures.push(`${file} | ${title} | ${issues.join(", ")}`);
}

if (failures.length > 0) {
  console.error(`Guide source/freshness gate failed: ${failures.length} guide(s) need review.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Guide source/freshness gate passed: ${guides} guide(s) have HTTPS references, a visible source section, updatedDate, and freshness/recheck guidance.`);
