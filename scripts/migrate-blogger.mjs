import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const posts = [
  ["https://www.onearthtrip.com/2026/05/dune-bashing.html", "2026-05-07T22:12:00+09:00", "나의 UAE 추억"],
  ["https://www.onearthtrip.com/2026/05/300.html", "2026-05-07T22:04:00+09:00", "나의 UAE 추억"],
  ["https://www.onearthtrip.com/2026/04/global-village.html", "2026-04-29T22:05:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/szr-12.html", "2026-04-27T22:05:00+09:00", "아부다비 생활"],
  ["https://www.onearthtrip.com/2026/04/dates.html", "2026-04-27T22:04:00+09:00", "UAE 문화"],
  ["https://www.onearthtrip.com/2026/04/majlis.html", "2026-04-23T10:00:00+09:00", "UAE 문화"],
  ["https://www.onearthtrip.com/2026/04/abra-1.html", "2026-04-23T00:12:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/blog-post_19.html", "2026-04-19T23:02:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/blog-post_17.html", "2026-04-19T22:25:00+09:00", "나의 UAE 추억"],
  ["https://www.onearthtrip.com/2026/04/jebel-jais-uae.html", "2026-04-19T22:09:00+09:00", "나의 UAE 추억"],
  ["https://www.onearthtrip.com/2026/04/al-seef.html", "2026-04-13T23:32:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/blog-post_11.html", "2026-04-11T10:30:00+09:00", "나의 UAE 추억"],
  ["https://www.onearthtrip.com/2026/04/shamal.html", "2026-04-10T10:00:00+09:00", "UAE 문화"],
  ["https://www.onearthtrip.com/2026/04/oudh.html", "2026-04-09T10:00:00+09:00", "UAE 문화"],
  ["https://www.onearthtrip.com/2026/04/50.html", "2026-04-08T15:00:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/ramadan.html", "2026-04-07T23:04:00+09:00", "UAE 문화"],
  ["https://www.onearthtrip.com/2026/04/sharjah.html", "2026-04-07T22:55:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/ajman-karak-tea-1.html", "2026-04-07T22:36:00+09:00", "UAE 문화"],
  ["https://www.onearthtrip.com/2026/04/fujairah-uae.html", "2026-04-07T20:42:00+09:00", "나의 UAE 추억"],
  ["https://www.onearthtrip.com/2026/04/rak.html", "2026-04-07T20:33:00+09:00", "과거·현재·미래"],
  ["https://www.onearthtrip.com/2026/04/blog-post.html", "2026-04-07T20:16:00+09:00", "아부다비 생활"],
  ["https://www.onearthtrip.com/2026/04/uaq-uae.html", "2026-04-07T20:15:00+09:00", "과거·현재·미래"]
];

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-"
});

turndown.remove(["script", "style", "iframe", "noscript"]);

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function yamlString(value) {
  return JSON.stringify(value ?? "");
}

function getSlug(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  return parts.at(-1).replace(/\.html$/, "");
}

function getPermalink(url) {
  return new URL(url).pathname;
}

function getPubDate(url) {
  const parsed = new URL(url);
  const [, year, month] = parsed.pathname.split("/");
  return `${year}-${month}-01T09:00:00+09:00`;
}

function extractTags(text) {
  const tags = [...text.matchAll(/#([0-9A-Za-z가-힣_-]+)/g)].map((match) => match[1]);
  return [...new Set(tags)].slice(0, 12);
}

function selectBody($) {
  const candidates = [
    ".post-body.entry-content",
    ".post-body",
    ".entry-content",
    "article",
    ".post"
  ];

  for (const selector of candidates) {
    const el = $(selector).first();
    if (cleanText(el.text()).length > 500) return el;
  }

  return $("body");
}

function tidyBody($, body) {
  body.find("script, style, iframe, noscript").remove();
  body.find(".post-share-buttons, .share-buttons, .comments, #comments").remove();
  body.find("a").each((_, node) => {
    const href = $(node).attr("href");
    if (href?.startsWith("javascript:")) $(node).removeAttr("href");
  });
  body.find("img").each((_, node) => {
    const src = $(node).attr("src") || $(node).attr("data-src");
    if (src) $(node).attr("src", src);
    $(node).attr("loading", "lazy");
  });
  return body;
}

async function migrateOne(url, updatedDate, category) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; OnEarthTripMigration/1.0)"
    }
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const jsonLdText = $("script[type='application/ld+json']")
    .map((_, node) => $(node).text())
    .get()
    .join("\n");
  const publishedFromJson = jsonLdText.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1];
  const publishedFromMarkup = $("time.published").first().attr("datetime");
  const title =
    cleanText($("meta[property='og:title']").attr("content")) ||
    cleanText($(".entry-title, .post-title, h1").first().text()) ||
    cleanText($("title").text());
  const body = tidyBody($, selectBody($).clone());
  const text = cleanText(body.text());
  const description =
    cleanText($("meta[name='description']").attr("content")) ||
    cleanText($("meta[property='og:description']").attr("content")) ||
    text.slice(0, 155);
  const heroImage =
    $("meta[property='og:image']").attr("content") ||
    body.find("img").first().attr("src") ||
    undefined;
  const tags = extractTags(text);
  const markdown = turndown.turndown(body.html() ?? "");
  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `pubDate: ${yamlString(publishedFromJson || publishedFromMarkup || getPubDate(url))}`,
    `updatedDate: ${yamlString(updatedDate)}`,
    `author: ${yamlString("아부라이프")}`,
    `category: ${yamlString(category)}`,
    `tags: ${JSON.stringify(tags)}`,
    `permalink: ${yamlString(getPermalink(url))}`,
    heroImage ? `heroImage: ${yamlString(heroImage)}` : undefined,
    `sourceUrl: ${yamlString(url)}`,
    "---"
  ].filter(Boolean).join("\n");

  return {
    filename: `${getSlug(url)}.md`,
    content: `${frontmatter}\n\n${markdown.trim()}\n`
  };
}

await fs.mkdir(path.join("src", "content", "posts"), { recursive: true });

for (const [url, updatedDate, category] of posts) {
  process.stdout.write(`Migrating ${url}\n`);
  const migrated = await migrateOne(url, updatedDate, category);
  await fs.writeFile(
    path.join("src", "content", "posts", migrated.filename),
    migrated.content,
    "utf8"
  );
}

process.stdout.write(`Done. Migrated ${posts.length} posts.\n`);
