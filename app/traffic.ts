import { signalSpeedLimit, type Crossing } from './signals';
export type TrafficScenario = 'free' | 'works' | 'busy';
export type TrafficMotion = {
  direction?: 1 | -1;
  laneCenters?: number[];
  body?: number;
  length?: number;
  width?: number;
  x: number;
  z: number;
  speed: number;
  actualSpeed?: number;
  kind: 'car' | 'motorcycle';
  targetX: number;
  fromX: number;
  signal: -1 | 0 | 1;
  phase: 'cruise' | 'signal' | 'change';
  elapsed: number;
  nextEvent: number;
  merge: boolean;
};
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createMotion(
  index: number,
  random: () => number,
  origin = 0,
  lanes?: number[],
): TrafficMotion {
  const kind = index < 8 && index % 4 === 3 ? 'motorcycle' : 'car',
    merge = !lanes && (index % 5 === 1 || index === 7);
  const centers = lanes || [-8, -4, 0, 4, 8];
  const x = merge ? 16 : centers[index % centers.length];
  return {
    x,
    direction: lanes && x < 0 ? -1 : 1,
    laneCenters: lanes,
    body: [0, 3, 5, 0, 4, 2, 6, 0, 1, 5, 4, 0, 3, 1, 2, 6][index % 16],
    z: lanes
      ? origin + 120 + index * 95
      : origin +
        (merge
          ? 180 + Math.floor(index / 5) * 500
          : kind === 'motorcycle'
            ? -100 - index * 10
            : 85 + index * 62),
    speed: lanes
      ? 9 + random() * 6
      : merge
        ? 0
        : kind === 'motorcycle'
          ? 27 + random() * 12
          : 16 + random() * 12,
    kind,
    targetX: x,
    fromX: x,
    signal: 0,
    phase: 'cruise',
    elapsed: 0,
    nextEvent: 2 + random() * 7,
    merge,
  };
}
export function requestLaneChange(
  v: TrafficMotion,
  target: number,
  others: TrafficMotion[],
  player: { z: number; x: number; speed: number },
  random: () => number,
) {
  if (
    v.laneCenters &&
    (!v.laneCenters.includes(target) ||
      Math.sign(target) !== (v.direction || 1))
  )
    return false;
  const gap = v.kind === 'motorcycle' ? 10 : 17;
  if (
    others.some(
      (o) =>
        o !== v &&
        Math.abs(o.z - v.z) <
          gap + ((o.length || 4.6) + (v.length || 4.6)) / 2 &&
        (Math.abs(o.x - target) < 2.4 || Math.abs(o.targetX - target) < 2.4),
    )
  )
    return false;
  if (
    Math.abs(player.x - target) < 2.5 &&
    v.z - player.z < Math.max(28, player.speed * 2.2) &&
    v.z - player.z > -18
  )
    return false;
  v.fromX = v.x;
  v.targetX = target;
  v.signal = target < v.x ? -1 : 1;
  v.phase = 'signal';
  v.elapsed = 0;
  v.nextEvent = 5 + random() * 10;
  return true;
}
export function stepTraffic(
  v: TrafficMotion,
  dt: number,
  others: TrafficMotion[],
  player: { z: number; x: number; speed: number },
  random: () => number,
  environment?: {
    scenario: TrafficScenario;
    start: number;
    end: number;
    time: number;
    crossings?: Crossing[];
  },
) {
  v.elapsed += dt;
  if (v.direction === -1) {
    let speed = v.speed;
    for (const other of others)
      if (
        other !== v &&
        other.direction === -1 &&
        other.z < v.z &&
        v.z - other.z < 32 &&
        Math.abs(other.x - v.x) < 2
      )
        speed = Math.min(
          speed,
          Math.max(
            0,
            (v.z -
              other.z -
              ((v.length || 4.6) + (other.length || 4.6)) / 2 -
              3) *
              1.2,
          ),
        );
    v.actualSpeed = speed;
    v.z -= speed * dt;
    return;
  }
  const available = v.laneCenters?.filter((x) => x > 0);

  if (v.phase === 'cruise') {
    v.nextEvent -= dt;
    if (v.nextEvent <= 0 && (!v.merge || v.z - player.z < 260)) {
      const target = available
        ? available[Math.floor(random() * available.length)]
        : v.merge
          ? 8
          : Math.max(-8, Math.min(8, v.x + (random() < 0.5 ? -4 : 4)));
      if (target !== v.x) requestLaneChange(v, target, others, player, random);
      v.nextEvent = 3 + random() * 7;
    }
  } else if (v.phase === 'signal' && v.elapsed >= 1.5) {
    const blocked =
      others.some(
        (o) =>
          o !== v &&
          Math.abs(o.z - v.z) <
            18 + ((o.length || 4.6) + (v.length || 4.6)) / 2 &&
          Math.abs(o.x - v.targetX) < 2.4,
      ) ||
      (Math.abs(player.x - v.targetX) < 2.5 &&
        v.z - player.z < Math.max(28, player.speed * 2.2) &&
        v.z - player.z > -18);
    if (!blocked) {
      v.phase = 'change';
      v.elapsed = 0;
    }
  } else if (v.phase === 'change') {
    const u = Math.min(1, v.elapsed / (v.kind === 'motorcycle' ? 2.5 : 3.8));
    const smooth = u * u * u * (u * (u * 6 - 15) + 10);
    v.x = v.fromX + (v.targetX - v.fromX) * smooth;
    if (u === 1) {
      v.phase = 'cruise';
      v.signal = 0;
      v.merge = false;
      v.elapsed = 0;
    }
  }
  if (v.merge && v.phase === 'change')
    v.speed = Math.min(21, v.speed + 3.5 * dt);
  let speed = v.speed;
  if (environment && !v.merge) {
    const { scenario, start, end, time } = environment;
    if (v.z > start - 100 && v.z < end) {
      if (scenario === 'busy')
        speed = Math.min(speed, Math.floor(time / 9) % 3 === 0 ? 0 : 5);
      if (scenario === 'works') {
        speed = Math.min(speed, 10);
        const outer = available?.at(-1) ?? 8;
        const mergeTarget = available
          ? available[Math.max(0, available.length - 2)]
          : 4;
        const closesLane = !available || available.length > 1;
        if (closesLane && v.x > outer - 1.5 && v.z > start - 90) {
          if (v.phase === 'cruise')
            requestLaneChange(v, mergeTarget, others, player, random);
          if (v.x > outer - 1.5)
            speed = Math.min(speed, Math.max(0, (start - v.z - 12) * 0.4));
        }
      }
    }
  }
  for (const o of others)
    if (
      o !== v &&
      o.z > v.z &&
      o.z - v.z < 24 + (o.length || 4.6) / 2 &&
      Math.abs(o.x - v.x) < 2
    )
      speed = Math.min(
        speed,
        o.actualSpeed ?? o.speed,
        Math.max(
          0,
          (o.z - v.z - ((o.length || 4.6) + (v.length || 4.6)) / 2 - 3) * 1.2,
        ),
      );
  if (player.z > v.z && player.z - v.z < 28 && Math.abs(player.x - v.x) < 2.4)
    speed = Math.min(speed, player.speed);
  if (environment?.crossings)
    speed = Math.min(
      speed,
      signalSpeedLimit(
        v.z,
        v.length || 4.6,
        v.actualSpeed ?? v.speed,
        environment.crossings,
        environment.time,
      ),
    );
  speed = Math.min(speed, (v.actualSpeed ?? v.speed) + 2.6 * dt);
  v.actualSpeed = speed;
  v.z += speed * dt;
}
export function smoothSteering(
  current: number,
  input: number,
  speed: number,
  dt: number,
) {
  const magnitude = Math.min(1, Math.abs(input));
  const target =
    (Math.sign(input) * (0.8 * magnitude + 0.2 * magnitude * magnitude)) /
    (1 + Math.abs(speed) / 650);
  const delta = (target - current) * (1 - Math.exp(-10 * dt));
  return current + Math.max(-5 * dt, Math.min(5 * dt, delta));
}
