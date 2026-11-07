/* The living city: what changed in Adyta today.
   Every player's PDA builds the same day from the Adyta date alone (no server), so the whole group sees the
   same district moods, the same shop signs and the same hidden Sticker. Lines rotate so a district never
   repeats a mood or a wisdom line on back-to-back days, and cycles through all of them before repeating.
   Pure logic (window.GRAKK_CITYDAY). What a character found lives in the character file:
   state.world.stickers (the collection) and state.world.cityDay (the last day they looked).
   D = data/cityday.json, PL = data/places.json, ST = sticker list from stickerList(art manifest). */
(function (root) {
  'use strict';
  const DAY = 86400000;
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  /* Adyta moments are millisecond counts read with UTC getters (see Explore), so the date is the UTC date. */
  const dayKey = aMs => new Date(aMs).toISOString().slice(0, 10);
  const dayNum = aMs => Math.floor(aMs / DAY);

  /* Walk a list with a fixed step that shares no factor with its length: every line shows once per cycle,
     never twice in a row. Each salt gets its own start and step, so districts don't move in lockstep. */
  function rotate(list, aMs, salt) {
    const n = list.length; if (!n) return null; if (n === 1) return list[0];
    const h = hash(salt); let step = 1 + (h % (n - 1)); while (gcd(step, n) !== 1) step = step % (n - 1) + 1;
    return list[(((dayNum(aMs) * step + (h >>> 8)) % n) + n) % n];
  }

  /* The art manifest's sticker sheets, flattened: one entry per sticker crop. */
  function stickerList(manifest) {
    const out = [];
    for (const it of (manifest && manifest.items) || []) {
      if (!/sticker/.test(it.kind || '') || !Array.isArray(it.rough_crops)) continue;
      for (const c of it.rough_crops) out.push({ id: c.path.replace(/^stickers\/rough-crops\//, '').replace(/\.\w+$/, ''), label: c.label, sheet: it.title, path: c.path });
    }
    return out;
  }

  function today(D, PL, ST, aMs) {
    const key = dayKey(aMs), out = { day: key, districts: {}, signs: {}, sticker: null };
    for (const [id, d] of Object.entries(D.districts || {})) {
      if (!PL.districts[id]) continue;
      out.districts[id] = { mood: rotate(d.moods || [], aMs, `${id}|mood`), wisdom: rotate(d.wisdom || [], aMs, `${id}|wisdom`) };
      const rng = seeded(hash(`${key}|signs|${id}`)), pool = PL.places.filter(p => p.district === id && (D.signs || {})[p.type] && !p.proposed);
      for (let i = 0; i < (D.signsPerDistrict || 0) && pool.length; i++) {
        const p = pool.splice(Math.floor(rng() * pool.length), 1)[0], lines = D.signs[p.type];
        out.signs[p.id] = lines[Math.floor(rng() * lines.length)];
      }
    }
    const spots = PL.places.filter(p => p.pin && PL.districts[p.district] && !p.proposed);
    if (spots.length && ST && ST.length) {
      const rng = seeded(hash(`${key}|sticker`)), p = spots[Math.floor(rng() * spots.length)], st = ST[Math.floor(rng() * ST.length)];
      const hints = (D.stickers && D.stickers.hints) || ['A new sticker somewhere in {district}.'];
      out.sticker = { ...st, place: p.id, district: p.district, hint: hints[Math.floor(rng() * hints.length)].replace('{district}', PL.districts[p.district].name) };
    }
    return out;
  }

  function found(s) { return (s && s.world && Array.isArray(s.world.stickers)) ? s.world.stickers : []; }
  function uniqueCount(s) { return new Set(found(s).map(f => f.id)).size; }
  function foundToday(s, T) { return found(s).find(f => f.day === T.day) || null; }
  /* Peel today's Sticker: only in person, only once a day. A repeat still counts as a find, just not a new one. */
  function collect(s, T, aMs) {
    if (!s || typeof s !== 'object') return { ok: false, msg: 'Make a character to keep what you find.' };
    if (!T.sticker) return { ok: false, msg: 'No sticker today.' };
    const pr = s.world && s.world.presence;
    if (!pr || pr.transit || !pr.location || pr.location.place !== T.sticker.place) return { ok: false, msg: 'You have to be there.' };
    if (foundToday(s, T)) return { ok: false, msg: "You already peeled today's sticker." };
    const dupe = found(s).some(f => f.id === T.sticker.id);
    s.world.stickers = [{ id: T.sticker.id, day: T.day, place: T.sticker.place, at: aMs }, ...found(s)].slice(0, 400);
    return { ok: true, dupe, sticker: T.sticker };
  }
  function isNew(s, T) { return !(s && s.world && s.world.cityDay === T.day); }
  function markSeen(s, T) { if (s && typeof s === 'object') s.world = { ...(s.world || {}), cityDay: T.day }; }

  root.GRAKK_CITYDAY = { dayKey, rotate, stickerList, today, found, uniqueCount, foundToday, collect, isNew, markSeen };
})(typeof window !== 'undefined' ? window : globalThis);
