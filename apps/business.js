/* Player businesses: Books, Rep, Exposure, Commons protection, back-room offers and the loss ladder.
   Pure logic (window.GRAKK_BIZ). A business's running state lives in its owner's character file under
   state.business[<id>]; the business itself (name, places, owners, funding) is listed in data/businesses.json.
   There is no server: two owners on two devices each keep their own copy of the card.
   B = data/businesses.json. Mail goes through window.GRAKK_WEEK.inform when it's loaded.

   The week: sales come in (fewer when Rep is low, none when shuttered), upkeep goes out, and Exposure fades
   by one if nothing shady happened. Then the ladder: trouble, notice, shuttered, lost. Like rent, it climbs at
   most one step every few days, so a long break brings one warning, never a lost shop on login.
   Closed for the season pauses all of it. */
(function (root) {
  'use strict';
  const DAY = 86400000, WEEK = 7 * DAY, MONDAY0 = Date.UTC(1970, 0, 5);
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const weekIndex = aMs => Math.floor((aMs - MONDAY0) / WEEK);
  const fill = (t, ctx) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => ctx[k] != null ? ctx[k] : '');
  const credits = s => num(s.coins && s.coins.credits);
  const setCredits = (s, v) => { s.coins = s.coins || {}; s.coins.credits = String(Math.max(0, Math.round(v))); };
  const STEPS = ['open', 'trouble', 'notice', 'shuttered', 'lost'];

  function owned(s, B) { const n = String((s && s.character && s.character.name) || '').trim(); return n ? B.businesses.filter(b => (b.owners || []).includes(n)) : []; }
  function ensure(s, B, biz, aMs) {
    s.business = s.business || {};
    let c = s.business[biz.id];
    if (!c) c = s.business[biz.id] = { books: 0, rep: B.rules.economy.repStart, exposure: 0, protection: true, status: biz.status === 'season' ? 'season' : 'open', step: 0, lastStepAt: null, debtWeeks: 0, shutteredWeeks: 0, lastWeek: weekIndex(aMs), offer: null, log: [] };
    return c;
  }
  function log(c, aMs, text) { c.log.unshift({ at: aMs, text }); c.log.length = Math.min(c.log.length, 40); }
  function mail(s, aMs, biz, key, why, B) {
    const M = B.rules.mail[key], WK = root.GRAKK_WEEK; if (!M) return;
    const ctx = { business: biz.name, why };
    if (WK && WK.inform) WK.inform(s, aMs, biz.name, fill(M.title, ctx), fill(M.body, ctx));
  }
  function ownerHeat(s) { return num(s.stats && s.stats.heat); }
  /* Commons protection: independent money, nothing shady left un-evened, and an owner who isn't drawing attention. */
  function isProtected(s, B, biz) { const c = s.business && s.business[biz.id]; return biz.funding !== 'corporate' && !!(c ? c.protection !== false : true) && ownerHeat(s) < B.rules.protection.ownerHeatBreaks; }
  function protectionWhy(s, B, biz) {
    if (biz.funding === 'corporate') return 'Corporate money: the Commons never covers it.';
    const c = s.business && s.business[biz.id];
    if (c && c.protection === false) return 'Something happened here. Make it even with the neighborhood.';
    if (ownerHeat(s) >= B.rules.protection.ownerHeatBreaks) return `The owner's Heat is ${ownerHeat(s)}. Get it under ${B.rules.protection.ownerHeatBreaks}.`;
    return 'The neighborhood keeps trouble off the doorstep.';
  }

  function troubleWhy(c) {
    const r = [];
    if (c.books < 0) r.push(`the books are ${-c.books} credits in the red`);
    if (c.rep <= 1) r.push('the neighborhood has stopped coming in');
    if (c.exposure >= 2) r.push(`Exposure is ${c.exposure}`);
    return r.join(', ');
  }
  function noticeWhy(c, B) { return c.exposure >= 4 ? `Exposure ${c.exposure} brought an inspection` : c.debtWeeks >= B.rules.noticeWeeks ? `${c.debtWeeks} weeks in the red` : ''; }

  function climb(s, B, biz, c, aMs, to, why) {
    const gap = B.rules.economy.stepGapDays * DAY;
    if (c.lastStepAt != null && aMs - c.lastStepAt < gap) return false;
    to = Math.min(to, c.step + 1);   // never skip a step: every one is warned before the next
    c.step = to; c.lastStepAt = aMs;
    const key = STEPS[to];
    if (key === 'shuttered') { c.status = 'shuttered'; c.shutteredWeeks = 0; }
    if (key === 'lost') { c.status = 'lost'; c.lostAt = aMs; }
    log(c, aMs, `${key[0].toUpperCase() + key.slice(1)}${why ? `: ${why}` : ''}.`); mail(s, aMs, biz, key, why, B);
    return true;
  }

  function settle(s, B, aMs) {
    const E = B.rules.economy, events = [];
    for (const biz of owned(s, B)) {
      const c = ensure(s, B, biz, aMs), cur = weekIndex(aMs);
      if (c.status === 'lost' || c.status === 'season') { c.lastWeek = cur; continue; }
      const from = Math.max(c.lastWeek + 1, cur - E.maxCatchUpWeeks + 1);
      for (let k = from; k <= cur; k++) {
        const rng = seeded(hash(`${biz.id}|sales|${k}`)), base = E.sales[0] + Math.floor(rng() * (E.sales[1] - E.sales[0] + 1));
        const sales = c.status === 'shuttered' ? 0 : Math.round(base * clamp(c.rep, 0, E.repMax) / E.repStart);
        c.books += sales - E.upkeep;
        if (!(c.offer && c.offer.week === k - 1 && c.offer.taken)) c.exposure = Math.max(0, c.exposure - E.exposureDecay);
        c.debtWeeks = c.books < 0 ? c.debtWeeks + 1 : 0;
        if (c.status === 'shuttered') c.shutteredWeeks++;
        log(c, aMs, `Week: ${sales} in sales, ${E.upkeep} upkeep. Books ${c.books}.`);
        events.push({ biz: biz.id, week: k, sales });
      }
      c.lastWeek = cur;
      // The ladder, at most one step per settle and never faster than stepGapDays.
      const crisis = ownerHeat(s) >= 6 && c.exposure >= 4;
      if (c.status === 'shuttered') {
        if (c.shutteredWeeks >= B.rules.lostAfterShutteredWeeks || crisis) climb(s, B, biz, c, aMs, 4, crisis ? 'a Heat 6 crisis landed on the building' : `${c.shutteredWeeks} weeks shuttered`);
      } else if (crisis) climb(s, B, biz, c, aMs, c.step >= 2 ? 3 : 2, 'a Heat 6 crisis is aimed at the building');
      else if (noticeWhy(c, B)) climb(s, B, biz, c, aMs, c.step >= 2 ? 3 : 2, noticeWhy(c, B));
      else if (troubleWhy(c)) { if (c.step < 1) climb(s, B, biz, c, aMs, 1, troubleWhy(c)); }
      else if (c.step > 0) { c.step = 0; c.lastStepAt = null; log(c, aMs, 'Trouble cleared.'); }
    }
    return events;
  }

  /* This week's back-room offer, the same all week. One a week at most, only while open. */
  function offer(s, B, biz, aMs) {
    const c = ensure(s, B, biz, aMs), k = weekIndex(aMs), O = B.rules.offers;
    if (c.status !== 'open') return null;
    if (c.offer && c.offer.week === k) return c.offer.answered ? null : O.list.find(o => o.id === c.offer.id) || null;
    const rng = seeded(hash(`${biz.id}|offer|${k}`));
    if (rng() >= O.chance) return null;
    const o = O.list[Math.floor(rng() * O.list.length)]; c.offer = { week: k, id: o.id, answered: false, taken: false };
    return o;
  }
  function answerOffer(s, B, biz, aMs, yes) {
    const c = ensure(s, B, biz, aMs), o = offer(s, B, biz, aMs);
    if (!o) return { ok: false, msg: 'No offer this week.' };
    c.offer.answered = true; c.offer.taken = !!yes;
    if (!yes) { log(c, aMs, `Turned down: ${o.title}.`); return { ok: true, msg: 'You said no. Nothing happens. That was the point.' }; }
    const wasProtected = c.protection !== false;
    c.books += o.pay; c.exposure += o.exposure; c.protection = false;
    log(c, aMs, `Took it: ${o.title}. Books +${o.pay}, Exposure +${o.exposure}.`);
    if (wasProtected) mail(s, aMs, biz, 'protectionLost', '', B);
    return { ok: true, msg: `${o.pay} credits in the till. Exposure +${o.exposure}. The neighborhood will hear about it.` };
  }
  function makeEven(s, B, biz, aMs) {
    const c = ensure(s, B, biz, aMs), cost = B.rules.economy.makeEvenFavor;
    if (c.protection !== false) return { ok: false, msg: 'Nothing to make even.' };
    if (c.exposure > 0) return { ok: false, msg: `Exposure is still ${c.exposure}. It has to be zero first.` };
    if (credits(s) < cost) return { ok: false, msg: `The favor costs ${cost} credits of your own.` };
    setCredits(s, credits(s) - cost); c.protection = true;
    log(c, aMs, `Made it even with the neighborhood (${cost} credits of favor).`); mail(s, aMs, biz, 'protectionBack', '', B);
    return { ok: true, msg: 'Square with the neighborhood. Protection is back.' };
  }
  function moveMoney(s, B, biz, aMs, amount) {   // + puts your money in the till, - takes it out
    const c = ensure(s, B, biz, aMs), a = Math.round(num(amount));
    if (!a) return { ok: false, msg: 'How much?' };
    if (a > 0 && credits(s) < a) return { ok: false, msg: `You have ${credits(s)} credits.` };
    if (a < 0 && (c.books < -a || c.status === 'shuttered')) return { ok: false, msg: c.status === 'shuttered' ? 'The till is frozen while shuttered.' : `The books hold ${Math.max(0, c.books)}.` };
    if (a < 0 && -a > B.rules.economy.tillMax) return { ok: false, msg: `Take at most ${B.rules.economy.tillMax} at a time.` };
    setCredits(s, credits(s) - a); c.books += a;
    log(c, aMs, a > 0 ? `Put ${a} credits into the books.` : `Took ${-a} credits from the till.`);
    return { ok: true, msg: a > 0 ? `Books are at ${c.books}.` : `${-a} credits to you.` };
  }
  function setSeason(s, B, biz, aMs, closed) {
    const c = ensure(s, B, biz, aMs);
    if (c.status === 'lost') return { ok: false, msg: "It isn't yours any more." };
    if (closed) { if (c.status === 'shuttered') return { ok: false, msg: "A shuttered place can't close for the season. Reopen it first." }; c.status = 'season'; log(c, aMs, 'Closed for the season.'); return { ok: true, msg: 'Closed for the season. Upkeep and trouble pause.' }; }
    if (c.status !== 'season') return { ok: false, msg: 'It is open.' };
    c.status = 'open'; c.lastWeek = weekIndex(aMs); log(c, aMs, 'Open again.'); return { ok: true, msg: 'Open again.' };
  }
  function reopen(s, B, biz, aMs) {
    const c = ensure(s, B, biz, aMs);
    if (c.status !== 'shuttered') return { ok: false, msg: 'It is not shuttered.' };
    if (c.books < 0) return { ok: false, msg: `Clear the books first: ${-c.books} credits in the red.` };
    if (c.exposure >= 4) return { ok: false, msg: `Exposure is ${c.exposure}. Get it under 4, or win an appeal.` };
    c.status = 'open'; c.step = 0; c.lastStepAt = null; c.shutteredWeeks = 0; c.debtWeeks = 0;
    log(c, aMs, 'Reopened.'); return { ok: true, msg: 'Doors open again.' };
  }

  root.GRAKK_BIZ = { owned, ensure, settle, offer, answerOffer, makeEven, moveMoney, setSeason, reopen, isProtected, protectionWhy, troubleWhy, weekIndex };
})(typeof window !== 'undefined' ? window : globalThis);
