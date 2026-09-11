import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessDriving,
  newAssessment,
  passedDriving,
  roadSpeedLimit,
} from '../app/driving-score';
import { getCourse } from '../app/routes';
const input = {
  dt: 0.1,
  time: 10,
  previousDistance: 0,
  distance: 1,
  x: 0,
  speed: 50,
  limit: 60,
  length: 4.6,
  indicator: 0 as const,
  indicatorAge: 0,
  crossings: [],
};
test('80 inclusive passes; 79 and invalid scores fail', () => {
  assert.equal(passedDriving(80), true);
  assert.equal(passedDriving(79), false);
  assert.equal(passedDriving(NaN), false);
});
test('speeding is periodic, bounded and cancels when slowing', () => {
  const a = newAssessment();
  for (let i = 0; i < 41; i++) assessDriving(a, { ...input, speed: 70 });
  assert.equal(a.score, 96);
  assessDriving(a, input);
  assert.equal(a.speedingSeconds, 0);
  for (let i = 0; i < 1000; i++) assessDriving(a, { ...input, speed: 120 });
  assert.equal(a.score, 0);
});
test('red crossing counts once, uses crossing time, ignores reversing and green', () => {
  const a = newAssessment(),
    c = { id: 0, z: 100, stop: 92, offset: 0 };
  const move = {
    ...input,
    time: 25,
    previousDistance: 88,
    distance: 92,
    crossings: [c],
  };
  assessDriving(a, move);
  assert.equal(a.score, 85);
  assessDriving(a, move);
  assert.equal(a.score, 85);
  assessDriving(a, { ...move, previousDistance: 93, distance: 88 });
  assert.equal(a.score, 85);
  const b = newAssessment();
  assessDriving(b, { ...move, time: 10 });
  assert.equal(b.score, 100);
  const d = newAssessment();
  assessDriving(d, { ...move, dt: 1, time: 21.1 });
  assert.equal(d.score, 100);
});
test('lane-change indication requires correct side and advance notice, with boundary hysteresis', () => {
  const a = newAssessment();
  assessDriving(a, { ...input, x: 2.1 });
  assert.equal(a.score, 100);
  assessDriving(a, { ...input, x: 2.5 });
  assert.equal(a.score, 95);
  assessDriving(a, { ...input, x: 2.2 });
  assert.equal(a.score, 95);
  const b = newAssessment();
  assessDriving(b, { ...input, x: 2.5, indicator: 1, indicatorAge: 1.1 });
  assert.equal(b.score, 100);
  assessDriving(b, { ...input, x: -2.5, indicator: 1, indicatorAge: 2 });
  assert.equal(b.score, 90);
});
test('game limits distinguish coast, mountain and work zones', () => {
  assert.equal(roadSpeedLimit(getCourse('east-coast'), 20), 80);
  assert.equal(roadSpeedLimit(getCourse('namsan'), 20), 50);
  const c = getCourse('seoul');
  assert.equal(roadSpeedLimit(c, c.length * 0.4, true), 40);
});
