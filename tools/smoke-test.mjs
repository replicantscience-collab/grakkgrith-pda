#!/usr/bin/env node
// Opens the PDA in a real browser and clicks through every screen, the way a player would.
// Fails if a screen comes up empty, a script throws, or a key feature is missing.
//   npm install        (once)
//   npm run smoke      (or: node tools/smoke-test.mjs)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // require() also finds a globally installed copy

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

// Tiny static server for the repo folder.
const server = createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    if (p.startsWith('..')) throw new Error('outside root');
    let file = join(ROOT, p);
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [], passes = [];
const check = (name, ok, detail = '') => (ok ? passes : failures).push(ok ? name : `${name}${detail ? ': ' + detail : ''}`);

const browser = await chromium.launch();
async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', r => { if (r.url().startsWith(BASE)) errors.push('missing file: ' + r.url().slice(BASE.length)); });
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`missing file (${r.status()}): ${r.url().slice(BASE.length)}`); });
  return { ctx, page, errors };
}
const frameText = page => page.evaluate(() => { const d = document.getElementById('frame').contentDocument; return d && d.body ? d.body.innerText.length : 0; });
const frame = page => page.frames().find(f => f !== page.mainFrame());
const sample = { version: 44, character: { name: 'Smoke Test', race: 'Goblin', class: 'Runner', subclass: 'Threnn Guide', level: 1 }, inventory: [] };

try {
  for (const [label, viewport] of [['desktop', { width: 1366, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const { ctx, page, errors } = await newPage(viewport);
    await page.goto(BASE + '/');
    await page.evaluate(s => localStorage.setItem('grakkgrith_character_tool_v8_state', JSON.stringify(s)), sample);

    // Every button in the top nav and the Tools menu opens a screen with real content.
    const buttons = await page.$$eval('.topbar button[id]', bs => bs.map(b => b.id).filter(id => !['toolsBtn', 'newBtn'].includes(id)));
    for (const id of buttons) {
      await page.evaluate(id => document.getElementById(id).click(), id);
      await page.waitForTimeout(700);
      const n = await frameText(page);
      check(`${label}: ${id.replace(/Btn$/, '')} screen has content`, n > 200, `only ${n} characters`);
    }

    // A step that throws counts as a failure and the run continues, so one broken screen doesn't hide the rest.
    const step = async (name, fn) => { try { const r = await fn(); check(`${label}: ${name}`, r === true, r === false ? '' : String(r)); } catch (e) { check(`${label}: ${name}`, false, e.message.split('\n')[0]); } };
    const open = async (id, wait) => { await page.evaluate(id => document.getElementById(id).click(), id); await page.waitForTimeout(wait); return frame(page); };

    // Explore: map image loads, the clock runs, travel can be planned.
    let f = await open('exploreBtn', 1500);
    await step('Explore map image loads', () => f.evaluate(() => { const i = document.getElementById('mapImg'); return i.complete && i.naturalWidth > 0; }));
    await step('Explore shows the Adyta clock', async () => /\d:\d\d [AP]M/.test(await f.evaluate(() => document.getElementById('clock').textContent)));
    await step('Explore can plan a trip', async () => (await f.evaluate(() => window.GRAKK_EXPLORE.planTrip({ district: 'ember-court', place: 'ember-court--the-ninth-circle-ph' }).length)) > 0);

    // Guides: all 11 races, and a card opens its entry.
    f = await open('guidesBtn', 1200);
    await step('Guides shows 11 races', async () => { const n = await f.evaluate(() => document.querySelectorAll('.card').length); return n === 11 || `found ${n}`; });
    await step('Guides opens a race entry', async () => { await f.evaluate(() => document.querySelector('[data-race="Fairy"]').click()); return /Fae Reading/.test(await f.evaluate(() => document.getElementById('detail').innerText)); });

    // City: 28 atlas pins, and a pin opens its dossier.
    f = await open('cityBtn', 1500);
    await step('City shows 28 atlas pins', async () => { const n = await f.evaluate(() => document.querySelectorAll('.cityPin').length); return n === 28 || `found ${n}`; });
    await step('City pin opens a dossier', async () => { await f.evaluate(() => [...document.querySelectorAll('.cityPin')].find(p => p.dataset.cityPin === 'THE TANGLE').click()); return /The Tangle/.test(await f.evaluate(() => document.getElementById('cityMapReadout').innerText)); });

    // Character Setup has the rulebook's races; the sheet loads the saved character.
    f = await open('creatorBtn', 1200);
    await step('Character Setup has all 11 races', async () => { const n = await f.evaluate(() => Object.keys(DATA.races).filter(r => r !== 'Custom / Homebrew').length); return n === 11 || `found ${n}`; });
    f = await open('sheetBtn', 1800);
    await step('Character Sheet loads the character', async () => { const v = await f.evaluate(() => document.getElementById('raceSelect')?.value); return v === 'Goblin' || `race shows "${v}"`; });

    check(`${label}: no script errors or missing files`, errors.length === 0, [...new Set(errors)].slice(0, 5).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`${passes.length} checks passed.`);
if (failures.length) {
  console.error(`${failures.length} failed:\n` + failures.map(f => '  ✗ ' + f).join('\n'));
  process.exit(1);
}
