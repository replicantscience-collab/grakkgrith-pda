// Unit tests for apps/jobs.js (the Job Board). Run: node tools/jobs-test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {} };
for (const f of ['week.js', 'jobs.js']) vm.runInNewContext(readFileSync(new URL('../apps/' + f, import.meta.url), 'utf8'), sb);
const JB = sb.window.GRAKK_JOBS;
const json = p => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const J = json('jobs.json'), PL = json('places.json');
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const D = 86400000, T0 = Date.UTC(2026, 10, 4, 20, 0);
const char = (name = 'Runner A') => ({ character: { name, class: 'Runner', level: '1' }, stats: { heat: '0' }, coins: { credits: '100' }, downtime: { marks: 0 } });

const b = JB.board(J, PL, T0);
ok('four jobs posted a day', b.length === J.board.perDay);
ok('the whole crew sees the same board', JSON.stringify(JB.board(J, PL, T0 + 3600000).map(j => j.id + j.pay + j.known.name)) === JSON.stringify(b.map(j => j.id + j.pay + j.known.name)));
ok('a new day posts new jobs', JB.board(J, PL, T0 + D)[0].id !== b[0].id);
ok('every posted job is a rulebook job', b.every(j => J.jobs.some(x => x.id === j.job)));
ok('credit pay falls inside the book\'s range', Array.from({ length: 30 }, (_, i) => JB.board(J, PL, T0 + i * D)).flat().filter(j => j.pay != null).every(j => { const t = J.jobs.find(x => x.id === j.job); return j.pay >= t.pay[0] && j.pay <= t.pay[1]; }));
const all = Array.from({ length: 60 }, (_, i) => JB.board(J, PL, T0 + i * D)).flat();
ok('Watched or Exposed raises base Heat to at least 2', all.filter(j => ['Watched', 'Exposed'].includes(j.known.name)).every(j => j.baseHeat >= 2));

// Take, reveal, close
let a = char(), j = b.find(x => x.pay != null) || b[0];
ok('taking fixes the pay', JB.take(a, J, PL, j.id, T0).ok && a.jobs.list[0].pay === j.pay);
ok('a taken job shows as taken', JB.board(J, PL, T0, a).find(x => x.id === j.id).taken);
JB.start(a, J, j.id, T0 + 1000); const em = a.jobs.list[0].emerging;
const c = char('Runner B'); JB.take(c, J, PL, j.id, T0); JB.start(c, J, j.id, T0 + 5000);
ok('crewmates on the same job get the same emerging complication', c.jobs.list[0].emerging.name === em.name && em.die === 8);
JB.twist(a, J, j.id, T0 + 2000);
const tw = a.jobs.list[0].twist;
ok('the twist is a d6 from the book', tw && tw.die === 6);
const heatBefore = Number(a.stats.heat);
const r = JB.close(a, J, j.id, { outcome: 'success', execution: [1, 2] }, T0 + 3000);
const sk = tw.name === 'Someone Knows' ? J.heat.someoneKnows : 0;
ok('closing applies base + execution Heat', Number(a.stats.heat) === Math.min(6, heatBefore + j.baseHeat + 3), `${a.stats.heat} vs ${heatBefore}+${j.baseHeat}+3 (twist +${sk} came earlier)`);
ok('success pays in full and earns a Mark', r.pay === j.pay && a.downtime.marks === 1);
ok('closing sends Mail', a.week.mail.some(m => /Job closed/.test(m.title)));
a = char(); JB.take(a, J, PL, j.id, T0); JB.start(a, J, j.id, T0);
ok('partial pays half (draft) and still earns a Mark', JB.close(a, J, j.id, { outcome: 'partial' }, T0).pay === Math.round(j.pay * J.outcome.partialPay) && a.downtime.marks === 1);
a = char(); JB.take(a, J, PL, j.id, T0); JB.start(a, J, j.id, T0);
ok('a failed job pays nothing, no Mark, Heat anyway', JB.close(a, J, j.id, { outcome: 'failed' }, T0).pay === 0 && a.downtime.marks === 0 && Number(a.stats.heat) >= j.baseHeat);
ok('Heat stops at the level cap', (() => { const x = char(); x.stats.heat = '5'; JB.take(x, J, PL, j.id, T0); JB.start(x, J, j.id, T0); JB.close(x, J, j.id, { execution: [4, 3] }, T0); return x.stats.heat === '6'; })());
// percent / varies jobs take a reported amount
const pj = all.find(x => x.payKind !== 'credits');
if (pj) { a = char(); JB.take(a, J, PL, pj.id, pj.id.split('-')[1] * D + 1); JB.start(a, J, pj.id, 0); ok('percent/varies jobs pay what you report', JB.close(a, J, pj.id, { paid: 240 }, 0).pay === 240); }
console.log(fails ? `${passes} passed, ${fails} failed.` : `${passes} job checks passed.`);
process.exit(fails ? 1 : 0);
