import { roadSpeedLimit } from './road-rules';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Course } from './routes';
import { type Crossing } from './signals';
export class StreetScene {
  root = new T.Group();
  crossings: Crossing[];
  private disposed = false;
  constructor(
    private course: Course,
    private works = false,
  ) {
    this.crossings = [];
    this.root.name = 'Blender street kit';
    void this.build();
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
    const curb = new T.MeshStandardMaterial({
      color: '#b2b2a6',
      roughness: 0.9,
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
        g = this.place(z, this.course.roadHalfWidth + 1.5);
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
    try {
      const [shelter, tree] = await Promise.all(
        ['shelter', 'tree'].map((name) =>
          new GLTFLoader().loadAsync(
            import.meta.env.BASE_URL + `models/street/${name}.glb`,
          ),
        ),
      );
      if (this.disposed) {
        this.release(shelter.scene);
        this.release(tree.scene);
        return;
      }
      for (let z = 140; z < this.course.length; z += 850) {
        const stop = this.place(z, -(this.course.roadHalfWidth + 4));
        stop.add(shelter.scene.clone(true));
      }
      const positions: { z: number; x: number }[] = [];
      const theme = this.course.config.theme;
      if (theme !== 'pasture')
        for (
          let z = 0;
          z < this.course.length;
          z += theme === 'forest' ? 20 : theme === 'riverside' ? 32 : 52
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
            : [-1, 1]) {
            positions.push({
              z,
              x:
                side *
                (this.course.roadHalfWidth + (theme === 'forest' ? 6 : 9)),
            });
            if (
              this.course.config.mapSource &&
              ['forest', 'riverside'].includes(theme || '')
            )
              for (const offset of [20, 34])
                positions.push({
                  z: z + offset * 0.4,
                  x: side * (this.course.roadHalfWidth + offset),
                });
          }
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
  update(_time: number, distance: number) {
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
