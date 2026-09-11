# Seoul / Midnight Run — Chapter 08

Play: https://hex-aragon.github.io/seoul-night-racer/

Three.js browser arcade racing with a detailed Ferrari 458 Italia, original city-pop BGM and procedural Seoul-inspired courses. Courses reinterpret landmarks for a game; they are not reproductions of real roads.

## Courses

- **한강 브리지 런**: curved riverside approach, double-deck Banpo-inspired bridge, rainbow fountains, river skyline, 63 Square.
- **남산 와인딩**: continuous S bends, hills, trees, N Seoul Tower.
- **서울 랜드마크 투어**: city bends, Gwanghwamun, Cheonggyecheon, Lotte World Tower.

All 131 maps are available immediately: the three landmark routes, 120 deterministic Seoul district variations and eight scenic destinations. Search by district, terrain or difficulty and browse six cards per page. Each variant has distinct curves, elevation, length, skyline scale and palette; they are fictional arcade routes, not geographic road data. The minimap follows the selected course. Steering counters outward drift in curves; use the brake before fast corners.

## Controls

- WASD / arrow keys: accelerate, brake, steer
- Q / E or visible − / + paddles: shift down / up in AT or MT. AT holds a paddle selection for three seconds before automatic shifting resumes. Unsafe downshifts are rejected.
- Two visible camera buttons (or C): distant chase view / windshield view
- Space or the drift button: drift while steering above 60 km/h; braking while steering above 80 km/h also initiates a slide.
- P / Escape: pause
- Enter: start / restart
- Mouse / touch: drag the visible steering wheel and hold the accelerator / brake pedals. Simultaneous touch is supported. Scene drag gestures remain available.
- AT / MT: automatic or sequential manual 1–7 speed transmission
- P / R / N / D selector buttons on the instrument panel: parking lock, reverse, neutral, forward. Stop before changing direction or engaging P. Reverse is limited to 28 km/h and switches the camera to look behind. Braking stops the car without automatically engaging reverse.
- Runs start 20 m into the route, allowing a short reverse maneuver. Route boundaries limit travel; these are road courses, not an open-world parking simulator.
- Settings button in the garage / Escape while driving: adjust BGM and engine volume

In racing mode, a vehicle, guardrail or roadblock collision ends the run. Cones slow the car and break the combo. A time limit, three bonus-time checkpoints, obstacle-dodge rewards and drift XP create a time-attack challenge. Restart the same route or return to the garage to select another map.

## Local progression

XP, levels, best times, route stars, discovered landmarks, achievements, paint, transmission and audio settings are stored in `localStorage` under `seoul-midnight-run.profile.v1`. No account or server is needed. Storage is specific to this browser and origin; clearing site data removes it. If storage is unavailable, a visible warning explains that only the current session is retained.

Finished and crashed runs award earned XP once. Abandoning a run through the pause menu does not award XP. Three-star target times are displayed in each race; slower finishes award one or two stars. A slower or crashed run never replaces a better record.

## Audio and models

`Han River Afterglow` is an original 104 BPM city-pop-inspired instrumental, synthesized from electric-piano chords, bass, drums and a lead motif. The BGM uses no commercial recordings or third-party samples. The score and generated audio are dedicated to CC0; see `public/AUDIO-CREDITS.md`. The music is prerendered in an OfflineAudioContext and played as a loop, avoiding main-thread scheduling dropouts.

Engine audio blends two real-recording-derived loops by qubodup (CC BY 3.0) and domasx2 (CC0), with RPM-dependent playback, throttle response and gear-change pitch drops. Filtered tire noise accompanies drifting. It is not an actual Ferrari recording; source links, attribution and processing details are in `public/AUDIO-CREDITS.md`. Audio starts after a user gesture and fades during pause/game-over.

Ferrari 458 Italia model credits: `public/models/ATTRIBUTION.md`. Higgsfield assets remain unintegrated because the plugin connection has not completed.

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

`app/drivetrain.ts` separates signed velocity, selector, gear and RPM from route progression. `VehicleSpec` contains combustion/electric powertrain, gear count, speed limits and regenerative deceleration parameters. Parking missions, free steering through parking lots and selectable EV/Tesla models are future work; P currently locks the vehicle, not a parking minigame. No Tesla or EV vehicle is presented as playable.

## Driver-focused interface

A compact bottom panel holds the wheel, accelerator, brake, speed, compass heading, forward/reverse gear, fuel gauge and AT/MT selection. Racing adds a small timer, dodge/combo counter and upcoming hazard/curve warning; peaceful mode keeps this ribbon hidden. The two top camera buttons select a distant chase view (12 m behind and 4.6 m high) or windshield view (the car exterior is hidden). The settings icon or Escape pauses driving and opens the settings modal; double-tapping scenery also opens it.

Daylight adjusts sky, fog, sun lighting and building glass textures; night restores illuminated scenery. Peaceful mode offers forgiving collisions and gentle curve assistance. Manual pedals are the default, including a one-time migration of the earlier auto-cruise default. Optional cruise and other settings persist locally. Racing is the new default (including a one-time migration), and peaceful driving remains selectable.

Fuel is a game-scaled percentage, not a real Ferrari consumption estimate. Idling, travel and acceleration consume fuel. Below 20%, the panel shows a low-fuel indicator and a refuel button. At zero, engine audio cuts out and the car coasts to a stop; braking continues to work. Refuelling is available only below 1 km/h and restores the tank. A new drive starts with full fuel. Fuel consumption and position freeze while paused.

Tests cover fuel consumption/depletion and default migration in addition to drivetrain, collisions and progression. Browser validation covers visible controls, both cameras, braking, refuelling, reverse, settings, 320px layout and simultaneous touch with cancellation.

## Scenic drives and live traffic

Eight new fictional courses reinterpret East Coast, Jeju Aewol, Namhae, Han River riverside, Inje birch forest, Damyang tree avenue, Daegwallyeong ranch and Seorak mountain forest. They use distinct coast/water, river/park, woodland and pasture scenery. The ranch includes sheep, a barn and animated wind turbines. These are inspired game environments, not geographic road reproductions.

Every course has six cars and two modeled motorcycles. A new seeded traffic sequence is chosen for each drive. Vehicles signal at least 1.5 seconds before smoothly changing lanes, check the destination gap and wait when blocked. Shoulder entries align with gaps in the right barrier; one motorcycle approaches from behind and another merges. Following traffic slows behind occupied lanes and the player. Vehicles recycle well away from the immediate driving area.

Steering uses a responsive input curve, speed-sensitive gain, a bounded response rate and smooth centering of the wheel. Shorter wheel drag travel and holdable left/right buttons support touch driving. Lateral momentum and stronger curve forces reward countersteering in racing mode. Seven gears permit acceleration to a game maximum of 320 km/h, with no separate 120 km/h cap. AT/MT and forward-neutral selection work during driving; reverse and parking require stopping. Releasing the wheel no longer pulls the vehicle toward the road center; peaceful assistance only nudges it away from the outer edge. The visible wheel interpolates between HUD updates.
