import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const postsDir = path.join(root, "src", "content", "posts");
const files = fs.readdirSync(postsDir).filter((name) => name.endsWith(".md"));
const issues = [];
let fieldNotes = 0;
let fieldNotesWithActualMedia = 0;

function splitPost(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function scalar(frontmatter, name) {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*["']?([^\\n"']+)["']?\\s*$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function nestedField(frontmatter, parent, child) {
  const parentMatch = frontmatter.match(new RegExp(`^${parent}:\\s*\\n([\\s\\S]*?)(?=^[A-Za-z][A-Za-z0-9_-]*:|\\Z)`, "m"));
  if (!parentMatch) return "";
  const childMatch = parentMatch[1].match(new RegExp(`^\\s{2}${child}:\\s*["']?([^\\n"']+)["']?\\s*$`, "m"));
  return childMatch?.[1]?.trim() ?? "";
}

for (const file of files) {
  const source = fs.readFileSync(path.join(postsDir, file), "utf8");
  const { frontmatter, body } = splitPost(source);
  const contentType = scalar(frontmatter, "contentType") || "guide";
  if (contentType !== "field-note") continue;

  fieldNotes += 1;
  const title = scalar(frontmatter, "title") || file;
  const pubDate = scalar(frontmatter, "pubDate");
  const label = nestedField(frontmatter, "fieldNote", "label");
  const disclaimer = nestedField(frontmatter, "fieldNote", "disclaimer");
  const heroImage = scalar(frontmatter, "heroImage");
  const hasActualMedia = /\/images\/actual\//.test(heroImage) || /\/images\/actual\//.test(body) || /\/videos\/actual\//.test(body);
  const combined = `${label} ${disclaimer} ${body}`;

  if (!label) {
    issues.push(`${file}: field-note is missing fieldNote.label (${title})`);
  } else {
    if (label.length < 12) issues.push(`${file}: fieldNote.label is too vague; describe the record scope more clearly`);
    if (!/(기록|촬영|방문|경험|범위|시기)/.test(label)) {
      issues.push(`${file}: fieldNote.label should state a record/visit/shooting scope`);
    }
  }

  if (!disclaimer) {
    issues.push(`${file}: field-note is missing fieldNote.disclaimer (${title})`);
  } else {
    if (disclaimer.length < 24) issues.push(`${file}: fieldNote.disclaimer is too short to explain temporal/context limits`);
    if (!/(현재|당시|기록|촬영|방문|과거|최신|운영|변경|시점)/.test(disclaimer)) {
      issues.push(`${file}: fieldNote.disclaimer should distinguish the record from current operational information`);
    }
  }

  const pubYear = Number(pubDate.slice(0, 4));
  if (Number.isFinite(pubYear) && pubYear <= 2024 && disclaimer && !/(현재|지금|최신|운영|변경)/.test(disclaimer)) {
    issues.push(`${file}: older field-note disclaimer should explicitly separate past experience from current information`);
  }

  if (hasActualMedia) {
    fieldNotesWithActualMedia += 1;
    if (!/(직접\s*(촬영|찍|방문|기록|경험)|현장\s*(촬영|기록)|작성자가\s*직접)/.test(combined)) {
      issues.push(`${file}: /actual/ media is used without an explicit first-party provenance statement`);
    }
  }

  if (/<video\b/i.test(body) && !/(영상|촬영)/.test(`${label} ${disclaimer}`)) {
    issues.push(`${file}: video field-note should mention video/shooting scope in fieldNote metadata`);
  }
}

if (fieldNotes === 0) {
  issues.push("No field-note posts found; trust audit could not run.");
}

if (issues.length > 0) {
  console.error(`Field-note trust validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  `Field-note trust validation passed: ${fieldNotes} field-note post(s), ${fieldNotesWithActualMedia} with first-party /actual/ media.`
);
