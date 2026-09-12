import { prepareStaticGeometry } from '../app/track-world';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { VEHICLES, getVehicle } from '../app/vehicles';
import { buildVehicle, TRAFFIC_BODIES } from '../app/vehicle-model';
import { newDrive, stepDrive, shiftDrive } from '../app/drivetrain';
import { blankProfile, parseProfile } from '../app/progress';
import { ROUTES } from '../app/routes';
import {
  createMotion,
  rng,
  stepTraffic,
  requestLaneChange,
} from '../app/traffic';
test('nine selectable brands produce distinct geometry and persistent custom paint', () => {
  assert.equal(VEHICLES.length, 9);
  assert.equal(new Set(VEHICLES.map((v) => v.brand)).size, 9);
  for (const v of VEHICLES) {
    const m = buildVehicle(v, new T.MeshStandardMaterial());
    const bounds = new T.Box3().setFromObject(m);
    const size = bounds.getSize(new T.Vector3());
    assert(size.z >= v.length * 0.97);
    assert(size.y >= v.height * 0.95);
    assert.equal(m.userData.wheels.length, 4);
  }
  const p = blankProfile();
  p.settings.vehicle = 'lincoln';
  p.settings.color = '#a1b2c3';
  p.settings.traffic = 'busy';
  assert.deepEqual(parseProfile(JSON.stringify(p)).settings, p.settings);
  assert.equal(getVehicle('invalid').id, 'ferrari');
});
test('EV remains single speed, rejects paddle shifting and regenerates stronger deceleration', () => {
  const ev = getVehicle('tesla').spec,
    d = newDrive();
  d.transmission = 'manual';
  for (let i = 0; i < 1000; i++) stepDrive(d, true, false, 0.025, ev);
  assert.equal(d.gear, 1);
  assert.equal(d.transmission, 'auto');
  assert.equal(d.rpm, 0);
  assert.equal(d.velocity, ev.maxSpeed);
  assert.equal(shiftDrive(d, 1, ev), false);
  const other = { ...d };
  stepDrive(d, false, false, 1, ev);
  stepDrive(other, false, false, 1);
  assert(d.velocity < other.velocity);
});
test('24 featured destinations cover Korean regions with varied road widths', () => {
  const routes = ROUTES.filter((r) => r.featured);
  assert.equal(routes.length, 24);
  for (const id of [
    'incheon-songdo',
    'gangwon-jeongdongjin',
    'busan-dalmaji',
    'jeolla-damyang',
    'gapyeong-cheongpyeong',
    'seoul-bukak',
  ])
    assert(routes.some((r) => r.id === id));
  assert.equal(new Set(routes.map((r) => r.lanes)).size, 3);
});
test('traffic includes dump trucks, compact cars, cargo trucks and buses with full wheelsets', () => {
  const motions = Array.from({ length: 16 }, (_, i) =>
    createMotion(i, rng(i + 1)),
  );
  const styles = new Set(
    motions
      .filter((v) => v.kind === 'car')
      .map((v) => TRAFFIC_BODIES[v.body!].style),
  );
  for (const s of ['dump', 'compact', 'pickup', 'boxtruck', 'bus'])
    assert(styles.has(s as any));
  for (const body of TRAFFIC_BODIES) {
    const mesh = buildVehicle(
      { id: 'test', ...body },
      new T.MeshStandardMaterial(),
    );
    assert(mesh.userData.wheels.length >= 4);
  }
});
test('congestion stops then releases a queue and work-zone traffic merges or waits before closure', () => {
  const random = rng(9),
    car = {
      ...createMotion(0, random),
      x: 0,
      z: 500,
      nextEvent: 999,
      speed: 20,
      merge: false,
    };
  const player = { z: 0, x: 0, speed: 0 };
  stepTraffic(car, 0.025, [car], player, random, {
    scenario: 'busy',
    start: 450,
    end: 800,
    time: 1,
  });
  assert.equal(car.actualSpeed, 0);
  stepTraffic(car, 0.025, [car], player, random, {
    scenario: 'busy',
    start: 450,
    end: 800,
    time: 11,
  });
  assert.ok(car.actualSpeed! > 0 && car.actualSpeed! < 1);
  for (let i = 0; i < 100; i++)
    stepTraffic(car, 0.025, [car], player, random, {
      scenario: 'busy',
      start: 450,
      end: 800,
      time: 11,
    });
  assert.equal(car.actualSpeed, 5);
  const truck = {
    ...createMotion(2, random),
    x: 8,
    targetX: 8,
    z: 439,
    speed: 16,
    merge: false,
    nextEvent: 999,
    length: 7.6,
  };
  const blocked = { ...createMotion(0, random), x: 4, targetX: 4, z: 440 };
  stepTraffic(truck, 0.025, [truck, blocked], player, random, {
    scenario: 'works',
    start: 450,
    end: 800,
    time: 1,
  });
  assert.equal(truck.actualSpeed, 0);
  assert(requestLaneChange(truck, 4, [truck], player, random));
  for (let i = 0; i < 230; i++)
    stepTraffic(truck, 0.025, [truck], player, random, {
      scenario: 'works',
      start: 450,
      end: 800,
      time: 2,
    });
  assert.equal(truck.x, 4);
  assert(truck.z > 439);
});

test('mixed procedural truck and primitive worksite geometry batches without attribute errors', () => {
  const mesh = buildVehicle(
    { id: 'dump', ...TRAFFIC_BODIES[5] },
    new T.MeshStandardMaterial(),
  );
  mesh.updateMatrixWorld(true);
  const geometries: T.BufferGeometry[] = [];
  mesh.traverse((o) => {
    if (o instanceof T.Mesh) geometries.push(prepareStaticGeometry(o));
  });
  const merged = mergeGeometries(geometries);
  assert(merged);
  assert(merged.getAttribute('position').count > 100);
  geometries.forEach((g) => g.dispose());
  merged.dispose();
});
