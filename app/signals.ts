import type { Course } from './routes';
export type SignalPhase = 'green' | 'amber' | 'red';
export type Crossing = { id: number; z: number; stop: number; offset: number };
export function createCrossings(course: Course): Crossing[] {
  const stops: Crossing[] = [];
  const bridge =
    course.config.id === 'hangang' || course.config.theme === 'river';
  for (let z = 190; z < course.length - 180; z += 650) {
    // Keep bridge decks, construction sections and landmark structures clear.
    if (
      (bridge && z > course.length * 0.12 && z < course.length * 0.53) ||
      (z > course.length * 0.3 - 100 && z < course.length * 0.49 + 80)
    )
      continue;
    if (
      course.config.landmarks.some(
        (l) => Math.abs(l.at * course.length - z) < 70,
      )
    )
      continue;
    stops.push({
      id: stops.length,
      z,
      stop: z - 8,
      offset: 16 + stops.length * 7,
    });
  }
  return stops;
}
export function signalAt(c: Crossing, time: number) {
  const t = (((time + c.offset) % 32) + 32) % 32;
  const phase: SignalPhase = t < 18 ? 'green' : t < 21 ? 'amber' : 'red';
  return {
    phase,
    remaining: Math.ceil((t < 18 ? 18 : t < 21 ? 21 : 32) - t),
    walk: t >= 23 && t < 30,
  };
}
/** A vehicle already committed past the line clears the crossing. */
export function signalSpeedLimit(
  z: number,
  length: number,
  speed: number,
  crossings: Crossing[],
  time: number,
) {
  let cap = Infinity;
  for (const c of crossings) {
    const gap = c.stop - z - length / 2;
    if (gap < -0.15 || gap > 160) continue;
    const { phase } = signalAt(c, time);
    // Amber: stop when there is room, otherwise clear rather than snap-brake.
    if (
      phase === 'green' ||
      (phase === 'amber' && gap < (speed * speed) / 8 + 2)
    )
      continue;
    cap = Math.min(
      cap,
      Math.sqrt(2 * 3 * Math.max(0, gap - 1)),
      Math.max(0, gap - 1) * 1.6,
    );
  }
  return cap;
}
