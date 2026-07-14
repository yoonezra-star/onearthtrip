import { getCollection } from "astro:content";

export async function getPosts() {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
}

export function getCategoryPath(category: string) {
  const map: Record<string, string> = {
    "아부다비 생활": "/life.html",
    "UAE 문화": "/culture.html",
    "과거·현재·미래": "/past-present-future.html",
    "나의 UAE 추억": "/memory.html"
  };

  return map[category] ?? "/";
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}
