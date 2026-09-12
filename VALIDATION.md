# Regional drive update validation — 2026-09-12

- `npm test`: 44 passing, including 24 geographic endpoints/distances, route continuity, 2/4/6-lane traffic under ordinary traffic and work zones, non-folded terrain and six valid Blender GLBs.
- `npm run typecheck`: passed.
- `npm run build`: passed. Existing Three.js bundle-size advisory remains (main JS about 301 KB gzip).
- `python3 scripts/check-public-files.py dist`: passed.
- Chrome desktop: showroom car clears the top navigation and lower selector; Gapyeong 2-lane lake, Songdo 6-lane city, Busan 4-lane coast load with regional scenery and no traffic signal state.
- Chrome 390×844 viewport: 24 cards in two columns, vertical scroll to Jeonju and launch; page width 390 with no horizontal overflow; car clears the four lower controls and speed display. Temporary viewport reset after testing.
- Jeonju peaceful drive advanced more than 1 km, staying in the forward lane. Cruise used for verification was turned off afterwards.
- Day/night selection and return to the garage verified through visible controls. Model/street loaders report ready. No application errors observed; console contains extension warnings and the pre-existing RGBELoader deprecation warning.

`npm run lint` is not clean: existing shared UI accessibility errors, vendored Draco lint errors, test Node-type configuration errors and pre-existing engine diagnostics remain. TypeScript's configured application check and deployment gates pass. This update does not claim a clean repository-wide lint run.

Geographic fidelity is limited to the road centerlines. Scenery, elevation, lane count and shoreline are reconstructed. Higgsfield installation was approved but the connection did not complete; regional assets were authored in the connected Blender instance.
