# Player actions — Codex / Claude coordination

Branch: `codex/player-actions`, based on `main` at `66c6cf7`.

## Scope and ownership

Codex is implementing the first action-driven player-sheet slice: Now panel,
skill/attack previews, consumable use, ammo/reload receipts, and guarded Undo.
Claude's open PR #6 (`feat/character-creation-v147`) owns creator, heritage,
affliction rules, and associated styling. Do not replace its changes with this
branch's older rules or creator files.

Refreshed 2026-11-04: `main` remains at `66c6cf7`. PR #7 (`feat/the-week`)
also includes the heritage work plus a new shell, navigation, weekly activities,
and save consumers. Its sheet changes are still in the heritage/builder area.
Keep this action branch based on main until those changes are reviewed; do not
merge either Claude branch merely to obtain this slice.

Shared files: `apps/player.html` and `sw.js`. Player action additions are marked
`PLAYER ACTIONS` and use scoped `playerNow` / `playerAction` styles. Preserve
Claude's heritage/adaptation functions when combining branches. Reconcile the
service-worker cache identifier and asset lists at merge time. This branch does
not modify canon, rules JSON, creator, maps, or bridge message names.

Both Claude branches change `tools/smoke-test.mjs` and `sw.js`. Preserve the
`checkPlayerActions` and `checkPlayerOffline` imports/calls when reconciling tests.
The action test uses the existing `sheetBtn` and `frame` shell hooks; adapt those
hooks if PR #7 changes them. Preserve the complete combined offline asset list
and choose a fresh cache identifier after integration (this branch uses
`grakkgrith-v51-player-actions`, not a claimed successor to Claude's cache).

## Behavioral contract

- Preview dice, modifiers and costs before committing; cancel changes nothing.
- Attack spends one round only for a weapon with tracked capacity and the fire
  action enabled. Melee/no-capacity weapons do not spend ammo. Push does not fire
  a second shot. Existing explicit weapon profiles remain authoritative.
- Use and reload share the automation history regardless of entry point.
- Undo reverses only changed fields and refuses if those fields were edited
  later. Legacy broad-snapshot undo records are not applied automatically.
- Changed inventory slots also retain an after-action guard: replacing or editing
  that card blocks Undo even if its quantity happens to match.
- At full stress, Push asks the player to resolve further pressure with the GM
  instead of granting dice without paying its stress cost.
- Rolls remain in history after Undo; Undo does not grant a free reroll.
- Existing character save and import/export formats remain compatible; new
  undo records add field-change metadata inside existing automation history.

## Verification

Rules and map checks pass. The desktop/phone suite passed 107 checks on
2026-11-04, including cancellation, attack ammo, Push, reload transfer, no-refill
item deletion/restoration, manual edit protection, replacement-gear protection,
reopening persistence, skill previews, melee attacks, and 44px Now controls.
Five additional installed-service-worker checks pass: cached Now panel, 360px
preview bounds, initial Cancel focus, Escape dismissal, and an offline saved
skill roll. The offline harness was corrected to open Tools before selecting the
hidden sheet menu item; the targeted offline run then passed all five checks.

Screenshots are generated under `output/playwright/player-{now,attack}-{desktop,phone}.png`.
The phone attack preview and Now panel were visually inspected. Save fixtures use
disposable browser contexts, not a real player's localStorage.

`git merge-tree --write-tree HEAD origin/feat/the-week` reports only a `sw.js`
content conflict; player.html and smoke-test.mjs merge automatically. This was a
merge preview, not a modification or merge of either branch.

Merge integration with PRs #6/#7 has not been runtime-tested. Keep the PR draft
until the combined branch passes its complete smoke tests. No merge or deployment
is performed by this branch. This note is coordination documentation, not a
request to modify Claude's branch.
