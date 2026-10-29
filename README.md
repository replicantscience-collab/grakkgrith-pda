# GRAKKGRITH PDA

The companion web app for GRAKKGRITH, the Adyta tabletop RPG: character setup, character sheet, inventory, rolls, downtime, campaign state, district dossiers, and the city and district maps. It installs on phones and desktops as a PWA and works offline after the first visit.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The shell: top nav, World pages (Start, City, Missions, Factions, Lore, Logs), campaign State, district dossiers, map viewer |
| `apps/creator.html` | Character Setup: races, classes, subclasses, origins, lives, gear, attribute points |
| `apps/player.html` | Character Sheet: wounds, stress, inventory, rolls, downtime, grith, Heat |
| `data/rules.json` | **The rules.** Races, classes, subclasses, origins, lives, skills, street magic tags, territories, starting loadouts, Shade workings, downtime actions. Both the creator and the sheet read this one file. |
| `data/rulebook-reference.json` | Facts copied from the rulebook that `rules.json` is checked against |
| `tools/check-rules.mjs` | The rules check (see below) |
| `maps/` | City atlas and district maps (Low Halo, Ember Court, Sewers) |
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

## Changing anything else

- **Bump the cache** whenever you change a file: edit `CACHE_NAME` in `sw.js` (`grakkgrith-v41` → `grakkgrith-v42`) so installed copies pick up the update.
- **Adding a file** that should work offline: add it to the `ASSETS` list in `sw.js`.

## Moving characters from the old Seele version

Saved data does not carry over between web addresses. On the old version, open the Character Sheet and use **Export JSON**; on the new one, use **Import JSON**.

## History

Recovered on 2026-10-29 from the published Seele AI build (service worker v38). In that build the creator and sheet were embedded inside the shell as base64 text; they are now separate files. Seele's analytics beacon was removed.

## Known gaps against the First Edition v1.47 rulebook

- Not built yet: the Arcane Heart / Magical Veins casting engine, Vampire Vitality, Afflictions, Mixed Heritage, Called Shots.
