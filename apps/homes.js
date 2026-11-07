/* Homes: turns a landlord (data/landlords.json) and a place's listings (data/rentals.json) into the home
   Mail & bills keeps under state.week.home. Shared by Explore and the scene pages, so renting works the same
   from the map or from a conversation. Pure logic: works in the browser (window.GRAKK_HOMES) and in Node. */
(function (root) {
  'use strict';
  const landlordOf = (LL, placeId) => (LL && LL.landlords || []).find(l => l.places.includes(placeId)) || null;
  const listing = (RT, placeId) => (RT && RT.places && RT.places[placeId]) || { units: [], quirks: [], neighbors: [] };
  const band = (RT, tier) => (RT && RT.bands && RT.bands[tier]) || null;
  /* Can this place be rented from the PDA at all? (Family seats, keepers' rooms and the Housing Authority can't.) */
  function rentable(l) { return !!(l && l.tier && !l.notForRent && !l.invitationOnly && !l.floorOnly); }
  /* The tier a unit bills at: crew units sit in the employer's tier, everything else in the landlord's. */
  function unitTier(l, u) { return u && u.staff && l.employer ? l.employer.tier : l.tier; }
  /* The landlord's terms, in the shape Mail & bills reads off a bill (grace and favor in days). */
  function rules(l) {
    const t = (l && l.terms) || {}, r = {};
    if (t.grace) { r.graceDays = 7 * t.grace.weeks; r.grace = t.grace.text; }
    if (t.favor) { r.favorDays = 7 * t.favor.weeks; r.favor = t.favor.text; }
    return Object.keys(r).length ? r : null;
  }
  /* One line per term, for the place card. */
  function describe(l) {
    const t = (l && l.terms) || {}, out = [];
    if (t.grace) out.push(`Late rent gets ${t.grace.weeks === 1 ? 'a week' : t.grace.weeks + ' weeks'} of grace${t.favor ? ', then a favor' : ''}.`);
    if (t.workOff) out.push(`${t.workOff.credits} off the rent for ${t.workOff.for}${t.workOff.classes ? ` (${t.workOff.classes.join(' or ')} work)` : ''}.`);
    if (t.creep) out.push(`Rent goes up ${t.creep.credits} every ${t.creep.everyWeeks} weeks.`);
    if (!t.grace && l && l.tier && !l.notForRent && !l.invitationOnly && !l.floorOnly) out.push('No grace: late rent becomes Debt.');
    return out;
  }
  function letters(LL, l) {
    const L = {};
    for (const k of ['missed', 'review', 'bastion', 'lost']) { const o = (l.letters || {})[k] || ((LL.letters || {})[l.type] || {})[k]; if (o) L[k] = o; }
    return L;
  }
  /* Everything moveIn needs. unitId picks a listing; without one, the first unit (or the bare tier price). */
  function homeFor(LL, RT, place, l, unitId) {
    const units = listing(RT, place.id).units || [], u = units.find(x => x.id === unitId) || units[0] || null;
    const tier = unitTier(l, u), b = band(RT, tier), t = l.terms || {};
    return { place: place.id, placeName: place.name, landlordId: l.id, landlordName: l.name, type: l.type, tier,
      unit: u ? u.id : null, unitName: u ? u.name : null, rent: u ? u.rent : null, cap: b ? b[1] : null, pay: u && u.pay || null,
      ladder: (LL.types[l.type] || {}).ladder ?? 4, letters: letters(LL, l), floor: LL.floor,
      rules: rules(l), workOff: t.workOff || null, creep: t.creep || null };
  }
  const api = { landlordOf, listing, band, rentable, unitTier, rules, describe, homeFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GRAKK_HOMES = api;
})(typeof window !== 'undefined' ? window : globalThis);
