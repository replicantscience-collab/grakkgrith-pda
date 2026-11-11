// Unit tests for apps/trade.js (trade codes). Run: node tools/trade-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {}, CompressionStream, DecompressionStream, TextEncoder, TextDecoder, crypto, Buffer };
vm.runInNewContext(readFileSync(new URL('../apps/trade.js', import.meta.url), 'utf8'), sb);
const TR = sb.window.GRAKK_TRADE;
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const T0 = Date.UTC(2026, 10, 10);
const blank = () => ({ name: '', class: '', img: '', adds: Array(8).fill('') });
const player = (name, cls = 'Runner', credits = 200) => ({ character: { name, class: cls, level: '3' }, stats: { heat: '0' }, coins: { credits: String(credits) }, inventory: Array.from({ length: 6 }, blank) });

// Issue
let eko = player('Ekois'), gun = { name: 'Quiet pipe-gun', class: 'WEAPON', desc: 'Backfires on a 1.', img: 'x'.repeat(30000), adds: ['', '', '', '', '', '', '3', '6'] };
TR.issue(gun, eko, T0); eko.inventory[0] = gun;
ok('an item gets a code when issued', gun.trade && gun.trade.id.startsWith('it-') && gun.trade.by === 'Ekois' && gun.trade.taken === false);
ok('issuing twice keeps the first code', (TR.issue(gun, eko, T0 + 1), gun.trade.issued === T0));
ok('an old item without a code is left alone', !blank().trade);

// Codes round-trip and stay short
const code = await TR.codeFor(gun, eko, T0);
ok('a code has the prefix', code.startsWith('GRK1-'));
ok('a code fits in a Discord message', code.length < 1500, String(code.length));
const back = await TR.decode(code);
ok('a code decodes to the item', back.t === 'item' && back.item.name === 'Quiet pipe-gun' && back.id === gun.trade.id && back.by === 'Ekois');
ok('big images are left out of the code', back.item.img === '');
ok('the trade record itself does not travel', !back.item.trade);
let bad = await TR.claim(eko, 'hello there', T0); ok('garbage is refused', bad.ok === false && /trade code/.test(bad.msg));
bad = await TR.claim(eko, 'GRK1-AAAA', T0); ok('a mangled code is refused, not thrown', bad.ok === false);

// Pass and claim, clean
let nib = player('Nib', 'Broker');
let r = await TR.pass(eko, 0, 'Nib', T0 + 1000);
ok('passing gives a code for the receiver', r.ok && r.code.startsWith('GRK1-') && gun.trade.passed.to === 'Nib');
let c = await TR.claim(nib, r.code, T0 + 2000);
ok('the named receiver claims it clean', c.ok && c.clean && !c.item.trade.taken && nib.inventory[0].name === 'Quiet pipe-gun');
ok('the chain records the hand-over', c.item.trade.chain.length === 1 && c.item.trade.chain[0].from === 'Ekois' && c.item.trade.chain[0].to === 'Nib');
ok('the same id cannot be claimed twice', (await TR.claim(nib, r.code, T0 + 3000)).ok === false);
ok('nothing in the character ever hits Heat for a clean claim', TR.hotUse(nib, nib.inventory[0]) === '' && nib.stats.heat === '0');

// A stolen code
let thief = player('Sludge', 'Ghost', 500);
c = await TR.claim(thief, r.code, T0 + 4000);
ok('someone else can claim the code too (no server), but it is taken', c.ok && !c.clean && c.item.trade.taken);
ok('taken is flagged in the message', /taken/.test(c.msg));
let note = TR.hotUse(thief, thief.inventory[0]);
ok('using a taken item adds Heat once', note && thief.stats.heat === '1' && TR.hotUse(thief, thief.inventory[0]) === '' && thief.stats.heat === '1');
ok('the maker claiming their own fresh code is clean', (await TR.claim(player('Ekois'), await TR.codeFor({ ...gun, trade: { ...gun.trade, chain: [] } }, eko, T0), T0)).clean === true);

// Scrub
ok('scrub cost climbs with tier', TR.scrubCost({}) === 20 && TR.scrubCost({ pattern: { tier: 3 } }) === 80 && TR.scrubCost({ pattern: { tier: 4 } }) === 160);
const oldSecret = thief.inventory[0].trade.secret; thief.inventory[0].shopName = 'Sideways Shops';
r = TR.scrub(thief, 0, T0 + 5000);
ok('a Ghost scrubs it clean and wipes the maker mark', r.ok && r.cost === 20 && thief.coins.credits === '480' && !thief.inventory[0].trade.taken && thief.inventory[0].trade.secret !== oldSecret && thief.inventory[0].shopName === '' && thief.inventory[0].trade.scrubbed === 1);
ok('a Runner cannot scrub', TR.scrub(eko, 0, T0).ok === false);
const broke = player('Poor', 'Wrench', 5); broke.inventory[0] = { ...gun, trade: { ...gun.trade } };
ok('scrubbing needs the credits', TR.scrub(broke, 0, T0).ok === false && /costs 20/.test(TR.scrub(broke, 0, T0).msg));
const wrench = player('Fix', 'Wrench', 100); wrench.inventory[0] = { ...gun, shopName: 'Sideways Shops', trade: { ...gun.trade, taken: true } };
ok('a Wrench scrubs the code but keeps the maker mark', TR.scrub(wrench, 0, T0).ok && wrench.inventory[0].shopName === 'Sideways Shops' && !wrench.inventory[0].trade.taken);

// Full inventory
const full = player('Full'); full.inventory = full.inventory.map((_, i) => ({ name: 'Thing ' + i }));
ok('no empty slot, no claim', (await TR.claim(full, r.code || code, T0)).ok === false);

console.log(fails ? `${fails} trade checks failed, ${passes} passed.` : `trade: all ${passes} checks pass.`);
process.exit(fails ? 1 : 0);
