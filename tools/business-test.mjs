// Unit tests for apps/business.js (player businesses). Run: node tools/business-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {} };
for (const f of ['week.js', 'business.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), sb);
const BZ = sb.window.GRAKK_BIZ, WK = sb.window.GRAKK_WEEK;
const B = JSON.parse(readFileSync(new URL('../data/businesses.json', import.meta.url)));
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const D = 86400000, MON = Date.UTC(2026, 10, 9);   // a Monday in Adyta
const biz = B.businesses.find(b => b.id === 'sideways-shops');
const owner = (o = {}) => { const s = { character: { name: 'Ekois' }, stats: { heat: '0' }, coins: { credits: '300' }, ...o }; WK.ensure(s); return s; };
const card = s => s.business[biz.id];
const mails = s => s.week.mail.filter(m => m.from === biz.name).map(m => m.title);

let s = owner();
ok('Ekois owns Sideways Shops', BZ.owned(s, B).some(b => b.id === biz.id));
ok('a stranger owns nothing', BZ.owned({ character: { name: 'Nobody' } }, B).length === 0);
BZ.settle(s, B, MON);
ok('a new card starts open, clean and protected', card(s).status === 'open' && card(s).books === 0 && BZ.isProtected(s, B, biz));
const sameWeek = JSON.stringify(card(s)); BZ.settle(s, B, MON + D);
ok('nothing happens mid-week', JSON.stringify(card(s)) === sameWeek);
BZ.settle(s, B, MON + 7 * D);
const E = B.rules.economy, wk1 = card(s).log.find(l => /^Week:/.test(l.text));
ok('a week brings sales and upkeep', !!wk1 && card(s).books === Number(/(\d+) in sales/.exec(wk1.text)[1]) - E.upkeep, card(s).books);

// The till and your pocket are separate.
s = owner(); BZ.settle(s, B, MON);
ok('putting money in moves it to the books', BZ.moveMoney(s, B, biz, MON, 100).ok && card(s).books === 100 && s.coins.credits === '200');
ok('taking it out moves it back', BZ.moveMoney(s, B, biz, MON, -60).ok && card(s).books === 40 && s.coins.credits === '260');
ok("you can't take more than the books hold", BZ.moveMoney(s, B, biz, MON, -100).ok === false);

// Back-room offers: saying no costs nothing, yes breaks protection.
const offerWeek = (() => { for (let k = 0; k < 40; k++) { const t = owner(); BZ.settle(t, B, MON + k * 7 * D); if (BZ.offer(t, B, biz, MON + k * 7 * D)) return MON + k * 7 * D; } return null; })();
ok('some weeks bring a back-room offer', offerWeek != null);
s = owner(); BZ.settle(s, B, offerWeek); const o = BZ.offer(s, B, biz, offerWeek);
ok('the offer stays the same all week', BZ.offer(s, B, biz, offerWeek + 2 * D).id === o.id);
let r = BZ.answerOffer(s, B, biz, offerWeek, false);
ok('saying no changes nothing', r.ok && BZ.isProtected(s, B, biz) && card(s).exposure === 0 && card(s).books === 0 && !BZ.offer(s, B, biz, offerWeek));
s = owner(); BZ.settle(s, B, offerWeek); r = BZ.answerOffer(s, B, biz, offerWeek, true);
ok('saying yes pays the till and adds Exposure', r.ok && card(s).books === o.pay && card(s).exposure === o.exposure);
ok('and the Commons stops protecting the building', !BZ.isProtected(s, B, biz) && mails(s).includes('The neighborhood noticed'));
ok("making it even needs Exposure at zero first", BZ.makeEven(s, B, biz, offerWeek).ok === false);
for (let k = 1; k <= 3; k++) BZ.settle(s, B, offerWeek + k * 7 * D);
ok('Exposure fades when nothing shady happens', card(s).exposure === 0);
r = BZ.makeEven(s, B, biz, offerWeek + 21 * D);
ok('making it even costs a favor and restores protection', r.ok && BZ.isProtected(s, B, biz) && mails(s).includes('Square with the neighborhood'));

// Protection belongs to the building, until the owner slides.
s = owner({ stats: { heat: '4' } }); BZ.settle(s, B, MON);
ok("owner's Heat at 4 breaks protection", !BZ.isProtected(s, B, biz));
ok('corporate money is never protected', !BZ.isProtected(owner(), B, { ...biz, funding: 'corporate' }));

// The loss ladder: trouble, notice, shuttered, lost. One step at a time.
s = owner(); BZ.settle(s, B, MON); card(s).books = -200;
BZ.settle(s, B, MON + 7 * D);
ok('in the red: trouble mail', card(s).step === 1 && mails(s).some(t => /^Trouble at/.test(t)));
for (let k = 2; k <= 3; k++) BZ.settle(s, B, MON + k * 7 * D);
ok('three weeks in the red: a notice', card(s).step === 2 && mails(s).some(t => /^Notice:/.test(t)), JSON.stringify({ step: card(s).step, debt: card(s).debtWeeks }));
BZ.settle(s, B, MON + 4 * 7 * D);
ok('a notice left alone: shuttered', card(s).status === 'shuttered');
ok('the till is frozen while shuttered', BZ.moveMoney(s, B, biz, MON + 29 * D, -10).ok === false);
ok("you can't reopen in the red", BZ.reopen(s, B, biz, MON + 29 * D).ok === false);
for (let k = 5; k <= 9; k++) BZ.settle(s, B, MON + k * 7 * D);
ok('four weeks shuttered: lost', card(s).status === 'lost' && mails(s).some(t => /is gone$/.test(t)));
// ... or rescued: clear the books and reopen.
s = owner({ coins: { credits: '1000' } }); BZ.settle(s, B, MON); card(s).books = -200;
for (let k = 1; k <= 4; k++) BZ.settle(s, B, MON + k * 7 * D);
BZ.moveMoney(s, B, biz, MON + 29 * D, -card(s).books);
ok('clearing the books lets the doors reopen', card(s).status === 'open' || BZ.reopen(s, B, biz, MON + 29 * D).ok && card(s).status === 'open');
// A long break brings one warning, not a lost shop.
s = owner(); BZ.settle(s, B, MON); card(s).books = -500;
BZ.settle(s, B, MON + 20 * 7 * D);
ok('coming back after months away climbs one step', card(s).step === 1 && card(s).status === 'open', JSON.stringify({ step: card(s).step, status: card(s).status }));
// Closed for the season: nothing moves.
s = owner(); BZ.settle(s, B, MON); card(s).books = -500; BZ.setSeason(s, B, biz, MON, true);
for (let k = 1; k <= 8; k++) BZ.settle(s, B, MON + k * 7 * D);
ok('closed for the season pauses upkeep and trouble', card(s).books === -500 && card(s).step === 0);
ok('and it opens again', BZ.setSeason(s, B, biz, MON + 60 * D, false).ok && card(s).status === 'open');

console.log(fails ? `${fails} failed, ${passes} passed` : `business: all ${passes} checks pass.`);
process.exit(fails ? 1 : 0);
