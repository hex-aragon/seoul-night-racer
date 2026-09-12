import { buildRegionalTerrain } from './regional-terrain';
import { RegionalScenery } from './regional-scenery';
import { StreetScene } from './street-scene';
import { buildVehicle, TRAFFIC_BODIES } from './vehicle-model';
import type { TrafficScenario } from './traffic';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Course, type Landmark } from './routes';
const random = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** Normalize procedural and primitive meshes before static batching. */
export function prepareStaticGeometry(mesh: T.Mesh) {
  const geo = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry.clone();
  if (!geo.getAttribute('uv'))
    geo.setAttribute(
      'uv',
      new T.Float32BufferAttribute(
        new Float32Array(geo.getAttribute('position').count * 2),
        2,
      ),
    );
  return geo.applyMatrix4(mesh.matrixWorld);
}
export class TrackWorld {
  root = new T.Group();
  street: StreetScene;
  regional: RegionalScenery;
  private materials = new Map<string, T.Material>();
  private blocks = new Map<number, T.Group>();
  private water?: T.MeshPhysicalMaterial;
  private fountains?: T.Points;
  private rotors: T.Group[] = [];
  constructor(
    public course: Course,
    public scenario: TrafficScenario = course.config.trafficPreset || 'free',
  ) {
    this.street = new StreetScene(course, scenario === 'works');
    this.build();
    this.root.add(this.street.root);
    this.regional = new RegionalScenery(course);
    this.root.add(this.regional.root);
  }
  setDaylight(day: boolean) {
    this.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats)
          if (m instanceof T.MeshStandardMaterial) {
            if (m.userData.nightEmission === undefined)
              m.userData.nightEmission = m.emissiveIntensity;
            m.emissiveIntensity = day ? 0.02 : m.userData.nightEmission;
            if (m.emissiveMap && m.map) {
              if (!m.userData.nightMap) {
                m.userData.nightMap = m.map;
                const c = document.createElement('canvas');
                c.width = 128;
                c.height = 256;
                const g = c.getContext('2d')!;
                g.fillStyle = '#a6b7b9';
                g.fillRect(0, 0, 128, 256);
                for (let y = 5; y < 256; y += 15)
                  for (let x = 4; x < 128; x += 16) {
                    g.fillStyle = (x + y) % 3 ? '#597c91' : '#7a9cad';
                    g.fillRect(x, y, 7, 8);
                  }
                const tex = new T.CanvasTexture(c);
                tex.colorSpace = T.SRGBColorSpace;
                m.userData.dayMap = tex;
              }
              m.map = day ? m.userData.dayMap : m.userData.nightMap;
              m.roughness = day ? 0.8 : 0.4;
              m.needsUpdate = true;
            }
          }
      }
    });
    if (this.fountains) this.fountains.visible = !day;
  }
  private nature(theme: string) {
    const { length, config } = this.course,
      coast = theme === 'coast',
      river = theme === 'riverside',
      forest = theme === 'forest',
      pasture = theme === 'pasture';
    const grass = this.material(
      pasture ? '#79a954' : forest ? '#38694c' : '#638d58',
    );
    if (!config.mapSource)
      this.ribbon(-650, coast || river ? 35 : 650, -0.65, grass);
    if ((coast || river) && !config.mapSource) {
      this.water = new T.MeshPhysicalMaterial({
        color: coast ? '#318baa' : '#377f92',
        metalness: 0.35,
        roughness: 0.3,
        envMapIntensity: 0.5,
      });
      this.ribbon(35, coast ? 1800 : 430, -3, this.water);
      this.ribbon(14, 38, -0.55, this.material(coast ? '#d5c69e' : '#6ca765'));
      if (coast) {
        this.ribbon(40, 42, -2.8, this.material('#c0e0dc'));
        this.ribbon(56, 57, -2.85, this.material('#8cc8d2'));
      } else {
        this.ribbon(430, 600, -1, grass);
        for (let z = 50; z < length; z += 140) {
          const g = this.placed(z, 475);
          const h = 25 + random(z) * 60;
          this.box(g, [22, h, 25], [0, h / 2 - 5, 0], this.material('#9eafb5'));
        }
      }
    }
    for (let z = 0; z < length; z += forest ? 24 : 64) {
      if (pasture) {
        for (const side of [-1, 1]) {
          const g = this.placed(z, side * 19);
          this.box(
            g,
            [0.24, 1.5, 0.24],
            [0, 0.75, 0],
            this.material('#e3d6b5'),
          );
          this.box(
            g,
            [0.15, 0.15, 64],
            [0, 0.85, -32],
            this.material('#d6c7a5'),
          );
          const hill = this.placed(z + 25, side * (100 + random(z) * 140));
          const mound = new T.Mesh(new T.SphereGeometry(1, 14, 8), grass);
          mound.scale.set(80 + random(z) * 60, 14 + random(z + 2) * 22, 100);
          mound.position.y = -7;
          hill.add(mound);
        }
        if (z % 128 === 0) {
          const g = this.placed(z, 32 + random(z) * 22),
            wool = this.material('#eeeadd');
          const body = new T.Mesh(new T.SphereGeometry(1, 10, 8), wool);
          body.scale.set(0.8, 0.7, 1.15);
          body.position.y = 1;
          g.add(body);
          this.box(g, [0.48, 0.5, 0.6], [0, 1.3, -1], this.material('#e0d9c8'));
          for (const x of [-0.4, 0.4])
            for (const zz of [-0.65, 0.65])
              this.box(
                g,
                [0.16, 0.65, 0.16],
                [x, 0.35, zz],
                this.material('#645949'),
              );
        }
      }
    }
    if (pasture) {
      for (let z = 430; z < length; z += 550) {
        const g = this.placed(z, -65);
        this.box(g, [2, 42, 2], [0, 21, 0], this.material('#e8e7dc'));
        const rotor = new T.Group();
        rotor.position.copy(this.course.sample(z, -65).position);
        rotor.position.y += 42;
        for (let j = 0; j < 3; j++) {
          const blade = new T.Group();
          blade.rotation.z = (j * Math.PI * 2) / 3;
          this.box(blade, [1.5, 19, 0.4], [0, 10, 0], this.material('#e8e7dc'));
          rotor.add(blade);
        }
        this.root.add(rotor);
        this.rotors.push(rotor);
      }
      const barn = this.placed(length * 0.35, 55);
      this.box(barn, [18, 9, 24], [0, 4.5, 0], this.material('#9d574b'));
      const roof = new T.Mesh(
        new T.ConeGeometry(17, 7, 4),
        this.material('#575f61'),
      );
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 1.3;
      roof.position.y = 12;
      barn.add(roof);
    }
    if (coast) {
      const lighthouse = this.placed(length * 0.38, 52);
      const tower = new T.Mesh(
        new T.CylinderGeometry(3, 4, 23, 12),
        this.material('#eee4ca'),
      );
      tower.position.y = 10;
      lighthouse.add(tower);
      this.box(lighthouse, [6, 4, 6], [0, 23, 0], this.material('#c66651'));
      this.box(
        lighthouse,
        [4, 2, 4],
        [0, 24, 0],
        this.material('#f5d59d', true),
      );
      for (let z = 100; z < length; z += 350) {
        const island = this.placed(z, 270 + random(z) * 220);
        const rock = new T.Mesh(
          new T.SphereGeometry(1, 10, 6),
          this.material('#71816b'),
        );
        rock.scale.set(60, 14, 45);
        rock.position.y = -9;
        island.add(rock);
      }
    }
    if (river) {
      const g = this.placed(length * 0.42, 160),
        stone = this.material('#b9c4c1');
      this.box(g, [360, 1.5, 12], [0, 14, 0], stone);
      for (let x = -120; x < 180; x += 60)
        this.box(g, [4, 19, 5], [x, 4, 0], stone);
      for (let x = -100; x <= 100; x += 200) {
        this.box(g, [3, 32, 3], [x, 28, 0], stone);
        for (let k = 0; k < 5; k++) {
          const cable = this.box(
            g,
            [0.18, 36, 0.18],
            [x + (k - 2) * 12, 25, 0],
            stone,
          );
          cable.rotation.z = (k - 2) * 0.32;
        }
      }
    }
  }
  private material(color: string, emissive = false) {
    const key = color + emissive;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.55,
          metalness: 0.12,
          emissive: emissive ? color : '#000000',
          emissiveIntensity: emissive ? 1.5 : 0,
        }),
      );
    return this.materials.get(key)!;
  }
  private box(
    parent: T.Object3D,
    size: number[],
    pos: number[],
    mat: T.Material,
  ) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(...(size as [number, number, number])),
      mat,
    );
    mesh.position.set(...(pos as [number, number, number]));
    parent.add(mesh);
    return mesh;
  }
  private block(s: number) {
    const id = Math.floor(s / 160);
    if (!this.blocks.has(id)) {
      const group = new T.Group();
      this.blocks.set(id, group);
      this.root.add(group);
    }
    return this.blocks.get(id)!;
  }
  private placed(s: number, lateral: number) {
    const f = this.course.sample(
        s,
        this.course.config.lanes &&
          Math.abs(lateral) >= 11 &&
          Math.abs(lateral) <= 18
          ? Math.sign(lateral) *
              (this.course.roadHalfWidth + Math.abs(lateral) - 11)
          : lateral,
      ),
      g = new T.Group();
    g.position.copy(f.position);
    g.rotation.set(f.pitch, f.heading, 0, 'YXZ');
    this.block(s).add(g);
    return g;
  }
  private ribbon(
    left: number,
    right: number,
    y: number,
    mat: T.Material,
    start = 0,
    end = this.course.length,
  ) {
    for (let s = start; s < end; s += 160) {
      const e = Math.min(end, s + 160),
        positions: number[] = [],
        uv: number[] = [],
        indices: number[] = [];
      const steps = Math.ceil((e - s) / 6);
      for (let i = 0; i <= steps; i++) {
        const d = s + ((e - s) * i) / steps;
        for (const side of [left, right]) {
          const p = this.course.sample(d, side).position;
          positions.push(p.x, p.y + y, p.z);
          uv.push(side === left ? 0 : 1, d / 12);
        }
        if (i < steps) {
          const n = i * 2;
          indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      this.block(s).add(new T.Mesh(geo, mat));
    }
  }
  private text(text: string, sub: string, color: string) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a1928';
    g.fillRect(0, 0, 512, 192);
    g.strokeStyle = color;
    g.lineWidth = 8;
    g.strokeRect(6, 6, 500, 180);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.font = 'bold 43px Arial';
    g.fillText(text, 256, 82);
    g.font = '20px Arial';
    g.fillStyle = '#d6e9ff';
    g.fillText(sub, 256, 141);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: tex });
  }
  private facade(seed: number) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#101b30';
    g.fillRect(0, 0, 128, 256);
    for (let y = 5; y < 256; y += 15)
      for (let x = 4; x < 128; x += 16) {
        g.fillStyle =
          random(seed + x + y) > 0.35
            ? seed % 2
              ? '#afdaeb'
              : '#d6b987'
            : '#233650';
        g.fillRect(x, y, 7, 8);
      }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return new T.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: '#c0d9ff',
      emissiveIntensity: 0.32,
      metalness: 0.4,
      roughness: 0.4,
    });
  }
  private destinationDetails() {
    const id = this.course.config.id,
      length = this.course.length;
    if (id === 'incheon-coast') {
      for (let z = 200; z < length; z += 170) {
        const g = this.placed(z, -75),
          h = 18 + (z % 5) * 8;
        this.box(g, [25, h, 23], [0, h / 2, 0], this.material('#a5b8bc'));
        for (const x of [-9, 0, 9])
          this.box(
            g,
            [3, h * 0.8, 23.2],
            [x, h / 2 + 1, 0],
            this.material('#638c9c'),
          );
      }
      const airport = this.placed(length * 0.2, -140);
      this.box(airport, [70, 0.4, 210], [0, 0.2, 0], this.material('#6c797d'));
      for (let z = -90; z < 100; z += 20)
        this.box(airport, [1, 0.05, 8], [0, 0.45, z], this.material('#e8e6d5'));
      const plane = new T.Group();
      plane.position.set(0, 3, 0);
      airport.add(plane);
      this.box(plane, [3, 3, 32], [0, 0, 0], this.material('#e7eef0'));
      const wing = this.box(
        plane,
        [31, 0.35, 6],
        [0, 0, 2],
        this.material('#d6e3e8'),
      );
      wing.rotation.y = 0.18;
      this.box(plane, [10, 0.2, 3], [0, 1, 13], this.material('#618da6'));
      this.box(plane, [0.5, 6, 4], [0, 3, 12], this.material('#618da6'));
    }
    if (id === 'busan-coast' || id.startsWith('busan-')) {
      for (let z = 60; z < length; z += 100) {
        const g = this.placed(z, -60 - (z % 4) * 14),
          h = 30 + (z % 7) * 12;
        this.box(
          g,
          [19, h, 20],
          [0, h / 2, 0],
          this.material(z % 3 ? '#c0b9ad' : '#96b4c4'),
        );
        for (let y = 4; y < h; y += 5)
          this.box(g, [19.2, 0.8, 20.2], [0, y, 0], this.material('#5c899e'));
        const shade = this.placed(z, 28);
        this.box(
          shade,
          [0.12, 2.5, 0.12],
          [0, 1.25, 0],
          this.material('#84745c'),
        );
        const umbrella = new T.Mesh(
          new T.ConeGeometry(2, 0.7, 10),
          this.material(z % 3 ? '#e78966' : '#e9d18a'),
        );
        umbrella.position.y = 2.8;
        shade.add(umbrella);
      }
    }
    if (id === 'east-coast' || id === 'gangwon-jeongdongjin') {
      for (const x of [-34, -36])
        this.ribbon(x, x + 0.14, -0.15, this.material('#81949a'));
      for (let z = 0; z < length; z += 8) {
        const g = this.placed(z, -35);
        this.box(g, [3, 0.12, 0.3], [0, -0.22, 0], this.material('#756c5c'));
      }
      for (let z = 170; z < length; z += 210) {
        const g = this.placed(z, -70);
        const rock = new T.Mesh(
          new T.DodecahedronGeometry(18 + (z % 5)),
          this.material('#7a8883'),
        );
        rock.scale.set(1, 1.7, 1);
        rock.position.y = 8;
        g.add(rock);
      }
    }
    if (id === 'jeju-coast') {
      for (let z = 0; z < length; z += 22) {
        const g = this.placed(z, 16);
        this.box(g, [1, 1.2, 16], [0, 0.5, 0], this.material('#555c54'));
      }
      for (let z = 60; z < length; z += 100) {
        const g = this.placed(z, -27);
        this.box(g, [0.6, 7, 0.6], [0, 3.5, 0], this.material('#827655'));
        for (let i = 0; i < 6; i++) {
          const leaf = this.box(
            g,
            [0.7, 0.15, 6],
            [Math.sin(i) * 1.8, 7, Math.cos(i) * 1.8],
            this.material('#547e45'),
          );
          leaf.rotation.y = i;
          leaf.rotation.z = 0.18;
        }
      }
    }
    if (id === 'namhae-coast') {
      for (let z = 130; z < length; z += 140) {
        const g = this.placed(z, -40 - (z % 3) * 18);
        this.box(g, [12, 7, 10], [0, 3.5, 0], this.material('#e6decb'));
        const roof = new T.Mesh(
          new T.ConeGeometry(10, 4, 4),
          this.material('#bd684c'),
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 8;
        g.add(roof);
        this.box(g, [2, 3, 0.05], [0, 3, 5.03], this.material('#426877'));
      }
    }
    if (id === 'seorak-forest')
      for (let z = 50; z < length; z += 190) {
        const g = this.placed(z, -120);
        const rock = new T.Mesh(
          new T.DodecahedronGeometry(35),
          this.material('#7c9188'),
        );
        rock.scale.set(1, 2.2, 1.1);
        rock.position.y = 30;
        g.add(rock);
      }
  }
  private roadEnvironment() {
    const start = this.course.length * 0.3,
      end = this.course.length * 0.49;
    if (this.scenario === 'free') return;
    for (const z of [start - 160, start - 35]) {
      const g = this.placed(z, 13);
      this.box(g, [0.2, 3, 0.2], [0, 1.5, 0], this.material('#6f8286'));
      const sign = new T.Mesh(
        new T.PlaneGeometry(5, 1.8),
        this.text(
          this.scenario === 'works'
            ? this.course.laneCount === 2
              ? '갓길 공사 · 서행'
              : '도로 공사 · 좌측 통행'
            : '정체 구간 · 서행',
          this.scenario === 'works'
            ? this.course.laneCount === 2
              ? 'SHOULDER WORK'
              : 'RIGHT LANE CLOSED'
            : 'KEEP YOUR DISTANCE',
          '#ffcc66',
        ),
      );
      sign.position.y = 3;
      g.add(sign);
    }
    if (this.scenario === 'busy') return;
    for (let z = start; z < end; z += 14) {
      const g = this.placed(
        z,
        this.course.config.lanes
          ? this.course.laneCount === 2
            ? this.course.roadHalfWidth + 1
            : this.course.laneCenters.at(-1)! - 1.65
          : 6.15,
      );
      this.box(g, [0.65, 0.12, 0.65], [0, 0.06, 0], this.material('#303b3d'));
      const cone = new T.Mesh(
        new T.ConeGeometry(0.3, 0.9, 8),
        this.material('#ed8b35'),
      );
      cone.position.y = 0.56;
      g.add(cone);
      this.box(g, [0.35, 0.14, 0.35], [0, 0.57, 0], this.material('#ffefd4'));
    }
    for (const z of [start + 60, start + 220]) {
      const g = this.placed(Math.min(z, end - 30), 17);
      const body = TRAFFIC_BODIES[5];
      g.add(
        buildVehicle({ id: 'works-dump', ...body }, this.material(body.color)),
      );
      const worker = this.placed(z - 12, 13);
      this.box(
        worker,
        [0.55, 0.65, 0.32],
        [0, 1.12, 0],
        this.material('#ffab2f'),
      );
      for (const x of [-0.16, 0.16])
        this.box(
          worker,
          [0.2, 0.72, 0.24],
          [x, 0.43, 0],
          this.material('#36546b'),
        );
      const head = new T.Mesh(
        new T.SphereGeometry(0.22, 10, 8),
        this.material('#edccae'),
      );
      head.position.y = 1.66;
      worker.add(head);
      const helmet = new T.Mesh(
        new T.SphereGeometry(0.25, 10, 8),
        this.material('#ffe05b'),
      );
      helmet.position.y = 1.79;
      helmet.scale.y = 0.55;
      worker.add(helmet);
      const excavator = this.placed(z + 15, 20),
        yellow = this.material('#e9ad38'),
        dark = this.material('#364244');
      for (const x of [-1, 1])
        this.box(excavator, [0.6, 0.55, 3.6], [x, 0.3, 0], dark);
      this.box(excavator, [2.1, 0.75, 2.6], [0, 1, 0], yellow);
      this.box(
        excavator,
        [1, 1.4, 1.2],
        [-0.45, 1.9, -0.4],
        this.material('#344f5e'),
      );
      const boom = this.box(
        excavator,
        [0.4, 3.5, 0.5],
        [0.6, 2.7, -1.4],
        yellow,
      );
      boom.rotation.x = -0.6;
      const arm = this.box(
        excavator,
        [0.35, 2.5, 0.4],
        [0.6, 3.1, -3.2],
        yellow,
      );
      arm.rotation.x = 0.7;
      this.box(excavator, [1, 0.8, 1], [0.6, 1.9, -4], dark);
    }
  }
  private build() {
    const { config, length } = this.course;
    const bridge = config.id === 'hangang' || config.theme === 'river';
    const half = this.course.roadHalfWidth;
    const mountain = config.id === 'namsan' || config.theme === 'hill';
    const scenic = ['coast', 'forest', 'pasture', 'riverside'].includes(
      config.theme || '',
    );
    const road = new T.MeshPhysicalMaterial({
      color: '#535962',
      roughness: 0.85,
      metalness: 0.04,
      clearcoat: 0.08,
      envMapIntensity: 0.25,
    });
    const asphalt = new T.TextureLoader().load(
      import.meta.env.BASE_URL + 'textures/asphalt.png',
    );
    asphalt.wrapS = asphalt.wrapT = T.RepeatWrapping;
    asphalt.repeat.set(11, 6);
    asphalt.anisotropy = 4;
    road.map = asphalt;
    road.bumpMap = asphalt;
    road.bumpScale = 0.065;
    this.ribbon(-half, half, 0, road, -40, length + 60);
    const ground = this.box(
      this.root,
      [3000, 1, length + 1800],
      [0, -1, -length / 2],
      this.material(mountain ? '#102723' : bridge ? '#101e28' : '#17232f'),
    );
    if (config.mapSource) {
      ground.visible = false;
      this.root.add(buildRegionalTerrain(this.course));
      this.ribbon(-half - 19, half + 19, -0.75, this.material('#708e62'));
    }
    if (scenic) {
      ground.visible = false;
      this.nature(config.theme!);
    }
    if (bridge) {
      ground.visible = false;
      this.water = new T.MeshPhysicalMaterial({
        color: '#073b53',
        metalness: 0.7,
        roughness: 0.24,
        envMapIntensity: 0.3,
      });
      this.box(
        this.root,
        [2200, 0.4, length + 1800],
        [0, -3, -length / 2],
        this.water,
      );
    }
    for (const side of [-1, 1]) {
      this.ribbon(
        side < 0 ? -half - 3 : half,
        side < 0 ? -half : half + 3,
        0.05,
        this.material('#32414e'),
      );
      this.ribbon(
        side * (half - 0.35) - 0.07,
        side * (half - 0.35) + 0.07,
        0.02,
        this.material('#e2bd6c'),
      );
      const railSegment = (start: number, end: number) => {
        this.ribbon(
          side * (half + 0.1) - 0.08,
          side * (half + 0.1) + 0.08,
          0.62,
          this.material('#657f90'),
          start,
          end,
        );
        this.ribbon(
          side * (half + 0.1) - 0.1,
          side * (half + 0.1) + 0.1,
          1.1,
          this.material('#97b1c2'),
          start,
          end,
        );
      };
      const rail = (start: number, end: number) => {
        let cursor = start;
        for (const c of this.street.crossings) {
          if (c.z + 6 < cursor || c.z - 6 > end) continue;
          if (c.z - 6 > cursor) railSegment(cursor, c.z - 6);
          cursor = Math.max(cursor, c.z + 6);
        }
        if (cursor < end) railSegment(cursor, end);
      };
      if (side < 0 || config.mapSource) rail(0, length);
      else
        for (let start = 0; start < length; start += 500) {
          rail(start, Math.min(length, start + 120));
          if (start + 320 < length)
            rail(start + 320, Math.min(length, start + 500));
          this.ribbon(
            half,
            half + 7,
            -0.02,
            road,
            start + 120,
            Math.min(length, start + 320),
          );
        }
      if (mountain)
        this.ribbon(
          side < 0 ? -32 : 14,
          side < 0 ? -14 : 32,
          -0.4,
          this.material('#19372b'),
        );
    }
    const stripe = this.material('#bacbd4'),
      pole = this.material('#657484');
    for (let s = 0; s < length; s += 14) {
      if (this.street.crossings.some((c) => Math.abs(c.z - s) < 9)) continue;
      const frame = this.placed(s, 0);
      for (const lane of Array.from(
        { length: this.course.laneCount - 1 },
        (_, i) => (i + 1 - this.course.laneCount / 2) * this.course.laneWidth,
      ))
        if (!this.course.config.lanes || Math.abs(lane) > 0.1)
          this.box(frame, [0.13, 0.025, 6], [lane, 0.025, -3], stripe);
    }
    if (this.course.config.lanes)
      for (const x of [-0.13, 0.13])
        this.ribbon(x - 0.05, x + 0.05, 0.04, this.material('#e5bc58'));
    const facade = Array.from({ length: 6 }, (_, i) => this.facade(i));
    for (let s = 0, index = 0; !scenic && s < length; s += 40, index++) {
      for (const side of [-1, 1]) {
        const g = this.placed(s, side * 12);
        this.box(g, [0.14, 7.6, 0.14], [0, 3.8, 0], pole);
        this.box(g, [2.5, 0.1, 0.13], [-side * 1.2, 7.6, 0], pole);
        this.box(
          g,
          [1.5, 0.08, 0.28],
          [-side * 1.4, 7.53, 0],
          this.material('#d0eaff', true),
        );
        this.box(g, [0.12, 1.1, 0.12], [-side * 0.9, 0.55, 0], pole);
        const onBridge = bridge && s > length * 0.13 && s < length * 0.48;
        if (onBridge) {
          this.box(g, [1.1, 8, 1.1], [0, -5, 0], this.material('#465361'));
          continue;
        }
        const nearLandmark = config.landmarks.some(
          (l) =>
            l.kind !== 'bridge' &&
            Math.sign(l.side) === side &&
            Math.abs(s - l.at * length) < 175,
        );
        if (nearLandmark) continue;
        if (mountain) continue;
        const width = 10 + random(index) * 12,
          height =
            (18 + random(index + 5 + (config.seed || 0)) * 72) *
            (config.heightScale || 1);
        const building = this.placed(s, side * (25 + width / 2));
        this.box(
          building,
          [width, height, 20],
          [0, height / 2, 0],
          facade[index % 6],
        );
        this.box(
          building,
          [width + 1, 0.5, 21],
          [0, height, 0],
          this.material('#607b8e'),
        );
        if (index % 3 === 0 && config.id !== 'jeolla-jeonju') {
          const sign = new T.Mesh(
            new T.PlaneGeometry(8, 3),
            this.text(
              config.mapSource
                ? [
                    config.district + ' 산책',
                    '동네 책방',
                    '쉬어가는 길',
                    'COFFEE',
                  ][index % 4]
                : ['서울의 밤', 'MIDNIGHT', '한강 드라이브', 'CITY POP'][
                    index % 4
                  ],
              'SEOUL NIGHT RUN',
              config.color,
            ),
          );
          sign.position.set(0, 8, 10.1);
          building.add(sign);
        }
      }
    }
    if (bridge) {
      this.ribbon(-130, 130, -3, this.material('#223931'), -40, length * 0.13);
      this.ribbon(
        -130,
        130,
        -3,
        this.material('#223931'),
        length * 0.48,
        length + 70,
      );
      this.ribbon(
        -10,
        10,
        -3,
        this.material('#334457'),
        length * 0.13,
        length * 0.48,
      );
      const positions: number[] = [],
        colors: number[] = [];
      for (let s = length * 0.19; s < length * 0.45; s += 12) {
        for (const side of [-1, 1])
          for (let i = 0; i < 20; i++) {
            const u = i / 19,
              p = this.course.sample(s, side * (12 + u * 8)).position;
            p.y += Math.sin(u * Math.PI) * 4 - u * 8;
            positions.push(p.x, p.y, p.z);
            const c = new T.Color().setHSL((s / 300 + u * 0.1) % 1, 0.85, 0.6);
            colors.push(c.r, c.g, c.b);
          }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      this.fountains = new T.Points(
        geo,
        new T.PointsMaterial({
          size: 0.35,
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
        }),
      );
      this.root.add(this.fountains);
    }
    if (bridge) {
      for (let s = length * 0.12, i = 0; s < length * 0.53; s += 65, i++) {
        for (const side of [-1, 1]) {
          const g = this.placed(s, side * (185 + random(i) * 100));
          const height = 30 + random(i + 7) * 90;
          this.box(g, [22, height, 25], [0, height / 2 - 7, 0], facade[i % 6]);
          this.box(
            g,
            [24, 0.3, 27],
            [0, height - 7, 0],
            this.material('#87afbf', true),
          );
        }
      }
    }
    this.destinationDetails();
    this.roadEnvironment();
    config.landmarks.forEach((l) => this.landmark(l));
    for (let s = 200; s < length; s += 450) {
      if (scenic) {
        const marker = this.placed(s, -15);
        this.box(marker, [0.18, 3.4, 0.18], [0, 1.7, 0], pole);
        const board = new T.Mesh(
          new T.PlaneGeometry(5, 1.3),
          this.text(config.name, 'DRIVE SLOW · ENJOY THE VIEW', config.color),
        );
        board.position.y = 3;
        marker.add(board);
        continue;
      }
      const g = this.placed(s, 0),
        next = config.landmarks.find((l) => l.at * length > s);
      this.box(g, [0.25, 8, 0.25], [-10, 4, 0], pole);
      this.box(g, [0.25, 8, 0.25], [10, 4, 0], pole);
      this.box(g, [20, 0.22, 0.22], [0, 8, 0], pole);
      const sign = new T.Mesh(
        new T.PlaneGeometry(8, 2.3),
        this.text(
          next ? next.name : scenic ? config.name : 'FINISH ↑',
          `${Math.round((length - s) / 100) / 10} KM TO FINISH`,
          config.color,
        ),
      );
      sign.position.set(0, 7, 0);
      g.add(sign);
    }
    const finish = this.placed(length, 0);
    this.box(
      finish,
      [half * 2, 0.08, 4],
      [0, 0.07, 0],
      this.material('#eaf4ff'),
    );
    for (let i = 0; i < Math.floor(half * 2); i++)
      if (i % 2 === 0)
        this.box(
          finish,
          [1, 0.09, 4],
          [-half + 0.5 + i, 0.085, 0],
          this.material('#121925'),
        );
    const sign = new T.Mesh(
      new T.PlaneGeometry(10, 2.5),
      this.text('FINISH', 'SEOUL MIDNIGHT RUN', config.color),
    );
    sign.position.y = 7;
    finish.add(sign);
    // Batch static meshes per 160 m block while retaining spatial culling.
    this.root.updateMatrixWorld(true);
    for (const block of this.blocks.values()) {
      const groups = new Map<T.Material, T.Mesh[]>();
      block.traverse((o) => {
        if (o instanceof T.Mesh && !Array.isArray(o.material)) {
          const a = groups.get(o.material) || [];
          a.push(o);
          groups.set(o.material, a);
        }
      });
      for (const [mat, meshes] of groups) {
        const geos = meshes.map(prepareStaticGeometry);
        const geo = mergeGeometries(geos);
        geos.forEach((g) => g.dispose());
        if (geo) {
          meshes.forEach((m) => {
            m.removeFromParent();
            m.geometry.dispose();
          });
          const merged = new T.Mesh(geo, mat);
          merged.receiveShadow = true;
          block.add(merged);
        }
      }
    }
  }
  private landmark(l: Landmark) {
    const s = l.at * this.course.length,
      g = this.placed(s, l.side),
      stone = this.material('#b1a08b'),
      dark = this.material('#263646');
    if (l.kind === 'tower') {
      const hill = new T.Mesh(
        new T.ConeGeometry(45, 30, 16),
        this.material('#244633'),
      );
      hill.position.y = 6;
      g.add(hill);
      const shaft = new T.Mesh(new T.CylinderGeometry(1.3, 2.6, 63, 14), stone);
      shaft.position.y = 50;
      g.add(shaft);
      for (const y of [73, 79]) {
        const deck = new T.Mesh(
          new T.CylinderGeometry(y === 79 ? 7 : 10, 8, 4, 20),
          this.material('#b9e2e8'),
        );
        deck.position.y = y;
        g.add(deck);
      }
      this.box(g, [0.5, 31, 0.5], [0, 96, 0], this.material('#f188ae', true));
    }
    if (l.kind === 'gold') {
      this.box(
        g,
        [22, 145, 16],
        [0, 72.5, 0],
        new T.MeshStandardMaterial({
          color: '#bd9445',
          emissive: '#7c6325',
          emissiveIntensity: 0.3,
          metalness: 0.8,
          roughness: 0.26,
        }),
      );
      for (let y = 6; y < 142; y += 4)
        this.box(
          g,
          [22.2, 0.35, 16.2],
          [0, y, 0],
          this.material('#eec979', true),
        );
    }
    if (l.kind === 'lotte') {
      const shape = new T.Mesh(
        new T.CylinderGeometry(1, 15, 185, 8),
        this.material('#8faabb'),
      );
      shape.position.y = 92.5;
      g.add(shape);
      for (let y = 6; y < 175; y += 6) {
        const r = 15 * (1 - y / 195);
        const ring = new T.Mesh(
          new T.TorusGeometry(r, 0.06, 4, 8),
          this.material('#afd6e3', true),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        g.add(ring);
      }
      this.box(g, [0.3, 25, 0.3], [0, 192, 0], this.material('#e4c6ff', true));
    }
    if (l.kind === 'palace') {
      this.box(g, [62, 0.2, 60], [0, -0.1, 0], this.material('#5c6265'));
      for (const x of [-15, -5, 5, 15])
        this.box(g, [5, 7, 8], [x, 3.5, 0], stone);
      this.box(g, [37, 2, 10], [0, 8, 0], stone);
      for (const y of [11, 16]) {
        this.box(
          g,
          [30, y === 11 ? 3 : 2, 8],
          [0, y, 0],
          this.material('#844336'),
        );
        const roof = new T.Mesh(
          new T.CylinderGeometry(0, 1, 1, 4),
          this.material('#315f59'),
        );
        roof.scale.set(25, 5, 12);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = y + 3;
        g.add(roof);
      }
      for (const x of [-10, 0, 10]) this.box(g, [3, 6, 0.1], [x, 3, 4.1], dark);
    }
    if (l.kind === 'stream') {
      this.box(
        g,
        [14, 0.3, 260],
        [0, -2.6, 0],
        new T.MeshPhysicalMaterial({
          color: '#247489',
          metalness: 0.6,
          roughness: 0.24,
        }),
      );
      for (const x of [-9, 9]) this.box(g, [4, 1, 260], [x, -1, 0], stone);
      this.box(g, [25, 1, 7], [0, 1.2, -30], stone);
      for (let z = -110; z < 120; z += 15)
        this.box(
          g,
          [0.2, 0.4, 0.2],
          [-7, -0.3, z],
          this.material('#ffdba0', true),
        );
    }
    // Landmark name stands beside the route without obstructing traffic.
    const label = this.placed(s, 15),
      sign = new T.Mesh(
        new T.PlaneGeometry(10, 3),
        this.text(l.name, 'LANDMARK / SEOUL', this.course.config.color),
      );
    sign.position.y = 5;
    label.add(sign);
  }
  animate(t: number, time = 0, distance = 0) {
    this.regional.update(distance);
    this.street.update(time, distance);
    for (const rotor of this.rotors) rotor.rotation.z = t * 0.00025;
    if (this.fountains)
      (this.fountains.material as T.PointsMaterial).opacity =
        0.65 + Math.sin(t * 0.002) * 0.15;
    if (this.water) this.water.roughness = 0.25 + Math.sin(t * 0.0003) * 0.035;
  }
  dispose() {
    this.regional.dispose();
    this.street.dispose();
    const seen = new Set<T.Material>();
    this.root.traverse((o) => {
      if (o instanceof T.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (!seen.has(m)) {
            seen.add(m);
            m.userData.dayMap?.dispose();
            m.userData.nightMap?.dispose();
          }
      }
    });
    const geos = new Set<T.BufferGeometry>(),
      mats = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    this.root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Points) {
        geos.add(o.geometry);
        for (const mat of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          mats.add(mat);
          Object.values(mat).forEach((v) => {
            if (v instanceof T.Texture) textures.add(v);
          });
        }
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.root.removeFromParent();
  }
}
