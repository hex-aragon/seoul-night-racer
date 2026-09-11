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
};
export const newDrive = (): DriveState => ({
  velocity: 0,
  selector: 'D',
  transmission: 'auto',
  gear: 1,
  rpm: 900,
});
export function selectGear(d: DriveState, selector: Selector): boolean {
  if (Math.abs(d.velocity) > 1 && selector !== d.selector && selector !== 'N')
    return false;
  d.selector = selector;
  if (selector === 'P') d.velocity = 0;
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
  if (d.transmission === 'auto' && d.selector === 'D')
    d.gear = Math.min(spec.forwardGears, Math.max(1, 1 + Math.floor(v / 46)));
  const cap =
    d.selector === 'R'
      ? spec.reverseLimit
      : spec.powertrain === 'electric'
        ? spec.maxSpeed
        : Math.min(spec.maxSpeed, d.gear * 46);
  const engaged = d.selector === 'D' || d.selector === 'R';
  if (d.selector === 'P') d.velocity = 0;
  else if (brake)
    d.velocity = Math.sign(d.velocity) * Math.max(0, v - 145 * dt);
  else if (gas && engaged) {
    const acceleration =
      spec.acceleration *
      (d.selector === 'R' ? 0.45 : Math.max(0.3, 1 - (d.gear - 1) * 0.09));
    d.velocity = direction * Math.min(cap, Math.max(0, v + acceleration * dt));
  } else
    d.velocity =
      Math.sign(d.velocity) *
      Math.max(0, v - (engaged ? 12 + spec.regen : 3) * dt);
  d.rpm =
    spec.powertrain === 'electric'
      ? 0
      : Math.min(
          8500,
          900 +
            (Math.abs(d.velocity) / (d.selector === 'R' ? 28 : d.gear * 46)) *
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
