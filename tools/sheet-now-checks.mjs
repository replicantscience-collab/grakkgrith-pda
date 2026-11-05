// The one-page Sheet's Now box: same engine as Edit sheet, same save, same Undo.
const KEY = 'grakkgrith_character_tool_v8_state';
const seed = () => ({
  version: 44, character: { name: 'Now Runner', race: 'Goblin', class: 'Runner', level: '2' },
  stats: { muscle: '1', reflex: '5', wit: '3', savvy: '2', spark: '2', root: '3', woundState: '1', stress: '2', heat: '0' },
  skills: { ranged: '2', melee: '1', dash: '1', climb: '1' }, selected: 2, equipment: { active: 0, secondary: 3, ammoSource: 1 },
  inventory: [
    { name: 'Test pistol', class: 'WEAPON', adds: ['standard', '', '9mm', '', '', '', '2', '6'], actions: ['fire', 'reload'], attackProfile: { attribute: 'reflex', skill: 'ranged', category: 'standard', damageType: 'ballistic' } },
    { name: 'Ammo pack', class: 'AMMO', adds: ['', '', '9mm', '', '', '', '8', '12'] },
    { name: 'Patch kit', class: 'CONSUMABLE', adds: ['', '', '', '', '1', '1', '1', '1'], actions: ['use'], noRefill: true },
    { name: 'Knife', class: 'WEAPON', adds: ['light', '', 'blade', '', '', '', '0', '0'], actions: [], attackProfile: { attribute: 'reflex', skill: 'melee', category: 'light', damageType: 'blade' } }]
});

export async function checkSheetNow(page, open, step) {
  const read = () => page.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
  await page.evaluate(([K, s]) => localStorage.setItem(K, JSON.stringify(s)), [KEY, seed()]);
  let f = await open('sheetBtn', 1800);
  await f.waitForFunction(() => window.GRAKK_SHEET_READY && document.getElementById('nowBox'));
  const click = sel => f.locator(sel).click();

  await step('Sheet Now: attack preview shows the real pool (Hurt -1) and Cancel changes nothing', async () => {
    const before = JSON.stringify(await read());
    await click('[data-now="attack"][data-which="active"]');
    const r = await f.evaluate(() => ({ text: document.getElementById('actDetails').textContent, focus: document.activeElement.id, diffHidden: document.querySelector('[data-f="diff"]').hidden }));
    await click('#actCancel');
    return (/^6 dice = Reflex 5 \+ Ranged 2 -1 wounds/.test(r.text) && r.focus === 'actCancel' && r.diffHidden && JSON.stringify(await read()) === before) || JSON.stringify(r);
  });
  await step('Sheet Now: attack spends one round, records a roll and shows the dice', async () => {
    await click('[data-now="attack"][data-which="active"]'); await click('#actOk'); await f.waitForTimeout(250);
    const s = await read(), dice = await f.locator('#nowResult .dice i').count();
    return (s.inventory[0].adds[6] === '1' && s.rollHistory.length === 1 && s.playAutomation.undo[0].label === 'ATTACK' && dice === 6) || JSON.stringify({ ammo: s.inventory[0].adds[6], rolls: s.rollHistory?.length, dice });
  });
  await step('Sheet Now: Push adds Stress and two dice without spending a round', async () => {
    await click('[data-now="push"]'); await f.waitForTimeout(250);
    const s = await read(), dice = await f.locator('#nowResult .dice i').count(), off = await f.locator('[data-now="push"]').isDisabled();
    return (s.stats.stress === '3' && s.inventory[0].adds[6] === '1' && dice === 8 && off) || JSON.stringify({ stress: s.stats.stress, dice, off });
  });
  await step('Sheet Now: Reload moves ammunition once', async () => {
    await click('[data-now="reload"]'); await f.waitForTimeout(250); const s = await read();
    return (s.inventory[0].adds[6] === '6' && s.inventory[1].adds[6] === '3') || `${s.inventory[0].adds[6]}/${s.inventory[1].adds[6]}`;
  });
  await step('Sheet Now: Use previews and heals, and the empty card goes', async () => {
    await click('[data-now="use"]'); const text = await f.locator('#actDetails').innerText(); await click('#actOk'); await f.waitForTimeout(250);
    const s = await read();
    return (/Wounds 1 → 0/.test(text) && s.stats.woundState === '0' && s.stats.stress === '2' && !s.inventory[2].name) || JSON.stringify({ text, w: s.stats.woundState, st: s.stats.stress });
  });
  await step('Sheet Now: tapping a skill name rolls it with its attribute', async () => {
    await click('button.sk[data-roll="climb"]'); const text = await f.locator('#actDetails').innerText(); await click('#actOk'); await f.waitForTimeout(250);
    const s = await read();
    return (/^6 dice = Reflex 5 \+ Climb 1/.test(text) && s.rollHistory[0].title === 'Climb') || text;
  });
  await step('Undo from Edit sheet reverses the Sheet\'s last action (shared history)', async () => {
    let g = await open('fullSheetBtn', 2200);
    await g.locator('#playerNowUndo').click(); await page.waitForTimeout(800);
    g = await open('sheetBtn', 1800); await g.waitForFunction(() => window.GRAKK_SHEET_READY);
    const s = await read();
    return (s.inventory[2].name === 'Patch kit' && s.stats.woundState === '1' && s.inventory[0].adds[6] === '6') || JSON.stringify({ card: s.inventory[2].name, w: s.stats.woundState });
  });
  f = await open('sheetBtn', 1500);
  await step('Sheet Now: Undo on the Sheet refuses after a hand edit and keeps the edit', async () => {
    await f.waitForFunction(() => window.GRAKK_SHEET_READY);
    await page.evaluate(K => { const s = JSON.parse(localStorage.getItem(K)); s.inventory[0].adds[6] = '4'; localStorage.setItem(K, JSON.stringify(s)); }, KEY);
    await click('[data-now="undo"]'); await f.waitForTimeout(250); const s = await read(), msg = await f.locator('#toast').innerText();
    return (s.inventory[0].adds[6] === '4' && /changed later/.test(msg)) || JSON.stringify({ ammo: s.inventory[0].adds[6], msg });
  });
}
