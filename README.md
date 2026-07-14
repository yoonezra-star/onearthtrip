# On Earth Trip

아부다비와 아랍에미리트 생활 경험을 바탕으로 UAE의 과거, 현재, 미래, 문화와 추억을 기록하는 정적 블로그입니다.

## Local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성됩니다.

## Cloudflare Pages

- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

## Content

기존 Blogger 글은 `src/content/posts/*.md`에 Markdown으로 이전되어 있습니다. 각 글의 `permalink`는 기존 Blogger URL을 유지합니다.

새 글을 추가할 때는 같은 폴더에 Markdown 파일을 만들고 frontmatter에 `title`, `description`, `pubDate`, `category`, `permalink`를 입력합니다.
