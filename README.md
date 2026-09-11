# Seoul / Midnight Run — Chapter 11

Play: https://hex-aragon.github.io/seoul-night-racer/

Three.js browser arcade racing with ten detailed attributed vehicle assets, original city-pop BGM and procedural Seoul-inspired courses. Courses reinterpret landmarks for a game; they are not reproductions of real roads.

## Courses

- **한강 브리지 런**: curved riverside approach, double-deck Banpo-inspired bridge, rainbow fountains, river skyline, 63 Square.
- **남산 와인딩**: continuous S bends, hills, trees, N Seoul Tower.
- **서울 랜드마크 투어**: city bends, Gwanghwamun, Cheonggyecheon, Lotte World Tower.

All 133 maps are available immediately: the three landmark routes, 120 deterministic Seoul district variations and ten scenic destinations. Slide the ten featured destinations along the bottom of the showroom, or select any route in the full-course dropdown. Each variant has distinct curves, elevation, length, skyline scale and palette; they are fictional arcade routes, not geographic road data. The minimap follows the selected course. Steering counters outward drift in curves; use the brake before fast corners.

## Controls

- WASD / arrow keys: accelerate, brake, steer
- Q / E or visible − / + paddles: shift down / up in AT or MT. AT holds a paddle selection for three seconds before automatic shifting resumes. Unsafe downshifts are rejected.
- Two visible camera buttons (or C): distant chase view / windshield view
- Space or the drift button: drift while steering above 60 km/h; braking while steering above 80 km/h also initiates a slide.
- P / Escape: pause
- Enter: start / restart
- Mouse / touch: hold the large left/right arrow buttons and accelerator / brake pedals simultaneously. The small wheel is a steering indicator. Scene drag gestures remain available.
- AT / MT: automatic or sequential manual 1–7 speed transmission
- P / R / N / D selector buttons on the instrument panel: parking lock, reverse, neutral, forward. Stop before changing direction or engaging P. Reverse is limited to 28 km/h and switches the camera to look behind. Braking stops the car without automatically engaging reverse.
- Runs start 20 m into the route, allowing a short reverse maneuver. Route boundaries limit travel; these are road courses, not an open-world parking simulator.
- Settings button in the garage / Escape while driving: adjust BGM and engine volume

In racing mode, a vehicle, guardrail or roadblock collision ends the run. Cones slow the car and break the combo. A time limit, three bonus-time checkpoints, obstacle-dodge rewards and drift XP create a time-attack challenge. Restart the same route or return to the garage to select another map.

## Local progression

XP, levels, best times, route stars, discovered landmarks, achievements, paint, transmission and audio settings are stored in `localStorage` under `seoul-midnight-run.profile.v1`. No account or server is needed. Storage is specific to this browser and origin; clearing site data removes it. If storage is unavailable, a visible warning explains that only the current session is retained.

Finished and crashed runs award earned XP once. Abandoning a run through the pause menu does not award XP. Driving grades of 98/90/80 award three/two/one stars on completion. A slower or crashed run never replaces a better record.

## Audio and models

`Han River Afterglow` is an original 104 BPM city-pop-inspired instrumental, synthesized from electric-piano chords, bass, drums and a lead motif. The BGM uses no commercial recordings or third-party samples. The score and generated audio are dedicated to CC0; see `public/AUDIO-CREDITS.md`. The music is prerendered in an OfflineAudioContext and played as a loop, avoiding main-thread scheduling dropouts.

Engine audio blends two real-recording-derived loops by qubodup (CC BY 3.0) and domasx2 (CC0), with RPM-dependent playback, throttle response and gear-change pitch drops. Filtered tire noise accompanies drifting. It is not an actual Ferrari recording; source links, attribution and processing details are in `public/AUDIO-CREDITS.md`. Audio starts after a user gesture and fades during pause/game-over.

All nine vehicle model credits: `public/models/ATTRIBUTION.md`. Higgsfield assets remain unintegrated because the plugin connection has not completed.

## Development and validation

Requires Node.js 22.13+.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Tests cover course continuity, curve forces, collision and finish outcomes, once-only rewards, corrupt-storage recovery, XP, stars and best records. Browser checks cover map switching, music-buffer output, crash/restart/finish, local persistence, and mobile controls. A development-only `?qa` URL exposes the engine for controlled test checkpoints; this hook is stripped from production.

`dist/` is a static site. GitHub Actions deploys `main` to GitHub Pages with the repository base path configured in `vite.config.ts`.

## Extension points

`app/drivetrain.ts` separates signed velocity, selector, gear and RPM from route progression. `VehicleSpec` contains combustion/electric powertrain, gear count, speed limits and regenerative deceleration parameters. Parking missions and free steering through parking lots remain future work; P currently locks the vehicle, not a parking minigame. The selectable Tesla Model S uses a single-speed electric powertrain, battery gauge, stronger coasting deceleration, a small regenerative charge return and synthesized electric motor sound. It does not expose manual gear paddles.

## Driver-focused interface

A compact bottom panel holds large steering arrows and a wheel indicator, accelerator, brake, speed, compass heading, forward/reverse gear, fuel gauge and AT/MT selection. Racing adds a small timer, dodge/combo counter and upcoming hazard/curve warning; peaceful mode keeps this ribbon hidden. The two top camera buttons select a distant chase view (12 m behind and 4.6 m high) or windshield view (the car exterior is hidden). The settings icon or Escape pauses driving and opens the settings modal; double-tapping scenery also opens it.

Daylight adjusts sky, fog, sun lighting and building glass textures; night restores illuminated scenery. Peaceful mode offers forgiving collisions and gentle curve assistance. Manual pedals are the default, including a one-time migration of the earlier auto-cruise default. Optional cruise and other settings persist locally. Racing is the new default (including a one-time migration), and peaceful driving remains selectable.

Fuel is a game-scaled percentage, not a real Ferrari consumption estimate. Idling, travel and acceleration consume fuel. Below 20%, the panel shows a low-fuel indicator and a refuel button. At zero, engine audio cuts out and the car coasts to a stop; braking continues to work. Refuelling is available only below 1 km/h and restores the tank. A new drive starts with full fuel. Fuel consumption and position freeze while paused.

Tests cover fuel consumption/depletion and default migration in addition to drivetrain, collisions and progression. Browser validation covers visible controls, both cameras, braking, refuelling, reverse, settings, 320px layout and simultaneous touch with cancellation.

## Scenic drives and live traffic

Ten featured fictional courses reinterpret Incheon Yeongjong, East Coast, Jeju Aewol, Han River riverside, Inje birch forest, Damyang tree avenue, Daegwallyeong ranch, Namhae, Seorak mountain forest and Busan Haeundae Dalmaji. The default catalog highlights these ten, with all 133 routes still available in the full catalog. They use distinct coast/water, river/park, woodland and pasture scenery. The ranch includes sheep, a barn and animated wind turbines. These are inspired game environments, not geographic road reproductions.

Every course has sixteen traffic vehicles including two motorcycles. The seven road-vehicle body classes are compact, sedan, SUV, pickup/light truck, box truck, dump truck and bus. Trucks have larger collision footprints, longer gap checks and lower cruising speeds. A new seeded traffic sequence is chosen for each drive. Vehicles signal at least 1.5 seconds before smoothly changing lanes, check the destination gap and wait when blocked. Shoulder entries align with gaps in the right barrier; one motorcycle approaches from behind and another merges. Following traffic slows behind occupied lanes and the player. Vehicles recycle well away from the immediate driving area.

Steering uses a responsive input curve, speed-sensitive gain, a bounded response rate and smooth centering of the wheel. Large holdable left/right arrows are the primary touch controls. Lateral momentum and stronger curve forces reward countersteering in racing mode. Seven gears permit acceleration to a game maximum of 320 km/h, with no separate 120 km/h cap. AT/MT and forward-neutral selection work during driving; reverse and parking require stopping. Releasing the wheel no longer pulls the vehicle toward the road center; peaceful assistance only nudges it away from the outer edge. The visible wheel interpolates between HUD updates.

## Vehicle garage and road conditions

One large 3D car is shown at a time. Switch brands using the top rail or previous/next arrows, drag the car to orbit through 360 degrees, choose a paint color, select a destination from the horizontal bottom rail, and start driving. Keyboard users can rotate the focused preview with arrow keys. Settings hold road conditions and audio controls.

Ferrari 458 Italia, Porsche 911 Carrera 4S, Mercedes Maybach, Audi R8, BMW M4, a customized Hyundai coupe, Kia Stinger, Tesla Model S and Lincoln Continental Mark V use attributed detailed models. The eight replacement GLBs load on demand; the detailed Stinger is about 5.9 MB. Each model keeps its original license; Porsche is CC BY-SA and Tesla is CC BY-NC. This free game is noncommercial. See `public/models/ATTRIBUTION.md` and `public/models/showroom/manifest.json`. Geometry, material, interior and wheel detail vary with the source asset. All driving specifications are arcade tuning, not manufacturer claims. Vehicle, paint and road condition persist locally.

Each route offers everyday traffic, roadworks or rush-hour congestion, with a recommended condition attached to featured destinations. Roadworks close the right lane with cones, warning boards, parked dump trucks, workers and excavators. Traffic signals and merges left or waits for a gap before the closure. Congestion creates a slow queue that stops and starts; extra time is added to timed challenges. Player controls and collision behavior remain active in both situations.

Incheon adds airport scenery, city buildings and a bridge; East Coast adds a coastal railway and rock formations; Busan adds beach umbrellas, towers and a bridge; Jeju adds stone walls and palms; Namhae adds tiled-roof houses; Seorak adds mountain rock formations. Existing birch forest, tree avenues, pasture sheep and wind turbines remain. Road geometry and scenery reinterpret the places for a game.

## Blender street kit and working crossings

The original Blender-made signal masts, sun visors, pedestrian signals, glass shelters, timber benches and branching trees replace bare street furniture and simple spherical trees. Source `.blend` files and the reproducible script are in `art/`. The three GLBs total roughly 525 KB; tree meshes use GPU instancing. Asphalt aggregate is authored in Blender. A CC0 Poly Haven HDRI supplies the daytime sky and outdoor reflections, with local sun shadows; the night palette and car showroom retain separate lighting. See `public/models/street/ATTRIBUTION.md`. Higgsfield installation was approved but its connection was not completed; no Higgsfield assets are claimed or bundled.

All 133 fictional routes have crossings, placed outside bridge decks, work zones, landmarks and the finish. White zebra stripes, stop lines, tactile pavers, bollards and gaps in guardrails mark the crossing. Vehicle signals run 18 seconds green, 3 amber, 11 red. Pedestrian lights have clearance intervals and never show walk alongside vehicle green. Cars, trucks and motorcycles brake before the line and accelerate on green. Vehicles already committed on amber clear the crossing. Player pedals remain under manual control; the compact signal indicator shows phase, distance and remaining seconds. The race countdown pauses while stopped within 22 m of a red/amber stop line; pause freezes the signal clock. Signal compliance is not a hard collision or automatic restart rule.

Browser verification uses the development-only `?qa` crossing preview button; it is stripped from production. Rebuild the original kit with `/Applications/Blender.app/Contents/MacOS/Blender --background --python art/build_street.py` on macOS (or your Blender executable on other platforms).

## Driving assessment

Every drive starts in the distant chase camera with 100 driving points. Reaching the finish with at least 80 passes; lower scores fail and do not earn completion stars or a best time. Grades and attempt records persist locally. Z/X or the amber arrow buttons toggle left/right indicators; activate at least one second before crossing a lane boundary. They cancel after the lane change. Unsignalled lane changes cost 5 points, crossing a red stop line costs 15 once per crossing, and continuous speeding costs 2 points per 2 seconds (4 when more than 20 km/h over). A 3 km/h tolerance avoids rounding penalties. Game speed limits are shown on road signs and the HUD: 80 on waterfront routes, 50 on mountain/forest routes, 60 in cities, 40 in works. These are fictional game rules. Time budgets allow compliant driving and signal waits.

Toyota is removed; previously saved Toyota selection falls back to Ferrari. Kia now uses the actual Stinger model. The Genesis slot retains the attributed Genesis Coupe Custom model; a G80 replacement and Lincoln MKZ replacement are pending authorized asset downloads. The Lincoln slot still accurately identifies its Continental Mark V model.
