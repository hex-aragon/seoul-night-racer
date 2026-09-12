import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Course } from './routes';
/** Original Blender architecture placed along measured road centerlines. */
export class RegionalScenery {
  root = new T.Group();
  private disposed = false;
  constructor(private course: Course) {
    this.root.name = 'Regional Blender scenery';
    if (course.config.regionalAsset) void this.build();
  }
  private async build() {
    try {
      const names = [
        this.course.config.regionalAsset!,
        this.course.config.district === '전라도' ? 'hanok' : 'cafe',
      ];
      const assets = await Promise.all(
        [...new Set(names)].map(async (name) => {
          const source = (
            await new GLTFLoader().loadAsync(
              import.meta.env.BASE_URL + `models/regions/${name}.glb`,
            )
          ).scene;
          source.updateMatrixWorld(true);
          const parts = new Map<T.Material, T.BufferGeometry[]>();
          source.traverse((o) => {
            if (o instanceof T.Mesh && !Array.isArray(o.material)) {
              const geo = o.geometry.index
                ? o.geometry.toNonIndexed()
                : o.geometry.clone();
              geo.applyMatrix4(o.matrixWorld);
              const list = parts.get(o.material) || [];
              list.push(geo);
              parts.set(o.material, list);
            }
          });
          const group = new T.Group();
          for (const [material, geos] of parts) {
            const merged = mergeGeometries(geos);
            geos.forEach((g) => g.dispose());
            if (merged) {
              const mesh = new T.Mesh(merged, material);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              group.add(mesh);
            }
          }
          source.traverse((o) => {
            if (o instanceof T.Mesh) o.geometry.dispose();
          });
          return group;
        }),
      );
      if (this.disposed) {
        assets.forEach((a) => this.release(a));
        return;
      }
      for (
        let z = 90, i = 0;
        z < this.course.length;
        z +=
          this.course.config.regionalAsset === 'hanok'
            ? 38
            : this.course.config.theme === 'city'
              ? 180
              : 340,
          i++
      ) {
        const side = i % 3 === 0 ? 1 : -1,
          frame = this.course.sample(
            z,
            side * (this.course.roadHalfWidth + 12),
          );
        const cluster = assets[i % assets.length].clone(true);
        cluster.position.copy(frame.position);
        cluster.position.y -= 0.75;
        cluster.rotation.y =
          frame.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        this.root.add(cluster);
      }
      this.root.userData.loaded = true;
    } catch {
      this.root.userData.error = '지역 시설물 로딩 실패';
    }
  }
  update(distance: number) {
    const origin = this.course.sample(distance).position;
    for (const c of this.root.children)
      c.visible = c.position.distanceToSquared(origin) < 550 * 550;
  }
  private release(root: T.Object3D) {
    const geos = new Set<T.BufferGeometry>(),
      mats = new Set<T.Material>();
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        geos.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          mats.add(m);
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
  dispose() {
    this.disposed = true;
    this.release(this.root);
    this.root.removeFromParent();
  }
}
