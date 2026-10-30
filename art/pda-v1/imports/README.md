# Adyta PDA — prior art intake (2026-10-30)

**10 user-supplied image sources preserved**: four faction/corporate posters, four distinct 12-sticker sheets, one alternate export of Mischief Sigils, and one multi-sticker Patchkin collage.

## Recommended placement

| Artwork | Where it fits | Notes |
|---|---|---|
| Velvet Signal | Faction dossier, intercepted advert, Mail and Signal communications | Magenta/cyan corporate media aesthetic; in-world propaganda, not objective truth |
| New Halo | Crownline initiative / city developments / housing notice | Gold luxury lifestyle advertising; subordinate to Crownline, not automatically a separate faction |
| Crownline | Faction profile, route authorization and transit interfaces | Clean blue-white institutional access-control look |
| Bastion Dynamics | Faction profile, security jobs, Heat/enforcement visuals | Black/gold military contractor look |
| Patchkin Utility | Make screen, Sigils and inventory | Fix, Anchor, Shield, Focus, etc.; effects must come from rules |
| Patchkin Mischief | Sideways offers, Heat, stealth and underground economy | Distract, Detour, Jam etc. — provocative humor, not guaranteed effects |
| Patchkin Ritual | Shade Make, location ward labels | Treat labels like proposals pending GM/canon review |
| Patchkin Technomancy | Wrench/Signal Make, items, jobs and maker branding | Cyber-arcane circuit style |
| Mischief alternate | Optional second export | Very similar to primary Mischief; do not list as 12 distinct new effects |
| Patchkin marks collage | Gremlin Works labels, physical PDA maker marks | Companion reference for physical decal and packaging applications |

## Directory structure

- `originals/`: unchanged images as delivered.
- `web/factions/posters/`: optimized WebP versions, use for full-screen dossiers.
- `web/factions/cards/`: wide 16:9 scenic crops for cards. Preview before use: they intentionally omit poster headlines.
- `web/stickers/sheets/`: lighter full sticker sheets for galleries.
- `web/stickers/rough-crops/`: **48 ROUGH crops** from 4×3 grids; rectangular image tiles, **not** clean die-cut transparent PNGs. Text, edges and sticker outline placement need visual QA.
- `manifest.json`: full source-to-export mapping and safe integration metadata.
- `index.html`: visual gallery preview; open locally in browser (no external dependencies).

## Instructions for Claude

1. Preserve `data/rules.json`, `data/places.json`, saved characters, Heat and Make mechanics. These are images only.
2. Keep user-provided faction slogans as **in-universe promotional claims**, never canonical facts.
3. Connect portraits, poster art and cards by stable asset ID. New Halo is presented as a Crownline initiative.
4. For the Start page: Factions tile can use a rotating/filtered card crop, but do not animate automatically if `prefers-reduced-motion`.
5. For Faction pages: use full poster as backdrop or media panel with accessible alt text; HTML should render real names and faction descriptions.
6. For Make: initially expose full Patchkin sticker sheets as a gallery. Only enable individual sticker crafting after rules/ownership/availability are defined.
7. For product stickers: produce independently masked transparent variants, not these rectangular rough cuts, before printing or distribution.
8. Keep images lazy except the one first-view tile; compare mobile performance. Do not put all large posters into offline precache.
9. Request Nib review for faction identities, logos, slogans and how artwork is used.
10. Run existing `npm run check` and `npm run smoke` after any code changes.

**No GitHub repository files have been modified by building this pack.**

## Repo-drop path conventions

This archive is structured to extract **at the root of** `grakkgrith-pda`. Its images land under `art/pda-v1/imports/`. They are **not yet committed to GitHub**. Asset references inside `manifest.json` are relative to the original intake pack; use the `factions/` and `stickers/` subfolders inside `imports/` for integration.
