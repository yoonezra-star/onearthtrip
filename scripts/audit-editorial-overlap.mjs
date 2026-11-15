import fs from 'node:fs';
import path from 'node:path';

const directory = 'src/content/posts';
const rows = fs.readdirSync(directory).filter(f => f.endsWith('.md')).map(file => {
  const source = fs.readFileSync(path.join(directory, file), 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`Missing frontmatter: ${file}`);
  const meta = match[1];
  const field = key => meta.match(new RegExp(`^${key}:\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1] ?? '';
  const body = source.slice(match[0].length);
  const plain = body.replace(/\]\([^)]*\)/g, ']').replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+/g, '');
  const tokens = new Set(plain.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);
  return { file, title: field('title'), draft: field('draft') === 'true', indexable: field('indexable') !== 'false', type: field('contentType'), tokens, media: /!\[|<video\b/.test(body), date: field('updatedDate') || field('pubDate') };
});
const publicRows = rows.filter(r => !r.draft && r.indexable);
const pairs = [];
for (let i = 0; i < publicRows.length; i++) {
  for (let j = i + 1; j < publicRows.length; j++) {
    const a = publicRows[i], b = publicRows[j];
    const shared = [...a.tokens].filter(t => b.tokens.has(t)).length;
    const score = shared / (a.tokens.size + b.tokens.size - shared);
    pairs.push({ a: a.file, b: b.file, score });
  }
}
pairs.sort((a, b) => b.score - a.score);
const lines = [
  '# Editorial Review Queue', '',
  'Generated from repository content. Similarity is token overlap, not a quality score or an AdSense prediction.',
  'All dispositions below are review candidates, not completed manual decisions. Media presence does not prove ownership or first-hand experience.', '',
  `Posts: ${rows.length}; public indexable: ${publicRows.length}.`, '',
  '## Highest Text Overlap', '', '| Article A | Article B | Jaccard overlap |', '| --- | --- | --- |',
  ...pairs.slice(0, 30).map(p => `| ${p.a} | ${p.b} | ${(p.score * 100).toFixed(1)}% |`), '',
  '## Every Article', '', '| File | Review action | Media in body | Last declared date |', '| --- | --- | --- | --- |',
  ...rows.map(r => `| ${r.file} | ${r.draft ? 'Draft: keep unpublished pending review' : !r.indexable ? 'Existing consolidation: verify target and redirect' : r.type === 'field-note' ? 'Verify first-hand scope, captions and factual claims' : 'Review unique answer, overlap and current sources'} | ${r.media ? 'yes' : 'no'} | ${r.date.slice(0, 10)} |`), '',
  '## Next Manual Decisions', '',
  '1. Read the highest-overlap pairs and distinguish shared vocabulary from duplicated answers.',
  '2. Prioritize SIM/connectivity, airport transport, and budget clusters for consolidation.',
  '3. Preserve useful unique details before choosing a representative URL; check redirects, inbound links and sitemap together.',
  '4. Verify source contents before changing a factual verification date.',
  '5. Request owner input only for experiences that cannot be substantiated from existing records.', ''
];
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/editorial-review.md', lines.join('\n'));
console.log(`Reviewed inventory of ${rows.length} posts; wrote reports/editorial-review.md`);
console.log(pairs.slice(0, 10));
