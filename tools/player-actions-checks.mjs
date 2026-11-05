// Exercises real controls and the public character bridge, using disposable saves.
import { mkdir } from 'node:fs/promises';
export async function checkPlayerActions(page, f, step, label) {
  const read = () => f.evaluate(() => JSON.parse(localStorage.getItem('adyta_offline_inventory_v44_shared')));
  const click = id => f.locator('#'+id).click();
  const seed = {
    version:44, exampleItems:{tripChirpFieldKit:true}, character:{name:'Action Runner',race:'Goblin',class:'Runner',level:'1'},
    stats:{woundState:'1',stress:'2',heat:'0'}, selected:2,
    equipment:{active:0,secondary:3,ammoSource:1},
    inventory:[
      {name:'Test pistol',class:'WEAPON',adds:['standard','','9mm','','','','2','6'],actions:['fire','reload'],attackProfile:{attribute:'reflex',skill:'ranged',category:'standard',damageType:'ballistic'}},
      {name:'Ammo pack',class:'AMMO',adds:['','','9mm','','','','8','12']},
      {name:'Patch kit',class:'CONSUMABLE',adds:['','','','','1','1','1','1'],actions:['use'],noRefill:true},
      {name:'Knife',class:'WEAPON',adds:['light','','blade','','','','0','0'],actions:[],attackProfile:{attribute:'reflex',skill:'melee',category:'light',damageType:'blade'}}
    ]
  };
  await f.evaluate(s=>window.postMessage({type:'grakkgrith-load-state',state:s},'*'),seed);
  await f.waitForFunction(()=>document.getElementById('playerNowStatus').textContent.includes('Test pistol'));
  await step('action preview cancels without changing the save',async()=>{
    const before=JSON.stringify(await read());await click('playerNowAttack');await click('playerActionCancel');return JSON.stringify(await read())===before;
  });
  await step('attack spends one round and records a roll',async()=>{
    await click('playerNowAttack');await click('playerActionConfirm');const s=await read();return s.inventory[0].adds[6]==='1'&&s.rollHistory.length===1;
  });
  await step('Push charges stress without spending a second round',async()=>{
    await click('rollPushLastBtn');const s=await read();return s.stats.stress==='3'&&s.inventory[0].adds[6]==='1';
  });
  await step('reload transfers ammunition once',async()=>{
    await click('playerNowReload');const s=await read();return s.inventory[0].adds[6]==='6'&&s.inventory[1].adds[6]==='3';
  });
  await step('Use previews its effect and removes an exhausted no-refill card',async()=>{
    await click('playerNowUse');const preview=await f.locator('#playerActionDetails').innerText();await click('playerActionConfirm');const s=await read();return preview.includes('Wounds 1 → 0')&&s.stats.woundState==='0'&&s.stats.stress==='2'&&!s.inventory[2].name;
  });
  await step('Undo restores the card and preserves unrelated manual edits',async()=>{
    await f.evaluate(()=>{const input=document.querySelector('[data-bind="stats.heat"]');input.value='4';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await click('playerNowUndo');const s=await read();return s.inventory[2].name==='Patch kit'&&s.inventory[2].adds[6]==='1'&&s.stats.heat==='4'&&s.stats.stress==='3'&&s.stats.woundState==='1';
  });
  await step('item-card Use joins the same undo history',async()=>{
    await f.evaluate(()=>document.getElementById('useBtn').click());await click('playerActionConfirm');return (await read()).playAutomation.undo[0].label==='USE ITEM';
  });
  await step('Undo refuses a conflicting edit',async()=>{
    await f.evaluate(()=>{const input=document.querySelector('[data-bind="stats.stress"]');input.value='4';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForTimeout(300);await click('playerNowUndo');return (await read()).stats.stress==='4'&&(await f.locator('#playerActionReceipt').innerText()).includes('Cannot undo');
  });
  await step('state persists when reopening the sheet',async()=>{
    await page.evaluate(()=>document.getElementById('fullSheetBtn').click());await page.waitForTimeout(1200);f=page.frames().find(x=>x!==page.mainFrame());const s=await read();return s.inventory[0].adds[6]==='6'&&s.inventory[1].adds[6]==='3'&&s.stats.heat==='4'&&!s.inventory[2].name;
  });
  await step('skill button chooses its attribute and previews modifiers',async()=>{
    await click('playerNowRoll');await f.getByRole('button',{name:'Roll Brawl',exact:true}).click();await f.locator('#playerActionModifier').fill('2');const text=await f.locator('#playerActionDetails').innerText();await click('playerActionCancel');return text.includes('Muscle')&&text.includes('situation 2');
  });
  await step('melee attack has no ammunition cost',async()=>{
    await f.evaluate(()=>document.getElementById('rollSecondaryBtn').click());const text=await f.locator('#playerActionDetails').innerText();await click('playerActionConfirm');return text.includes('No tracked ammo')&&(await read()).inventory[3].adds[6]==='0';
  });
  await step('Now controls fit and have 44px touch targets',async()=>f.evaluate(()=>{const box=document.querySelector('.playerNow');return box.getBoundingClientRect().right<=innerWidth&&[...box.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44);}));
  await f.locator('.playerNow').scrollIntoViewIfNeeded();
  await mkdir('output/playwright',{recursive:true});
  await f.locator('.playerNow').screenshot({path:`output/playwright/player-now-${label}.png`});
  await click('playerNowAttack');
  await f.locator('#playerActionDialog').screenshot({path:`output/playwright/player-attack-${label}.png`});
  await click('playerActionCancel');
  await step('empty weapon blocks firing without changing state',async()=>{
    const s=await read();s.inventory[0].adds[6]='0';await f.evaluate(s=>window.postMessage({type:'grakkgrith-load-state',state:s},'*'),s);
    await page.waitForTimeout(100);const before=JSON.stringify(await read());await click('playerNowAttack');const blocked=await f.locator('#playerActionConfirm').isDisabled();await click('playerActionCancel');return blocked&&JSON.stringify(await read())===before;
  });
  await step('Undo refuses to alter replacement gear',async()=>{
    const s=await read();s.inventory[0].adds[6]='2';await f.evaluate(s=>window.postMessage({type:'grakkgrith-load-state',state:s},'*'),s);await page.waitForTimeout(100);
    await click('playerNowAttack');await click('playerActionConfirm');const changed=await read();changed.inventory[0].name='Replacement pistol';await f.evaluate(s=>window.postMessage({type:'grakkgrith-load-state',state:s},'*'),changed);await page.waitForTimeout(100);
    await click('playerNowUndo');return (await read()).inventory[0].adds[6]==='1'&&(await f.locator('#playerActionReceipt').innerText()).includes('Cannot undo');
  });
}
