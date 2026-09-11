import { CatmullRomCurve3, Vector3 } from 'three';
export type RouteId = string;
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
  theme?:
    | 'river'
    | 'hill'
    | 'city'
    | 'coast'
    | 'forest'
    | 'pasture'
    | 'riverside';
  district?: string;
  seed?: number;
  heightScale?: number;
  featured?: boolean;
  trafficPreset?: 'free' | 'works' | 'busy';
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
const districts = [
  '여의도',
  '반포',
  '잠실',
  '성수',
  '강남',
  '종로',
  '남산',
  '북악',
  '마포',
  '용산',
  '서초',
  '송파',
];
const variants = [
  '새벽 강변',
  '블루아워',
  '야경 순환',
  '언덕 산책',
  '다운타운',
  '리버사이드',
  '스카이라인',
  '골목 커브',
  '심야 드라이브',
  '선셋 로드',
];
for (let district = 0; district < 12; district++)
  for (let v = 0; v < 10; v++) {
    const seed = district * 10 + v + 1,
      hill = district === 6 || district === 7 || v === 3;
    const river =
      !hill && (v === 0 || v === 5 || district === 0 || district === 1);
    const length = 2100 + ((seed * 137) % 1900),
      amplitude = 65 + ((seed * 31) % 155),
      bends = 2 + (seed % 6);
    const theme = hill ? 'hill' : river ? 'river' : 'city';
    const base = ROUTES[hill ? 1 : river ? 0 : 2];
    ROUTES.push({
      id: `city-${seed}`,
      name: `${districts[district]} ${variants[v]}`,
      district: districts[district],
      subtitle: `서울 · ${theme === 'hill' ? '산자락' : theme === 'river' ? '한강변' : '도심'} · ${v + 1}번 코스`,
      description: '서울의 지역 분위기를 재해석한 독립 주행 코스',
      theme,
      seed,
      heightScale: 0.35 + (district % 5) * 0.26 + v * 0.025,
      color: ['#6de5ed', '#ffa1c1', '#ffc76d'][seed % 3],
      sky: ['#142a41', '#28223c', '#172e34', '#36283b'][seed % 4],
      difficulty: `${bends > 5 ? '하드' : bends > 3 ? '노멀' : '이지'} · ${bends}개 굴곡`,
      target: length / 36,
      points: points(49, (t) => [
        Math.sin(t * Math.PI * bends) * amplitude +
          Math.sin(t * Math.PI * (bends + 2)) * v * 3,
        7 +
          Math.sin(t * Math.PI) * (hill ? 25 + (seed % 35) : 5) +
          Math.sin(t * Math.PI * 4) * (hill ? 7 : 1),
        -t * length,
      ]),
      landmarks: base.landmarks.map((l) => ({ ...l })),
    });
  }
const scenic = [
  [
    'incheon-coast',
    '인천 영종도 해안',
    '인천 · 영종대교와 바다',
    'coast',
    3700,
    75,
    3,
  ],
  ['east-coast', '동해 해안도로', '강릉 · 바다와 등대', 'coast', 3200, 80, 3],
  ['jeju-coast', '제주 애월 해안', '제주 · 해변과 섬', 'coast', 3500, 120, 4],
  [
    'hangang-riverside',
    '한강 강변 드라이브',
    '서울 · 강변 공원과 다리',
    'riverside',
    3600,
    80,
    3,
  ],
  [
    'inje-forest',
    '인제 자작나무 숲길',
    '강원 · 흰 나무와 초록 터널',
    'forest',
    2900,
    110,
    5,
  ],
  [
    'damyang-forest',
    '담양 메타세쿼이아 길',
    '전남 · 길게 이어지는 가로수',
    'forest',
    3100,
    55,
    3,
  ],
  [
    'daegwallyeong',
    '대관령 목장 드라이브',
    '강원 · 초원과 양떼 · 풍력발전기',
    'pasture',
    3300,
    125,
    5,
  ],
  [
    'namhae-coast',
    '남해 바닷길',
    '경남 · 푸른 해안과 섬',
    'coast',
    3400,
    140,
    4,
  ],
  [
    'seorak-forest',
    '설악 산자락 드라이브',
    '강원 · 굽이치는 숲과 산',
    'forest',
    3200,
    150,
    6,
  ],
  [
    'busan-coast',
    '부산 해운대 달맞이길',
    '부산 · 해안 절벽과 광안대교',
    'coast',
    3400,
    130,
    5,
  ],
] as const;
ROUTES.unshift(
  ...scenic.map(
    (
      [id, name, subtitle, theme, length, amplitude, bends],
      i,
    ): RouteConfig => ({
      id,
      name,
      subtitle,
      theme,
      featured: true,
      trafficPreset: i % 3 === 0 ? 'busy' : i % 3 === 1 ? 'works' : 'free',
      description: '드라이빙 명소의 풍경을 재해석한 가상 코스',
      district: subtitle.split(' · ')[0],
      seed: 200 + i,
      color:
        theme === 'coast'
          ? '#79d5e9'
          : theme === 'pasture'
            ? '#c4db8b'
            : '#8fcaac',
      sky: '#112734',
      difficulty: `${bends > 4 ? '노멀' : '이지'} · 자연 풍경`,
      target: length / 30,
      points: points(61, (t) => [
        Math.sin(t * Math.PI * bends) * amplitude,
        7 +
          Math.sin(t * Math.PI) *
            (theme === 'pasture' ? 35 : theme === 'forest' ? 22 : 3),
        -t * length,
      ]),
      landmarks:
        id === 'incheon-coast' || id === 'busan-coast'
          ? [
              {
                id: id + '-bridge',
                name: id === 'incheon-coast' ? '영종대교' : '광안대교',
                at: 0.55,
                side: 130,
                kind: 'bridge',
              },
            ]
          : [],
    }),
  ),
);
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
const cache = new Map<string, Course>();
export const getCourse = (id: RouteId): Course => {
  const config = ROUTES.find((r) => r.id === id) || ROUTES[0];
  if (!cache.has(config.id)) cache.set(config.id, new Course(config));
  return cache.get(config.id)!;
};
export const COURSES = ['hangang', 'namsan', 'seoul'].map((id) =>
  getCourse(id),
);
