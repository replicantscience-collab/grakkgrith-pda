// Unit tests for apps/week.js: bills on the Adyta clock, Debt, Heat mail. Run: node tools/week-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// apps/week.js is a plain browser script; run it the way the page does and read window.GRAKK_WEEK.
const sandbox = { window: {} }; vm.runInNewContext(readFileSync(new URL('../apps/week.js', import.meta.url), 'utf8'), sandbox);
const WK = sandbox.window.GRAKK_WEEK;
const W = JSON.parse(readFileSync(new URL('../data/week.json', import.meta.url)));
const clock = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url))).clock;
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { if (cond) passes++; else { fails++; console.log('✗ ' + name + (extra ? ' — ' + extra : '')); } };
const H = 3600000, D = 24 * H;
const base = Date.parse(clock.anchorReal);
const char = (o = {}) => ({ character: { name: 'Test', class: 'Runner', level: '1', life: 'Low Halo Regular', grith: 'The Tangle' }, stats: { heat: '0', stress: '0', savvy: '3' }, skills: { persuade: '1', deceive: '1' }, coins: { credits: '500' }, cityRelations: { tangle: { relationship: 'Grith', standing: '4' } }, ...o });
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };   // fixed dice
const six = seq(0.99), one = seq(0);

// Anchor: Thursday 10/29 22:38 Adyta. Week rolls Monday 00:00.
let s = char();
let ev = WK.settle(s, W, clock, base, one);
ok('first open bills the current week', ev.filter(e => e.kind === 'bill').length === 1);
const bill = s.week.mail.find(m => m.kind === 'bill');
ok('commons bill is 40 + 20 + 10 = 70', bill.total === 70, bill.total);
ok('settling again in the same week adds nothing', WK.settle(s, W, clock, base + H, one).length === 0);
ok('paying a bill takes credits', WK.pay(s, bill.id, 0).ok && s.coins.credits === '430');

// Next Monday: new bill; let it lapse two days -> Debt and -1 Standing at home
const toMon = WK.weekStart(WK.weekIndex(WK.adytaNow(clock, base)) + 1) - WK.adytaNow(clock, base);
WK.settle(s, W, clock, base + toMon + H, one);
ok('a new week sends a new bill', s.week.mail.filter(m => m.kind === 'bill').length === 2);
WK.settle(s, W, clock, base + toMon + 2 * D + H, one);
ok('an unpaid bill becomes Debt', WK.owed(s) === 70, WK.owed(s));
ok('Debt costs 1 Standing at home', s.cityRelations.tangle.standing === '3');
ok('session start applies 1 Stress for Debt', WK.sessionStart(s, 0).stress === 1 && s.stats.stress === '1');
ok('paying Debt clears it', WK.payDebt(s, s.week.debts[0].id, 0).ok && WK.owed(s) === 0);
ok('no Debt, no session Stress', WK.sessionStart(s, 0).stress === 0);

// Heat mail
s = char(); WK.settle(s, W, clock, base, one);
s.stats.heat = '2'; ev = WK.settle(s, W, clock, base + H, one);
const n = ev.find(e => e.kind === 'notice');
ok('rising to Heat 2 sends a scrutiny notice', n && n.band === 'scrutiny');
ok('it does not send a second one at the same Heat', WK.settle(s, W, clock, base + 2 * H, one).filter(e => e.kind === 'notice').length === 0);
s.stats.heat = '6'; ev = WK.settle(s, W, clock, base + 3 * H, one);
ok('Heat 6 sends a crisis', ev.some(e => e.kind === 'crisis'));
ok('a crisis has no deadline to ignore', ev.find(e => e.kind === 'crisis').due === null);

// Ignoring a fined notice escalates twice, then becomes Debt
s = char(); WK.settle(s, W, clock, base, one); WK.pay(s, s.week.mail[0].id, 0); s.stats.heat = '2'; s.week.band = 'scrutiny';
let m = WK.issueNotice(W, s, 'scrutiny', WK.adytaNow(clock, base), 'test'); Object.assign(m, { check: null, fine: 60 });
WK.settle(s, W, clock, base + 4 * D, one);
const second = s.week.mail.find(x => /^Second Notice/.test(x.title));
ok('ignored notice comes back as a Second Notice', !!second);
ok('Second Notice costs Heat +1', s.stats.heat === '3', s.stats.heat);
ok('Second Notice fine x1.5', second && second.fine === 90, second && second.fine);
WK.settle(s, W, clock, base + 7 * D, one);
ok('then a Final Notice', s.week.mail.some(x => /^Final Notice/.test(x.title)));
WK.settle(s, W, clock, base + 10 * D, one);
ok('an ignored Final Notice becomes Debt', s.week.debts.some(d => d.creditor === m.from && d.amount >= 135), JSON.stringify(s.week.debts));
// A check notice: answer it
s = char(); WK.ensure(s); m = WK.issueNotice(W, s, 'scrutiny', 0, 'test'); m.check = { label: 'x', attribute: 'savvy', skill: 'deceive', difficulty: 2, success: 'ok', fail: 'no', failHeat: 1 };
ok('a check notice rolls Savvy + Deceive', WK.answer(s, m.id, 0, six).dice.length === 4);
s = char(); WK.ensure(s); m = WK.issueNotice(W, s, 'scrutiny', 0, 'test'); m.check = { label: 'x', attribute: 'savvy', skill: 'deceive', difficulty: 2, success: 'ok', fail: 'no', failHeat: 1 };
ok('a failed check costs its Heat', WK.answer(s, m.id, 0, one).won === false && s.stats.heat === '1');

// Appeals: one try, Wardens get a die
s = char({ character: { name: 'Advocate', class: 'Warden', level: '1', life: 'Low Halo Regular' } });
WK.ensure(s); const ap = WK.issueNotice(W, s, 'scrutiny', 0, 'test');
const appealable = s.week.mail.find(x => x.appeal);
if (appealable) {
  const r = WK.appeal(s, W, appealable.id, 0, six);
  ok('Warden appeal rolls Savvy + Persuade + 1', r.dice.length === 5, r.dice.length);
  ok('a won appeal voids the notice', appealable.status === 'voided');
  ok('no second appeal', WK.appeal(s, W, appealable.id, 0, six).ok === false);
}
ok('cannot pay without credits', (() => { const t = char({ coins: { credits: '5' } }); WK.settle(t, W, clock, base, one); return WK.pay(t, t.week.mail[0].id, 0).ok === false; })());

// Long absence bills at most 4 weeks
s = char(); WK.settle(s, W, clock, base, one); WK.pay(s, s.week.mail[0].id, 0);
WK.settle(s, W, clock, base + 70 * D, one);
ok('a long absence bills at most 4 weeks', s.week.mail.filter(m => m.kind === 'bill').length === 5, s.week.mail.filter(m => m.kind === 'bill').length);
ok('Heat never passes the level cap', (() => { const t = char(); t.stats.heat = '6'; WK.ensure(t); t.week.band = 'crisis'; const x = t.week; const nn = WK.issueNotice(W, t, 'scrutiny', 0, ''); nn.due = 0; WK.settle(t, W, clock, base, one); return Number(t.stats.heat) <= 6; })());

// Old saves on the retired Hive tier: they move into The Hive, and Ma Dresk still gives a week's grace, then calls in a favor
{
  let h = char(); WK.ensure(h); WK.setCosts(h, { housing: 'hive' }); h.coins = { credits: '0' };
  WK.settle(h, W, clock, base, one);
  const b = h.week.mail.find(m => m.kind === 'bill');
  ok('a Hive bill names Ma Dresk', b.creditor === 'Ma Dresk' && b.landlord && b.landlord.graceDays === 7);
  WK.settle(h, W, clock, base + 2 * D + H, one);
  ok('late Hive rent gets a grace week, not Debt', b.status === 'open' && b.graced && h.week.debts.length === 0 && h.week.mail.some(m => m.title === 'A week\'s grace'), JSON.stringify(h.week.debts));
  WK.settle(h, W, clock, base + 9 * D + 2 * H, one);
  ok('after the grace week Ma Dresk calls in a favor', b.status === 'open' && b.favor && WK.favors(h).length === 1 && h.week.debts.length === 0);
  const r = WK.favorDone(h, b.id, base, 'Fix her walk-in');
  ok('a favor settles the bill with no credits', r.ok && b.status === 'paid' && b.paidBy === 'favor' && h.coins.credits === '0' && WK.favors(h).length === 0);
  let h2 = char(); WK.ensure(h2); WK.setCosts(h2, { housing: 'hive' }); h2.coins = { credits: '0' };
  WK.settle(h2, W, clock, base, one); const b2 = h2.week.mail.find(m => m.kind === 'bill');
  WK.settle(h2, W, clock, base + 2 * D + H, one); WK.settle(h2, W, clock, base + 9 * D + 2 * H, one); WK.settle(h2, W, clock, base + 16 * D + 3 * H, one);
  ok('an ignored favor becomes Debt to Ma Dresk', b2.status === 'unpaid' && h2.week.debts.some(d => d.creditor === 'Ma Dresk'), JSON.stringify(h2.week.debts));
  let h3 = char(); WK.ensure(h3); WK.setCosts(h3, { housing: 'hive' }); h3.coins = { credits: '500' };
  WK.settle(h3, W, clock, base, one); const b3 = h3.week.mail.find(m => m.kind === 'bill'); WK.settle(h3, W, clock, base + 2 * D + H, one);
  ok('rent can still be paid in cash during the grace week', WK.pay(h3, b3.id, base).ok && b3.status === 'paid');
  let c = char(); c.coins = { credits: '0' }; WK.settle(c, W, clock, base, one); WK.settle(c, W, clock, base + 2 * D + H, one);
  ok('plain Commons rent still goes straight to Debt', c.week.debts.length === 1 && !c.week.mail.find(m => m.kind === 'bill').graced);
}

// Renting a home: bills go to the landlord, missed rent climbs their ladder one step at a time.
const LL = JSON.parse(readFileSync(new URL('../data/landlords.json', import.meta.url)));
const homeFor = id => { const l = LL.landlords.find(x => x.id === id), L = {}; for (const k of ['missed', 'review', 'bastion', 'lost']) { const o = (l.letters || {})[k] || (LL.letters[l.type] || {})[k]; if (o) L[k] = o; }
  return { place: l.places[0], placeName: 'Test Place', landlordId: l.id, landlordName: l.name, type: l.type, tier: l.tier, ladder: LL.types[l.type].ladder, letters: L, floor: LL.floor }; };
s = char({ coins: { credits: '0' } });
WK.settle(s, W, clock, base, one);
ok('moving in sets the rent tier and the landlord', WK.moveIn(s, W, homeFor('halvard-mercy-holdings'), base).ok && s.week.housing === 'commons' && s.week.home.landlordName === 'Halvard Mercy Holdings');
ok('moving into the same place twice is refused', WK.moveIn(s, W, homeFor('halvard-mercy-holdings'), base).ok === false);
const mon = k => WK.weekStart(WK.weekIndex(WK.adytaNow(clock, base)) + k) - WK.clockOffset(clock);   // real ms of the Monday k weeks on
WK.settle(s, W, clock, mon(1) + H, one);
ok("next week's bill goes to the landlord", s.week.mail.find(m => m.kind === 'bill' && m.status === 'open').creditor === 'Halvard Mercy Holdings');
const letters = () => s.week.mail.filter(m => m.from === 'Halvard Mercy Holdings' || /^Bastion Dynamics, for/.test(m.from));
WK.settle(s, W, clock, mon(1) + 3 * D, one);
ok('unpaid rent: first letter is "missed"', letters().length >= 1 && /Payment not received/.test(letters()[0].title), letters().map(m => m.title).join('|'));
WK.settle(s, W, clock, mon(2) + 3 * D, one);
ok('second unpaid week: "review"', /under review/.test(letters()[0].title));
WK.settle(s, W, clock, mon(3) + 3 * D, one);
ok('third unpaid week: Bastion, as a scene hook for the session', letters()[0].kind === 'crisis' && /Bastion/.test(letters()[0].from) && /Eviction Interference/.test(letters()[0].body));
WK.settle(s, W, clock, mon(4) + 3 * D, one);
ok('fourth unpaid week: the unit is lost and the floor catches you', s.week.home === null && s.week.housing === 'authority' && s.week.mail.some(m => m.from === 'Adyta Housing Authority') && s.week.lastHome.placeName === 'Test Place');
ok('debts come along', WK.owed(s) > 0);
// Coming back after weeks away brings one letter, not an eviction.
s = char({ coins: { credits: '0' } }); WK.settle(s, W, clock, base, one); WK.moveIn(s, W, homeFor('brightlane-residential'), base);
WK.settle(s, W, clock, mon(5) + 3 * D, one);
ok('a long absence climbs one step, not four', s.week.home && s.week.home.behind === 1 && s.week.mail.filter(m => m.from === 'Brightlane Residential').length === 1, JSON.stringify(s.week.home && s.week.home.behind));
// Family-run landlords stop at "review".
s = char({ coins: { credits: '0' } }); WK.settle(s, W, clock, base, one); WK.moveIn(s, W, homeFor('ma-dresk'), base);
for (let k = 1; k <= 6; k++) WK.settle(s, W, clock, mon(k) + 3 * D, one);
ok('Ma Dresk never calls Bastion', s.week.home && !s.week.mail.some(m => /Bastion/.test(m.from)) && s.week.mail.some(m => m.title === 'Come and see me'));
// Paying off the landlord resets the ladder.
const debt = s.week.debts.find(d => d.creditor === 'Ma Dresk'); s.coins.credits = String(debt.amount);
WK.payDebt(s, debt.id, mon(7));
ok('paying the landlord back resets the ladder', s.week.home.behind === 0);
// Choosing a different tier by hand means moving out.
WK.setCosts(s, { housing: 'mixed' }, mon(7));
ok('picking another housing tier moves you out', s.week.home === null && s.week.housing === 'mixed');

// Landlord terms, units and listings (apps/homes.js + data/landlords.json + data/rentals.json)
{
  const box2 = { window: {} }; vm.runInNewContext(readFileSync(new URL('../apps/homes.js', import.meta.url), 'utf8'), box2);
  const HM = box2.window.GRAKK_HOMES, LLd = JSON.parse(readFileSync(new URL('../data/landlords.json', import.meta.url))), RT = JSON.parse(readFileSync(new URL('../data/rentals.json', import.meta.url)));
  const PL = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url))).places, place = id => PL.find(p => p.id === id);
  const rent = (s, id, unit, t = base) => WK.moveIn(s, W, HM.homeFor(LLd, RT, place(id), HM.landlordOf(LLd, id), unit), t);
  const payAll = (s, t) => { for (const m of s.week.mail) if (m.kind === 'bill' && m.status === 'open') WK.pay(s, m.id, t); };
  const weekOf = s => s.week.mail.filter(m => m.kind === 'bill').sort((a, b) => b.week - a.week)[0];
  // The Hive's top-floor room bills at its own price, to Ma Dresk, with her grace and favor
  let t = char(); WK.settle(t, W, clock, base, one);
  ok('renting a unit sets its rent', rent(t, 'low-halo--the-hive', 'upper').ok && t.week.home.rent === 35 && t.week.home.unitName === 'Upper-floor room');
  WK.settle(t, W, clock, mon(1) + H, one); const hb = weekOf(t);
  ok('the bill carries the unit, its price and Ma Dresk', hb.lines[0].credits === 35 && /Upper-floor room, The Hive/.test(hb.lines[0].name) && hb.creditor === 'Ma Dresk' && hb.landlord.graceDays === 7 && hb.landlord.favorDays === 7, JSON.stringify(hb.lines));
  ok('moving to another unit in the same building is allowed', rent(t, 'low-halo--the-hive', 'over-fryer').ok && t.week.home.rent === 45 && rent(t, 'low-halo--the-hive', 'over-fryer').ok === false);
  // A landlord with no grace: Brightlane's late rent goes straight to Debt
  let b = char({ coins: { credits: '0' } }); WK.settle(b, W, clock, base, one); rent(b, 'market-ring--homes-above-shops', 'studio');
  WK.settle(b, W, clock, mon(1) + H, one); WK.settle(b, W, clock, mon(1) + 3 * D, one);
  ok('no grace from Brightlane: late rent is Debt', b.week.debts.some(d => d.creditor === 'Brightlane Residential') && !weekOf(b).graced);
  // Two weeks of grace from the Oduya-Venns, then a favor
  let o = char({ coins: { credits: '0' } }); WK.settle(o, W, clock, base, one); rent(o, 'market-ring--north-market-neighborhood', 'stall-room');
  WK.settle(o, W, clock, mon(1) + H, one); const ob = weekOf(o); WK.settle(o, W, clock, mon(1) + 3 * D, one);
  ok('the Oduya-Venns give two weeks', ob.graced && ob.due - ob.graced === 14 * D && !o.week.debts.some(d => d.creditor === 'The Oduya-Venn family'));
  // Work-off: a standing shift takes credits off; class rules apply
  let c = char(); WK.settle(c, W, clock, base, one); rent(c, 'market-ring--south-market-neighborhood', 'workshop-flat');
  ok('a Runner can take the Tenants\' Table repair shift', WK.setShift(c, true, base).ok && c.week.home.shift);
  WK.settle(c, W, clock, mon(1) + H, one); const cb = weekOf(c);
  ok('the shift takes 20 off the rent on the bill', cb.lines[0].credits === 80 && cb.lines[1].credits === -20 && cb.total === 80 - 20 + 20 + 10, JSON.stringify(cb.lines));
  let g = char({ character: { name: 'G', class: 'Ghost', level: '1' } }); WK.settle(g, W, clock, base, one); rent(g, 'market-ring--south-market-neighborhood', 'workshop-flat');
  ok('a Ghost can\'t take a Wrench-or-Runner shift', WK.setShift(g, true, base).ok === false && !g.week.home.shift);
  let any = char({ character: { name: 'A', class: 'Ghost', level: '1' } }); WK.settle(any, W, clock, base, one); rent(any, 'the-sewers--the-dry-stacks', 'bunk');
  ok('anyone can take a pump watch at the Dry Stacks', WK.setShift(any, true, base).ok);
  ok('no shift where the landlord takes none', (() => { const x = char(); WK.settle(x, W, clock, base, one); rent(x, 'low-halo--the-hive', 'upper'); return WK.setShift(x, true, base).ok === false; })());
  // Creep: Patchlight puts the rent up 5 every 3 weeks, never past the Commons band (50)
  let pch = char({ coins: { credits: '5000' } }); WK.settle(pch, W, clock, base, one); rent(pch, 'southport-slums--candidate-patchlight-rooms', 'corner');
  for (let k = 1; k <= 12; k++) { WK.settle(pch, W, clock, mon(k) + H, one); payAll(pch, mon(k) + H); }
  ok('rent creeps up, but stops at the top of the band', pch.week.home.rent === 50 && pch.week.mail.some(m => m.title === 'Bad week downstairs'), pch.week.home.rent);
  let hr = char({ coins: { credits: '5000' } }); WK.settle(hr, W, clock, base, one); rent(hr, 'dockside--waterfront-homes-crew-lodging', 'water-room');
  for (let k = 1; k <= 4; k++) { WK.settle(hr, W, clock, mon(k) + H, one); payAll(hr, mon(k) + H); }
  ok('Harbor Row: +5 after four weeks', hr.week.home.rent === 80, hr.week.home.rent);
  ok('a long absence creeps at most once per billed week', (() => { const x = char({ coins: { credits: '5000' } }); WK.settle(x, W, clock, base, one); rent(x, 'dockside--waterfront-homes-crew-lodging', 'water-room'); WK.settle(x, W, clock, mon(12) + H, one); return x.week.home.rent <= 80; })());
  // Crew units bill at the employer's tier
  const crew = HM.homeFor(LLd, RT, place('dockside--waterfront-homes-crew-lodging'), HM.landlordOf(LLd, 'dockside--waterfront-homes-crew-lodging'), 'crew-bunk');
  ok('a Meridian crew bunk is Commons tier at 40', crew.tier === 'commons' && crew.rent === 40);
  // Places nobody rents
  ok('the Housing Authority, estates and keepers can\'t be rented', ['governance-district--waitlist-house', 'noble-heights--moonspire-house', 'three-spires-monastery--candidate-keeper-rooms', 'noble-heights--old-families-row'].every(id => !HM.rentable(HM.landlordOf(LLd, id))));
  ok('describe() says who gives grace and who doesn\'t', /grace, then a favor/.test(HM.describe(HM.landlordOf(LLd, 'low-halo--the-hive')).join(' ')) && /No grace/.test(HM.describe(HM.landlordOf(LLd, 'market-ring--homes-above-shops')).join(' ')));
  // Old saves on the Hive tier
  let old = char(); old.week = { v: 1, housing: 'hive', gear: 'light', chrome: 'none', lastWeek: null, band: 'clean', mail: [], debts: [], log: [], sessionsStarted: 0 };
  WK.ensure(old);
  ok('an old Hive save moves into The Hive at Commons', old.week.housing === 'commons' && old.week.home.place === 'low-halo--the-hive' && old.week.home.rent === 40 && old.week.home.rules.graceDays === 7);
}

console.log(fails ? `${passes} passed, ${fails} failed.` : `${passes} week checks passed.`);
process.exit(fails ? 1 : 0);
