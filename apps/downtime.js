/* A Night Out: downtime as short scenes. Pure logic, no page access; works in the browser (window.GRAKK_NIGHT)
   and in Node (module.exports) so it can be tested.
   D = data/downtime.json, P = data/places.json, E = a GRAKK_ENGINE for this character, WK = GRAKK_WEEK.
   Everything lives in the character file under state.downtime (marks, actionsRemaining, history, leads, night).
   SAFE is the rulebook action as written. BOLD adds a bonus on a win and a cost on a loss; it is always opt-in.
   Floors: downtime never adds Wounds, a cost you can't pay becomes Debt (not a refusal), nothing goes past its cap,
   and at full Stress only safe choices and no Push. */
(function (root) {
  'use strict';
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ACTIONS = ['layLow', 'workContact', 'recover', 'community', 'research', 'sideJob'];
  const RANK_NAMES = ['Untrained', 'Novice', 'Trained', 'Expert', 'Mastery'], TRAIN_LEVEL = [1, 1, 2, 11, 16];

  /* District ids (places.json) and territory ids (rules.json) name the same places two ways. */
  const TERR_ALIAS = { tangle: 'the-tangle', ashrun: 'the-ashrun', sewers: 'the-sewers', southern_industrial: 'southern-industrial-belt' };
  const territoryToDistrict = t => TERR_ALIAS[t] || String(t || '').replace(/_/g, '-');
  const districtToTerritory = d => { const hit = Object.entries(TERR_ALIAS).find(([, v]) => v === d); return hit ? hit[0] : String(d || '').replace(/-/g, '_'); };

  function ensure(s) {
    const d = s.downtime && typeof s.downtime === 'object' ? s.downtime : (s.downtime = {});
    if (d.actionsRemaining === undefined) d.actionsRemaining = 2;
    if (d.marks === undefined) d.marks = 0;
    if (!Array.isArray(d.history)) d.history = [];
    if (!Array.isArray(d.leads)) d.leads = [];
    if (d.night === undefined) d.night = null;
    return d;
  }
  /* Your grith and grithrakt, as district ids. */
  function ground(s) {
    const rel = s.cityRelations || {}, out = { grith: null, rakt: [] };
    for (const [t, r] of Object.entries(rel)) { if (!r) continue; if (r.relationship === 'Grith') out.grith = territoryToDistrict(t); else if (r.relationship === 'Grithrakt') out.rakt.push(territoryToDistrict(t)); }
    if (!out.grith && s.character && s.character.grith) out.grith = territoryToDistrict(String(s.character.grith).toLowerCase().replace(/^the /, '').replace(/\s+/g, '_'));
    return out;
  }
  /* Districts you can spend a night in: those with a dossier, your grith first. */
  function districts(s, P) {
    const g = ground(s), list = Object.entries(P.districts).filter(([, v]) => v.dossier).map(([id, v]) => ({ id, name: v.name, tagline: v.tagline, grith: id === g.grith, rakt: g.rakt.includes(id) }));
    return list.sort((a, b) => (b.grith - a.grith) || (b.rakt - a.rakt) || a.name.localeCompare(b.name));
  }

  function pick(list, rng) { return list[Math.floor(rng() * list.length) % list.length]; }
  function firstOf(text) { return String(text || '').split(/;|,(?![^(]*\))/)[0].replace(/\.$/, '').trim(); }
  function ctx(s, P, districtId, rng) {
    const v = P.districts[districtId] || {}, d = v.dossier || {}, places = (P.places || []).filter(p => p.district === districtId);
    return { district: v.name || districtId, place: places.length ? pick(places, rng).name : (v.name || 'the block'), faction: firstOf(d.factions) || 'the people in charge', hazard: firstOf(d.hazards).toLowerCase() || 'the usual trouble', wisdom: d.wisdom || 'Nobody here is in a hurry tonight.', mood: d.mood || '', name: (s.character && (s.character.alias || s.character.name)) || 'You' };
  }
  const fill = (t, c) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => c[k] != null ? c[k] : '');

  /* ---------- the night ---------- */
  function startNight(s, P, districtId, aMs) {
    const d = ensure(s); if (!P.districts[districtId]) return { ok: false, message: 'Pick a district.' };
    if (d.actionsRemaining <= 0) return { ok: false, message: 'No downtime actions left this gap.' };
    const g = ground(s);
    d.night = { district: districtId, at: aMs, inGrith: g.grith === districtId, scenes: [], pending: null };
    return { ok: true };
  }
  /* Before dawn still counts as the night before: 5 AM Friday is Thursday night. */
  function nightName(D, aMs) { return D.nightNames[new Date(aMs - 6 * 3600000).getUTCDay()]; }

  /* A scene for an action: the situation and both choices, with the dice each would roll. */
  function scene(s, D, P, E, actionId, rng = Math.random) {
    const n = ensure(s).night; if (!n) return null;
    if (actionId === 'favor') return favorScene(s, D, P, E, rng);
    const A = D.actions[actionId]; if (!A) return null;
    const c = ctx(s, P, n.district, rng);
    let text = pick(A.situations, rng), job = null;
    if (actionId === 'sideJob') { job = D.classJobs[s.character && s.character.class] || D.classJobs._any; text = job.text; }
    const side = which => { const o = A[which]; const chk = actionId === 'sideJob' ? { attr: job.attr, skill: job.skill, diff: o.diff } : o.check; return { label: o.label, check: chk ? { ...chk, pool: poolFor(E, chk), diffName: D.difficulties[String(chk.diff)] } : null, pay: o.pay || 0 }; };
    const full = num(s.stats && s.stats.stress) >= E.stressCap(s.character && s.character.level);
    return { action: actionId, name: A.name, rule: A.rule, text: fill(text, c), safe: side('safe'), bold: { ...side('bold'), locked: full ? 'Stress is full. Only safe choices tonight.' : '' }, district: c.district, inGrith: n.inGrith };
  }
  /* A landlord's favor (The Hive: Ma Dresk). Three ways to do it; any of them settles the late rent. */
  function owedFavor(s, D) { const w = s.week; const m = w && (w.mail || []).find(x => x.kind === 'bill' && x.status === 'open' && x.favor && !x.favor.done && D.favors && D.favors[x.creditor]); return m || null; }
  function favorScene(s, D, P, E, rng) {
    const bill = owedFavor(s, D); if (!bill) return null;
    const F = D.favors[bill.creditor], place = (P.places || []).find(p => p.id === F.place), home = place ? place.district : s.downtime.night.district;
    const side = k => { const o = F.options[k]; return { kicker: o.kicker, label: o.label, check: { ...o.check, pool: poolFor(E, o.check), diffName: D.difficulties[String(o.check.diff)] } }; };
    const sc = { action: 'favor', favorKey: bill.creditor, bill: bill.id, home, name: F.name, rule: F.rule, text: pick(F.situations, rng), choices: Object.keys(F.options), district: (P.districts[home] || {}).name || home, inGrith: s.downtime.night.inGrith };
    for (const k of sc.choices) sc[k] = side(k);
    return sc;
  }
  function poolFor(E, chk) { const ctxName = ['muscle', 'reflex'].includes(chk.attr) ? 'physical' : chk.attr === 'savvy' ? 'social' : 'general'; return E.buildPool(chk.attr, Math.min(3, E.skillRankRaw(chk.skill)), ctxName, 0, 0, chk.skill); }

  /* Roll: the dice are saved straight away, so reloading the page can't reroll them. */
  function roll(s, D, P, E, sc, choice, rng = Math.random) {
    const n = ensure(s).night; if (!n || n.pending) return { ok: false, message: n && n.pending ? 'Finish the roll in front of you first.' : 'Start the night first.' };
    if (choice === 'bold' && sc.bold && sc.bold.locked) return { ok: false, message: sc.bold.locked };
    const side = sc[choice]; if (!side) return { ok: false, message: 'Pick safe or bold.' };
    const pending = { action: sc.action, name: sc.name, text: sc.text, choice, label: side.kicker ? side.kicker + ': ' + side.label : side.label, check: side.check, pay: side.pay, dice: [], pushed: false, favorKey: sc.favorKey, bill: sc.bill, home: sc.home };
    if (side.check) { const rnd = () => 1 + Math.floor(rng() * 6); pending.dice = Array.from({ length: side.check.pool.total }, rnd); }
    n.pending = pending;
    return { ok: true, pending: view(pending, E) };
  }
  function tierOf(p, E) {
    if (!p.check) return { tier: 'win', successes: 0, over: 0, kind: 'Done' };
    const succ = E.countSuccesses(p.dice), o = E.outcomeForCheck(succ, p.check.diff);
    const tier = /Critical|^Success/.test(o.kind) ? 'win' : o.kind === 'Partial Success' ? 'partial' : 'lose';
    return { tier, successes: succ, over: Math.max(0, succ - p.check.diff), kind: o.kind };
  }
  const view = (p, E) => ({ ...p, ...tierOf(p, E), canPush: !!p.check && !p.pushed && E.canPush() });
  function pending(s, E) { const n = s.downtime && s.downtime.night; return n && n.pending ? view(n.pending, E) : null; }
  /* Push: +2 dice for 1 Stress, once, before you accept. */
  function push(s, E, rng = Math.random) {
    const n = ensure(s).night, p = n && n.pending; if (!p || !p.check || p.pushed) return { ok: false, message: 'Nothing to push.' };
    if (!E.canPush()) return { ok: false, message: 'Stress is full. You can\'t push tonight.' };
    s.stats.stress = String(num(s.stats.stress) + 1);
    p.dice = p.dice.concat([1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)]); p.pushed = true;
    return { ok: true, pending: view(p, E) };
  }

  /* Accept: apply the outcome, spend the action, write it down. */
  function accept(s, D, P, E, WK, aMs) {
    const d = ensure(s), n = d.night, p = n && n.pending; if (!p) return { ok: false, message: 'Nothing to accept.' };
    const A = p.action === 'favor' ? D.favors[p.favorKey].options : D.actions[p.action], t = tierOf(p, E), o = p.check ? A[p.choice][t.tier] : A[p.choice];
    const effects = { ...(o.effects || {}) };
    if (p.action === 'sideJob') { const base = A[p.choice].pay, per = A[p.choice].perExtra; effects.credits = (effects.credits || 0) + (t.tier === 'win' ? base + per * t.over : t.tier === 'partial' ? Math.round(base / 2) : 0); }
    if (p.action === 'favor') effects.standingIn = p.home;
    const lines = applyEffects(s, P, WK, E, effects, n, aMs);
    if (p.action === 'favor') { const r = WK.favorDone(s, p.bill, aMs, A[p.choice].kicker); lines.push(r.ok ? `Rent settled with ${p.favorKey}.` : r.msg); }
    const entry = { at: aMs, district: n.district, action: p.action, name: p.name, choice: p.choice, label: p.label, text: p.text, outcome: o.text || A[p.choice].text || '', tier: t.tier, kind: t.kind, dice: p.dice, pushed: p.pushed, diff: p.check ? p.check.diff : null, successes: t.successes, effects: lines };
    n.scenes.push(entry); n.pending = null; d.actionsRemaining = Math.max(0, d.actionsRemaining - 1);
    d.history.unshift({ action: p.action, label: p.name, detail: `${p.choice === 'bold' ? 'Bold: ' : p.choice === 'safe' ? 'Safe: ' : ''}${p.label} ${o.text || ''} ${lines.join(' ')}`.trim(), time: aMs, location: n.district });
    d.history = d.history.slice(0, 40);
    return { ok: true, entry };
  }

  function territoryOf(s, districtId) { const t = districtToTerritory(districtId); s.cityRelations = s.cityRelations || {}; if (!s.cityRelations[t]) s.cityRelations[t] = { relationship: 'Skott', standing: '3', notes: '' }; return s.cityRelations[t]; }
  function applyEffects(s, P, WK, E2, fx, n, aMs) {
    const out = [], st = s.stats = s.stats || {}, lvl = s.character && s.character.level; /* caps come from the shared engine */
    if (fx.heat !== undefined) { const delta = fx.heat === 'layLow' ? -(n.inGrith ? 2 : 1) : num(fx.heat); const a = num(st.heat), b = clamp(a + delta, 0, E2.heatCap(lvl)); st.heat = String(b); if (a !== b) out.push(`Heat ${a} → ${b}.`); else if (delta > 0) out.push('Heat is already at its cap.'); }
    if (fx.stress !== undefined) { const delta = fx.stress === 'community' ? -(n.inGrith ? 3 : 2) : num(fx.stress); const a = num(st.stress), b = clamp(a + delta, 0, E2.stressCap(lvl)); st.stress = String(b); if (a !== b) out.push(`Stress ${a} → ${b}.`); }
    if (fx.recover) for (let i = 0; i < fx.recover; i++) {
      const w = num(st.woundState); if (w > 0) { st.woundState = String(w - 1); out.push(`Wounds ${w} → ${w - 1}.`); continue; }
      const k = st.condition2 ? 'condition2' : st.condition1 ? 'condition1' : ''; if (k) { out.push(`Cleared ${st[k]}.`); st[k] = ''; continue; }
      if (i === 0) out.push('Nothing left to heal. You slept well, at least.');
      break;
    }
    if (fx.standing) { const sd = fx.standingIn || n.district, r = territoryOf(s, sd), a = num(r.standing, 3), b = clamp(a + fx.standing, 0, 5); r.standing = String(b); const nm = (P.districts[sd] || {}).name || sd; out.push(a !== b ? `Standing in ${nm} ${a} → ${b}.` : `Standing in ${nm} is already ${a}.`); }
    if (fx.credits) {
      s.coins = s.coins || {}; const have = num(s.coins.credits);
      if (fx.credits > 0) { s.coins.credits = String(have + fx.credits); out.push(`+${fx.credits} credits.`); }
      else { const cost = -fx.credits; if (have >= cost) { s.coins.credits = String(have - cost); out.push(`Paid ${cost} credits.`); } else { WK.ensure(s); WK.openDebt(s, (P.districts[n.district] || {}).name ? 'a ' + P.districts[n.district].name + ' clinic' : 'a clinic', cost, aMs, 'Downtime: a bill you couldn\'t cover.'); out.push(`Couldn't cover ${cost} credits. It's Debt now.`); } }
    }
    if (fx.lead) { const got = leads(s, P, n.district, fx.lead, WK, aMs); out.push(got.length ? `Lead${got.length > 1 ? 's' : ''} in your Mail: ${got.map(g => '“' + g + '”').join(' ')}` : 'Nothing new to learn here. You know this place.'); }
    return out;
  }
  /* Research and listening turn up true lines from the district's own dossier, ones you haven't heard yet. */
  function leads(s, P, districtId, count, WK, aMs) {
    const v = P.districts[districtId] || {}, d = v.dossier || {}, have = new Set(ensure(s).leads.filter(l => l.district === districtId).map(l => l.text));
    const pool = ['wisdom', 'hazards', 'control', 'heat', 'factions', 'missions'].map(k => [k, d[k]]).filter(([, t]) => t && !have.has(t));
    const got = pool.slice(0, count);
    for (const [k, t] of got) { s.downtime.leads.unshift({ at: aMs, district: districtId, kind: k, text: t }); if (WK) { WK.ensure(s); WK.inform(s, aMs, `Lead · ${v.name || districtId}`, { wisdom: 'Local wisdom', hazards: 'What to watch for', control: 'Who runs it', heat: 'How Heat works here', factions: 'Who\'s here', missions: 'Work going around' }[k], t); } }
    return got.map(([, t]) => t);
  }

  /* ---------- records: actions with no scene ---------- */
  function trainOptions(s, R) { const lvl = Math.max(1, num(s.character && s.character.level, 1)); return Object.entries((R || {}).skillKeys || {}).map(([label, k]) => { const r = clamp(num(s.skills && s.skills[k]), 0, 4), nx = r + 1; return nx > 4 ? null : { key: k, label, from: RANK_NAMES[r], to: RANK_NAMES[nx], level: TRAIN_LEVEL[nx], open: lvl >= TRAIN_LEVEL[nx] }; }).filter(Boolean); }
  function train(s, key, cost, label, aMs) {
    const d = ensure(s), lvl = Math.max(1, num(s.character && s.character.level, 1)); cost = Math.max(1, Math.floor(num(cost, 1)));
    if (d.actionsRemaining <= 0) return { ok: false, message: 'No downtime actions left this gap.' };
    if (cost > num(d.marks)) return { ok: false, message: `Not enough Marks. Available: ${num(d.marks)}.` };
    s.skills = s.skills || {}; const r = clamp(num(s.skills[key]), 0, 4), nx = r + 1;
    if (nx > 4) return { ok: false, message: 'That skill is already at Mastery.' };
    if (lvl < TRAIN_LEVEL[nx]) return { ok: false, message: `${RANK_NAMES[nx]} opens at level ${TRAIN_LEVEL[nx]}.` };
    s.skills[key] = String(nx); if (['attune', 'sense', 'ward', 'disrupt'].includes(key) && s.magic && s.magic.arcaneSkills) s.magic.arcaneSkills[key] = String(nx);
    d.marks = num(d.marks) - cost; d.actionsRemaining--;
    const text = `Spent ${cost} Mark${cost === 1 ? '' : 's'}: ${label || key} ${RANK_NAMES[r]} → ${RANK_NAMES[nx]}. ${d.marks} remain.`;
    d.history.unshift({ action: 'train', label: 'Train', detail: text, time: aMs, location: d.night ? d.night.district : '' });
    if (d.night) d.night.scenes.push({ at: aMs, district: d.night.district, action: 'train', name: 'Train', choice: 'record', label: '', text: '', outcome: text, tier: 'win', dice: [], effects: [] });
    return { ok: true, message: text };
  }
  function record(s, D, actionId, note, aMs, WK) {
    const d = ensure(s), R = D.records[actionId]; if (!R) return { ok: false, message: 'Unknown action.' };
    if (d.actionsRemaining <= 0) return { ok: false, message: 'No downtime actions left this gap.' };
    d.actionsRemaining--; const text = `${R.name}${note ? ': ' + note : ''}. ${actionId === 'craft' ? 'Open the Workshop to make it.' : 'Flagged for the next session\'s GM to confirm.'}`;
    d.history.unshift({ action: actionId, label: R.name, detail: text, time: aMs, location: d.night ? d.night.district : '' });
    if (d.night) d.night.scenes.push({ at: aMs, district: d.night.district, action: actionId, name: R.name, choice: 'record', label: note || '', text: '', outcome: text, tier: 'win', dice: [], effects: [] });
    if (WK && actionId !== 'craft') { WK.ensure(s); WK.inform(s, aMs, 'Downtime', `${R.name}: for the GM to confirm`, note || R.rule); }
    return { ok: true, message: text };
  }
  /* A new gap between sessions: two fresh actions. */
  /* A gap opens once per session: only after someone presses "Session starting" in Mail & bills.
     Older characters (no gapSession yet) get one gap so nobody is stuck. */
  const sessions = s => num(s.week && s.week.sessionsStarted);
  function canNewGap(s) { const d = ensure(s); return d.gapSession === undefined || sessions(s) > num(d.gapSession); }
  function newGap(s, aMs) {
    const d = ensure(s);
    if (!canNewGap(s)) return { ok: false, message: 'Your next gap opens when a session starts. Press "Session starting" in Mail & bills.' };
    d.actionsRemaining = 2; d.night = null; d.gapSession = sessions(s);
    d.history.unshift({ action: 'gap', label: 'New session gap', detail: 'Two downtime actions available.', time: aMs, location: '' }); return { ok: true };
  }

  /* ---------- the recap ---------- */
  function recap(s, D, P) {
    const n = s.downtime && s.downtime.night; if (!n || !n.scenes.length) return null;
    const who = (s.character && (s.character.alias || s.character.name)) || 'Someone', dn = (P.districts[n.district] || {}).name || n.district;
    const head = `${nightName(D, n.at)} in ${dn}${n.inGrith ? ' (home)' : ''}`;
    const lines = n.scenes.map(e => {
      const how = e.choice === 'bold' ? 'went bold' : e.choice === 'safe' ? 'played it safe' : e.action === 'favor' ? String(e.label || '').split(':')[0].toLowerCase() : '';
      const dice = e.dice && e.dice.length ? ` [${e.successes} vs ${e.diff}${e.pushed ? ', pushed' : ''}]` : '';
      return { name: e.name, how, text: [e.outcome, ...(e.effects || [])].filter(Boolean).join(' '), dice };
    });
    const discord = `**${head}** · ${who}\n` + lines.map(l => `• **${l.name}**${l.how ? ` (${l.how})` : ''}${l.dice}: ${l.text}`).join('\n');
    return { head, who, lines, discord };
  }

  const api = { owedFavor, ACTIONS, RANK_NAMES, TRAIN_LEVEL, ensure, ground, districts, startNight, nightName, scene, roll, pending, push, accept, trainOptions, train, record, canNewGap, newGap, recap, territoryToDistrict, districtToTerritory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GRAKK_NIGHT = api;
})(typeof window !== 'undefined' ? window : globalThis);
