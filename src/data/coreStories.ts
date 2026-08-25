export const coreStoryPermalinks = [
  "/2026/08/abu-dhabi-first-30-days.html",
  "/2026/08/abu-dhabi-dubai-weekend-rhythm.html",
  "/2026/08/uae-culture-etiquette-first-visit.html",
  "/2026/08/uae-seven-emirates-slow-travel.html",
  "/2026/08/uae-personal-photo-archive.html",
  "/2026/04/blog-post_11.html",
  "/2012/12/dubai-burj-khalifa-2012.html",
  "/2026/05/dune-bashing.html",
  "/2021/06/sir-bani-yas-coastal-road-2021.html",
  "/2022/04/abu-dhabi-national-aquarium.html"
] as const;

const coreStoryRank = new Map(
  coreStoryPermalinks.map((permalink, index) => [permalink, index])
);

export function isCoreStory(permalink: string) {
  return coreStoryRank.has(permalink as (typeof coreStoryPermalinks)[number]);
}

export function getCoreStoryRank(permalink: string) {
  return coreStoryRank.get(permalink as (typeof coreStoryPermalinks)[number]) ?? Number.MAX_SAFE_INTEGER;
}
