// A real installed service worker must serve the action sheet without a network.
export async function checkPlayerOffline(browser, base, check) {
  const ctx=await browser.newContext({viewport:{width:360,height:800}});
  const page=await ctx.newPage();
  try {
    await page.goto(base+'/');
    await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker did not activate')),15000))]);});
    await page.reload();
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload();
    await page.evaluate(()=>document.getElementById('fullSheetBtn').click());
    const f=page.frameLocator('#frame');
    await f.locator('#playerNowRoll').waitFor();
    check('offline: cached sheet exposes Now actions',true);
    await f.locator('#playerNowRoll').click();
    await f.getByRole('button',{name:'Roll Brawl',exact:true}).click();
    check('offline: preview fits 360px',await f.locator('#playerActionDialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
    check('offline: dialog focuses Cancel',await f.locator('#playerActionCancel').evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Escape');
    check('offline: Escape dismisses without rolling',await f.locator('#playerActionDialog').evaluate(el=>!el.open));
    await f.getByRole('button',{name:'Roll Brawl',exact:true}).click();
    await f.locator('#playerActionConfirm').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('adyta_offline_inventory_v44_shared'))?.rollHistory?.length>0);
    check('offline: skill roll produces a saved result',await page.evaluate(()=>JSON.parse(localStorage.getItem('adyta_offline_inventory_v44_shared')).rollHistory.length>0));
  } catch(e) {
    check('offline: action flow',false,e.message.split('\n')[0]);
  } finally {await ctx.close();}
}
