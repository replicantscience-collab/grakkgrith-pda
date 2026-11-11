// Unit tests for apps/patterns.js. Run: node tools/patterns-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {}, CompressionStream, DecompressionStream, TextEncoder, TextDecoder, crypto, Buffer };
for (const f of ['week.js', 'trade.js', 'patterns.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), sb);
const PT = sb.window.GRAKK_PATTERNS, TR = sb.window.GRAKK_TRADE;
const P = JSON.parse(readFileSync(new URL('../data/patterns.json', import.meta.url), 'utf8'));
const M = JSON.parse(readFileSync(new URL('../data/make.json', import.meta.url), 'utf8'));
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const T0 = Date.UTC(2026, 10, 11, 12);
const blank = () => ({ name: '', class: '', img: '', adds: Array(8).fill('') });
const char = (cls = 'Wrench', lvl = 3) => ({ character: { name: 'Eko', class: cls, level: String(lvl) }, stats: { heat: '0', wit: '3', spark: '2', muscle: '2', reflex: '2' }, skills: { repair: '2', ward: '2', salvage: '2', forge: '1', hack: '1' }, coins: { credits: '300' }, inventory: Array.from({ length: 8 }, blank), downtime: { actionsRemaining: 2 }, equipment: {}, world: { presence: { location: { district: 'low-halo', place: 'low-halo--rust-market' } } } });
const hi = () => 0.99, lo = () => 0.01, mid = () => 0.5; // 5-6 is a success on d6: rng 0.99 -> 6, 0.5 -> 4, 0.01 -> 1

// Data sanity
ok('every improvement names groups or frames that exist', Object.values(P.improvements).every(im => (im.groups || []).every(g => Object.values(P.frames).some(f => f.group === g)) && (im.frames || []).every(f => P.frames[f])));
ok('every part district exists in places.json', (() => { const pl = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8')); return Object.values(P.parts).every(pt => pt.districts.every(d => pl.districts[d])) && pl.places.some(x => x.id === P.market.place); })());
ok('frames are owned by real classes', Object.values(P.frames).every(f => [].concat(f.class).every(c => P.classRoles[c])));

// Validation and caps
let s = char('Wrench');
let v = PT.validate(P, s, { name: 'Zip', frame: 'light-weapon', variant: 'holdout-pistol', tier: 1, improvements: [], quirks: [] });
ok('a plain tier 1 sketch validates', v.ok, v.problems.join('; '));
v = PT.validate(P, s, { name: 'Zip', frame: 'light-weapon', tier: 1, improvements: ['reliable'], quirks: [] });
ok('no slot, no improvement', !v.ok && /slot/.test(v.problems[0]));
v = PT.validate(P, s, { name: 'Zip', frame: 'light-weapon', tier: 1, improvements: ['reliable'], quirks: ['ugly'] });
ok('a quirk buys one slot (the sewer-gun upgrade path)', v.ok && v.bought === 1);
v = PT.validate(P, s, { name: 'Zip', frame: 'light-weapon', tier: 1, improvements: ['reliable', 'ap1'], quirks: ['ugly', 'loud'] });
ok('never more than one bought slot', !v.ok);
v = PT.validate(P, s, { name: 'Zip', frame: 'light-weapon', tier: 1, improvements: [], quirks: ['backfire'] });
ok('the built-in quirk buys nothing', !v.ok && /built into/.test(v.problems[0]));
v = PT.validate(P, s, { name: 'Vest', frame: 'medium-armor', variant: 'ballistic-vest', tier: 4, improvements: ['absorb-ballistic', 'absorb-ballistic'], quirks: ['ugly'] });
ok('the same improvement twice is refused', !v.ok && v.problems.some(p => /twice/.test(p)));
v = PT.validate(P, char('Wrench', 8), { name: 'Plate', frame: 'heavy-armor', variant: 'riot-armor', tier: 4, improvements: ['absorb-impact'], quirks: [] });
ok('single armor value caps at 3', !v.ok && /cap is 3/.test(v.problems.join()));
v = PT.validate(P, s, { name: 'X', frame: 'light-weapon', tier: 4, improvements: [], quirks: [] });
ok('tier 4 needs level 6', !v.ok && /level 6/.test(v.problems[0]));
v = PT.validate(P, s, { name: 'X', frame: 'light-weapon', tier: 5, improvements: [], quirks: [] });
ok('players never make tier 5', !v.ok && /Tier 5/.test(v.problems[0]));
v = PT.validate(P, s, { name: 'Ward', frame: 'charm', tier: 1, improvements: [], quirks: [] });
ok('a Wrench cannot sketch a charm', !v.ok && /Shade/.test(v.problems[0]));
v = PT.validate(P, s, { name: 'Zip', frame: 'light-weapon', tier: 1, improvements: ['absorb-blade'], quirks: ['ugly'] });
ok('armor improvements do not fit weapons', !v.ok && /doesn't fit/.test(v.problems[0]));
v = PT.validate(P, s, { name: 'Kit', frame: 'consumable', variant: 'medkit', tier: 3, improvements: ['extra-use', 'extra-use', 'extra-use'], quirks: ['fragile'] });
ok('uses cap at 3 and slots hold', !v.ok);
ok('frames for a Runner are bags and tools', PT.framesFor(P, 'Runner').sort().join() === 'bag,tool');
ok('a Striker designs nothing', PT.framesFor(P, 'Striker').length === 0);

// Sketch, parts, prototype
let r = PT.saveSketch(s, P, { name: 'Zip gun', frame: 'light-weapon', variant: 'holdout-pistol', tier: 1, improvements: ['reliable'], quirks: ['ugly'], makerMark: 'Sideways Shops' }, T0);
ok('a sketch saves', r.ok && s.patterns.sketches.length === 1 && r.sketch.status === 'sketch');
const id = r.sketch.id;
ok('value follows book price x tier x improvements', PT.value(P, r.sketch) === Math.round(120 * 0.25 * 1.25));
let pv = PT.previewPrototype(s, P, id, { parts: {} });
ok('prototype needs the parts', !pv.ok && pv.blockers.some(b => /exactly 1 part/.test(b)));
r = PT.buyParts(s, P, 'scrap', 2, T0);
ok('parts are bought at Rust Market', r.ok && PT.partCount(s, 'scrap') === 2 && s.coins.credits === '270');
s.world.presence.location = { district: 'the-tangle', place: 'x' };
ok('not at Rust Market, no shopping', !PT.buyParts(s, P, 'scrap', 1, T0).ok);
pv = PT.previewPrototype(s, P, id, { parts: { scrap: 1 } });
ok('with a part, the preview is clear and says the roll', pv.ok && pv.roll.pool === 5 && pv.roll.difficulty === 1 && pv.roll.label === 'Wit + Repair', pv.blockers.join('; '));
r = PT.prototype(s, P, id, { parts: { scrap: 1 } }, T0, hi);
ok('a success makes a Prototype in the inventory with a trade code', r.ok && r.made && !r.partial && s.inventory[0].pattern && s.inventory[0].pattern.status === 'prototype' && s.inventory[0].trade && s.inventory[0].trade.by === 'Eko');
ok('the card reads as a weapon', s.inventory[0].class === 'WEAPON' && s.inventory[0].attackProfile.skill === 'ranged' && s.inventory[0].adds[6] === '6' && /Reliable/.test(s.inventory[0].attackProfile.properties) && /Ugly/.test(s.inventory[0].attackProfile.properties) && !/Backfire/.test(s.inventory[0].attackProfile.properties));
ok('it cost a downtime action and the part', s.downtime.actionsRemaining === 1 && PT.partCount(s, 'scrap') === 1);
ok('maker mark is on the card', s.inventory[0].shopName === 'Sideways Shops');
ok('a hidden quirk is sealed, not readable', !r.item.pattern.hidden || !P.quirks[r.item.pattern.hidden]);
s.downtime.actionsRemaining = 0; ok('no downtime left, no prototype', !PT.previewPrototype(s, P, id, { parts: { scrap: 1 } }).ok);

// Failure loses half the parts
s = char('Wrench'); PT.saveSketch(s, P, { name: 'Vest', frame: 'medium-armor', variant: 'ballistic-vest', tier: 3, improvements: [], quirks: [] }, T0); PT.addPart(s, 'scrap', 2);
r = PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2 } }, T0, lo);
ok('a failure keeps the sketch and loses half the parts, and the 20 cr', r.ok && !r.made && PT.partCount(s, 'scrap') === 1 && s.patterns.sketches.length === 1 && s.coins.credits === '280' && !s.inventory[0].name);
// Partial adds a quirk
s = char('Wrench'); PT.saveSketch(s, P, { name: 'Vest', frame: 'medium-armor', variant: 'ballistic-vest', tier: 3, improvements: [], quirks: [] }, T0); PT.addPart(s, 'scrap', 2);
let seq = [0.99, 0.5, 0.5, 0.5, 0.5, 0.3, 0.9]; r = PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2 } }, T0, () => seq.length > 1 ? seq.shift() : 0.9);
ok('one short of Challenging is a partial: works, with an extra quirk', r.ok && r.made && r.partial && r.extraQuirk && s.inventory[0].pattern.quirks.includes(r.extraQuirk), JSON.stringify(r));
ok('the armor card carries the profile', s.inventory[0].class === 'ARMOR' && s.inventory[0].armorProfile.base.ballistic === '2' && /-1 die Dash/.test(s.inventory[0].desc));

// Tier 4 needs chrome or ember
s = char('Wrench', 8); PT.saveSketch(s, P, { name: 'Good vest', frame: 'medium-armor', variant: 'ballistic-vest', tier: 4, improvements: ['absorb-ballistic'], quirks: [] }, T0); PT.addPart(s, 'scrap', 3);
ok('tier 4 wants Chrome or Ember', PT.previewPrototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 3 } }).blockers.some(b => /Chrome or Ember/.test(b)));
PT.addPart(s, 'chrome', 1); pv = PT.previewPrototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2, chrome: 1 } });
ok('with chrome it clears, Hard roll', pv.ok && pv.roll.difficulty === 3);

// Proven: scene and field test, hidden quirk revealed, cheaper copies
s = char('Wrench'); PT.saveSketch(s, P, { name: 'Zip', frame: 'light-weapon', variant: 'holdout-pistol', tier: 2, improvements: [], quirks: [] }, T0); PT.addPart(s, 'scrap', 4);
seq = [0.99, 0.99, 0.99, 0.99, 0.99, 0.05, 0.2]; r = PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2 } }, T0, () => seq.length ? seq.shift() : 0.9);
ok('a 1-in-6 gives a sealed hidden quirk', r.made && r.item.pattern.hidden && r.item.pattern.hidden.startsWith('h:'));
ok('a Runner cannot field-test', !PT.prove(s, P, 0, T0, 'field-test').ok);
r = PT.prove(s, P, 0, T0 + 1, 'scene');
ok('used in a scene, it is Proven and the hidden quirk shows', r.ok && r.hidden && s.inventory[0].pattern.status === 'proven' && /Hidden quirk/.test(s.inventory[0].desc) && s.patterns.sketches[0].status === 'proven');
let m = PT.materials(P, s, s.patterns.sketches[0]);
ok('copies of a Proven Pattern are one step easier and one part cheaper', m.proven && m.parts === 1 && m.difficulty === 1);
ok('a Proven Pattern cannot be re-sketched', !PT.saveSketch(s, P, { ...s.patterns.sketches[0], name: 'Zip 2' }, T0).ok);
s.downtime.actionsRemaining = 2; r = PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 1 } }, T0 + 2, hi);
ok('the copy is Proven from birth and numbered', r.made && r.item.pattern.status === 'proven' && r.item.pattern.copy === 2);
const striker = char('Striker'); striker.inventory[0] = JSON.parse(JSON.stringify(s.inventory[0])); striker.inventory[0].pattern.status = 'prototype';
r = PT.prove(striker, P, 0, T0, 'field-test');
ok('a Striker field-tests for a downtime action', r.ok && striker.downtime.actionsRemaining === 1 && striker.inventory[0].pattern.status === 'proven');

// Shade reads
const shade = char('Shade'); shade.inventory[0] = JSON.parse(JSON.stringify(s.inventory[0])); shade.inventory[0].pattern.status = 'prototype'; shade.inventory[0].desc = 'Prototype.';
r = PT.read(shade, P, 0, T0, hi);
ok('a Shade reads the hidden quirk', r.ok && r.hidden && /Hidden quirk/.test(shade.inventory[0].desc));
ok('a Wrench cannot Read', !PT.read(s, P, 0, T0, hi).ok);

// Selling
s = char('Wrench'); PT.saveSketch(s, P, { name: 'Pipe', frame: 'standard-weapon', variant: 'sidearm', tier: 3, improvements: [], quirks: [] }, T0); PT.addPart(s, 'scrap', 2);
PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2 } }, T0, hi); const val = s.inventory[0].pattern.value;
ok('value of a tier 3 sidearm is the book price', val === 200);
r = PT.sell(s, P, M, 0, 'fence', T0);
ok('a fence pays 60% and the slot empties', r.ok && r.price === 120 && !s.inventory[0].name && s.stats.heat === '0');
PT.addPart(s, 'scrap', 2); s.downtime.actionsRemaining = 1; PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2 } }, T0, hi);
r = PT.sell(s, P, M, 0, 'street', T0);
ok('restricted work on the street: full price, Heat +1, and a logged sale', r.ok && r.price === 200 && s.stats.heat === '1' && s.patterns.log[0].sale && s.patterns.log[0].sale.how === 'street');

// Gear Mod
s = char('Wrench', 8); PT.saveSketch(s, P, { name: 'Vest', frame: 'medium-armor', variant: 'ballistic-vest', tier: 3, improvements: [], quirks: [] }, T0); PT.addPart(s, 'scrap', 6); PT.addPart(s, 'chrome', 1);
PT.prototype(s, P, s.patterns.sketches[0].id, { parts: { scrap: 2 } }, T0, hi); s.downtime.actionsRemaining = 1; s.coins.credits = '300';
pv = PT.previewGearMod(s, P, 0, { parts: { scrap: 2, chrome: 1 } });
ok('Gear Mod to tier 4 wants the new slot filled', !pv.ok && /pick the improvement/.test(pv.blockers.join()));
r = PT.gearMod(s, P, 0, { parts: { scrap: 2, chrome: 1 }, improvement: 'absorb-blade' }, T0, hi);
ok('Gear Mod takes it to tier 4 with the improvement', r.ok && r.made && s.inventory[0].pattern.tier === 4 && s.inventory[0].armorProfile.base.blade === '1' && s.inventory[0].tier === '4' && s.coins.credits === '240');
ok('tier 4 is the ceiling', !PT.previewGearMod(s, P, 0, {}).ok);

// Pattern and license codes
s = char('Wrench'); PT.saveSketch(s, P, { name: 'Zip', frame: 'light-weapon', variant: 'holdout-pistol', tier: 2, improvements: [], quirks: [] }, T0);
let threw = false; try { await PT.patternCode(s, P, s.patterns.sketches[0].id, T0); } catch (e) { threw = true; }
ok('an unproven Pattern cannot be shared', threw);
s.patterns.sketches[0].status = 'proven';
const pc = await PT.patternCode(s, P, s.patterns.sketches[0].id, T0);
const nib = char('Broker'); r = await PT.claimCode(nib, P, pc, T0);
ok('a Broker claims the Pattern', r.ok && nib.patterns.sketches[0].status === 'proven');
threw = false; try { await PT.licenseCode(s, P, s.patterns.sketches[0].id, 3, 'Sludge', T0); } catch (e) { threw = true; }
ok('only a Broker licenses', threw);
const lc = await PT.licenseCode(nib, P, nib.patterns.sketches[0].id, 3, 'Sludge', T0);
const sludge = char('Wrench'); sludge.character.name = 'Sludge';
r = await PT.claimCode(sludge, P, lc, T0);
ok('the licensee gets 3 copies', r.ok && sludge.patterns.sketches[0].license.copies === 3 && /20%/.test(r.msg));
ok('someone else cannot use that license', !(await PT.claimCode(char('Wrench'), P, lc, T0)).ok);
PT.addPart(sludge, 'scrap', 1); r = PT.prototype(sludge, P, sludge.patterns.sketches[0].id, { parts: { scrap: 1 } }, T0, hi);
ok('a licensed copy is made as Proven, and the cut is logged', r.made && r.item.pattern.status === 'proven' && sludge.patterns.sketches[0].license.copies === 2 && /Owe Eko/.test(sludge.patterns.log[0].text));
ok('a trade-item code is refused here', !(await PT.claimCode(sludge, P, await TR.encode({ v: 1, t: 'item', id: 'x', item: {} }), T0)).ok);

// Salvage
s = char('Wrench'); s.world.presence.location = { district: 'scrapfields', place: 'y' };
ok('the Scrapfields offer scrap and chrome', PT.salvageOptions(P, 'scrapfields').includes('scrap') && PT.salvageOptions(P, 'scrapfields').includes('chrome'));
r = PT.salvage(s, P, 'scrap', T0, hi);
ok('a good Salvage roll finds several parts', r.ok && r.found === 5 && PT.partCount(s, 'scrap') === 5);
ok('one salvage per district per day', !PT.salvage(s, P, 'scrap', T0 + 1000, hi).ok);
ok('next day is fine', PT.salvage(s, P, 'scrap', T0 + 86400000, hi).ok);
s.world.presence.location = { district: 'noble-heights', place: 'z' };
ok('nothing to salvage in Noble Heights', !PT.salvage(s, P, 'scrap', T0, hi).ok);
const run = char('Runner'); ok('a Runner sources a part from a run through Greasewick', PT.sourceFromRun(run, P, ['low-halo', 'greasewick-row']) === 'scrap' && PT.partCount(run, 'scrap') === 1);
ok('a Wrench gets nothing from a run', PT.sourceFromRun(char('Wrench'), P, ['greasewick-row']) === null);

console.log(fails ? `${fails} pattern checks failed, ${passes} passed.` : `patterns: all ${passes} checks pass.`);
process.exit(fails ? 1 : 0);
