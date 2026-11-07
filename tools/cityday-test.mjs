// Unit tests for apps/cityday.js (the living city). Run: node tools/cityday-test.mjs
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const sb = { window: {} };
vm.runInNewContext(readFileSync(new URL('../apps/cityday.js', import.meta.url), 'utf8'), sb);
const CD = sb.window.GRAKK_CITYDAY;
const json = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const D = json('data/cityday.json'), PL = json('data/places.json'), ST = CD.stickerList(json('art/pda-v1/imports/manifest.json'));
let fails = 0, passes = 0;
const ok = (n, c, x = '') => { if (c) passes++; else { fails++; console.log('✗ ' + n + (x ? ' — ' + x : '')); } };
const DAY = 86400000, T0 = Date.UTC(2026, 10, 9, 10, 0);

ok('every sticker crop is listed', ST.length >= 40, String(ST.length));
ok('every sticker file exists', ST.every(s => existsSync(new URL('../art/pda-v1/imports/' + s.path, import.meta.url))), ST.filter(s => !existsSync(new URL('../art/pda-v1/imports/' + s.path, import.meta.url))).map(s => s.path).join(', '));
ok('sticker ids are unique', new Set(ST.map(s => s.id)).size === ST.length);
ok('every cityday district is a real district', Object.keys(D.districts).every(id => PL.districts[id]), Object.keys(D.districts).filter(id => !PL.districts[id]).join(', '));
ok('every district with places has a day', [...new Set(PL.places.map(p => p.district))].every(id => D.districts[id]), [...new Set(PL.places.map(p => p.district))].filter(id => !D.districts[id]).join(', '));

const t = CD.today(D, PL, ST, T0);
ok('the day is the Adyta date', t.day === '2026-11-09');
ok('the same day is the same for everyone', JSON.stringify(t) === JSON.stringify(CD.today(D, PL, ST, T0 + 5 * 3600000)));
ok('the next day is different', JSON.stringify(t.districts) !== JSON.stringify(CD.today(D, PL, ST, T0 + DAY).districts));
ok('every district gets a mood and a wisdom line', Object.values(t.districts).every(d => d.mood && d.wisdom));
ok('signs land on real shops, food, venues or markets', Object.keys(t.signs).every(id => { const p = PL.places.find(x => x.id === id); return p && D.signs[p.type]; }));
ok('a sticker is hidden at a real place', t.sticker && PL.places.some(p => p.id === t.sticker.place));
ok('the hint names the district', t.sticker && t.sticker.hint.includes(PL.districts[t.sticker.district].name));

// Rotation: never twice in a row, and every line within one cycle.
for (const [id, d] of Object.entries(D.districts)) {
  const n = d.moods.length, seen = new Set(); let prev = null, repeat = false;
  for (let i = 0; i < n; i++) { const m = CD.today(D, PL, ST, T0 + i * DAY).districts[id].mood; if (m === prev) repeat = true; prev = m; seen.add(m); }
  ok(`${id}: no mood repeats on back-to-back days`, !repeat);
  ok(`${id}: every mood shows once per cycle`, seen.size === n, `${seen.size} of ${n}`);
}

// Collecting: in person, once a day.
const char = () => ({ character: { name: 'Peeler' }, world: { presence: { location: { district: 'low-halo', place: 'nowhere' }, transit: null } } });
let s = char();
ok('you have to be there', CD.collect(s, t, T0).ok === false);
s.world.presence.location = { district: t.sticker.district, place: t.sticker.place };
let r = CD.collect(s, t, T0);
ok('being there peels it', r.ok && CD.found(s).length === 1 && CD.uniqueCount(s) === 1);
ok('only once a day', CD.collect(s, t, T0 + 60000).ok === false);
s.world.presence.transit = { to: {} };
ok('not while travelling', CD.collect(char(), t, T0).ok === false);
ok('no character, nothing kept', CD.collect(null, t, T0).ok === false);
// A repeat sticker on another day still counts as a find, not a new one.
const t2 = { ...t, day: '2026-11-10' }; s = char(); s.world.presence.location = { district: t.sticker.district, place: t.sticker.place };
CD.collect(s, t, T0); r = CD.collect(s, t2, T0 + DAY);
ok('a repeat counts but is not new', r.ok && r.dupe && CD.found(s).length === 2 && CD.uniqueCount(s) === 1);

// What's new since you last looked.
s = char();
ok('a new day is new', CD.isNew(s, t));
CD.markSeen(s, t);
ok('once seen, it is not new', !CD.isNew(s, t) && CD.isNew(s, t2));

console.log(fails ? `${fails} failed, ${passes} passed` : `cityday: all ${passes} checks pass.`);
process.exit(fails ? 1 : 0);
