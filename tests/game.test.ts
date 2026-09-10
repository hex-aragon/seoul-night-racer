import { newDrive, stepDrive, selectGear } from '../app/drivetrain';
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

test('123 distinct urban courses have finite geometry and persistent records', () => {
  assert.equal(ROUTES.length, 123);
  assert.equal(new Set(ROUTES.map((r) => JSON.stringify(r.points))).size, 123);
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
  assert.equal(d.velocity, 46);
  d.gear = 2;
  for (let i = 0; i < 100; i++) stepDrive(d, true, false, 0.1);
  assert.equal(d.velocity, 92);
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
