import fs from "node:fs";
import path from "node:path";
import { coreStorySeoMeta } from "../src/data/seoMeta.mjs";

const root = process.cwd();
const coreStoriesPath = path.join(root, "src/data/coreStories.ts");
const coreStoriesSource = fs.readFileSync(coreStoriesPath, "utf8");
const corePermalinks = [
  ...coreStoriesSource.matchAll(/"(\/(?:19|20)\d{2}\/[^"\n]+\.html)"/g)
].map((match) => match[1]);

const errors = [];
const seoPermalinks = Object.keys(coreStorySeoMeta);

for (const permalink of corePermalinks) {
  const meta = coreStorySeoMeta[permalink];
  if (!meta) {
    errors.push(`${permalink}: missing SEO metadata`);
    continue;
  }

  if (meta.title.length < 15 || meta.title.length > 58) {
    errors.push(`${permalink}: SEO title length ${meta.title.length} is outside 15-58 characters`);
  }
  if (meta.description.length < 55 || meta.description.length > 160) {
    errors.push(`${permalink}: SEO description length ${meta.description.length} is outside 55-160 characters`);
  }
  if (/On Earth Trip/i.test(meta.title)) {
    errors.push(`${permalink}: SEO title should not include the site name because the layout appends it`);
  }
}

for (const permalink of seoPermalinks) {
  if (!corePermalinks.includes(permalink)) {
    errors.push(`${permalink}: SEO metadata exists for a non-core story`);
  }
}

const titles = seoPermalinks.map((permalink) => coreStorySeoMeta[permalink].title);
const descriptions = seoPermalinks.map((permalink) => coreStorySeoMeta[permalink].description);
if (new Set(titles).size !== titles.length) errors.push("SEO titles must be unique");
if (new Set(descriptions).size !== descriptions.length) errors.push("SEO descriptions must be unique");

if (corePermalinks.length !== 10) {
  errors.push(`Expected 10 core stories, found ${corePermalinks.length}`);
}

if (errors.length > 0) {
  console.error("SEO metadata validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO metadata validation passed: ${corePermalinks.length} core stories checked.`);
