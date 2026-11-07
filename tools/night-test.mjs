// A Night Out, no browser: scenes, safe vs bold, Push, effects and every floor.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// Plain browser scripts: run them the way the page does and read them off window.
const window = {}, box = { window }; for (const f of ['engine.js', 'week.js', 'downtime.js', 'homes.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), box);
const N = window.GRAKK_NIGHT, WK = window.GRAKK_WEEK;
const D = JSON.parse(readFileSync(new URL('../data/downtime.json', import.meta.url)));
const P = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url)));
const R = JSON.parse(readFileSync(new URL('../data/rules.json', import.meta.url)));
const fails = [], passes = []; const check = (n, ok, d = '') => (ok ? passes : fails).push(ok ? n : `${n}: ${d}`);
const T = Date.UTC(2026, 10, 3, 21, 0);  // a Tuesday evening, Adyta time
const dice = seq => { let i = 0; return () => (seq[i++ % seq.length] - 1) / 6 + 0.01; };  // rng that rolls the given faces
const mk = (over = {}) => ({ character: { name: 'Eko', class: 'Runner', level: '2' }, stats: { muscle: '1', reflex: '5', wit: '3', savvy: '3', spark: '2', root: '3', woundState: '1', stress: '3', heat: '3', condition1: '', condition2: '' }, skills: { network: '1', dash: '1', intel: '1', medic: '0', layLow: '1' }, coins: { credits: '120' }, cityRelations: { low_halo: { relationship: 'Grith', standing: '3' } }, ...over });
let s = mk(); const E = window.GRAKK_ENGINE.create(() => s);

check('your grith is listed first', N.districts(s, P)[0].id === 'low-halo' && N.districts(s, P)[0].grith);
check('starting a night in your grith marks it home', N.startNight(s, P, 'low-halo', T).ok && s.downtime.night.inGrith);
check('the night is named from the Adyta clock', N.nightName(D, T) === 'Tuesday night');

let sc = N.scene(s, D, P, E, 'workContact', dice([1]));
check('scene text is filled from the district, no {placeholders}', !/\{\w+\}/.test(sc.text) && sc.text.length > 20, sc.text);
check('safe Work a Contact rolls Savvy + Network at Challenging', sc.safe.check.attr === 'savvy' && sc.safe.check.skill === 'network' && sc.safe.check.diff === 2 && sc.safe.check.pool.total === 4, JSON.stringify(sc.safe.check));
check('bold asks for Hard', sc.bold.check.diff === 3);

let r = N.roll(s, D, P, E, sc, 'bold', dice([6, 6, 5, 1]));
check('roll saves the dice before you decide', r.ok && s.downtime.night.pending.dice.join() === '6,6,5,1' && r.pending.tier === 'win');
check('cannot roll again while a roll is waiting', !N.roll(s, D, P, E, sc, 'safe', dice([6])).ok);
let a = N.accept(s, D, P, E, WK, T);
check('bold win: Standing +1 and a true lead in Mail', a.ok && s.cityRelations.low_halo.standing === '4' && s.downtime.leads.length === 1 && s.week.mail.some(m => /^Lead/.test(m.from)), JSON.stringify(a.entry && a.entry.effects));
check('the lead is a line from the district dossier', P.districts['low-halo'].dossier.wisdom === s.downtime.leads[0].text);
check('an action is spent', s.downtime.actionsRemaining === 1);

sc = N.scene(s, D, P, E, 'research', dice([1]));
N.roll(s, D, P, E, sc, 'bold', dice([1, 2, 3, 4]));
let pv = N.pending(s, E);
check('a bad roll can be pushed', pv.tier === 'lose' && pv.canPush);
let pu = N.push(s, E, dice([6, 6]));
check('Push: +1 Stress, +2 dice, once', pu.ok && s.stats.stress === '4' && pu.pending.dice.length === 6 && !pu.pending.canPush && !N.push(s, E).ok);
check('the pushed roll is re-judged (2 vs Hard 3 = partial)', pu.pending.tier === 'partial', pu.pending.tier);
a = N.accept(s, D, P, E, WK, T);
check('bold research partial: one lead and Heat +1', a.entry.effects.some(x => /Heat 3 → 4/.test(x)) && s.downtime.leads.length === 2, a.entry.effects.join(' '));
check('two actions spent: the gap is over', s.downtime.actionsRemaining === 0 && !N.startNight(s, P, 'low-halo', T).ok);
const rc = N.recap(s, D, P);
check('recap reads as a night, ready for Discord', /^\*\*Tuesday night in Low Halo \(home\)\*\* · Eko/.test(rc.discord) && rc.lines.length === 2 && /went bold/.test(rc.discord), rc && rc.discord);

// Floors and safe rulebook effects
s = mk(); N.startNight(s, P, 'low-halo', T);
N.roll(s, D, P, E, N.scene(s, D, P, E, 'layLow'), 'safe'); N.accept(s, D, P, E, WK, T);
check('safe Lay Low in your grith: Heat -2, no roll', s.stats.heat === '1');
N.roll(s, D, P, E, N.scene(s, D, P, E, 'community'), 'safe'); N.accept(s, D, P, E, WK, T);
check('safe Community in your grith: Stress -3', s.stats.stress === '0');

s = mk(); N.newGap(s, T); N.startNight(s, P, 'crownline-industrials', T);
N.roll(s, D, P, E, N.scene(s, D, P, E, 'layLow'), 'safe'); N.accept(s, D, P, E, WK, T);
check('Lay Low away from home: Heat -1', s.stats.heat === '2');
N.roll(s, D, P, E, N.scene(s, D, P, E, 'recover'), 'bold', dice([1, 1, 1])); N.accept(s, D, P, E, WK, T);
check('bold Recover loss still heals one step', s.stats.woundState === '0');
check('a bill you cannot cover becomes Debt, not a refusal', s.coins.credits === '120' && s.week.debts.some(d => d.amount === 150), JSON.stringify(s.week.debts));

s = mk({ stats: { reflex: '5', savvy: '3', wit: '3', root: '3', woundState: '0', stress: '6', heat: '0' } }); N.startNight(s, P, 'low-halo', T);
sc = N.scene(s, D, P, E, 'research');
check('at full Stress, bold is locked', !!sc.bold.locked && !N.roll(s, D, P, E, sc, 'bold').ok);
N.roll(s, D, P, E, sc, 'safe', dice([1, 2, 3, 4]));
check('at full Stress, no Push', !N.pending(s, E).canPush && !N.push(s, E).ok);

s = mk(); N.startNight(s, P, 'low-halo', T);
sc = N.scene(s, D, P, E, 'sideJob');
check('Runner side job: Reflex + Dash, written for Runners', sc.safe.check.attr === 'reflex' && sc.safe.check.skill === 'dash' && /package/.test(sc.text), sc.text);
N.roll(s, D, P, E, sc, 'bold', dice([6, 6, 6, 6, 6, 6])); a = N.accept(s, D, P, E, WK, T);
check('bold side job win (5 dice, Hurt -1) pays 700 + 100 per success over Hard, and Heat +1', s.coins.credits === String(120 + 700 + 100 * 2) && s.stats.heat === '4', s.coins.credits + ' / ' + s.stats.heat);
check('every class has a side job', R.classes && Object.keys(R.classes).every(c => D.classJobs[c]));

s = mk({ stats: { woundState: '0', stress: '0', heat: '0', condition1: '', condition2: '' } }); N.startNight(s, P, 'low-halo', T);
N.roll(s, D, P, E, N.scene(s, D, P, E, 'recover'), 'safe'); a = N.accept(s, D, P, E, WK, T);
check('nothing to heal says so; downtime never adds Wounds', s.stats.woundState === '0' && /Nothing left to heal/.test(a.entry.effects.join(' ')));

s = mk(); s.downtime = { marks: 3, actionsRemaining: 2 };
const opts = N.trainOptions(s, R), melee = opts.find(o => o.key === 'network');
check('Train lists next ranks with level gates', melee && melee.to === 'Trained' && melee.open && opts.find(o => o.key === 'brawl').to === 'Novice');
check('Train raises the rank and spends Marks and an action', N.train(s, 'network', 2, 'Network', T).ok && s.skills.network === '2' && s.downtime.marks === 1 && s.downtime.actionsRemaining === 1);
check('Train refuses past your level', !N.train(s, 'network', 1, 'Network', T).ok);
check('Put Down Roots is recorded and flagged for the GM in Mail', N.record(s, D, 'putDownRoots', 'Rented the room over the noodle bar', T, WK).ok && s.week.mail.some(m => /GM to confirm/.test(m.title)));

// New gaps open once per session
s = mk(); s.downtime = { actionsRemaining: 0 };
check('an older character gets one gap without a session', N.canNewGap(s) && N.newGap(s, T).ok && s.downtime.actionsRemaining === 2);
s.downtime.actionsRemaining = 0;
check('a second gap waits for "Session starting"', !N.canNewGap(s) && !N.newGap(s, T).ok && s.downtime.actionsRemaining === 0);
WK.sessionStart(s, T);
check('after a session starts, one new gap opens', N.newGap(s, T).ok && s.downtime.actionsRemaining === 2);
s.downtime.actionsRemaining = 0;
check('only one per session', !N.newGap(s, T).ok);

// Ma Dresk's favor: shows up when The Hive's rent is past its grace week, settles it with work
{
  const W = JSON.parse(readFileSync(new URL('../data/week.json', import.meta.url))), H = 3600000, DAY = 24 * H, base = Date.parse(P.clock.anchorReal);
  s = mk(); WK.ensure(s); WK.setCosts(s, { housing: 'hive' }); s.coins = { credits: '0' };
  WK.settle(s, W, P.clock, base, () => 0); WK.settle(s, W, P.clock, base + 2 * DAY + H, () => 0);
  N.startNight(s, P, 'crownline-industrials', T);
  check('no favor card during the grace week', !N.owedFavor(s, D) && !N.scene(s, D, P, E, 'favor'));
  WK.settle(s, W, P.clock, base + 9 * DAY + 2 * H, () => 0);
  sc = N.scene(s, D, P, E, 'favor', dice([1]));
  check('after grace, a favor scene with three ways to do it', sc && sc.choices.join() === 'walkin,parcel,collector' && sc.walkin.check.skill === 'repair' && sc.parcel.check.skill === 'dash' && sc.collector.check.skill === 'intimidate', sc && sc.choices);
  check('the favor scene names Ma Dresk and The Hive', /Ma Dresk/.test(sc.text) && /Hive/.test(sc.text), sc.text);
  N.roll(s, D, P, E, sc, 'parcel', dice([6, 6, 6, 6, 6]));
  a = N.accept(s, D, P, E, WK, T);
  const bill = s.week.mail.find(m => m.kind === 'bill' && m.favor);
  check('doing the favor settles the rent with no credits', bill.status === 'paid' && bill.paidBy === 'favor' && s.coins.credits === '0' && !N.owedFavor(s, D), JSON.stringify(a.entry.effects));
  check('a pleased Ma Dresk raises Standing in Low Halo, not where you spent the night', s.cityRelations.low_halo.standing === '4' && !(s.cityRelations.crownline_industrials && s.cityRelations.crownline_industrials.standing === '4'));
  check('the recap says which favor', /run a parcel/.test(N.recap(s, D, P).discord), N.recap(s, D, P).discord);
}

// Any landlord with a favor works the same way: Granny Rattle at the Coil Lane walk-ups
{
  const W = JSON.parse(readFileSync(new URL('../data/week.json', import.meta.url))), LLd = JSON.parse(readFileSync(new URL('../data/landlords.json', import.meta.url))), RT = JSON.parse(readFileSync(new URL('../data/rentals.json', import.meta.url)));
  const HM = window.GRAKK_HOMES, H = 3600000, DAY = 24 * H, base = Date.parse(P.clock.anchorReal), id = 'greasewick-row--coil-lane-walk-ups';
  s = mk(); s.coins = { credits: '0' }; WK.settle(s, W, P.clock, base, () => 0);
  WK.moveIn(s, W, HM.homeFor(LLd, RT, P.places.find(p => p.id === id), HM.landlordOf(LLd, id), 'walk-up'), WK.adytaNow(P.clock, base));
  const mon = WK.weekStart(WK.weekIndex(WK.adytaNow(P.clock, base)) + 1) - WK.clockOffset(P.clock);
  WK.settle(s, W, P.clock, mon + H, () => 0); WK.settle(s, W, P.clock, mon + 3 * DAY, () => 0); WK.settle(s, W, P.clock, mon + 10 * DAY, () => 0);
  N.startNight(s, P, 'greasewick-row', T);
  sc = N.scene(s, D, P, E, 'favor', dice([1]));
  check('Granny Rattle calls in a favor after her grace week', sc && sc.choices.join() === 'engine,customer,part' && /Granny Rattle/.test(sc.text), sc && sc.text);
}

for (const f of fails) console.log('  ✗ ' + f);
console.log(`${passes.length} night checks passed.`);
if (fails.length) { console.log(`${fails.length} failed.`); process.exit(1); }
