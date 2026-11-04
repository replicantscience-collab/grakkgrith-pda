/* The Job Board: the rulebook's real jobs (Chapter Eighteen), run with Chapter Nine's structure.
   Client, Objective, Complication, Payment, Heat Cost. Payment is fixed when you take it.
   Complications come in three tiers: Known (d6, before), Emerging (d8, during), the Twist (d6, late).
   The board and every complication roll are seeded by the Adyta day and job, so the whole crew sees the same thing.
   Closing a job applies base Heat + execution Heat (the book's guidance), pay, and a Mark.
   Pure logic (window.GRAKK_JOBS). State lives in the character file under state.jobs. J = data/jobs.json. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const die = (rng, n) => 1 + Math.floor(rng() * n);
  const heatCap = lvl => { lvl = num(lvl); return lvl >= 17 ? 8 : lvl >= 7 ? 7 : 6; };
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  function addHeat(s, n) { s.stats = s.stats || {}; s.stats.heat = String(clamp(num(s.stats.heat) + n, 0, heatCap(s.character && s.character.level))); }
  const WK = () => root.GRAKK_WEEK;

  function ensure(s) { if (!s.jobs || typeof s.jobs !== 'object' || Array.isArray(s.jobs)) s.jobs = { v: 1, taken: [], list: [] }; s.jobs.taken = s.jobs.taken || []; s.jobs.list = s.jobs.list || []; return s.jobs; }
  function comp(J, tier, roll) { const t = J.complications[tier], c = t.list[roll - 1]; return { tier, name: c[0], text: c[1], roll, die: t.die, label: t.name }; }

  /* The day's board: the same for everyone on the crew. */
  function board(J, PL, aMs, s) {
    const day = Math.floor(aMs / DAY), rng = seeded(hash(`jobs|${day}`)), pool = J.jobs.slice(), out = [], taken = new Set(s ? ensure(s).taken : []);
    const places = PL.places.filter(p => PL.districts[p.district]);
    for (let i = 0; i < J.board.perDay && pool.length; i++) {
      const t = pool.splice(Math.floor(rng() * pool.length), 1)[0], id = `job-${day}-${i}`;
      const place = places[Math.floor(rng() * places.length)], client = t.clients[Math.floor(rng() * t.clients.length)];
      const known = comp(J, 'known', die(rng, J.complications.known.die));
      let pay = null;
      if (t.payKind === 'credits') pay = Math.round((t.pay[0] + rng() * (t.pay[1] - t.pay[0])) / 10) * 10;
      const baseHeat = Math.max(t.baseHeat, J.heat.raiseTo2.includes(known.name) ? 2 : 0);
      out.push({ id, job: t.id, title: t.title, category: t.category, text: t.text, bookComplications: t.complications, pays: t.pays, payKind: t.payKind, pendingPay: t.pendingPay,
        pay, percent: t.payKind === 'percent' ? t.pay : null, client, known, baseHeat,
        place: { district: place.district, place: place.id, name: place.name, districtName: PL.districts[place.district].name }, taken: taken.has(id) });
    }
    return out;
  }
  function take(s, J, PL, id, aMs) {
    const j = board(J, PL, aMs, s).find(x => x.id === id); if (!j || j.taken) return { ok: false, msg: 'That job is gone.' };
    const st = ensure(s), who = (s.character && s.character.name) || 'Someone';
    st.taken = [id, ...st.taken].slice(0, 40);
    st.list.unshift({ ...j, status: 'taken', took: aMs, by: who, emerging: null, twist: null, events: [{ at: aMs, text: `${who} took it. ${j.pay != null ? `Pay fixed at ${j.pay} cr.` : j.percent ? `Pay: ${j.percent[0]}-${j.percent[1]}% of the item's value, plus expenses.` : 'Pay: whatever they can give.'} Known complication: ${j.known.name}. Base Heat ${j.baseHeat}.` }] });
    st.list.length = Math.min(st.list.length, 40);
    return { ok: true, msg: `Taken. Payment is fixed now and non-negotiable after.` };
  }
  const find = (s, id) => ensure(s).list.find(x => x.id === id) || null;
  /* Reveals are seeded by the job, so everyone who took the same posting gets the same surprise. */
  function start(s, J, id, aMs) {
    const j = find(s, id); if (!j || j.status !== 'taken') return { ok: false };
    j.status = 'on'; j.emerging = comp(J, 'emerging', die(seeded(hash(`${j.id}|emerging`)), J.complications.emerging.die));
    j.events.unshift({ at: aMs, text: `On the job. Emerging complication: ${j.emerging.name}.` });
    return { ok: true, msg: `${j.emerging.name}: ${j.emerging.text}` };
  }
  function twist(s, J, id, aMs) {
    const j = find(s, id); if (!j || j.status !== 'on' || j.twist) return { ok: false };
    j.twist = comp(J, 'twist', die(seeded(hash(`${j.id}|twist`)), J.complications.twist.die));
    let msg = `${j.twist.name}: ${j.twist.text}`;
    if (j.twist.name === 'Someone Knows') { addHeat(s, J.heat.someoneKnows); msg += ` Heat +${J.heat.someoneKnows} now.`; }
    j.events.unshift({ at: aMs, text: `The twist: ${j.twist.name}.${j.twist.name === 'Someone Knows' ? ` Heat +${J.heat.someoneKnows}.` : ''}` });
    return { ok: true, msg };
  }
  /* outcome: success | partial | failed. execution: list of execution-Heat tiers that happened (1-4). paid: for percent/varies jobs. */
  function close(s, J, id, o, aMs) {
    const j = find(s, id); if (!j || !['taken', 'on'].includes(j.status)) return { ok: false, msg: 'Nothing to close.' };
    const outcome = ['success', 'partial', 'failed'].includes(o.outcome) ? o.outcome : 'success';
    const exec = (o.execution || []).map(Number).filter(n => n >= 1 && n <= 4), heat = j.baseHeat + exec.reduce((a, b) => a + b, 0);
    let pay = j.pay != null ? j.pay : Math.max(0, Math.round(num(o.paid)));
    if (outcome === 'partial' && j.pay != null) pay = Math.round(pay * J.outcome.partialPay); if (outcome === 'failed') pay = 0;
    addHeat(s, heat); if (pay) setCredits(s, credits(s) + pay);
    let marks = 0; if (outcome !== 'failed') { s.downtime = s.downtime || {}; s.downtime.marks = num(s.downtime.marks) + J.outcome.marks; marks = J.outcome.marks; }
    j.status = outcome === 'failed' ? 'failed' : 'done'; j.outcome = outcome; j.closed = aMs; j.result = { heat, base: j.baseHeat, execution: exec, pay, marks, note: String(o.note || '').slice(0, 300) };
    const line = `${outcome === 'success' ? 'Done' : outcome === 'partial' ? 'Partly done' : 'Failed'}. Heat +${heat} (base ${j.baseHeat}${exec.length ? ` + ${exec.join(' + ')} execution` : ''}). ${pay ? `Paid ${pay} cr.` : 'No pay.'}${marks ? ` +${marks} Mark.` : ''}`;
    j.events.unshift({ at: aMs, text: line + (j.result.note ? ` ${j.result.note}` : '') });
    const wk = WK(); if (wk) wk.inform(s, aMs, j.client, `Job closed: ${j.title}`, line);
    return { ok: true, msg: line, heat, pay };
  }
  function drop(s, id, aMs) { const j = find(s, id); if (!j || !['taken', 'on'].includes(j.status)) return { ok: false }; j.status = 'dropped'; j.events.unshift({ at: aMs, text: 'Walked away from it.' }); return { ok: true, msg: 'Dropped. The client will remember.' }; }
  function active(s) { return ensure(s).list.filter(j => ['taken', 'on'].includes(j.status)); }

  root.GRAKK_JOBS = { ensure, board, take, start, twist, close, drop, active };
})(typeof window !== 'undefined' ? window : globalThis);
