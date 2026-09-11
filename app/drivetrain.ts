/** Signed longitudinal speed is independent of route progress, ready for parking modes. */
export type Selector = 'P' | 'R' | 'N' | 'D';
export type Transmission = 'auto' | 'manual';
export interface VehicleSpec {
  powertrain: 'combustion' | 'electric';
  forwardGears: number;
  maxSpeed: number;
  reverseLimit: number;
  acceleration: number;
  regen: number;
}
export const FERRARI: VehicleSpec = {
  powertrain: 'combustion',
  forwardGears: 7,
  maxSpeed: 320,
  reverseLimit: 28,
  acceleration: 64,
  regen: 0,
};
export type DriveState = {
  velocity: number;
  selector: Selector;
  transmission: Transmission;
  gear: number;
  rpm: number;
  autoHold?: number;
  shiftTime?: number;
};
export const newDrive = (): DriveState => ({
  velocity: 0,
  selector: 'D',
  transmission: 'auto',
  gear: 1,
  rpm: 900,
});
export function selectGear(d: DriveState, selector: Selector): boolean {
  if (
    Math.abs(d.velocity) > 1 &&
    selector !== d.selector &&
    selector !== 'N' &&
    !(selector === 'D' && d.selector === 'N' && d.velocity > 0)
  )
    return false;
  if (selector === 'D' && d.selector === 'N')
    d.gear = Math.min(
      7,
      Math.max(
        1,
        GEAR_LIMITS.findIndex((limit) => limit >= Math.abs(d.velocity)) + 1,
      ),
    );
  d.selector = selector;
  if (selector === 'P') d.velocity = 0;
  return true;
}
export const GEAR_LIMITS = [65, 102, 145, 190, 238, 282, 320];
export function shiftDrive(d: DriveState, delta: number) {
  const gear = Math.max(1, Math.min(7, d.gear + delta));
  if (
    d.selector !== 'D' ||
    gear === d.gear ||
    Math.abs(d.velocity) > GEAR_LIMITS[gear - 1]
  )
    return false;
  d.gear = gear;
  d.shiftTime = 0.16;
  d.autoHold = d.transmission === 'auto' ? 3 : 0;
  return true;
}
export function stepDrive(
  d: DriveState,
  gas: boolean,
  brake: boolean,
  dt: number,
  spec = FERRARI,
) {
  const v = Math.abs(d.velocity),
    direction = d.selector === 'R' ? -1 : 1;
  d.autoHold = Math.max(0, (d.autoHold || 0) - dt);
  d.shiftTime = Math.max(0, (d.shiftTime || 0) - dt);
  if (
    d.transmission === 'auto' &&
    d.selector === 'D' &&
    !d.autoHold &&
    !d.shiftTime
  ) {
    if (d.gear < spec.forwardGears && v > GEAR_LIMITS[d.gear - 1] * 0.92) {
      d.gear++;
      d.shiftTime = 0.16;
    } else if (d.gear > 1 && v < GEAR_LIMITS[d.gear - 2] * 0.57) {
      d.gear--;
      d.shiftTime = 0.12;
    }
  }
  const cap =
    d.selector === 'R'
      ? spec.reverseLimit
      : spec.powertrain === 'electric'
        ? spec.maxSpeed
        : Math.min(spec.maxSpeed, GEAR_LIMITS[d.gear - 1]);
  const engaged = d.selector === 'D' || d.selector === 'R';
  if (d.selector === 'P') d.velocity = 0;
  else if (brake)
    d.velocity = Math.sign(d.velocity) * Math.max(0, v - 145 * dt);
  else if (gas && engaged && !d.shiftTime) {
    const acceleration =
      spec.acceleration *
      (d.selector === 'R' ? 0.45 : Math.max(0.32, 1 - (d.gear - 1) * 0.105));
    d.velocity = direction * Math.min(cap, v + acceleration * dt);
  } else
    d.velocity =
      Math.sign(d.velocity) *
      Math.max(0, v - (engaged ? 8 + spec.regen : 3) * dt);
  d.rpm =
    spec.powertrain === 'electric'
      ? 0
      : Math.min(
          8400,
          900 +
            (Math.abs(d.velocity) /
              (d.selector === 'R' ? 28 : GEAR_LIMITS[d.gear - 1])) *
              7000 +
            (gas && !engaged ? 3500 : 0),
        );
}

/** Arcade fuel percentage, scaled for a short browser drive rather than real-world litres. */
export function consumeFuel(
  fuel: number,
  speed: number,
  throttle: boolean,
  dt: number,
) {
  return Math.max(
    0,
    fuel -
      (0.006 + (Math.abs(speed) / 3.6) * 0.012 + (throttle ? 0.06 : 0)) * dt,
  );
}
