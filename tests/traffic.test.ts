import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rng,
  createMotion,
  requestLaneChange,
  stepTraffic,
  smoothSteering,
} from '../app/traffic';
import { getCourse } from '../app/routes';
test('steering is continuous, frame-rate independent and gentler at speed', () => {
  let a = 0,
    b = 0;
  for (let i = 0; i < 120; i++) a = smoothSteering(a, 1, 80, 1 / 120);
  for (let i = 0; i < 30; i++) b = smoothSteering(b, 1, 80, 1 / 30);
  assert(Math.abs(a - b) < 0.02);
  assert(smoothSteering(0, 1, 240, 0.1) < smoothSteering(0, 1, 20, 0.1));
  assert(Math.abs(smoothSteering(1, -1, 80, 0.025) - 1) <= 0.125 + 0.0001);
});
test('traffic signals first then crosses continuously, refusing occupied lanes', () => {
  const random = rng(3),
    car = createMotion(0, random);
  car.x = 0;
  car.z = 100;
  car.targetX = 0;
  const player = { z: 0, x: 0, speed: 20 };
  assert(requestLaneChange(car, 4, [], player, random));
  for (let i = 0; i < 50; i++) stepTraffic(car, 0.025, [], player, random);
  assert.equal(car.x, 0);
  assert.equal(car.signal, 1);
  let before = car.x;
  for (let i = 0; i < 210; i++) {
    stepTraffic(car, 0.025, [], player, random);
    assert(Math.abs(car.x - before) < 0.06);
    before = car.x;
  }
  assert.equal(car.x, 4);
  assert.equal(car.signal, 0);
  const other = { ...createMotion(2, random), x: 0, targetX: 0, z: car.z + 5 };
  assert.equal(requestLaneChange(car, 0, [other], player, random), false);
});
test('seeded traffic varies per drive and includes bikes and shoulder merges', () => {
  const a = Array.from({ length: 8 }, (_, i) => createMotion(i, rng(i + 5)));
  const b = Array.from({ length: 8 }, (_, i) => createMotion(i, rng(i + 6)));
  assert.notDeepEqual(a, b);
  assert(a.some((v) => v.kind === 'motorcycle' && v.z < 0));
  assert(a.some((v) => v.merge && v.x > 11));
  const random = rng(7),
    v = createMotion(1, random);
  const player = { z: 0, x: 0, speed: 15 };
  v.nextEvent = 0;
  for (let i = 0; i < 250; i++) stepTraffic(v, 0.025, [v], player, random);
  assert.equal(v.merge, false);
  assert.equal(v.x, 8);
  assert(v.speed > 0);
});
test('scenic destinations have distinct scenery themes and real elevation changes', () => {
  assert.equal(getCourse('east-coast').config.theme, 'coast');
  assert.equal(getCourse('hangang-riverside').config.theme, 'riverside');
  assert.equal(getCourse('inje-forest').config.theme, 'forest');
  const c = getCourse('daegwallyeong');
  assert.equal(c.config.theme, 'pasture');
  assert(c.sample(c.length / 2).position.y > 30);
});

test('motorcycle waits behind a stopped player and a second bike merges from the shoulder', () => {
  const random = rng(19),
    bike = createMotion(3, random);
  bike.x = 0;
  bike.targetX = 0;
  bike.z = -20;
  bike.nextEvent = 100;
  for (let i = 0; i < 100; i++)
    stepTraffic(bike, 0.025, [bike], { z: 0, x: 0, speed: 0 }, random);
  assert.equal(bike.z, -20);
  assert.equal(bike.actualSpeed, 0);
  assert(createMotion(7, random).merge);
});
