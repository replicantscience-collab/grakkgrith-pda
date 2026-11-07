// Unit tests for casting in apps/engine.js (First Edition v1.52, Chapter Twelve). Run: node tools/casting-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const window = {}; vm.runInNewContext(readFileSync(new URL('../apps/engine.js', import.meta.url), 'utf8'), { window });
const R = JSON.parse(readFileSync(new URL('../data/rules.json', import.meta.url)));
const W = id => R.shadeWorkings.find(w => w.id === id);
const fails = [], passes = []; const ok = (n, c, d = '') => (c ? passes : fails).push(c ? n : `${n}: ${d}`);
let s; const E = window.GRAKK_ENGINE.create(() => s);
const shade = (o = {}) => ({ character: { name: 'Vex', class: 'Shade', subclass: o.sub || '', level: '3' }, stats: { spark: String(o.spark ?? 4), root: '2', stress: String(o.stress ?? 0), woundState: '0', muscle: '1', reflex: '2', wit: '2', savvy: '1' }, skills: { cast: '2', sense: '1', ward: '2', disrupt: '1', attune: '1' }, inventory: [], equipment: {}, magic: { resonance: String(o.res ?? 0), knownWorkings: R.shadeWorkings.map(w => w.id), heartRank: o.rank ?? '', developed: '0', veins: o.veins ?? '' } });
const six = () => 0.99, one = () => 0;

// The Arcane Heart
s = shade({ spark: 4 }); let h = E.arcaneHeart();
ok('rank = 1 + floor(Spark/2): Spark 4 is rank 3, Developed', h.rank === 3 && h.max === 9 && h.safe === 3 && h.veins === 9, JSON.stringify(h));
s = shade({ spark: 1 }); ok('Spark 1 is Awakened: 2 Veins, Safe 1', E.arcaneHeart().rank === 1 && E.arcaneHeart().max === 2);
s = shade({ spark: 12 }); ok('rank caps at 6', E.arcaneHeart().rank === 6 && E.arcaneHeart().max === 27);
s = shade({ rank: '2' }); ok('a GM-set rank wins', E.arcaneHeart().rank === 2 && E.arcaneHeart().set);
s = shade(); s.magic.developed = '4'; ok('Developed Capacity adds to max only', E.arcaneHeart().max === 13 && E.arcaneHeart().safe === 3);

// Spending Veins
s = shade(); let r = E.cast(W('hex'), {}, six);
ok('a Standard cast at the safe cost spends 3 Veins and nothing else', r.ok && E.arcaneHeart().veins === 6 && s.stats.stress === '0' && s.stats.woundState === '0', r.message);
ok('the roll is Spark + Cast vs Challenging', r.quote.pool.total === 4 + 2 && r.quote.diff === 2 && r.dice.length === 6);
s = shade(); r = E.cast(W('hex'), {}, one);
ok('the cost is paid even on a failed roll', r.outcome.kind === 'Complete Failure' && E.arcaneHeart().veins === 6);
s = shade(); r = E.cast(W('hex'), { cost: 4 }, one);
ok('cost 4 over Safe 3: Unsafe, +1 Stress, no Wound', s.stats.stress === '1' && s.stats.woundState === '0' && E.arcaneHeart().veins === 5, r.message);
s = shade({ rank: '1' }); r = E.cast(W('shatter'), { cost: 5 }, one);   // Safe 1, max 2 Veins
ok('Major at Safe 1: +4 over = 2 Wounds +1 Stress, and it empties the Veins (+1/+1)', s.stats.stress === '2' && s.stats.woundState === '3' && E.arcaneHeart().veins === 0, `${s.stats.stress} ${s.stats.woundState}`);
s = shade({ veins: '3' }); r = E.cast(W('hex'), {}, one);
ok('Vein Collapse: emptying the Veins is +1 Stress and +1 Wound', E.arcaneHeart().veins === 0 && s.stats.stress === '1' && s.stats.woundState === '1');
s = shade({ veins: '0' }); r = E.cast(W('hex'), {}, one);
ok('Suicidal Casting at 0 Veins: Stress = cost (3), 2 Wounds', s.stats.stress === '3' && s.stats.woundState === '2' && E.arcaneHeart().veins === 0, `${s.stats.stress} ${s.stats.woundState}`);
s = shade({ veins: '0' }); E.cast(W('sense-layer'), { cost: 2 }, one);
ok('Suicidal Minor: Stress 2, 1 Wound', s.stats.stress === '2' && s.stats.woundState === '1');
s = shade({ stress: 5 }); E.cast(W('hex'), { channel: true, cost: 4 }, one);
ok('Stress never passes its cap', s.stats.stress === '6');

// Channel, Resonance, tech
s = shade(); r = E.cast(W('hex'), { channel: true }, one);
ok('Channel: +1 Stress, no extra Veins', s.stats.stress === '1' && E.arcaneHeart().veins === 6);
s = shade({ res: 3 }); ok('Resonance 3 adds 2 casting dice', E.castQuote(W('hex'), {}).pool.total === 8 && E.castQuote(W('hex'), {}).resDice === 2);
s = shade({ res: 1 }); ok('Resonance 1 adds 1 die', E.castQuote(W('hex'), {}).resDice === 1);
s = shade({ res: 2 }); ok('Resonance 2: Channel near tech is safe, an ordinary cast still risks it', !E.castQuote(W('hex'), { channel: true, tech: true }).techRisk && E.castQuote(W('hex'), { tech: true }).techRisk);
s = shade(); r = E.cast(W('hex'), { tech: true }, one); ok('a 1 on the tech die is a malfunction', r.tech && r.tech.malfunction);
s = shade({ stress: 2 }); r = E.cast(W('sense-layer'), {}, six);
ok('a critical success recovers 1 Stress', r.outcome.kind === 'Critical Success' && s.stats.stress === '1', r.outcome.kind);

// Subclasses
s = shade({ sub: 'Death Worker' }); let q = E.castQuote(W('pale-hand'), { echo: true });
ok('Death Worker in a death echo: one band cheaper (3 → 1), one tier easier', q.cost === 1 && q.diff === 1 && !q.noRoll);
q = E.castQuote(W('mark-passage'), { echo: true }); ok('Mark the Passage in an echo: free, no roll', q.cost === 0 && q.noRoll);
q = E.castQuote(W('sense-layer'), { echo: true }); ok('any Minor in an echo needs no roll, still costs 1', q.cost === 1 && q.noRoll);
s = shade({ sub: 'Hexblade' }); ok('Hexblade: excess successes cut the Hex', E.castQuote(W('hex'), { hexHits: 2 }).cost === 1);
ok('a clean hit Hexes for free', E.castQuote(W('hex'), { hexHits: 3 }).cost === 0);
ok('only Hex and Brand ride the hit', E.castQuote(W('shatter'), { hexHits: 3 }).cost === 5);
s = shade({ sub: 'Ward Keeper', veins: '3' }); q = E.castQuote(W('seal-threshold'), {});
ok('Ward Keeper workings never cost Wounds (collapse Wound waived)', q.wounds === 0 && q.stress === 1);
s = shade({ sub: 'Ward Keeper' }); ok('inside your Sanctuary: Minor is free, Standard one band cheaper', E.castQuote(W('alarm'), { sanctuary: true }).cost === 0 && E.castQuote(W('reinforce'), { sanctuary: true }).cost === 1);

// Who can cast
s = shade(); s.character.class = 'Runner'; ok('only Shades cast', E.cast(W('hex'), {}, six).ok === false);
s = shade(); s.magic.knownWorkings = []; ok('unknown Workings can\'t be cast', E.cast(W('hex'), {}, six).ok === false);

// Recovery and Undo
s = shade({ veins: '0' }); r = E.recoverVeins('rest', 4, six); ok('4 hours of rest: 2d6 back', r.rolls.length === 2 && E.arcaneHeart().veins === 9, r.message);
s = shade({ veins: '8' }); E.recoverVeins('break', 0, six); ok('recovery never passes max', E.arcaneHeart().veins === 9);
s = shade({ veins: '0', res: 2 }); r = E.recoverVeins('rest', 2, () => 0.5); ok('Resonance 2+: 2d6 keep the higher', r.rolls.length === 1);
s = shade(); s.playAutomation = { log: [], undo: [] }; E.act('CAST', '', () => E.cast(W('hex'), { cost: 4 }, one).message);
ok('Undo puts the Veins and Stress back', E.undoLast().ok && E.arcaneHeart().veins === 9 && s.stats.stress === '0');

for (const f of fails) console.log('  ✗ ' + f);
console.log(`${passes.length} casting checks passed.`);
if (fails.length) { console.log(`${fails.length} failed.`); process.exit(1); }
