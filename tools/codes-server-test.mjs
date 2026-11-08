// Tests for the item-code server logic (server/src/codes.js) against the in-memory store. Run: node tools/codes-server-test.mjs
import { createCodes, memoryStore, normalizeCode, newCode, gradeRank } from '../server/src/codes.js';

const fails = [], passes = []; const ok = (n, c, d = '') => (c ? passes : fails).push(c ? n : `${n}: ${d}`);
let t = 1_800_000_000_000; const clock = () => t;
const K = n => n.repeat(40);                                   // a PDA key (32+ chars)
const eko = K('e'), nib = K('n'), vex = K('v'), out = { name: 'Eko', staysOut: true }, crook = { name: 'Vex', staysOut: false, district: 'Three Wires' };
const fresh = () => createCodes(memoryStore(), { now: clock });
const card = (name, extra = {}) => ({ name, recipe: 'medkit', value: 60, ...extra });

// Codes
const c = newCode();
ok('codes look like GRK-XXXX-XXXX-XX', /^GRK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/.test(c), c);
ok('typed codes are forgiving', normalizeCode(c.toLowerCase().replace(/-/g, ' ')) === c && normalizeCode('grk-0000-1111-22') === normalizeCode('GRK-OOOO-IlIl-22'));
ok('junk is not a code', normalizeCode('hello') === null && normalizeCode('GRK-1234') === null);
ok('grades rank street < connected < restricted < corporate', gradeRank('street') < gradeRank('connected') && gradeRank('connected') < gradeRank('restricted') && gradeRank('restricted') < gradeRank('corporate'));

// Minting and giving
let S = fresh(), m = await S.mint(eko, out, { card: card('Patch kit'), grade: 'street' });
ok('minting returns a code and the item', m.ok && normalizeCode(m.code) === m.code && m.item.card.name === 'Patch kit');
ok('the maker holds it', (await S.inbox(eko, out)).held.some(i => i.id === m.item.id));
let r = await S.claim(nib, { name: 'Nib', staysOut: true }, m.code);
ok('an unoffered code is not a gift', !r.ok && r.notOffered && r.protected, JSON.stringify(r));
await S.offer(eko, m.item.id, true);
r = await S.claim(nib, { name: 'Nib', staysOut: true }, m.code);
ok('an offered code is a gift', r.ok && r.gift && (await S.inbox(nib)).held.some(i => i.id === m.item.id));
let box = await S.inbox(eko);
ok('the giver hears it was claimed and no longer holds it', box.events.some(e => e.kind === 'given') && !box.held.some(i => i.id === m.item.id));
ok('claiming your own code again is harmless', (await S.claim(nib, null, m.code)).already);
ok('only the holder can offer it', !(await S.offer(eko, m.item.id, true)).ok);

// Theft and protection
S = fresh();
const street = await S.mint(eko, out, { card: card('Route sheet'), grade: 'street' });
const conn = await S.mint(eko, out, { card: card('Gear mod', { value: 120 }), grade: 'connected' });
const restr = await S.mint(eko, out, { card: card('Cover papers'), grade: 'restricted' });
ok('Street gear held by someone who stays out can\'t be taken', !(await S.claim(vex, crook, street.code, { intent: 'take', cover: 2 })).ok);
ok('nor Connected', (await S.claim(vex, crook, conn.code, { intent: 'take', cover: 2 })).protected);
r = await S.claim(vex, crook, restr.code, { intent: 'take', cover: 2 });
ok('Restricted gear is always fair game', r.ok && r.theft && r.item.stolen);
box = await S.inbox(eko);
ok('the owner learns it\'s gone, not who took it', box.events.some(e => e.kind === 'taken' && !/Vex/.test(e.text)) && !box.held.some(i => i.id === restr.item.id));
const reckless = { name: 'Eko', staysOut: false };
S = fresh(); const s2 = await S.mint(eko, reckless, { card: card('Medkit'), grade: 'street' });
ok('anyone in the crime game can lose Street gear', (await S.claim(vex, crook, s2.code, { intent: 'take', cover: 1 })).theft);
r = await S.claim(nib, { name: 'Nib', staysOut: false }, s2.code, { intent: 'take', cover: 0 });
ok('stolen goods stay stealable even from someone who stays out', (await S.claim(vex, crook, s2.code)).already === undefined && r.theft);

// Tracing
S = fresh(); const p = await S.mint(eko, out, { card: card('Corp badge'), grade: 'corporate' });
await S.claim(vex, crook, p.code, { intent: 'take', cover: 2 });
ok('a stranger can\'t trace it', !(await S.trace(nib, p.item.id, 5)).ok);
r = await S.trace(eko, p.item.id, 2); ok('a tie gives the district', r.result === 'district' && r.district === 'Three Wires', JSON.stringify(r));
r = await S.trace(eko, p.item.id, 3); ok('beating the cover names the holder', r.result === 'found' && r.holder === 'Vex');
r = await S.trace(eko, p.item.id, 1); ok('losing sends the trail cold', r.result === 'lost');
r = await S.trace(eko, p.item.id, 9); ok('cold for a week', r.result === 'cold');
t += 8 * 86400000; r = await S.trace(eko, p.item.id, 9); ok('warm again after a week', r.result === 'found');

// Scrubbing
S = fresh(); const loot = await S.mint(eko, out, { card: card('Rifle'), grade: 'restricted' });
await S.claim(vex, crook, loot.code, { intent: 'take', cover: 0 });
const weak = await S.mint(vex, crook, { card: card('Code scrub kit'), kind: 'kit', kitGrade: 'connected' });
ok('a kit too weak for the grade is refused', !(await S.scrub(vex, weak.item.id, loot.item.id)).ok);
const kit = await S.mint(vex, crook, { card: card('Code scrub kit'), kind: 'kit', kitGrade: 'restricted' });
ok('only the holder can use a kit', !(await S.scrub(eko, kit.item.id, loot.item.id)).ok);
r = await S.scrub(vex, kit.item.id, loot.item.id);
ok('scrubbing gives a new code and cleans it', r.ok && r.code !== loot.code && !r.item.stolen);
ok('the old code is dead', !(await S.claim(eko, out, loot.code, { intent: 'take', cover: 0 })).ok);
ok('the kit is used up', !(await S.scrub(vex, kit.item.id, loot.item.id)).ok && !(await S.inbox(vex)).held.some(i => i.id === kit.item.id));
r = await S.trace(eko, loot.item.id, 9); ok('a scrub ends the trail', r.result === 'scrubbed');
const newCode2 = r && (await S.scrub(vex, weak.item.id, weak.item.id));
ok('a kit can\'t scrub itself', !newCode2.ok);

// Retiring and limits
S = fresh(); const sold = await S.mint(eko, out, { card: card('Medkit'), grade: 'street' });
await S.retire(eko, sold.item.id); await S.offer(eko, sold.item.id, true);
ok('a retired item\'s code is dead', !(await S.claim(nib, null, sold.code)).ok);
S = createCodes(memoryStore(), { now: clock, limits: { misses: 3 } });
for (let i = 0; i < 3; i++) await S.claim(vex, crook, newCode(), { intent: 'take' });
const real = await S.mint(eko, reckless, { card: card('Medkit'), grade: 'street' }); await S.offer(eko, real.item.id, true);
ok('too many wrong codes locks you out for a while', (await S.claim(vex, crook, real.code)).locked);
ok('no key, no service', !(await S.mint('short', out, { card: card('x') })).ok);

for (const f of fails) console.log('  ✗ ' + f);
console.log(`${passes.length} code-server checks passed.`);
if (fails.length) { console.log(`${fails.length} failed.`); process.exit(1); }
