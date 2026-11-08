# PDA coordination — Codex and Claude

Updated 2026-11-07. This is the shared entry point for concurrent work.

## Map and sheet icon follow-up

`codex/map-icon-overlays` is stacked on `codex/player-consolidation` (PR #25).
It owns the shared `apps/icons.js` kit, Explore category overlays/key, and
small action-symbol additions to both sheet Now bars. No rules, save format,
map images or authoritative coordinates change. Keep Claude's feature branches
separate; use [the overlay handoff](docs/MAP_ICON_OVERLAYS.md) when integrating.
The follow-up cache is `grakkgrith-map-icons-20261107` and includes `apps/icons.js`.

## Current review branch

`codex/player-consolidation` combines:

- Claude's `feat/shared-engine` at `6f6e699` (PR #13), including Codex PR #8.
- Current `main` at `112ad2e`, including character creation, The Week, the map
  expansion, and the merged city/business work.
- A follow-up consolidation of selected/equipped ammo and reload operations,
  and the duplicate Edit sheet action bars.

The merge is isolated to this review branch. No change to main, no deployment,
and no edits to Claude's source branches. PR #13 already contains #8; do not
apply #8 again. Night Out (#14) and Rentals (#24) remain separate feature work.

## Ownership and integration

- `apps/engine.js` owns roll calculations, ammo/reload validation and mutation,
  consumable effects, and guarded Undo. Both character screens call it.
- `apps/sheet.html` is the one-page play screen. `apps/player.html` is Edit sheet
  and the item-card editor. Do not restore parallel gameplay implementations.
- `reloadSlot` handles any selected weapon; `reloadEquipped` delegates to it.
  `spendAmmoSlot` serves attacks and manual ammo spending, including no-refill
  deletion. Screens record these mutations through the existing action history.
- Edit sheet has one Now bar. Identity and actions stay visible; the additional
  trackers/tools expand on demand. Existing tracker IDs remain for compatibility.
- `package.json` combines the engine and current-main checks. `npm test` calls
  `npm run check` then `npm run smoke`; add future deterministic suites to `check`.
- `sw.js` retains both branches' asset lists, including the engine and city
  scripts. Cache: `grakkgrith-consolidation-20261107`. Pick a fresh cache name on
  later integration; do not choose an entire side of the service-worker conflict.

## Verification and remaining work

Verified locally on 2026-11-07: `npm test` passed the rules/catalog validators,
273 deterministic checks (27 engine, 36 week, 49 make, 21 gigs, 19 radio,
17 jobs, 76 cityday, 28 business), and 276 browser checks. Browser coverage
includes desktop/phone, cross-screen Undo, the unified toolbar, character
creation, maps/city systems, and offline play. Phone and desktop Now-panel
screenshots were visually checked under `output/playwright/` (ignored artifacts).

Keep the browser tests for cross-screen Undo and the original player-action
checks alongside the city, map, character and offline tests. Re-run `npm test`
after integrating any later feature branch. GitHub CI status is reported on the
review PR; this note records local results, not a deployment or CI claim.

The older [player-action handoff](docs/PLAYER_ACTIONS_HANDOFF.md) records the
initial slice and its historical checks. This page supersedes its branch-status
and integration-status statements. The existing art handoff remains relevant
for visual changes. `tools/build-engine.py` records the original extraction;
do not regenerate the engine from today's thin wrappers.
