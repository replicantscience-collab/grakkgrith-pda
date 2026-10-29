# GRAKKGRITH PDA

The companion web app for GRAKKGRITH, the Adyta tabletop RPG: character setup, character sheet, inventory, rolls, downtime, campaign state, district dossiers, and the city and district maps. It installs on phones and desktops as a PWA and works offline after the first visit.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The shell: top nav, World pages (Start, City, Missions, Factions, Lore, Logs), campaign State, district dossiers, map viewer |
| `apps/creator.html` | Character Setup: races, classes, subclasses, origins, lives, gear, attribute points |
| `apps/player.html` | Character Sheet: wounds, stress, inventory, rolls, downtime, grith, Heat |
| `maps/` | City atlas and district maps (Low Halo, Ember Court, Sewers) |
| `icons/`, `manifest.json` | PWA install icons and metadata |
| `sw.js` | Service worker: offline cache |

The shell loads the creator and sheet into an iframe and they talk through `postMessage` events named `grakkgrith-*`. Everything is saved in each player's own browser (localStorage); there is no server.

## Run it locally

Any static file server works; opening `index.html` straight from disk will not, because the shell fetches the apps.

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Changing it

- **Bump the cache** whenever you change a file: edit `CACHE_NAME` in `sw.js` (`grakkgrith-v40` → `grakkgrith-v41`) so installed copies pick up the update.
- **Adding a file** that should work offline: add it to the `ASSETS` list in `sw.js`.

## Moving characters from the old Seele version

Saved data does not carry over between web addresses. On the old version, open the Character Sheet and use **Export JSON**; on the new one, use **Import JSON**.

## History

Recovered on 2026-10-29 from the published Seele AI build (service worker v38). In that build the creator and sheet were embedded inside the shell as base64 text; they are now separate files. Seele's analytics beacon was removed.

## Known gaps against the First Edition v1.47 rulebook

- Not built yet: the Arcane Heart / Magical Veins casting engine, Vampire Vitality, Afflictions, Mixed Heritage, Called Shots.
