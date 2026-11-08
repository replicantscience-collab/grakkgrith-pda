# Adyta PDA: art still needed

Updated 2026-11-07 (map/icon refresh), after the slim pass and the "no doubles" merges. The PDA's layout is now:
Start · Explore · Guides (Species, Quickstart, Rules) · Missions (Job Board, Pocket Change, Radio Sewers) ·
Factions (Factions, Corporations) · Lore (Lore, Anchors, Magic & tech, Stickers) · Inventory (Sheet, Workshop, Mail & bills, Logs).

Drop new art under `art/pda-v1/imports/<folder>/` with a manifest entry, the same way as the first two packs.
WebP, sized like the existing pieces (posters 1200×1500, cards 1600×900, square stickers ~512).

## Already in the app

| Art | Where it shows |
|---|---|
| Species cards (11, Fairy and corrected Orc/Dwarf from sprint 01) | Guides › Species |
| Posters: Crownline, New Halo, Bastion Dynamics, Velvet Signal | Factions › Corporations |
| Scene cards from those posters | Start › Factions tile |
| Radio Sewers DJs: Smokier, Mercury, DJ Sludge, DJ Stormbird (concepts) | Missions › Radio Sewers |
| City hero (draft), featured artifacts | Start |
| **All 48 Patchkin sticker crops** (new this pass) | Lore › Stickers, one per sigil; Utility and Mischief match the sigils one to one, Ritual and Technomancy in a gallery |
| Painted district maps: Low Halo, Ember Court, Market Ring, Dockside, Three Wires & Tangle, Noble Heights, plus the city map | Explore |

Not used and fine to leave that way: the upscaled city hero (the trimmed one is used), the Fairy master file, the alternate Mischief sheet.

## Shared symbols (review branch)

`apps/icons.js` supplies 24 SVG symbols. Explore uses place-category icons, filtering and a labelled place list. Both sheet Now bars reuse action symbols. See [icon gallery](icon-kit.html) and [coordination notes](../../docs/MAP_ICON_OVERLAYS.md). Item-card frames, recipe icons and new illustrations remain future work.

## Still needed, most visible first

1. ~~**Helix Systems and Meridian Logistics posters.**~~ Done 2026-11-05: Pulse-style painted posters from Eko, with scene cards cut from their hero art. Slogans "Better life, by design." and "Every route, right on time." pending Nib's review.
2. **Pocket Change logo.** The app is Velvet Signal's gig app; right now its logo is a plain ¢ in a box. A small square app icon (512×512) in Velvet's magenta/cyan.
3. **Clean, die-cut stickers.** The 48 crops are rectangular cuts off the sheets (edges and neighbours show). For the app and for print: each sticker on its own with a transparent background (PNG or WebP with alpha, ~512 square).
4. **Clan Mark stickers.** The Stickers page has four Clan Mark cards with no stickers yet, except Side Ways:
   Patchkin, Gremlin Works · Low Halo, Sewer Route · Scrap Oath, No Waste, Carry Forward · Shop Favor, Trade Fair, Vrekk, Griththren (11 stickers).
5. **Map finishing, not missing-map production.** Explore now has 28 maps covering 29 districts and 348 places, including candidate art. Keep newer maps as geography/building/route bases. Place symbols are overlaid from saved coordinates and types; do not paint interactive symbols into the images. Review candidate geography and pin placement separately from visual styling.
6. ~~**Story mission cards.**~~ Done 2026-11-05 as drafts: vector scenes for Pipe 37, Route Lock and What the File Says, plus a wide Side board banner (`imports/missions/`, sources in `imports/source/missions/`). Painted replacements can drop in over the same file names.
7. **Factions page art.** Corporations has posters; the Factions page (City Authority, ACW/Wardens, ABI, Antitoxin, Sewers Community, Patchkin and the other Commons groups) has none. A seal or emblem each would do (square, ~512).
8. **Final city hero for Start.** The current one is the sprint 01 draft.

## Nice to have

- Workshop: a small icon per class recipe (17 recipes) for the Make cards.
- Item cards: a default card back or class frames (weapon, armor, ammo, item, back/bag) for cards that have no picture yet.
- Radio Sewers: final DJ portraits once Nib signs off on the concepts.

## Needs Nib's review before it counts as canon

DJ portrait designs, faction identities and slogans, the Fairy design, and what each Ritual/Technomancy sticker means at the table.
