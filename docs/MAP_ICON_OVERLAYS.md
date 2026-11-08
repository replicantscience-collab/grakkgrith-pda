# Map overlays and shared sheet symbols

Review branch: `codex/map-icon-overlays`, based on `codex/player-consolidation`.

## Data and art ownership

- Base maps remain images. Coordinates and category meanings come from existing
  `data/places.json` and the existing local pin editor, never inferred from art.
- `apps/icons.js` owns 24 original, font-free SVG symbols. `PDA_ICONS.svg(name)`
  returns decorative SVG; retain visible text or an accessible name on its control.
  Unknown names fall back to the landmark symbol.
- Explore uses the 12 existing place categories plus district symbols. Pins stay
  centred on saved coordinates and remain 32px at every zoom. Dense maps can
  overlap: the category filters and 44px-minimum place list provide an alternative.
- Layer/filter controls preserve current location, destination and selected pins.
  Dashed borders retain approximate-location meaning. Switching maps resets the
  category filter; editing disables the controls and exposes every saved pin.
- Sheet and Edit sheet reuse the same action symbols. Their engine operations,
  enabled/disabled states, text labels and save contracts are unchanged.
- Gallery: `art/pda-v1/icon-kit.html`. Item-card frames, recipe-specific icons and
  faction illustrations are not implemented by this slice.

## Integration and verification

Preserve the existing player and city checks when merging smoke-test imports.
`tools/map-icons-checks.mjs` checks anchoring, filtering, dossier navigation,
editing and unchanged coordinates on desktop and phone. Offline smoke also opens
Explore's symbols and place list after network access is disabled.
The independent Sheet Now test reloads the shell before seeding its character,
so pending messages from the preceding Edit sheet cannot replace its fixture.

`index.html` embeds the symbol source alongside the engine in the generated
Edit sheet document; preserve both replacements when merging shell changes.

Cache `grakkgrith-map-icons-20261107` precaches the small symbol script. Keep the
existing lazy map-image caching policy; no large image precache expansion.
Run `npm test` after integration. Local screenshots are in `output/playwright/`.

Verified locally 2026-11-07: rules/catalog validation and 273 deterministic checks
passed; the final browser run passed 295 checks, including offline symbols.
Phone/desktop map, key, action-bar and symbol-gallery screenshots were reviewed.
