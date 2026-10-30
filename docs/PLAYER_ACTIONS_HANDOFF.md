# Player actions — Codex / Claude coordination

Branch: `codex/player-actions`, based on `main` at `66c6cf7`.

## Scope and ownership

Codex is implementing the first action-driven player-sheet slice: Now panel,
skill/attack previews, consumable use, ammo/reload receipts, and guarded Undo.
Claude's open PR #6 (`feat/character-creation-v147`) owns creator, heritage,
affliction rules, and associated styling. Do not replace its changes with this
branch's older rules or creator files.

Shared files: `apps/player.html` and `sw.js`. Player action additions are marked
`PLAYER ACTIONS` and use scoped `playerNow` / `playerAction` styles. Preserve
Claude's heritage/adaptation functions when combining branches. Reconcile the
service-worker cache identifier and asset lists at merge time. This branch does
not modify canon, rules JSON, creator, maps, or bridge message names.

## Behavioral contract

- Preview dice, modifiers and costs before committing; cancel changes nothing.
- Attack spends one round only for a weapon with tracked capacity and the fire
  action enabled. Melee/no-capacity weapons do not spend ammo. Push does not fire
  a second shot. Existing explicit weapon profiles remain authoritative.
- Use and reload share the automation history regardless of entry point.
- Undo reverses only changed fields and refuses if those fields were edited
  later. Legacy broad-snapshot undo records are not applied automatically.
- Rolls remain in history after Undo; Undo does not grant a free reroll.
- Existing character save and import/export formats remain compatible; new
  undo records add field-change metadata inside existing automation history.

## Verification

Pending implementation and test results. No merge or deployment authorized by
this note. This is coordination documentation, not a request to modify Claude's
branch.
