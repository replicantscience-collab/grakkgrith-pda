# Map Update Pack

The Adyta PDA map update pack completes district coverage and adds detailed,
source-linked candidate artwork plus the Sewers Town redraw. Explore and the City
atlas select the new images from the shared catalog. Earlier artwork is retained.

## Contents

- Nineteen previously missing district maps and the Main Roads network overview,
  with twenty detailed version-two revisions.
- A continuous Sewers Town cutaway with 24 labeled sites, inhabited upper layers,
  and unconfirmed deeper passages.
- 200 annotations in the twenty-map pass and 190 candidate place pins. Main Roads
  stays schematic and does not create travel destinations.
- Broken Wing Forge added to Sewers Town with an established name and proposed
  placement. The 23 previous sewer pins are reprojected, with their IDs preserved.
- Source links, candidate disclosures, versioned JPGs, coordinate migration notes,
  and service-worker cache v81.

The resulting catalog contains 28 maps, coverage for all 29 district entries,
316 places, and 43 unchanged route records. Local names and placements developed
for this pack remain proposals; Crownless Row is explicitly provisional. Pins
marked approximate still need editorial acceptance. This pack does not establish
new canonical route timings or promote uncertain deep tunnels to surveyed routes.

## Review

- [Twenty-map preview](district-maps-v2-preview.jpg)
- [Sewers Town preview](../maps/candidates/sewers-town-v2.jpg)
- [Lore audit and sources](DISTRICT_LORE_REVIEW.md)
- [Sewers redraw and validation](SEWERS_MAP_REDRAW.md)
- [Sewer pin migration](sewers-map-pin-migration.json)
- [Shared map and place catalog](../data/places.json)

## Verification

The implementation at commit `72fff85` passed `npm test`, including 214
desktop/phone browser checks. Checks cover candidate image loading, catalog
dimensions, source disclosures, the 24 sewer pins, Radio Sewers' relay description,
and Gate 4's survey warning. All existing place IDs were retained across the Sewers
redraw, non-sewer records were preserved, and all 43 route records were unchanged.

This packaging change adds documentation only; it does not alter that tested
implementation. The pack is submitted in GitHub PR #20 for integration into `main`.
