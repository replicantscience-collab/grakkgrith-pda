/* Trade codes: how items (and later Word) move between players without a server.
   A code is attached to an item when the item is made. The code IS the item: a compressed, self-contained
   record you paste in Discord. Whoever has the code can claim it, so a code can be stolen. Passing an item
   writes the receiver's name into the code; claiming a code that wasn't written for you marks the item
   as taken, and using a taken item adds Heat the first time. Ghost, Wrench, Signal and Broker can Scrub
   an item: a new code, clean again, at a price that climbs with the item's tier.

   No server: nothing can revoke an old code, so two people can both claim one. The receiver's sheet refuses
   a duplicate of something it already holds, and every claimed item carries its chain of hands. Honest play
   covers the rest until a registry exists; see `registry` below, which is where that plugs in.

   Pure logic (window.GRAKK_TRADE). Codes look like GRK1-<base64url>. */
(function (root) {
  'use strict';
  const PREFIX = 'GRK1-';
  const TE = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null, TD = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  /* ---------- bytes ---------- */
  const b64u = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'); return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = str => { const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4); const s = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  async function pump(bytes, Stream, mode) {
    if (typeof Stream !== 'function') return null;
    const st = new Stream(mode), w = st.writable.getWriter(); w.write(bytes); w.close();
    const rd = st.readable.getReader(), chunks = []; let n = 0;
    for (;;) { const { value, done } = await rd.read(); if (done) break; chunks.push(value); n += value.length; }
    const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
  }
  /* First byte says how the rest is packed: 1 = deflate-raw, 0 = plain. */
  async function encode(payload) {
    const raw = TE.encode(JSON.stringify(payload));
    const z = await pump(raw, root.CompressionStream, 'deflate-raw').catch(() => null);
    const body = z && z.length < raw.length ? z : raw, out = new Uint8Array(body.length + 1); out[0] = body === z ? 1 : 0; out.set(body, 1);
    return PREFIX + b64u(out);
  }
  async function decode(code) {
    const str = String(code || '').trim().replace(/\s+/g, '');
    if (!str.startsWith(PREFIX)) throw new Error('Not a trade code.');
    const bytes = unb64u(str.slice(PREFIX.length)), body = bytes.subarray(1);
    const raw = bytes[0] === 1 ? await pump(body, root.DecompressionStream, 'deflate-raw') : body;
    if (!raw) throw new Error('This device cannot read compressed codes.');
    const p = JSON.parse(TD.decode(raw)); if (!p || p.v !== 1 || !p.t) throw new Error('Not a trade code.'); return p;
  }

  /* ---------- ids ---------- */
  const rand = n => { const a = new Uint8Array(n); if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a); else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); return b64u(a); };
  const newId = () => 'it-' + rand(6), newSecret = () => rand(9);
  const norm = s => String(s || '').trim().toLowerCase();
  const me = s => String((s && s.character && s.character.name) || '').trim();

  /* ---------- the trade record on an item ---------- */
  /* item.trade = { id, secret, by (maker), issued (Adyta ms), holder, taken, hot, scrubbed, passed, chain: [{from,to,at}] } */
  function issue(item, s, aMs) {
    if (!item || item.trade) return item;
    item.trade = { id: newId(), secret: newSecret(), by: me(s) || 'Unknown', issued: aMs, holder: me(s) || '', taken: false, hot: false, scrubbed: 0, passed: null, chain: [] };
    return item;
  }
  const tier = item => { const t = Number(item && item.pattern && item.pattern.tier) || Number(item && item.grade); return t >= 1 && t <= 5 ? Math.floor(t) : 1; };
  /* What travels in a code. Images are dropped unless they're small: Discord won't take a 40 KB code. */
  function portable(item, keepImg = 12000) {
    const copy = JSON.parse(JSON.stringify(item));
    if (copy.img && String(copy.img).length > keepImg) copy.img = '';
    if (copy.shopIcon && String(copy.shopIcon).length > keepImg) copy.shopIcon = '';
    delete copy.trade; return copy;
  }
  async function codeFor(item, s, aMs, to = null) {
    if (!item || !item.trade) throw new Error('This item has no trade code.');
    const t = item.trade;
    return encode({ v: 1, t: 'item', id: t.id, secret: t.secret, by: t.by, from: me(s) || t.holder, to: to ? String(to).trim() : null, at: aMs, scrubbed: t.scrubbed || 0, chain: t.chain || [], item: portable(item) });
  }
  /* Hand it over: the code names the receiver. The item leaves your inventory (there is no server to stop you keeping it; the game trusts you). */
  async function pass(s, idx, to, aMs) {
    const inv = s.inventory || [], item = inv[idx]; if (!item || !item.trade) return { ok: false, msg: 'This item has no trade code.' };
    const name = String(to || '').trim(); if (!name) return { ok: false, msg: 'Say who it goes to.' };
    const code = await codeFor(item, s, aMs, name);
    item.trade.passed = { to: name, at: aMs };
    return { ok: true, code, msg: `Code for ${name}. Paste it to them; the item is theirs once they claim it.` };
  }
  /* Claim a code. Clean if it was written for you (or you made it); otherwise it's taken. */
  async function claim(s, code, aMs, opts = {}) {
    let p; try { p = await decode(code); } catch (e) { return { ok: false, msg: e.message }; }
    if (p.t !== 'item') return { ok: false, msg: `That is a ${p.t} code, not an item.`, payload: p };
    const who = me(s), inv = s.inventory || [];
    if (inv.some(x => x && x.trade && x.trade.id === p.id)) return { ok: false, msg: 'You already hold this item.' };
    const clean = (p.to && norm(p.to) === norm(who)) || (!p.to && norm(p.by) === norm(who) && !p.chain.length);
    const item = p.item || {}; if (typeof opts.normalize === 'function') Object.assign(item, opts.normalize(item));
    item.trade = { id: p.id, secret: p.secret, by: p.by, issued: p.at, holder: who, taken: !clean, hot: false, scrubbed: p.scrubbed || 0, passed: null,
      chain: [...(p.chain || []), { from: p.from || p.by, to: who, at: aMs, clean }].slice(-12) };
    let slot = opts.slot; if (slot == null || (inv[slot] && (inv[slot].name || inv[slot].img))) slot = inv.findIndex(x => !x || !(x.name || x.img));
    if (slot < 0) return { ok: false, msg: 'No empty inventory slot.' };
    inv[slot] = item;
    return { ok: true, slot, item, clean, msg: clean ? `${item.name || 'Item'} is yours.` : `${item.name || 'Item'} claimed. It wasn't written for you: it's taken, and using it adds Heat.` };
  }
  /* First use of a taken item: Heat +1, and it stays hot until scrubbed. Returns the note, or ''. */
  function hotUse(s, item) {
    if (!item || !item.trade || !item.trade.taken || item.trade.hot) return '';
    item.trade.hot = true; s.stats = s.stats || {}; const cap = Number(s.character && s.character.level) >= 17 ? 8 : Number(s.character && s.character.level) >= 7 ? 7 : 6;
    s.stats.heat = String(Math.min(cap, (Number(s.stats.heat) || 0) + 1));
    return `${item.name || 'That item'} isn't yours on paper. Someone noticed: Heat +1.`;
  }
  /* Scrub: new code, clean. Ghost also wipes the maker mark. Price climbs with tier. */
  const SCRUBBERS = ['Ghost', 'Wrench', 'Signal', 'Broker'];
  const scrubCost = item => [0, 20, 40, 80, 160, 320][tier(item)];
  function scrub(s, idx, aMs) {
    const inv = s.inventory || [], item = inv[idx], cls = s.character && s.character.class;
    if (!item || !item.trade) return { ok: false, msg: 'This item has no trade code to scrub.' };
    if (!SCRUBBERS.includes(cls)) return { ok: false, msg: 'Scrubbing is Ghost, Wrench, Signal or Broker work.' };
    const cost = scrubCost(item), credits = Number(s.coins && s.coins.credits) || 0;
    if (credits < cost) return { ok: false, msg: `Scrubbing a tier ${tier(item)} item costs ${cost} cr; you have ${credits}.` };
    s.coins = s.coins || {}; s.coins.credits = String(credits - cost);
    const t = item.trade; t.secret = newSecret(); t.taken = false; t.hot = false; t.scrubbed = (t.scrubbed || 0) + 1; t.passed = null; t.chain = [];
    if (cls === 'Ghost') { item.shopName = ''; item.shopIcon = ''; }
    return { ok: true, cost, msg: `Scrubbed for ${cost} cr. New code, clean hands${cls === 'Ghost' ? ', maker mark gone' : ''}.` };
  }
  /* Where a shared registry would plug in: claim/pass/scrub would be posted here so old codes die. Null until one exists. */
  const registry = null;
  root.GRAKK_TRADE = { PREFIX, encode, decode, issue, codeFor, pass, claim, hotUse, scrub, scrubCost, tier, portable, SCRUBBERS, registry };
})(typeof window !== 'undefined' ? window : globalThis);
