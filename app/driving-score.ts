import type { Course } from './routes';
import { signalAt, type Crossing } from './signals';
export type Indicator = -1 | 0 | 1;
export type Assessment = {
  score: number;
  speedingSeconds: number;
  lane: number;
  redCrossings: number[];
  speeding: number;
  redLights: number;
  unsignalled: number;
  lastDeduction: string;
};
export const newAssessment = (x = 0): Assessment => ({
  score: 100,
  speedingSeconds: 0,
  lane: Math.max(0, Math.min(4, Math.floor((x + 10) / 4))),
  redCrossings: [],
  speeding: 0,
  redLights: 0,
  unsignalled: 0,
  lastDeduction: '',
});
/** These are fictional game limits, not legal limits for the named real roads. */
export function roadSpeedLimit(
  course: Course,
  distance: number,
  works = false,
) {
  if (
    works &&
    distance > course.length * 0.3 - 100 &&
    distance < course.length * 0.49
  )
    return 40;
  const theme = course.config.theme;
  return theme === 'coast' ||
    theme === 'riverside' ||
    theme === 'river' ||
    course.config.id === 'hangang'
    ? 80
    : theme === 'forest' ||
        theme === 'pasture' ||
        theme === 'hill' ||
        course.config.id === 'namsan'
      ? 50
      : 60;
}
export function deduct(a: Assessment, points: number, reason: string) {
  a.score = Math.max(0, a.score - points);
  a.lastDeduction = `${reason} −${points}점`;
}
export function assessDriving(
  a: Assessment,
  input: {
    dt: number;
    time: number;
    previousDistance: number;
    distance: number;
    x: number;
    speed: number;
    limit: number;
    length: number;
    indicator: Indicator;
    indicatorAge: number;
    crossings: Crossing[];
  },
) {
  const {
    dt,
    time,
    previousDistance,
    distance,
    x,
    speed,
    limit,
    length,
    indicator,
    indicatorAge,
    crossings,
  } = input;
  a.lastDeduction = '';
  if (speed > limit + 3) {
    a.speedingSeconds += dt;
    while (a.speedingSeconds >= 2) {
      a.speedingSeconds -= 2;
      const points = speed > limit + 20 ? 4 : 2;
      a.speeding += points;
      deduct(a, points, '과속');
    }
  } else a.speedingSeconds = 0;
  if (distance > previousDistance)
    for (const c of crossings) {
      const front = distance + length / 2,
        previous = previousDistance + length / 2;
      if (
        previous < c.stop &&
        front >= c.stop &&
        !a.redCrossings.includes(c.id)
      ) {
        // Interpolate crossing time so an end-of-frame phase transition cannot change the verdict.
        const crossedAt =
          time - dt + (dt * (c.stop - previous)) / (front - previous);
        if (signalAt(c, crossedAt).phase === 'red') {
          a.redCrossings.push(c.id);
          a.redLights++;
          deduct(a, 15, '적색 신호 위반');
        }
      }
    }
  let changed: Indicator = 0;
  while (a.lane < 4 && x > -10 + (a.lane + 1) * 4 + 0.35) {
    a.lane++;
    changed = 1;
    if (indicator !== 1 || indicatorAge < 1) {
      a.unsignalled++;
      deduct(a, 5, '우측 변경 · 깜빡이 미사용');
    }
  }
  while (a.lane > 0 && x < -10 + a.lane * 4 - 0.35) {
    a.lane--;
    changed = -1;
    if (indicator !== -1 || indicatorAge < 1) {
      a.unsignalled++;
      deduct(a, 5, '좌측 변경 · 깜빡이 미사용');
    }
  }
  return changed;
}
export const passedDriving = (score: number) =>
  Number.isFinite(score) && score >= 80;
