#!/usr/bin/env node
// Screenshots for review. Usage: node scripts/snapshots.mjs index.html review/snapshots
// Requires Playwright (see smoke.mjs).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [file, outDir = 'review/snapshots'] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/snapshots.mjs <index.html> [outDir]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(resolve(file)).href;

async function click(page, re, wait = 1800) {
  await page.getByRole('button', { name: re }).first().click();
  await page.waitForTimeout(wait);
}
async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name + '.png'), fullPage: false });
  console.log('saved', name);
}

const browser = await chromium.launch();
try {
  for (const [tag, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url); await page.waitForTimeout(1800);
    await shot(page, `title-${tag}`);
    if (tag === 'desktop') {
      await click(page, /about/i); await shot(page, 'about'); await click(page, /return to title/i, 1500);
      await click(page, /credits/i); await shot(page, 'credits');
      const toggle = page.locator('.disclaimer-toggle'); if (await toggle.count()) { await toggle.click(); await page.waitForTimeout(500); await shot(page, 'credits-disclaimer-open'); }
      await click(page, /return to title/i, 1500);
    }
    await click(page, /begin journey/i, 2600); await shot(page, `journey-options-${tag}`);
    await click(page, /^new game$/i, 900); await shot(page, `start-${tag}`);
    // Layer 1 decision
    await click(page, /descend into the deep past/i, 2000); await click(page, /follow the miners/i, 3500); await shot(page, `l1-decision-${tag}`);
    await click(page, /write down what you witnessed/i); await click(page, /^continue$/i); await click(page, /record what you see/i); await click(page, /return toward the threshold/i); await click(page, /step through/i, 2200);
    // Layer 2 decision
    await click(page, /enter the age of lanterns/i, 2000); await click(page, /join the tour/i, 3500); await shot(page, `l2-decision-${tag}`);
    await click(page, /let it stay his/i); await click(page, /^continue$/i); await click(page, /intervene/i); await click(page, /leave the lantern age/i); await click(page, /step through/i, 2200);
    // Layer 3 decision
    await click(page, /stay in the present/i, 2000); await click(page, /take up the first question/i, 3000); await shot(page, `l3-decision-${tag}`);
    await click(page, /collaborative documentation/i); await click(page, /second question/i); await click(page, /restrained alternative/i); await click(page, /next question/i);
    await click(page, /support restoration/i); await click(page, /last question/i); await click(page, /review-and-comment/i); await click(page, /leave the meeting/i); await click(page, /step through/i, 2200);
    // Reflection
    await click(page, /nowhere left to go|read the record/i, 5000); await shot(page, `reflection-${tag}`);
    const review = page.locator('.decision-review summary'); if (await review.count()) { await review.click(); await page.waitForTimeout(600); await review.scrollIntoViewIfNeeded(); await shot(page, `reflection-consequences-${tag}`); }
    await ctx.close();
  }
} finally { await browser.close(); }
