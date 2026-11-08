/* Item codes, the PDA side (design doc: "Item Codes: Trading, Theft and Scrubbing"; server: server/src/codes.js).
   Every Workshop item made after codes went live gets a code. Whoever claims the code holds the item.
   This file keeps each character's secret PDA key, works out grades and who "stays out" of crime,
   rolls cover and trace, talks to the server, and keeps the Workshop in step with it.
   Works in the browser (window.GRAKK_CODES) and in Node (module.exports) so it can be tested. */
(function (root) {
  'use strict';
  const DAY = 86400000, num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const GRADES = ['street', 'connected', 'restricted', 'corporate'], GRADE_NAMES = { street: 'Street', connected: 'Connected', restricted: 'Restricted', corporate: 'Corporate / Military' };

  function randomKey() { const b = new Uint8Array(24); (root.crypto || globalThis.crypto).getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); }
  function ensure(s) { if (!s.codes || typeof s.codes !== 'object') s.codes = {}; if (!s.codes.key) s.codes.key = randomKey(); if (s.codes.since == null) s.codes.since = 0; return s.codes; }
  const api = M => (M && M.codes && M.codes.api) || '';
  const live = M => !!api(M);

  /* Grades are the rulebook's acquisition tiers. Restricted work is Restricted; lawful work worth 100+ is Connected; the rest is Street.
     A kit's own grade follows how restricted it is to make. */
  function gradeOf(a, M) {
    if (a.grade) return a.grade;
    if (a.kit) return a.kitGrade === 'corporate' || a.kitGrade === 'restricted' ? 'restricted' : 'street';
    if (a.legality === 'restricted') return 'restricted';
    return num(a.value) >= num(M && M.codes && M.codes.grades && M.codes.grades.connectedValue, 100) ? 'connected' : 'street';
  }
  /* "Staying out" of crime: Heat under 4, and no theft in the last four weeks. Reported by your own PDA. */
  function staysOut(s, aMs) { const c = s.codes || {}; return num(s.stats && s.stats.heat) < 4 && !(c.stoleAt && aMs - c.stoleAt < 28 * DAY); }
  function profile(s, aMs, district) { return { name: (s.character && (s.character.alias || s.character.name)) || '', staysOut: staysOut(s, aMs), district: district || '' }; }
  /* Can someone take this from you right now? */
  function stealable(s, a, M, aMs) { return !!a.stolen || !staysOut(s, aMs) || GRADES.indexOf(gradeOf(a, M)) >= 2; }

  /* A roll the same way the Workshop rolls: attribute + skill dice, 5s and 6s hit. */
  function roll(s, attr, skill, rng = Math.random) {
    const n = Math.max(1, num(s.stats && s.stats[attr], 1) + num(s.skills && s.skills[skill])), dice = [];
    for (let i = 0; i < n; i++) dice.push(1 + Math.floor(rng() * 6));
    return { dice, hits: dice.filter(d => d >= 5).length };
  }

  /* What travels with a code: the item as its card, without its private history. */
  function cardOf(a) { const { events, roll: _r, code, itemId, offered, heatSession, ...rest } = a; return rest; }

  async function post(M, path, body, fetchFn) {
    const f = fetchFn || root.fetch;
    if (!live(M)) return { ok: false, msg: 'Trading isn\'t live yet.' };
    try { const r = await f(api(M).replace(/\/+$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json(); }
    catch (e) { return { ok: false, offline: true, msg: 'Can\'t reach the city\'s ledger right now. Try again when you\'re online.' }; }
  }
  const find = (s, pred) => ((s.make && s.make.artifacts) || []).find(pred) || null;

  /* Give a Workshop item its code (new items only: anything made before codes went live stays code-free). */
  async function mint(s, M, a, aMs, f) {
    const c = ensure(s); if (a.code || a.status !== 'active' || a.kind !== 'item') return { ok: false, msg: 'Nothing to put a code on.' };
    if (c.liveSince && a.created < c.liveSince) return { ok: false, msg: 'This was made before codes existed.' };
    const r = await post(M, '/mint', { key: c.key, profile: profile(s, aMs), card: cardOf(a), grade: gradeOf(a, M), kind: a.kit ? 'kit' : 'item', kitGrade: a.kitGrade || null }, f);
    if (r.ok) { a.code = r.code; a.itemId = r.item.id; a.grade = r.item.grade; a.events.unshift({ at: aMs, text: 'Given a code. Only you can see it until you hand it over.' }); }
    return r;
  }
  async function offer(s, M, a, on, aMs, f) {
    const c = ensure(s); if (!a.itemId) return { ok: false, msg: 'No code yet.' };
    const r = await post(M, '/offer', { key: c.key, itemId: a.itemId, on }, f);
    if (r.ok) { a.offered = !!on; a.events.unshift({ at: aMs, text: on ? 'Offered: the next person to claim the code gets it.' : 'No longer offered.' }); }
    return r;
  }
  /* Claim a code. First try as a gift; if it isn't offered, the answer says so and whether it can be taken.
     Taking it: pass cover = {attribute, skill} and the thief rolls to cover their tracks. */
  async function claim(s, M, code, aMs, opts = {}, f) {
    const c = ensure(s), body = { key: c.key, profile: profile(s, aMs, opts.district), code, intent: opts.take ? 'take' : 'gift' };
    let coverRoll = null; if (opts.take) { coverRoll = roll(s, opts.take.attribute, opts.take.skill, opts.rng); body.cover = coverRoll.hits; }
    const r = await post(M, '/claim', body, f); if (!r.ok || r.already) return { ...r, coverRoll };
    s.make = s.make && typeof s.make === 'object' ? s.make : { v: 1, artifacts: [] }; s.make.artifacts = s.make.artifacts || [];
    const who = (s.character && s.character.name) || 'Someone', card = r.item.card || {};
    const a = { ...card, id: `c-${aMs.toString(36)}-${(s.make.artifacts || []).length}`, owner: who, code: r.code, itemId: r.item.id, grade: r.item.grade, kit: r.item.kind === 'kit' || card.kit, kitGrade: r.item.kitGrade || card.kitGrade,
      status: 'active', stolen: !!r.item.stolen, offered: false, permissions: { use: 'owner', transfer: true },
      events: [{ at: aMs, text: r.theft ? `Taken with its code. You covered your tracks with ${coverRoll.hits} success${coverRoll.hits === 1 ? '' : 'es'}.` : 'Claimed with its code. It\'s yours now.' }] };
    s.make.artifacts.unshift(a);
    if (r.theft) c.stoleAt = aMs;
    return { ...r, artifact: a, coverRoll };
  }
  async function scrub(s, M, kit, item, aMs, f) {
    const c = ensure(s); if (!kit.itemId || !item.itemId) return { ok: false, msg: 'Both need codes first.' };
    const r = await post(M, '/scrub', { key: c.key, kitId: kit.itemId, itemId: item.itemId }, f);
    if (r.ok) {
      item.code = r.code; item.stolen = false; item.offered = false; item.events.unshift({ at: aMs, text: `Scrubbed with ${kit.name}: new code, the old one is dead, and any trail ends here.` });
      kit.status = 'used'; kit.code = null; kit.events.unshift({ at: aMs, text: `Used on ${item.name}.` });
    }
    return r;
  }
  /* Trace something taken from you. Costs a downtime action. */
  async function trace(s, M, a, how, aMs, opts = {}, f) {
    const c = ensure(s), left = s.downtime && s.downtime.actionsRemaining != null ? num(s.downtime.actionsRemaining) : 2;
    if (left < 1) return { ok: false, msg: 'No downtime actions left this gap.' };
    const rr = roll(s, how.attribute, how.skill, opts.rng);
    const r = await post(M, '/trace', { key: c.key, itemId: a.itemId, successes: rr.hits }, f);
    if (r.ok && r.result !== 'cold' && r.result !== 'scrubbed') { s.downtime = s.downtime || {}; s.downtime.actionsRemaining = left - 1; }
    if (r.ok) a.events.unshift({ at: aMs, text: `Traced it (${rr.hits} success${rr.hits === 1 ? '' : 'es'}): ${r.msg}` });
    return { ...r, roll: rr };
  }
  async function retire(s, M, a, f) { if (!a.itemId) return { ok: true }; const c = ensure(s); return post(M, '/retire', { key: c.key, itemId: a.itemId }, f); }

  /* News from the ledger: things of yours that were claimed or taken. Returns lines for a toast or mail. */
  async function sync(s, M, aMs, f) {
    const c = ensure(s); if (!live(M)) return { ok: false, lines: [] };
    const r = await post(M, '/inbox', { key: c.key, profile: profile(s, aMs), since: c.since }, f); if (!r.ok) return { ...r, lines: [] };
    const lines = [];
    for (const e of r.events || []) {
      c.since = Math.max(c.since, e.seq || 0);
      const a = find(s, x => x.itemId === e.itemId && x.status === 'active'); if (!a) continue;
      a.status = e.kind === 'taken' ? 'taken' : 'given'; a.offered = false; a.events.unshift({ at: aMs, text: e.text }); lines.push(e.text);
    }
    return { ok: true, lines, held: r.held };
  }

  const api_ = { GRADES, GRADE_NAMES, ensure, live, gradeOf, staysOut, profile, stealable, roll, cardOf, mint, offer, claim, scrub, trace, retire, sync };
  if (typeof module !== 'undefined' && module.exports) module.exports = api_; else root.GRAKK_CODES = api_;
})(typeof window !== 'undefined' ? window : globalThis);
