/* Pocket Change: an in-world gig app for general Side Jobs, any class.
   Take a gig (1 downtime action, a Side Job), go where it is in Explore (or do it remotely), roll, get paid minus the app's cut.
   Your star rating decides which gigs the app shows you. Heat only comes from a gig's own risk going wrong.
   Pure logic (window.GRAKK_GIGS). Lives in the character file under state.gigs.
   G = data/gigs.json, R = data/rules.json, PL = data/places.json. Mail goes through window.GRAKK_WEEK, location through GRAKK_MAKE.here. */
(function (root) {
  'use strict';
  const H = 3600000;
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  const heatCap = lvl => { lvl = num(lvl); return lvl >= 17 ? 8 : lvl >= 7 ? 7 : 6; };
  function addHeat(s, n) { s.stats = s.stats || {}; s.stats.heat = String(clamp(num(s.stats.heat) + n, 0, heatCap(s.character && s.character.level))); }
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const between = (rng, [a, b]) => a + Math.floor(rng() * (b - a + 1));
  const WK = () => root.GRAKK_WEEK, MK = () => root.GRAKK_MAKE;

  function ensure(s) { if (!s.gigs || typeof s.gigs !== 'object') s.gigs = { v: 1, ratings: [], taken: [], jobs: [] }; for (const k of ['ratings', 'taken', 'jobs']) s.gigs[k] = s.gigs[k] || []; return s.gigs; }
  function rating(s, G) { const r = ensure(s).ratings.slice(0, G.rating.keep); return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length * 10) / 10 : G.rating.start; }
  function rate(s, G, stars) { const g = ensure(s); g.ratings.unshift(stars); g.ratings.length = Math.min(g.ratings.length, G.rating.keep); }
  /* A skill's attribute comes from its rulebook domain (Force = Muscle, Craft = Wit, ...). */
  function attrFor(R, skill) { for (const [, [attr, list]] of Object.entries(R.skills)) if (list.some(n => R.skillKeys[n] === skill)) return attr.toLowerCase(); return 'savvy'; }
  function skillName(R, skill) { return Object.keys(R.skillKeys).find(n => R.skillKeys[n] === skill) || skill; }
  function classFit(s, R, attr) { const c = R.classes[s.character && s.character.class]; return !!(c && String(c.primary || '').toLowerCase().split(/,\s*/).includes(attr)); }
  function downtimeLeft(s) { const d = s.downtime; return d && d.actionsRemaining != null ? num(d.actionsRemaining) : 2; }

  function board(s, G, R, PL, aMs) {
    const slot = Math.floor(aMs / (G.refreshHours * H)), rng = seeded(hash(`${(s.character && s.character.name) || ''}|gigs|${slot}`)), g = ensure(s), taken = new Set(g.taken);
    const stars = rating(s, G), premium = stars >= G.rating.premiumAt, low = stars < G.rating.lowAt;
    let pool = G.gigs.slice(); if (low) pool = pool.filter(x => x.difficulty === 1);
    const places = PL.places.filter(p => PL.districts[p.district]), out = [];
    for (let i = 0; i < G.boardSize && pool.length; i++) {
      const t = pool.splice(Math.floor(rng() * pool.length), 1)[0], place = t.where === 'place' ? places[Math.floor(rng() * places.length)] : null;
      const isPremium = premium && rng() < 0.4, attr = attrFor(R, t.skill);
      const gross = Math.round(between(rng, t.pay) * (isPremium ? G.rating.premiumPay : 1) * (low ? 0.8 : 1) / 5) * 5;
      out.push({ id: `gig-${slot}-${i}`, gig: t.id, title: t.title, blurb: t.blurb, skill: t.skill, skillName: skillName(R, t.skill), attr, difficulty: t.difficulty, risk: t.risk || null,
        remote: t.where === 'remote', place: place ? { district: place.district, place: place.id, name: place.name, districtName: PL.districts[place.district].name } : null,
        gross, net: Math.round(gross * (1 - G.app.cut)), hours: between(rng, G.deadlineHours), premium: isPremium, fit: classFit(s, R, attr), taken: taken.has(`gig-${slot}-${i}`) });
    }
    return { gigs: out, stars, premium, low, nextAt: (slot + 1) * G.refreshHours * H };
  }
  function take(s, G, R, PL, id, aMs) {
    const b = board(s, G, R, PL, aMs), j = b.gigs.find(x => x.id === id); if (!j || j.taken) return { ok: false, msg: 'Someone else got that one.' };
    if (downtimeLeft(s) < 1) return { ok: false, msg: 'No downtime actions left this gap. A gig is a Side Job.' };
    const g = ensure(s); s.downtime = s.downtime || {}; s.downtime.actionsRemaining = downtimeLeft(s) - 1; g.taken = [id, ...g.taken].slice(0, 40);
    const job = { ...j, status: 'active', took: aMs, due: aMs + j.hours * H, events: [{ at: aMs, text: `Took "${j.title}" for ${j.gross} cr (${j.net} after the app's cut). Side Job: 1 downtime action.` }] };
    g.jobs.unshift(job); g.jobs.length = Math.min(g.jobs.length, 40);
    return { ok: true, job, msg: j.remote ? 'Taken. You can do this one from anywhere.' : `Taken. Head to ${j.place.name} in ${j.place.districtName}.` };
  }
  /* You have to be standing there in Explore, unless it's remote. */
  function there(s, j, aMs) { if (j.remote) return true; const mk = MK(), h = mk && mk.here(s, aMs); return !!(h && h.place === j.place.place); }
  function pool(s, G, R, j) { return Math.max(1, num(s.stats && s.stats[j.attr]) + num(s.skills && s.skills[j.skill]) + (j.fit ? G.classFitBonus : 0)); }
  function work(s, G, R, id, aMs, rng = Math.random) {
    const g = ensure(s), j = g.jobs.find(x => x.id === id); if (!j || j.status !== 'active') return { ok: false, msg: 'Nothing to do.' };
    if (!there(s, j, aMs)) return { ok: false, msg: `You need to be at ${j.place.name} first.` };
    const dice = Array.from({ length: pool(s, G, R, j) }, () => 1 + Math.floor(rng() * 6)), hits = dice.filter(d => d >= 5).length;
    const result = hits >= j.difficulty ? 'success' : hits > 0 ? 'partial' : 'fail';
    const pay = result === 'success' ? j.net : result === 'partial' ? Math.round(j.net * G.partialPay) : 0, stars = G.rating[result];
    if (pay) setCredits(s, credits(s) + pay); rate(s, G, stars);
    j.status = result === 'fail' ? 'failed' : 'done'; j.result = result; j.roll = { dice, hits, need: j.difficulty }; j.paid = pay; j.stars = stars;
    let msg = result === 'success' ? `Done. Paid ${pay} cr. Five stars.` : result === 'partial' ? `Half-done. Paid ${pay} cr. Three stars.` : 'It went wrong. No pay. One star.';
    j.events.unshift({ at: aMs, text: `${hits} success${hits === 1 ? '' : 'es'} (needed ${j.difficulty}). ${result === 'success' ? 'Done' : result === 'partial' ? 'Half-done' : 'Failed'}. ${pay} cr. ${stars} star${stars === 1 ? '' : 's'}.` });
    if (result === 'fail' && j.risk && j.risk.onFail) { addHeat(s, j.risk.onFail); j.events.unshift({ at: aMs, text: `${j.risk.text} Heat +${j.risk.onFail}.` }); msg += ` ${j.risk.text} Heat +${j.risk.onFail}.`; }
    const wk = WK(); if (wk && pay) wk.inform(s, aMs, G.app.name, `Paid: ${pay} cr`, `"${j.title}" ${result === 'success' ? 'complete' : 'partly complete'}. ${G.app.owner} kept ${Math.round(j.gross * G.app.cut * (result === 'partial' ? G.partialPay : 1))} cr. Rated ${stars} stars.`);
    return { ok: true, msg, dice, result };
  }
  function drop(s, G, id, aMs) { const j = ensure(s).jobs.find(x => x.id === id); if (!j || j.status !== 'active') return { ok: false }; j.status = 'dropped'; rate(s, G, G.rating.noShow); j.events.unshift({ at: aMs, text: `Cancelled. ${G.rating.noShow} star.` }); return { ok: true, msg: 'Cancelled. The app remembers.' }; }
  function settle(s, G, aMs) {
    const out = [], wk = WK();
    for (const j of ensure(s).jobs) if (j.status === 'active' && aMs > j.due) {
      j.status = 'no-show'; rate(s, G, G.rating.noShow); j.events.unshift({ at: j.due, text: `Missed the deadline. ${G.rating.noShow} star.` }); out.push(j);
      if (wk) wk.inform(s, j.due, G.app.name, 'Gig expired', `"${j.title}" timed out. Your rating took the hit.`);
    }
    return out;
  }
  const api = { ensure, rating, attrFor, board, take, there, pool, work, drop, settle };
  root.GRAKK_GIGS = api;
})(typeof window !== 'undefined' ? window : globalThis);
