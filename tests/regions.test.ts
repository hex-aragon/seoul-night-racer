import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { Course, ROUTES } from '../app/routes';
import roads from '../app/korean-roads.json';
import { buildRegionalTerrain } from '../app/regional-terrain';
import {
  createMotion,
  requestLaneChange,
  rng,
  stepTraffic,
} from '../app/traffic';

test('24 measured courses preserve endpoint geography and near-original distances', () => {
  for (const road of roads) {
    const course = new Course(ROUTES.find((r) => r.id === road.id)!);
    assert(Math.abs(course.length / road.distance - 1) < 0.05, road.id);
    const first = road.coordinates[0],
      last = road.coordinates.at(-1)!;
    const endpoint = course.sample(course.length).position;
    assert(
      Math.abs(
        endpoint.x -
          (last[0] - first[0]) * 111320 * Math.cos((first[1] * Math.PI) / 180),
      ) < 2,
    );
    assert(Math.abs(endpoint.z + (last[1] - first[1]) * 111320) < 2);
    for (let d = 0; d < course.length; d += 25) {
      const f = course.sample(d);
      assert(f.position.toArray().every(Number.isFinite));
      assert(Math.abs(f.tangent.length() - 1) < 0.001);
      assert(course.sample(d + 5).position.distanceTo(f.position) < 7, road.id);
    }
  }
});

test('two-, four- and six-lane traffic stays on its side through ordinary traffic and roadworks', () => {
  for (const lanes of [2, 4, 6])
    for (const scenario of ['free', 'works'] as const) {
      const course = new Course(ROUTES.find((r) => r.lanes === lanes)!);
      const random = rng(33),
        traffic = Array.from({ length: 16 }, (_, i) =>
          createMotion(i, random, 0, course.laneCenters),
        );
      const player = { x: course.playerStartX, z: -200, speed: 0 };
      const starts = traffic.map((c) => c.z);
      assert(
        !requestLaneChange(traffic[0], course.playerStartX, [], player, random),
      );
      for (let tick = 0; tick < 1200; tick++)
        for (const c of traffic) {
          stepTraffic(c, 0.025, traffic, player, random, {
            scenario,
            start: 450,
            end: 800,
            time: tick * 0.025,
          });
          assert(Math.sign(c.x) === c.direction);
          assert(Math.abs(c.x) + 1.3 < course.roadHalfWidth);
          assert(Number.isFinite(c.z));
        }
      traffic.forEach((c, i) =>
        assert(c.direction === -1 ? c.z < starts[i] : c.z >= starts[i]),
      );
    }
});

test('landscape height field has finite non-folded terrain on a winding lake course', () => {
  const root = buildRegionalTerrain(
    new Course(ROUTES.find((r) => r.id === 'gapyeong-cheongpyeong')!),
  );
  const land = root.children[0] as T.Mesh;
  const p = land.geometry.getAttribute('position'),
    idx = land.geometry.index!;
  assert(p.count <= 257 * 257);
  for (let i = 0; i < p.count; i++)
    assert([p.getX(i), p.getY(i), p.getZ(i)].every(Number.isFinite));
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i),
      b = idx.getX(i + 1),
      c = idx.getX(i + 2);
    const cross =
      (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) -
      (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a));
    assert(cross < 0); // Every triangle faces upward, with no folding at hairpins.
  }
  assert.equal(root.children.length, 2);
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      (o.material as T.Material).dispose();
    }
  });
});

test('all six authored Blender assets are valid compact GLBs with architecture materials', () => {
  let total = 0;
  for (const name of [
    'hanok',
    'pavilion',
    'cafe',
    'lighthouse',
    'barn',
    'station',
  ]) {
    const b = readFileSync(`public/models/regions/${name}.glb`);
    total += b.length;
    assert.equal(b.toString('ascii', 0, 4), 'glTF');
    assert.equal(b.readUInt32LE(4), 2);
    assert.equal(b.readUInt32LE(8), b.length);
    const doc = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    assert(doc.meshes.length > 3);
    assert(doc.materials.length >= 3);
  }
  assert(total < 1_500_000);
});
