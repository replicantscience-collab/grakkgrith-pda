/* Item codes: the shared record of who holds what (design doc: "Item Codes: Trading, Theft and Scrubbing").
   Pure logic over a small store interface, so it runs the same in the Cloudflare Worker (D1) and in Node tests (memory).
   A code is never stored, only its SHA-256 hash: the server can check a code, not read one out.
   Players have no accounts. Each character's PDA makes a random secret key; the server keeps only its hash as the holder id. */

export const GRADES = ['street', 'connected', 'restricted', 'corporate'];
export const gradeRank = g => Math.max(0, GRADES.indexOf(g));
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';                   // Crockford base32: no I, L, O or U
const DAY = 86400000;

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/* GRK-XXXX-XXXX-XX: 10 random characters, about 50 bits. Typed codes are forgiving: case, spaces, dashes, O for 0, I or L for 1. */
export function newCode() {
  const r = new Uint8Array(10); crypto.getRandomValues(r);
  const c = [...r].map(b => ALPHABET[b % 32]).join('');
  return `GRK-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}
export function normalizeCode(text) {
  const raw = String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/^GRK/, '');
  return raw.length === 10 && [...raw].every(ch => ALPHABET.includes(ch)) ? `GRK-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}` : null;
}

/* store: { getHolder(id), putHolder(h), getItem(id), putItem(item), itemByCode(hash), setCode(hash, itemId), dropCode(hash),
            heldBy(holderId), addEvent(ev), eventsFor(holderId, sinceSeq),
            hit(bucket, windowMs) records one and returns how many came before it, count(bucket, windowMs) only looks } */
export function createCodes(store, opt = {}) {
  const now = opt.now || (() => Date.now());
  const LIMITS = { writes: 120, misses: 12, windowMs: 3600000, ...(opt.limits || {}) };
  const fail = (msg, extra = {}) => ({ ok: false, msg, ...extra });
  const clean = s => String(s || '').slice(0, 60);

  async function me(key, profile) {
    if (!key || String(key).length < 32) return null;
    const id = await sha256('holder:' + key), h = (await store.getHolder(id)) || { id, name: '', staysOut: true, created: now() };
    if (profile) { if (profile.name != null) h.name = clean(profile.name); if (profile.staysOut != null) h.staysOut = !!profile.staysOut; if (profile.district != null) h.district = clean(profile.district); }
    h.updated = now(); await store.putHolder(h); return h;
  }
  async function limited(bucket, max) { return (await store.hit(bucket, LIMITS.windowMs)) > max; }
  async function event(holder, itemId, kind, text) { if (holder) await store.addEvent({ holder, itemId, kind, text, at: now() }); }
  async function assign(item) { const code = newCode(); const hash = await sha256('code:' + code); if (item.codeHash) await store.dropCode(item.codeHash); item.codeHash = hash; await store.setCode(hash, item.id); return code; }
  const view = it => ({ id: it.id, card: it.card, grade: it.grade, kind: it.kind, kitGrade: it.kitGrade || null, status: it.status, stolen: !!it.stolen });

  /* A new item from the Workshop gets its code here. Only the maker sees it. */
  async function mint(key, profile, { card, grade, kind, kitGrade } = {}) {
    const h = await me(key, profile); if (!h) return fail('No PDA key.');
    if (await limited('w:' + h.id, LIMITS.writes)) return fail('Too many requests. Try again in a bit.');
    if (!card || typeof card !== 'object' || !card.name) return fail('Nothing to put a code on.');
    const item = { id: 'it-' + (await sha256(h.id + now() + Math.random())).slice(0, 16), card: { ...card, events: undefined }, grade: GRADES.includes(grade) ? grade : 'street',
      kind: kind === 'kit' ? 'kit' : 'item', kitGrade: kind === 'kit' && GRADES.includes(kitGrade) ? kitGrade : null,
      holder: h.id, maker: h.id, status: 'held', stolen: false, trail: null, prev: [], cold: {}, created: now(), updated: now() };
    const code = await assign(item); await store.putItem(item);
    return { ok: true, code, item: view(item) };
  }

  /* Offer it: the next person to claim the code gets it as a gift, not a theft. */
  async function offer(key, itemId, on = true) {
    const h = await me(key); const it = h && await store.getItem(itemId);
    if (!it || it.holder !== h.id || it.status === 'used') return fail('That isn\'t yours to offer.');
    it.status = on ? 'offered' : 'held'; it.updated = now(); await store.putItem(it);
    return { ok: true, item: view(it) };
  }

  /* Claim a code. intent 'gift' only goes through if the holder offered it; intent 'take' is a theft,
     refused when the holder stays out of crime and the item is Street or Connected (unless it was already stolen). */
  async function claim(key, profile, text, { intent = 'gift', cover = 0, ip = '' } = {}) {
    const h = await me(key, profile); if (!h) return fail('No PDA key.');
    if ((await store.count('m:' + h.id, LIMITS.windowMs)) >= LIMITS.misses || (ip && (await store.count('mip:' + ip, LIMITS.windowMs)) >= LIMITS.misses * 3)) return fail('Too many wrong codes. The city stops answering for a while.', { locked: true });
    const code = normalizeCode(text); const it = code && await store.itemByCode(await sha256('code:' + code));
    if (!it || it.status === 'used') { await store.hit('m:' + h.id, LIMITS.windowMs); if (ip) await store.hit('mip:' + ip, LIMITS.windowMs); return fail('No item answers to that code.'); }
    if (it.holder === h.id) return { ok: true, already: true, item: view(it), code };
    const victim = await store.getHolder(it.holder);
    const protectedItem = !!(victim && victim.staysOut) && gradeRank(it.grade) <= 1 && !it.stolen;
    if (it.status === 'offered') {
      const from = it.holder; it.prev.push(from); it.holder = h.id; it.status = 'held'; it.updated = now(); await store.putItem(it);
      await event(from, it.id, 'given', `${it.card.name} was claimed. It's theirs now.`);
      return { ok: true, gift: true, item: view(it), code };
    }
    if (intent !== 'take') return fail('That code isn\'t being offered. Claiming it anyway would be theft.', { notOffered: true, protected: protectedItem, grade: it.grade, name: it.card.name });
    if (protectedItem) return fail(`${it.card.name} is ${it.grade} gear held by someone who stays out of crime. It can't be taken.`, { protected: true });
    const from = it.holder; it.prev.push(from); it.holder = h.id; it.status = 'held'; it.stolen = true;
    it.trail = { thief: h.id, thiefName: h.name, district: h.district || '', cover: Math.max(0, Math.floor(Number(cover) || 0)), at: now(), victim: from };
    it.updated = now(); await store.putItem(it);
    await event(from, it.id, 'taken', `${it.card.name} is gone. Someone used its code.`);
    return { ok: true, theft: true, item: view(it), code };
  }

  /* Use a scrub kit on one of your own items: new code (only you see it), old code dead, trail gone, the kit used up. */
  async function scrub(key, kitId, itemId) {
    const h = await me(key); if (!h) return fail('No PDA key.');
    const kit = await store.getItem(kitId), it = await store.getItem(itemId);
    if (!kit || kit.kind !== 'kit' || kit.holder !== h.id || kit.status === 'used') return fail('You don\'t hold that scrub kit.');
    if (!it || it.holder !== h.id || it.status === 'used' || it.id === kit.id) return fail('You don\'t hold that item.');
    if (gradeRank(kit.kitGrade) < gradeRank(it.grade)) return fail(`That kit cleans up to ${kit.kitGrade}; ${it.card.name} is ${it.grade}.`);
    kit.status = 'used'; if (kit.codeHash) await store.dropCode(kit.codeHash); kit.codeHash = null; kit.updated = now(); await store.putItem(kit);
    const code = await assign(it); it.status = 'held';
    if (it.trail) it.trail = { ...it.trail, scrubbed: now() };
    it.stolen = false; it.updated = now(); await store.putItem(it);
    return { ok: true, code, item: view(it), kit: view(kit) };
  }

  /* Trace something taken from you: your successes against the thief's cover. Win: who holds it. Tie: which district. Lose: cold for a week. */
  async function trace(key, itemId, successes) {
    const h = await me(key); const it = h && await store.getItem(itemId);
    if (!it || !(it.prev || []).includes(h.id)) return fail('You never held that.');
    if (!it.trail || it.trail.victim !== h.id) return fail('There\'s no trail to follow.');
    if (it.trail.scrubbed) return { ok: true, result: 'scrubbed', msg: 'The trail ends. Whoever has it now had it scrubbed.' };
    const cold = (it.cold || {})[h.id]; if (cold && cold > now()) return { ok: true, result: 'cold', msg: 'The trail is cold. Try again next week.', until: cold };
    const n = Math.max(0, Math.floor(Number(successes) || 0)), c = it.trail.cover;
    if (n > c) { const holder = await store.getHolder(it.holder); return { ok: true, result: 'found', msg: `${it.card.name} is with ${holder && holder.name || 'someone who never gave a name'}.`, holder: holder && holder.name || '' }; }
    if (n === c) return { ok: true, result: 'district', msg: it.trail.district ? `It was taken by someone in ${it.trail.district}.` : 'You get close, but the trail runs out.', district: it.trail.district };
    it.cold = { ...(it.cold || {}), [h.id]: now() + 7 * DAY }; await store.putItem(it);
    return { ok: true, result: 'lost', msg: 'You lose the trail. It goes cold for a week.' };
  }

  /* Sold to the city, used up or retired: the code dies. */
  async function retire(key, itemId) {
    const h = await me(key); const it = h && await store.getItem(itemId);
    if (!it || it.holder !== h.id) return fail('That isn\'t yours.');
    it.status = 'used'; if (it.codeHash) await store.dropCode(it.codeHash); it.codeHash = null; it.updated = now(); await store.putItem(it);
    return { ok: true };
  }

  /* What changed for you: news since your last look, and everything you hold now. */
  async function inbox(key, profile, since = 0) {
    const h = await me(key, profile); if (!h) return fail('No PDA key.');
    const events = await store.eventsFor(h.id, Number(since) || 0), held = await store.heldBy(h.id);
    return { ok: true, events, held: held.map(view) };
  }

  return { mint, offer, claim, scrub, trace, retire, inbox };
}

/* In-memory store for tests and local runs. */
export function memoryStore() {
  const holders = new Map(), items = new Map(), codes = new Map(), events = [], hits = new Map();
  let seq = 0;
  return {
    async getHolder(id) { return holders.get(id) ? structuredClone(holders.get(id)) : null; },
    async putHolder(h) { holders.set(h.id, structuredClone(h)); },
    async getItem(id) { return items.get(id) ? structuredClone(items.get(id)) : null; },
    async putItem(it) { items.set(it.id, structuredClone(it)); },
    async itemByCode(hash) { const id = codes.get(hash); return id ? this.getItem(id) : null; },
    async setCode(hash, id) { codes.set(hash, id); },
    async dropCode(hash) { codes.delete(hash); },
    async heldBy(holder) { return [...items.values()].filter(i => i.holder === holder && i.status !== 'used').map(i => structuredClone(i)); },
    async addEvent(ev) { events.push({ ...ev, seq: ++seq }); },
    async eventsFor(holder, since) { return events.filter(e => e.holder === holder && e.seq > since); },
    async hit(bucket, windowMs) { const t = Date.now(), list = (hits.get(bucket) || []).filter(x => t - x < windowMs); list.push(t); hits.set(bucket, list); return list.length - 1; },
    async count(bucket, windowMs) { const t = Date.now(); return (hits.get(bucket) || []).filter(x => t - x < windowMs).length; },
  };
}
