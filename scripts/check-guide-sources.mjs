import fs from "node:fs";
import path from "node:path";

const postsDir = path.join(process.cwd(), "src", "content", "posts");
const files = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"));
const failures = [];
let guides = 0;
let operationalGuides = 0;
let sourceSections = 0;

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
const operationalPattern = /(운영\s*시간|요금|가격|비자|입국|세관|반입|vat|환급|유심|esim|로밍|wi-?fi|버스|교통비|시간표|티켓|예약|폐쇄|atm|환전|결제|서비스비|팁|공휴일|라마단|보험|렌터카)/i;

for (const file of files) {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  const { frontmatter, body } = parseFrontmatter(source);
  const contentType = field(frontmatter, "contentType") || "guide";
  if (contentType === "field-note") continue;

  guides += 1;
  const title = field(frontmatter, "title") || file;
  const externalLinks = body.match(/\]\(https:\/\/[^)]+\)/g) ?? [];
  const firstPartyEvidence = body.match(/!\[[^\]]*\]\(\/images\/actual\/[^)]+\)|<video\b[\s\S]*?\/videos\/actual\//gi) ?? [];
  const isOperational = operationalPattern.test(`${title}\n${body}`);
  const hasSourceHeading = sourceHeadingPattern.test(body);

  if (isOperational) operationalGuides += 1;
  if (hasSourceHeading) sourceSections += 1;

  const issues = [];
  if (externalLinks.length === 0 && firstPartyEvidence.length === 0) {
    issues.push("외부 HTTPS 출처 또는 직접 제작 미디어 근거 없음");
  }
  if (isOperational && externalLinks.length === 0) {
    issues.push("변동 정보 가이드에 HTTPS 외부 출처 없음");
  }

  if (issues.length > 0) failures.push(`${file} | ${title} | ${issues.join(", ")}`);
}

if (failures.length > 0) {
  console.error(`Guide source evidence gate failed: ${failures.length} guide(s) need review.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Guide source evidence gate passed: ${guides} guide(s), including ${operationalGuides} operational/current-info guide(s), have required external or first-party evidence.`);
console.log(`Visible source/reference heading detected in ${sourceSections} guide(s); heading wording is advisory and not mechanically enforced.`);
