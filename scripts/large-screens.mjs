#!/usr/bin/env node
// Large-screen checks: on 1920x1080, 2560x1440, 3840x2160 and 2560x1080 the page zooms as a whole.
// Verifies no overflow, the title fits the screen height, real mouse clicks land, dialogs close only
// from outside clicks, the pointer light sits under the mouse, and the notebook fits.
// Usage: node scripts/large-screens.mjs index.html
import { chromium } from 'playwright'; import { resolve } from 'node:path'; import { pathToFileURL } from 'node:url';
const url = pathToFileURL(resolve(process.argv[2])).href;
let fails = 0; const ok = m => console.log('PASS  ' + m), bad = m => { fails++; console.log('FAIL  ' + m); };
const b = await chromium.launch();
for (const [w, h] of [[2560, 1440], [3840, 2160], [1920, 1080], [2560, 1080]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.locator('#visitIntro').waitFor({ state: 'detached', timeout: 15000 });
  const z = await p.evaluate(() => window.screenZoom);
  const fits = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
  if (fits.sw <= fits.iw + 1) ok(`${w}x${h} zoom ${z.toFixed(2)}: no horizontal overflow`); else bad(`${w}x${h}: horizontal overflow ${fits.sw}`);
  if (fits.sh <= fits.ih + 2) ok(`${w}x${h}: title fits the screen height`); else bad(`${w}x${h}: title taller than screen (${fits.sh} > ${fits.ih})`);
  // Real mouse click at the visual centre of Begin Journey must open the dialog.
  const bb = await p.getByRole('button', { name: /begin journey/i }).boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  if (await p.locator('#journeyDialog[open]').count()) ok(`${w}x${h}: mouse click on Begin Journey works`); else bad(`${w}x${h}: click missed Begin Journey`);
  // Clicking the backdrop (outside the dialog) closes it; clicking inside does not.
  const db = await p.locator('#journeyDialog').boundingBox();
  await p.mouse.click(db.x + db.width / 2, db.y + 30); const stillOpen = await p.locator('#journeyDialog[open]').count();
  await p.mouse.click(Math.max(5, db.x - 40), db.y + db.height / 2); const closed = !(await p.locator('#journeyDialog[open]').count());
  if (stillOpen && closed) ok(`${w}x${h}: dialog inside/outside clicks behave`); else bad(`${w}x${h}: dialog click detection wrong (inside open ${!!stillOpen}, outside closed ${closed})`);
  await p.getByRole('button', { name: /begin journey/i }).click(); await p.getByRole('button', { name: 'New Game', exact: true }).click();
  await p.waitForFunction(() => currentNodeId === 'start' && !inputIsGuarded());
  // Pointer light follows the mouse in visual pixels.
  await p.mouse.move(w * 0.3, h * 0.6, { steps: 4 }); await p.waitForTimeout(2200);
  const light = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement); return [parseFloat(cs.getPropertyValue('--game-light-x')), parseFloat(cs.getPropertyValue('--game-light-y'))]; });
  const vx = light[0] * z, vy = light[1] * z;
  if (Math.abs(vx - w * 0.3) < 12 && Math.abs(vy - h * 0.6) < 12) ok(`${w}x${h}: pointer light under the mouse`); else bad(`${w}x${h}: pointer light at ${vx.toFixed(0)},${vy.toFixed(0)} not ${w * 0.3},${h * 0.6}`);
  // Real mouse click on a choice navigates.
  const cb = await p.locator('#content button', { hasText: /deep past/i }).boundingBox();
  await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await p.waitForFunction(() => currentNodeId !== 'start', null, { timeout: 8000 }).then(() => ok(`${w}x${h}: mouse click on a choice navigates`)).catch(() => bad(`${w}x${h}: choice click missed`));
  await p.waitForFunction(() => !inputIsGuarded());
  // Notebook opens and fits.
  await p.locator('#journalBtn').click(); await p.waitForTimeout(1600);
  const jb = await p.locator('#journalPanel').boundingBox();
  if (jb && jb.x + jb.width <= w + 1 && jb.height <= h + 1) ok(`${w}x${h}: notebook fits on screen`); else bad(`${w}x${h}: notebook off screen ${JSON.stringify(jb)}`);
  if (!errs.length) ok(`${w}x${h}: no page errors`); else bad(`${w}x${h}: ${errs[0]}`);
  await p.close();
}
await b.close();
console.log(`\n${fails} failure(s)`); process.exit(fails ? 1 : 0);
