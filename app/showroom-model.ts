import * as T from 'three';
import type { Vehicle } from './vehicles';
export const SHOWROOM_ASSETS: Record<
  string,
  { paint: string[]; yaw: number; hide?: string[] }
> = {
  porsche: { paint: ['paint'], yaw: Math.PI, hide: ['Plane', 'Plane_0'] },
  bmw: { paint: ['Meshesbody151Mtl'], yaw: Math.PI },
  mercedes: {
    paint: ['Car_Paint', 'Car_Paint.001', 'Car_Paint_With_Flakes', 'Car_paint'],
    yaw: Math.PI,
  },
  audi: { paint: ['Metallic_3'], yaw: 0 },
  hyundai: { paint: ['Matte__FFFFFFFF__prim_env_1_spec'], yaw: 0 },
  kia: { paint: ['body', 'material_7'], yaw: Math.PI },
  tesla: { paint: ['material_9'], yaw: Math.PI },
  lincoln: {
    paint: ['Paint', 'PaintSec'],
    yaw: Math.PI,
    hide: ['Paint001_8', 'Paint.001_8'],
  },
};
export function prepareShowroomModel(source: T.Object3D, vehicle: Vehicle) {
  const config = SHOWROOM_ASSETS[vehicle.id];
  const remove: T.Object3D[] = [];
  source.traverse((o) => {
    if (config.hide?.includes(o.name)) remove.push(o);
    if (o instanceof T.Mesh) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      if (materials.some((m) => /^shadow$/i.test(m.name))) remove.push(o);
      o.castShadow = true;
      o.receiveShadow = false;
      const converted = materials.map((m) => {
        if (m instanceof T.MeshStandardMaterial) {
          const copy = m.clone();
          copy.envMapIntensity = 0.8;
          if (config.paint.includes(m.name)) {
            copy.userData.coachwork = true;
            copy.color.set(vehicle.color);
            copy.map = null;
            copy.metalness = 0.6;
            copy.roughness = 0.24;
          }
          if (copy.transparent) {
            copy.depthWrite = false;
            copy.side = T.DoubleSide;
          }
          return copy;
        }
        return m;
      });
      o.material = Array.isArray(o.material) ? converted : converted[0];
    }
  });
  remove.forEach((o) => o.removeFromParent());
  const orient = new T.Group();
  orient.add(source);
  let box = new T.Box3().setFromObject(orient, true),
    size = box.getSize(new T.Vector3());
  if (size.x > size.z) orient.rotation.y = Math.PI / 2;
  orient.rotation.y += config.yaw;
  box.setFromObject(orient, true);
  size = box.getSize(new T.Vector3());
  orient.scale.setScalar(vehicle.length / size.z);
  box.setFromObject(orient, true);
  orient.position.set(
    -(box.min.x + box.max.x) / 2,
    -box.min.y + 0.025,
    -(box.min.z + box.max.z) / 2,
  );
  const group = new T.Group();
  group.name = vehicle.id;
  group.add(orient);
  return group;
}
