// Package only public site assets; no compilation or game transformation.
// The static checks run first: if index.html fails them, the build (and therefore
// the Cloudflare deploy that runs this script) stops.
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const mode = process.argv[2];
if (!['workers', 'pages'].includes(mode)) throw new Error('Use: node scripts/build.mjs workers|pages');
try {
  execFileSync(process.execPath, ['scripts/check.mjs', 'index.html'], { stdio: 'inherit' });
} catch {
  console.error('\nBuild stopped: scripts/check.mjs reported failures, so nothing was packaged.');
  process.exit(1);
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html', '_headers', 'robots.txt', 'sitemap.xml', 'og-1200x630.png']) {
  await copyFile(file, `dist/${file}`);
}
// Pages is the legacy host. Never copy this catch-all redirect to Workers.
if (mode === 'pages') await copyFile('_redirects', 'dist/_redirects');
console.log(`Packaged dist/ for ${mode}.`);
