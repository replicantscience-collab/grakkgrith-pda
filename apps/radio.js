/* Radio Sewers: the Commons' station, in the PDA.
   - The dial: who's on air (by Adyta hour) and a feed of segments: songs, DJ talk, rumors.
   - Heads-ups: at Sewers Community Standing 3+, the station warns you before trouble lands
     (a compliance sweep that will find something you put up, a crisis on its way, spot checks on your route).
   - Support jobs (rulebook): keep the station on air; pays credits and Sewers Standing; a Velvet trace can catch you.
   - Your broadcast (rulebook Sewers Community perk, Standing 4+): once per session they put something on air for you.
   Pure logic (window.GRAKK_RADIO). State lives in the character file under state.radio.
   RD = data/radio.json, PL = places.json, R = rules.json, M = make.json. Uses GRAKK_WEEK, GRAKK_MAKE, GRAKK_GIGS. */
(function (root) {
  'use strict';
  const H = 3600000, DAY = 24 * H;
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (rng, l) => l[Math.floor(rng() * l.length)];
  const fill = (t, c) => String(t).replace(/\{(\w+)\}/g, (_, k) => c[k] != null ? c[k] : '');
  const WK = () => root.GRAKK_WEEK, MK = () => root.GRAKK_MAKE, GG = () => root.GRAKK_GIGS;
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  const heatCap = lvl => { lvl = num(lvl); return lvl >= 17 ? 8 : lvl >= 7 ? 7 : 6; };

  function ensure(s) { if (!s.radio || typeof s.radio !== 'object') s.radio = { v: 1, jobs: [], taken: [], aired: [], lastBroadcastSession: null }; for (const k of ['jobs', 'taken', 'aired']) s.radio[k] = s.radio[k] || []; return s.radio; }
  function standing(s, RD) { const r = s.cityRelations && s.cityRelations[RD.standingTerritory]; return r ? num(r.standing, 3) : 3; }
  function setStanding(s, RD, v) { s.cityRelations = s.cityRelations || {}; const r = s.cityRelations[RD.standingTerritory] || (s.cityRelations[RD.standingTerritory] = { relationship: 'Skott', standing: '3', notes: '' }); r.standing = String(clamp(v, 0, 5)); }
  function slotAt(RD, aMs) { const h = new Date(aMs).getUTCHours(); return RD.slots.find(x => x.from < x.to ? h >= x.from && h < x.to : h >= x.from || h < x.to); }

  /* ---------- heads-ups: real warnings from this character's own world ---------- */
  function headsUps(s, RD, M, PL, aMs) {
    if (standing(s, RD) < RD.headsUp.minStanding) return [];
    const out = [], mk = MK(), dn = id => (PL.districts[id] || {}).name || id;
    for (const m of ((s.week && s.week.mail) || [])) if (m.kind === 'crisis' && m.status === 'open') out.push({ kind: 'headsUp', about: m.id, text: fill(RD.headsUp.crisis, { from: m.from, title: m.title }) });
    if (mk && M) for (const a of ((s.make && s.make.artifacts) || [])) {
      if (mk.willBeFound(s, M, a, aMs)) out.push({ kind: 'headsUp', about: a.id, text: fill(RD.headsUp.sweep, { district: dn(a.location.district) }) });
      if (a.status === 'active' && a.delivery && a.delivery.stage === 'carrying' && a.delivery.cargo.legality === 'restricted') out.push({ kind: 'headsUp', about: a.id, text: fill(RD.headsUp.sealed, { district: a.delivery.to.districtName }) });
    }
    return out;
  }
  /* ---------- the feed: the same station for everyone, plus what's yours ---------- */
  function feed(s, RD, M, PL, aMs, n = 10) {
    const hour = Math.floor(aMs / H), out = [], dnames = Object.values(PL.districts).map(d => d.name);
    for (let i = 0; i < n; i++) {
      const at = (hour - i) * H, slot = slotAt(RD, at), rng = seeded(hash(`radio|${hour - i}`)), roll = rng();
      const dj = slot.mia ? `${slot.dj} (archive)` : slot.dj;
      if (roll < 0.4) out.push({ at, dj, kind: 'song', text: 'Now playing: a track made right here in the Commons.' });
      else if (roll < 0.75) out.push({ at, dj, kind: 'talk', text: pick(rng, RD.lines[slot.id]) });
      else out.push({ at, dj, kind: 'rumor', text: fill(pick(rng, RD.rumors), { district: pick(rng, dnames) }) });
    }
    const now = slotAt(RD, aMs), dj = now.mia ? `${now.dj} (archive)` : now.dj;
    for (const a of ensure(s).aired) if (a.at > aMs - 6 * H) out.push({ at: a.at, dj, kind: 'yours', text: a.text });
    for (const h of headsUps(s, RD, M, PL, aMs)) out.push({ at: aMs, dj, ...h });
    return out.sort((a, b) => b.at - a.at || (b.kind === 'headsUp') - (a.kind === 'headsUp'));
  }

  /* ---------- support jobs (rulebook) ---------- */
  function board(s, RD, R, PL, aMs) {
    const S = RD.support, day = Math.floor(aMs / DAY), rng = seeded(hash(`${(s.character && s.character.name) || ''}|radio|${day}`)), taken = new Set(ensure(s).taken), gg = GG();
    const places = PL.places.filter(p => S.districts.includes(p.district)), pool = S.jobs.slice(), out = [];
    for (let i = 0; i < S.perDay && pool.length; i++) {
      const t = pool.splice(Math.floor(rng() * pool.length), 1)[0], pl = places[Math.floor(rng() * places.length)] || PL.places[0], id = `rs-${day}-${i}`;
      out.push({ ...t, id, attr: gg ? gg.attrFor(R, t.skill) : 'wit', skillName: Object.keys(R.skillKeys).find(n => R.skillKeys[n] === t.skill) || t.skill,
        pay: S.pay[0] + Math.round(rng() * (S.pay[1] - S.pay[0]) / 5) * 5, place: { district: pl.district, place: pl.id, name: pl.name, districtName: (PL.districts[pl.district] || {}).name }, taken: taken.has(id) });
    }
    return out;
  }
  const downtimeLeft = s => s.downtime && s.downtime.actionsRemaining != null ? num(s.downtime.actionsRemaining) : 2;
  function take(s, RD, R, PL, id, aMs) {
    const j = board(s, RD, R, PL, aMs).find(x => x.id === id); if (!j || j.taken) return { ok: false, msg: 'Somebody already took that one.' };
    if (downtimeLeft(s) < 1) return { ok: false, msg: 'No downtime actions left this gap. Station work is a Side Job.' };
    const r = ensure(s); s.downtime = s.downtime || {}; s.downtime.actionsRemaining = downtimeLeft(s) - 1; r.taken = [id, ...r.taken].slice(0, 20);
    r.jobs.unshift({ ...j, status: 'active', took: aMs, events: [{ at: aMs, text: `Took "${j.title}" for the station. Side Job: 1 downtime action.` }] }); r.jobs.length = Math.min(r.jobs.length, 20);
    return { ok: true, msg: `The station owes you one. Head to ${j.place.name}.` };
  }
  function work(s, RD, id, aMs, rngIn = Math.random) {
    const S = RD.support, j = ensure(s).jobs.find(x => x.id === id); if (!j || j.status !== 'active') return { ok: false, msg: 'Nothing to do.' };
    const mk = MK(), here = mk && mk.here(s, aMs); if (!here || here.place !== j.place.place) return { ok: false, msg: `Get to ${j.place.name} first.` };
    const dice = Array.from({ length: Math.max(1, num(s.stats && s.stats[j.attr]) + num(s.skills && s.skills[j.skill])) }, () => 1 + Math.floor(rngIn() * 6)), hits = dice.filter(d => d >= 5).length;
    const result = hits >= j.difficulty ? 'success' : hits > 0 ? 'partial' : 'fail', wk = WK();
    let pay = 0, msg = '';
    if (result === 'success') { pay = j.pay; const before = standing(s, RD); setStanding(s, RD, Math.min(S.standingCap, before + S.standingGain)); msg = `Kept the station on air. ${pay} cr${standing(s, RD) > before ? ', and the Sewers remember: Standing +1' : ''}.`; }
    else if (result === 'partial') { pay = Math.round(j.pay / 2); msg = `Patched, not fixed. ${pay} cr.`; }
    else { s.stats = s.stats || {}; s.stats.heat = String(clamp(num(s.stats.heat) + S.traceHeat, 0, heatCap(s.character && s.character.level))); msg = S.trace; }
    if (pay) setCredits(s, credits(s) + pay);
    j.status = result === 'fail' ? 'failed' : 'done'; j.result = result; j.roll = { dice, hits, need: j.difficulty }; j.paid = pay; j.events.unshift({ at: aMs, text: msg });
    if (wk) wk.inform(s, aMs, RD.station.name, result === 'fail' ? 'Trace sweep' : `Thanks from the station: ${pay} cr`, msg);
    return { ok: true, msg, dice, result };
  }

  /* ---------- your broadcast: Sewers Community perk, once per session ---------- */
  function canBroadcast(s, RD) { const sess = (s.week && s.week.sessionsStarted) || 0; return standing(s, RD) >= RD.broadcast.minStanding && ensure(s).lastBroadcastSession !== sess; }
  function broadcast(s, RD, kind, payload, aMs) {
    if (!canBroadcast(s, RD)) return { ok: false, msg: standing(s, RD) < RD.broadcast.minStanding ? `Needs Sewers Standing ${RD.broadcast.minStanding}.` : 'Already used this session.' };
    const r = ensure(s), who = (s.character && s.character.name) || 'a friend of the station';
    if (kind === 'message') { const text = String(payload || '').trim().slice(0, 200); if (!text) return { ok: false, msg: 'Say something.' }; r.aired.unshift({ at: aMs, text: `A message from ${who}: "${text}"` }); }
    else if (kind === 'pressure') {
      const m = ((s.week && s.week.mail) || []).find(x => x.id === payload && x.status === 'open' && x.appeal && !x.appealed); if (!m) return { ok: false, msg: 'Pick an open notice you can still appeal.' };
      m.pressure = 2; r.aired.unshift({ at: aMs, text: `${m.from} sent ${who} a "${m.title}". The Commons is listening, ${m.from}.` });
    } else return { ok: false, msg: 'Unknown broadcast.' };
    r.aired.length = Math.min(r.aired.length, 20); r.lastBroadcastSession = (s.week && s.week.sessionsStarted) || 0;
    return { ok: true, msg: kind === 'pressure' ? 'On air. Your next appeal on that notice rolls +2 dice.' : 'On air.' };
  }

  root.GRAKK_RADIO = { ensure, standing, slotAt, headsUps, feed, board, take, work, canBroadcast, broadcast };
})(typeof window !== 'undefined' ? window : globalThis);
