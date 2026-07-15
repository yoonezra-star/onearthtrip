import { getCollection } from "astro:content";

export async function getPosts() {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
}

export function getCategoryPath(category: string) {
  const map: Record<string, string> = {
    "아부다비 생활": "/life",
    "UAE 문화": "/culture",
    "과거·현재·미래": "/past-present-future",
    "나의 UAE 추억": "/memory"
  };

  return map[category] ?? "/";
}

export function getPublicPath(path: string) {
  return path.replace(/\.html$/, "");
}

export function getReadingTime(text: string) {
  const words = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return Math.max(1, Math.ceil(words.length / 260));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}
