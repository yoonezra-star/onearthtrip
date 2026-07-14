import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default("아부라이프"),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    permalink: z.string(),
    heroImage: z.string().optional(),
    sourceUrl: z.string().optional(),
    draft: z.boolean().default(false)
  })
});

export const collections = { posts };
