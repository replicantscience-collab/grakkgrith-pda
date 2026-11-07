# PDA coordination — Codex and Claude

Updated 2026-11-07. This is the shared entry point for concurrent work.

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

Verification is in progress on the combined branch. Run `npm test` before
promoting it. Keep the browser tests for cross-screen Undo and the original
player-action checks alongside the city, map, character and offline tests.

The older [player-action handoff](docs/PLAYER_ACTIONS_HANDOFF.md) records the
initial slice and its historical checks. This page supersedes its branch-status
and integration-status statements. The existing art handoff remains relevant
for visual changes. `tools/build-engine.py` records the original extraction;
do not regenerate the engine from today's thin wrappers.
