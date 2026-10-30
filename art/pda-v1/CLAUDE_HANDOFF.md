# Claude implementation handoff — Sideways PDA art pass (v0.1)

## Goal
Make the functional GRAKKGRITH PDA look like the illustrated neon/punk/parchment concept art **without compromising gameplay, accessibility, rules integrity, or mobile usability**. The generated screens are *visual references*, not complete page screenshots to paste into the app.

## Read first
- `README.md` (root): data ownership and static PWA architecture.
- `index.html`: top-level nav + iframe app shell; inspect before modifying.
- `apps/guide.html`, `data/guides/races.json`: existing Sideways race cards.
- `data/rules.json`: official rules, do not change for visual work.
- `data/places.json`, `maps/official/`: canonical city data and maps; never infer gameplay coordinates from illustrated art.
- `sw.js`: cache version and selective offline caching policy.
- `art/pda-v1/preview.html`, `tokens.css`, `components.css`, `assets/`.

## First safe vertical slice
1. Capture before screenshots at desktop (1440×900) and mobile (390×844). Keep a baseline and do not alter saved localStorage characters.
2. Integrate `tokens.css` with component-level classes first. **Avoid globally overriding body/buttons** of embedded apps until each is reviewed.
3. Build an accessible brand/topbar/nav shell with the existing IDs and click events. No navigation rewrite.
4. Restyle the Start surface, then one Goblin guide page. Keep stats, links and canonical values live HTML drawn from existing JSON.
5. Test keyboard navigation, 44×44-ish tap targets, horizontal overflow at 360/390px, reduced motion and color contrast.
6. Run `npm run check`, `npm run smoke` (with Playwright installed), confirm all existing flows.
7. Update `sw.js` cache name and pre-cache *only the small shared assets* that should work offline; new large images stay lazy/on-demand. Test offline after second visit.
8. Submit before/after screenshots and a small PR before applying the style to City, Missions, Factions and Inventory.

## Architecture constraints
- Maintain postMessage `grakkgrith-*` bridge names between shell and iframe pages.
- Never change `data/rules.json` or `data/rulebook-reference.json` for a design-only pass.
- Never change character serialization, aliases, clock/travel math or authoritative map pins as visual collateral.
- Keep official canon distinct from Sideways' editorial commentary. No generated mockup numbers become rules.
- Use semantic HTML/CSS for headings, text, scores, buttons, accessible names, announcements, and navigation. Do not turn composite mockups into interactive image maps.
- Avoid user-facing “online” or live-world claims until backed by real API/state.

## Visual language
- Base: abyss ink `#0a0b16`, parchment `#ebd39e`, brass `#d7ac61`.
- Signature accents: magenta `#ef46ba`, cyan `#22dae4`, violet `#9c68f7`, goblin lime `#9af269`.
- Headings: Permanent Marker; UI labels: Saira Condensed; readable prose: Atkinson Hyperlegible (already licensed and bundled in repo).
- Cards: noisy dark or warm paper interiors with readable content and ornamental brass corners.
- Motion: subtle focus/hover glow only; respect `prefers-reduced-motion`.

## Items to connect later (not implemented by this pack)
- Sideways shop digital catalog: mana bracelet, HR Cube, focus staffs, floorboard oddlings.
- Decouple item art, metadata, rarity and canon status; use a stable item ID so Discord/real-world collectible references can match.
- Add a reviews/approval flag for canon and commercially licensable Adyta-specific art.

## Test baseline
The root README says `node tools/check-rules.mjs` and `npm run smoke` cover official rules and screen navigation. This art-only branch has **not** claimed to pass these tests; run them during the actual integration and report results.

## Definition of done
Visually matches the art direction on phone and desktop, renders real content from the source data, doesn't break any tab/iframe/saves, passes check/smoke, has clean focus and hit targets, and gives Nib a clearly reviewable before/after PR.

