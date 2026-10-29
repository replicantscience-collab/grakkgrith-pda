# GRAKKGRITH PDA

The companion web app for GRAKKGRITH, the Adyta tabletop RPG: character setup, character sheet, inventory, rolls, downtime, campaign state, district dossiers, and the city and district maps. It installs on phones and desktops as a PWA and works offline after the first visit.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The shell: top nav, World pages (Start, City, Missions, Factions, Lore, Logs), campaign State, district dossiers, map viewer |
| `apps/creator.html` | Character Setup: races, classes, subclasses, origins, lives, gear, attribute points |
| `apps/explore.html` | Explore: the city and district maps, places, travel, and where your character is right now |
| `apps/guide.html` | Guides: Sideways Shops' guide to the races (card wall, tap a card for the full entry) |
| `apps/player.html` | Character Sheet: wounds, stress, inventory, rolls, downtime, grith, Heat |
| `data/rules.json` | **The rules.** Races, classes, subclasses, origins, lives, skills, street magic tags, territories, starting loadouts, Shade workings, downtime actions. Both the creator and the sheet read this one file. |
| `data/places.json` | **The map.** Districts, places, pins, routes and travel times, tram hours, and the Adyta clock |
| `data/guides/races.json` | What Sideways Shops says about each race: blurbs, traits, lifespans, card art, tips. Game numbers come from `rules.json`. |
| `art/sideways-shops/` | Guide art. Race cards are cut from the Sideways Shops poster; replace a card's image to re-render it. |
| `fonts/` | Fonts bundled for offline use, with their licenses |
| `data/rulebook-reference.json` | Facts copied from the rulebook that `rules.json` is checked against |
| `tools/check-rules.mjs` | The rules check (see below) |
| `maps/official/` | Official maps used by Explore: the city, Low Halo, Ember Court, Market Ring, Dockside |
| `maps/` | Older street-layer maps used by the City page (Low Halo, Ember Court, Sewers) |
| `icons/`, `manifest.json` | PWA install icons and metadata |
| `sw.js` | Service worker: offline cache |

The shell loads `data/rules.json` once and hands it to the creator and sheet, then loads them into an iframe; they talk through `postMessage` events named `grakkgrith-*`. Everything is saved in each player's own browser (localStorage); there is no server.

## Run it locally

Any static file server works; opening `index.html` straight from disk will not, because the shell fetches the apps.

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Changing the rules

Edit `data/rules.json`. Never edit rules inside `apps/creator.html` or `apps/player.html`; there are none there anymore, and both read the shared file.

Then run the check:

```
node tools/check-rules.mjs
```

It compares `rules.json` with the rulebook facts in `data/rulebook-reference.json` (race modifiers, resistances, vulnerabilities, classes, subclasses and their race locks, origins, lives, skills, street magic tags) and catches broken references, like a Life granting a skill that doesn't exist. GitHub runs it on every push and pull request, so a mistake shows up as a red ✗ on the commit.

**When the rulebook changes:** update `rulebook-reference.json` first. The check then lists exactly what `rules.json` still needs.

**Renaming something players may have saved** (a subclass, origin, or life): add the old name to an `aliases` list on the entry so existing characters keep working. See `LHL Courier` for an example.

## The Explore map

Explore puts your character somewhere in Adyta. Tap a place for its details, then travel there: on foot, or by tram while the trams run (the last one leaves at 12:17 AM). Travel takes Adyta time, and your character is in transit until they arrive, even if you close the app.

**The Adyta clock** runs at real speed with a fixed offset, set in `data/places.json` under `clock`: at `anchorReal` it was `anchorAdyta` in Adyta.

**Fixing pins.** Pins sit at the left edge of each map label. Dashed pins were placed by eye and may be slightly off. To fix any pin:
1. In Explore, tap **Edit pins**.
2. Drag pins where they belong, tap an empty spot to add a place, or tap a pin to rename or remove it.
3. Tap **Share pins**, then **Download places.json**, and replace `data/places.json` in the repo with it.

Changes stay in your browser until you do step 3.

**Re-rendered a map?** Replace the image in `maps/official/` (same file name), then fix the pins as above.

**Travel times** marked "estimate" aren't printed on any map. Edit `routes` in `places.json` (`walk` and `tram` are minutes) when the real numbers are known.

## Changing anything else

- **Bump the cache** whenever you change a file: edit `CACHE_NAME` in `sw.js` (`grakkgrith-v41` → `grakkgrith-v42`) so installed copies pick up the update.
- **Adding a file** that should work offline: add it to the `ASSETS` list in `sw.js`. Maps and other big images stay off that list; they are saved the first time someone opens them, so a first visit stays small (about 2 MB).
- **New map art:** save it as JPG (quality around 85), not PNG. A map PNG is 3 MB or more; the JPG looks the same at a fifth of the size.

## Moving characters from the old Seele version

Saved data does not carry over between web addresses. On the old version, open the Character Sheet and use **Export JSON**; on the new one, use **Import JSON**.

## History

Recovered on 2026-10-29 from the published Seele AI build (service worker v38). In that build the creator and sheet were embedded inside the shell as base64 text; they are now separate files. Seele's analytics beacon was removed.

## Known gaps against the First Edition v1.47 rulebook

- Not built yet: the Arcane Heart / Magical Veins casting engine, Vampire Vitality, Afflictions, Mixed Heritage, Called Shots.
