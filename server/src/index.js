/* The item-code server: a Cloudflare Worker in front of a D1 database.
   Every route is a JSON POST; the rules live in codes.js. */
import { createCodes } from './codes.js';

function d1Store(db) {
  const one = async (sql, ...a) => db.prepare(sql).bind(...a).first();
  const run = (sql, ...a) => db.prepare(sql).bind(...a).run();
  return {
    async getHolder(id) { const r = await one('SELECT data FROM holders WHERE id = ?', id); return r ? JSON.parse(r.data) : null; },
    async putHolder(h) { await run('INSERT INTO holders (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', h.id, JSON.stringify(h)); },
    async getItem(id) { const r = await one('SELECT data FROM items WHERE id = ?', id); return r ? JSON.parse(r.data) : null; },
    async putItem(it) { await run('INSERT INTO items (id, holder, status, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET holder = excluded.holder, status = excluded.status, data = excluded.data', it.id, it.holder, it.status, JSON.stringify(it)); },
    async itemByCode(hash) { const r = await one('SELECT i.data FROM codes c JOIN items i ON i.id = c.item WHERE c.hash = ?', hash); return r ? JSON.parse(r.data) : null; },
    async setCode(hash, item) { await run('INSERT OR REPLACE INTO codes (hash, item) VALUES (?, ?)', hash, item); },
    async dropCode(hash) { await run('DELETE FROM codes WHERE hash = ?', hash); },
    async heldBy(holder) { const r = await db.prepare("SELECT data FROM items WHERE holder = ? AND status != 'used'").bind(holder).all(); return r.results.map(x => JSON.parse(x.data)); },
    async addEvent(e) { await run('INSERT INTO events (holder, item, kind, text, at) VALUES (?, ?, ?, ?, ?)', e.holder, e.itemId || null, e.kind, e.text, e.at); },
    async eventsFor(holder, since) { const r = await db.prepare('SELECT seq, item AS itemId, kind, text, at FROM events WHERE holder = ? AND seq > ? ORDER BY seq LIMIT 100').bind(holder, since).all(); return r.results; },
    async count(bucket, windowMs) { const r = await one('SELECT COUNT(*) AS n FROM hits WHERE bucket = ? AND at > ?', bucket, Date.now() - windowMs); return r ? r.n : 0; },
    async hit(bucket, windowMs) {
      const n = await this.count(bucket, windowMs); await run('INSERT INTO hits (bucket, at) VALUES (?, ?)', bucket, Date.now());
      if (Math.random() < 0.02) await run('DELETE FROM hits WHERE at < ?', Date.now() - 86400000);   // keep the table small
      return n;
    },
  };
}

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean), origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (req.method === 'GET' && (path === '' || path === '/health')) return reply({ ok: true, service: 'grakkgrith-codes' });
    if (req.method !== 'POST') return reply({ ok: false, msg: 'POST only.' }, 405);
    let b; try { b = await req.json(); } catch { return reply({ ok: false, msg: 'Bad JSON.' }, 400); }
    const C = createCodes(d1Store(env.DB)), ip = req.headers.get('CF-Connecting-IP') || '';
    try {
      switch (path) {
        case '/mint': return reply(await C.mint(b.key, b.profile, b));
        case '/offer': return reply(await C.offer(b.key, b.itemId, b.on !== false));
        case '/claim': return reply(await C.claim(b.key, b.profile, b.code, { intent: b.intent, cover: b.cover, ip }));
        case '/scrub': return reply(await C.scrub(b.key, b.kitId, b.itemId));
        case '/trace': return reply(await C.trace(b.key, b.itemId, b.successes));
        case '/retire': return reply(await C.retire(b.key, b.itemId));
        case '/inbox': return reply(await C.inbox(b.key, b.profile, b.since));
        default: return reply({ ok: false, msg: 'No such route.' }, 404);
      }
    } catch (e) { return reply({ ok: false, msg: 'The server tripped. Try again.' }, 500); }
  },
};
