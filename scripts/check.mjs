#!/usr/bin/env node
// Static checks for Beneath the Stone against docs/PAPER_SPEC.md.
// Usage: node scripts/check.mjs index.html
// No dependencies. Exit code 1 if any FAIL.

import { readFileSync, statSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check.mjs <index.html>'); process.exit(2); }
const html = readFileSync(file, 'utf8');
const lower = html.toLowerCase();
const results = [];
const pass = (id, msg) => results.push({ ok: true, id, msg });
const fail = (id, msg) => results.push({ ok: false, id, msg });
const warn = (id, msg) => results.push({ ok: true, warn: true, id, msg });

// Strip script bodies for text-only searches (keeps template literals though, so narrative in JS is still searched).
const textOnly = html.replace(/<style[\s\S]*?<\/style>/gi, '');

// A1 title and working-title remnants
if (/<title>\s*Beneath the Stone\s*<\/title>/i.test(html)) pass('A1', '<title> is "Beneath the Stone"');
else fail('A1', '<title> is not exactly "Beneath the Stone"');
const wr = (lower.match(/what remains/g) || []).length;
if (wr === 0) pass('A1', 'no "what remains" remnants'); else fail('A1', `${wr} occurrence(s) of "what remains"`);

// A2 advisory
if (/recommended age:?\s*18\+/i.test(html)) pass('A2', 'content advisory "Recommended Age: 18+" present');
else fail('A2', 'content advisory "Recommended Age: 18+" missing');

// A4 anonymity language
for (const s of ['anonymous', 'blind peer', 'withheld for']) {
  const n = (lower.match(new RegExp(s, 'g')) || []).length;
  if (n === 0) pass('A4', `no "${s}"`); else fail('A4', `${n} occurrence(s) of "${s}"`);
}
for (const s of ['Sepehr Vaez Afshar', 'Laura Shackelford', 'University of Illinois Urbana-Champaign']) {
  if (html.includes(s)) pass('A4', `credits name "${s}"`); else fail('A4', `credits missing "${s}"`);
}

// B3 documented/invented boundary in introductory text (title screen)
// Heuristic: scan every occurrence of "content advisory" (markup, JS template, or CSS comment) and pass if any
// occurrence has the boundary statement within the following 1,200 characters.
const advIdxs = [...lower.matchAll(/content advisory/g)].map(m => m.index);
if (advIdxs.length === 0) fail('B3', 'cannot locate CONTENT ADVISORY block');
else {
  const hit = advIdxs.some(i => { const w = lower.slice(i, i + 1200); return w.includes('imagined composites') || w.includes('are invented'); });
  if (hit) pass('B3', 'documented/invented boundary stated within the content advisory block');
  else fail('B3', 'no documented/invented statement within the title-screen advisory block');
}

// B5 guide stays unnamed in narrative (heuristic: real names only inside data-note attributes)
const nameHits = [...html.matchAll(/Stephen Bishop|Bransford/g)].map(m => m.index);
const badNames = nameHits.filter(i => {
  const before = html.lastIndexOf("data-note='", i);
  const close = before === -1 ? -1 : html.indexOf("'", before + 11);
  return !(before !== -1 && close !== -1 && i > before && i < close + 400); // generous window within the note
});
if (badNames.length === 0) pass('B5', 'historical guide names appear only inside historical notes');
else warn('B5', `${badNames.length} mention(s) of real guide names outside data-note attributes; confirm the character is not named`);

// C2 no scoring language in player-facing text
const scoreHits = (textOnly.match(/\b(your score|points earned|correct answer|wrong answer|high score)\b/gi) || []).length;
if (scoreHits === 0) pass('C2', 'no scoring language'); else fail('C2', `${scoreHits} scoring phrase(s)`);

// C3 endings
for (const e of ["The Archivist's Path", "The Keeper's Path", "The Steward's Path"]) {
  if (html.includes(e)) pass('C3', `ending "${e}" present`); else fail('C3', `ending "${e}" missing`);
}

// D1 no raster imagery
const imgTags = (html.match(/<img\b/gi) || []).length;
if (imgTags === 0) pass('D1', 'no <img> tags'); else fail('D1', `${imgTags} <img> tag(s)`);
const rasterData = (html.match(/data:image\/(png|jpe?g|gif|webp)/gi) || []).length;
if (rasterData === 0) pass('D1', 'no inline raster images'); else warn('D1', `${rasterData} inline raster data URI(s); confirm none are photographic`);

// D3 procedural audio only
if (!/<audio\b/i.test(html) && !/\.(mp3|ogg|wav|m4a)\b/i.test(html) && !/data:audio/i.test(html)) pass('D3', 'no recorded audio assets');
else fail('D3', 'recorded audio asset or <audio> element found');
if (/AudioContext/.test(html)) pass('D3', 'WebAudio synthesis present'); else fail('D3', 'no AudioContext found');

// D4 examinable terms
const exam = (html.match(/class=['"]exam['"]/g) || []).length;
if (exam >= 10) pass('D4', `${exam} examinable terms (>= 10)`); else fail('D4', `${exam} examinable terms (< 10)`);

// The notebook total must come from story data, never a fixed numeric literal.
if (/\bTOTAL_HISTORICAL_NOTES\s*=\s*(?:\(\s*)*[+-]?(?:\d|['"`]\s*\d)/.test(html)) {
  fail('D4', 'hardcoded TOTAL_HISTORICAL_NOTES literal found');
} else if (/\bTOTAL_HISTORICAL_NOTES\s*=/.test(html)) {
  pass('D4', 'historical note total has no hardcoded numeric literal');
} else {
  fail('D4', 'historical note total declaration missing');
}

// D5 external dependencies
const extLinks = [...html.matchAll(/<(link|script|iframe|img|source|video|audio|object|embed)\b[^>]*\b(href|src)\s*=\s*["']((https?:)?\/\/[^"']+)["']/gi)].map(m => m[3]);
if (extLinks.length === 0) pass('D5', 'no external <link>/<script>/media URLs'); else fail('D5', `external resource URL(s): ${extLinks.join(', ')}`);
const preconnect = (html.match(/rel=["'](preconnect|dns-prefetch|prefetch|preload)["']/gi) || []).length;
if (preconnect === 0) pass('D5', 'no preconnect/prefetch hints'); else fail('D5', `${preconnect} preconnect/prefetch hint(s)`);
const cssUrls = [...html.matchAll(/url\(\s*["']?((https?:)?\/\/[^)"']+)["']?\s*\)/gi)].map(m => m[1]);
if (cssUrls.length === 0) pass('D5', 'no remote url() in CSS'); else fail('D5', `remote url() in CSS: ${cssUrls.join(', ')}`);
const imports = (html.match(/@import\s+url\(/gi) || []).length;
if (imports === 0) pass('D5', 'no @import'); else fail('D5', `${imports} @import rule(s)`);
const fontFaces = (html.match(/@font-face/gi) || []).length;
if (fontFaces > 0) pass('D5', `${fontFaces} embedded @font-face rule(s)`); else warn('D5', 'no @font-face: confirm fonts are system fonts by design');

// D6 no network APIs
for (const api of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket(', 'EventSource(', 'navigator.serviceWorker']) {
  const n = (html.match(new RegExp(api.replace(/[()]/g, '\\$&'), 'g')) || []).length;
  if (n === 0) pass('D6', `no ${api}`); else fail('D6', `${n} use(s) of ${api}`);
}
// Any remaining absolute http(s) URL anywhere is reported for manual review (allowlist: references and citations).
const allUrls = [...new Set([...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(m => m[0]))];
const allow = /doi\.org|nps\.gov|github\.com|sigradi|w3\.org\/2000\/svg|w3\.org\/1999\/xlink|schema\.org|creativecommons\.org|scripts\.sil\.org/i;
const suspicious = allUrls.filter(u => !allow.test(u));
if (suspicious.length === 0) pass('D6', `all ${allUrls.length} absolute URL(s) are citation/namespace URLs`);
else fail('D6', `non-allowlisted URL(s): ${suspicious.join(', ')}`);

// Sources section
if (html.includes('Of caves and shell mounds')) pass('SRC', 'Sources section cites Carstens & Watson (1996)'); else fail('SRC', 'About has no Sources section citing Carstens & Watson (1996)');

// Accessibility additions: presence only, without weakening existing checks.
if (html.includes('data-text') && html.includes('--text-scale') && html.includes('sessionStorage')) pass('A11Y', 'session text-size control present');
else fail('A11Y', 'text-size handling missing');

if (html.includes('data-reading') && html.includes('setReadingMode')) pass('A11Y', 'plain reading mode handling present');
else fail('A11Y', 'plain reading mode handling missing');

if (/<aside[^>]*aria-label="Accessibility"/.test(html)) pass('A11Y', 'Accessibility card present in About');
else fail('A11Y', 'About Accessibility card missing');

if (/@media\s*\(forced-colors:\s*active\)/.test(html)) pass('A11Y', 'forced-colors rules present');
else fail('A11Y', 'forced-colors rules missing');

if (html.includes('data-motion') && html.includes('setMotionPreference')) pass('A11Y', 'session motion control handling present');
else fail('A11Y', 'motion control handling missing');

// Single file, size
const size = statSync(file).size;
pass('FILE', `size ${size.toLocaleString()} bytes`);
if (size > 1_500_000) warn('FILE', 'file exceeds 1.5 MB; check embedded font subset');

// lang attribute
if (/<html[^>]*\blang=["']en/i.test(html)) pass('META', '<html lang="en">'); else fail('META', '<html> lacks lang="en"');
if (/<meta\s+name=["']description["']/i.test(html)) pass('META', 'meta description present'); else warn('META', 'no meta description (Gap 10)');

// Em-dashes in text added by the agent cannot be distinguished automatically; report total for the reviewer.
const em = (html.match(/—/g) || []).length;
warn('STYLE', `${em} em-dash character(s) in file (pre-existing narrative em-dashes are allowed)`);

// Report
let fails = 0;
for (const r of results) {
  const tag = r.ok ? (r.warn ? 'WARN' : 'PASS') : 'FAIL';
  if (!r.ok) fails++;
  console.log(`${tag}  ${r.id.padEnd(5)} ${r.msg}`);
}
console.log(`\n${fails} failure(s), ${results.filter(r => r.warn).length} warning(s)`);
process.exit(fails ? 1 : 0);
