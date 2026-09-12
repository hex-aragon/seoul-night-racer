# Seoul / Drive — Korean road trips

Play: https://hex-aragon.github.io/seoul-night-racer/

A static Three.js driving game with a rotating vehicle showroom, original city-pop BGM, local progression and 24 featured Korean road trips. Deployed through GitHub Pages.

## Regional maps

The two-column, vertically scrolling destination picker includes Seoul (Bukak, Hangang, Jamsil, Seongsu), Incheon (Yeongjong, Songdo, Ganghwa), Gapyeong (Cheongpyeong, Homyeong, Bukhangang), Gangwon (Gyeongpo, Jeongdongjin, Yangyang, Daegwallyeong, Chuncheon), Busan (Dalmaji, Gwangalli, Songjeong) and Jeolla (Damyang, Suncheon, Yeosu, Byeonsan, Jeonju, Jindo).

These 24 routes use OpenStreetMap/OSRM road centerlines, converted to local metric coordinates and smoothed with centripetal splines. Their endpoints and horizontal scale are retained. **Elevation, lane counts, shoreline, terrain and buildings are artistic reconstruction, not surveyed data or 1:1 city replicas.** Each course uses two, four or six total lanes. Right-hand traffic and oncoming traffic occupy separate sides; same-direction vehicles indicate before merging. Two-lane roadworks take place on the shoulder instead of closing the only forward lane.

The old 133 fictional arcade courses remain in the full-course dropdown, for 157 courses in total. Each course is a bounded route, not a freely navigable city street network. These maps are not navigation aids.

Six original Blender assets—tiled-roof hanok, pavilion, café terrace, lighthouse, barn and seaside station—are loaded on demand and batched by material. Curving roads sit on a continuous height field to avoid wide-ribbon terrain folds. Trees use GPU instancing. Source `.blend` files and reproducible scripts are in `art/`.

Map source data and attribution: [public/maps/ATTRIBUTION.md](public/maps/ATTRIBUTION.md). Regional models: [public/models/regions/ATTRIBUTION.md](public/models/regions/ATTRIBUTION.md). Higgsfield installation was approved, but its connection has not completed; no Higgsfield assets are claimed.

## Driving and interface

The default is a peaceful drive, with forgiving collisions, gentle curve assistance and manual accelerator/brake input. Day and night remain selectable. Existing profiles migrate once to peaceful driving; subsequent explicit choices persist. The default camera follows the car from behind. Top buttons switch between chase and windshield cameras or open settings.

The bottom contains **only left/right steering, brake, accelerator and speed**. The car remains above the controls. No fog, backdrop blur, film grain or speed streaks. Traffic lights, crossing stop lines and signal HUD have been removed from every route. There is no driving grade, deduction or 80-point requirement: crossing the finish completes the route.

- WASD / arrows: accelerate, brake, steer. Touch supports simultaneous held arrows and pedals.
- C: switch camera. Escape/P: pause and settings. Enter: start/restart.
- Q/E: sequential gear shifts; AT temporarily holds a paddle override.
- Settings contain AT/MT, P/R/N/D, fuel/refuelling, audio, roadworks/congestion and saved records. Stop before reverse or P. Reverse is capped at 28 km/h. Fuel depletion cuts the engine; braking remains available.
- Optional cruise can be enabled in settings. Optional racing retains vehicle/guardrail/barrier collisions, time limits and obstacle challenges.

## Vehicles and audio

One vehicle appears at a time. Choose a brand, drag to orbit, choose paint and select a destination. Nine attributed detailed models: Ferrari 458 Italia, Porsche 911 Carrera 4S, Mercedes Maybach, Audi R8, BMW M4, Genesis Coupe Custom, Kia Stinger, Tesla Model S and Lincoln Continental Mark V. Toyota is removed. G80 and Lincoln MKZ replacements remain unavailable; existing models keep accurate names. Specifications are arcade tuning, not manufacturer claims.

Each source retains its license, including Porsche CC BY-SA and Tesla CC BY-NC. This free game is noncommercial. [Vehicle credits](public/models/ATTRIBUTION.md), [street/sky/asphalt credits](public/models/street/ATTRIBUTION.md).

`Han River Afterglow` is an original 104 BPM city-pop instrumental dedicated to CC0, generated without commercial recordings. Engine loops derive from attributed real recordings and react to RPM, throttle and gear shifts; they are not manufacturer-specific recordings. Tesla has a single-speed powertrain and synthesized electric sound. [Audio credits](public/AUDIO-CREDITS.md).

## Local saves

XP, levels, best times, stars, records, paint and preferences persist in browser `localStorage` under `seoul-midnight-run.profile.v1`. No login or game server is required. Completion rewards are recorded once. Storage is origin/browser-specific; clearing site data removes saves. Parking missions remain future work; P currently locks the car.

## Development

Node.js 22.13+:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
python3 scripts/check-public-files.py dist
```

`main` deploys via GitHub Actions after automated checks. Vite uses the repository base path. `?qa` exposes development-only controls, stripped from production.

Tests cover measured route endpoints and distance, finite continuous geometry, non-folding terrain, 2/4/6-lane traffic including work zones, model integrity, control physics, fuel, collision/completion and local records. Historical signal utilities and their isolated tests remain as unused source; live street scenes instantiate no crossings or lights.

Rebuild regional architecture in Blender with `blender --background --python art/build_regional.py`. Refresh road snapshots explicitly with `python3 scripts/fetch-korean-roads.py`; runtime play uses bundled data and never calls routing servers.
