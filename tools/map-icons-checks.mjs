import { mkdir } from 'node:fs/promises';
export async function checkMapIcons(page,f,step,label){
  await f.evaluate(()=>window.GRAKK_EXPLORE.showMap('low-halo'));
  const saved=await f.evaluate(()=>JSON.stringify(window.GRAKK_EXPLORE.places().map(p=>({id:p.id,pin:p.pin}))));
  await step('map symbols cover every visible saved place',()=>f.evaluate(()=>[...document.querySelectorAll('#world .pin')].every(p=>p.querySelector('svg')&&p.dataset.type&&p.getAttribute('aria-label'))));
  await step('map symbols stay centred on saved coordinates',()=>f.evaluate(()=>{
    const places=window.GRAKK_EXPLORE.places(),world=document.getElementById('world'),wr=world.getBoundingClientRect(),scale=wr.width/world.offsetWidth;
    return [...world.querySelectorAll('.pin')].every(b=>{const p=places.find(p=>p.id===b.dataset.id),r=b.getBoundingClientRect();return p&&Math.abs(r.left+r.width/2-(wr.left+p.pin.x*wr.width))<1&&Math.abs(r.top+r.height/2-(wr.top+p.pin.y*wr.height))<1&&Math.abs(r.width-32)<1;});
  }));
  await f.locator('#mapKeyBtn').click();
  await step('map key offers labelled filters and a touch-sized place list',()=>f.evaluate(()=>document.querySelectorAll('#keyFilters button').length>1&&[...document.querySelectorAll('#keyPlaces button')].every(b=>b.getBoundingClientRect().height>=44)));
  await f.locator('[data-filter="shop"]').click();
  await step('shop filter hides other ordinary pins',()=>f.evaluate(()=>[...document.querySelectorAll('#world .pin')].every(b=>b.dataset.type==='shop'||b.matches('.you,.dest,.selected'))&&document.querySelectorAll('#keyPlaces button').length>0));
  await mkdir('output/playwright',{recursive:true});
  await f.locator('#mapKey').screenshot({path:`output/playwright/map-key-${label}.png`});
  const id=await f.locator('#keyPlaces button').first().getAttribute('data-key-place');
  await f.locator('#keyPlaces button').first().click();
  await step('place list opens the existing dossier',()=>f.evaluate(id=>!document.getElementById('mapKey').open&&!!document.querySelector('.pin.selected[data-id="'+id+'"]')&&document.getElementById('sheetBody').textContent.includes(window.GRAKK_EXPLORE.places().find(p=>p.id===id).name),id));
  await f.locator('#sheetClose').click();
  await f.locator('#placesLayerBtn').click();
  await step('places layer hides ordinary pins',()=>f.evaluate(()=>[...document.querySelectorAll('#world .pin')].every(b=>b.matches('.you,.dest,.selected'))));
  await f.locator('#placesLayerBtn').click();
  await f.locator('#editBtn').click();
  await step('pin editing exposes all pins despite the filter',()=>f.evaluate(()=>document.querySelectorAll('#world .pin').length===window.GRAKK_EXPLORE.places().filter(p=>p.pin?.map==='low-halo').length&&document.getElementById('mapKeyBtn').disabled));
  await f.locator('#editBtn').click();
  await f.evaluate(()=>window.GRAKK_EXPLORE.showMap('old-city'));
  await step('switching maps resets the category filter',()=>f.evaluate(()=>document.querySelector('[data-filter="all"]').getAttribute('aria-pressed')==='true'));
  await f.evaluate(()=>window.GRAKK_EXPLORE.showMap('low-halo'));
  await step('overlay controls leave saved coordinates unchanged',async()=>saved===await f.evaluate(()=>JSON.stringify(window.GRAKK_EXPLORE.places().map(p=>({id:p.id,pin:p.pin})))));
  await f.locator('#stage').screenshot({path:`output/playwright/map-symbols-${label}.png`});
}
