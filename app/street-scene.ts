import { roadSpeedLimit } from './driving-score';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Course } from './routes';
import { createCrossings, signalAt, type Crossing } from './signals';
export class StreetScene {
  root = new T.Group();
  crossings: Crossing[];
  private disposed = false;
  private lamps: { crossing: Crossing; materials: T.MeshStandardMaterial[] }[] =
    [];
  constructor(
    private course: Course,
    private works = false,
  ) {
    this.crossings = createCrossings(course);
    this.root.name = 'Blender street kit';
    this.build();
  }
  private place(z: number, x = 0) {
    const f = this.course.sample(z, x),
      g = new T.Group();
    g.position.copy(f.position);
    g.rotation.set(f.pitch, f.heading, 0, 'YXZ');
    this.root.add(g);
    return g;
  }
  private box(g: T.Group, size: number[], pos: number[], mat: T.Material) {
    const m = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  private async build() {
    const white = new T.MeshStandardMaterial({
      color: '#e8e6dc',
      roughness: 0.86,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const curb = new T.MeshStandardMaterial({
      color: '#b2b2a6',
      roughness: 0.9,
    });
    const paving = new T.MeshStandardMaterial({
      color: '#828983',
      roughness: 0.94,
    });
    const yellow = new T.MeshStandardMaterial({
      color: '#ddb84a',
      roughness: 0.8,
    });
    const markers = [
      45,
      ...this.crossings.map((c) => c.stop - 95),
      ...(this.works
        ? [this.course.length * 0.3 - 98, this.course.length * 0.49 + 2]
        : []),
    ];
    for (const z of markers) {
      const limit = roadSpeedLimit(this.course, z, this.works),
        g = this.place(z, 12.5);
      this.box(g, [0.07, 3.5, 0.07], [0, 1.75, 0], curb);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fffdf4';
      ctx.beginPath();
      ctx.arc(128, 128, 121, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d92d36';
      ctx.lineWidth = 22;
      ctx.stroke();
      ctx.fillStyle = '#18252c';
      ctx.font = 'bold 112px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(limit), 128, 137);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      const face = new T.Mesh(
        new T.PlaneGeometry(1.25, 1.25),
        new T.MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 0.65,
        }),
      );
      face.position.set(0, 3, 0.07);
      g.add(face);
    }
    for (const c of this.crossings) {
      // Each stripe follows the actual curved/elevated road frame.
      for (let x = -10; x < 10; x += 1.25) {
        const g = this.place(c.z, x);
        this.box(g, [0.65, 0.018, 4.5], [0, 0.045, 0], white);
      }
      const line = this.place(c.stop);
      this.box(line, [21, 0.025, 0.5], [0, 0.055, 0], white);
      for (const side of [-1, 1]) {
        const g = this.place(c.z, side * 13.1);
        this.box(g, [3.7, 0.18, 22], [0, 0.06, 0], paving);
        for (let y = -10; y <= 10; y += 2)
          this.box(g, [0.28, 0.3, 1.85], [-side * 1.72, 0.14, y], curb);
        this.box(g, [2.7, 0.025, 0.65], [0, 0.17, side * 3.1], yellow);
        // Tactile pavers, bollards and landscaped waiting islands.
        for (const z of [-5, 5]) {
          this.box(g, [0.14, 1, 0.14], [-side * 1.35, 0.6, z], curb);
          this.box(g, [0.18, 0.12, 0.18], [-side * 1.35, 1, z], yellow);
        }
      }
    }
    try {
      const [signal, shelter, tree] = await Promise.all(
        ['signal', 'shelter', 'tree'].map((name) =>
          new GLTFLoader().loadAsync(
            import.meta.env.BASE_URL + `models/street/${name}.glb`,
          ),
        ),
      );
      if (this.disposed) {
        this.release(signal.scene);
        this.release(shelter.scene);
        this.release(tree.scene);
        return;
      }
      for (const c of this.crossings) {
        const g = this.place(c.z + 3);
        const model = signal.scene.clone(true),
          materials: T.MeshStandardMaterial[] = [];
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            const m = o.material as T.MeshStandardMaterial;
            if (/^(signal_|walk_)/.test(m.name)) {
              o.material = m.clone();
              materials.push(o.material as T.MeshStandardMaterial);
            }
          }
        });
        g.add(model);
        this.lamps.push({ crossing: c, materials });
        const stop = this.place(c.z + 24, -14.5);
        stop.add(shelter.scene.clone(true));
        const board = document.createElement('canvas');
        board.width = 512;
        board.height = 128;
        const ctx = board.getContext('2d')!;
        ctx.fillStyle = '#174b49';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#f4f4e8';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(this.course.config.district || '서울 드라이브', 20, 52);
        ctx.font = '20px sans-serif';
        ctx.fillText(
          'BUS STOP  ·  ' + String(100 + c.id) + '  |  정류장',
          20,
          98,
        );
        const tex = new T.CanvasTexture(board);
        tex.colorSpace = T.SRGBColorSpace;
        const sign = new T.Mesh(
          new T.PlaneGeometry(4.8, 1.2),
          new T.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
        );
        sign.position.set(0, 3.3, 0.86);
        stop.add(sign);
      }
      const positions: { z: number; x: number }[] = [];
      const theme = this.course.config.theme;
      if (theme !== 'pasture')
        for (
          let z = 0;
          z < this.course.length;
          z += theme === 'forest' ? 25 : 52
        ) {
          if (
            (theme === 'river' || this.course.config.id === 'hangang') &&
            z > this.course.length * 0.12 &&
            z < this.course.length * 0.53
          )
            continue;
          if (this.crossings.some((c) => Math.abs(c.z - z) < 40)) continue;
          for (const side of theme === 'coast' || theme === 'riverside'
            ? [-1]
            : [-1, 1])
            positions.push({ z, x: side * (theme === 'forest' ? 24 : 22) });
        }
      tree.scene.updateMatrixWorld(true);
      const transform = new T.Object3D(),
        matrix = new T.Matrix4();
      tree.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          const instances = new T.InstancedMesh(
            o.geometry,
            o.material,
            positions.length,
          );
          instances.userData.forest = true;
          instances.castShadow = true;
          instances.receiveShadow = true;
          positions.forEach((p, i) => {
            const frame = this.course.sample(p.z, p.x);
            transform.position.copy(frame.position);
            transform.rotation.set(0, i * 2.399, 0);
            transform.scale.setScalar(0.9 + (i % 5) * 0.1);
            transform.updateMatrix();
            matrix.multiplyMatrices(transform.matrix, o.matrixWorld);
            instances.setMatrixAt(i, matrix);
          });
          instances.computeBoundingSphere();
          this.root.add(instances);
        }
      });
      this.root.userData.loaded = true;
    } catch {
      this.root.userData.error = '도로 시설물 모델 로딩 실패';
    }
  }
  update(time: number, distance: number) {
    for (const { crossing, materials } of this.lamps) {
      const state = signalAt(crossing, time);
      for (const m of materials) {
        const on = m.name.startsWith('signal_')
          ? m.name.includes(state.phase)
          : m.name === 'walk_green'
            ? state.walk
            : !state.walk;
        m.emissiveIntensity = on ? 2.6 : 0;
        m.color.copy(m.emissive).multiplyScalar(on ? 0.8 : 0.075);
      }
    }
    const origin = this.course.sample(distance).position;
    for (const o of this.root.children)
      if (!o.userData.forest)
        o.visible = o.position.distanceToSquared(origin) < 700 * 700;
  }
  private release(root: T.Object3D) {
    const geo = new Set<T.BufferGeometry>(),
      mats = new Set<T.Material>(),
      tex = new Set<T.Texture>();
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        geo.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          mats.add(m);
          Object.values(m).forEach((v) => {
            if (v instanceof T.Texture) tex.add(v);
          });
        }
      }
    });
    geo.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    tex.forEach((t) => t.dispose());
  }
  dispose() {
    this.disposed = true;
    this.release(this.root);
    this.root.removeFromParent();
  }
}
