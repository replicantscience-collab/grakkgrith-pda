# Gremlins — Sideways Shops archive (proposed Adyta lore)

> **Classification:** unrecognized by corporate registries; actively hunted. **Public cover:** Goblin. This is a Sideways Shops cultural entry, **not** an official First Edition v1.47 rules race. Do not add Gremlin to `data/rules.json` without a separate rules/design agreement.

## What is established
- Ekois is the first Gremlin. The lineage arose through unusual Goblin–Fae mixing.
- Every Gremlin can inhabit liminal spaces to some extent. Individual limits and expressions vary.
- Most Gremlins have an entangled fae counterpart; forms and relationships are not identical.
- Ekois and Pulse choose cohabitation. Pulse's integrated third-eye manifestation shares Ekois's physical anchor; proximity helps both. The third eye is canon for Ekois, but not necessarily universal anatomy.
- Vex and the Eye are a contrasting pair: the Eye manifests externally and Vex's access to their abilities has been shaped by traumatic suppression. This does not make trauma a prerequisite for Gremlin abilities.
- **Blink:** a brief slip into liminal space, sometimes defensive or involuntary. A deep, uncontrolled Blink can leave a Gremlin stranded. **Runner traversal:** navigating routes between worlds remains a distinct specialty.
- **The Hollow:** a sanctuary/intersection where a stranded Gremlin might arrive via an established route; it is not an unrestricted travel power.

## Discovery and scope of this PR
- The public Sideways race wall retains its **11 rulebook races**.
- On the **Goblin** guide entry, press the small **G-07 classification seal three times**. Two checksum anomalies hint at something wrong; the third reveals an unofficial Gremlin archive.
- The archive explicitly distinguishes cultural lore from rulebook stats and keeps the **Make a character** action under the ordinary Goblin rules.
- The secret does not create a public registry option, and it does not label anyone else's character a Gremlin.
- No Gremlin data is written to localStorage, character backups, or the public character-sheet schema by this feature.

## Next phase: a truly private character identity
The broader vision is a Goblin-first creator unlock, a private Gremlin ancestry field, and an optional entangled-counterpart profile. **Do not store this in ordinary character JSON, browser localStorage, public notes, exports, or messages before implementing actual private storage and consent controls.** This PDA currently runs as a client-side offline PWA with no authentication or server; hiding a panel is not access control.

Proposed fields for a future private profile (with explicit owner consent): counterpart name/form, manifestation style (integrated/external/alternating/other), Blink limits, liminal affinity, personal awakening notes. Keep the corporate-facing `character.race` as `Goblin`; treat race mechanics separately from cultural identity. An archive browsing Easter egg must not alter a character record.

## Vex story hook (not binding Ve's characterization)
Vex's life-threatening awakening may cause an involuntary deep Blink into the Between. Inter-universe travel would depend on encountering existing routes, a Runner, or outside circumstances—not a universal Gremlin travel ability. The return could intersect an Eko/Pulse route leading to the Hollow, where they meet naturally. Ve retains control over Vex's story and final powers.

## Manual QA
1. Open **Guides**: 11 public race cards; no Gremlin card.
2. Open **Goblin**: the official stats remain present and unchanged.
3. Tap **G-07 ◈** three times: checksum text appears first; then Gremlin lore appears with "Oh. There you are."
4. Open a different race and return: the archive is hidden again, with no saved secret state.
5. Complete Character Setup as Goblin and open the Character Sheet: race remains Goblin; no secret ancestry leaks.
6. Repeat at phone width and with keyboard-only button activation; confirm no missing cached files.
