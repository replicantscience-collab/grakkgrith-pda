// Unit tests for apps/gigs.js (Pocket Change). Run: node tools/gigs-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {} };
for (const f of ['week.js', 'make.js', 'gigs.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), sb);
const GG = sb.window.GRAKK_GIGS;
const json = p => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const G = json('gigs.json'), R = json('rules.json'), PL = json('places.json');
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const H = 3600000, T0 = Date.UTC(2026, 9, 29, 22, 38), six = () => 0.99, one = () => 0, mid = () => 0.5;
const char = (cls = 'Striker') => ({ character: { name: 'Gigger', class: cls, level: '1' }, stats: { heat: '0', muscle: '3', reflex: '3', wit: '2', savvy: '2', spark: '1', root: '2' }, skills: {}, coins: { credits: '100' }, downtime: { actionsRemaining: 2 }, world: { presence: { location: { district: 'low-halo', place: 'low-halo--static-square' }, transit: null } } });

let s = char(), b = GG.board(s, G, R, PL, T0);
ok('the board shows a full feed', b.gigs.length === G.boardSize);
ok('it stays the same until it refreshes', JSON.stringify(b) === JSON.stringify(GG.board(s, G, R, PL, T0 + 60000)));
ok('pay after the cut is 85%', b.gigs.every(j => j.net === Math.round(j.gross * (1 - G.app.cut))));
ok('every skill maps to its rulebook attribute', G.gigs.every(g => ['muscle', 'reflex', 'wit', 'savvy', 'spark', 'root'].includes(GG.attrFor(R, g.skill))));
ok('Haul is a Muscle job and fits a Striker', GG.attrFor(R, 'haul') === 'muscle');
const place = b.gigs.find(j => !j.remote), remote = b.gigs.find(j => j.remote);
let r = GG.take(s, G, R, PL, place.id, T0);
ok('taking a gig is a Side Job: 1 downtime action', r.ok && s.downtime.actionsRemaining === 1);
ok('a taken gig leaves the feed', GG.board(s, G, R, PL, T0).gigs.find(j => j.id === place.id).taken);
ok('you have to be there', GG.work(s, G, R, place.id, T0, six).ok === false);
s.world.presence.location = { district: place.place.district, place: place.place.place };
const before = Number(s.coins.credits); r = GG.work(s, G, R, place.id, T0 + H, six);
ok('a good roll pays the net and rates 5 stars', r.result === 'success' && Number(s.coins.credits) === before + place.net && GG.rating(s, G) === 5);
ok('payment shows up in Mail', s.week.mail.some(m => /Paid/.test(m.title)));
// fail with risk = Heat
s = char('Wrench'); const risky = { ...G.gigs.find(g => g.risk) }; s.gigs = { v: 1, ratings: [], taken: [], jobs: [{ id: 'x', title: risky.title, skill: risky.skill, attr: GG.attrFor(R, risky.skill), difficulty: 2, risk: risky.risk, remote: true, gross: 100, net: 85, status: 'active', took: T0, due: T0 + 5 * H, fit: false, events: [] }] };
r = GG.work(s, G, R, 'x', T0, one);
ok('a failed risky gig costs Heat; plain bad luck does not', r.result === 'fail' && s.stats.heat === '1');
ok('a fail rates 1 star', GG.rating(s, G) === 1);
// no-show
s = char(); r = GG.take(s, G, R, PL, GG.board(s, G, R, PL, T0).gigs[0].id, T0); GG.settle(s, G, r.job.due + 1);
ok('missing the deadline is a no-show: 1 star and Mail', r.job.status === 'no-show' && GG.rating(s, G) === 1 && s.week.mail.some(m => /expired/.test(m.title)));
// rating gates the feed
s = char(); s.gigs = { v: 1, ratings: [1, 1, 2], taken: [], jobs: [] };
ok('below 2.5 stars only easy gigs show', GG.board(s, G, R, PL, T0).gigs.every(j => j.difficulty === 1) && GG.board(s, G, R, PL, T0).low);
s = char(); s.gigs = { v: 1, ratings: [5, 5, 5, 4], taken: [], jobs: [] };
ok('4+ stars unlocks premium', GG.board(s, G, R, PL, T0).premium);
ok('class fit adds a die', (() => { const t = char('Striker'); const j = { attr: 'muscle', skill: 'haul', fit: true }; return GG.pool(t, G, R, j) === 4; })());
// Sideways rides Velvet's servers
s = char(); const slots = Array.from({ length: 40 }, (_, i) => GG.board(s, G, R, PL, T0 + i * G.refreshHours * H).gigs.find(j => j.sideways)).filter(Boolean);
ok('Sideways shows up on some refreshes, not all', slots.length > 8 && slots.length < 32, slots.length);
ok('Sideways gigs take no cut', slots.every(j => j.net === j.gross));
ok('shop gigs happen at a Sideways door', slots.filter(j => ['sw-counter', 'sw-returns', 'sw-curtain'].includes(j.gig)).every(j => G.sideways.places.includes(j.place.place)));
const rated = () => { const t = char(); t.gigs = { v: 1, ratings: [4, 4], taken: [], jobs: [] }; return t; };
const swAt = i => GG.board(rated(), G, R, PL, T0 + i * G.refreshHours * H);
const k = Array.from({ length: 40 }, (_, i) => i).find(i => { const j = swAt(i).gigs.find(x => x.sideways); return j && j.remote; });
if (k != null) {
  s = rated(); const t = T0 + k * G.refreshHours * H, j = GG.board(s, G, R, PL, t).gigs.find(x => x.sideways);
  GG.take(s, G, R, PL, j.id, t); r = GG.work(s, G, R, j.id, t, six);
  ok('a Sideways gig pays in full and leaves your stars alone', r.result === 'success' && GG.rating(s, G) === 4 && s.coins.credits === String(100 + j.gross));
  s = rated(); GG.take(s, G, R, PL, j.id, t); r = GG.work(s, G, R, j.id, t, one);
  ok('botching one badly gets Velvet to look: Heat +1, a Trust & Safety letter', s.stats.heat === '1' && s.week.mail.some(m => /Anomalous/.test(m.title)) && GG.rating(s, G) === 4);
}
console.log(fails ? `${passes} passed, ${fails} failed.` : `${passes} gig checks passed.`);
process.exit(fails ? 1 : 0);
