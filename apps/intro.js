/* GRAKK_INTRO: short onboarding cutscenes (Civic Registry, Radio Sewers).
   - Plays once per id; the record lives in localStorage ('grakkgrith-intros-seen'), never in the character file.
   - Always skippable: Skip button (focused first), Escape, or tapping the picture to go to the next beat.
   - prefers-reduced-motion: no autoplay, no crossfades, flashing beats are dropped, the clip becomes a still,
     and the player moves on with Next / Continue.
   - Frames are loaded one ahead, so nothing big is downloaded up front.
   play(intro) -> Promise that resolves when the intro ends or is skipped.
   intro = { id, label, beats: [{ src, ms, text, flash }] }   (slides)
        or { id, label, clip: { src, still, ms }, text }       (one animated clip) */
(function () {
  'use strict';
  const KEY = 'grakkgrith-intros-seen';
  const seenAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const markSeen = id => { try { const s = seenAll(); s[id] = Date.now(); localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const CSS = `
.gIntro{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(5,5,11,.94);color:#f7e8c6;font-family:"Atkinson Hyperlegible",system-ui,sans-serif}
.gIntro .box{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(100%,560px)}
.gIntro .box.wide{width:min(100%,880px)}
.gIntro .pic{position:relative;width:100%;aspect-ratio:1/1;border:2px solid #d7ac61;border-radius:12px;overflow:hidden;background:#0a0b16;cursor:pointer}
.gIntro .wide .pic{aspect-ratio:16/9}
.gIntro .pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .28s ease}
.gIntro .pic img.on{opacity:1}
.gIntro .cap{min-height:3em;margin:0;text-align:center;font-size:18px;line-height:1.45}
.gIntro .gBar{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.gIntro button{min-height:44px;min-width:110px;padding:8px 18px;border:1px solid #d7ac61;border-radius:999px;background:#151124;color:#f7e8c6;font:700 15px "Saira Condensed","Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.gIntro button.primary{background:#d7ac61;color:#0a0b16}
.gIntro button:focus-visible{outline:3px solid #22dae4;outline-offset:3px}
.gIntro .dots{display:flex;gap:6px}.gIntro .dots i{width:8px;height:8px;border-radius:50%;background:#3a2f4a}.gIntro .dots i.on{background:#ef46ba}
@media (prefers-reduced-motion: reduce){.gIntro .pic img{transition:none}}`;

  function play(intro) {
    return new Promise(resolve => {
      if (!document.getElementById('gIntroCss')) { const st = document.createElement('style'); st.id = 'gIntroCss'; st.textContent = CSS; document.head.appendChild(st); }
      const calm = reduced();
      const beats = intro.clip
        ? [{ src: calm ? intro.clip.still : intro.clip.src, ms: intro.clip.ms, text: intro.text }]
        : intro.beats.filter(b => !(calm && b.flash));
      const root = document.createElement('div');
      root.className = 'gIntro'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', intro.label || 'Intro');
      root.innerHTML = `<div class="box ${intro.clip ? 'wide' : ''}"><div class="pic" title="Next"></div><p class="cap" aria-live="polite"></p>
        ${beats.length > 1 ? `<div class="dots" aria-hidden="true">${beats.map(() => '<i></i>').join('')}</div>` : ''}
        <div class="gBar"><button type="button" class="skip">Skip</button>${calm ? `<button type="button" class="primary next">${beats.length > 1 ? 'Next' : 'Continue'}</button>` : ''}</div></div>`;
      document.body.appendChild(root);
      const pic = root.querySelector('.pic'), cap = root.querySelector('.cap'), dots = [...root.querySelectorAll('.dots i')], nextBtn = root.querySelector('.next');
      const imgs = beats.map(b => { const i = new Image(); i.alt = ''; i.decoding = 'async'; i.dataset.src = b.src; pic.appendChild(i); return i; });
      const load = n => { const i = imgs[n]; if (i && !i.src) i.src = i.dataset.src; };
      let at = -1, timer = 0, done = false;
      const finish = () => {
        if (done) return; done = true; clearTimeout(timer); markSeen(intro.id);
        document.removeEventListener('keydown', onKey, true); root.remove(); resolve();
      };
      const show = n => {
        if (n >= beats.length) return finish();
        clearTimeout(timer); at = n; load(n); load(n + 1);
        imgs.forEach((im, k) => im.classList.toggle('on', k === n));
        dots.forEach((d, k) => d.classList.toggle('on', k === n));
        cap.textContent = beats[n].text || '';
        if (nextBtn) nextBtn.textContent = n === beats.length - 1 ? 'Continue' : 'Next';
        if (!calm) timer = setTimeout(() => show(n + 1), beats[n].ms || 2500);
      };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); finish(); } else if ((e.key === 'ArrowRight' || e.key === ' ') && e.target === document.body) { e.preventDefault(); show(at + 1); } };
      document.addEventListener('keydown', onKey, true);
      root.querySelector('.skip').onclick = finish;
      if (nextBtn) nextBtn.onclick = () => show(at + 1);
      pic.onclick = () => show(at + 1);
      show(0);
      (nextBtn || root.querySelector('.skip')).focus();
    });
  }
  window.GRAKK_INTRO = {
    play,
    seen: id => !!seenAll()[id],
    once: intro => (seenAll()[intro.id] ? Promise.resolve() : play(intro)),
    reset: id => { try { const s = seenAll(); delete s[id]; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  };
})();
