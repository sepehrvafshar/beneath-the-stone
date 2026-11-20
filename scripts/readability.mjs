#!/usr/bin/env node
// Reading comfort and layout checks across screen widths.
// For a story passage at each width it measures the body font size, characters
// per line (from canvas text metrics), equal left/right card margins, and
// horizontal overflow, with the default and the largest text-size setting.
// Usage: node scripts/readability.mjs index.html
// Requires: npm install (playwright) and `npx playwright install chromium`.

import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/readability.mjs <index.html>'); process.exit(2); }
const url = pathToFileURL(resolve(file)).href;
const WIDTHS = [320, 390, 600, 768, 1024, 1440, 1920, 2560, 3840];
const MAX_CHARS = 85;   // comfortable measure; 45-75 is ideal, 85 is the hard limit here
const MIN_FONT = 13;    // px, smallest acceptable story text at the default setting

let failures = 0;
const ok = m => console.log('PASS  ' + m);
const bad = m => { failures++; console.log('FAIL  ' + m); };

const browser = await chromium.launch();
try {
  for (const [textStep, widths] of [['1', WIDTHS], ['3', [390, 768]]]) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(url);
      await page.locator('#visitIntro').waitFor({ state: 'detached', timeout: 15000 });
      if (textStep !== '1') await page.evaluate(step => setTextSize(step), textStep);
      await page.getByRole('button', { name: /begin journey/i }).click();
      await page.getByRole('button', { name: 'New Game', exact: true }).click();
      await page.waitForFunction(() => currentNodeId === 'start' && !inputIsGuarded());
      await page.locator('#content button', { hasText: /deep past/i }).click();
      await page.waitForFunction(() => currentNodeId !== 'start' && !inputIsGuarded());
      await page.locator('#content button', { hasText: /follow the miners/i }).click();
      await page.waitForFunction(() => currentNodeId === 'L1_miners' && !inputIsGuarded());
      const m = await page.evaluate(() => {
        const paragraphs = [...document.querySelectorAll('#content .passage p')];
        const first = paragraphs[0];
        const style = getComputedStyle(first);
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const text = paragraphs.map(p => p.textContent).join(' ');
        const perChar = ctx.measureText(text).width / text.length;
        const card = document.querySelector('#content .passage').getBoundingClientRect();
        return {
          font: parseFloat(style.fontSize),
          chars: Math.round(first.getBoundingClientRect().width / perChar),
          left: Math.round(card.left), right: Math.round(innerWidth - card.right),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      const tag = `${width}px text ${textStep}`;
      if (m.chars <= MAX_CHARS) ok(`${tag}: ${m.chars} characters per line`); else bad(`${tag}: ${m.chars} characters per line (max ${MAX_CHARS})`);
      if (textStep !== '1' || m.font >= MIN_FONT) ok(`${tag}: story text ${m.font.toFixed(1)}px`); else bad(`${tag}: story text ${m.font.toFixed(1)}px (min ${MIN_FONT})`);
      if (Math.abs(m.left - m.right) <= 2) ok(`${tag}: card centered (${m.left}/${m.right})`); else bad(`${tag}: card off center (${m.left}/${m.right})`);
      if (!m.overflow) ok(`${tag}: no horizontal overflow`); else bad(`${tag}: horizontal overflow`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`\n${failures} failure(s)`);
process.exit(failures ? 1 : 0);
