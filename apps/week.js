/* The Week: bills on the live Adyta clock, Debt, and Heat mail.
   Pure logic, no page access. Works in the browser (window.GRAKK_WEEK) and in Node (module.exports) so it can be tested.
   Everything it changes lives in the character file under state.week, so it saves, exports and imports with the character.
   W = data/week.json, clock = places.json clock. */
(function (root) {
  'use strict';
  const DAY = 86400000, WEEK = 7 * DAY;
  const MONDAY0 = Date.UTC(1970, 0, 5);                     // a Monday, 00:00
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---------- Adyta time (the same clock Explore uses) ---------- */
  function clockOffset(clock) { return Date.parse(clock.anchorAdyta + 'Z') - Date.parse(clock.anchorReal); }
  function adytaNow(clock, realMs) { return realMs + clockOffset(clock); }   // read with getUTC* fields
  function weekIndex(aMs) { return Math.floor((aMs - MONDAY0) / WEEK); }
  function weekStart(idx) { return MONDAY0 + idx * WEEK; }
  function fmt(aMs) {
    const d = new Date(aMs), days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let h = d.getUTCHours(); const m = String(d.getUTCMinutes()).padStart(2, '0'), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${days[d.getUTCDay()]} ${d.getUTCMonth() + 1}/${d.getUTCDate()} ${h}:${m} ${ap}`;
  }
  function untilText(ms) {
    if (ms <= 0) return 'overdue';
    const h = Math.floor(ms / 3600000), dd = Math.floor(h / 24);
    return dd >= 1 ? `${dd}d ${h % 24}h left` : h >= 1 ? `${h}h left` : `${Math.max(1, Math.floor(ms / 60000))}m left`;
  }

  /* ---------- small helpers ---------- */
  function rollDice(n, rng) { const r = []; for (let i = 0; i < Math.max(0, n); i++) r.push(1 + Math.floor(rng() * 6)); return r; }
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const uid = (p, aMs, n) => `${p}-${aMs.toString(36)}-${n}`;
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  const heat = s => num(s.stats && s.stats.heat);
  const heatCap = lvl => { lvl = num(lvl); return lvl >= 17 ? 8 : lvl >= 7 ? 7 : 6; };
  const stressCap = lvl => num(lvl) >= 12 ? 8 : 6;
  function addHeat(s, n) { s.stats = s.stats || {}; const cap = heatCap(s.character && s.character.level); s.stats.heat = String(clamp(heat(s) + n, 0, cap)); }
  function band(W, h) { return (W.heatBands.find(b => h >= b.min && h <= b.max) || W.heatBands[W.heatBands.length - 1]).id; }
  const bandRank = id => ['clean', 'scrutiny', 'attention', 'crisis'].indexOf(id);
  function fill(t, ctx) { return String(t || '').replace(/\{(\w+)\}/g, (_, k) => ctx[k] != null ? ctx[k] : ''); }
  function homeTerritory(s) {
    const g = s.character && s.character.grith, rel = s.cityRelations || {};
    const id = Object.keys(rel).find(k => rel[k] && rel[k].relationship === 'Grith');
    return id || g || '';
  }

  /* ---------- state ---------- */
  function defaults(s) {
    const life = (s.character && s.character.life) || '';
    return { v: 1, housing: /Corporate Agent|On the Books/.test(life) ? 'mixed' : /Edge Dweller/.test(life) ? 'none' : 'commons',
      gear: 'light', chrome: 'none', lastWeek: null, band: 'clean', mail: [], debts: [], log: [], sessionsStarted: 0 };
  }
  function ensure(s) { if (!s.week || typeof s.week !== 'object') s.week = defaults(s); const w = s.week; for (const [k, v] of Object.entries(defaults(s))) if (w[k] === undefined) w[k] = v; return w; }
  function log(w, aMs, text) { w.log.unshift({ at: aMs, text }); w.log.length = Math.min(w.log.length, 60); }
  function costRow(list, id) { return list.find(x => x.id === id) || list[0]; }
  function billLines(W, w) {
    const h = costRow(W.week.housing, w.housing), g = costRow(W.week.gear, w.gear), c = costRow(W.week.chrome, w.chrome);
    return [{ name: h.name, credits: h.credits }, { name: W.week.food.name, credits: W.week.food.credits }, { name: g.name, credits: g.credits }, { name: c.name, credits: c.credits }].filter(l => l.credits > 0);
  }
  function weeklyTotal(W, w) { return billLines(W, w).reduce((a, l) => a + l.credits, 0); }

  /* ---------- notices ---------- */
  function pickNotice(W, s, bandId, aMs) {
    const list = W.notices[bandId] || []; if (!list.length) return null;
    const open = new Set(s.week.mail.filter(m => m.status === 'open').map(m => m.noticeId));
    const seed = hash(`${(s.character && s.character.name) || ''}|${bandId}|${aMs}`);
    for (let i = 0; i < list.length; i++) { const n = list[(seed + i) % list.length]; if (!open.has(n.id)) return n; }
    return null;
  }
  function issueNotice(W, s, bandId, aMs, why) {
    const w = s.week, n = pickNotice(W, s, bandId, aMs); if (!n) return null;
    const ctx = { investigator: W.investigators[hash((s.character && s.character.name) || 'x') % W.investigators.length], creditor: costRow(W.week.housing, w.housing).creditor || 'Your landlord' };
    const crisis = bandId === 'crisis';
    const m = { id: uid('n', aMs, w.mail.length), kind: crisis ? 'crisis' : 'notice', noticeId: n.id, band: bandId, from: fill(n.from, ctx), title: fill(n.title, ctx), body: fill(n.body, ctx),
      issued: aMs, due: crisis ? null : aMs + (n.days || 3) * DAY, fine: n.fine || 0, appeal: !!n.appeal, appealed: false,
      check: n.check ? { ...n.check, success: fill(n.check.success, ctx), fail: fill(n.check.fail, ctx) } : null, step: 0, status: 'open', why };
    w.mail.unshift(m);
    log(w, aMs, crisis ? `Crisis: ${m.title} (${m.from}). It lands before the next session ends unless disrupted.` : `Mail: ${m.title} from ${m.from}.`);
    return m;
  }

  /* ---------- settle: run the clock forward ---------- */
  function settle(s, W, clock, realMs, rng = Math.random) {
    const w = ensure(s), now = adytaNow(clock, realMs), cur = weekIndex(now), events = [];
    // 1. Bills for each new week (a long absence bills at most maxCatchUpWeeks; the rest is waived)
    const fresh = w.lastWeek == null;   // a brand-new file starts its first bill now, not back on Monday
    if (fresh) w.lastWeek = cur - 1;
    const missed = cur - w.lastWeek;
    if (missed > 0) {
      const from = Math.max(w.lastWeek + 1, cur - W.week.maxCatchUpWeeks + 1);
      if (from > w.lastWeek + 1) { log(w, now, `You were away ${missed} weeks. The city billed the last ${W.week.maxCatchUpWeeks}.`); }
      for (let k = from; k <= cur; k++) {
        const lines = billLines(W, w), total = lines.reduce((a, l) => a + l.credits, 0), start = fresh ? now : weekStart(k);
        if (total > 0) { const b = { id: uid('b', start, k), kind: 'bill', week: k, from: 'Cost of living', title: `Week of ${fmt(weekStart(k)).split(' ').slice(0, 2).join(' ')}`, lines, total, issued: start, due: start + W.week.billDueDays * DAY, creditor: costRow(W.week.housing, w.housing).creditor || 'The city', status: 'open' }; w.mail.unshift(b); events.push(b); log(w, start, `Bills: ${total} credits due.`); }
        // Weekly Heat mail: the system keeps noticing you while Heat is 2+ (crisis is not reissued weekly)
        // (only once you were already in that band; rising into a band is handled below)
        const b2 = band(W, heat(s));
        if (bandRank(w.band) >= 1 && bandRank(b2) >= 1 && bandRank(b2) <= 2) { const m = issueNotice(W, s, b2, start + 3600000, `Heat ${heat(s)}: weekly attention`); if (m) events.push(m); }
      }
      w.lastWeek = cur;
    }
    // 2. Deadlines
    for (const m of [...w.mail]) {
      if (m.status !== 'open' || m.due == null || now < m.due) continue;
      if (m.kind === 'bill') { m.status = 'unpaid'; openDebt(s, m.creditor, m.total, now, `Unpaid bills, ${m.title}`); events.push(m); }
      else if (m.kind === 'notice') escalate(W, s, m, now, events);
    }
    // 3. Heat band changes: rising into a new band sends mail right away
    const b = band(W, heat(s));
    if (bandRank(b) > bandRank(w.band)) { const m = issueNotice(W, s, b, now, `Heat rose to ${heat(s)}`); if (m) events.push(m); }
    w.band = b;
    return events;
  }
  function escalate(W, s, m, now, events) {
    const E = W.notices.escalation;
    addHeat(s, E.heat);
    if (m.step < E.steps.length) {
      m.status = 'escalated';
      const n = { ...m, id: uid('n', now, s.week.mail.length), step: m.step + 1, title: `${E.steps[m.step]}: ${m.title.replace(/^(Second|Final) Notice: /, '')}`, fine: Math.round((m.fine || 0) * E.fineMult), issued: now, due: now + 2 * DAY, status: 'open', appealed: m.appealed, why: 'Ignored past its deadline' };
      s.week.mail.unshift(n); events.push(n);
      log(s.week, now, `Ignored: ${m.title}. Heat +${E.heat}. ${n.title} arrives.`);
    } else {
      m.status = 'escalated';
      if (m.fine) openDebt(s, m.from, m.fine, now, `Unpaid: ${m.title}`);
      log(s.week, now, `Final notice ignored: ${m.title}. Heat +${E.heat}${m.fine ? `, ${m.fine} credits become Debt with ${m.from}` : ''}.`);
      events.push(m);
    }
  }
  function openDebt(s, creditor, amount, aMs, why) {
    const w = s.week; let d = w.debts.find(x => x.creditor === creditor && x.amount > 0);
    if (d) { d.amount += amount; }
    else {
      d = { id: uid('d', aMs, w.debts.length), creditor, amount, since: aMs, why }; w.debts.push(d);
      // Rulebook: -1 Standing with anyone you owe. Landlords are local, so it lands on your home territory.
      const t = homeTerritory(s), rel = s.cityRelations && s.cityRelations[t];
      if (rel) { rel.standing = String(clamp(num(rel.standing, 3) - 1, 0, 5)); d.standingHit = t; }
    }
    log(w, aMs, `Debt: ${amount} credits to ${creditor}.${d.standingHit ? ` Standing -1 in ${d.standingHit}.` : ''} 1 Stress each session until cleared.`);
  }

  /* ---------- player actions ---------- */
  function find(s, id) { return ensure(s).mail.find(m => m.id === id) || null; }
  function pay(s, id, aMs) {
    const m = find(s, id); if (!m || m.status !== 'open') return { ok: false, msg: 'Nothing to pay.' };
    const amt = m.kind === 'bill' ? m.total : m.fine; if (!amt) return { ok: false, msg: 'There is no fee on this one.' };
    if (credits(s) < amt) return { ok: false, msg: `You need ${amt} credits and have ${credits(s)}.` };
    setCredits(s, credits(s) - amt); m.status = 'paid'; m.closed = aMs;
    log(s.week, aMs, `Paid ${amt} credits: ${m.title}.`); return { ok: true, msg: `Paid ${amt} credits.` };
  }
  function pool(s, attribute, skill, extra = 0) { return Math.max(1, num(s.stats && s.stats[attribute]) + num(s.skills && s.skills[skill]) + extra); }
  function appeal(s, W, id, aMs, rng = Math.random) {
    const m = find(s, id); if (!m || m.status !== 'open' || !m.appeal || m.appealed) return { ok: false, msg: 'This one cannot be appealed.' };
    const A = W.appeal, warden = (s.character && s.character.class) === 'Warden', dice = rollDice(pool(s, 'savvy', 'persuade', warden ? A.wardenBonus : 0), rng), hits = dice.filter(d => d >= 5).length;
    m.appealed = true; m.appealRoll = { dice, hits, need: A.difficulty };
    if (hits >= A.difficulty) { m.status = 'voided'; m.closed = aMs; log(s.week, aMs, `APA appeal won (${hits} successes): ${m.title} voided.`); return { ok: true, won: true, dice, hits, msg: `Appeal won with ${hits} successes. Notice voided.` }; }
    log(s.week, aMs, `APA appeal lost (${hits}/${A.difficulty}): ${m.title} stands.`); return { ok: true, won: false, dice, hits, msg: `Appeal lost: ${hits} of ${A.difficulty} successes. The notice stands.` };
  }
  function answer(s, id, aMs, rng = Math.random) {
    const m = find(s, id); if (!m || m.status !== 'open' || !m.check) return { ok: false, msg: 'Nothing to answer.' };
    const c = m.check, dice = rollDice(pool(s, c.attribute, c.skill), rng), hits = dice.filter(d => d >= 5).length;
    m.checkRoll = { dice, hits, need: c.difficulty }; m.closed = aMs;
    if (hits >= c.difficulty) { m.status = 'answered'; log(s.week, aMs, `${m.title}: ${c.success}`); return { ok: true, won: true, dice, hits, msg: c.success }; }
    m.status = 'answered'; addHeat(s, c.failHeat || 0); log(s.week, aMs, `${m.title}: ${c.fail} Heat +${c.failHeat || 0}.`);
    return { ok: true, won: false, dice, hits, msg: `${c.fail} Heat +${c.failHeat || 0}.` };
  }
  function payDebt(s, id, aMs, amount) {
    const w = ensure(s), d = w.debts.find(x => x.id === id); if (!d || d.amount <= 0) return { ok: false, msg: 'No such debt.' };
    const amt = Math.min(d.amount, amount == null ? d.amount : Math.max(1, Math.round(amount)));
    if (credits(s) < amt) return { ok: false, msg: `You need ${amt} credits and have ${credits(s)}.` };
    setCredits(s, credits(s) - amt); d.amount -= amt;
    if (d.amount <= 0) { d.cleared = aMs; log(w, aMs, `Debt to ${d.creditor} cleared.`); w.debts = w.debts.filter(x => x.amount > 0); return { ok: true, msg: `Debt to ${d.creditor} cleared.` }; }
    log(w, aMs, `Paid ${amt} toward ${d.creditor}. ${d.amount} left.`); return { ok: true, msg: `${d.amount} credits still owed.` };
  }
  function acknowledgeCrisis(s, id, aMs) { const m = find(s, id); if (!m || m.kind !== 'crisis' || m.status !== 'open') return { ok: false }; m.status = 'flagged'; m.closed = aMs; log(s.week, aMs, `Crisis flagged for the session: ${m.title}.`); return { ok: true }; }
  /* Rulebook: Debt costs 1 Stress per session. "Session starting" applies it once. */
  function sessionStart(s, aMs) {
    const w = ensure(s), owed = w.debts.filter(d => d.amount > 0);
    w.sessionsStarted++;
    if (!owed.length) { log(w, aMs, 'Session started. No debt pressure.'); return { stress: 0 }; }
    s.stats = s.stats || {}; const before = num(s.stats.stress); s.stats.stress = String(clamp(before + 1, 0, stressCap(s.character && s.character.level)));
    log(w, aMs, `Session started. Debt to ${owed.map(d => d.creditor).join(', ')}: Stress +1.`); return { stress: num(s.stats.stress) - before };
  }
  function setCosts(s, patch) { const w = ensure(s); for (const k of ['housing', 'gear', 'chrome']) if (patch[k]) w[k] = patch[k]; }
  function pending(s) { const w = s && s.week; if (!w) return 0; return w.mail.filter(m => m.status === 'open').length; }
  function owed(s) { const w = s && s.week; return w ? w.debts.reduce((a, d) => a + Math.max(0, d.amount), 0) : 0; }

  const api = { DAY, WEEK, clockOffset, adytaNow, weekIndex, weekStart, fmt, untilText, band, heatCap, ensure, billLines, weeklyTotal, settle, pay, appeal, answer, payDebt, acknowledgeCrisis, sessionStart, setCosts, pending, owed, issueNotice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GRAKK_WEEK = api;
})(typeof window !== 'undefined' ? window : globalThis);
