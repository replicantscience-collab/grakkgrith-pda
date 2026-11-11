/* Patterns: player-made items. Sketch (free) -> Prototype (a downtime action and a roll) -> Proven (used in play).
   Pure logic (window.GRAKK_PATTERNS). Lives in the character file under state.patterns:
     { v, sketches: [...], parts: { scrap: n, ... }, salvaged: { "<district>|<day>": true }, log: [...] }
   A Prototype becomes a real item card in state.inventory with item.pattern = { id, name, frame, variant, tier,
   improvements, quirks, hidden (sealed until Proven), status, maker, copy, certified, read } and a trade code.
   P = data/patterns.json. Trade codes through window.GRAKK_TRADE, Mail through window.GRAKK_WEEK, both optional.
   Spec: claude/CRAFTING_PATTERNS.md v0.2 (cleared with Nib). All prices marked draft there are drafts here too. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const TR = () => root.GRAKK_TRADE, WK = () => root.GRAKK_WEEK;
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  const heatCap = lvl => { lvl = num(lvl); return lvl >= 17 ? 8 : lvl >= 7 ? 7 : 6; };
  const addHeat = (s, n) => { s.stats = s.stats || {}; s.stats.heat = String(clamp(num(s.stats.heat) + n, 0, heatCap(s.character && s.character.level))); };
  const rollDice = (n, rng) => Array.from({ length: Math.max(1, n) }, () => 1 + Math.floor(rng() * 6));
  const me = s => String((s && s.character && s.character.name) || '').trim();
  const cls = s => (s && s.character && s.character.class) || '';
  const level = s => num(s && s.character && s.character.level, 1);
  const rand = () => Math.random().toString(36).slice(2, 8);
  const downtimeLeft = s => { const d = s.downtime; return d && d.actionsRemaining != null ? num(d.actionsRemaining) : 2; };
  const spendDowntime = (s, n) => { s.downtime = s.downtime || {}; s.downtime.actionsRemaining = Math.max(0, downtimeLeft(s) - n); };
  const seal = v => 'h:' + Array.from(String(v)).map(c => String.fromCharCode(c.charCodeAt(0) + 7)).join('');
  const unseal = v => v && v.startsWith('h:') ? Array.from(v.slice(2)).map(c => String.fromCharCode(c.charCodeAt(0) - 7)).join('') : '';

  function ensure(s) { if (!s.patterns || typeof s.patterns !== 'object') s.patterns = { v: 1, sketches: [], parts: {}, salvaged: {}, log: [] }; const p = s.patterns; p.sketches = p.sketches || []; p.parts = p.parts || {}; p.salvaged = p.salvaged || {}; p.log = p.log || []; return p; }
  const frame = (P, id) => P.frames[id] || null;
  const variant = (P, sk) => { const f = frame(P, sk.frame); return f && (f.variants.find(v => v.id === sk.variant) || f.variants[0]) || null; };
  const tierOf = (P, t) => P.tiers[String(t)] || null;
  const framesFor = (P, c) => Object.entries(P.frames).filter(([, f]) => [].concat(f.class).includes(c)).map(([id]) => id);
  const allowedImprovements = (P, frameId) => { const f = frame(P, frameId); if (!f) return []; return Object.entries(P.improvements).filter(([, im]) => (im.groups || []).includes(f.group) || (im.frames || []).includes(frameId)).map(([id]) => id); };

  /* ---------- validation against the caps ---------- */
  function validate(P, s, sk, o = {}) {
    const problems = [], f = frame(P, sk.frame), t = tierOf(P, sk.tier), v = f && variant(P, sk);
    if (!f) return { ok: false, problems: ['Pick a frame.'], slots: 0, used: 0 };
    if (!o.licensed && !sk.license && ![].concat(f.class).includes(cls(s))) problems.push(`${f.name}s are ${[].concat(f.class).join(' or ')} work.`);
    if (!t || num(sk.tier) < 1 || num(sk.tier) > 4) problems.push('Players make tiers 1 to 4. Tier 5 is corp gear.');
    else if (level(s) < t.minLevel) problems.push(`Tier ${sk.tier} (${t.name}) needs level ${t.minLevel}.`);
    if (!String(sk.name || '').trim()) problems.push('Name it.');
    const imps = sk.improvements || [], quirks = sk.quirks || [], ok = allowedImprovements(P, sk.frame);
    for (const im of imps) if (!ok.includes(im)) problems.push(`${(P.improvements[im] || { name: im }).name} doesn't fit a ${f.name}.`);
    if (new Set(imps).size !== imps.length) problems.push('The same improvement can\'t be taken twice.');
    for (const q of quirks) if (!P.quirks[q]) problems.push(`Unknown quirk ${q}.`); else if (t && t.builtIn === q) problems.push(`${P.quirks[q].name} is already built into tier ${sk.tier}; it buys nothing.`);
    if (new Set(quirks).size !== quirks.length) problems.push('A quirk only counts once.');
    const bought = Math.min(P.rules.boughtSlotsMax, quirks.length), slots = (t ? t.slots : 0) + bought;
    if (imps.length > slots) problems.push(`${imps.length} improvement${imps.length === 1 ? '' : 's'} but only ${slots} slot${slots === 1 ? '' : 's'}${bought ? '' : ' (a quirk buys one more)'}.`);
    if (f.group === 'armor' && v) {
      const a = { ...v.armor }; if (imps.includes('absorb-ballistic')) a.ballistic++; if (imps.includes('absorb-blade')) a.blade++; if (imps.includes('absorb-impact')) a.impact++;
      for (const k of ['ballistic', 'blade', 'impact']) if (a[k] > P.caps.armorSingle) problems.push(`${k} would be ${a[k]}; the cap is ${P.caps.armorSingle}.`);
      const total = a.ballistic + a.blade + a.impact; if (total > f.totalCap) problems.push(`Armor total ${total} is over the ${f.name} cap of ${f.totalCap}.`);
    }
    if (f.usesCap && v) { const u = num(v.uses, 1) + (imps.includes('extra-use') ? 1 : 0); if (u > f.usesCap) problems.push(`${u} uses is over the cap of ${f.usesCap}.`); }
    return { ok: !problems.length, problems, slots, used: imps.length, bought };
  }

  /* ---------- what it costs and what it does ---------- */
  function materials(P, s, sk) {
    const t = tierOf(P, sk.tier), proven = isProven(s, sk), own = (ensure(s).sketches.find(x => x.id === sk.id) || sk);
    let difficulty = t.difficulty, parts = t.parts;
    if (proven) { difficulty = Math.max(1, difficulty - P.rules.provenDifficultyStep); parts = Math.max(1, parts - P.rules.provenPartsStep); }
    return { difficulty, parts, credits: t.credits, special: t.special, proven, license: own.license || null };
  }
  const isProven = (s, sk) => !!(sk.status === 'proven' || sk.license);
  function quirksOf(P, sk) { const t = tierOf(P, sk.tier), q = [...(sk.quirks || [])]; if (t && t.builtIn && !(sk.improvements || []).includes('reliable') && !q.includes(t.builtIn)) q.unshift(t.builtIn); return q; }
  function value(P, sk) { const v = variant(P, sk), t = tierOf(P, sk.tier); return Math.round(num(v && v.price) * (t ? t.multiplier : 1) * (1 + P.rules.improvementValue * (sk.improvements || []).length)); }
  function summary(P, sk, showHidden) {
    const f = frame(P, sk.frame), v = variant(P, sk), t = tierOf(P, sk.tier), imps = (sk.improvements || []).map(i => P.improvements[i] ? P.improvements[i].name : i), qs = quirksOf(P, sk).map(q => P.quirks[q] ? P.quirks[q].name : q);
    const hidden = showHidden && sk.hidden ? P.quirks[unseal(sk.hidden)] : null;
    return `${t ? `Tier ${sk.tier} ${t.name}` : ''} ${f ? f.name.toLowerCase() : ''}${v ? ` (${v.name})` : ''}.${imps.length ? ` Improvements: ${imps.join(', ')}.` : ''}${qs.length ? ` Quirks: ${qs.join(', ')}.` : ''}${hidden ? ` Hidden quirk: ${hidden.name} (${hidden.text})` : ''}`;
  }
  /* The item card the sheet reads. Numbers come from the frame and tier; the card is their read-only output. */
  function card(P, sk, extra = {}) {
    const f = frame(P, sk.frame), v = variant(P, sk), t = tierOf(P, sk.tier), imps = sk.improvements || [], adds = Array(8).fill('');
    const props = []; const q = quirksOf(P, sk);
    const item = { schema: 'GRAKKGRITH_ITEM_CARD', schemaVersion: 44, name: sk.name, class: f.cardClass, tier: String(sk.tier), desc: '', img: '', shopName: sk.makerMark || '', shopIcon: '', adds,
      attackProfile: { attribute: '', skill: '', category: '', damageType: '', ap: '0', properties: '' }, armorProfile: { base: { ballistic: '0', blade: '0', impact: '0', energy: '0' }, current: { ballistic: '0', blade: '0', impact: '0', energy: '0' } }, actions: [], noRefill: false };
    adds[1] = String(sk.tier);
    if (f.group === 'weapon') {
      adds[0] = f.category[0].toUpperCase() + f.category.slice(1); adds[2] = v.damage;
      for (const id of ['ap1', 'reliable', 'concealable', 'quick-draw', 'versatile', 'quiet']) if (imps.includes(id)) props.push(P.improvements[id].name);
      for (const id of q) props.push(P.quirks[id].name);
      if (f.penalty && !imps.includes('remove-penalty')) props.push(f.penalty);
      item.attackProfile = { attribute: v.ranged ? 'reflex' : f.attribute, skill: v.ranged ? 'ranged' : f.skill, category: f.category, damageType: v.damage, ap: imps.includes('ap1') ? '1' : '0', properties: props.join(', ') };
      if (v.ranged) { adds[6] = String(v.capacity); adds[7] = String(v.capacity); item.actions = ['fire', 'reload']; }
    } else if (f.group === 'armor') {
      const a = { ...v.armor }; if (imps.includes('absorb-ballistic')) a.ballistic++; if (imps.includes('absorb-blade')) a.blade++; if (imps.includes('absorb-impact')) a.impact++;
      item.armorProfile = { base: { ballistic: String(a.ballistic), blade: String(a.blade), impact: String(a.impact), energy: '0' }, current: { ballistic: String(a.ballistic), blade: String(a.blade), impact: String(a.impact), energy: '0' } };
      adds[2] = `B${a.ballistic}/Bl${a.blade}/I${a.impact}`; if (f.penalty && !imps.includes('remove-penalty')) props.push(f.penalty); if (imps.includes('concealable')) props.push('Concealable');
    } else if (f.group === 'consumable' || f.group === 'charm' || f.group === 'papers') {
      const uses = num(v.uses, 1) + (imps.includes('extra-use') ? 1 : 0); adds[4] = String(num(v.wound)); adds[5] = String(num(v.stress)); adds[6] = String(uses); adds[7] = String(uses); item.actions = ['use']; item.noRefill = true;
      if (v.effectText) props.push(v.effectText);
    } else if (f.group === 'bag') { adds[7] = String(v.slots); props.push(`+${v.slots} inventory slots`); }
    else if (f.group === 'tool' || f.group === 'drone' || f.group === 'media') {
      if (v.boosts) props.push(`+1 die on ${v.boosts}${imps.includes('second-skill') ? ' and one related skill' : ''}`); if (v.enables) props.push(v.enables); if (v.job) props.push(`Job: ${v.job}`);
      for (const id of ['reliable', 'concealable', 'quiet', 'signal-proof']) if (imps.includes(id)) props.push(P.improvements[id].name);
    }
    if (imps.includes('sturdy')) props.push('Sturdy');
    for (const id of q) if (f.group !== 'weapon') props.push(P.quirks[id].name);
    const status = extra.status || 'prototype';
    item.desc = `${status === 'proven' ? 'Proven' : 'Prototype'}. ${summary(P, sk, extra.showHidden)}${props.length && f.group !== 'weapon' ? ` ${props.join('. ')}.` : ''}${extra.hiddenNote || ''}${sk.notes ? ` ${sk.notes}` : ''}`.trim();
    item.pattern = { id: sk.id, name: sk.name, frame: sk.frame, variant: v.id, tier: num(sk.tier), improvements: [...imps], quirks: [...(sk.quirks || [])], hidden: sk.hidden || null, status, maker: extra.maker || '', makerMark: sk.makerMark || '', copy: extra.copy || 1, certified: false, read: false, legality: f.legality, value: value(P, sk) };
    return item;
  }

  /* ---------- sketches: free, any time ---------- */
  function saveSketch(s, P, data, aMs) {
    const p = ensure(s), v = validate(P, s, data); if (!v.ok) return { ok: false, msg: v.problems[0], problems: v.problems };
    let sk = data.id ? p.sketches.find(x => x.id === data.id) : null;
    if (sk && sk.status === 'proven') return { ok: false, msg: 'A Proven Pattern is fixed. Sketch a new one from it instead.' };
    if (!sk) { sk = { id: `pt-${aMs.toString(36)}-${rand()}`, created: aMs, by: me(s), status: 'sketch', copies: 0 }; p.sketches.unshift(sk); }
    Object.assign(sk, { name: String(data.name).trim().slice(0, 60), frame: data.frame, variant: (variant(P, data) || {}).id, tier: num(data.tier), improvements: [...(data.improvements || [])], quirks: [...(data.quirks || [])], makerMark: String(data.makerMark || '').trim().slice(0, 40), notes: String(data.notes || '').trim().slice(0, 200) });
    return { ok: true, sketch: sk, msg: `${sk.name} sketched. Nothing exists yet.` };
  }
  function deleteSketch(s, id) { const p = ensure(s), i = p.sketches.findIndex(x => x.id === id); if (i < 0) return { ok: false }; const [sk] = p.sketches.splice(i, 1); return { ok: true, msg: `${sk.name} torn up.` }; }

  /* ---------- parts ---------- */
  const partsOf = s => ensure(s).parts;
  const partCount = (s, k) => num(partsOf(s)[k]);
  function addPart(s, k, n = 1) { const p = partsOf(s); p[k] = Math.max(0, num(p[k]) + n); return p[k]; }
  const here = (s, aMs) => { const pr = s.world && s.world.presence; if (!pr) return null; const t = pr.transit; return t && aMs >= t.arrives ? t.to : t ? null : pr.location; };
  function buyParts(s, P, kind, n, aMs) {
    const pt = P.parts[kind]; n = Math.max(1, Math.floor(num(n, 1)));
    if (!pt || pt.price == null) return { ok: false, msg: 'Not for sale at Rust Market.' };
    const h = here(s, aMs); if (!h || h.place !== P.market.place) return { ok: false, msg: `${P.market.placeName} sells parts. Travel there first (Explore).` };
    const cost = pt.price * n; if (credits(s) < cost) return { ok: false, msg: `${n} ${pt.name} costs ${cost} cr; you have ${credits(s)}.` };
    setCredits(s, credits(s) - cost); addPart(s, kind, n); return { ok: true, msg: `Bought ${n} ${pt.name} for ${cost} cr.` };
  }
  function salvageOptions(P, district) { return Object.entries(P.parts).filter(([, pt]) => pt.districts.includes(district)).map(([id]) => id); }
  function salvage(s, P, kind, aMs, rng = Math.random) {
    const h = here(s, aMs); if (!h) return { ok: false, msg: 'You need to be somewhere. Open Explore.' };
    const opts = salvageOptions(P, h.district); if (!opts.length) return { ok: false, msg: 'Nothing worth salvaging in this district.' };
    kind = opts.includes(kind) ? kind : opts[0];
    const p = ensure(s), key = `${h.district}|${Math.floor(aMs / DAY)}`; if (p.salvaged[key]) return { ok: false, msg: 'You\'ve picked this district over today. Come back tomorrow.' };
    const R = P.salvage, pool = Math.max(1, num(s.stats && s.stats[R.attribute]) + num(s.skills && s.skills[R.skill])), dice = rollDice(pool, rng), hits = dice.filter(d => d >= 5).length;
    p.salvaged[key] = true; for (const k of Object.keys(p.salvaged)) if (Number(k.split('|')[1]) < Math.floor(aMs / DAY) - 7) delete p.salvaged[k];
    if (hits < R.difficulty) return { ok: true, dice, found: 0, msg: `Nothing usable today (${hits} success${hits === 1 ? '' : 'es'}).` };
    const found = 1 + (hits - R.difficulty) * R.extraPerSuccess; addPart(s, kind, found);
    return { ok: true, dice, found, kind, msg: `Found ${found} ${P.parts[kind].name}.` };
  }
  /* Runners: one free part per Delivery Run that touches a salvage district. Called by make.js when a run completes. */
  function sourceFromRun(s, P, districts) {
    if (cls(s) !== 'Runner') return null;
    for (const d of districts) if (P.runnerSourcing.districts.includes(d)) { const k = salvageOptions(P, d)[0]; if (k) { addPart(s, k, 1); return k; } }
    return null;
  }

  /* ---------- prototype ---------- */
  function previewPrototype(s, P, id, o = {}) {
    const p = ensure(s), sk = p.sketches.find(x => x.id === id); if (!sk) return { ok: false, blockers: ['No such sketch.'] };
    const v = validate(P, s, sk), blockers = [...v.problems], m = materials(P, s, sk), chosen = o.parts || {}, spent = Object.values(chosen).reduce((a, b) => a + num(b), 0);
    if (sk.license && sk.license.copies <= 0) blockers.push('The license is used up.');
    if (downtimeLeft(s) < P.downtimeCost) blockers.push('No downtime actions left this gap.');
    if (spent !== m.parts) blockers.push(`Pick exactly ${m.parts} part${m.parts === 1 ? '' : 's'} (${spent} chosen).`);
    for (const [k, n] of Object.entries(chosen)) if (num(n) > partCount(s, k)) blockers.push(`Not enough ${P.parts[k] ? P.parts[k].name : k}: ${partCount(s, k)} on hand.`);
    if (m.special && !m.special.some(k => num(chosen[k]) > 0)) blockers.push(`Tier ${sk.tier} needs ${m.special.map(k => P.parts[k].name).join(' or ')} among its parts.`);
    if (m.credits && credits(s) < m.credits) blockers.push(`Needs ${m.credits} cr; you have ${credits(s)}.`);
    const R = P.rolls[cls(s)] || P.rolls.Wrench, pool = Math.max(1, num(s.stats && s.stats[R.attribute]) + num(s.skills && s.skills[R.skill]));
    const empty = (s.inventory || []).findIndex(x => !x || !(x.name || x.img)); if (empty < 0) blockers.push('No empty inventory slot for the result.');
    return { ok: !blockers.length, blockers, sketch: sk, materials: m, roll: { pool, difficulty: m.difficulty, label: `${R.attribute[0].toUpperCase() + R.attribute.slice(1)} + ${R.skill[0].toUpperCase() + R.skill.slice(1)}` }, value: value(P, sk) };
  }
  function prototype(s, P, id, o = {}, aMs, rng = Math.random) {
    const pv = previewPrototype(s, P, id, o); if (!pv.ok) return { ok: false, msg: pv.blockers[0] };
    const sk = pv.sketch, m = pv.materials, p = ensure(s), who = me(s), chosen = o.parts || {};
    spendDowntime(s, P.downtimeCost); if (m.credits) setCredits(s, credits(s) - m.credits);
    const dice = rollDice(pv.roll.pool, rng), hits = dice.filter(d => d >= 5).length;
    const log = t => p.log.unshift({ at: aMs, text: t });
    if (hits === 0 || hits < m.difficulty - 1) {
      let lost = 0; for (const [k, n] of Object.entries(chosen)) { const l = Math.ceil(num(n) / 2); addPart(s, k, -l); lost += l; }
      log(`${sk.name}: failed (${hits} of ${m.difficulty}). Lost ${lost} part${lost === 1 ? '' : 's'}.`);
      return { ok: true, made: false, dice, msg: `It didn't come together: ${hits} of ${m.difficulty} successes. Half the parts are gone; the sketch stays.` };
    }
    for (const [k, n] of Object.entries(chosen)) addPart(s, k, -num(n));
    const partial = hits < m.difficulty; const extraQuirk = partial ? pickQuirk(P, sk, rng) : null;
    const build = { ...sk, quirks: [...(sk.quirks || []), ...(extraQuirk ? [extraQuirk] : [])] };
    if (!build.hidden && rng() < P.hiddenQuirkChance) build.hidden = seal(pickQuirk(P, build, rng));
    sk.copies = num(sk.copies) + 1; if (sk.license) sk.license.copies--;
    const item = card(P, build, { status: m.proven ? 'proven' : 'prototype', maker: who, copy: sk.copies });
    if (build.hidden && !m.proven) item.pattern.hidden = build.hidden;
    if (m.proven && build.hidden) { item.pattern.hidden = build.hidden; item.desc = card(P, build, { status: 'proven', maker: who, copy: sk.copies, showHidden: true }).desc; }
    if (TR()) TR().issue(item, s, aMs);
    const slot = (s.inventory || []).findIndex(x => !x || !(x.name || x.img)); s.inventory[slot] = item;
    const cut = sk.license ? Math.round(value(P, sk) * P.license.makerCut) : 0;
    log(`${sk.name}: ${partial ? 'partial' : 'made'} (${hits} of ${m.difficulty})${extraQuirk ? `, picked up ${P.quirks[extraQuirk].name}` : ''}.${cut ? ` Owe ${sk.license.maker} ${cut} cr (license cut).` : ''}`);
    if (cut && WK()) WK().inform(s, aMs, 'Your books', `License cut owed: ${cut} cr`, `You made ${sk.name} under ${sk.license.maker}'s license. Their cut is ${cut} cr. Settle it by hand.`);
    return { ok: true, made: true, dice, item, slot, partial, extraQuirk, msg: `${sk.name}: ${partial ? `works, but it picked up ${P.quirks[extraQuirk].name}.` : 'done.'} ${hits} success${hits === 1 ? '' : 'es'}, needed ${m.difficulty}.${cut ? ` ${sk.license.maker}'s cut: ${cut} cr.` : ''}` };
  }
  function pickQuirk(P, sk, rng) { const have = new Set([...(sk.quirks || []), tierOf(P, sk.tier) && tierOf(P, sk.tier).builtIn]); const opts = Object.keys(P.quirks).filter(q => !have.has(q) && !['backfire', 'unreliable'].includes(q)); return opts[Math.floor(rng() * opts.length)]; }

  /* ---------- proven ---------- */
  function prove(s, P, idx, aMs, how = 'scene') {
    const it = (s.inventory || [])[idx], pt = it && it.pattern; if (!pt) return { ok: false, msg: 'Not a Pattern item.' };
    if (pt.status === 'proven') return { ok: false, msg: 'Already Proven.' };
    if (how === 'field-test') { if (cls(s) !== 'Striker') return { ok: false, msg: 'Field-testing is Striker work.' }; if (downtimeLeft(s) < 1) return { ok: false, msg: 'No downtime actions left this gap.' }; spendDowntime(s, 1); }
    pt.status = 'proven'; const sk = { ...pt, id: pt.id, name: pt.name }; const hidden = pt.hidden ? P.quirks[unseal(pt.hidden)] : null;
    it.desc = card(P, { ...sk, quirks: pt.quirks }, { status: 'proven', maker: pt.maker, copy: pt.copy, showHidden: true }).desc;
    const own = ensure(s).sketches.find(x => x.id === pt.id); if (own && own.status !== 'proven') { own.status = 'proven'; own.provenAt = aMs; if (pt.hidden) own.hidden = pt.hidden; }
    ensure(s).log.unshift({ at: aMs, text: `${pt.name} proven${how === 'field-test' ? ' in a field test' : ' in play'}.${hidden ? ` Hidden quirk: ${hidden.name}.` : ''}` });
    return { ok: true, hidden, msg: `${pt.name} is Proven.${hidden ? ` It had a hidden quirk: ${hidden.name}. ${hidden.text}` : ' No surprises.'}${own ? ' The Pattern is yours to make again, one step easier.' : ''}` };
  }
  /* Shade's Read: learn a Pattern's quirks, hidden ones included, for you. */
  function read(s, P, idx, aMs, rng = Math.random) {
    const it = (s.inventory || [])[idx], pt = it && it.pattern; if (!pt) return { ok: false, msg: 'Not a Pattern item.' };
    if (cls(s) !== 'Shade') return { ok: false, msg: 'Reading a Pattern is Shade work.' };
    const pool = Math.max(1, num(s.stats && s.stats.spark) + num(s.skills && s.skills.ward)), dice = rollDice(pool, rng), hits = dice.filter(d => d >= 5).length;
    if (hits < 1) return { ok: true, dice, msg: 'It keeps its secrets this time.' };
    pt.read = true; const hidden = pt.hidden ? P.quirks[unseal(pt.hidden)] : null;
    if (hidden) it.desc = it.desc.replace(/ Hidden quirk:.*$/, '') + ` Hidden quirk: ${hidden.name} (${hidden.text})`;
    return { ok: true, dice, hidden, msg: hidden ? `Read it: a hidden ${hidden.name}. ${hidden.text}` : 'Read it: no hidden quirk.' };
  }

  /* ---------- selling ---------- */
  function salePrice(s, P, M, it, how) { const share = M && M.market && M.market[how] ? M.market[how].share : how === 'fence' ? 0.6 : 1; const v = num(it.pattern && it.pattern.value); return Math.round(v * share); }
  function sell(s, P, M, idx, how, aMs) {
    const it = (s.inventory || [])[idx], pt = it && it.pattern; if (!pt) return { ok: false, msg: 'Not a Pattern item.' };
    const price = salePrice(s, P, M, it, how); setCredits(s, credits(s) + price);
    let msg = `Sold ${it.name} ${how === 'street' ? 'on the street' : 'through a fence'} for ${price} cr.`;
    if (how === 'street' && pt.legality === 'restricted' && !pt.certified) { addHeat(s, 1); msg += ' Restricted work sold in the open: Heat +1.'; }
    const h = here(s, aMs); ensure(s).log.unshift({ at: aMs, text: `${msg}${h ? ` (${h.district})` : ''}`, sale: { pattern: pt.id, name: pt.name, how, district: h ? h.district : null, maker: pt.maker, makerMark: pt.makerMark } });
    s.inventory[idx] = { name: '', class: '', desc: '', img: '', shopName: '', shopIcon: '', adds: Array(8).fill(''), attackProfile: { attribute: '', skill: '', category: '', damageType: '', ap: '0', properties: '' }, armorProfile: { base: { ballistic: '0', blade: '0', impact: '0', energy: '0' }, current: { ballistic: '0', blade: '0', impact: '0', energy: '0' } }, actions: [], noRefill: false };
    for (const k of ['active', 'secondary', 'ammoSource', 'armor', 'back']) if (s.equipment && s.equipment[k] === idx) s.equipment[k] = null;
    return { ok: true, price, msg };
  }

  /* ---------- Gear Mod: a Wrench takes an item up one tier ---------- */
  function previewGearMod(s, P, idx, o = {}) {
    const it = (s.inventory || [])[idx], pt = it && it.pattern, blockers = [];
    if (!pt) return { ok: false, blockers: ['Pick a Pattern item.'] };
    if (cls(s) !== 'Wrench') blockers.push('Gear Mod is Wrench work.');
    const next = pt.tier + 1, t = tierOf(P, next);
    if (pt.tier >= 4) blockers.push(pt.tier === 5 ? 'Tier 5 corp gear can be repaired, not improved further.' : 'Tier 4 is as good as street work gets.');
    else { if (level(s) < t.minLevel) blockers.push(`Tier ${next} needs level ${t.minLevel}.`); const chosen = o.parts || {}, spent = Object.values(chosen).reduce((a, b) => a + num(b), 0);
      if (spent !== t.parts) blockers.push(`Pick exactly ${t.parts} parts (${spent} chosen).`); for (const [k, n] of Object.entries(chosen)) if (num(n) > partCount(s, k)) blockers.push(`Not enough ${P.parts[k].name}.`);
      if (t.special && !t.special.some(k => num(chosen[k]) > 0)) blockers.push(`Tier ${next} needs ${t.special.map(k => P.parts[k].name).join(' or ')}.`);
      if (t.credits && credits(s) < t.credits) blockers.push(`Needs ${t.credits} cr.`);
      if (t.slots > (pt.improvements || []).length - Math.min(1, (pt.quirks || []).length) && !o.improvement) blockers.push('Tier 4 adds a slot: pick the improvement.');
      if (o.improvement && (!allowedImprovements(P, pt.frame).includes(o.improvement) || (pt.improvements || []).includes(o.improvement))) blockers.push('That improvement doesn\'t fit.'); }
    if (downtimeLeft(s) < 1) blockers.push('No downtime actions left this gap.');
    const R = P.rolls.Wrench, pool = Math.max(1, num(s.stats && s.stats[R.attribute]) + num(s.skills && s.skills[R.skill]));
    return { ok: !blockers.length, blockers, item: it, next, roll: t ? { pool, difficulty: t.difficulty } : null };
  }
  function gearMod(s, P, idx, o = {}, aMs, rng = Math.random) {
    const pv = previewGearMod(s, P, idx, o); if (!pv.ok) return { ok: false, msg: pv.blockers[0] };
    const it = pv.item, pt = it.pattern, t = tierOf(P, pv.next), chosen = o.parts || {};
    spendDowntime(s, 1); if (t.credits) setCredits(s, credits(s) - t.credits);
    const dice = rollDice(pv.roll.pool, rng), hits = dice.filter(d => d >= 5).length;
    if (hits < t.difficulty) { for (const [k, n] of Object.entries(chosen)) addPart(s, k, -Math.ceil(num(n) / 2)); return { ok: true, dice, made: false, msg: `The mod didn't take (${hits} of ${t.difficulty}). Half the parts are gone; the item is as it was.` }; }
    for (const [k, n] of Object.entries(chosen)) addPart(s, k, -num(n));
    const sk = { ...pt, tier: pv.next, improvements: [...pt.improvements, ...(o.improvement ? [o.improvement] : [])] };
    const v = validate(P, s, sk, { licensed: true }); if (!v.ok) return { ok: false, msg: v.problems[0] };
    const fresh = card(P, sk, { status: pt.status, maker: pt.maker, copy: pt.copy, showHidden: pt.status === 'proven' });
    Object.assign(it, { desc: fresh.desc, tier: fresh.tier, adds: fresh.adds, attackProfile: fresh.attackProfile, armorProfile: fresh.armorProfile, actions: fresh.actions, noRefill: fresh.noRefill, pattern: { ...pt, ...fresh.pattern, hidden: pt.hidden, certified: false, read: pt.read } });
    ensure(s).log.unshift({ at: aMs, text: `Gear Mod: ${it.name} is now tier ${pv.next} (${t.name}).` });
    return { ok: true, dice, made: true, msg: `${it.name} is now tier ${pv.next}, ${t.name}.` };
  }

  /* ---------- Pattern and license codes (through trade.js) ---------- */
  async function patternCode(s, P, id, aMs) {
    const sk = ensure(s).sketches.find(x => x.id === id); if (!sk) throw new Error('No such Pattern.');
    if (sk.status !== 'proven') throw new Error('Only a Proven Pattern can be shared.');
    return TR().encode({ v: 1, t: 'pattern', at: aMs, from: me(s), sketch: { ...sk, license: null } });
  }
  async function licenseCode(s, P, id, copies, to, aMs) {
    if (cls(s) !== 'Broker') throw new Error('Licensing is Broker work.');
    const sk = ensure(s).sketches.find(x => x.id === id); if (!sk) throw new Error('No such Pattern.');
    if (sk.status !== 'proven') throw new Error('Only a Proven Pattern can be licensed.');
    copies = clamp(Math.floor(num(copies, 1)), 1, P.license.copiesMax); const name = String(to || '').trim(); if (!name) throw new Error('Name the licensee.');
    sk.licensed = [...(sk.licensed || []), { to: name, copies, at: aMs }];
    return TR().encode({ v: 1, t: 'license', at: aMs, from: me(s), to: name, copies, maker: sk.by, cut: P.license.makerCut, sketch: { ...sk, license: null, licensed: undefined } });
  }
  async function claimCode(s, P, code, aMs) {
    let p; try { p = await TR().decode(code); } catch (e) { return { ok: false, msg: e.message }; }
    const list = ensure(s).sketches;
    if (p.t === 'pattern') { if (list.some(x => x.id === p.sketch.id)) return { ok: false, msg: 'You already hold this Pattern.' }; list.unshift({ ...p.sketch, status: 'proven', heldFrom: p.from, copies: 0 }); return { ok: true, msg: `${p.sketch.name}: the Pattern is in your Workshop${cls(s) === 'Broker' ? '. You can license it.' : '.'}` }; }
    if (p.t === 'license') { if (p.to && p.to.toLowerCase() !== me(s).toLowerCase()) return { ok: false, msg: `That license was written for ${p.to}.` }; const have = list.find(x => x.id === p.sketch.id);
      if (have && have.license) { have.license.copies += p.copies; return { ok: true, msg: `${p.sketch.name}: ${p.copies} more copies on the license.` }; }
      if (have) return { ok: false, msg: 'You already hold this Pattern outright.' };
      list.unshift({ ...p.sketch, status: 'proven', copies: 0, license: { from: p.from, maker: p.maker, copies: p.copies, cut: p.cut } }); return { ok: true, msg: `${p.sketch.name}: licensed for ${p.copies} cop${p.copies === 1 ? 'y' : 'ies'}. ${p.maker} gets ${Math.round(p.cut * 100)}% of each.` }; }
    return { ok: false, msg: `That is a ${p.t} code, not a Pattern or license.` };
  }

  const api = { ensure, frame, variant, tierOf, framesFor, allowedImprovements, validate, materials, quirksOf, value, summary, card, saveSketch, deleteSketch, partCount, addPart, buyParts, salvageOptions, salvage, sourceFromRun, previewPrototype, prototype, prove, read, salePrice, sell, previewGearMod, gearMod, patternCode, licenseCode, claimCode, here, unseal };
  root.GRAKK_PATTERNS = api;
})(typeof window !== 'undefined' ? window : globalThis);
