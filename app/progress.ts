import { ROUTES, type RouteId } from './routes';
export const STORAGE_KEY = 'seoul-midnight-run.profile.v1';
export type Result = {
  route: RouteId;
  completed: boolean;
  distance: number;
  time: number;
  passed: number;
  nearMisses: number;
  maxSpeed: number;
  landmarks: string[];
};
export type RecordEntry = {
  bestTime: number | null;
  stars: number;
  attempts: number;
  finishes: number;
};
export type Profile = {
  version: 1;
  xp: number;
  runs: number;
  distance: number;
  records: Partial<Record<RouteId, RecordEntry>>;
  landmarks: string[];
  badges: string[];
  settings: {
    music: number;
    engine: number;
    color: string;
    route: RouteId;
    transmission: 'auto' | 'manual';
  };
};
export const blankProfile = (): Profile => ({
  version: 1,
  xp: 0,
  runs: 0,
  distance: 0,
  records: {},
  landmarks: [],
  badges: [],
  settings: {
    music: 0.5,
    engine: 0.65,
    color: '#f31931',
    route: 'hangang',
    transmission: 'auto',
  },
});
const nonnegative = (x: unknown, fallback = 0) =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : fallback;
export function parseProfile(raw: string | null): Profile {
  const p = blankProfile();
  if (!raw) return p;
  try {
    const d = JSON.parse(raw);
    if (d?.version !== 1) return p;
    p.xp = Math.floor(nonnegative(d.xp));
    p.runs = Math.floor(nonnegative(d.runs));
    p.distance = nonnegative(d.distance);
    for (const id of ROUTES.map((r) => r.id)) {
      const r = d.records?.[id];
      if (r)
        p.records[id] = {
          bestTime:
            typeof r.bestTime === 'number' && r.bestTime > 0
              ? r.bestTime
              : null,
          stars: Math.min(3, Math.floor(nonnegative(r.stars))),
          attempts: Math.floor(nonnegative(r.attempts)),
          finishes: Math.floor(nonnegative(r.finishes)),
        };
    }
    p.landmarks = Array.isArray(d.landmarks)
      ? ([
          ...new Set(d.landmarks.filter((s: unknown) => typeof s === 'string')),
        ] as string[])
      : [];
    p.badges = Array.isArray(d.badges)
      ? d.badges.filter((s: unknown) => typeof s === 'string')
      : [];
    if (d.settings) {
      p.settings.music = Math.min(1, nonnegative(d.settings.music, 0.5));
      p.settings.engine = Math.min(1, nonnegative(d.settings.engine, 0.65));
      if (/^#[\da-f]{6}$/i.test(d.settings.color))
        p.settings.color = d.settings.color;
      if (ROUTES.some((r) => r.id === d.settings.route))
        p.settings.route = d.settings.route;
    }
    p.settings.transmission =
      d.settings?.transmission === 'manual' ? 'manual' : 'auto';
    return p;
  } catch {
    return p;
  }
}
export function levelInfo(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 180)) + 1,
    start = (level - 1) ** 2 * 180,
    next = level ** 2 * 180;
  return {
    level,
    progress: (xp - start) / (next - start),
    remaining: next - xp,
    next,
  };
}
export const BADGES: Record<string, string> = {
  first: '첫 완주',
  tourist: '서울 탐험가',
  speed: '300 클럽',
  near: '간발의 차이',
  veteran: '레벨 5',
};
export function awardRun(profile: Profile, result: Result, target: number) {
  const p: Profile = structuredClone(profile);
  const old = p.records[result.route] || {
    bestTime: null,
    stars: 0,
    attempts: 0,
    finishes: 0,
  };
  const stars = result.completed
    ? result.time <= target
      ? 3
      : result.time <= target * 1.4
        ? 2
        : 1
    : 0;
  const newLandmarks = result.landmarks.filter(
    (id) => !p.landmarks.includes(id),
  );
  const xp = Math.max(
    0,
    Math.floor(result.distance / 15) +
      result.passed * 12 +
      result.nearMisses * 30 +
      (result.completed ? 250 + stars * 75 : 0) +
      newLandmarks.length * 60,
  );
  p.xp += xp;
  p.runs++;
  p.distance += result.distance;
  p.landmarks = [...new Set([...p.landmarks, ...result.landmarks])];
  p.records[result.route] = {
    bestTime: result.completed
      ? Math.min(old.bestTime ?? Infinity, result.time)
      : old.bestTime,
    stars: Math.max(old.stars, stars),
    attempts: old.attempts + 1,
    finishes: old.finishes + (result.completed ? 1 : 0),
  };
  const add = (id: string, yes: boolean) => {
    if (yes && !p.badges.includes(id)) p.badges.push(id);
  };
  add('first', result.completed);
  add('speed', result.maxSpeed >= 300);
  add('near', result.nearMisses > 0);
  add(
    'tourist',
    ['hangang', 'namsan', 'seoul'].every(
      (id) => !!p.records[id as RouteId]?.finishes,
    ),
  );
  add('veteran', levelInfo(p.xp).level >= 5);
  return {
    profile: p,
    xp,
    stars,
    newBest:
      result.completed && (old.bestTime === null || result.time < old.bestTime),
    newBadges: p.badges.filter((b) => !profile.badges.includes(b)),
    levelUp: levelInfo(p.xp).level > levelInfo(profile.xp).level,
  };
}
export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
