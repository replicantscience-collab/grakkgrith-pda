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
| `data/places.json` | **The map.** Districts, places, pins, routes and travel times, tram hours, and the Adyta clock. Also feeds the City tab: each district's `atlas` (pin and note) and `dossier`. Edit a district here and both Explore and the City tab change. |
| `data/guides/races.json` | What Sideways Shops says about each race: blurbs, traits, lifespans, card art, tips. Game numbers come from `rules.json`. |
| `art/sideways-shops/` | Guide art. Race cards are cut from the Sideways Shops poster; replace a card's image to re-render it. |
| `fonts/` | Fonts bundled for offline use, with their licenses |
| `data/rulebook-reference.json` | Facts copied from the rulebook that `rules.json` is checked against |
| `tools/check-rules.mjs` | The rules and map data check (see below) |
| `tools/smoke-test.mjs` | Clicks through every screen in a real browser (see below) |
| `package.json` | Only for the tests; the site itself has no build step |
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

## Testing every screen

`tools/smoke-test.mjs` opens the PDA in a real browser at desktop and phone size and clicks through every screen: each tab has content, Explore's map loads and can plan a trip, Guides shows all 11 races, the City tab has its 28 pins and dossiers, Character Setup has every race, and the sheet loads a character. It fails on any script error or missing file. GitHub runs it on every push too.

To run it yourself (needs Node):

```
npm install
npx playwright install chromium
npm run smoke
```

**When the rulebook changes:** update `rulebook-reference.json` first. The check then lists exactly what `rules.json` still needs.

**Renaming something players may have saved** (a subclass, origin, or life): add the old name to an `aliases` list on the entry so existing characters keep working. See `LHL Courier` for an example.

## The living city

Every day in Adyta something changes, and everyone in the group sees the same thing. Explore's **Today** button lists each district's mood; a district's panel leads with today's mood and a scrawled line of Local Wisdom; a couple of shops, food spots, venues and markets per district put out a new sign; and one Sticker is pasted up somewhere in the city. The hint names the district. Find the place, travel there, and peel it: found stickers are saved in the character file (`world.stickers`), so **Backup** carries the collection.

There is no server. `apps/cityday.js` builds the day from the Adyta date alone, so every PDA builds the same day. Lines rotate so a district never repeats a mood or a wisdom line on back-to-back days. The words are in `data/cityday.json` (drafts until they go to Nib); stickers come from the sticker sheets in `art/pda-v1/imports/manifest.json`. `node tools/cityday-test.mjs` checks both.

## Landlords, Local Wisdom and businesses

- `data/landlords.json`: who owns every housing place, their type and temperament, and the rent tier (the ids in `week.json`). Explore shows the landlord and the rent on each housing place. The Housing Authority is the floor for anyone who loses their home.
- `data/notes.json`: Local Wisdom written on the city, shown as "Written here" on a place or district. Each note has an `author` and a `date` (never shown to players) so anything can be traced and taken out; `signed` is the in-world signature. Today only Eko and Nib write notes; agent NPCs will use `agent:<id>` and players `player:<name>`.
- `data/businesses.json`: player businesses and their rules (Books, Rep, Exposure, Commons protection, the loss ladder). A business shows on everyone's map once it's listed here.

**Renting.** Go to a housing place in Explore and tap **Rent here**: that place becomes your home, and Mail & bills sends rent to its landlord from next week. Missed rent climbs the landlord's ladder, one letter per unpaid week and never faster than one every five days (so coming back after a long break brings one letter, not an eviction): a reminder, a lease review, Bastion (flagged as a scene hook for the next session, with Public Advocacy's Eviction Interference job as the way to fight it), and finally losing the unit, which moves you to Housing Authority emergency accommodation with your items and debts. Family-run landlords and collectives stop at the review. Paying your landlord back resets the ladder. Picking a different housing tier in Mail means moving out.

All three are drafts until they go to Nib. `node tools/check-rules.mjs` checks every place, tier, author and date in them, and fails if a housing place has no landlord.

## Businesses

If your character is listed as an owner in `data/businesses.json`, **Mail & bills** shows **Your business**: Books (the business's own money, separate from yours), Rep, Exposure, and whether the Commons is protecting it. Each Adyta week brings sales (fewer when Rep is low) and upkeep. Some weeks bring a **back-room offer**: saying no costs nothing; saying yes pays the books, adds Exposure to the building and ends Commons protection until you **make it even** (Exposure back to zero, plus a favor from your own pocket). Exposure fades by one each quiet week.

Protection belongs to the building. It breaks if you take an offer, if the owner's Heat reaches 4, and never applies to corporate-funded places. Trouble climbs one step at a time, never faster than one step every five days: trouble, a notice, shuttered (the till freezes until you clear the books and reopen), and lost after four weeks shuttered or a Heat 6 crisis aimed at the building. **Close for the season** pauses everything while you're away. Logic: `apps/business.js`, tested by `node tools/business-test.mjs`. All numbers are drafts.

## The Explore map

Explore puts your character somewhere in Adyta. Tap a place for its details, then travel there: on foot, or by tram while the trams run (the last one leaves at 12:17 AM). Travel takes Adyta time, and your character is in transit until they arrive, even if you close the app.

**Your location is part of your character.** Where you are, any trip in progress, and your recent movements are saved in the character file (`world.presence`), so the sheet's **Backup** carries them to another device and a new character starts fresh at Static Square. Pin and travel-time edits are not part of a character; share those with **Download places.json**.

**The Adyta clock** runs at real speed with a fixed offset, set in `data/places.json` under `clock`: at `anchorReal` it was `anchorAdyta` in Adyta.

**Fixing pins.** Pins sit at the left edge of each map label. Dashed pins were placed by eye and may be slightly off. To fix any pin:
1. In Explore, tap **Edit pins**.
2. Drag pins where they belong, tap an empty spot to add a place, or tap a pin to rename or remove it.
3. Tap **Share pins**, then **Download places.json**, and replace `data/places.json` in the repo with it.

Changes stay in your browser until you do step 3.

**Re-rendered a map?** Replace the image in `maps/official/` (same file name), then fix the pins as above.

**Travel times** marked "estimate" aren't printed on any map. Edit `routes` in `places.json` (`walk` and `tram` are minutes) when the real numbers are known.

## Changing anything else

### Player-sheet actions

The sheet's **Now** panel offers skill rolls, equipped attacks, reloads, item use,
and Undo. Skill and attack previews show the dice pool and accept situational
modifiers. Attacks spend one round for weapons with tracked ammunition; Push
adds dice and stress without spending another round. Use previews the selected
card's recovery and remaining uses. Reload uses the selected matching ammo source.

Undo preserves unrelated edits and refuses to overwrite changed values or
replacement gear. Rolls remain in history. Old snapshot-only undo entries cannot
be safely reversed by the new controls. Back up a character before moving between
different development versions.

For concurrent Claude/Codex work, read
[`docs/PLAYER_ACTIONS_HANDOFF.md`](docs/PLAYER_ACTIONS_HANDOFF.md) for ownership,
shared files, integration notes, and verification evidence.

- **Bump the cache** whenever you change a file: edit `CACHE_NAME` in `sw.js` (`grakkgrith-v41` → `grakkgrith-v42`) so installed copies pick up the update.
- **Adding a file** that should work offline: add it to the `ASSETS` list in `sw.js`. Maps and other big images stay off that list; they are saved the first time someone opens them, so a first visit stays small (about 2 MB).
- **New map art:** save it as JPG (quality around 85), not PNG. A map PNG is 3 MB or more; the JPG looks the same at a fifth of the size.

## Moving characters from the old Seele version

Saved data does not carry over between web addresses. On the old version, open the Character Sheet and use **Export JSON**; on the new one, use **Import JSON**.

## History

Recovered on 2026-10-29 from the published Seele AI build (service worker v38). In that build the creator and sheet were embedded inside the shell as base64 text; they are now separate files. Seele's analytics beacon was removed.

## Known gaps against the First Edition v1.47 rulebook

- Not built yet: the Arcane Heart / Magical Veins casting engine, Vampire Vitality, Afflictions, Mixed Heritage, Called Shots.
