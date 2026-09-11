import * as T from 'three';
import type { BodyStyle, Vehicle } from './vehicles';
/** Shared original low-poly construction, no downloaded third-party car assets. Forward is -Z. */
export function buildVehicle(
  v: Pick<Vehicle, 'id' | 'style' | 'length' | 'width' | 'height'>,
  paint: T.Material,
) {
  const root = new T.Group();
  root.name = v.id;
  const wheels: T.Object3D[] = [];
  const mat = (color: string, metalness = 0, emissive = false) =>
    new T.MeshStandardMaterial({
      color,
      metalness,
      roughness: metalness ? 0.3 : 0.7,
      ...(emissive ? { emissive: color, emissiveIntensity: 1.4 } : {}),
    });
  const black = mat('#151d23'),
    glass = mat('#253b48', 0.25),
    chrome = mat('#bacbd1', 0.8),
    light = mat('#e7f5ff', 0, true),
    red = mat('#fa3443', 0, true);
  const box = (s: number[], p: number[], m: T.Material) => {
    const o = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), m);
    o.position.set(p[0], p[1], p[2]);
    root.add(o);
    return o;
  };
  const { width: w, length: l, height: h } = v;
  const truck = ['pickup', 'boxtruck', 'dump', 'bus'].includes(v.style),
    suv = v.style === 'suv';
  const bodyY = truck ? 0.95 : suv ? 1.02 : 0.62,
    r = truck ? 0.48 : suv ? 0.42 : 0.34;
  // Chamfered silhouette: multiple cross-sections form hood, shoulders and tapered nose.
  const shell = (sections: number[][], m: T.Material) => {
    const pos: number[] = [];
    for (const [z, half, bottom, top] of sections)
      pos.push(
        -half,
        bottom,
        z,
        half,
        bottom,
        z,
        half,
        top - 0.09,
        z,
        half * 0.83,
        top,
        z,
        -half * 0.83,
        top,
        z,
        -half,
        top - 0.09,
        z,
      );
    const indices: number[] = [];
    for (let i = 0; i < sections.length - 1; i++)
      for (let j = 0; j < 6; j++) {
        const a = i * 6 + j,
          b = i * 6 + ((j + 1) % 6);
        indices.push(a, b, b + 6, a, b + 6, a + 6);
      }
    for (const end of [0, sections.length - 1])
      for (let j = 1; j < 5; j++)
        indices.push(
          end * 6,
          end * 6 + (end === 0 ? j + 1 : j),
          end * 6 + (end === 0 ? j : j + 1),
        );
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(indices);
    const flat = g.toNonIndexed();
    g.dispose();
    flat.computeVertexNormals();
    const o = new T.Mesh(flat, m);
    root.add(o);
    return o;
  };
  shell(
    [
      [-l / 2, w * 0.39, r * 0.72, bodyY + 0.05],
      [-l * 0.35, w * 0.5, r * 0.65, bodyY + 0.23],
      [l * 0.31, w * 0.5, r * 0.65, bodyY + 0.26],
      [l / 2, w * 0.44, r * 0.72, bodyY + 0.13],
    ],
    paint,
  );
  if (!truck) {
    const front = suv
      ? -0.36
      : v.id === 'mercedes'
        ? -0.08
        : v.style === 'sport'
          ? -0.17
          : -0.24;
    const roofFront = suv ? -0.22 : -0.08,
      roofBack = suv ? 0.35 : 0.19;
    shell(
      [
        [l * front, w * 0.37, bodyY + 0.15, bodyY + 0.2],
        [l * roofFront, w * 0.38, bodyY + 0.15, h],
        [l * roofBack, w * 0.36, bodyY + 0.15, h],
        [l * (suv ? 0.46 : 0.34), w * 0.4, bodyY + 0.15, bodyY + 0.3],
      ],
      glass,
    );
    box(
      [w * 0.6, 0.055, l * (roofBack - roofFront)],
      [0, h + 0.01, (l * (roofFront + roofBack)) / 2],
      paint,
    );
    for (const side of [-1, 1]) {
      box(
        [0.045, h - bodyY - 0.17, 0.075],
        [side * w * 0.375, (h + bodyY) / 2 + 0.07, l * 0.08],
        black,
      );
      box([0.25, 0.14, 0.28], [side * w * 0.54, bodyY + 0.4, -l * 0.12], paint);
      box(
        [0.18, 0.035, 0.035],
        [side * w * 0.51, bodyY + 0.07, l * 0.08],
        chrome,
      );
      box(
        [0.09, 0.12, l * 0.7],
        [side * w * 0.48, r * 0.7, 0],
        v.id === 'hyundai' ? red : black,
      );
    }
  } else {
    const cabZ = -l * 0.28,
      cabL = l * 0.29;
    box([w * 0.92, h * 0.47, cabL], [0, bodyY + h * 0.23, cabZ], paint);
    box(
      [w * 0.8, h * 0.22, 0.045],
      [0, bodyY + h * 0.32, cabZ - cabL / 2 - 0.025],
      glass,
    );
    for (const side of [-1, 1])
      box(
        [0.04, h * 0.22, cabL * 0.62],
        [side * w * 0.465, bodyY + h * 0.32, cabZ],
        glass,
      );
    if (v.style === 'boxtruck') {
      box(
        [w * 0.95, h * 0.73, l * 0.6],
        [0, bodyY + h * 0.36, l * 0.17],
        mat('#dbe1dc'),
      );
      for (let z = -l * 0.1; z < l * 0.46; z += 0.35)
        box([w * 0.97, h * 0.71, 0.025], [0, bodyY + h * 0.36, z], chrome);
      box([0.045, h * 0.68, 0.06], [0, bodyY + h * 0.35, l * 0.474], black);
    }
    if (v.style === 'dump' || v.style === 'pickup') {
      const bed = mat(v.style === 'dump' ? '#d2a443' : '#6a909e', 0.4),
        bh = v.style === 'dump' ? 1.05 : 0.45;
      box([w * 0.93, 0.18, l * 0.57], [0, bodyY + 0.05, l * 0.18], bed);
      for (const side of [-1, 1]) {
        box(
          [0.13, bh, l * 0.59],
          [side * w * 0.46, bodyY + bh / 2, l * 0.18],
          bed,
        );
        for (let z = -l * 0.08; z < l * 0.46; z += 0.55)
          box(
            [0.16, bh + 0.05, 0.09],
            [side * w * 0.47, bodyY + bh / 2, z],
            chrome,
          );
      }
      box([w * 0.94, bh, 0.15], [0, bodyY + bh / 2, l * 0.47], bed);
      if (v.style === 'dump') {
        for (let i = 0; i < 9; i++) {
          const rock = new T.Mesh(
            new T.DodecahedronGeometry(0.38 + (i % 3) * 0.08),
            mat('#6f746e'),
          );
          rock.position.set(
            ((i % 3) - 1) * 0.55,
            bodyY + 0.5,
            Math.floor(i / 3) * 0.7,
          );
          root.add(rock);
        }
      }
    }
    if (v.style === 'bus') {
      box([w * 0.95, h * 0.73, l * 0.94], [0, bodyY + h * 0.3, 0], paint);
      for (const side of [-1, 1])
        for (let z = -l * 0.35; z < l * 0.4; z += 0.85)
          box(
            [0.03, h * 0.26, 0.68],
            [side * w * 0.48, bodyY + h * 0.44, z],
            glass,
          );
      box([w * 0.82, h * 0.27, 0.03], [0, bodyY + h * 0.43, -l * 0.48], glass);
      box([w * 0.96, 0.14, l * 0.9], [0, bodyY + 0.18, 0], chrome);
    }
  }
  for (const side of [-1, 1])
    for (const z of truck && v.style !== 'pickup'
      ? [-l * 0.32, l * 0.2, l * 0.34]
      : [-l * 0.31, l * 0.31]) {
      const wheel = new T.Group();
      wheel.position.set(side * (w * 0.48), r, z);
      const tire = new T.Mesh(new T.CylinderGeometry(r, r, 0.23, 20), black);
      tire.rotation.z = Math.PI / 2;
      wheel.add(tire);
      const rim = new T.Mesh(
        new T.CylinderGeometry(r * 0.65, r * 0.65, 0.25, 16),
        chrome,
      );
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
      for (let a = 0; a < 5; a++) {
        const spoke = new T.Mesh(new T.BoxGeometry(0.27, r * 1.2, 0.04), black);
        spoke.rotation.x = (a * Math.PI) / 5;
        wheel.add(spoke);
      }
      root.add(wheel);
      wheels.push(wheel);
    }
  const grill = box(
    [w * 0.68, 0.25, 0.035],
    [0, bodyY - 0.02, -l * 0.5 - 0.015],
    black,
  );
  if (v.id === 'bmw') {
    grill.scale.x = 0.75;
    box([0.08, 0.27, 0.06], [0, bodyY, -l * 0.51], chrome);
  }
  if (['mercedes', 'lincoln'].includes(v.id))
    for (let x = -w * 0.27; x < w * 0.3; x += 0.12)
      box([0.035, 0.24, 0.05], [x, bodyY, -l * 0.51], chrome);
  if (v.id === 'tesla') grill.visible = false;
  for (const side of [-1, 1]) {
    if (v.id === 'porsche') {
      const lamp = new T.Mesh(new T.SphereGeometry(0.2, 16, 10), light);
      lamp.scale.z = 0.4;
      lamp.position.set(side * w * 0.35, bodyY + 0.13, -l * 0.47);
      root.add(lamp);
    } else
      box(
        [w * 0.23, 0.095, 0.065],
        [side * w * 0.34, bodyY + 0.14, -l * 0.505],
        light,
      );
    box(
      [w * 0.27, 0.08, 0.065],
      [side * w * 0.32, bodyY + 0.1, l * 0.505],
      red,
    );
  }
  box([0.48, 0.13, 0.04], [0, bodyY - 0.15, l * 0.508], chrome);
  if (['porsche', 'toyota', 'hyundai'].includes(v.id)) {
    for (const side of [-1, 1])
      box([0.05, 0.2, 0.08], [side * w * 0.3, bodyY + 0.35, l * 0.36], black);
    box(
      [w * 0.92, 0.07, 0.27],
      [0, bodyY + 0.46, l * 0.36],
      v.id === 'hyundai' ? black : paint,
    );
  }
  root.userData.brakeMaterial = red;
  root.userData.wheels = wheels;
  root.userData.style = v.style;
  return root;
}
export const TRAFFIC_BODIES: {
  style: BodyStyle;
  length: number;
  width: number;
  height: number;
  color: string;
}[] = [
  {
    style: 'compact',
    length: 3.65,
    width: 1.65,
    height: 1.45,
    color: '#e5d67c',
  },
  { style: 'sedan', length: 4.65, width: 1.85, height: 1.45, color: '#eef0e6' },
  { style: 'suv', length: 4.95, width: 2, height: 1.85, color: '#355967' },
  { style: 'pickup', length: 5.3, width: 1.95, height: 2, color: '#b8d6df' },
  { style: 'boxtruck', length: 7.2, width: 2.3, height: 3.3, color: '#7197b5' },
  { style: 'dump', length: 7.6, width: 2.4, height: 3.1, color: '#ec963e' },
  { style: 'bus', length: 9, width: 2.4, height: 3.2, color: '#5ba478' },
];
