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

console.log(fails ? `${passes} passed, ${fails} failed.` : `${passes} week checks passed.`);
process.exit(fails ? 1 : 0);
