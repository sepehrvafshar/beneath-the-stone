#!/usr/bin/env node
// Playwright smoke test: plays Beneath the Stone to all three endings and checks the reflection screen.
// Usage: node scripts/smoke.mjs index.html
// Requires: npm i -D playwright  (and `npx playwright install chromium` once)
// Also verifies: zero network requests, no horizontal overflow at 390 px, keyboard activation of a choice.

import { chromium } from 'playwright';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/smoke.mjs <index.html>'); process.exit(2); }
const url = pathToFileURL(resolve(file)).href;

// Decision labels, matching the `preserved` flag in the story data. "record" = preserved: true; "withhold" = preserved: false.
// Note: co-authorship counts as preserved (authority moves into the record); review-and-comment counts as withheld.
const RECORD = [
  /^Write down what you witnessed/, /^Record what you see/, /^Ask him to tell you more/, /^Document the removal/,
  /^Support repatriation after collaborative documentation/, /^Back the VR reconstruction/, /^Support restoration/, /^Argue the next history/,
];
const WITHHOLD = [
  /^Close the notebook/, /^Note the location only/, /^Let it stay his/, /^Intervene/,
  /^Support unconditional repatriation/, /^Back a restrained alternative/, /^Preserve the damage/, /^Accept review-and-comment/,
];
const ENTER = [/^Descend into the deep past/, /^Enter the age of lanterns/, /^Stay in the present/];
// Non-decision progression buttons, in preference order.
const CONTINUE = [/^Follow the miners deeper/, /^Join the tour and listen/, /^Take up the first question/, /^Continue$/, /^Return toward the threshold/, /^Leave the lantern age/, /^Leave the meeting/, /^Step through/, /^The second question/, /^The next question/, /^The last question/, /^Stay and study/, /^Fall behind/, /^Listen more carefully/, /^There is nowhere left to go/, /^Read the record/];

let failures = 0;
const ok = (m) => console.log('PASS  ' + m);
const bad = (m) => { failures++; console.log('FAIL  ' + m); };

const focusCheckedNodes = new WeakMap();
async function assertNavigationFocus(page) {
  const node = await page.locator('body').getAttribute('data-node');
  if (focusCheckedNodes.get(page) === node) return;
  focusCheckedNodes.set(page, node);
  try {
    await page.waitForFunction(() => document.activeElement?.matches('#content .passage-heading'), { }, { timeout: 8000 });
  } catch {
    bad(`focus: ${node} did not focus its passage heading`);
  }
}

async function assertJourneyDialog(page) {
  await page.locator('#journeyDialog[open]').waitFor();
  const valid = await page.evaluate(() => currentNodeId === 'title' &&
    document.activeElement?.id === 'journeyDialogTitle' && document.getElementById('journeyDialog').matches(':modal'));
  if (valid) ok('journey options: modal opens over title and receives heading focus');
  else bad('journey options: modal, title, or focus state is incorrect');
}

async function buttons(page) {
  return page.locator('#content button:visible, #content [role="button"]:visible');
}
async function labelsOf(loc) {
  const n = await loc.count(); const out = [];
  for (let i = 0; i < n; i++) out.push(((await loc.nth(i).innerText()) || '').trim().replace(/\s+/g, ' '));
  return out;
}
async function clickMatching(page, patterns) {
  const loc = await buttons(page); const labels = await labelsOf(loc);
  for (const p of patterns) {
    const idx = labels.findIndex(l => p.test(l));
    if (idx !== -1) { await loc.nth(idx).click(); await page.waitForTimeout(900); return labels[idx]; }
  }
  return null;
}

async function playToEnding(browser, strategy, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
  await page.goto(url); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /begin journey/i }).click();
  await assertJourneyDialog(page);
  if (await page.getByRole('button', { name: 'Load', exact: true }).isDisabled()) ok('new session: Load is disabled without a saved game');
  else bad('new session: Load must be disabled without a saved game');
  await page.getByRole('button', { name: 'New Game', exact: true }).click(); await page.waitForTimeout(900);

  let decisions = 0, steps = 0, layersEntered = 0;
  while (steps++ < 80) {
    await assertNavigationFocus(page);
    const loc = await buttons(page); const labels = await labelsOf(loc);
    if (labels.some(l => /^Walk the ages differently/i.test(l))) break; // reflection reached
    const pick = strategy(decisions);
    let clicked = await clickMatching(page, pick === 'record' ? RECORD : WITHHOLD);
    if (clicked) { decisions++; continue; }
    clicked = await clickMatching(page, ENTER);
    if (clicked) { layersEntered++; await page.waitForTimeout(1500); continue; }
    clicked = await clickMatching(page, CONTINUE);
    if (clicked) continue;
    // fall back: any visible button that is not a utility control
    const idx = labels.findIndex(l => l && !/sound|journal|back|export|about|credits/i.test(l));
    if (idx === -1) {
      // transitions (ending sequence) can take a few seconds; wait for buttons to appear
      try { await page.locator('#content button:visible').first().waitFor({ timeout: 6000 }); continue; } catch { break; }
    }
    await loc.nth(idx).click(); await page.waitForTimeout(900);
  }
  await assertNavigationFocus(page);
  // Explicit saving must preserve completed decisions and the resulting ending across reload.
  const beforeSave = await page.evaluate(() => ({ progress:snapshotState(), history:navigationHistory }));
  await page.locator('#brandHome').click();
  await page.locator('#confirmExit').click();
  await page.locator('#saveAndExit').click();
  await page.waitForFunction(() => currentNodeId === 'title');
  await page.reload();
  await page.getByRole('button', { name: /begin journey/i }).click();
  await assertJourneyDialog(page);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: /walk the ages differently/i }).waitFor();
  await assertNavigationFocus(page);
  const afterLoad = await page.evaluate(() => ({ progress:snapshotState(), history:navigationHistory }));
  if (isDeepStrictEqual(beforeSave, afterLoad)) ok('saved ending: passage, decisions, notes, and back history survive reload');
  else bad('saved ending: restored state differs from the explicit save');
  const text = await page.locator('#content').innerText();
  const ending = (text.match(/The (Archivist|Keeper|Steward)'s Path/) || [])[0] || null;
  const hasJourney = await page.locator('.journey-card, .journey-cards').count();
  const hasReview = await page.locator('.decision-review').count();
  const hasFinale = await page.locator('.reflection-finale').count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await ctx.close();
  return { ending, decisions, layersEntered, hasJourney, hasReview, hasFinale, requests, overflow };
}

const browser = await chromium.launch();
try {
  const runs = [
    ['all record -> Archivist', () => 'record', "The Archivist's Path", { width: 1440, height: 900 }],
    ['all withhold -> Keeper', () => 'withhold', "The Keeper's Path", { width: 1440, height: 900 }],
    ['alternating -> Steward (mobile 390)', (d) => (d % 2 ? 'withhold' : 'record'), "The Steward's Path", { width: 390, height: 844 }],
    ['alternating -> Steward (mobile 320)', (d) => (d % 2 ? 'withhold' : 'record'), "The Steward's Path", { width: 320, height: 568 }],
  ];
  for (const [name, strat, expected, vp] of runs) {
    const r = await playToEnding(browser, strat, vp);
    if (r.ending === expected) ok(`${name}: reached ${r.ending} after ${r.decisions} decisions, ${r.layersEntered} layers`);
    else bad(`${name}: expected ${expected}, got ${r.ending} (decisions ${r.decisions}, layers ${r.layersEntered})`);
    if (r.decisions === 8) ok(`${name}: 8 tracked decisions`); else bad(`${name}: ${r.decisions} decisions, expected 8`);
    if (r.hasJourney && r.hasReview && r.hasFinale) ok(`${name}: reflection has journey cards, consequence review, finale`);
    else bad(`${name}: reflection missing parts (journey ${r.hasJourney}, review ${r.hasReview}, finale ${r.hasFinale})`);
    if (r.requests.length === 0) ok(`${name}: zero network requests`); else bad(`${name}: ${r.requests.length} network request(s): ${[...new Set(r.requests)].slice(0, 5).join(', ')}`);
    if (!r.overflow) ok(`${name}: no horizontal overflow at ${vp.width}px`); else bad(`${name}: horizontal overflow at ${vp.width}px`);
  }

  // Keyboard: Tab to the first choice on the start node and press Enter.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(url); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /begin journey/i }).focus(); await page.keyboard.press('Enter');
  await assertJourneyDialog(page);
  await page.getByRole('button', { name: 'New Game', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => currentNodeId === 'start' && !inputIsGuarded());
  await assertNavigationFocus(page);
  let focusedLabel = null;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    focusedLabel = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
    if (focusedLabel && ENTER.some(p => p.test(focusedLabel))) break;
  }
  if (focusedLabel && ENTER.some(p => p.test(focusedLabel))) {
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    const moved = !(await page.locator('#content').innerText()).includes('Three moments in the cave');
    await assertNavigationFocus(page);
    if (moved) ok('keyboard: Tab + Enter activates a layer choice'); else bad('keyboard: Enter on focused choice did not navigate');
  } else bad('keyboard: could not reach a layer choice with Tab');
  await ctx.close();
} finally {
  await browser.close();
}
console.log(`\n${failures} failure(s)`);
process.exit(failures ? 1 : 0);
