// End-to-end tests for item codes: apps/make.js + apps/codes.js talking to server/src/codes.js in memory.
// Run: node tools/codes-client-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createCodes, memoryStore } from '../server/src/codes.js';

const box = { window: { crypto: globalThis.crypto } };
for (const f of ['week.js', 'make.js', 'codes.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), box);
const MK = box.window.GRAKK_MAKE, CO = box.window.GRAKK_CODES;
const M = { ...JSON.parse(readFileSync(new URL('../data/make.json', import.meta.url))) }; M.codes = { ...M.codes, api: 'https://codes.test' };
const fails = [], passes = []; const ok = (n, c, d = '') => (c ? passes : fails).push(c ? n : `${n}: ${d}`);
const T = Date.UTC(2026, 10, 7, 20, 0), D = 86400000, six = () => 0.99, one = () => 0;

// A fake network: routes straight into the server logic.
const server = createCodes(memoryStore());
const net = async (url, init) => { const b = JSON.parse(init.body), p = new URL(url).pathname; const out =
  p === '/mint' ? await server.mint(b.key, b.profile, b) : p === '/offer' ? await server.offer(b.key, b.itemId, b.on !== false) :
  p === '/claim' ? await server.claim(b.key, b.profile, b.code, { intent: b.intent, cover: b.cover }) : p === '/scrub' ? await server.scrub(b.key, b.kitId, b.itemId) :
  p === '/trace' ? await server.trace(b.key, b.itemId, b.successes) : p === '/retire' ? await server.retire(b.key, b.itemId) : await server.inbox(b.key, b.profile, b.since);
  return { json: async () => out }; };
const char = (name, cls, o = {}) => ({ character: { name, class: cls, level: '2' }, stats: { heat: String(o.heat ?? 0), stress: '0', wit: '3', savvy: '3', reflex: '3', spark: '2', muscle: '2' }, skills: { medic: '2', hack: '2', forge: '2', network: '2', negotiate: '2', pickpocket: '2', deceive: '1', intel: '2', streetwise: '1' }, coins: { credits: '400' }, downtime: { actionsRemaining: 2 }, week: { sessionsStarted: 1 } });

// Grades
ok('a lawful medkit is Street', CO.gradeOf({ legality: 'lawful', value: 60 }, M) === 'street');
ok('lawful work worth 100+ is Connected', CO.gradeOf({ legality: 'lawful', value: 120 }, M) === 'connected');
ok('restricted work is Restricted', CO.gradeOf({ legality: 'restricted', value: 150 }, M) === 'restricted');
ok('staying out: Heat under 4', CO.staysOut(char('a', 'Wrench'), T) && !CO.staysOut(char('a', 'Wrench', { heat: 4 }), T));

// Make, mint, offer, claim
const eko = char('Eko', 'Wrench'), nib = char('Nib', 'Ghost'), vex = char('Vex', 'Ghost', { heat: 2 });
let r = MK.make(eko, M, 'medkit', {}, T, six); const kit = r.artifact;
r = await CO.mint(eko, M, kit, T, net);
ok('a new Workshop item gets a code', r.ok && /^GRK-/.test(kit.code) && kit.itemId && kit.grade === 'street', JSON.stringify(r));
ok('the PDA made itself a key', eko.codes.key.length >= 32);
r = await CO.claim(nib, M, kit.code, T, {}, net);
ok('claiming an unoffered code asks first', !r.ok && r.notOffered && r.protected);
await CO.offer(eko, M, kit, true, T, net); r = await CO.claim(nib, M, kit.code, T, {}, net);
ok('an offered code moves the item to the claimer', r.ok && r.gift && nib.make.artifacts[0].name === kit.name && nib.make.artifacts[0].owner === 'Nib');
r = await CO.sync(eko, M, T, net);
ok('the giver\'s Workshop marks it given', kit.status === 'given' && r.lines.length === 1);

// Theft: protected Street gear, then Restricted gear taken
r = MK.make(eko, M, 'gear-mod', { option: MK.recipe(M, 'gear-mod').options?.[0] }, T, six); const mod = r.artifact; await CO.mint(eko, M, mod, T, net);
r = await CO.claim(vex, M, mod.code, T, { take: { attribute: 'reflex', skill: 'pickpocket' }, rng: six }, net);
ok('Connected gear held by someone who stays out can\'t be taken', !r.ok && r.protected, JSON.stringify(r));
const ghost = char('Gh', 'Ghost'); r = MK.make(ghost, M, 'cover-papers', {}, T, six); const papers = r.artifact; await CO.mint(ghost, M, papers, T, net);
ok('cover papers are Restricted', papers.grade === 'restricted');
r = await CO.claim(vex, M, papers.code, T, { take: { attribute: 'reflex', skill: 'pickpocket' }, rng: six, district: 'Three Wires' }, net);
const loot = vex.make.artifacts[0];
ok('Restricted gear can be taken; the thief rolled cover', r.ok && r.theft && r.coverRoll.hits === 5 && loot.stolen);
ok('stealing takes you out of "staying out"', !CO.staysOut(vex, T) && CO.staysOut(vex, T + 29 * D));
await CO.sync(ghost, M, T, net);
ok('the victim\'s Workshop marks it taken, without a name', papers.status === 'taken' && !/Vex/.test(papers.events[0].text));

// Heat for using what you took
const h0 = Number(vex.stats.heat); MK.use(vex, loot.id, T);
ok('using a taken item costs Heat +1', Number(vex.stats.heat) === h0 + 1);

// Trace
ghost.downtime.actionsRemaining = 2;
r = await CO.trace(ghost, M, papers, M.codes.trace[0], T, { rng: one }, net);
ok('a failed trace spends downtime and goes cold', r.ok && r.result === 'lost' && ghost.downtime.actionsRemaining === 1, JSON.stringify(r));
r = await CO.trace(ghost, M, papers, M.codes.trace[0], T, { rng: six }, net);
ok('a cold trail doesn\'t cost another action', r.result === 'cold' && ghost.downtime.actionsRemaining === 1);

// Scrub kits from the Workshop, by grade
const fixer = char('Fixer', 'Broker');
r = MK.make(fixer, M, 'code-scrub-broker', { option: 'Restricted' }, T, six);
ok('a Restricted kit costs 60 and is restricted work', r.ok && r.artifact.kitGrade === 'restricted' && fixer.coins.credits === '340' && r.artifact.legality === 'restricted', JSON.stringify(r.artifact && { g: r.artifact.kitGrade, c: fixer.coins.credits }));
const fixer2 = char('Fixer2', 'Signal'); fixer2.stats.savvy = '2'; fixer2.skills.network = '1';   // 3 dice: 3 hits is one short of 4
r = MK.make(fixer2, M, 'code-scrub-signal', { option: 'Corporate / Military' }, T, (() => { let i = 0; const seq = [0.9, 0.9, 0.9, 0]; return () => seq[i++ % 4]; })());
ok('one short makes a kit a grade lower', r.ok && r.artifact.status === 'active' && r.artifact.kitGrade === 'restricted', JSON.stringify(r.artifact && { st: r.artifact.status, g: r.artifact.kitGrade, roll: r.artifact.roll }));
ok('the top grade costs 150 and 1 Stress', fixer2.coins.credits === '250' && fixer2.stats.stress === '1');
const sk = fixer.make.artifacts[0]; await CO.mint(fixer, M, sk, T, net); await CO.offer(fixer, M, sk, true, T, net);
await CO.claim(vex, M, sk.code, T, {}, net); const vexKit = vex.make.artifacts[0];
ok('a kit trades by its own code', vexKit.kit && vexKit.kitGrade === 'restricted');
const old = loot.code; r = await CO.scrub(vex, M, vexKit, loot, T, net);
ok('scrubbing: new code only the buyer sees, item clean, kit used', r.ok && loot.code !== old && !loot.stolen && vexKit.status === 'used');
ghost.downtime.actionsRemaining = 2; r = await CO.trace(ghost, M, papers, M.codes.trace[0], T + 8 * D, { rng: six }, net);
ok('after a scrub the trail ends', r.result === 'scrubbed');
const h1 = Number(vex.stats.heat); MK.use(vex, loot.id, T + D); vex.week.sessionsStarted = 2; MK.use(vex, loot.id, T + 2 * D);
ok('scrubbed goods don\'t cost Heat to use', Number(vex.stats.heat) === h1);

// Old items stay code-free
const late = char('Late', 'Wrench'); r = MK.make(late, M, 'medkit', {}, T, six); CO.ensure(late).liveSince = T + D;
ok('items made before codes went live get no code', !(await CO.mint(late, M, r.artifact, T + 2 * D, net)).ok);
ok('no server, no trading', !CO.live({ codes: { api: '' } }) && !(await CO.mint(char('x', 'Wrench'), { codes: { api: '' } }, { kind: 'item', status: 'active', events: [] }, T, net)).ok);

for (const f of fails) console.log('  ✗ ' + f);
console.log(`${passes.length} item-code checks passed.`);
if (fails.length) { console.log(`${fails.length} failed.`); process.exit(1); }
