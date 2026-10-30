// Unit tests for apps/make.js: the Make -> Use -> Sell -> Consequence loop. Run: node tools/make-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sandbox = { window: {} };
for (const f of ['week.js', 'make.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), sandbox);
const WK = sandbox.window.GRAKK_WEEK, MK = sandbox.window.GRAKK_MAKE;
const json = p => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const W = json('week.json'), M = json('make.json');
let fails = 0, passes = 0;
const ok = (name, cond, extra = '') => { if (cond) passes++; else { fails++; console.log('✗ ' + name + (extra ? ' — ' + extra : '')); } };
const D = 86400000, T0 = Date.UTC(2026, 9, 29, 22, 38);
const six = () => 0.99, one = () => 0, always = () => 0, never = () => 0.999;
const char = (cls, o = {}) => ({ character: { name: 'Maker', class: cls, subclass: o.subclass || '', level: '1' }, stats: { heat: '0', stress: '0', spark: '3', wit: '3', savvy: '3', muscle: '2' }, skills: { ward: '1', medic: '1', repair: '1', deceive: '1', negotiate: '1', persuade: '1', navigate: '1', intimidate: '1', perform: '1', network: '1' }, coins: { credits: '200' }, downtime: { actionsRemaining: 2 } });

// Every Make produces one full record
let s = char('Shade');
let r = MK.make(s, M, 'doorway-ward', { district: 'the-tangle', districtName: 'The Tangle', permission: 'own' }, T0, six);
const a = r.artifact;
ok('a Make produces a record', r.ok && !!a);
for (const k of ['id', 'creator', 'class', 'costs', 'owner', 'location', 'visibility', 'expires', 'status', 'permissions', 'events']) ok(`record has ${k}`, a[k] !== undefined, k);
ok('it costs a downtime action, materials and Stress', s.downtime.actionsRemaining === 1 && s.coins.credits === '190' && s.stats.stress === '1');
ok('a Shade cannot make Wrench work', MK.preview(s, M, 'medkit', {}).ok === false);
ok('no downtime left, no Make', (() => { s.downtime.actionsRemaining = 0; return MK.preview(s, M, 'alarm-sigils', {}).blockers.some(b => /downtime/.test(b)); })());

// Heat follows circumstances, not class
s = char('Shade'); r = MK.make(s, M, 'doorway-ward', { district: 'the-tangle', permission: 'own' }, T0, six);
MK.settle(s, M, W, T0 + 30 * D, always);
ok('an authorized ward is never "found"', s.stats.heat === '0' && r.artifact.status !== 'removed');
s = char('Shade'); r = MK.make(s, M, 'doorway-ward', { district: 'new-halo', permission: 'none', visibility: 'public' }, T0, six);
MK.settle(s, M, W, T0 + 1, always); ok('the first week of an unauthorized ward is free', r.artifact.status === 'active');
MK.settle(s, M, W, T0 + 6 * D + 1, always);
ok('an unauthorized ward gets found: removed, Heat +1', r.artifact.status === 'removed' && s.stats.heat === '1', `${r.artifact.status} heat ${s.stats.heat}`);
ok('...and a notice arrives from whoever watches the place', s.week && s.week.mail.some(m => m.kind === 'info' && /Crownline/.test(m.from)));
s = char('Shade'); r = MK.make(s, M, 'doorway-ward', { district: 'the-tangle', permission: 'none', visibility: 'hidden' }, T0, six);
MK.settle(s, M, W, T0 + 1, never); MK.settle(s, M, W, T0 + 6 * D, never);
ok('a hidden one can go unnoticed', r.artifact.status === 'active' && s.stats.heat === '0');
ok('discovery is likelier in watched districts', MK.discoveryChance(M, 'discreet', 'new-halo') > MK.discoveryChance(M, 'discreet', 'the-tangle'));

// Expiry and maintenance
s = char('Shade', { subclass: 'Ward Keeper' }); r = MK.make(s, M, 'doorway-ward', { district: 'the-tangle', permission: 'own' }, T0, six);
s.downtime.actionsRemaining = 1; const before = r.artifact.expires;
MK.maintain(s, M, r.artifact.id, T0 + D);
ok('Ward Keepers maintain without Stress', s.stats.stress === '1' && r.artifact.expires === before + 7 * D, s.stats.stress);
MK.settle(s, M, W, before + 7 * D + 1, never);
ok('it expires on the Adyta clock and sends mail', r.artifact.status === 'expired' && s.week.mail.some(m => /run out/.test(m.title)));

// Use, sell, fence, restricted
s = char('Wrench'); r = MK.make(s, M, 'medkit', {}, T0, six);
ok('a medkit is worth the book price', r.artifact.value === 60);
const sale = MK.sell(s, M, r.artifact.id, 'street', T0);
ok('selling lawful work on the street: full price, no Heat', sale.price === 60 && s.stats.heat === '0' && s.coins.credits === String(200 - 20 + 60));
s = char('Ghost'); r = MK.make(s, M, 'cover-papers', {}, T0, six);
ok('restricted work: street sale costs Heat', (MK.sell(s, M, r.artifact.id, 'street', T0), s.stats.heat === '1'));
s = char('Ghost'); r = MK.make(s, M, 'cover-papers', {}, T0, six);
ok('a fence pays 60% and no Heat', MK.sell(s, M, r.artifact.id, 'fence', T0).price === 90 && s.stats.heat === '0');
s = char('Ghost'); r = MK.make(s, M, 'cover-papers', {}, T0, one);
ok('botched restricted work: someone saw, Heat +1', r.artifact.status === 'failed' && s.stats.heat === '1');
s = char('Ghost'); r = MK.make(s, M, 'cover-papers', {}, T0, six);
MK.use(s, r.artifact.id, T0, 'lookup'); ok('cover papers fail an ACR lookup: Heat +1', s.stats.heat === '1' && r.artifact.status === 'used');
s = char('Shade'); r = MK.make(s, M, 'alarm-sigils', {}, T0, six); MK.use(s, r.artifact.id, T0);
ok('multi-use items track uses and sell by what is left', r.artifact.uses === 2 && MK.salePrice(s, M, r.artifact, 'street').price === 17);

// Rulings: official changes wait; nobody mints a citizenship by pressing a button
s = char('Ghost'); r = MK.make(s, M, 'registry-change', { target: 'Ekois' }, T0, six);
ok('a registry change is proposed, not done', r.artifact.status === 'pending' && !r.artifact.roll);
ok('it cannot be sold or used while pending', MK.sell(s, M, r.artifact.id, 'street', T0).ok === false && MK.use(s, r.artifact.id, T0).ok === false);
MK.rule(s, r.artifact.id, false, 'The ACR clerk is a cousin of the mark.', 'Nib', T0);
ok('a denied ruling refunds materials', r.artifact.status === 'denied' && s.coins.credits === '200');
s = char('Warden'); r = MK.make(s, M, 'formal-complaint', { target: 'Crownline' }, T0, six);
MK.rule(s, r.artifact.id, true, 'Crownline must answer at a hearing.', 'Eko', T0);
ok('an approved ruling makes it real and records who ruled', r.artifact.status === 'active' && r.artifact.ruling.by === 'Eko');

// Contracts, Broker cut, Warden filings into Mail
s = char('Runner'); r = MK.make(s, M, 'delivery-slot', { district: 'low-halo' }, T0, six);
ok('a delivery slot needs no roll and pays inside its range', MK.complete(s, M, r.artifact.id, 999, T0).ok && s.coins.credits === '320');
s = char('Broker'); const L = MK.make(s, M, 'market-listing', { target: 'Self' }, T0, six).artifact;
ok('a listing records its price bonus', L.bonus > 0);
s = char('Warden'); r = MK.make(s, M, 'apa-filing', { target: 'Crew' }, T0, six);
ok('a Warden filing adds +2 to an APA appeal once', MK.spendApaFiling(s, T0, 'Test') === 2 && MK.spendApaFiling(s, T0, 'Test') === 0);

console.log(fails ? `${passes} passed, ${fails} failed.` : `${passes} make checks passed.`);
process.exit(fails ? 1 : 0);
