import type { VehicleSpec } from './drivetrain';
export type BodyStyle =
  | 'sport'
  | 'coupe'
  | 'sedan'
  | 'suv'
  | 'compact'
  | 'pickup'
  | 'boxtruck'
  | 'dump'
  | 'bus';
export type Vehicle = {
  id: string;
  brand: string;
  name: string;
  style: BodyStyle;
  color: string;
  length: number;
  width: number;
  height: number;
  spec: VehicleSpec;
  detail: string;
};
const spec = (
  maxSpeed: number,
  acceleration: number,
  electric = false,
): VehicleSpec => ({
  powertrain: electric ? 'electric' : 'combustion',
  forwardGears: electric ? 1 : 7,
  maxSpeed,
  acceleration,
  reverseLimit: 28,
  regen: electric ? 17 : 0,
});
// Detailed attributed vehicle assets. Performance remains game tuning, not manufacturer specifications.
export const VEHICLES: Vehicle[] = [
  {
    id: 'ferrari',
    brand: '페라리',
    name: '458 Italia',
    style: 'sport',
    color: '#f31931',
    length: 4.6,
    width: 1.95,
    height: 1.2,
    spec: spec(320, 64),
    detail: '낮은 차체 · 날카로운 가속',
  },
  {
    id: 'porsche',
    brand: '포르쉐',
    name: '911 Carrera 4S',
    style: 'coupe',
    color: '#e4c677',
    length: 4.45,
    width: 1.88,
    height: 1.28,
    spec: spec(305, 61),
    detail: '둥근 램프 · 리어 윙',
  },
  {
    id: 'mercedes',
    brand: '벤츠',
    name: 'Maybach S-Class',
    style: 'sedan',
    color: '#c5d2da',
    length: 5.45,
    width: 1.94,
    height: 1.5,
    spec: spec(290, 56),
    detail: '긴 보닛 · 세로 그릴',
  },
  {
    id: 'audi',
    brand: '아우디',
    name: 'R8 V10 Performance',
    style: 'sport',
    color: '#507e91',
    length: 4.45,
    width: 1.9,
    height: 1.23,
    spec: spec(285, 55),
    detail: '넓은 그릴 · 직선형 LED',
  },
  {
    id: 'bmw',
    brand: 'BMW',
    name: 'M4 Competition',
    style: 'sedan',
    color: '#397fc4',
    length: 4.75,
    width: 1.88,
    height: 1.42,
    spec: spec(280, 57),
    detail: '분할 그릴 · 스포츠 범퍼',
  },
  {
    id: 'hyundai',
    brand: '제네시스',
    name: 'Genesis Coupe Custom',
    style: 'compact',
    color: '#9bd3e6',
    length: 4.25,
    width: 1.83,
    height: 1.42,
    spec: spec(250, 49),
    detail: '짧은 휠베이스 · 레드 포인트',
  },
  {
    id: 'kia',
    brand: '기아',
    name: 'Stinger GT',
    style: 'sedan',
    color: '#b2493e',
    length: 4.83,
    width: 1.89,
    height: 1.4,
    spec: spec(270, 52),
    detail: '낮은 루프 · 패스트백',
  },
  {
    id: 'tesla',
    brand: '테슬라',
    name: 'Model S',
    style: 'sedan',
    color: '#e8e9e5',
    length: 4.98,
    width: 1.9,
    height: 1.45,
    spec: spec(260, 68, true),
    detail: '전기 구동 · 원페달 감속',
  },
  {
    id: 'lincoln',
    brand: '링컨',
    name: 'Continental Mark V',
    style: 'coupe',
    color: '#243b37',
    length: 5.84,
    width: 2.06,
    height: 1.32,
    spec: spec(235, 40),
    detail: '높은 차체 · 크롬 그릴',
  },
];
export const getVehicle = (id: string) =>
  VEHICLES.find((v) => v.id === id) || VEHICLES[0];
export const PAINTS = [
  ['#f31931', '레이싱 레드'],
  ['#e8e9e5', '펄 화이트'],
  ['#c5d2da', '플래티넘 실버'],
  ['#172136', '미드나이트'],
  ['#397fc4', '퍼시픽 블루'],
  ['#9bd3e6', '아이스 블루'],
  ['#e4c677', '샴페인 골드'],
  ['#ef963c', '선셋 오렌지'],
  ['#243b37', '포레스트 그린'],
  ['#825b96', '라벤더'],
] as const;
