import {
  newDrive,
  stepDrive,
  selectGear,
  consumeFuel,
  shiftDrive,
  GEAR_LIMITS,
} from '../app/drivetrain';
import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, ROUTES, getCourse } from '../app/routes';
import {
  awardRun,
  blankProfile,
  parseProfile,
  levelInfo,
  type Result,
} from '../app/progress';
import { RaceEngine, initial } from '../app/race-engine';

test('all routes have distinct curves, continuous frames, and landmarks inside the course', () => {
  for (const course of COURSES) {
    assert(course.length > 2500);
    let turns = 0;
    for (let s = 0; s < course.length; s += 12) {
      const a = course.sample(s),
        b = course.sample(s + 1);
      assert(Math.abs(a.right.dot(a.tangent)) < 1e-6);
      assert(a.position.distanceTo(b.position) < 1.05);
      if (Math.abs(course.curvature(s)) > 0.0005) turns++;
    }
    assert(turns > 30);
    for (const l of course.config.landmarks) assert(l.at > 0 && l.at < 1);
  }
  const n = getCourse('namsan');
  assert(n.sample(n.length * 0.5).position.y - n.sample(0).position.y > 30);
});
test('profile survives round trip and recovers from corrupt or unsupported data', () => {
  const p = blankProfile();
  p.xp = 1234;
  p.settings.route = 'namsan';
  assert.deepEqual(parseProfile(JSON.stringify(p)), p);
  assert.deepEqual(parseProfile('{bad'), blankProfile());
  assert.deepEqual(parseProfile('{"version":9}'), blankProfile());
  assert.equal(
    parseProfile('{"version":1,"xp":-30,"settings":{"music":9}}').settings
      .music,
    1,
  );
});
const result: Result = {
  route: 'hangang',
  completed: true,
  distance: 3000,
  time: 70,
  passed: 5,
  nearMisses: 1,
  maxSpeed: 310,
  landmarks: ['banpo', '63'],
};
test('finish grants XP, records, stars, levels, and achievements; slower result preserves best', () => {
  const first = awardRun(blankProfile(), result, 75);
  assert.equal(first.stars, 3);
  assert(first.xp > 500);
  assert(first.newBest);
  assert(levelInfo(first.profile.xp).level > 1);
  assert(first.profile.badges.includes('speed'));
  const second = awardRun(first.profile, { ...result, time: 140 }, 75);
  assert.equal(second.profile.records.hangang?.bestTime, 70);
  assert.equal(second.profile.records.hangang?.stars, 3);
  assert(!second.newBest);
  assert(second.xp < first.xp);
});
test('crash receives no finish stars, no best time, and only earned distance/skill XP', () => {
  const r = awardRun(
    blankProfile(),
    {
      ...result,
      completed: false,
      distance: 300,
      passed: 0,
      nearMisses: 0,
      landmarks: [],
      maxSpeed: 100,
    },
    75,
  );
  assert.equal(r.xp, 20);
  assert.equal(r.stars, 0);
  assert.equal(r.profile.records.hangang?.bestTime, null);
  assert.equal(r.profile.records.hangang?.finishes, 0);
});
// Exercise the simulation independently of WebGL, including the once-only finish guard.
function fixture() {
  const endings: Result[] = [];
  const e = Object.create(RaceEngine.prototype) as any;
  Object.assign(e, {
    state: {
      ...initial(),
      mode: 'racing',
      loaded: true,
      speed: 160,
      distance: 100,
    },
    drive: { ...newDrive(), velocity: 160 },
    steeringInput: 0,
    furthest: 0,
    course: getCourse('hangang'),
    keys: new Set(),
    x: 0,
    steer: 0,
    traffic: [],
    hit: 0,
    noticeUntil: 0,
    audio: { crash() {} },
    update() {},
    onEnd: (r: Result) => endings.push(r),
  });
  return { e, endings };
}
test('traffic collision ends the run exactly once and freezes further simulation', () => {
  const { e, endings } = fixture();
  e.traffic = [{ z: 103, x: 0, speed: 20, hit: false, passed: false }];
  e.simulate(0.025);
  assert.equal(e.state.endReason, 'traffic');
  assert.equal(e.state.mode, 'finished');
  assert.equal(endings.length, 1);
  e.finish('traffic');
  e.simulate(0.05);
  assert.equal(endings.length, 1);
  assert.equal(e.state.speed, 0);
});
test('guardrail collision and finish line produce distinct terminal outcomes', () => {
  const crash = fixture();
  crash.e.x = 10.3;
  crash.e.simulate(0.025);
  assert.equal(crash.e.state.endReason, 'barrier');
  const win = fixture();
  win.e.state.distance = win.e.course.length - 0.1;
  win.e.simulate(0.025);
  assert.equal(win.e.state.endReason, 'finish');
  assert(win.endings[0].completed);
});
test('curve forces move lateral position and can be countersteered', () => {
  const { e } = fixture();
  e.course = getCourse('namsan');
  e.state.distance = 450;
  e.state.speed = 230;
  const before = e.x;
  e.simulate(0.025);
  assert.notEqual(e.x, before);
});

test('133 distinct scenic and urban courses have finite geometry and persistent records', () => {
  assert.equal(ROUTES.length, 133);
  assert.equal(new Set(ROUTES.map((r) => JSON.stringify(r.points))).size, 133);
  for (const route of ROUTES) {
    const c = getCourse(route.id);
    assert(c.length > 2000);
    assert(Number.isFinite(c.sample(c.length / 2).position.y));
  }
  const p = blankProfile();
  p.settings.route = 'city-120';
  p.settings.transmission = 'manual';
  p.records['city-120'] = { bestTime: 80, stars: 2, attempts: 1, finishes: 1 };
  assert.deepEqual(parseProfile(JSON.stringify(p)), p);
});
test('brakes stop both directions, unsafe selector changes are refused, neutral coasts and P locks', () => {
  const d = newDrive();
  for (let i = 0; i < 100; i++) stepDrive(d, true, false, 0.025);
  assert(d.velocity > 0);
  assert(!selectGear(d, 'R'));
  assert(!selectGear(d, 'P'));
  assert(selectGear(d, 'N'));
  const v = d.velocity;
  stepDrive(d, true, false, 0.1);
  assert(d.velocity < v);
  for (let i = 0; i < 100; i++) stepDrive(d, false, true, 0.025);
  assert.equal(d.velocity, 0);
  assert(selectGear(d, 'R'));
  stepDrive(d, true, false, 1);
  assert(d.velocity < 0);
  assert(d.velocity >= -28);
  stepDrive(d, false, true, 1);
  assert.equal(Math.abs(d.velocity), 0);
  assert(selectGear(d, 'P'));
  stepDrive(d, true, false, 1);
  assert.equal(d.velocity, 0);
});
test('manual gear limits speed until shifted, auto upshifts, steering cannot move parked car', () => {
  const d = newDrive();
  d.transmission = 'manual';
  for (let i = 0; i < 100; i++) stepDrive(d, true, false, 0.1);
  assert.equal(d.gear, 1);
  assert.equal(d.velocity, GEAR_LIMITS[0]);
  d.gear = 2;
  for (let i = 0; i < 100; i++) stepDrive(d, true, false, 0.1);
  assert.equal(d.velocity, GEAR_LIMITS[1]);
  d.transmission = 'auto';
  stepDrive(d, true, false, 0.1);
  assert.equal(d.gear, 3);
  const { e } = fixture();
  e.drive = { ...newDrive(), selector: 'P' };
  e.keys.add('arrowleft');
  e.simulate(0.1);
  assert.equal(e.x, 0);
});
test('reverse reduces course position without adding forward distance', () => {
  const { e } = fixture();
  e.drive = { ...newDrive(), selector: 'R', velocity: -15 };
  e.furthest = 100;
  e.keys.add('w');
  e.simulate(0.1);
  assert(e.state.distance < 100);
  assert.equal(e.furthest, 100);
});
test('peaceful drive cruises gently, forgives collisions and stays on the road', () => {
  const { e, endings } = fixture();
  e.peaceful = true;
  e.cruise = true;
  e.drive = newDrive();
  e.traffic = [{ z: 103, x: 0, speed: 18, hit: false, passed: false }];
  e.simulate(0.1);
  assert.equal(e.state.mode, 'racing');
  assert.equal(endings.length, 0);
  assert(e.state.speed > 0);
  e.x = 11;
  e.drive.velocity = 65;
  e.simulate(0.025);
  assert.equal(e.state.mode, 'racing');
  assert(Math.abs(e.x) < 10);
  assert(e.drive.velocity <= 65);
  e.keys.add('s');
  for (let i = 0; i < 50; i++) e.simulate(0.025);
  assert.equal(e.state.speed, 0);
});
test('experience settings migrate to racing defaults and persist explicit choices', () => {
  const p = parseProfile(
    JSON.stringify({ version: 1, settings: { route: 'hangang' } }),
  );
  assert(p.settings.daylight && !p.settings.peaceful && !p.settings.cruise);
  p.settings.daylight = false;
  p.settings.peaceful = false;
  p.settings.cruise = false;
  assert.deepEqual(parseProfile(JSON.stringify(p)), p);
});

test('fuel is consumed by travel and throttle and never goes negative', () => {
  assert(consumeFuel(100, 80, true, 1) < consumeFuel(100, 0, false, 1));
  assert.equal(consumeFuel(0.001, 120, true, 1), 0);
  const { e } = fixture();
  e.state.fuel = 0;
  e.drive.velocity = 50;
  e.cruise = true;
  e.keys.add('w');
  e.simulate(0.1);
  assert(e.state.speed < 50);
  assert.equal(e.state.rpm, 0);
  assert.equal(e.state.fuel, 0);
  for (let i = 0; i < 250; i++) e.simulate(0.025);
  assert.equal(e.state.speed, 0);
  assert.equal(e.state.mode, 'racing');
});
test('manual pedal default migrates once and explicit cruise preference survives', () => {
  const p = parseProfile(
    JSON.stringify({ version: 1, settings: { cruise: true } }),
  );
  assert.equal(p.settings.cruise, false);
  p.settings.cruise = true;
  assert.equal(parseProfile(JSON.stringify(p)).settings.cruise, true);
});

test('automatic drivetrain passes 120 and reaches top gear; AT paddles work while moving', () => {
  const d = newDrive();
  for (let i = 0; i < 1200; i++) stepDrive(d, true, false, 0.025);
  assert(d.velocity > 300);
  assert.equal(d.gear, 7);
  d.velocity = 110;
  d.gear = 3;
  assert(shiftDrive(d, -1) === false);
  assert(shiftDrive(d, 1));
  assert.equal(d.gear, 4);
  stepDrive(d, true, false, 0.025);
  assert.equal(d.gear, 4);
  assert((d.autoHold || 0) > 2);
});
test('neutral can re-engage forward while rolling without allowing unsafe reverse', () => {
  const d = newDrive();
  d.velocity = 150;
  assert(selectGear(d, 'N'));
  assert(selectGear(d, 'D'));
  assert(d.gear >= 4);
  assert(!selectGear(d, 'R'));
});
test('race timer stops at timeout and obstacles cannot be skipped at high speed', () => {
  const { e, endings } = fixture();
  e.state.timeLeft = 0.01;
  e.peaceful = false;
  e.simulate(0.025);
  assert.equal(e.state.endReason, 'timeout');
  assert.equal(endings.length, 1);
  const run = fixture();
  run.e.peaceful = false;
  run.e.hazards = [
    { id: 0, z: 101, x: 0, kind: 'barrier', hit: false, passed: false },
  ];
  run.e.hazardMeshes = [{ visible: true }];
  run.e.simulate(0.025);
  assert.equal(run.e.state.endReason, 'obstacle');
});

test('a long truck collides at its actual rear extent before a compact car would', () => {
  const { e } = fixture();
  e.drive.velocity = 0;
  e.state.speed = 0;
  e.traffic = [
    {
      z: 105.5,
      x: 0,
      speed: 0,
      length: 7.6,
      width: 2.4,
      hit: false,
      passed: false,
    },
  ];
  e.simulate(0.025);
  assert.equal(e.state.endReason, 'traffic');
  const compact = fixture().e;
  compact.drive.velocity = 0;
  compact.state.speed = 0;
  compact.traffic = [
    {
      z: 105.5,
      x: 0,
      speed: 0,
      length: 3.65,
      width: 1.65,
      hit: false,
      passed: false,
    },
  ];
  compact.simulate(0.025);
  assert.equal(compact.state.mode, 'racing');
});

test('red-light waiting freezes the race countdown and pause freezes the signal clock', () => {
  const { e } = fixture();
  e.drive.velocity = 0;
  e.state.speed = 0;
  e.state.velocity = 0;
  e.state.distance = 170;
  e.state.time = 7;
  e.state.timeLeft = 60;
  e.world = {
    street: { crossings: [{ id: 0, z: 190, stop: 182, offset: 16 }] },
  };
  e.simulate(0.1);
  assert.equal(e.state.signal.phase, 'red');
  assert.equal(e.state.timeLeft, 60);
  const time = e.state.time;
  e.state.mode = 'paused';
  e.simulate(1);
  assert.equal(e.state.time, time);
  e.state.mode = 'racing';
  e.state.time = 17;
  e.simulate(0.1);
  assert.equal(e.state.signal.phase, 'green');
  assert.ok(e.state.timeLeft < 60);
});
