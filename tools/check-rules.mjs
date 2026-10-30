#!/usr/bin/env node
// Checks data/rules.json against data/rulebook-reference.json (facts copied from the rulebook)
// and checks rules.json for internal consistency. No dependencies: `node tools/check-rules.mjs`.
// Exit code 1 if anything is wrong, so CI can block a bad change.
import { readFileSync, existsSync } from 'node:fs';

const load = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const rules = load('data/rules.json');
const ref = load('data/rulebook-reference.json');
const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
// "Fire, Necrotic" -> ["Fire","Necrotic"]; "None" / "—" / "None (note)" -> []
const typeList = s => String(s ?? '').split(',').map(x => x.replace(/\(.*\)/, '').trim()).filter(x => x && !/^(none|—|-)$/i.test(x));

// --- Races -----------------------------------------------------------------
const races = Object.keys(rules.races).filter(r => !rules.races[r].custom);
for (const r of Object.keys(ref.races)) if (!races.includes(r)) bad('races', `missing ${r}`);
for (const r of races) if (!ref.races[r]) bad('races', `${r} is not in the rulebook`);
for (const [name, want] of Object.entries(ref.races)) {
  const have = rules.races[name], det = rules.raceDetails[name];
  if (!have) continue;
  for (const a of ref.attributes) {
    const h = have.mods?.[a] ?? 0, w = want.mods[a] ?? 0;
    if (h !== w) bad(`races.${name}.mods.${a}`, `is ${h}, rulebook says ${w}`);
  }
  if (!!have.choice !== !!want.choice) bad(`races.${name}.choice`, `should be ${!!want.choice}`);
  if (!det) { bad(`raceDetails.${name}`, 'missing'); continue; }
  if (!same(typeList(det.resistance), want.resistance)) bad(`raceDetails.${name}.resistance`, `is "${det.resistance}", rulebook says ${want.resistance.join(', ') || 'none'}`);
  if (!same(typeList(det.vulnerability), want.vulnerability)) bad(`raceDetails.${name}.vulnerability`, `is "${det.vulnerability}", rulebook says ${want.vulnerability.join(', ') || 'none'}`);
  // The short table may repeat these; if it does, it must agree.
  if ('resistance' in have && !same(typeList(have.resistance), want.resistance)) bad(`races.${name}.resistance`, `is "${have.resistance}", rulebook says ${want.resistance.join(', ')}`);
  if ('vulnerability' in have && !same(typeList(have.vulnerability), want.vulnerability)) bad(`races.${name}.vulnerability`, `is "${have.vulnerability}", rulebook says ${want.vulnerability.join(', ')}`);
}
for (const [name, det] of Object.entries(rules.raceDetails)) {
  for (const t of [...typeList(det.resistance), ...typeList(det.vulnerability)])
    if (!ref.damageTypes.includes(t)) bad(`raceDetails.${name}`, `"${t}" is not a damage type`);
}

// --- Classes and subclasses --------------------------------------------------
for (const [cls, want] of Object.entries(ref.classes)) {
  const have = rules.classes[cls];
  if (!have) { bad('classes', `missing ${cls}`); continue; }
  const subs = Object.fromEntries((have.subclasses || []).map(s => [s.name, s.race ?? null]));
  for (const [sub, race] of Object.entries(want.subclasses)) {
    if (!(sub in subs)) bad(`classes.${cls}`, `missing subclass ${sub}`);
    else if (subs[sub] !== race) bad(`classes.${cls}.${sub}`, `race lock is ${subs[sub] ?? 'none'}, rulebook says ${race ?? 'none'}`);
  }
  for (const sub of Object.keys(subs)) if (!(sub in want.subclasses)) bad(`classes.${cls}`, `subclass ${sub} is not in the rulebook`);
}
for (const cls of Object.keys(rules.classes)) if (!ref.classes[cls]) bad('classes', `${cls} is not in the rulebook`);

// --- Origins, Lives, Street Magic Tags --------------------------------------
for (const [o, race] of Object.entries(ref.origins)) {
  if (!rules.origins[o]) { bad('origins', `missing ${o}`); continue; }
  if ((rules.origins[o].race ?? null) !== race) bad(`origins.${o}.race`, `is ${rules.origins[o].race ?? 'any'}, rulebook says ${race ?? 'any'}`);
}
for (const o of Object.keys(rules.origins)) if (!(o in ref.origins)) bad('origins', `${o} is not in the rulebook`);
if (!same(Object.keys(rules.lives), ref.lives)) bad('lives', `rules have [${Object.keys(rules.lives)}], rulebook has [${ref.lives}]`);
if (!same(Object.keys(rules.streetTags), ref.streetTags)) bad('streetTags', `rules have [${Object.keys(rules.streetTags)}], rulebook has [${ref.streetTags}]`);

// --- Skills -------------------------------------------------------------------
for (const [domain, list] of Object.entries(ref.skills)) {
  const have = rules.skills[domain]?.[1];
  if (!have) bad('skills', `missing domain ${domain}`);
  else if (JSON.stringify(have) !== JSON.stringify(list)) bad(`skills.${domain}`, `is [${have}], rulebook says [${list}]`);
}
const allSkills = Object.values(ref.skills).flat();
for (const s of allSkills) if (!rules.skillKeys[s]) bad('skillKeys', `no key for ${s}`);

// --- Mixed Heritage (Chapter 15) and Afflictions (Chapter 20) ---------------------
{
  const mh = rules.mixedHeritage, want = ref.mixedHeritage;
  if (!mh) bad('mixedHeritage', 'missing');
  else {
    if (!same(mh.mortal, want.mortal)) bad('mixedHeritage.mortal', `is [${mh.mortal}], rulebook says [${want.mortal}]`);
    if (!same(Object.keys(mh.marks), want.markLists)) bad('mixedHeritage.marks', `lists [${Object.keys(mh.marks)}], rulebook has [${want.markLists}]`);
    for (const [sp, m] of Object.entries(mh.marks)) {
      if (!rules.races[sp]) bad(`mixedHeritage.marks.${sp}`, 'not a race');
      if (m.marks.length !== want.marksEach) bad(`mixedHeritage.marks.${sp}`, `has ${m.marks.length} marks, rulebook has ${want.marksEach}`);
    }
    if (mh.complications.length !== want.complications) bad('mixedHeritage.complications', `has ${mh.complications.length}, rulebook has ${want.complications}`);
    if (mh.registrations.length !== want.registrations) bad('mixedHeritage.registrations', `has ${mh.registrations.length}, rulebook has ${want.registrations}`);
  }
  const af = rules.afflictions, wa = ref.afflictions;
  if (!af) bad('afflictions', 'missing');
  else {
    if (JSON.stringify(af.stages) !== JSON.stringify(wa.stages)) bad('afflictions.stages', `is [${af.stages}], rulebook says [${wa.stages}]`);
    for (const n of wa.rulebook) if (!af.list[n]) bad('afflictions', `missing ${n}`);
    for (const s of af.startingStages) if (!af.stages.includes(s)) bad('afflictions.startingStages', `${s} is not a stage`);
    for (const [n, a] of Object.entries(af.list)) {
      for (const part of ['passive', 'active', 'compulsion', 'weakness']) if (!a[part]) bad(`afflictions.${n}`, `missing ${part} (every Affliction has all five parts)`);
      if (!['rulebook', 'draft'].includes(a.status)) bad(`afflictions.${n}.status`, 'must be rulebook or draft');
      if (a.status === 'rulebook' && !wa.rulebook.includes(n)) bad(`afflictions.${n}`, 'marked rulebook but not in the rulebook; mark it draft');
      const choices = a.adaptation?.choices === 'aspect' ? (a.aspects || []).map(x => x.adaptation) : (a.adaptation?.choices || []);
      for (const ch of choices) if (!ref.attributes.includes(ch)) bad(`afflictions.${n}.adaptation`, `${ch} is not an attribute`);
      for (const st of Object.keys(a.progression || {})) if (!af.stages.includes(st)) bad(`afflictions.${n}.progression`, `${st} is not a stage`);
    }
  }
}

// --- Internal consistency -----------------------------------------------------
for (const [kind, table] of [['origins', rules.origins], ['lives', rules.lives]]) {
  for (const [name, entry] of Object.entries(table)) {
    if (entry.race && !rules.races[entry.race]) bad(`${kind}.${name}.race`, `unknown race ${entry.race}`);
    for (const g of entry.grantOptions || []) {
      if (g.type === 'skill' && !allSkills.includes(g.name)) bad(`${kind}.${name}.grantOptions`, `unknown skill ${g.name}`);
      if (g.type === 'tag' && !rules.streetTags[g.name]) bad(`${kind}.${name}.grantOptions`, `unknown street tag ${g.name}`);
    }
  }
}
for (const cls of Object.keys(rules.classes)) if (!rules.startingLoadouts[cls]) bad('startingLoadouts', `missing ${cls}`);
for (const [cls, c] of Object.entries(rules.classes))
  for (const s of c.subclasses || []) if (s.race && !rules.races[s.race]) bad(`classes.${cls}.${s.name}`, `unknown race ${s.race}`);
const ids = new Set();
for (const t of rules.territories) { if (ids.has(t.id)) bad('territories', `duplicate id ${t.id}`); ids.add(t.id); }

// --- Explore map: data/places.json ------------------------------------------------
const W = load('data/places.json');
const inUnit = v => typeof v === 'number' && v >= 0 && v <= 1;
for (const [id, m] of Object.entries(W.maps)) {
  if (!existsSync(new URL('../' + m.image, import.meta.url))) bad(`places.maps.${id}`, `image ${m.image} not found`);
  if (m.kind === 'district' && !W.districts[m.district]) bad(`places.maps.${id}`, `unknown district ${m.district}`);
}
for (const [id, d] of Object.entries(W.districts)) {
  if (d.map && !W.maps[d.map]) bad(`places.districts.${id}`, `unknown map ${d.map}`);
  if (d.cityPin && !(inUnit(d.cityPin.x) && inUnit(d.cityPin.y))) bad(`places.districts.${id}.cityPin`, 'must be between 0 and 1');
}
const placeIds = new Set();
for (const p of W.places) {
  if (placeIds.has(p.id)) bad('places.places', `duplicate id ${p.id}`); placeIds.add(p.id);
  if (!W.districts[p.district]) bad(`places.places.${p.id}`, `unknown district ${p.district}`);
  if (p.pin && !W.maps[p.pin.map]) bad(`places.places.${p.id}`, `unknown map ${p.pin.map}`);
  if (p.pin && !(inUnit(p.pin.x) && inUnit(p.pin.y))) bad(`places.places.${p.id}.pin`, 'must be between 0 and 1');
}
for (const r of W.routes) {
  for (const end of [r.a, r.b]) if (!W.districts[end]) bad('places.routes', `unknown district ${end}`);
  if (!(r.walk > 0)) bad('places.routes', `${r.a}–${r.b} needs a walk time`);
}
for (const p of W.places) if (p.brand && !(W.brands || {})[p.brand]) bad(`places.places.${p.id}`, `unknown brand ${p.brand}`);
if (!placeIds.has(W.start.place) || !W.districts[W.start.district]) bad('places.start', 'start place or district not found');
if (Number.isNaN(Date.parse(W.clock.anchorReal)) || Number.isNaN(Date.parse(W.clock.anchorAdyta + 'Z'))) bad('places.clock', 'anchors must be dates');

// --- Report -------------------------------------------------------------------
if (problems.length) {
  console.error(`rules.json vs ${ref.rulebook}: ${problems.length} problem(s)\n` + problems.map(p => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`rules.json matches ${ref.rulebook}: ${races.length} races, ${Object.keys(rules.classes).length} classes, ${Object.keys(rules.origins).length} origins, ${Object.keys(rules.lives).length} lives.`);
console.log(`places.json is consistent: ${Object.keys(W.maps).length} maps, ${Object.keys(W.districts).length} districts, ${W.places.length} places, ${W.routes.length} routes.`);
