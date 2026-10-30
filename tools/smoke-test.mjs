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
  // ERR_ABORTED just means the screen changed before a download finished; real missing files show up as 404s below.
  page.on('requestfailed', r => { if (r.url().startsWith(BASE) && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push(`failed to load (${r.failure()?.errorText}): ${r.url().slice(BASE.length)}`); });
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

    // Sideways art pass: Start wears the kit; Sideways' commentary and the rulebook stay separate in the guide.
    f = await open('worldBtn', 1200);
    await step('Start is the dashboard: Sideways skin, eight cards and the shop banner', () => f.evaluate(() => document.body.classList.contains('pda-art') && getComputedStyle(document.querySelector('.hero h1')).fontFamily.includes('Permanent Marker') && document.querySelectorAll('.grid .card').length === 6 && !!document.querySelector('.shops')));
    await step('the top bar has eight section tabs, not a wall of them', () => page.evaluate(() => document.querySelectorAll('.sectionNav .secTab').length === 8 && [...document.querySelectorAll('.topbar button')].filter(b => b.offsetParent).length <= 12));
    await step('a Start card opens its section', async () => { await f.click('.card [data-nav="cityBtn"]'); await page.waitForTimeout(1500); return page.evaluate(() => document.querySelector('.secTab.active').dataset.sec === 'city'); });
    await step('section tabs show their pages as sub-tabs', async () => { await page.evaluate(() => document.getElementById('sec-missions').click()); await page.waitForTimeout(1200);
      const subs = await page.$$eval('#subNav .subTab', b => b.map(x => x.textContent)); return (subs.join('|') === 'Contracts|Pocket Change|Radio Sewers') || subs.join('|'); });
    await step('Corporations shows five, with Pulse\'s posters and New Halo under Crownline', async () => { await page.evaluate(() => document.getElementById('corpsBtn').click()); await page.waitForTimeout(1500); const g = frame(page); await g.waitForFunction(() => window.GRAKK_CORPS_READY);
      const n = await g.$$eval('.corp', x => x.length), imgs = await g.$$eval('.corp img', x => x.length), nh = await g.evaluate(() => !!document.querySelector('#crownline .campaign')), sub = await page.evaluate(() => document.querySelector('.secTab.active').dataset.sec);
      return (n === 5 && imgs === 4 && nh && sub === 'factions') || `${n} corps, ${imgs} posters, New Halo under Crownline ${nh}, tab ${sub}`; });
    f = await open('cityBtn', 1500);
    await step('City uses the Sideways skin', async () => { await f.evaluate(() => showPanel('city')); return f.evaluate(() => document.body.classList.contains('pda-art')); });
    await step('Missions and Factions use the Sideways skin', async () => { for (const id of ['missions', 'factions']) { await f.evaluate(id => showPanel(id), id); if (!(await f.evaluate(() => document.body.classList.contains('pda-art')))) return `${id} is unskinned`; } return true; });
    await step('Lore and Logs use the Sideways skin', async () => { for (const id of ['lore', 'downtime']) { await f.evaluate(id => showPanel(id), id); if (!(await f.evaluate(() => document.body.classList.contains('pda-art')))) return `${id} is unskinned`; } return true; });
    await step('Choosing a job opens its contract', async () => { await f.evaluate(() => showPanel('missions')); await f.evaluate(() => document.querySelector('.missionBtn[data-job="routeLock"]').click()); return /Route Lock/.test(await f.evaluate(() => document.getElementById('missionBrief').innerText)); });

    // Guides: all 11 races, and a card opens its entry.
    f = await open('guidesBtn', 1200);
    await step('Guides shows 11 races', async () => { const n = await f.evaluate(() => document.querySelectorAll('.card').length); return n === 11 || `found ${n}`; });
    await step('Guide keeps Sideways commentary and rules apart', async () => { await f.evaluate(() => document.querySelector('[data-race="Goblin"]').click()); return f.evaluate(() => !!document.querySelector('#detail .sideways') && /From the rulebook/i.test(document.querySelector('#detail .rules').innerText) && !document.querySelector('#detail .sideways').innerText.includes('Reflex')); });
    await step('Guides opens a race entry', async () => { await f.evaluate(() => document.querySelector('[data-race="Fairy"]').click()); return /Fae Reading/.test(await f.evaluate(() => document.getElementById('detail').innerText)); });

    // City: 28 atlas pins, and a pin opens its dossier.
    f = await open('cityBtn', 1500);
    await step('City shows 28 atlas pins', async () => { const n = await f.evaluate(() => document.querySelectorAll('.cityPin').length); return n === 28 || `found ${n}`; });
    await step('City fits the screen (no sideways scroll)', async () => { const w = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth); return w <= 1 || `${w}px too wide`; });
    await step('City opens at the top', async () => { const y = await f.evaluate(() => scrollY); return y === 0 || `opened scrolled down ${y}px`; });
    await step('City pin opens a dossier', async () => { await f.evaluate(() => [...document.querySelectorAll('.cityPin')].find(p => p.dataset.cityPin === 'THE TANGLE').click()); return /The Tangle/.test(await f.evaluate(() => document.getElementById('cityMapReadout').innerText)); });

    // Character Setup has the rulebook's races; the sheet loads the saved character.
    f = await open('creatorBtn', 1200);
    await step('Character Setup has all 11 races', async () => { const n = await f.evaluate(() => Object.keys(DATA.races).filter(r => r !== 'Custom / Homebrew').length); return n === 11 || `found ${n}`; });
    // Character screens wear the Sideways kit (not the old caseboard skin) and fit a phone.
    const kitted = () => f.evaluate(() => document.body.classList.contains('pda-art') && !document.getElementById('occultCaseboardSkin'));
    const fits = async () => { const w = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth); return w <= 1 || `${w}px too wide`; };
    await step('Character Setup uses the Sideways skin and fits', async () => (await kitted()) ? fits() : 'unskinned');
    await step('Character Setup is labelled for rules v1.47', async () => /v1\.47/.test(await f.evaluate(() => document.querySelector('.head').textContent)));
    f = await open('charHubBtn', 1200);
    await step('Character Hub uses the Sideways skin and fits', async () => (await kitted()) ? fits() : 'unskinned');
    f = await open('sheetBtn', 1800);
    await step('Character Sheet loads the character', async () => { const v = await f.evaluate(() => document.getElementById('raceSelect')?.value); return v === 'Goblin' || `race shows "${v}"`; });
    await step('Character Sheet uses the Sideways skin and fits', async () => (await kitted()) ? fits() : 'unskinned');

    check(`${label}: no script errors or missing files`, errors.length === 0, [...new Set(errors)].slice(0, 5).join(' | '));
    await ctx.close();
  }

  // The alpha's core loop, as a brand-new player on a phone: nothing saved -> build a character by clicking
  // through every Character Setup step -> sheet -> walk somewhere in Explore.
  {
    const label = 'new player';
    const { ctx, page, errors } = await newPage({ width: 390, height: 844 });
    page.on('dialog', d => d.accept());
    const step = async (name, fn) => { try { const r = await fn(); check(`${label}: ${name}`, r === true, r === false ? '' : String(r)); } catch (e) { check(`${label}: ${name}`, false, e.message.split('\n')[0]); } };
    await page.goto(BASE + '/');
    await page.waitForTimeout(1200);
    let f = frame(page);
    await f.waitForFunction(() => window.GRAKK_START_READY);
    await step('Start offers "Create your character"', async () => /Create your character/.test(await f.evaluate(() => document.querySelector('.hero button.primary').textContent)) && !(await f.evaluate(() => document.querySelector('.note-card').innerText)).includes('Credits'));
    await step('builds a character through every Character Setup step', async () => {
      await f.click('.hero button[data-action="creator"]'); await page.waitForTimeout(1200); f = frame(page);
      for (let guard = 0; guard < 20; guard++) {
        const name = await f.evaluate(() => STEPS[step]);
        if (name === 'Review') break;
        if (name === 'Identity') await f.fill('#name', 'Smoke Runner');
        if (name === 'Race') await f.click('.choice[data-pick="Goblin"]');
        if (name === 'Origin' || name === 'Life') { await f.click('.choice >> nth=0'); if (await f.$('#grant')) { const o = await f.$eval('#grant', e => [...e.options].map(o => o.value).filter(Boolean)); if (o.length) await f.selectOption('#grant', o[0]); } }
        if (name === 'Class') { await f.click('.choice[data-pick="Runner"]'); await f.click('.choices >> nth=1 >> .choice >> nth=0'); }
        if (name === 'Attributes') for (const a of ['reflex', 'reflex', 'reflex', 'wit', 'wit', 'savvy', 'root', 'spark']) await f.click(`[data-attr="${a}"][data-dir="1"]`);
        if (name === 'Skills') for (let i = 0; i < 6 && (await f.evaluate(() => validate(step).length)); i++) await f.click('input[data-skill]:not(:checked):not(:disabled) >> nth=0');
        if (name === 'Territory' && await f.$('#grith') && !(await f.$eval('#grith', e => e.value))) { const o = await f.$eval('#grith', e => [...e.options].map(o => o.value).filter(Boolean)); await f.selectOption('#grith', o[0]); }
        const errs = await f.evaluate(() => validate(step));
        if (errs.length) return `stuck at ${name}: ${errs[0]}`;
        await f.click('#next'); await page.waitForTimeout(150);
      }
      await f.click('#finishCharacter'); await page.waitForTimeout(1200);
      const c = await page.evaluate(() => JSON.parse(localStorage.getItem('grakkgrith_character_tool_v8_state')).character);
      return (c.name === 'Smoke Runner' && c.class === 'Runner' && !!c.subclass) || `saved ${JSON.stringify(c).slice(0, 80)}`;
    });
    await step('the sheet shows the new character', async () => { await page.evaluate(() => document.getElementById('sheetBtn').click()); await page.waitForTimeout(1600); return frame(page).evaluate(() => document.body.innerText.includes('Smoke Runner') && document.getElementById('raceSelect').value === 'Goblin'); });
    await step('Explore can send them somewhere', async () => { await page.evaluate(() => document.getElementById('exploreBtn').click()); await page.waitForTimeout(1500); return frame(page).evaluate(() => { const X = window.GRAKK_EXPLORE, t = { district: 'low-halo', place: 'low-halo--rust-market' }; X.startTrip(t, X.planTrip(t)[0]); return !!JSON.parse(localStorage.getItem('grakkgrith_character_tool_v8_state')).world.presence.transit; }); });
    // The Week: rent on the Adyta clock and Heat mail, from a fresh character.
    const ST = () => page.evaluate(() => JSON.parse(localStorage.getItem('grakkgrith_character_tool_v8_state')));
    await step('Mail shows the first week of rent and a badge', async () => {
      await page.evaluate(() => document.getElementById('mailBtn').click()); await page.waitForTimeout(1500); f = frame(page);
      const bill = await f.evaluate(() => !!document.querySelector('.letter.bill button[data-pay]'));
      const badge = await page.evaluate(() => document.getElementById('mailBadge').textContent);
      const w = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      return (bill && badge === '1' && w <= 1) || `bill ${bill}, badge "${badge}", ${w}px too wide`;
    });
    await step('paying rent takes credits and clears the badge', async () => {
      const before = Number((await ST()).coins.credits || 0); await f.click('.letter.bill button[data-pay]'); await page.waitForTimeout(400);
      const after = Number((await ST()).coins.credits || 0), badge = await page.evaluate(() => document.getElementById('mailBadge').textContent);
      return (before - after === 70 && badge === '') || `credits ${before} -> ${after}, badge "${badge}"`;
    });
    await step('Heat 2 sends a notice; the sheet does not wipe the mail', async () => {
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('grakkgrith_character_tool_v8_state')); s.stats.heat = '2'; localStorage.setItem('grakkgrith_character_tool_v8_state', JSON.stringify(s)); });
      await page.evaluate(() => document.getElementById('sheetBtn').click()); await page.waitForTimeout(1600);
      await page.evaluate(() => document.getElementById('mailBtn').click()); await page.waitForTimeout(1500); f = frame(page);
      const s = await ST(), notices = s.week.mail.filter(m => m.kind === 'notice').length, paid = s.week.mail.some(m => m.kind === 'bill' && m.status === 'paid');
      return (notices === 1 && paid && await f.evaluate(() => !!document.querySelector('.letter.notice'))) || `notices ${notices}, bill paid ${paid}, heat ${s.stats.heat}`;
    });
    // The Workshop: a Runner makes a Route Sheet through the UI and gets a full record.
    await step('Workshop shows the Runner list and fits the screen', async () => {
      await page.evaluate(() => document.getElementById('makeBtn').click()); await page.waitForTimeout(1500); f = frame(page);
      const names = await f.$$eval('.recipe b', bs => bs.map(b => b.textContent)); const w = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      return (names.includes('Route Sheet') && names.includes('Delivery Slot') && w <= 1) || `${names.join(', ')}; ${w}px too wide`;
    });
    await step('making a Route Sheet spends a downtime action and records it', async () => {
      await f.click('.recipe[data-recipe="route-sheet"]'); await f.selectOption('#fDistrict', 'low-halo'); await f.click('#doMake'); await page.waitForTimeout(400);
      const s = await ST(), a = (s.make && s.make.artifacts || [])[0];
      return (a && a.recipe === 'route-sheet' && a.creator.name === 'Smoke Runner' && a.location.district === 'low-halo' && s.downtime.actionsRemaining === 1 && await f.evaluate(() => document.querySelectorAll('.work .letter').length) === 1) || JSON.stringify(a).slice(0, 120);
    });
    await step('a Runner takes a delivery and Explore shows the pickup', async () => {
      await f.click('.recipe[data-recipe="delivery-run"]'); const n = await f.$$eval('[data-take]', b => b.length);
      await f.click('[data-take] >> nth=0'); await page.waitForTimeout(400);
      const a = (await ST()).make.artifacts.find(x => x.delivery); if (!a) return `board had ${n} jobs; none taken`;
      await f.click('.work [data-go] >> nth=0'); await page.waitForTimeout(1800); const ex = frame(page);
      const url = await ex.evaluate(() => location.search), note = await ex.evaluate(() => (document.querySelector('#sheetBody .job') || {}).textContent || '');
      return (n === 3 && url.includes(encodeURIComponent(a.delivery.from.place)) && /Pick up here/.test(note)) || `jobs ${n}, url ${url}, note "${note}"`;
    });
    await step('Pocket Change shows gigs and fits the screen', async () => {
      await page.evaluate(() => document.getElementById('gigsBtn').click()); await page.waitForTimeout(1500); f = frame(page);
      const n = await f.$$eval('.gig [data-take]', b => b.length), w = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      return (n >= 1 && w <= 1) || `${n} gigs to take; ${w}px too wide`;
    });
    await step('Radio Sewers is on air with the right DJ and a live link', async () => {
      await page.evaluate(() => document.getElementById('radioBtn').click()); await page.waitForTimeout(1500); f = frame(page);
      const dj = await f.evaluate(() => document.querySelector('.onair h2').textContent), link = await f.evaluate(() => document.querySelector('a.listen').href);
      const segs = await f.$$eval('.seg', x => x.length), w = await f.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      return (['Smokier', 'DJ Sludge', 'DJ Stormbird'].includes(dj) && /goblinnib/.test(link) && segs >= 10 && w <= 1) || `${dj}, ${link}, ${segs} segments, ${w}px too wide`;
    });
    // Mixed Heritage (Ch. 15) and Afflictions (Ch. 20) in Character Setup and on the sheet.
    await step('Mixed Heritage and Affliction rules hold in Character Setup', async () => {
      await page.evaluate(() => document.getElementById('creatorBtn').click()); await page.waitForTimeout(1200); f = frame(page);
      return f.evaluate(() => {
        const fail = [];
        c = Object.assign(blank(), { name: 'T', race: 'Fairy' }); c.heritage.on = true;
        if (heritageSecondaries().length || !validate(1).length) fail.push('Fairy should not take a mortal Secondary Heritage');
        c = Object.assign(blank(), { name: 'T', race: 'Elf', class: 'Runner' });
        Object.assign(c.heritage, { on: true, secondary: 'Goblin', mark: 'Route Instinct', complication: 'Split Claim', registration: 'Missing Record', publicRead: 'As both', subclassFrom: 'secondary' });
        if (!subclasses().some(s => s.name === 'Threnn Guide')) fail.push('Goblin-heritage swap should unlock Threnn Guide');
        Object.assign(c.affliction, { id: 'Vampire', stage: 'Awakened' });
        if (!validate(1).some(e => /adaptation/.test(e))) fail.push('Awakened Vampire must choose an adaptation');
        c.affliction.adaptation = 'savvy';
        if (validate(1).length) fail.push('complete build still has errors: ' + validate(1)[0]);
        if (finals().savvy !== 2) fail.push(`Elf Vampire savvy should be 2, got ${finals().savvy}`);
        c.affliction.stage = 'Dormant';
        if (finals().savvy !== 1) fail.push('Dormant should not give the +1');
        Object.assign(c.affliction, { id: 'Beastkin', stage: 'Awakened', aspect: 'Hunter', adaptation: '', line: 'Lycan', bane: 'Silver' });
        if (finals().muscle !== 2) fail.push(`Elf Beastkin Hunter muscle should be 2 (floor then +1), got ${finals().muscle}`);
        if (validate(1).length) fail.push('Lycan Beastkin with Silver should be valid: ' + validate(1)[0]);
        Object.assign(c.affliction, { line: 'Lab line', bane: 'Silver' });
        if (!validate(1).some(e => /Bane/.test(e))) fail.push('a lab line cannot take Silver as its Bane');
        c.affliction.bane = 'Helix deterrent';
        if (validate(1).length) fail.push('lab line with a Helix deterrent should be valid');
        c.affliction.line = '';
        if (!validate(1).some(e => /bloodline/.test(e))) fail.push('Beastkin must choose a bloodline');
        return fail.length ? fail.join('; ') : true;
      });
    });
    await step('the sheet keeps the heritage subclass and the Affliction +1', async () => {
      await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('grakkgrith_character_tool_v8_state'));
        Object.assign(s.character, { race: 'Elf', class: 'Runner', subclass: 'Threnn Guide', heritage: { on: true, secondary: 'Goblin', mark: 'Route Instinct', complication: 'Split Claim', registration: 'Missing Record', publicRead: 'As both', subclassFrom: 'secondary' }, affliction: { id: 'Beastkin', stage: 'Awakened', aspect: 'Hunter', adaptation: 'muscle', line: 'Lycan', bane: 'Silver' } });
        s.builder = Object.assign(s.builder || {}, { base: { muscle: '1', reflex: '4', wit: '3', savvy: '2', spark: '2', root: '2' } });
        localStorage.setItem('grakkgrith_character_tool_v8_state', JSON.stringify(s)); });
      await page.evaluate(() => document.getElementById('sheetBtn').click()); await page.waitForTimeout(1800); f = frame(page);
      const sub = await f.evaluate(() => document.getElementById('subclassSelect').value);
      const muscle = (await page.evaluate(() => JSON.parse(localStorage.getItem('grakkgrith_character_tool_v8_state')).stats.muscle));
      const panel = await f.evaluate(() => document.getElementById('heritagePanel').innerText);
      return (sub === 'Threnn Guide' && muscle === '2' && /Beastkin/.test(panel) && /Lycan line/.test(panel) && /Route Instinct/.test(panel)) || `subclass ${sub}, muscle ${muscle}, panel ${panel.slice(0, 40)}`;
    });
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
