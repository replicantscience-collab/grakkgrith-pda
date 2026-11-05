/* GRAKK_ENGINE: the one rules engine for character play.
   Edit sheet (apps/player.html) and the one-page Sheet (apps/sheet.html) both run this file, so a
   dice pool, an attack, an ammo count or an Undo comes out the same on either screen.

   const E = GRAKK_ENGINE.create(() => character, { shops: false });
   Every function reads and changes the character the getter returns. Nothing here touches the page:
   screens draw results and save. Functions marked "moved" were lifted word for word from Edit sheet
   (tools/build-engine.py); the rest were pulled out of Edit sheet's screen code. */
(function () {
'use strict';
const SLOT_COUNT = 80, BASE_UNLOCKED_SLOTS = 10, COUNT_LIMIT = 200;
const EMPTY_ITEM = () => ({name:'', class:'', desc:'', img:'', shopName:'', shopIcon:'', adds:Array(8).fill(''), attackProfile:{attribute:'',skill:'',category:'',damageType:'',ap:'0',properties:''}, armorProfile:{base:{ballistic:'0',blade:'0',impact:'0',energy:'0'},current:{ballistic:'0',blade:'0',impact:'0',energy:'0'}}, actions:[], noRefill:false});

function create(getState, opts) {
  const S = () => getState();
  const IS_SHOPS = !!(opts && opts.shops);

  /* ---- moved from Edit sheet ---- */
  function toNum(v,d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }
  function clampInt(n,min,max){ n=parseInt(n,10); if(!Number.isFinite(n)) n=0; return Math.min(max,Math.max(min,n)); }
  function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
  function itemType(item){ return String(item&&item.class||'').trim().toUpperCase(); }
  function isWeaponClass(item){ return /WEAPON|GUN|FIREARM|BOW|CROSSBOW/.test(itemType(item)); }
  function isAmmoClass(item){ return /AMMO|AMMOBAG|AMMO PACK|AMMUNITION/.test(itemType(item)); }
  function isConsumableClass(item){ return /ITEM|CONSUMABLE|FOOD|DRINK|MED|MEDKIT|POTION|STIM|USABLE/.test(itemType(item)); }
  function isBackClass(item){ return /BACK|BACKPACK|BAG|POUCH|PACK|SATCHEL|RIG|HARNESS|BELT/.test(itemType(item)); }
  function itemNoRefill(item){ return !!(item&&item.noRefill); }
  function defaultActionsForClass(item){ if(isWeaponClass(item)) return ['fire','reload']; if(isConsumableClass(item)&&!isAmmoClass(item)&&!isWeaponClass(item)) return ['use']; return []; }
  function getItemActions(item){ if(!item) return []; if(!Array.isArray(item.actions)) item.actions=IS_SHOPS?defaultActionsForClass(item):[]; return item.actions.map(v=>String(v).toLowerCase()).filter(Boolean); }
  function itemAllows(item,action){ return getItemActions(item).includes(String(action).toLowerCase()); }
  function counts(item){ const a=item.adds||[]; let cur=clampInt(a[6],0,COUNT_LIMIT), max=clampInt(a[7],0,COUNT_LIMIT); if(max>0) cur=Math.min(cur,max); return {cur,max}; }
  function setCur(item,n){ const c=counts(item); const max=c.max; item.adds[6]=String(max>0?Math.min(Math.max(0,n),max):Math.max(0,n)); }
  function gearCategory(item){const a=item?.adds||[];const c=String(item?.attackProfile?.category||a[0]||'').trim().toLowerCase();return ['unarmed','light','standard','heavy','special'].includes(c)?c:'standard';}
  function damageType(item){return String(item?.attackProfile?.damageType||item?.adds?.[2]||item?.adds?.[3]||'').trim()||'Untyped';}
  function ammoType(item){ const a=item.adds||[]; return String(a[2]||a[3]||'').trim(); }
  function sameAmmoType(w,a){ const wt=ammoType(w).toLowerCase(), at=ammoType(a).toLowerCase(); return wt && at && wt===at; }
  function parseSignedTags(text){
    const out=[];
    const re=/\b(MUSCLE|MUS|REFLEX|REF|WIT|SAVVY|SAV|SPARK|SPK|ROOT|DEFENSE|DEF|ATTACK|ATK|DICE|DAMAGE|DMG|AP|STRESSMAX|STRESS|BALLISTIC|BAL|BLADE|BLA|IMPACT|IMP|ENERGY|ENE|SOAK|SLOTS?|INV|INVENTORY|BACK|MOVEMENT|MOVE|MOBILITY|SPEED|DASH|DODGE|INIT|INITIATIVE)\s*([+-]?\d+)\b/gi;
    let m; while((m=re.exec(String(text||'')))) out.push({key:m[1].toUpperCase(),val:toNum(m[2],0),raw:m[1].toUpperCase()+(Number(m[2])>=0?'+':'')+Number(m[2])});
    return out;
  }
  function applyItemMods(item,final,mods,soak,tags){
    const a=item.adds||[]; const text=[item.class,item.name,a[2],a[4],a[5],item.desc].join(' ');
    parseSignedTags(text).forEach(t=>{ tags.push(t.raw); const k=t.key,v=t.val;
      if(k==='MUS'||k==='MUSCLE') final.muscle+=v;
      else if(k==='REF'||k==='REFLEX') final.reflex+=v;
      else if(k==='WIT') final.wit+=v;
      else if(k==='SAV'||k==='SAVVY') final.savvy+=v;
      else if(k==='SPK'||k==='SPARK') final.spark+=v;
      else if(k==='ROOT') final.root+=v;
      else if(k==='DEF'||k==='DEFENSE') mods.def+=v;
      else if(k==='ATK'||k==='ATTACK'||k==='DICE') mods.atk+=v;
      else if(k==='DMG'||k==='DAMAGE') mods.dmg+=v;
      else if(k==='AP') mods.ap+=v;
      else if(k==='BAL'||k==='BALLISTIC') soak.ballistic+=v;
      else if(k==='BLADE'||k==='BLA') soak.blade+=v;
      else if(k==='IMPACT'||k==='IMP') soak.impact+=v;
      else if(k==='ENERGY'||k==='ENE') soak.energy+=v;
      else if(k==='SOAK'){soak.ballistic+=v;soak.blade+=v;soak.impact+=v;soak.energy+=v;}
      else if(k==='DASH') mods.dash+=v;
      else if(k==='DODGE') mods.dodge+=v;
      else if(k==='INIT'||k==='INITIATIVE') mods.init+=v;
      else if(k==='MOVE'||k==='MOVEMENT'||k==='MOBILITY'||k==='SPEED'){ mods.move+=v; mods.dash+=v; mods.init+=v; }
    });
  }
  function parseItemLocalMods(item){
    const mods={atk:0,ap:0};
    const text=[item?.name,item?.class,item?.desc,item?.adds?.[2],item?.adds?.[4],item?.adds?.[5]].join(' ');
    parseSignedTags(text).forEach(t=>{ if(['ATK','ATTACK','DICE'].includes(t.key)) mods.atk+=t.val; if(t.key==='AP') mods.ap+=t.val; });
    return mods;
  }
  function blankArmorProfile(){ return {base:{ballistic:'0',blade:'0',impact:'0',energy:'0'},current:{ballistic:'0',blade:'0',impact:'0',energy:'0'}}; }
  function legacyArmorFromItem(x){
    const out={ballistic:0,blade:0,impact:0,energy:0};
    const txt=[x?.desc,(x?.adds||[]).join(' '),x?.properties].join(' ');
    const aliases={BALLISTIC:'ballistic',BAL:'ballistic',BLADE:'blade',BLA:'blade',IMPACT:'impact',IMP:'impact',ENERGY:'energy',ENE:'energy'};
    const re=/\b(BALLISTIC|BAL|BLADE|BLA|IMPACT|IMP|ENERGY|ENE)\s*\+?(\d+)\b/gi; let m;
    while((m=re.exec(txt))) out[aliases[m[1].toUpperCase()]]=Math.max(out[aliases[m[1].toUpperCase()]],toNum(m[2],0));
    return out;
  }
  function normalizeArmorProfileData(raw,item){
    const legacy=legacyArmorFromItem(item||{}), base=raw?.base||raw||{}, cur=raw?.current||{};
    const p=blankArmorProfile();
    ['ballistic','blade','impact','energy'].forEach(k=>{ const b=Math.max(0,Math.floor(toNum(base[k],legacy[k]||0))); const c=Math.max(0,Math.min(b,Math.floor(toNum(cur[k],b)))); p.base[k]=String(b); p.current[k]=String(c); });
    return p;
  }
  function normalizeArmorProfile(item){ if(!item) return blankArmorProfile(); item.armorProfile=normalizeArmorProfileData(item.armorProfile,item); return item.armorProfile; }
  function slotBonusFromText(text){ let best=0; const re=/\b(SLOTS?|INV|INVENTORY|BACK)\s*([+-]?\d+)\b/gi; let m; while((m=re.exec(String(text||'')))) best=Math.max(best,toNum(m[2],0)); return best; }
  function backSlotBonus(item){
    if(!item) return 0;
    const a=item.adds||[];
    const text=[item.class,item.name,item.desc,a[2],a[4],a[5],a[7]].join(' ');
    let n=slotBonusFromText(text);
    if(!n && isBackClass(item)) n=toNum(a[7],0);
    return Math.max(0,Math.min(SLOT_COUNT-BASE_UNLOCKED_SLOTS,Math.floor(n||0)));
  }
  function normalizeEquipIndex(v){ if(v===null||v===undefined||v==='') return null; const n=Number(v); return Number.isInteger(n)&&n>=0&&n<SLOT_COUNT?n:null; }
  function equippedItem(which){ const idx=normalizeEquipIndex(S().equipment[which]); return idx===null?null:S().inventory[idx]; }
  function unlockedSlotCount(){ if(IS_SHOPS || S().inventoryRules?.slotLimitsEnabled===false) return SLOT_COUNT; const back=equippedItem('back'); return Math.max(BASE_UNLOCKED_SLOTS,Math.min(SLOT_COUNT,BASE_UNLOCKED_SLOTS+backSlotBonus(back))); }
  function attrNames(){ return ['muscle','reflex','wit','savvy','spark','root']; }
  function skillRankRaw(key){ return Math.max(0,Math.min(4,Math.floor(toNum(S().skills?.[key],0)))); }
  function skillValue(key){ const r=skillRankRaw(key); return r>=4?3:r; }
  function stressCap(level){ return toNum(level,0)>=12 ? 8 : 6; }
  function heatCap(level){ level=toNum(level,0); return level>=17 ? 8 : (level>=7 ? 7 : 6); }
  function defenseFromReflex(reflex){ return 1+Math.floor(Math.max(1,toNum(reflex,1))/2); }
  function currentWoundIndex(){ return clampInt(S().stats.woundState,0,3); }
  function currentConditions(){ return [S().stats.condition1,S().stats.condition2].filter(Boolean); }
  function classifyAttackProfile(item){
    if(!item) return {attack:false,attr:'reflex',skill:'ranged',type:'Unknown',category:'standard'};
    const explicit=Object.assign({attribute:'',skill:'',category:'',damageType:'',ap:'0',properties:''},item.attackProfile||{});
    if(explicit.attribute && explicit.skill){ return {attack:isWeaponClass(item),attr:explicit.attribute,skill:explicit.skill,type:explicit.damageType||damageType(item)||'Untyped',category:explicit.category||gearCategory(item),ap:Math.max(0,toNum(explicit.ap,0)),properties:explicit.properties||'',source:'explicit'}; }
    const cat=gearCategory(item), text=String([item.name,item.class,item.desc,item.adds?.[2]].join(' ')).toLowerCase();
    let attr='muscle', skill='melee', type=damageType(item)||'Untyped';
    if(/energy|arcane|spell|hex|neural|psychic|magic|ward|curse|shade|spark/.test(text)){ attr='spark'; skill='cast'; }
    else if(cat==='unarmed' || /fist|claw|brass knuckles|punch|kick|unarmed/.test(text)){ attr='muscle'; skill='brawl'; }
    else if(/ballistic|pistol|rifle|shotgun|smg|gun|crossbow|bow|dart|thrown|ranged/.test(text)){ attr='reflex'; skill='ranged'; }
    else if(cat==='light' || /knife|dagger|shiv|holdout|short blade/.test(text)){ attr='reflex'; skill='melee'; }
    return {attack:isWeaponClass(item),attr,skill,type,category:cat,ap:0,properties:'',source:'legacy inference'};
  }
  function rawAttackSteps(category,successes,defense){
    const excess=Math.max(0,successes-defense);
    if(successes<=defense) return 0;
    if(category==='light' || category==='unarmed') return 1;
    if(category==='heavy') return Math.max(1,excess*2);
    if(category==='special') return Math.max(1,excess);
    return excess;
  }
  function rollDicePool(n){ const out=[]; for(let i=0;i<n;i++) out.push(1+Math.floor(Math.random()*6)); return out; }
  function countSuccesses(dice){ return dice.reduce((sum,d)=>sum+(d>=5?1:0),0); }
  function outcomeForCheck(successes,target){
    target=Math.max(1,toNum(target,1));
    if(successes===0) return {kind:'Complete Failure',text:'0 successes. The action fails and the situation gets worse.'};
    if(successes<target) return successes===target-1?{kind:'Partial Success',text:'One short. You succeed, but with a cost.'}:{kind:'Failure',text:'Not enough successes to meet the difficulty.'};
    if(successes-target>=3) return {kind:'Critical Success',text:'Three or more successes over the target.'};
    return {kind:'Success',text:'Target met.'};
  }
  function woundRollPenalty(context){
    const ws=currentWoundIndex();
    if(ws===1 && context==='physical') return {mod:-1, notes:['Hurt: -1 die on physical checks.']};
    if(ws===2) return {mod:-2, notes:['Wounded: -2 dice on all checks.']};
    if(ws===3) return {mod:0, notes:['Critical: one Action per turn only; must receive medical attention this scene or die.']};
    return {mod:0, notes:[]};
  }
  function conditionRollEffects(attr,context){
    let mod=0, notes=[]; const seen={};
    currentConditions().forEach(c=>{
      if(seen[c]) return; seen[c]=1;
      if(c==='Paranoid' && attr==='savvy'){ mod-=1; notes.push('Paranoid: -1 die on Savvy checks.'); }
      else if(c==='Burnt Out' && (attr==='wit'||attr==='spark')){ mod-=1; notes.push('Burnt Out: -1 die on Wit and Spark checks.'); }
      else if(c==='Going Through It' && context==='social'){ mod-=1; notes.push('Going Through It: -1 die on social checks.'); }
      else if(c==='Locked In'){ notes.push('Locked In: cannot retreat or de-escalate in combat without a Savvy check.'); }
      else if(c==='Frozen'){ notes.push('Frozen: lose React for the scene; may need to spend an Action to reorient.'); }
    });
    if(toNum(S().stats.stress,0)>=6) notes.push('Breakdown: act on both Conditions until both clear.');
    return {mod,notes};
  }
  function buildPool(attr,skillValue,context,situational,extra,label){
    const d=deriveCore(); const attrVal=Math.max(1,toNum(d.final[attr],1)); const wound=woundRollPenalty(context); const cond=conditionRollEffects(attr,context);
    const totalRaw=attrVal+Math.max(0,toNum(skillValue,0))+toNum(situational,0)+toNum(extra,0)+wound.mod+cond.mod;
    const total=Math.max(0,Math.min(10,Math.floor(totalRaw)));
    return {attrVal,wound,cond,pushBonus:0,total,totalRaw,skillValue:Math.max(0,toNum(skillValue,0)),situational:toNum(situational,0),extra:toNum(extra,0),label:label||'Roll'};
  }
  function ensurePlayAutomationState(){ if(!S().playAutomation||typeof S().playAutomation!=='object') S().playAutomation={}; if(!Array.isArray(S().playAutomation.log)) S().playAutomation.log=[]; if(!Array.isArray(S().playAutomation.undo)) S().playAutomation.undo=[]; }
  function playSnapshot(){ return {stats:deepCopy(S().stats),equipment:deepCopy(S().equipment),inventory:deepCopy(S().inventory),combatFlags:deepCopy(S().combatFlags||{})}; }
  function actionChanges(before, after, path=[]) {
    if (JSON.stringify(before)===JSON.stringify(after)) return [];
    if (before && after && typeof before==='object' && typeof after==='object' && Array.isArray(before)===Array.isArray(after)) {
      return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>actionChanges(before[key],after[key],[...path,key]));
    }
    return [{path,before:before===undefined?null:deepCopy(before),after:after===undefined?null:deepCopy(after),hadBefore:before!==undefined,hadAfter:after!==undefined}];
  }
  function actionValue(path) { return path.reduce((value,key)=>value?.[key],S()); }
  function playTimeStamp(){ const d=new Date(); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  function clearSlotByIndex(idx){ idx=normalizeEquipIndex(idx); if(idx===null) return; S().inventory[idx]=EMPTY_ITEM(); if(S().equipment.active===idx) S().equipment.active=null; if(S().equipment.secondary===idx) S().equipment.secondary=null; if(S().equipment.ammoSource===idx) S().equipment.ammoSource=null; }
  function removeIfNoRefillZero(idx){ idx=normalizeEquipIndex(idx); if(idx===null) return ''; const item=S().inventory[idx]; if(!itemNoRefill(item)) return ''; if(counts(item).cur>0) return ''; const nm=item.name||('slot '+String(idx+1).padStart(2,'0')); clearSlotByIndex(idx); return nm; }
  

  /* ---- pulled out of Edit sheet's screen code ---- */

  /* Core numbers from deriveCombat: attributes with gear tags, combat skills, mods, soak, Defense, Initiative. */
  function deriveCore(){
    const st=S().stats||{};
    const final={muscle:Math.max(1,toNum(st.muscle,1)),reflex:Math.max(1,toNum(st.reflex,1)),wit:Math.max(1,toNum(st.wit,1)),savvy:Math.max(1,toNum(st.savvy,1)),spark:Math.max(1,toNum(st.spark,1)),root:Math.max(1,toNum(st.root,1))};
    const skills={brawl:skillValue('brawl'),melee:skillValue('melee'),ranged:skillValue('ranged'),dodge:skillValue('dodge'),dash:skillValue('dash'),cast:skillValue('cast')};
    const mods={atk:0,def:0,dmg:0,ap:0,dash:0,dodge:0,move:0,init:0}; const soak={ballistic:0,blade:0,impact:0,energy:0}; const tags=[];
    [equippedItem('armor'),equippedItem('active'),equippedItem('secondary'),equippedItem('back')].filter(Boolean).forEach(item=>applyItemMods(item,final,mods,soak,tags)); const equippedArmor=equippedItem('armor'); if(equippedArmor){ const p=normalizeArmorProfile(equippedArmor); ['ballistic','blade','impact','energy'].forEach(k=>{ if(toNum(p.base[k],0)>0) soak[k]=toNum(p.current[k],0); }); }
    attrNames().forEach(k=>final[k]=Math.max(1,Math.floor(final[k]||1)));
    skills.dash=Math.max(0,Math.floor(skills.dash+mods.dash)); skills.dodge=Math.max(0,Math.floor(skills.dodge+mods.dodge));
    return {final,skills,mods,soak,tags,defense:defenseFromReflex(final.reflex),init:Math.max(1,final.reflex+skills.dash+mods.init)};
  }

  /* The hit table from performAttackRoll: successes vs Defense -> Miss / Graze / Armored Graze / Hit for N steps. */
  function resolveAttack(successes,defense,category,targetSoak,trait,ap){
    const raw=rawAttackSteps(category,successes,defense), traitDelta=trait==='resist'?-1:(trait==='vulnerable'?1:0), afterTrait=Math.max(0,raw+traitDelta), effectiveSoak=Math.max(0,targetSoak-ap), finalSteps=Math.max(0,afterTrait-effectiveSoak);
    let kind='Miss', summary='Attack misses.'; const notes=[];
    if(successes<defense){ kind='Miss'; summary='Miss. No hit.'; } else if(successes===defense){ kind='Graze'; summary='Graze. Target takes -1 die on its next action.'; notes.push('Armor is irrelevant to a Graze.'); } else if(finalSteps===0){ kind='Armored Graze'; summary='Armor or resistance soaked the hit to 0. Target takes 1 Stress and -1 die on its next action.'; } else { kind=category==='special'?'Hit (Special)':'Hit'; summary='Hit for '+finalSteps+' Wound step'+(finalSteps===1?'':'s')+'.'; if(category==='special') notes.push('Resolve any additional special rule from the item text.'); }
    return {kind,summary,notes,raw,traitDelta,afterTrait,effectiveSoak,finalSteps};
  }

  /* Attack pool for an equipped weapon: the same pool Edit sheet's attack roll builds. */
  function attackPool(which,situational){
    const item=equippedItem(which); if(!item||!isWeaponClass(item)) return null;
    const d=deriveCore(), profile=classifyAttackProfile(item), local=parseItemLocalMods(item), skill=toNum(d.skills[profile.skill],0);
    const pool=buildPool(profile.attr,skill,profile.attr==='savvy'?'social':'physical',toNum(situational,0),toNum(d.mods.atk,0),item.name||'Attack');
    const c=counts(item);
    return {item,profile,pool,skill,ap:Math.max(0,toNum(profile.ap,0)+toNum(local.ap,0)),category:profile.category||gearCategory(item),spends:c.max>0,ammo:c,canFire:!(c.max>0)||(itemAllows(item,'fire')&&c.cur>=1)};
  }

  function pushRoll(entry){ const s=S(); if(!Array.isArray(s.rollHistory)) s.rollHistory=[]; s.rollHistory.unshift(entry); s.rollHistory=s.rollHistory.slice(0,20); }

  /* Action history with guarded Undo (PR #8). before = playSnapshot() taken before the change. */
  function recordAction(label,detail,before){ ensurePlayAutomationState(); const s=S(); s.playAutomation.log.unshift({label,detail,time:playTimeStamp(),wound:s.stats.woundState,stress:s.stats.stress,heat:s.stats.heat}); s.playAutomation.log=s.playAutomation.log.slice(0,30); const changes=actionChanges(before,playSnapshot()); const slots=[...new Set(changes.filter(c=>c.path[0]==='inventory').map(c=>c.path[1]))]; s.playAutomation.undo.unshift({label,changes,items:slots.map(slot=>({slot,after:deepCopy(s.inventory[slot])}))}); s.playAutomation.undo=s.playAutomation.undo.slice(0,8); }
  /* Runs mutator; if it returns false nothing is recorded. Returns the mutator's message or false. */
  function act(label,detail,mutator){ ensurePlayAutomationState(); const before=playSnapshot(); const result=mutator(); if(result===false) return false; recordAction(label,result||detail,before); return result||detail; }
  function canUndo(){ const u=S().playAutomation&&S().playAutomation.undo; return !!(u&&u.length); }
  /* -> {ok, message}. Refuses if anything the action touched was changed afterwards. */
  function undoLast(){
    ensurePlayAutomationState(); const s=S(), last=s.playAutomation.undo[0];
    if(!last) return {ok:false,message:'No action to undo.'};
    if(!last.changes) return {ok:false,message:'This older action uses a full snapshot. Undo is unavailable to protect later edits.'};
    if((last.items||[]).some(item=>JSON.stringify(s.inventory[item.slot])!==JSON.stringify(item.after))||last.changes.some(c=>JSON.stringify(actionValue(c.path))!==JSON.stringify(c.hadAfter?c.after:undefined))) return {ok:false,message:'Cannot undo: an affected value changed later. Your edits have been kept.'};
    for(const c of last.changes){const parent=c.path.slice(0,-1).reduce((v,k)=>v[k],s);const key=c.path.at(-1);if(c.hadBefore)parent[key]=deepCopy(c.before);else delete parent[key];}
    s.playAutomation.undo.shift();
    s.playAutomation.log.unshift({label:'UNDO',detail:'Reverted '+last.label+'. Rolls remain in history.',time:playTimeStamp(),wound:s.stats.woundState,stress:s.stats.stress,heat:s.stats.heat});
    s.playAutomation.log=s.playAutomation.log.slice(0,30);
    return {ok:true,message:'Undid '+last.label+'. Rolls remain in history.',label:last.label};
  }

  /* Use a consumable card in a slot: -1 use, heal its Wound/Stress, drop an empty NO REFILL card. -> {ok, message} */
  function canUse(item){ return !!item&&!isWeaponClass(item)&&!isAmmoClass(item)&&itemAllows(item,'use')&&counts(item).cur>=1; }
  function useSlot(idx){ const s=S(), item=s.inventory[idx]; if(!canUse(item)) return {ok:false,message:'Selected card cannot be used right now.'}; const c=counts(item), a=item.adds||[],recovery=Math.max(0,Math.floor(toNum(a[4],0))),relief=Math.max(0,Math.floor(toNum(a[5],0))),oldW=toNum(s.stats.woundState,0),oldS=toNum(s.stats.stress,0); s.stats.woundState=String(clampInt(oldW-recovery,0,3)); s.stats.stress=String(clampInt(oldS-relief,0,stressCap(s.character.level))); setCur(item,c.cur-1); const removed=removeIfNoRefillZero(idx); return {ok:true,message:'Used '+(item.name||'selected item')+': -1 use, wound '+oldW+' → '+s.stats.woundState+', stress '+oldS+' → '+s.stats.stress+'.'+(removed?' Removed empty NO REFILL '+removed+'.':'')}; }
  function usePreview(idx){ const s=S(), item=s.inventory[idx]; if(!item) return {blocked:true,text:'No card.'}; const c=counts(item),a=item.adds||[],w=toNum(s.stats.woundState,0),st=toNum(s.stats.stress,0); return {blocked:!canUse(item),text:(item.name||'Item')+' · Uses '+c.cur+' → '+Math.max(0,c.cur-1)+'\nWounds '+w+' → '+Math.max(0,w-Math.max(0,Math.floor(toNum(a[4],0))))+'\nStress '+st+' → '+Math.max(0,st-Math.max(0,Math.floor(toNum(a[5],0))))+(itemNoRefill(item)&&c.cur===1?'\nThe empty card will be removed. Undo can restore it.':'')+(c.cur<1?'\nNo uses remain.':'')}; }

  /* Reload an equipped weapon from the ammo source. -> {ok, message} */
  function canReload(which){ const s=S(), w=equippedItem(which), ai=normalizeEquipIndex(s.equipment&&s.equipment.ammoSource), ammo=ai===null?null:s.inventory[ai]; if(!w||!isWeaponClass(w)||!itemAllows(w,'reload')||!ammo||!isAmmoClass(ammo)||!sameAmmoType(w,ammo)) return false; const wc=counts(w),ac=counts(ammo); return wc.max>0&&wc.cur<wc.max&&ac.cur>0; }
  function reloadEquipped(which){ const s=S(), idx=normalizeEquipIndex(s.equipment[which]); if(idx===null) return {ok:false,message:'No '+which+' weapon equipped.'}; const weapon=s.inventory[idx], ai=normalizeEquipIndex(s.equipment.ammoSource); if(!isWeaponClass(weapon)) return {ok:false,message:'Equipped '+which+' item is not a weapon.'}; if(ai===null) return {ok:false,message:'No ammo source selected.'}; const ammo=s.inventory[ai], wc=counts(weapon), ac=counts(ammo); if(!isAmmoClass(ammo)||!sameAmmoType(weapon,ammo)||wc.max<=0||wc.cur>=wc.max||ac.cur<=0) return {ok:false,message:'Reload blocked: check ammo source, matching type, weapon capacity, and available ammo.'}; const moved=Math.min(wc.max-wc.cur,ac.cur); setCur(weapon,wc.cur+moved); setCur(ammo,ac.cur-moved); const removed=removeIfNoRefillZero(ai); return {ok:true,message:'Reloaded '+(weapon.name||'weapon')+' with '+moved+' from '+(ammo.name||'ammo')+'.'+(removed?' Removed empty NO REFILL '+removed+'.':'')}; }

  /* Push: after a roll, +2 dice for +1 Stress. Refused at full Stress. -> {ok, message} */
  function canPush(){ const s=S(); return toNum(s.stats.stress,0)<stressCap(s.character.level); }
  function payPush(){ const s=S(); if(!canPush()) return {ok:false,message:'Stress is full. Resolve further pressure with the GM before pushing.'}; s.stats.stress=String(toNum(s.stats.stress,0)+1); return {ok:true,dice:rollDicePool(2)}; }

  return {
    SLOT_COUNT, BASE_UNLOCKED_SLOTS, COUNT_LIMIT, EMPTY_ITEM,
    toNum, clampInt, deepCopy, itemType, isWeaponClass, isAmmoClass, isConsumableClass, isBackClass, itemNoRefill,
    defaultActionsForClass, getItemActions, itemAllows, counts, setCur, gearCategory, damageType, ammoType, sameAmmoType,
    parseSignedTags, applyItemMods, parseItemLocalMods, blankArmorProfile, legacyArmorFromItem, normalizeArmorProfileData,
    normalizeArmorProfile, slotBonusFromText, backSlotBonus, normalizeEquipIndex, equippedItem, unlockedSlotCount, attrNames,
    skillRankRaw, skillValue, stressCap, heatCap, defenseFromReflex, currentWoundIndex, currentConditions, classifyAttackProfile,
    rawAttackSteps, rollDicePool, countSuccesses, outcomeForCheck, woundRollPenalty, conditionRollEffects, buildPool,
    ensurePlayAutomationState, playSnapshot, actionChanges, actionValue, playTimeStamp, clearSlotByIndex, removeIfNoRefillZero,
    deriveCore, resolveAttack, attackPool, pushRoll, recordAction, act, canUndo, undoLast, canUse, useSlot, usePreview,
    canReload, reloadEquipped, canPush, payPush
  };
}
window.GRAKK_ENGINE = { create, SLOT_COUNT, BASE_UNLOCKED_SLOTS, COUNT_LIMIT, EMPTY_ITEM };
})();
