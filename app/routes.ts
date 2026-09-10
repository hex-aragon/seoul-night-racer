import { CatmullRomCurve3, Vector3 } from 'three';
export type RouteId = 'hangang' | 'namsan' | 'seoul';
export type Landmark = {
  id: string;
  name: string;
  at: number;
  side: number;
  kind: 'bridge' | 'tower' | 'gold' | 'palace' | 'lotte' | 'stream';
};
export type RouteConfig = {
  id: RouteId;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  sky: string;
  difficulty: string;
  points: Vector3[];
  landmarks: Landmark[];
  target: number;
};
const points = (n: number, f: (s: number) => [number, number, number]) =>
  Array.from({ length: n }, (_, i) => new Vector3(...f(i / (n - 1))));
export const ROUTES: RouteConfig[] = [
  {
    id: 'hangang',
    name: '한강 브리지 런',
    subtitle: 'BANPO · YEOUIDO',
    description: '완만한 강변 커브와 반포대교의 무지개분수',
    color: '#6de5ed',
    sky: '#0b2032',
    difficulty: '이지 · 완만한 커브',
    target: 75,
    points: points(29, (t) => [
      Math.sin(t * Math.PI * 3) * 170,
      7 + Math.sin(Math.min(1, Math.max(0, (t - 0.1) / 0.5)) * Math.PI) * 5,
      -t * 3000,
    ]),
    landmarks: [
      {
        id: 'banpo',
        name: '반포대교 · 무지개분수',
        at: 0.29,
        side: 0,
        kind: 'bridge',
      },
      { id: '63', name: '63스퀘어', at: 0.68, side: -70, kind: 'gold' },
    ],
  },
  {
    id: 'namsan',
    name: '남산 와인딩',
    subtitle: 'N SEOUL TOWER · MOUNTAIN',
    description: '산자락의 연속 S자 코너와 남산서울타워',
    color: '#ffa1c1',
    sky: '#18152d',
    difficulty: '하드 · 연속 S자 / 언덕',
    target: 80,
    points: points(41, (t) => [
      Math.sin(t * Math.PI * 7) * 145,
      8 + Math.sin(t * Math.PI) * 48 + Math.sin(t * Math.PI * 5) * 6,
      -t * 2500,
    ]),
    landmarks: [
      { id: 'namsan', name: '남산서울타워', at: 0.47, side: 65, kind: 'tower' },
    ],
  },
  {
    id: 'seoul',
    name: '서울 랜드마크 투어',
    subtitle: 'GWANGHWAMUN · JAMSIL',
    description: '광화문, 청계천, 롯데월드타워를 잇는 야간 질주',
    color: '#ffc76d',
    sky: '#182239',
    difficulty: '노멀 · 도심 연속 커브',
    target: 85,
    points: points(35, (t) => [
      Math.sin(t * Math.PI * 4) * 190 + Math.sin(t * Math.PI * 8) * 40,
      5 + Math.sin(t * Math.PI * 2) * 2,
      -t * 3400,
    ]),
    landmarks: [
      {
        id: 'gwanghwamun',
        name: '광화문',
        at: 0.18,
        side: -44,
        kind: 'palace',
      },
      { id: 'cheonggye', name: '청계천', at: 0.47, side: 35, kind: 'stream' },
      { id: 'lotte', name: '롯데월드타워', at: 0.79, side: 65, kind: 'lotte' },
    ],
  },
];
export class Course {
  curve: CatmullRomCurve3;
  length: number;
  constructor(public config: RouteConfig) {
    this.curve = new CatmullRomCurve3(config.points, false, 'centripetal');
    this.curve.arcLengthDivisions = 2500;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
  }
  sample(distance: number, lateral = 0) {
    const u = Math.max(0, Math.min(1, distance / this.length)),
      center = this.curve.getPointAt(u),
      tangent = this.curve.getTangentAt(u).normalize(),
      right = new Vector3(-tangent.z, 0, tangent.x).normalize();
    if (distance < 0) center.addScaledVector(tangent, distance);
    if (distance > this.length)
      center.addScaledVector(tangent, distance - this.length);
    return {
      position: center.addScaledVector(right, lateral),
      tangent,
      right,
      heading: Math.atan2(-tangent.x, -tangent.z),
      pitch: Math.asin(tangent.y),
    };
  }
  curvature(distance: number) {
    const a = this.sample(distance - 8).tangent,
      b = this.sample(distance + 8).tangent;
    return Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z) / 16;
  }
}
export const COURSES = ROUTES.map((r) => new Course(r));
export const getCourse = (id: RouteId) =>
  COURSES.find((c) => c.config.id === id) || COURSES[0];
