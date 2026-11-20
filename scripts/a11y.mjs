#!/usr/bin/env node
// Automated accessibility audit with axe-core.
// Plays through the game and runs axe on the title screen, About, Credits,
// How to Play, the accessibility panel, the journey dialog, every visited
// passage, and the reflection screen, at desktop and phone sizes.
// Also fails on any console error or uncaught page error.
// Usage: node scripts/a11y.mjs index.html
// Requires: npm install (playwright, axe-core) and `npx playwright install chromium`.
// Automated checks do not replace testing with a real screen reader.

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/a11y.mjs <index.html>'); process.exit(2); }
const url = pathToFileURL(resolve(file)).href;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const violations = new Map();
const errors = [];

async function scan(page, where) {
  await page.addScriptTag({ content: axeSource });
  const found = await page.evaluate(async () => {
    const result = await axe.run(document, { resultTypes: ['violations'] });
    return result.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }));
  });
  for (const v of found) {
    const entry = violations.get(v.id) || { impact: v.impact, help: v.help, where: new Set(), targets: new Set() };
    entry.where.add(where); v.targets.forEach(t => entry.targets.add(t));
    violations.set(v.id, entry);
  }
}

async function run(browser, label, contextOptions, pick) {
  const context = await browser.newContext({ ...contextOptions, bypassCSP: true });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });
  await page.goto(url);
  await page.locator('#visitIntro').waitFor({ state: 'detached', timeout: 15000 });
  await scan(page, `${label} title`);
  for (const name of [/^about$/i, /^credits$/i, /^how to play$/i, /accessibility settings/i]) {
    await page.reload();
    await page.locator('#visitIntro').waitFor({ state: 'detached', timeout: 15000 });
    await page.getByRole('button', { name }).first().click();
    await page.waitForTimeout(700);
    await scan(page, `${label} ${name.source}`);
  }
  await page.reload();
  await page.locator('#visitIntro').waitFor({ state: 'detached', timeout: 15000 });
  await page.getByRole('button', { name: /begin journey/i }).click();
  await page.locator('#journeyDialog[open]').waitFor();
  await scan(page, `${label} journey dialog`);
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.waitForFunction(() => currentNodeId === 'start' && !inputIsGuarded(), null, { timeout: 15000 });
  const seen = new Set();
  let step = 0;
  for (let i = 0; i < 100; i++) {
    const node = await page.evaluate(() => currentNodeId);
    if (!seen.has(node)) { seen.add(node); await scan(page, `node ${node}`); }
    const buttons = page.locator('#content button:visible:enabled');
    const labels = await buttons.allInnerTexts();
    if (labels.some(l => /^Walk the ages differently/i.test(l.trim()))) break;
    const candidates = labels.map((l, j) => [l.trim(), j]).filter(([l]) => l && !/^close context$/i.test(l));
    if (!candidates.length) { await page.waitForTimeout(1000); continue; }
    const [, index] = candidates[pick(step++) % candidates.length];
    await buttons.nth(index).click({ timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => !inputIsGuarded(), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await scan(page, `${label} reflection`);
  await context.close();
  return seen.size;
}

const browser = await chromium.launch();
let visited;
try {
  visited = [
    await run(browser, 'desktop', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, () => 0),
    await run(browser, 'phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'light' }, s => s + 1),
  ];
} finally {
  await browser.close();
}

console.log(`Passages scanned per run: ${visited.join(', ')}`);
for (const [id, v] of violations) {
  console.log(`FAIL  [${v.impact}] ${id}: ${v.help}`);
  console.log(`      where: ${[...v.where].slice(0, 5).join(' | ')}`);
  [...v.targets].slice(0, 5).forEach(t => console.log(`      - ${t}`));
}
for (const e of [...new Set(errors)].slice(0, 20)) console.log(`FAIL  ${e}`);
const failures = violations.size + errors.length;
console.log(`\n${violations.size} axe rule violation(s), ${errors.length} console/page error(s)`);
process.exit(failures ? 1 : 0);
