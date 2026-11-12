// Package only public site assets; no compilation or game transformation.
import { copyFile, mkdir, rm } from 'node:fs/promises';
const mode = process.argv[2];
if (!['workers', 'pages'].includes(mode)) throw new Error('Use: node scripts/build.mjs workers|pages');
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html', '_headers', 'robots.txt', 'sitemap.xml', 'og-1200x630.png']) {
  await copyFile(file, `dist/${file}`);
}
// Pages is the legacy host. Never copy this catch-all redirect to Workers.
if (mode === 'pages') await copyFile('_redirects', 'dist/_redirects');
