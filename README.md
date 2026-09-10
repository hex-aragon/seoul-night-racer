# Seoul / Midnight Run

서울 야경을 배경으로 달리는 브라우저 아케이드 레이싱 게임.

Play: https://hex-aragon.github.io/seoul-night-racer/

## Controls

- WASD / arrow keys: accelerate, brake, steer
- Space: boost
- P / Escape: pause
- C: chase / hood camera
- Paint swatches: choose Ferrari paint before starting
- Enter: start / restart
- Mobile: touch controls

## Development

Requires Node.js 22.13+.

```sh
npm ci
npm run dev
```

`npm run typecheck` validates TypeScript. `npm run build` produces a static site in `dist/`. GitHub Actions publishes `main` to GitHub Pages. `vite.config.ts` sets the repository base path.

The game uses Three.js WebGL, a detailed Ferrari 458 Italia model, a procedural 3D Seoul-inspired city, reflective materials, bloom, a chase/hood camera, and distance-based traffic detail. See `public/models/ATTRIBUTION.md` for model credits. Higgsfield-generated assets have not been integrated because the plugin connection was not completed.
