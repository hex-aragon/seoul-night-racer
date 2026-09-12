import * as T from 'three';
import type { Course } from './routes';

/** A single height field avoids the folded polygons of wide ribbons on hairpins.
 * Elevation and shoreline are artistic reconstruction, not surveyed terrain. */
export function buildRegionalTerrain(course: Course) {
  const root = new T.Group();
  root.name = 'Continuous regional landscape';
  const spine = Array.from(
    { length: Math.ceil(course.length / 35) + 1 },
    (_, i) => course.sample(Math.min(course.length, i * 35)).position,
  );
  const bounds = new T.Box3().setFromPoints(spine).expandByScalar(650);
  const width = bounds.max.x - bounds.min.x,
    depth = bounds.max.z - bounds.min.z;
  const nx = Math.min(256, Math.max(48, Math.ceil(width / 22)));
  const nz = Math.min(256, Math.max(48, Math.ceil(depth / 22)));
  const geo = new T.PlaneGeometry(width, depth, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate(
    (bounds.max.x + bounds.min.x) / 2,
    0,
    (bounds.max.z + bounds.min.z) / 2,
  );
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const theme = course.config.theme;
  const waterfront = theme === 'coast' || theme === 'riverside';
  const low = new T.Color(theme === 'pasture' ? '#86a969' : '#708e62');
  const high = new T.Color(theme === 'forest' ? '#365d45' : '#4e7052');
  const sand = new T.Color('#d1c69f');
  const tint = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    let best = Infinity,
      roadY = 7,
      side = 0;
    for (let j = 1; j < spine.length; j++) {
      const a = spine[j - 1],
        b = spine[j];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        len2 = dx * dx + dz * dz;
      if (len2 < 0.01) continue;
      const t = T.MathUtils.clamp(
        ((x - a.x) * dx + (z - a.z) * dz) / len2,
        0,
        1,
      );
      const ox = x - a.x - dx * t,
        oz = z - a.z - dz * t;
      const d2 = ox * ox + oz * oz;
      if (d2 < best) {
        best = d2;
        roadY = T.MathUtils.lerp(a.y, b.y, t);
        side = (-dz * ox + dx * oz) / Math.sqrt(len2);
      }
    }
    const distance = Math.sqrt(best);
    const wave =
      0.5 +
      0.26 * Math.sin(x / 190 + z / 340) +
      0.24 * Math.cos(z / 170 - x / 280);
    const hills =
      T.MathUtils.smoothstep(distance, 55, 340) *
      wave *
      (theme === 'city' ? 5 : theme === 'pasture' ? 48 : 100);
    let y = roadY - 0.85 + hills;
    tint.copy(low).lerp(high, T.MathUtils.clamp(hills / 70, 0, 0.8));
    if (waterfront && side > 0) {
      const shore = T.MathUtils.smoothstep(distance, 24, 65);
      y = T.MathUtils.lerp(roadY - 0.85, -7, shore);
      tint.lerp(sand, T.MathUtils.smoothstep(distance, 18, 45));
    }
    pos.setY(i, y);
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geo.setAttribute('color', new T.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }),
  );
  land.receiveShadow = true;
  root.add(land);
  if (waterfront) {
    const water = new T.Mesh(
      new T.PlaneGeometry(width, depth),
      new T.MeshPhysicalMaterial({
        color: theme === 'coast' ? '#57a9b7' : '#588e92',
        roughness: 0.28,
        metalness: 0.25,
        clearcoat: 0.7,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(
      (bounds.min.x + bounds.max.x) / 2,
      2.2,
      (bounds.min.z + bounds.max.z) / 2,
    );
    root.add(water);
  }
  return root;
}
