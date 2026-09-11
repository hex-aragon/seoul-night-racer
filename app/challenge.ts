import { rng } from './traffic';
export type Hazard = {
  id: number;
  z: number;
  x: number;
  kind: 'cones' | 'barrier';
  hit: boolean;
  passed: boolean;
};
export function createHazards(length: number, seed: number): Hazard[] {
  const random = rng(seed),
    hazards: Hazard[] = [];
  for (let z = 320; z < length - 150; z += 260) {
    const lane = Math.floor(random() * 5);
    hazards.push({
      id: hazards.length,
      z,
      x: [-8, -4, 0, 4, 8][lane],
      kind: hazards.length % 3 === 0 ? 'cones' : 'barrier',
      hit: false,
      passed: false,
    });
  }
  return hazards;
}
export function sweptHazardHit(h: Hazard, from: number, to: number, x: number) {
  return (
    !h.hit &&
    Math.min(from, to) < h.z + 3 &&
    Math.max(from, to) > h.z - 3 &&
    Math.abs(x - h.x) < (h.kind === 'cones' ? 1.7 : 2.3)
  );
}
