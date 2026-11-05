# Adyta PDA — Claude Art Sprint 01

This ZIP is drop-in **art only**. Extract its `art/` tree into the repository root.

## Best first integrations
1. In `data/guides/races.json`, set `races.Fairy.card` to `art/pda-v1/imports/races/fairy.webp` (after visual/canon review).
2. Change Orc and Dwarf card paths to the two `*-lifespan-corrected.webp` files; preserve lifespan data in JSON.
3. Use `radio-sewers/*.webp` for Smokier, Mercury, DJ Sludge, and DJ Stormbird. These are **visual design proposals** — do not assert the designs are canon without Nib's approval. Smokier has archival sepia treatment.
4. Use `start/featured-artifacts-1600x900.webp` as a background/illustration behind HTML text; avoid embedding the image as a button.
5. `start/city-hero-DRAFT-upscaled.webp` is a **low-detail upscaled concept**, not final production hero. Use only for layout experiments.

## Important boundaries
- The repository's current `rules.json` and game logic remain authoritative. No changes to clocks, heat, saves, or prices from art images.
- Source: the existing user-supplied Sideways species poster provides the Orc/Dwarf faces; their '?' has been fixed programmatically. The Fairy and Radio designs are newly generated proposals.
- Color and typography are matched to the original art direction, but card compositions are not pixel-identical to the original poster.
- The Fairy text uses `Ageless` per the current `data/guides/races.json`. The promotional collage mockups contained incorrect fairy ages — **do not use them**.
- Please review small-size text legibility, phone contrast, and asset licensing/usage approval before merge.

## Packaging
All ship-ready WebP images live in `art/pda-v1/imports/` with a `manifest.json` listing paths/roles/statuses. `source/fairy-portrait-master.webp` is included as an edit-friendly reference only. No fonts are distributed.

No files were pushed to GitHub automatically; this is a reviewable handoff for Claude.
