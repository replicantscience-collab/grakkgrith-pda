/* Shared bits for the PDA's own screens. noChar(on, text): with no character, hide the screen's empty layout and show one card that leads to Setup. */
(function (root) {
  'use strict';
  function noChar(on, text) {
    const b = document.body; b.classList.toggle('nochar', !!on);
    let c = document.getElementById('nocharCard');
    if (!on) { if (c) c.remove(); return; }
    if (!c) {
      c = document.createElement('section'); c.id = 'nocharCard'; c.className = 'frame nocharCard';
      c.innerHTML = '<h2>No character yet</h2><p></p><button class="primary" type="button">Create your character</button>';
      c.querySelector('button').onclick = () => parent.postMessage({ type: 'grakkgrith-nav', to: 'creatorBtn' }, '*');
      const who = document.getElementById('who'); who.after(c);
    }
    c.querySelector('p').textContent = text;
  }
  root.GRAKK_SCREEN = { noChar };
})(window);
