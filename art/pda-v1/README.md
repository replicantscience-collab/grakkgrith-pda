# Adyta PDA × Sideways Shops — visual foundation v0.1

**Design kit, not a replacement app.** These files add reusable **SVG visual assets**, scoped CSS tokens/components, and a working self-contained HTML preview. The existing game's code, rules, save formats, maps, service worker, and data remain unchanged.

## Preview
Serve the repository (e.g. `python -m http.server 8000` at root) and open `/art/pda-v1/preview.html`. This is a visual concept built partly on the existing art in `art/sideways-shops/` and `maps/`, not a functioning game page.

## What is included
- `assets/*.svg`: 12 lightweight original scalable vector assets; **text-free** (except the intentionally lettered unofficial stamp). The district skyline is illustrative, **not** a playable map.
- `tokens.css`: all additions scoped under `.pda-art`; reuses the repo's bundled fonts (Permanent Marker, Saira Condensed, Atkinson Hyperlegible).
- `components.css`: hero, tab, paper note, panel, card, divider, sticker, responsive layout styles.
- `preview.html`: visual checks at desktop and phone sizes.
- `asset-manifest.json`: asset roles and source-of-truth cautions.
- `CLAUDE_HANDOFF.md`: integration instructions in small safe slices.

## Boundaries
The source of truth for game mechanics stays `data/rules.json`; for city/location/travel state it stays `data/places.json`. In-world Sideways commentary belongs to `data/guides/races.json` or a similarly separate commentary layer. Keep character saves, inventory, simulation logic, and map pin transforms unchanged.

The four large rendered concept screenshots from the design discussion are **directional references**; they are not shippable app screens or validated game UI. This kit provides actual reusable assets rather than baking buttons and stats into images.

## Next
Have Claude start with the **shell + Start + existing Goblin guide**, compare mobile screenshots, and then move to City/Curiosities. Do not replace all routes or the game state at once.

See `CLAUDE_HANDOFF.md`.

