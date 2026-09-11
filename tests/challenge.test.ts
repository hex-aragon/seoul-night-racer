import test from 'node:test';
import assert from 'node:assert/strict';
import { createHazards, sweptHazardHit } from '../app/challenge';
test('obstacles leave escape lanes, reaction distance and a clear finish', () => {
  const h = createHazards(3200, 5);
  assert(h.length > 8);
  h.forEach((v, i) => {
    assert(Math.abs(v.x) <= 8);
    assert(v.z > 250 && v.z < 3050);
    if (i) assert(v.z - h[i - 1].z >= 250);
  });
  assert(sweptHazardHit(h[0], h[0].z - 8, h[0].z + 8, h[0].x));
  assert(!sweptHazardHit(h[0], h[0].z - 8, h[0].z + 8, h[0].x + 4));
});
