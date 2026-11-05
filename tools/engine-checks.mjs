// The shared engine on its own, no browser: pools, attacks, ammo, Use, Reload, Push and guarded Undo.
import { readFileSync } from 'node:fs';
const window = {};
new Function('window', readFileSync(new URL('../apps/engine.js', import.meta.url), 'utf8'))(window);
const { create } = window.GRAKK_ENGINE;
const fails = [], passes = [];
const check = (name, ok, detail = '') => (ok ? passes : fails).push(ok ? name : `${name}: ${detail}`);

const fresh = () => ({
  version: 44, character: { name: 'Engine Runner', race: 'Goblin', class: 'Runner', level: '1' },
  stats: { muscle: '1', reflex: '5', wit: '3', savvy: '2', spark: '2', root: '3', woundState: '1', stress: '2', heat: '0', condition1: '', condition2: '' },
  skills: { ranged: '2', melee: '1', dash: '1' },
  equipment: { active: 0, secondary: 3, ammoSource: 1 },
  inventory: [
    { name: 'Test pistol', class: 'WEAPON', adds: ['standard', '', '9mm', '', '', '', '2', '6'], actions: ['fire', 'reload'], attackProfile: { attribute: 'reflex', skill: 'ranged', category: 'standard', damageType: 'ballistic' } },
    { name: 'Ammo pack', class: 'AMMO', adds: ['', '', '9mm', '', '', '', '8', '12'] },
    { name: 'Patch kit', class: 'CONSUMABLE', adds: ['', '', '', '', '1', '1', '1', '1'], actions: ['use'], noRefill: true },
    { name: 'Knife', class: 'WEAPON', adds: ['light', '', 'blade', '', '', '', '0', '0'], actions: [], attackProfile: { attribute: 'reflex', skill: 'melee', category: 'light', damageType: 'blade' } }
  ]
});
let s = fresh(); const E = create(() => s);

const d = E.deriveCore();
check('Defense is 1 + half Reflex', d.defense === 3, d.defense);
check('Initiative is Reflex + Dash', d.init === 6, d.init);
const a = E.attackPool('active');
check('pistol pool: Reflex 5 + Ranged 2, Hurt -1 on physical = 6', a.pool.total === 6 && a.profile.skill === 'ranged' && a.spends && a.canFire, JSON.stringify(a.pool));
const k = E.attackPool('secondary');
check('knife uses Melee and spends no ammo', k.profile.skill === 'melee' && !k.spends && k.canFire);
check('hit table: 5 vs Defense 3, standard, soak 1 = 1 step', E.resolveAttack(5, 3, 'standard', 1, 'none', 0).finalSteps === 1);
check('hit table: equal successes is a Graze', E.resolveAttack(3, 3, 'standard', 0, 'none', 0).kind === 'Graze');
check('hit table: heavy doubles the excess', E.resolveAttack(5, 3, 'heavy', 0, 'none', 0).finalSteps === 4);

const spent = E.act('ATTACK', '', () => { E.setCur(s.inventory[0], 1); return 'Test pistol attack rolled.'; });
check('an action records history and Undo', spent && E.canUndo() && s.playAutomation.log[0].label === 'ATTACK');
check('reload is possible with a matching ammo source', E.canReload('active'));
E.act('RELOAD', '', () => { const r = E.reloadEquipped('active'); return r.ok ? r.message : false; });
check('reload moves 5 rounds once', s.inventory[0].adds[6] === '6' && s.inventory[1].adds[6] === '3', s.inventory[0].adds[6] + '/' + s.inventory[1].adds[6]);
check('Use preview shows the healing', /Wounds 1 → 0/.test(E.usePreview(2).text) && !E.usePreview(2).blocked);
E.act('USE ITEM', '', () => { const r = E.useSlot(2); return r.ok ? r.message : false; });
check('Use heals and removes the empty NO REFILL card', s.stats.woundState === '0' && s.stats.stress === '1' && !s.inventory[2].name);
s.notes = 'unrelated edit';
let u = E.undoLast();
check('Undo restores the card and keeps unrelated edits', u.ok && s.inventory[2].name === 'Patch kit' && s.stats.woundState === '1' && s.notes === 'unrelated edit', u.message);
s.inventory[0].adds[6] = '4';
u = E.undoLast();
check('Undo refuses when the weapon was changed by hand afterwards', !u.ok && /changed later/.test(u.message) && s.inventory[0].adds[6] === '4', u.message);

check('Undo ignores card bookkeeping fields and key order', E.sameValue({ name: 'Kit', adds: ['1'] }, { schema: 'GRAKKGRITH_ITEM_CARD', schemaVersion: 44, legacyUpgraded: true, tier: '', adds: ['1'], name: 'Kit' }));
check('Undo still sees a real change to a card', !E.sameValue({ name: 'Kit', adds: ['1'] }, { name: 'Kit', adds: ['2'] }) && !E.sameValue({ name: 'Kit' }, { name: 'Kat' }));
check('a raw save with no equipment block does not crash', create(() => ({ stats: {}, inventory: [] })).equippedItem('armor') === null);
s = fresh(); s.stats.stress = '6';
check('Push is refused at full Stress', !E.canPush() && !E.payPush().ok && s.stats.stress === '6');
s.stats.stress = '2'; const p = E.payPush();
check('Push adds 2 dice and 1 Stress', p.ok && p.dice.length === 2 && s.stats.stress === '3');
check('Workshop mode keeps default card actions', create(() => ({ inventory: [] }), { shops: true }).getItemActions({ class: 'WEAPON' }).length > 0);

for (const f of fails) console.log('  ✗ ' + f);
console.log(`${passes.length} engine checks passed.`);
if (fails.length) { console.log(`${fails.length} failed.`); process.exit(1); }
