/* The Make system: Make -> Use -> Sell -> Consequence.
   Every Make produces one persistent record: creator, class, costs, owner, location, visibility, lifetime, status, events.
   The PDA previews and records. It resolves only what has a rule (a roll at a stated difficulty);
   anything that changes the official world (registry, complaints) is proposed and waits for a ruling.
   Heat comes from circumstances: an unauthorized placement someone finds, restricted work sold in the open,
   a botched job on restricted work. Never from the class itself.
   Pure logic (window.GRAKK_MAKE). Lives in the character file under state.make. M = data/make.json.
   Mail and Heat go through window.GRAKK_WEEK (apps/week.js). */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const WK = () => root.GRAKK_WEEK;
  const rollDice = (n, rng) => Array.from({ length: Math.max(1, n) }, () => 1 + Math.floor(rng() * 6));
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  const stressCap = lvl => num(lvl) >= 12 ? 8 : 6;
  const heatCap = lvl => { lvl = num(lvl); return lvl >= 17 ? 8 : lvl >= 7 ? 7 : 6; };
  function addHeat(s, n) { s.stats = s.stats || {}; s.stats.heat = String(clamp(num(s.stats.heat) + n, 0, heatCap(s.character && s.character.level))); }
  function addStress(s, n) { s.stats = s.stats || {}; s.stats.stress = String(clamp(num(s.stats.stress) + n, 0, stressCap(s.character && s.character.level))); }

  function ensure(s) { if (!s.make || typeof s.make !== 'object') s.make = { v: 1, artifacts: [] }; s.make.artifacts = s.make.artifacts || []; return s.make; }
  const recipe = (M, id) => M.recipes.find(r => r.id === id) || null;
  const recipesFor = (M, cls) => M.recipes.filter(r => r.class === cls);
  /* Downtime actions come from the sheet's counter (2 per gap, rulebook). Missing counter = a fresh gap. */
  function downtimeLeft(s) { const d = s.downtime; return d && d.actionsRemaining != null ? num(d.actionsRemaining) : 2; }
  function spendDowntime(s, n) { s.downtime = s.downtime || {}; s.downtime.actionsRemaining = Math.max(0, downtimeLeft(s) - n); }
  function pool(s, r) { return r.roll ? Math.max(1, num(s.stats && s.stats[r.roll.attribute]) + num(s.skills && s.skills[r.roll.skill])) : 0; }
  function watcher(M, district) { return (district && M.watchers[district]) || M.watchers._default; }
  function discoveryChance(M, vis, district) { return clamp((M.visibility[vis] || M.visibility.discreet).discovery + (M.watchers.watchedBonus.includes(district) ? M.watchers.watchedBonusChance : 0), 0, 0.95); }

  /* ---------- preview: what pressing Make would do, and why ---------- */
  function preview(s, M, id, o = {}) {
    const r = recipe(M, id); if (!r) return { ok: false, blockers: ['Unknown Make.'] };
    const cls = s.character && s.character.class, blockers = [], heat = [], c = r.costs || {};
    if (r.class !== cls) blockers.push(`${r.name} is ${r.class} work.`);
    if (downtimeLeft(s) < M.downtimeCost) blockers.push('No downtime actions left this gap.');
    if (c.credits && credits(s) < c.credits) blockers.push(`Needs ${c.credits} credits for materials; you have ${credits(s)}.`);
    if (r.target && !String(o.target || '').trim()) blockers.push('Say who it is for.');
    if (r.placement && r.kind === 'placed' && !o.district) blockers.push('Pick where it goes.');
    if (r.options && !o.option) blockers.push('Pick the improvement.');
    const vis = o.visibility || r.defaultVisibility || 'discreet', perm = o.permission || 'own';
    if (r.kind === 'placed') {
      if (!M.permission[perm].authorized) heat.push({ when: 'Each week it stays up', amount: 1, why: `${Math.round(discoveryChance(M, vis, o.district) * 100)}% chance ${watcher(M, o.district)} finds it: Heat +1, a notice, and it's removed.` });
      else heat.push({ when: 'Placing it', amount: 0, why: 'Authorized. Nothing to find.' });
    }
    if (r.legality === 'restricted') {
      heat.push({ when: 'If the roll comes up empty', amount: 1, why: 'Restricted work botched: someone saw.' });
      if (r.value) heat.push({ when: 'Selling it on the street', amount: 1, why: 'A witnessed sale of restricted work. A fence costs you 40% instead.' });
    }
    if (r.adjudication === 'ruling') heat.push({ when: 'Ruling', amount: null, why: 'Any Heat is part of the ruling.' });
    if (!heat.length) heat.push({ when: '—', amount: 0, why: 'Lawful work. Heat only comes from what you do with it.' });
    const life = r.lifeDays == null ? 'Lasts until used or retired' : `Lasts ${r.lifeDays} Adyta day${r.lifeDays === 1 ? '' : 's'}${r.maintain ? ', can be maintained' : ''}`;
    return { ok: !blockers.length, blockers, recipe: r, costs: { downtime: M.downtimeCost, credits: c.credits || 0, stress: c.stress || 0 },
      roll: r.adjudication === 'auto' && r.roll ? { pool: pool(s, r), difficulty: r.roll.difficulty, label: `${cap(r.roll.attribute)} + ${cap(r.roll.skill)}` } : null,
      adjudication: r.adjudication, rulingNote: r.rulingNote || '', life, heat, visibility: vis, permission: perm };
  }
  const cap = t => String(t).replace(/^\w/, c => c.toUpperCase());

  /* ---------- make ---------- */
  function make(s, M, id, o, aMs, rng = Math.random) {
    const p = preview(s, M, id, o); if (!p.ok) return { ok: false, msg: p.blockers[0] };
    const r = p.recipe, m = ensure(s), who = (s.character && s.character.name) || 'Someone';
    spendDowntime(s, M.downtimeCost); if (p.costs.credits) setCredits(s, credits(s) - p.costs.credits); if (p.costs.stress) addStress(s, p.costs.stress);
    const a = { id: `a-${aMs.toString(36)}-${m.artifacts.length}`, recipe: r.id, name: String(o.name || '').trim() || r.name, kind: r.kind, class: r.class,
      creator: { name: who, class: r.class }, owner: who, target: String(o.target || '').trim(), option: o.option || '',
      costs: p.costs, location: r.placement ? { district: o.district || '', label: o.districtName || '' } : null,
      visibility: r.kind === 'placed' ? p.visibility : null, permission: r.kind === 'placed' ? p.permission : null,
      created: aMs, expires: r.lifeDays == null ? null : aMs + r.lifeDays * DAY, uses: r.uses || null, value: r.value || 0, legality: r.legality,
      permissions: { use: r.kind === 'service' || r.kind === 'filing' ? 'target' : 'owner', transfer: r.kind === 'item' || r.kind === 'filing' },
      effect: r.effect, status: 'active', roll: null, ruling: { needed: r.adjudication === 'ruling', note: r.rulingNote || '', status: r.adjudication === 'ruling' ? 'pending' : 'none' },
      lastCheckedWeek: null, events: [] };
    const ev = t => a.events.unshift({ at: aMs, text: t });
    ev(`Made by ${who} (${r.class}). Spent ${[`1 downtime action`, p.costs.credits && `${p.costs.credits} cr`, p.costs.stress && `${p.costs.stress} Stress`].filter(Boolean).join(', ')}.`);
    let msg = '';
    if (r.adjudication === 'ruling') { a.status = 'pending'; ev('Proposed. Waiting for a ruling.'); msg = 'Proposed. It waits for a ruling from whoever runs the session.'; }
    else if (r.roll) {
      const dice = rollDice(p.roll.pool, rng), hits = dice.filter(d => d >= 5).length; a.roll = { dice, hits, need: r.roll.difficulty };
      if (hits >= r.roll.difficulty) { ev(`Rolled ${hits} success${hits === 1 ? '' : 'es'} (needed ${r.roll.difficulty}). It works.`); msg = `${a.name}: done. ${hits} success${hits === 1 ? '' : 'es'}, needed ${r.roll.difficulty}.`;
        if (r.id === 'market-listing') a.bonus = hits * M.market.brokerBonusPerSuccess; }
      else {
        a.status = 'failed'; ev(`Rolled ${hits} of ${r.roll.difficulty} successes. Materials wasted.`); msg = `It didn't come together: ${hits} of ${r.roll.difficulty} successes. Materials are gone.`;
        if (r.legality === 'restricted' && hits === 0) { addHeat(s, 1); ev('Botched restricted work. Someone saw: Heat +1.'); msg += ' Someone saw: Heat +1.'; }
      }
    } else { ev('Posted.'); msg = `${a.name} is up.`; }
    m.artifacts.unshift(a);
    return { ok: true, artifact: a, msg, dice: a.roll && a.roll.dice };
  }

  /* ---------- the clock: expiry and discovery (weekly, Adyta time) ---------- */
  function settle(s, M, W, aMs, rng = Math.random) {
    const m = ensure(s), out = [], wk = WK(), week = wk ? wk.weekIndex(aMs) : Math.floor(aMs / (7 * DAY));
    for (const a of m.artifacts) {
      if (a.status !== 'active') continue;
      if (a.delivery) { settleDelivery(s, M, a, aMs, out); continue; }
      if (a.expires != null && aMs >= a.expires) { a.status = 'expired'; a.events.unshift({ at: a.expires, text: 'Expired.' }); out.push(a);
        if (wk) wk.inform(s, a.expires, 'Workshop', `${a.name} has run out`, `${a.name}${a.location && a.location.label ? ` in ${a.location.label}` : ''} stopped working.${a.kind === 'placed' ? ' Make a new one or let it go.' : ''}`); continue; }
      if (a.kind === 'placed' && a.permission === 'none') {
        if (a.lastCheckedWeek == null) { a.lastCheckedWeek = week; continue; }       // the first week is free
        while (a.lastCheckedWeek < week && a.status === 'active') {
          a.lastCheckedWeek++;
          if (rng() < discoveryChance(M, a.visibility, a.location && a.location.district)) {
            const who = watcher(M, a.location && a.location.district); a.status = 'removed'; addHeat(s, 1);
            a.events.unshift({ at: aMs, text: `Found and removed by ${who}. Heat +1.` }); out.push(a);
            if (wk) wk.inform(s, aMs, who, 'Unauthorized Installation Removed', `Your ${a.name}${a.location && a.location.label ? ` in ${a.location.label}` : ''} was found on property you don't control and removed. Your description is attached to the report. Heat +1.`);
          }
        }
      }
    }
    return out;
  }

  /* ---------- use, maintain, sell, close out ---------- */
  const find = (s, id) => ensure(s).artifacts.find(a => a.id === id) || null;
  function use(s, id, aMs, how) {
    const a = find(s, id); if (!a || a.status !== 'active' || a.uses == null) return { ok: false, msg: 'Nothing to use.' };
    a.uses--; let msg = `Used ${a.name}. ${a.effect}`;
    if (a.recipe === 'cover-papers' && how === 'lookup') { addHeat(s, 1); msg = 'The ACR lookup saw through it. Heat +1.'; }
    a.events.unshift({ at: aMs, text: how === 'lookup' ? 'Used against an ACR lookup: failed. Heat +1.' : 'Used.' });
    if (a.uses <= 0) { a.status = 'used'; a.events.unshift({ at: aMs, text: 'Used up.' }); }
    return { ok: true, msg };
  }
  function maintain(s, M, id, aMs) {
    const a = find(s, id), r = a && recipe(M, a.recipe); if (!a || a.status !== 'active' || !r || !r.maintain) return { ok: false, msg: 'This one cannot be maintained.' };
    if (downtimeLeft(s) < 1) return { ok: false, msg: 'No downtime actions left this gap.' };
    const keeper = s.character && s.character.subclass === 'Ward Keeper';
    spendDowntime(s, 1); if (!keeper && r.costs.stress) addStress(s, r.costs.stress);
    a.expires = Math.max(a.expires || aMs, aMs) + r.lifeDays * 86400000;
    a.events.unshift({ at: aMs, text: keeper ? 'Maintained (Ward Keeper: no casting cost).' : `Recast to keep it going: ${r.costs.stress || 0} Stress.` });
    return { ok: true, msg: keeper ? 'Maintained. Ward Keepers pay no Stress for this.' : `Recast for another ${r.lifeDays} days.` };
  }
  function salePrice(s, M, a, how) {
    const share = (M.market[how] || M.market.fence).share, uses = a.uses != null ? a.uses : 1, perUse = a.uses != null ? (recipe(M, a.recipe).uses || 1) : 1;
    const listing = ensure(s).artifacts.find(x => x.recipe === 'market-listing' && x.status === 'active');
    const bonus = listing ? 1 + (listing.bonus || 0) : 1;
    return { price: Math.round(a.value * (uses / perUse) * share * bonus), listing };
  }
  function sell(s, M, id, how, aMs) {
    const a = find(s, id); if (!a || a.status !== 'active' || !a.value || !a.permissions.transfer) return { ok: false, msg: 'This one is not for sale.' };
    const { price, listing } = salePrice(s, M, a, how);
    let cut = 0; if (listing) { cut = Math.round(price * recipe(M, 'market-listing').commission); listing.status = 'used'; listing.events.unshift({ at: aMs, text: `Sold ${a.name} for ${price}; took ${cut} commission.` }); }
    setCredits(s, credits(s) + price - (listing && listing.owner !== a.owner ? cut : 0));
    a.status = 'sold'; a.events.unshift({ at: aMs, text: `Sold ${how === 'street' ? 'on the street' : 'through a fence'} for ${price} cr.` });
    let msg = `Sold for ${price} credits.`;
    if (how === 'street' && a.legality === 'restricted') { addHeat(s, 1); a.events.unshift({ at: aMs, text: 'Restricted work sold in the open: Heat +1.' }); msg += ' Sold in the open: Heat +1.'; }
    return { ok: true, msg, price };
  }
  function complete(s, M, id, amount, aMs) {
    const a = find(s, id), r = a && recipe(M, a.recipe); if (!a || a.status !== 'active' || !r || !r.pay) return { ok: false, msg: 'Nothing to complete.' };
    const pay = clamp(Math.round(num(amount, r.pay[0])), r.pay[0], r.pay[1]);
    setCredits(s, credits(s) + pay); a.status = 'completed'; a.events.unshift({ at: aMs, text: `Completed. Paid ${pay} cr.` });
    return { ok: true, msg: `Paid ${pay} credits.` };
  }
  function retire(s, id, aMs) { const a = find(s, id); if (!a || !['active', 'pending'].includes(a.status)) return { ok: false }; a.status = 'retired'; a.events.unshift({ at: aMs, text: 'Retired by its owner.' }); return { ok: true, msg: `${a.name} retired.` }; }
  /* A ruling arrives (from a ruling code or a runner on this device). Denied proposals refund their materials. */
  function rule(s, id, approved, text, by, aMs) {
    const a = find(s, id); if (!a || a.status !== 'pending') return { ok: false };
    a.ruling = { ...a.ruling, status: approved ? 'approved' : 'denied', result: text || '', by: by || 'Session runner', at: aMs };
    a.status = approved ? 'active' : 'denied'; if (!approved && a.costs.credits) setCredits(s, credits(s) + a.costs.credits);
    a.events.unshift({ at: aMs, text: `Ruling by ${a.ruling.by}: ${approved ? 'approved' : 'denied'}${text ? `. ${text}` : ''}${!approved && a.costs.credits ? `. ${a.costs.credits} cr refunded` : ''}.` });
    return { ok: true };
  }
  /* Warden APA filing: the best active filing the character holds, for the Mail appeal bonus. */
  function apaFiling(s) { return ensure(s).artifacts.find(a => a.recipe === 'apa-filing' && a.status === 'active') || null; }
  function spendApaFiling(s, aMs, noticeTitle) { const a = apaFiling(s); if (!a) return 0; use(s, a.id, aMs); a.events.unshift({ at: aMs, text: `Attached to "${noticeTitle}": +2 dice on the appeal.` }); return 2; }

  /* ---------- Runner deliveries: real runs on the Explore map ---------- */
  const H = 3600000;
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  const between = (rng, [a, b]) => a + Math.floor(rng() * (b - a + 1));
  /* The board refreshes every few Adyta hours and is the same for this character until it does. */
  function board(s, M, PL, aMs) {
    const D = M.deliveries, slot = Math.floor(aMs / (D.refreshHours * H)), m = ensure(s), taken = new Set(m.takenJobs || []);
    const rng = seeded(hash(`${(s.character && s.character.name) || ''}|${slot}`)), places = PL.places.filter(p => PL.districts[p.district]), out = [];
    for (let i = 0; i < D.boardSize; i++) {
      const from = pick(rng, places); let to = null;
      const cross = rng() < 0.7;
      for (let k = 0; k < 20 && !to; k++) { const c = pick(rng, places); if (c.id !== from.id && (cross ? c.district !== from.district : c.district === from.district)) to = c; }
      if (!to) to = places.find(p => p.id !== from.id);
      const cargo = pick(rng, D.cargo), under = [from, to].some(p => PL.districts[p.district].layer === 'underground');
      const pay = Math.round((between(rng, from.district === to.district ? D.pay.sameDistrict : D.pay.crossDistrict) + (under ? D.pay.underground : 0)) * cargo.payMult / 5) * 5;
      const hours = between(rng, D.deadlineHours), id = `job-${slot}-${i}`;
      const spot = p => ({ district: p.district, place: p.id, name: p.name, districtName: PL.districts[p.district].name });
      out.push({ id, from: spot(from), to: spot(to), cargo, pay, hours, taken: taken.has(id) });
    }
    return out;
  }
  function here(s, aMs) { const pr = s.world && s.world.presence; if (!pr) return null; const t = pr.transit; return t && aMs >= t.arrives ? t.to : t ? null : pr.location; }
  function take(s, M, PL, jobId, aMs) {
    if ((s.character && s.character.class) !== 'Runner') return { ok: false, msg: 'Delivery runs are Runner work.' };
    const job = board(s, M, PL, aMs).find(j => j.id === jobId); if (!job || job.taken) return { ok: false, msg: 'That job is gone.' };
    if (downtimeLeft(s) < M.downtimeCost) return { ok: false, msg: 'No downtime actions left this gap. A delivery is a Side Job.' };
    const m = ensure(s), who = (s.character && s.character.name) || 'Someone';
    spendDowntime(s, M.downtimeCost); m.takenJobs = [jobId, ...(m.takenJobs || [])].slice(0, 30);
    const a = { id: `a-${aMs.toString(36)}-${m.artifacts.length}`, recipe: 'delivery-run', name: `${job.cargo.name}: ${job.from.name} to ${job.to.name}`, kind: 'job', class: 'Runner',
      creator: { name: who, class: 'Runner' }, owner: who, target: job.from.name, costs: { downtime: M.downtimeCost, credits: 0, stress: 0 },
      location: { district: job.from.district, label: job.from.districtName }, visibility: null, permission: null, created: aMs, expires: null, uses: null, value: 0,
      legality: job.cargo.legality, permissions: { use: 'owner', transfer: false }, effect: recipe(M, 'delivery-run').effect, status: 'active', roll: null,
      ruling: { needed: false, status: 'none' }, delivery: { ...job, due: aMs + job.hours * H, stage: 'pickup', taken: aMs }, events: [] };
    a.events.unshift({ at: aMs, text: `Took the job: ${job.cargo.name} from ${job.from.name} (${job.from.districtName}) to ${job.to.name} (${job.to.districtName}) for ${job.pay} cr. Due in ${job.hours} hours. Side Job: 1 downtime action.` });
    m.artifacts.unshift(a); const h = here(s, aMs); if (h && h.place === job.from.place) pickUp(a, aMs, 'You were already there.');
    return { ok: true, artifact: a, msg: a.delivery.stage === 'carrying' ? 'Picked up on the spot. Get it to the drop-off.' : `Head to ${job.from.name} to pick it up.` };
  }
  function pickUp(a, at, why) { a.delivery.stage = 'carrying'; a.delivery.pickedAt = at; a.location = { district: a.delivery.to.district, label: a.delivery.to.districtName }; a.events.unshift({ at, text: `Picked up at ${a.delivery.from.name}.${why ? ' ' + why : ''}` }); }
  /* Arrivals come from Explore (presence.arrivals); the current spot counts too. */
  function settleDelivery(s, M, a, aMs, out) {
    const D = M.deliveries, d = a.delivery, wk = WK(), pr = (s.world && s.world.presence) || {};
    const arrivals = [...(pr.arrivals || [])].filter(x => x.at >= d.taken).sort((x, y) => x.at - y.at);
    const now = here(s, aMs); if (now && now.place) arrivals.push({ at: aMs, district: now.district, place: now.place });
    for (const v of arrivals) {
      if (d.stage === 'pickup' && v.place === d.from.place) pickUp(a, v.at);
      else if (d.stage === 'carrying' && v.place === d.to.place && v.at >= (d.pickedAt || 0)) {
        const late = v.at > d.due, tooLate = v.at > d.due + D.lateGraceHours * H || (late && d.cargo.noLate);
        const pay = tooLate ? 0 : Math.round(d.pay * (late ? D.latePay : 1));
        if (pay) setCredits(s, credits(s) + pay);
        a.status = pay ? 'completed' : 'failed'; d.stage = 'delivered'; d.deliveredAt = v.at;
        a.events.unshift({ at: v.at, text: `Delivered to ${d.to.name}${late ? ' late' : ' on time'}. ${pay ? `Paid ${pay} cr.` : 'They won\'t pay for it now.'}` });
        if (wk) wk.inform(s, v.at, d.from.name, pay ? `Delivery paid: ${pay} cr` : 'Delivery refused', pay ? `${d.cargo.name} reached ${d.to.name}${late ? ' late. Half pay.' : ' on time.'}` : `${d.cargo.name} reached ${d.to.name} too late to matter.`);
        out.push(a); return;
      }
    }
    const limit = d.cargo.noLate ? d.due : d.due + D.lateGraceHours * H;
    if (aMs > limit) {
      a.status = 'failed'; const sealed = d.cargo.legality === 'restricted' && d.stage === 'carrying';
      if (sealed) addHeat(s, D.failHeat);
      a.events.unshift({ at: limit, text: `Never delivered.${sealed ? ` Sealed cargo went missing with your name on it: Heat +${D.failHeat}.` : ''}` });
      if (wk) wk.inform(s, limit, d.from.name, 'Delivery failed', `${d.cargo.name} for ${d.to.name} never arrived.${sealed ? ` Whoever sealed it wants to know where it went. Heat +${D.failHeat}.` : ''}`);
      out.push(a);
    }
  }

  const api = { ensure, board, take, here, recipe, recipesFor, downtimeLeft, preview, make, settle, use, maintain, salePrice, sell, complete, retire, rule, apaFiling, spendApaFiling, watcher, discoveryChance };
  root.GRAKK_MAKE = api;
})(typeof window !== 'undefined' ? window : globalThis);
