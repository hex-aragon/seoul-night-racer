import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrossings, signalAt, signalSpeedLimit } from '../app/signals';
import { getCourse, ROUTES } from '../app/routes';
import { createMotion, stepTraffic, rng } from '../app/traffic';
import { readFileSync } from 'node:fs';
test('all courses have safe crossing sites outside bridge decks, work zones and finish', () => {
  for (const r of ROUTES) {
    const c = getCourse(r.id),
      stops = createCrossings(c);
    assert.ok(stops.length >= 1);
    for (const s of stops) {
      assert.ok(s.stop > 100 && s.z < c.length - 150);
      assert.ok(!(s.z > c.length * 0.3 - 100 && s.z < c.length * 0.49 + 80));
      if (r.id === 'hangang' || r.theme === 'river')
        assert.ok(!(s.z > c.length * 0.12 && s.z < c.length * 0.53));
    }
  }
});
test('walk lamps never conflict with traffic green and retain clearance intervals', () => {
  const c = { id: 0, z: 190, stop: 182, offset: 0 };
  assert.equal(signalAt(c, 17).phase, 'green');
  assert.equal(signalAt(c, 18).phase, 'amber');
  assert.equal(signalAt(c, 21).phase, 'red');
  assert.equal(signalAt(c, 32).phase, 'green');
  for (let t = 0; t < 64; t += 0.1) {
    const s = signalAt(c, t);
    if (s.walk) assert.equal(s.phase, 'red');
    assert.ok(s.remaining > 0);
  }
  assert.equal(signalAt(c, 21).walk, false);
  assert.equal(signalAt(c, 31).walk, false);
});
test('cars, motorcycles and long trucks stop before red then proceed on green', () => {
  for (const length of [2.2, 4.6, 10]) {
    const random = rng(12),
      v = createMotion(0, random);
    Object.assign(v, {
      z: 90,
      x: 0,
      length,
      merge: false,
      speed: 25,
      nextEvent: 100,
    });
    const c = { id: 0, z: 190, stop: 182, offset: 0 };
    for (let i = 0; i < 1200; i++)
      stepTraffic(v, 1 / 60, [v], { z: -100, x: 8, speed: 0 }, random, {
        scenario: 'free',
        start: 900,
        end: 1000,
        time: 25,
        crossings: [c],
      });
    assert.ok(v.z + length / 2 <= c.stop);
    assert.ok(v.actualSpeed! < 0.01);
    const stopped = v.z;
    stepTraffic(v, 0.1, [v], { z: -100, x: 8, speed: 0 }, random, {
      scenario: 'free',
      start: 900,
      end: 1000,
      time: 1,
      crossings: [c],
    });
    assert.ok(v.z > stopped);
  }
});
test('amber permits committed vehicles to clear; red never pulls a passed car backwards', () => {
  const c = { id: 0, z: 190, stop: 182, offset: 0 };
  assert.equal(signalSpeedLimit(170, 4.6, 20, [c], 19), Infinity);
  assert.ok(signalSpeedLimit(90, 4.6, 20, [c], 19) < Infinity);
  assert.equal(signalSpeedLimit(184, 4.6, 20, [c], 25), Infinity);
});
test('Blender street assets contain usable lenses and geometry within download budget', () => {
  for (const name of ['signal', 'shelter']) {
    const b = readFileSync(`public/models/street/${name}.glb`);
    assert.equal(b.toString('ascii', 0, 4), 'glTF');
    assert.ok(b.length < 500000);
    const j = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    assert.ok(j.meshes.length > 10);
    if (name === 'signal')
      for (const lamp of [
        'signal_red',
        'signal_amber',
        'signal_green',
        'walk_red',
        'walk_green',
      ])
        assert.ok(j.materials.some((m: any) => m.name === lamp));
  }
});
