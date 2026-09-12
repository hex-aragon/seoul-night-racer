import test from 'node:test';
import assert from 'node:assert/strict';
import { roadSpeedLimit } from '../app/road-rules';
import { getCourse } from '../app/routes';
test('game limits distinguish coast, mountain and work zones', () => {
  assert.equal(roadSpeedLimit(getCourse('east-coast'), 20), 80);
  assert.equal(roadSpeedLimit(getCourse('namsan'), 20), 50);
  const c = getCourse('seoul');
  assert.equal(roadSpeedLimit(c, c.length * 0.4, true), 40);
});
