/* GRAKK_TALK: talk to an NPC, Final Fantasy style. A scene up top (slow drift, steam), a dialogue window below
   with the NPC's portrait (breathes at idle, bobs while talking), typewriter text, a blinking ▼, and a choice
   menu with a ☞ cursor. Shops open as a list in the same window.
   Controls: tap or click, Enter or Space to advance, arrow keys to move, Escape to leave.
   Reduced motion: no drift, steam, bob or typewriter; text appears whole.
   Lines and choices are data (data/scenes.json, npcs). The page supplies what the NPC can know and do:
     GRAKK_TALK.open(npc, { base, vars(), when(cond), act(name, choice) -> node id | false, buy(item) -> node id, credits(), onClose })
*/
(function () {
  'use strict';
  const CSS = `
.gTalk{position:fixed;inset:0;z-index:9990;display:flex;flex-direction:column;background:#05050b;color:#fff;font-family:"Atkinson Hyperlegible",system-ui,sans-serif}
.gTalk .tStage{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}
.gTalk .tStage img{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;object-position:var(--focus,50%) 50%;animation:tDrift 22s ease-in-out infinite alternate}
.gTalk .tStage::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(5,5,11,.75) 100%),linear-gradient(transparent 60%,rgba(5,5,11,.9))}
.gTalk .puff{position:absolute;bottom:0;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,rgba(255,240,220,.38),rgba(255,240,220,0) 70%);filter:blur(4px);animation:tPuff 4.2s ease-out infinite;opacity:0}
.gTalk .tWin{position:relative;flex:0 0 auto;display:flex;gap:14px;margin:0 12px 12px;padding:14px 16px 16px;min-height:170px;border:3px solid #e9e4f5;border-radius:10px;background:linear-gradient(180deg,#26307a 0%,#141a4a 100%);box-shadow:0 0 0 2px #0a0d26,0 10px 30px rgba(0,0,0,.6);animation:tRise .28s ease-out both}
.gTalk .tFace{flex:0 0 auto;width:120px;height:120px;border:2px solid #e9e4f5;border-radius:6px;overflow:hidden;background:#0a0d26}
.gTalk .tFace img{width:100%;height:100%;object-fit:cover;object-position:50% 20%;transform-origin:50% 90%;animation:tBreathe 3.4s ease-in-out infinite}
.gTalk .tFace.talking img{animation:tBreathe 3.4s ease-in-out infinite,tBob .22s steps(2) infinite}
.gTalk .tBody{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.gTalk .tName{align-self:flex-start;margin:-28px 0 6px;padding:1px 12px;border:2px solid #e9e4f5;border-radius:6px;background:#141a4a;font:700 15px/1.5 "Saira Condensed","Arial Narrow",sans-serif;letter-spacing:.14em;text-transform:uppercase}
.gTalk .tText{margin:0;min-height:3em;font:600 19px/1.5 "Atkinson Hyperlegible",system-ui,sans-serif;text-shadow:2px 2px 0 #0a0d26;white-space:pre-wrap}
.gTalk .tMore{position:absolute;right:16px;bottom:10px;font-size:16px;animation:tBlink 1s steps(2) infinite}
.gTalk .tChoices{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:2px}
.gTalk .tChoices button{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;margin:0;padding:2px 6px 2px 30px;border:0;border-radius:4px;background:transparent;box-shadow:none;color:#fff;font:600 17px/1.3 "Atkinson Hyperlegible",system-ui,sans-serif;text-align:left;text-transform:none;letter-spacing:0;text-shadow:2px 2px 0 #0a0d26;cursor:pointer;position:relative}
.gTalk .tChoices button:disabled{opacity:.45;cursor:default}
.gTalk .tChoices button.on::before{content:'☞';position:absolute;left:4px;top:50%;transform:translateY(-50%);font-size:20px;animation:tPoint .5s ease-in-out infinite alternate}
.gTalk .tChoices button:focus-visible{outline:2px solid #ffd77a;outline-offset:1px}
.gTalk .tChoices .price{margin-left:auto;color:#ffd77a}
.gTalk .tInfo{margin-top:6px;color:#c9c6e8;font-size:14px}
.gTalk .tSkip{position:absolute;top:10px;right:12px;z-index:2;min-height:36px;padding:4px 12px;border:2px solid #e9e4f5;border-radius:6px;background:rgba(20,26,74,.85);color:#fff;font:700 13px "Saira Condensed",sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.gTalk .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@keyframes tDrift{0%{transform:translate(-1.5%,0) scale(1)}100%{transform:translate(1.5%,-1%) scale(1.04)}}
@keyframes tPuff{0%{transform:translate(0,0) scale(.5);opacity:0}20%{opacity:.9}100%{transform:translate(12px,-150px) scale(2);opacity:0}}
@keyframes tRise{0%{transform:translateY(24px);opacity:0}100%{transform:none;opacity:1}}
@keyframes tBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.018)}}
@keyframes tBob{0%{translate:0 0}100%{translate:0 -2px}}
@keyframes tBlink{0%{opacity:1}100%{opacity:0}}
@keyframes tPoint{0%{translate:0 0}100%{translate:3px 0}}
@media (max-width:560px){.gTalk .tWin{gap:10px;padding:12px;min-height:200px}.gTalk .tFace{width:76px;height:76px}.gTalk .tText{font-size:17px}}
@media (prefers-reduced-motion:reduce){.gTalk .tStage img,.gTalk .puff,.gTalk .tFace img,.gTalk .tFace.talking img,.gTalk .tWin,.gTalk .tMore,.gTalk .tChoices button.on::before{animation:none}.gTalk .puff{display:none}}`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function open(npc, ctx) {
    if (!document.getElementById('gTalkCss')) { const st = document.createElement('style'); st.id = 'gTalkCss'; st.textContent = CSS; document.head.appendChild(st); }
    const calm = reduced(), base = ctx.base || '';
    const root = document.createElement('div');
    root.className = 'gTalk'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Talking to ' + npc.name);
    const steam = npc.steam ? Array.from({ length: 5 }, (_, i) => `<span class="puff" style="left:${(npc.steam.x + npc.steam.w * (i / 4)) * 100}%;top:${npc.steam.y * 100}%;animation-delay:${i * 0.8}s"></span>`).join('') : '';
    root.innerHTML = `<div class="tStage" style="--focus:${(npc.focus != null ? npc.focus : 0.5) * 100}%"><img src="${esc(base + npc.stage)}" alt="">${steam}<button type="button" class="tSkip">Leave</button></div>
      <div class="tWin"><div class="tFace"><img src="${esc(base + npc.portrait)}" alt="${esc(npc.name)}"></div>
        <div class="tBody"><div class="tName">${esc(npc.name)}</div><p class="tText" aria-hidden="true"></p><p class="sr" aria-live="polite"></p><ul class="tChoices"></ul><div class="tInfo"></div></div>
        <span class="tMore" aria-hidden="true" hidden>▼</span></div>`;
    document.body.appendChild(root);
    const $ = sel => root.querySelector(sel), text = $('.tText'), sr = $('.sr'), face = $('.tFace'), list = $('.tChoices'), info = $('.tInfo'), more = $('.tMore');
    let shownAt = 0, node = null, curId = '', line = 0, typing = 0, full = '', cursor = 0, items = [], mode = 'talk', done = false;
    const fill = (t, extra) => String(t).replace(/\{(\w+)\}/g, (_, k) => { const v = { ...ctx.vars(), ...(extra || {}) }; return v[k] != null ? v[k] : ''; });
    const entry = () => (npc.entry.find(e => !e.if || ctx.when(e.if)) || {}).go;

    function close() { if (done) return; done = true; clearInterval(typing); document.removeEventListener('keydown', onKey, true); root.remove(); ctx.onClose && ctx.onClose(); }
    function type(t) {
      clearInterval(typing); full = t; sr.textContent = t; more.hidden = true; list.innerHTML = ''; info.textContent = '';
      if (calm) { text.textContent = t; return finished(); }
      let i = 0; text.textContent = ''; face.classList.add('talking');
      typing = setInterval(() => { i += 1; text.textContent = t.slice(0, i); if (i >= t.length) { clearInterval(typing); typing = 0; finished(); } }, 26);
    }
    function finished() { face.classList.remove('talking'); typing = 0; const last = line >= node.say.length - 1; if (!last || !node.choices.length) more.hidden = false; else showChoices(); }
    function go(id, extra) {
      if (id === 'back') id = entry();
      node = npc.nodes[id]; if (!node) return close(); curId = id;
      node = { ...node, say: node.say.map(s => fill(s, extra)) }; line = 0; mode = 'talk'; type(node.say[0]);
    }
    function showChoices() {
      items = node.choices.map(c => ({ ...c, label: fill(c.label) }));
      shownAt = performance.now(); render();
    }
    function render() {
      list.innerHTML = items.map((c, i) => `<li><button type="button" data-i="${i}" class="${i === cursor ? 'on' : ''}" ${c.disabled ? 'disabled' : ''}><span>${esc(c.label)}</span>${c.price != null ? `<span class="price">${c.price} cr</span>` : ''}</button></li>`).join('');
      cursor = Math.min(cursor, items.length - 1); const b = list.querySelector(`[data-i="${cursor}"]`); if (b) b.focus({ preventScroll: true });
      if (mode === 'shop') info.textContent = (items[cursor] && items[cursor].desc ? items[cursor].desc + '  ' : '') + `You have ${ctx.credits()} cr.`;
    }
    function advance() {
      if (typing) { clearInterval(typing); typing = 0; text.textContent = full; return finished(); }
      if (list.children.length) return;
      if (line < node.say.length - 1) { line += 1; return type(node.say[line]); }
      if (node.choices.length) return;
      // A line with nothing to choose: goodbyes close, a purchase returns to the menu, anything else goes back to the top.
      if (mode === 'afterShop') return openShop();
      if (curId === 'bye' || curId === 'favorSent') return close();
      go('back');
    }
    /* Choices appear where you've been tapping to advance: ignore picks for a moment so a fast tap can't choose by accident. */
    const settling = () => performance.now() - shownAt < 350;
    function pick(i) {
      if (settling()) return;
      const c = items[i]; if (!c || c.disabled) return;
      if (mode === 'shop') {
        if (c.leave) { mode = 'talk'; return go('back'); }
        const r = ctx.buy(c.item); mode = 'afterShop'; curId = r; node = { say: npc.nodes[r].say.map(x => fill(x, { price: c.item.price + ' cr' })), choices: [] }; line = 0; return type(node.say[0]);
      }
      if (c.go) return go(c.go);
      if (c.do === 'menu') return openShop();
      if (c.do) { const next = ctx.act(c.do, c); if (next === 'close') return close(); if (next) return go(next); }
    }
    function openShop() {
      mode = 'shop'; more.hidden = true; clearInterval(typing); face.classList.remove('talking');
      const t = fill(npc.menu.prompt || 'What\'ll it be?'); text.textContent = t; sr.textContent = t;
      items = npc.menu.items.map(it => ({ label: it.name, price: it.price, desc: it.desc, item: it })).concat([{ label: 'That\'s all', leave: true }]);
      cursor = 0; shownAt = performance.now(); render();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); return close(); }
      if (list.children.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items.length; do { cursor = (cursor + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; } while (items[cursor].disabled && items.some(x => !x.disabled)); return render(); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return pick(cursor); }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (b && b.classList.contains('tSkip')) return close();
      if (b && b.dataset.i != null) { cursor = +b.dataset.i; return pick(cursor); }
      if (!list.children.length) advance();
    });
    root.addEventListener('mousemove', e => { const b = e.target.closest('[data-i]'); if (b && +b.dataset.i !== cursor && !b.disabled) { cursor = +b.dataset.i; list.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', i === cursor)); if (mode === 'shop') info.textContent = (items[cursor].desc ? items[cursor].desc + '  ' : '') + `You have ${ctx.credits()} cr.`; } });
    document.addEventListener('keydown', onKey, true);
    go(entry());
    return { close };
  }
  window.GRAKK_TALK = { open };
})();
