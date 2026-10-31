// Unit tests for apps/radio.js (Radio Sewers). Run: node tools/radio-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {} };
for (const f of ['week.js', 'make.js', 'gigs.js', 'radio.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), sb);
const { GRAKK_RADIO: RA, GRAKK_MAKE: MK, GRAKK_WEEK: WK } = sb.window;
const json = p => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const RD = json('radio.json'), R = json('rules.json'), PL = json('places.json'), M = json('make.json'), W = json('week.json');
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const H = 3600000, T0 = Date.UTC(2026, 9, 29, 22, 38), six = () => 0.99, one = () => 0;
const at = h => Date.UTC(2026, 9, 30, h, 0);
const char = (st = 3) => ({ character: { name: 'Listener', class: 'Shade', level: '1' }, stats: { heat: '0', wit: '3', reflex: '2', muscle: '2', spark: '3' }, skills: { repair: '1', navigate: '1' }, coins: { credits: '100' }, downtime: { actionsRemaining: 2 }, cityRelations: { sewers: { relationship: 'Skott', standing: String(st) } }, world: { presence: { location: { district: 'low-halo', place: 'low-halo--static-square' }, transit: null } } });

ok('mornings are Smokier, from the archives', RA.slotAt(RD, at(8)).dj === 'Smokier' && RA.slotAt(RD, at(8)).mia);
ok('afternoons are DJ Sludge', RA.slotAt(RD, at(14)).dj === 'DJ Sludge');
ok('nights are DJ Stormbird, past midnight too', RA.slotAt(RD, at(22)).dj === 'DJ Stormbird' && RA.slotAt(RD, at(3)).dj === 'DJ Stormbird');
ok('everyone hears the same station', JSON.stringify(RA.feed(char(), RD, M, PL, T0)) === JSON.stringify(RA.feed(char(), RD, M, PL, T0)) && RA.feed(char(), RD, M, PL, T0).length === 10);

// Heads-ups come from your own world, and only once they trust you
let s = char(3); WK.ensure(s); const crisis = WK.issueNotice(W, s, 'crisis', T0, 'test');
ok('Standing 3: a crisis gets a heads-up', RA.headsUps(s, RD, M, PL, T0).some(h => h.about === crisis.id));
ok('Standing 2: silence', RA.headsUps(char(2), RD, M, PL, T0).length === 0);
// A sweep that will find your ward: the warning matches what the clock then does
let warned = 0, found = 0, agree = 0;
for (let i = 0; i < 30; i++) {
  s = char(3); s.character.name = 'L' + i; const a = MK.make(s, M, 'doorway-ward', { district: 'new-halo', permission: 'none', visibility: 'public' }, T0, six).artifact;
  MK.settle(s, M, W, T0 + 1);
  const w = RA.headsUps(s, RD, M, PL, T0 + 1).some(h => h.about === a.id); warned += w;
  MK.settle(s, M, W, WK.weekStart(WK.weekIndex(T0) + 1) + H); const f = a.status === 'removed'; found += f; agree += (w === f);
}
ok('the station warns about exactly the sweeps that happen', agree === 30, `${agree}/30 (warned ${warned}, found ${found})`);
s = char(3); let a2 = MK.make(s, M, 'doorway-ward', { district: 'new-halo', permission: 'none', visibility: 'public' }, T0, six).artifact; MK.settle(s, M, W, T0 + 1);
if (RA.headsUps(s, RD, M, PL, T0 + 1).some(h => h.about === a2.id)) { MK.retire(s, a2.id, T0 + 2); MK.settle(s, M, W, WK.weekStart(WK.weekIndex(T0) + 1) + H); ok('take it down in time: no Heat', s.stats.heat === '0'); }

// Station jobs
s = char(3); const jobs = RA.board(s, RD, R, PL, T0);
ok('the station needs two things a day', jobs.length === RD.support.perDay);
ok('station jobs happen where places exist', jobs.every(j => RD.support.districts.includes(j.place.district)));
ok('helping is a Side Job', RA.take(s, RD, R, PL, jobs[0].id, T0).ok && s.downtime.actionsRemaining === 1);
const j = s.radio.jobs[0];
ok('you have to be there', RA.work(s, RD, j.id, T0, six).ok === false);
s.world.presence.location = { district: j.place.district, place: j.place.place };
RA.work(s, RD, j.id, T0, six);
ok('success pays and raises Sewers Standing', s.cityRelations.sewers.standing === '4' && Number(s.coins.credits) === 100 + j.pay);
s = char(3); RA.take(s, RD, R, PL, RA.board(s, RD, R, PL, T0)[0].id, T0); const j2 = s.radio.jobs[0]; s.world.presence.location = { district: j2.place.district, place: j2.place.place };
RA.work(s, RD, j2.id, T0, one);
ok('a botch: Velvet trace, Heat +1, no Standing', s.stats.heat === '1' && s.cityRelations.sewers.standing === '3');
ok('Standing caps at 5', (() => { const t = char(5); RA.take(t, RD, R, PL, RA.board(t, RD, R, PL, T0)[0].id, T0); const x = t.radio.jobs[0]; t.world.presence.location = { district: x.place.district, place: x.place.place }; RA.work(t, RD, x.id, T0, six); return t.cityRelations.sewers.standing === '5'; })());

// Your broadcast
ok('Standing 3 cannot broadcast', RA.broadcast(char(3), RD, 'message', 'hi', T0).ok === false);
s = char(4); WK.ensure(s);
ok('Standing 4 can, once per session', RA.broadcast(s, RD, 'message', 'Stay off Pipe 37.', T0).ok && RA.broadcast(s, RD, 'message', 'again', T0).ok === false);
ok('it goes out on the feed', RA.feed(s, RD, M, PL, T0 + H).some(x => x.kind === 'yours' && /Pipe 37/.test(x.text)));
WK.sessionStart(s, T0); ok('a new session resets it', RA.canBroadcast(s, RD));
const n = WK.issueNotice(W, s, 'scrutiny', T0, 'x'); n.appeal = true;
ok('pressure on a notice adds +2 to its appeal', RA.broadcast(s, RD, 'pressure', n.id, T0).ok && n.pressure === 2);
console.log(fails ? `${passes} passed, ${fails} failed.` : `${passes} radio checks passed.`);
process.exit(fails ? 1 : 0);
