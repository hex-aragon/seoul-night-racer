import {
  newAssessment,
  assessDriving,
  roadSpeedLimit,
  passedDriving,
  type Indicator,
  type Assessment,
} from './driving-score';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { signalAt, type SignalPhase } from './signals';
import { getVehicle } from './vehicles';
import { prepareShowroomModel } from './showroom-model';
import { buildVehicle, TRAFFIC_BODIES } from './vehicle-model';
import type { TrafficScenario } from './traffic';
import { createHazards, sweptHazardHit, type Hazard } from './challenge';
import {
  createMotion,
  stepTraffic,
  rng,
  smoothSteering,
  type TrafficMotion,
} from './traffic';
import {
  newDrive,
  consumeFuel,
  shiftDrive,
  stepDrive,
  selectGear,
  type Selector,
  type Transmission,
} from './drivetrain';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getCourse, type Course, type RouteId } from './routes';
import { TrackWorld } from './track-world';
import { DriveAudio } from './audio';
import type { Result } from './progress';
export type Mode = 'ready' | 'racing' | 'paused' | 'finished';
export type Snapshot = {
  mode: Mode;
  speed: number;
  velocity: number;
  selector: Selector;
  transmission: Transmission;
  rpm: number;
  steering: number;
  fuel: number;
  bearing: number;
  drift: boolean;
  driftSeconds: number;
  dodged: number;
  timeLeft: number;
  checkpoints: number;
  warning: string;
  signal?: { phase: SignalPhase; distance: number; remaining: number } | null;
  throttle: boolean;
  braking: boolean;
  distance: number;
  time: number;
  nitro: number;
  health: number;
  passed: number;
  gear: number;
  boost: boolean;
  loaded: boolean;
  error: string;
  camera: number;
  route: RouteId;
  length: number;
  nearMisses: number;
  combo: number;
  score: number;
  drivingScore: number;
  speedLimit: number;
  indicator: Indicator;
  violations: { speeding: number; redLights: number; unsignalled: number };
  maxSpeed: number;
  landmarks: string[];
  notice: string;
  endReason:
    | 'finish'
    | 'traffic'
    | 'barrier'
    | 'obstacle'
    | 'timeout'
    | 'low-score'
    | '';
  offset: number;
  curve: number;
};
export const initial = (route: RouteId = 'hangang'): Snapshot => ({
  mode: 'ready',
  speed: 0,
  velocity: 0,
  selector: 'D',
  transmission: 'auto',
  rpm: 900,
  steering: 0,
  fuel: 100,
  bearing: 0,
  drift: false,
  driftSeconds: 0,
  dodged: 0,
  timeLeft: getCourse(route).length / 30 + 30,
  checkpoints: 0,
  warning: '',
  throttle: false,
  braking: false,
  distance: 0,
  time: 0,
  nitro: 100,
  health: 100,
  passed: 0,
  gear: 1,
  boost: false,
  loaded: false,
  error: '',
  camera: 0,
  route,
  length: getCourse(route).length,
  nearMisses: 0,
  combo: 1,
  score: 0,
  drivingScore: 100,
  speedLimit: roadSpeedLimit(getCourse(route), 0),
  indicator: 0,
  violations: { speeding: 0, redLights: 0, unsignalled: 0 },
  maxSpeed: 0,
  landmarks: [],
  notice: '',
  endReason: '',
  offset: 0,
  curve: 0,
});
const clamp = T.MathUtils.clamp;
const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
type Traffic = TrafficMotion & {
  mesh: T.Group;
  x: number;
  z: number;
  hit: boolean;
  passed: boolean;
  speed: number;
};
export class RaceEngine {
  state = initial();
  private assessment: Assessment = newAssessment();
  private indicatorSince = 0;
  private indicatorCancelAt = Infinity;
  private playerIndicators = new T.Group();
  toggleIndicator = (side: Indicator) => {
    if (this.state.mode !== 'racing') return;
    this.state.indicator = this.state.indicator === side ? 0 : side;
    this.indicatorSince = this.state.time;
    this.indicatorCancelAt = Infinity;
    this.update({ ...this.state });
  };
  keys = new Set<string>();
  drive = newDrive();
  peaceful = false;
  vehicleId = 'ferrari';
  private vehicleModels = new Map<string, T.Object3D>();
  private ferrariWheels: T.Object3D[] = [];
  trafficSetting: 'route' | TrafficScenario = 'route';
  get vehicle() {
    return getVehicle(this.vehicleId);
  }
  get scenario(): TrafficScenario {
    return this.trafficSetting && this.trafficSetting !== 'route'
      ? this.trafficSetting
      : this.course.config.trafficPreset || 'free';
  }
  get roadZone() {
    return {
      scenario: this.scenario,
      start: this.course.length * 0.3,
      end: this.course.length * 0.49,
      time: this.state.time,
      crossings: this.world?.street.crossings || [],
    };
  }
  setTraffic = (choice: 'route' | TrafficScenario) => {
    if (this.state.mode === 'racing' || this.trafficSetting === choice) return;
    this.trafficSetting = choice;
    this.world.dispose();
    this.world = new TrackWorld(this.course, this.scenario);
    this.scene.add(this.world.root);
    this.buildHazards();
    this.resetTraffic();
    this.configureExperience(this.daylight, this.peaceful, this.cruise);
  };
  showroomYaw = 2.45;
  showroomPitch = 0.23;
  private studio = new T.Group();
  private sunlight?: T.DirectionalLight;
  private daylightSky?: T.DataTexture;
  private daylightEnvironment?: T.WebGLRenderTarget;
  private modelLoads = new Map<string, Promise<void>>();
  private studioWasReady = false;
  orbitShowroom = (dx: number, dy: number) => {
    this.showroomYaw -= dx * 0.009;
    this.showroomPitch = T.MathUtils.clamp(
      this.showroomPitch + dy * 0.004,
      0.08,
      0.65,
    );
  };
  selectVehicle = (id: string) => {
    if (this.state.mode === 'racing') return;
    this.vehicleId = getVehicle(id).id;
    this.state.error = '';
    if (this.model) this.model.visible = this.vehicleId === 'ferrari';
    this.vehicleModels.forEach(
      (m, key) => (m.visible = key === this.vehicleId),
    );
    this.drive = newDrive();
    if (this.vehicle.spec.powertrain === 'electric') this.drive.rpm = 0;
    this.state.rpm = this.drive.rpm;
    this.state.gear = 1;
    this.state.transmission = 'auto';
    const selected = this.vehicleId;
    this.state.loaded =
      selected === 'ferrari' ? !!this.model : this.vehicleModels.has(selected);
    this.wheels = selected === 'ferrari' ? this.ferrariWheels : [];
    this.update({ ...this.state });
    if (selected === 'ferrari' && !this.state.loaded) this.loadCar();
    if (
      selected !== 'ferrari' &&
      !this.state.loaded &&
      !this.modelLoads.has(selected)
    ) {
      const task = new GLTFLoader()
        .setDRACOLoader(this.draco)
        .loadAsync(import.meta.env.BASE_URL + `models/showroom/${selected}.glb`)
        .then((gltf) => {
          if (this.disposed) {
            this.disposeObject(gltf.scene);
            return;
          }
          const group = prepareShowroomModel(gltf.scene, getVehicle(selected));
          this.vehicleModels.set(selected, group);
          this.player.add(group);
          group.visible = this.vehicleId === selected;
          this.setColor('#' + this.paint.color.getHexString());
          if (this.vehicleId === selected) {
            this.state.loaded = true;
            this.state.error = '';
            this.update({ ...this.state });
          }
        })
        .catch(() => {
          if (!this.disposed && this.vehicleId === selected) {
            this.state.loaded = false;
            this.state.error =
              '모델을 불러오지 못했습니다. 다시 시도해 주세요.';
            this.update({ ...this.state });
          }
        })
        .finally(() => this.modelLoads.delete(selected));
      this.modelLoads.set(selected, task);
    }
  };
  private lateralVelocity = 0;
  private hazards: Hazard[] = [];
  private hazardRoot = new T.Group();
  private hazardMeshes: T.Group[] = [];
  cruise = false;
  daylight = true;
  configureExperience = (
    daylight: boolean,
    peaceful: boolean,
    cruise: boolean,
  ) => {
    this.daylight = daylight;
    this.peaceful = peaceful;
    this.cruise = cruise;
    const sky = daylight ? '#a2c9dc' : this.course.config.sky;
    this.scene.background =
      daylight && this.daylightSky ? this.daylightSky : new T.Color(sky);
    this.scene.environment =
      daylight && this.daylightEnvironment
        ? this.daylightEnvironment.texture
        : this.environment.texture;
    this.scene.backgroundIntensity = 0.6;
    this.scene.fog = new T.FogExp2(sky, daylight ? 0.0015 : 0.0032);
    this.scene.environmentIntensity = daylight ? 0.4 : 0.42;
    this.scene.children.forEach((o) => {
      if (o instanceof T.HemisphereLight) {
        o.color.set(daylight ? '#e9f4ff' : '#afcaff');
        o.groundColor.set(daylight ? '#7a8e75' : '#273349');
        o.intensity = daylight ? 1.5 : 1.1;
      }
      if (o instanceof T.DirectionalLight) {
        o.color.set(daylight ? '#fff2d6' : '#b4ccff');
        o.intensity = daylight ? 1.2 : 1;
      }
    });
    this.world.setDaylight(daylight);
    this.hazardRoot.visible = !peaceful;
  };
  steeringInput = 0;
  private furthest = 0;
  setTransmission = (mode: Transmission) => {
    this.drive.transmission =
      this.vehicle.spec.powertrain === 'electric' ? 'auto' : mode;
    this.state.transmission = this.drive.transmission;
  };
  selectGear = (selector: Selector) => {
    if (!selectGear(this.drive, selector)) {
      this.state.notice = '브레이크로 정지한 뒤 기어를 바꾸세요';
      this.noticeUntil = this.state.time + 3;
    }
    this.state.selector = this.drive.selector;
    this.update({ ...this.state });
  };
  shift = (delta: number) => {
    if (this.vehicle.spec.powertrain === 'electric') {
      this.state.notice = '전기차 · 단일 감속기 D / R';
      this.noticeUntil = this.state.time + 2;
      return;
    }
    if (!shiftDrive(this.drive, delta, this.vehicle.spec)) {
      this.state.notice = '속도를 낮춘 뒤 저단으로 변속하세요';
      this.noticeUntil = this.state.time + 2;
      return;
    }
    this.state.gear = this.drive.gear;
    this.state.notice = `${this.drive.transmission === 'auto' ? 'AT 패들' : 'MT'} · ${this.drive.gear}단`;
    this.noticeUntil = this.state.time + 1.5;
    this.update({ ...this.state });
  };
  audio = new DriveAudio();
  course: Course = getCourse('hangang');
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(58, 1, 0.1, 1200);
  private composer: EffectComposer;
  private resizeObserver: ResizeObserver;
  private world: TrackWorld;
  private player = new T.Group();
  private wheels: T.Object3D[] = [];
  private paint = new T.MeshPhysicalMaterial({
    color: 0xf31931,
    metalness: 0.45,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  private traffic: Traffic[] = [];
  private trafficRandom = rng(Math.floor(Math.random() * 2147483647));
  private model?: T.Object3D;
  private flames: T.Mesh[] = [];
  private headlights: T.SpotLight[] = [];
  private materials = new Map<string, T.MeshStandardMaterial>();
  private draco = new DRACOLoader();
  private disposed = false;
  private frame = 0;
  private last = 0;
  private ui = 0;
  private x = 0;
  private steer = 0;
  private hit = 0;
  private noticeUntil = 0;
  private environment: T.WebGLRenderTarget;
  private speedLines: T.LineSegments;
  private lineData: Float32Array;
  constructor(
    private canvas: HTMLCanvasElement,
    private update: (s: Snapshot) => void,
    private onEnd: (r: Result) => void,
    route: RouteId = 'hangang',
  ) {
    this.course = getCourse(route);
    this.state = initial(route);
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.scene.background = new T.Color(this.course.config.sky);
    this.scene.fog = new T.FogExp2(this.course.config.sky, 0.0032);
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();
    room.dispose();
    new RGBELoader().load(
      import.meta.env.BASE_URL + 'textures/daylight.hdr',
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.mapping = T.EquirectangularReflectionMapping;
        this.daylightSky = texture;
        const generator = new T.PMREMGenerator(this.renderer);
        this.daylightEnvironment = generator.fromEquirectangular(texture);
        generator.dispose();
        if (this.state.mode !== 'ready')
          this.configureExperience(this.daylight, this.peaceful, this.cruise);
      },
      undefined,
      () => {},
    );
    this.scene.add(new T.HemisphereLight('#afcaff', '#273349', 1.1));
    const moon = new T.DirectionalLight('#b4ccff', 1.5);
    moon.position.set(-30, 70, -80);
    this.sunlight = moon;
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, {
      left: -32,
      right: 32,
      top: 32,
      bottom: -32,
      near: 1,
      far: 160,
    });
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.025;
    this.scene.add(moon, moon.target);
    const pink = new T.DirectionalLight('#ffa3b9', 0.6);
    pink.position.set(35, 15, 20);
    this.scene.add(pink);
    this.scene.add(this.player);
    for (const side of [-1, 1])
      for (const z of [-0.43, 0.43]) {
        const lamp = new T.Mesh(
          new T.BoxGeometry(0.07, 0.04, 0.025),
          new T.MeshStandardMaterial({
            color: '#ffae15',
            emissive: '#ff8500',
            emissiveIntensity: 3,
          }),
        );
        lamp.position.set(side * 0.49, 0.48, z);
        lamp.userData.side = side;
        this.playerIndicators.add(lamp);
      }
    this.player.add(this.playerIndicators);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    const floor = new T.Mesh(
      new T.CircleGeometry(120, 96),
      new T.MeshStandardMaterial({
        color: '#d6dfe6',
        roughness: 0.55,
        metalness: 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    floor.receiveShadow = true;
    this.studio.add(floor);
    const key = new T.SpotLight('#ffffff', 22, 35, Math.PI / 3, 0.6, 1);
    key.position.set(-4, 8, -3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.00015;
    this.studio.add(key, key.target);
    const fill = new T.DirectionalLight('#dae9ff', 1.4);
    fill.position.set(5, 4, 4);
    this.studio.add(fill);
    this.scene.add(this.studio);
    this.world = new TrackWorld(this.course, this.scenario);
    this.scene.add(this.world.root);
    this.scene.add(this.hazardRoot);
    this.buildHazards();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new T.Vector2(1, 1), 0.3, 0.3, 1.5),
    );
    this.composer.addPass(new OutputPass());
    this.lineData = new Float32Array(60 * 6);
    this.speedLines = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: '#a6dfff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.speedLines.geometry.setAttribute(
      'position',
      new T.BufferAttribute(this.lineData, 3),
    );
    this.scene.add(this.speedLines);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.snapCamera();
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.draco.setDecoderPath(import.meta.env.BASE_URL + 'draco/');
    this.draco.setWorkerLimit(2);
    this.loadCar();
    this.frame = requestAnimationFrame(this.tick);
  }
  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(width, height);
  }
  private material(
    color: T.ColorRepresentation,
    emissive?: T.ColorRepresentation,
  ) {
    const key = String(color) + String(emissive);
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new T.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.18,
        ...(emissive ? { emissive, emissiveIntensity: 1.3 } : {}),
      });
      this.materials.set(key, mat);
    }
    return mat;
  }
  private box(
    parent: T.Object3D,
    size: number[],
    position: number[],
    material: T.Material,
  ) {
    const m = new T.Mesh(
      new T.BoxGeometry(...(size as [number, number, number])),
      material,
    );
    m.position.set(...(position as [number, number, number]));
    parent.add(m);
    return m;
  }
  private ferrariLoading = false;
  private loadCar() {
    if (this.ferrariLoading || this.model) return;
    this.ferrariLoading = true;
    new GLTFLoader().setDRACOLoader(this.draco).load(
      import.meta.env.BASE_URL + 'models/ferrari.glb',
      (gltf) => {
        if (this.disposed) {
          this.disposeObject(gltf.scene);
          return;
        }
        this.ferrariLoading = false;
        const model = gltf.scene;
        model.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.frustumCulled = true;
            o.castShadow = true;
            const n = o.name;
            if (n === 'body') o.material = this.paint;
            else if (n === 'glass')
              o.material = new T.MeshPhysicalMaterial({
                color: '#152332',
                metalness: 0.25,
                roughness: 0.07,
                transparent: true,
                opacity: 0.88,
                clearcoat: 1,
              });
            else if (n === 'lights_red')
              o.material = new T.MeshStandardMaterial({
                color: '#ff172a',
                emissive: '#ff1020',
                emissiveIntensity: 2,
              });
            else if (n === 'lights' || n === 'leds')
              o.material = new T.MeshStandardMaterial({
                color: '#f0f7ff',
                emissive: '#d9efff',
                emissiveIntensity: 1.8,
              });
          }
        });
        const bounds = new T.Box3().setFromObject(model),
          size = bounds.getSize(new T.Vector3());
        const scale = 4.6 / size.z;
        model.scale.setScalar(scale);
        bounds.setFromObject(model);
        model.position.y = -bounds.min.y + 0.04;
        model.position.x = -(bounds.min.x + bounds.max.x) / 2;
        model.position.z = -(bounds.min.z + bounds.max.z) / 2;
        this.model = model;
        this.player.add(model);
        this.wheels = [];
        ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach((n) => {
          const wheel = model.getObjectByName(n);
          if (wheel) this.wheels.push(wheel);
        });
        this.ferrariWheels = [...this.wheels];
        const savedTransmission = this.drive.transmission;
        this.selectVehicle(this.vehicleId);
        this.setTransmission(savedTransmission);
        const shadow = new T.Mesh(
          new T.PlaneGeometry(3.4, 6),
          new T.MeshBasicMaterial({
            map: new T.TextureLoader().load(
              import.meta.env.BASE_URL + 'models/ferrari_ao.png',
            ),
            transparent: true,
            depthWrite: false,
            premultipliedAlpha: true,
            toneMapped: false,
            blending: T.MultiplyBlending,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.025;
        this.player.add(shadow);
        for (const x of [-0.7, 0.7]) {
          const head = new T.SpotLight('#c0dcff', 45, 65, 0.3, 0.6, 1.2);
          head.position.set(x, 0.6, -1.9);
          head.target.position.set(x, 0.05, -35);
          this.player.add(head, head.target);
          this.headlights.push(head);
          const flame = new T.Mesh(
            new T.ConeGeometry(0.12, 0.9, 10),
            new T.MeshBasicMaterial({
              color: '#5fecff',
              transparent: true,
              opacity: 0.9,
            }),
          );
          flame.rotation.x = Math.PI / 2;
          flame.position.set(x, 0.32, 2.6);
          this.player.add(flame);
          this.flames.push(flame);
        }
        const under = new T.PointLight('#ff2046', 0.5, 5, 2);
        under.position.set(0, 0.4, 2);
        this.player.add(under);
        this.buildTraffic();
        this.state.loaded =
          this.vehicleId === 'ferrari' ||
          this.vehicleModels.has(this.vehicleId);
        this.update({ ...this.state });
      },
      undefined,
      () => {
        this.ferrariLoading = false;
        if (!this.disposed && this.vehicleId === 'ferrari') {
          this.state.error =
            '차량을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
          this.update({ ...this.state });
        }
      },
    );
  }
  selectRoute = (route: RouteId) => {
    if (this.state.mode === 'racing') return;
    const loaded = this.state.loaded,
      error = this.state.error;
    this.course = getCourse(route);
    this.world.dispose();
    this.world = new TrackWorld(this.course, this.scenario);
    this.scene.add(this.world.root);
    this.buildHazards();
    this.scene.background = new T.Color(this.course.config.sky);
    this.scene.fog = new T.FogExp2(this.course.config.sky, 0.0032);
    this.state = { ...initial(route), loaded, error };
    this.configureExperience(this.daylight, this.peaceful, this.cruise);
    this.x = 0;
    this.steer = 0;
    this.resetTraffic();
    this.snapCamera();
    this.update({ ...this.state });
  };
  private buildTraffic() {
    for (let i = 0; i < 16; i++) {
      const motion = createMotion(i, this.trafficRandom);
      const body = TRAFFIC_BODIES[motion.body || 0];
      const mesh =
        motion.kind === 'motorcycle'
          ? this.motorcycle()
          : buildVehicle(
              { id: 'traffic-' + i, ...body },
              this.material(body.color),
            );
      const car: Traffic = {
        ...motion,
        length: motion.kind === 'motorcycle' ? 2.2 : body.length,
        width: motion.kind === 'motorcycle' ? 0.7 : body.width,
        mesh,
        hit: false,
        passed: false,
      };
      this.scene.add(mesh);
      this.traffic.push(car);
      this.addSignals(car);
    }
    this.resetTraffic();
  }
  private motorcycle() {
    const g = new T.Group(),
      black = this.material('#17252d'),
      paint = this.material('#d78939'),
      rider = this.material('#354b61');
    for (const z of [-0.82, 0.82]) {
      const wheel = new T.Mesh(
        new T.CylinderGeometry(0.36, 0.36, 0.2, 14),
        black,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.37, z);
      g.add(wheel);
      this.box(g, [0.09, 0.55, 0.12], [0, 0.67, z], this.material('#b7c6cf'));
    }
    this.box(g, [0.46, 0.35, 1.2], [0, 0.85, 0], paint);
    this.box(g, [0.4, 0.15, 0.6], [0, 1.08, 0.2], black);
    this.box(g, [0.48, 0.64, 0.32], [0, 1.4, 0.05], rider);
    this.box(g, [0.85, 0.09, 0.1], [0, 1.2, -0.62], black);
    for (const x of [-0.27, 0.27]) {
      this.box(g, [0.15, 0.65, 0.18], [x, 0.84, 0.25], black);
      const arm = this.box(g, [0.13, 0.5, 0.13], [x, 1.35, -0.3], rider);
      arm.rotation.x = -0.65;
    }
    const helmet = new T.Mesh(
      new T.SphereGeometry(0.25, 12, 10),
      this.material('#e1e6dc'),
    );
    helmet.position.set(0, 1.95, -0.12);
    g.add(helmet);
    this.box(g, [0.29, 0.1, 0.08], [0, 1.98, -0.34], black);
    this.box(
      g,
      [0.2, 0.13, 0.06],
      [0, 0.85, -1.05],
      this.material('#eaffff', '#eaffff'),
    );
    this.box(
      g,
      [0.22, 0.12, 0.05],
      [0, 0.85, 1.05],
      this.material('#ff3434', '#ff3434'),
    );
    return g;
  }
  private addSignals(car: Traffic) {
    const nodes: T.Mesh[] = [];
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        const lamp = this.box(
          car.mesh,
          [car.kind === 'motorcycle' ? 0.13 : 0.24, 0.13, 0.08],
          [
            side * ((car.width || 1.85) * 0.43),
            0.72,
            end * ((car.length || 4.6) / 2 + 0.04),
          ],
          this.material('#ffab24', '#ff9d00'),
        );
        lamp.userData.side = side;
        lamp.visible = false;
        nodes.push(lamp);
      }
    car.mesh.userData.signals = nodes;
  }
  private buildHazards() {
    this.hazardRoot.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
    this.hazardRoot.clear();
    this.hazardMeshes = [];
    this.hazards = createHazards(
      this.course.length,
      Math.floor(Math.random() * 100000),
    );
    if (this.scenario === 'works') {
      const zone = this.roadZone;
      this.hazards = this.hazards.filter(
        (h) => h.z < zone.start - 120 || h.z > zone.end + 80,
      );
      for (let z = zone.start; z < zone.end; z += 28)
        this.hazards.push({
          id: 10000 + z,
          z,
          x: 8,
          kind: 'cones',
          hit: false,
          passed: false,
        });
    }
    this.hazards = this.hazards.filter(
      (h) =>
        !(this.world?.street.crossings || []).some(
          (c) => Math.abs(c.z - h.z) < 75,
        ),
    );
    for (const hazard of this.hazards) {
      const g = new T.Group();
      const f = this.course.sample(hazard.z, hazard.x);
      g.position.copy(f.position);
      g.rotation.set(f.pitch, f.heading, 0, 'YXZ');
      if (hazard.kind === 'cones') {
        for (const x of [-0.7, 0.7]) {
          this.box(
            g,
            [0.65, 0.12, 0.65],
            [x, 0.06, 0],
            this.material('#282f33'),
          );
          const cone = new T.Mesh(
            new T.ConeGeometry(0.3, 0.9, 10),
            this.material('#f38a35'),
          );
          cone.position.set(x, 0.55, 0);
          g.add(cone);
          this.box(
            g,
            [0.35, 0.14, 0.35],
            [x, 0.57, 0],
            this.material('#f6efd7'),
          );
        }
      } else {
        this.box(g, [3, 1.05, 0.6], [0, 0.53, 0], this.material('#ea6545'));
        for (const x of [-1, 0, 1])
          this.box(
            g,
            [0.45, 0.65, 0.65],
            [x, 0.64, 0],
            this.material('#f7ebcb'),
          );
        for (const x of [-1, 1])
          this.box(g, [0.25, 0.35, 1], [x, 0.17, 0], this.material('#354347'));
      }
      const lamp = new T.Mesh(
        new T.SphereGeometry(0.1, 8, 6),
        this.material('#ffb236', '#ffb236'),
      );
      lamp.position.set(0, 1.25, 0);
      g.add(lamp);
      this.hazardRoot.add(g);
      this.hazardMeshes.push(g);
    }
    this.hazardRoot.visible = !this.peaceful;
  }
  private resetTraffic() {
    this.trafficRandom = rng(Math.floor(Math.random() * 2147483647));
    this.traffic.forEach((c, i) => {
      Object.assign(c, createMotion(i, this.trafficRandom));
      if (this.scenario === 'busy' && i >= 4) {
        c.z = this.roadZone.start - 65 + Math.floor((i - 4) / 3) * 22;
        c.x = [-4, 0, 4][(i - 4) % 3];
        c.fromX = c.targetX = c.x;
        c.merge = false;
        c.speed = 7;
        c.nextEvent = 100;
      } else if (c.kind !== 'motorcycle')
        c.speed = Math.min(c.speed, (c.length || 4.6) > 6 ? 18 : 28);
      c.actualSpeed = undefined;
      c.hit = false;
      c.passed = false;
    });
  }
  previewCrossing = () => {
    if (!import.meta.env.DEV) return;
    this.start();
    const c = this.world.street.crossings[0];
    if (c) {
      this.state.distance = c.stop - 32;
      this.state.time = 7;
      this.state.camera = 0;
      this.cruise = false;
      this.drive.velocity = 0;
    }
  };
  start = () => {
    if (!this.state.loaded || this.state.error) return;
    const { route } = this.state;
    this.assessment = newAssessment();
    this.indicatorSince = 0;
    this.indicatorCancelAt = Infinity;
    const transmission = this.drive.transmission;
    this.drive = { ...newDrive(), transmission };
    this.furthest = 0;
    this.lateralVelocity = 0;
    this.buildHazards();
    this.state = {
      ...initial(route),
      loaded: true,
      mode: 'racing',
      camera: 0,
      transmission,
      distance: 20,
      timeLeft:
        (this.course.length / (roadSpeedLimit(this.course, 0) / 3.6)) * 1.6 +
        60 +
        this.world.street.crossings.length * 11 +
        (this.scenario === 'busy' ? 45 : this.scenario === 'works' ? 25 : 0),
    };
    this.x = 0;
    this.steer = 0;
    this.hit = 0;
    this.keys.clear();
    this.steeringInput = 0;
    this.resetTraffic();
    this.snapCamera();
    this.update({ ...this.state });
    void this.audio.unlock().catch(() => {});
  };
  garage = () => {
    const { route, loaded, error } = this.state;
    this.state = { ...initial(route), loaded, error };
    this.x = 0;
    this.steer = 0;
    this.keys.clear();
    this.steeringInput = 0;
    this.resetTraffic();
    this.snapCamera();
    this.update({ ...this.state });
  };
  pause = () => {
    if (this.state.mode === 'racing') this.state.mode = 'paused';
    else if (this.state.mode === 'paused') this.state.mode = 'racing';
    this.keys.clear();
    this.steeringInput = 0;
    this.update({ ...this.state });
  };
  setColor = (color: string) => {
    this.paint.color.set(color);
    this.vehicleModels.forEach((model) =>
      model.traverse((o) => {
        if (o instanceof T.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats)
            if (m.userData.coachwork && m instanceof T.MeshStandardMaterial)
              m.color.set(color);
        }
      }),
    );
  };
  setCamera = (camera: number) => {
    this.state.camera = camera === 1 ? 1 : 0;
    this.snapCamera();
    this.update({ ...this.state });
  };
  changeCamera = () => this.setCamera((this.state.camera + 1) % 2);
  refuel = () => {
    if (this.state.speed > 1) return false;
    this.state.fuel = 100;
    this.state.rpm = this.vehicle.spec.powertrain === 'electric' ? 0 : 900;
    this.drive.rpm = this.state.rpm;
    this.update({ ...this.state });
    return true;
  };
  private snapCamera() {
    const f = this.course.sample(this.state.distance, this.x);
    this.camera.position
      .copy(f.position)
      .addScaledVector(f.tangent, this.state.camera ? 1.6 : -12);
    this.camera.position.y += this.state.camera ? 1.35 : 4.6;
  }
  private keydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
    }
    if (
      e.target instanceof HTMLElement &&
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)
    )
      return;
    if (e.target instanceof HTMLButtonElement && ['Enter', ' '].includes(e.key))
      return;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
    )
      e.preventDefault();
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (e.repeat) return;
    if (
      k === 'enter' &&
      (this.state.mode === 'ready' || this.state.mode === 'finished')
    )
      this.start();
    if (k === 'p' || k === 'escape') this.pause();
    if (k === 'c') this.changeCamera();
    if (k === 'z') this.toggleIndicator(-1);
    if (k === 'x') this.toggleIndicator(1);
    if (k === 'e') this.shift(1);
    if (k === 'q') this.shift(-1);
  };
  private keyup = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private blur = () => {
    this.keys.clear();
    this.steeringInput = 0;
    if (this.state.mode === 'racing') this.pause();
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  private finish(reason: Snapshot['endReason']) {
    if (this.state.mode !== 'racing') return;
    const s = this.state;
    s.mode = 'finished';
    if (reason === 'finish' && !passedDriving(s.drivingScore))
      reason = 'low-score';
    s.endReason = reason;
    s.speed = 0;
    s.boost = false;
    if (reason !== 'finish' && reason !== 'timeout' && reason !== 'low-score') {
      s.health = 0;
      this.hit = 1;
      this.audio.crash();
    }
    this.keys.clear();
    this.steeringInput = 0;
    this.onEnd({
      route: s.route,
      completed: reason === 'finish' && passedDriving(s.drivingScore),
      drivingScore: s.drivingScore,
      distance: Math.max(s.distance, this.furthest),
      time: s.time,
      passed: this.peaceful ? 0 : s.passed,
      nearMisses: this.peaceful ? 0 : s.nearMisses,
      maxSpeed: s.maxSpeed,
      skillXP: s.dodged * 15 + Math.floor(s.driftSeconds * 3),
      landmarks: [...s.landmarks],
    });
    this.update({ ...s });
  }
  private simulate(dt: number) {
    const s = this.state,
      k = this.keys;
    if (s.mode !== 'racing') return;
    s.time += dt;
    const gas =
        s.fuel > 0 &&
        (k.has('w') ||
          k.has('arrowup') ||
          (this.cruise &&
            this.drive.selector === 'D' &&
            Math.abs(this.drive.velocity) < (this.peaceful ? 68 : 110))),
      brake = k.has('s') || k.has('arrowdown');
    s.throttle = gas;
    s.braking = brake;
    s.fuel = consumeFuel(s.fuel, s.speed, gas && !brake, dt);
    if (this.vehicle.spec.powertrain === 'electric' && !gas && s.speed > 5)
      s.fuel = Math.min(100, s.fuel + dt * 0.035);
    s.boost = false;
    stepDrive(this.drive, gas, brake, dt, this.vehicle.spec);

    s.speed = Math.abs(this.drive.velocity);
    s.velocity = this.drive.velocity;
    s.gear = this.drive.gear;
    s.selector = this.drive.selector;
    s.transmission = this.drive.transmission;
    s.rpm = s.fuel > 0 ? this.drive.rpm : 0;
    s.maxSpeed = Math.max(s.maxSpeed, s.speed);
    const input =
      this.steeringInput +
      (k.has('d') || k.has('arrowright') ? 1 : 0) -
      (k.has('a') || k.has('arrowleft') ? 1 : 0);
    this.steer = smoothSteering(this.steer, clamp(input, -1, 1), s.speed, dt);
    const curve = this.course.curvature(s.distance);
    s.drift =
      !this.peaceful &&
      (k.has(' ') || (brake && s.speed > 80)) &&
      s.speed > 60 &&
      Math.abs(this.steer) > 0.18;
    if (s.drift) {
      this.drive.velocity *= Math.exp(-0.18 * dt);
      s.driftSeconds += dt;
      s.score += Math.round(70 * dt);
    }
    const lateralTarget =
      this.steer *
        (s.speed > 0 ? (2 + s.speed * 0.032) * Math.sign(s.velocity) : 0) -
      curve * (s.speed / 3.6) ** 2 * (this.peaceful ? 0.006 : 0.035);
    this.lateralVelocity = T.MathUtils.damp(
      this.lateralVelocity || 0,
      lateralTarget,
      s.drift ? 3.5 : 11,
      dt,
    );
    this.x += this.lateralVelocity * dt;
    if (this.peaceful && Math.abs(this.x) > 9.3 && Math.abs(input) < 0.02)
      this.x = T.MathUtils.damp(this.x, Math.sign(this.x) * 9, 1, dt);
    s.steering = this.steer;
    s.offset = this.x;
    s.curve = curve;
    s.bearing =
      (360 - (this.course.sample(s.distance).heading * 180) / Math.PI) % 360;
    if (Math.abs(this.x) > 10.2 && s.speed > 15) {
      this.x = clamp(this.x, -10.2, 10.2);
      if (this.peaceful) {
        this.drive.velocity *= 0.75;
        this.x = clamp(this.x, -9.7, 9.7);
      } else {
        this.finish('barrier');
        return;
      }
    }
    const previousDistance = s.distance;
    s.distance = clamp(
      s.distance + (s.velocity / 3.6) * dt,
      0,
      this.course.length,
    );
    if (s.distance === 0 && s.velocity < 0) {
      this.drive.velocity = 0;
      s.velocity = 0;
      s.speed = 0;
    }
    this.assessment ??= newAssessment();
    s.speedLimit = roadSpeedLimit(
      this.course,
      s.distance,
      this.scenario === 'works',
    );
    const changed = assessDriving(this.assessment, {
      dt,
      time: s.time,
      previousDistance,
      distance: s.distance,
      x: this.x,
      speed: s.speed,
      limit: s.speedLimit,
      length: this.vehicle.length,
      indicator: s.indicator,
      indicatorAge: s.time - (this.indicatorSince || 0),
      crossings: this.world?.street.crossings || [],
    });
    if (changed && s.indicator === changed)
      this.indicatorCancelAt = s.time + 1.2;
    if (s.time >= this.indicatorCancelAt) {
      s.indicator = 0;
      this.indicatorCancelAt = Infinity;
    }
    s.drivingScore = this.assessment.score;
    s.violations = {
      speeding: this.assessment.speeding,
      redLights: this.assessment.redLights,
      unsignalled: this.assessment.unsignalled,
    };
    if (this.assessment.lastDeduction) {
      s.notice = this.assessment.lastDeduction;
      this.noticeUntil = s.time + 2.5;
    }
    this.furthest = Math.max(this.furthest, s.distance);
    s.warning = '';
    const nextSignal = (this.world?.street.crossings || []).find(
      (c) =>
        c.stop >= s.distance - this.vehicle.length / 2 &&
        c.stop - s.distance < 170,
    );
    s.signal = nextSignal
      ? {
          ...signalAt(nextSignal, s.time),
          distance: Math.max(
            0,
            Math.round(nextSignal.stop - s.distance - this.vehicle.length / 2),
          ),
        }
      : null;
    if (!this.peaceful) {
      if (
        !(
          s.signal &&
          s.signal.phase !== 'green' &&
          s.signal.distance < 22 &&
          s.speed < 2
        )
      )
        s.timeLeft -= dt;
      if (
        s.distance > (this.course.length * (s.checkpoints + 1)) / 4 &&
        s.checkpoints < 3
      ) {
        s.checkpoints++;
        s.timeLeft += 5;
        s.notice = '체크포인트 +5초';
        this.noticeUntil = s.time + 2;
      }
      const futureCurve = this.course.curvature(s.distance + 85);
      if (Math.abs(futureCurve) > 0.0025)
        s.warning =
          futureCurve > 0 ? '우측 급커브 · 감속' : '좌측 급커브 · 감속';
      for (let i = 0; i < (this.hazards || []).length; i++) {
        const h = this.hazards[i];
        if (h.hit) continue;
        if (h.z > s.distance && h.z - s.distance < 160)
          s.warning = `${h.x < -2 ? '왼쪽' : h.x > 2 ? '오른쪽' : '중앙'} 차로 장애물 · ${Math.round(h.z - s.distance)}m`;
        if (sweptHazardHit(h, previousDistance, s.distance, this.x)) {
          h.hit = true;
          this.hazardMeshes[i].visible = false;
          s.combo = 1;
          if (h.kind === 'barrier') {
            this.finish('obstacle');
            return;
          }
          s.health = Math.max(0, s.health - 20);
          this.drive.velocity *= 0.65;
          this.hit = 0.25;
          this.audio.crash();
          s.notice = '콘 접촉 · 감속';
          this.noticeUntil = s.time + 1.5;
        } else if (!h.passed && s.distance > h.z + 5) {
          h.passed = true;
          s.dodged++;
          s.combo = Math.min(5, s.combo + 1);
          s.score += 150 * s.combo;
          s.timeLeft += 1;
        }
      }
      if (s.timeLeft <= 0) {
        this.finish('timeout');
        return;
      }
    }

    for (const car of this.traffic) {
      const old = car.z - s.distance;
      if (car.kind)
        stepTraffic(
          car,
          dt,
          this.traffic,
          { z: s.distance, x: this.x, speed: s.speed / 3.6 },
          this.trafficRandom,
          this.roadZone,
        );
      else car.z += car.speed * dt;
      const delta = car.z - s.distance;
      if (
        !car.hit &&
        Math.min(old, delta) <
          ((car.length || 4.6) + this.vehicle.length) / 2 - 0.25 &&
        Math.max(old, delta) >
          -((car.length || 4.6) + this.vehicle.length) / 2 + 0.25 &&
        Math.abs(car.x - this.x) <
          ((car.width || 1.85) + this.vehicle.width) / 2 - 0.08
      ) {
        car.hit = true;
        if (this.peaceful) {
          this.drive.velocity = Math.min(this.drive.velocity, car.speed * 3.6);
          car.z = s.distance + 12;
        } else {
          this.finish('traffic');
          return;
        }
      }
      if (!car.passed && delta < -5 && s.velocity > 0) {
        car.passed = true;
        s.passed++;
        const gap = Math.abs(car.x - this.x);
        if (gap < 3.2) {
          s.nearMisses++;
          s.combo = Math.min(5, s.combo + 1);
          s.score += 150 * s.combo;
          s.notice = `NEAR MISS  ×${s.combo}`;
          this.noticeUntil = s.time + 2.2;
        } else {
          s.score += 50;
          s.combo = 1;
        }
      }
      if (
        this.peaceful &&
        delta > 0 &&
        delta < 35 &&
        Math.abs(car.x - this.x) < 2.5
      )
        this.drive.velocity = Math.min(this.drive.velocity, car.speed * 3.6);
      if (delta < -180 || delta > 1350) {
        if (car.kind) {
          const fresh = createMotion(
            this.traffic.indexOf(car),
            this.trafficRandom,
          );
          fresh.z = fresh.merge
            ? Math.ceil((s.distance + 650 - 180) / 500) * 500 + 180
            : fresh.kind === 'motorcycle'
              ? s.distance - 160
              : s.distance + 680 + this.trafficRandom() * 100;
          Object.assign(car, fresh);
        } else {
          car.z = s.distance + 680;
        }
        car.hit = false;
        car.passed = false;
      }
    }
    for (const landmark of this.course.config.landmarks) {
      if (
        Math.abs(s.distance - landmark.at * this.course.length) < 75 &&
        !s.landmarks.includes(landmark.id)
      ) {
        s.landmarks = [...s.landmarks, landmark.id];
        s.score += 300;
        s.notice = `${landmark.name}  +300`;
        this.noticeUntil = s.time + 3;
      }
    }
    const zone = this.roadZone;
    if (
      this.scenario !== 'free' &&
      s.distance > zone.start - 220 &&
      s.distance < zone.end
    )
      s.warning =
        this.scenario === 'works'
          ? '전방 도로 공사 · 오른쪽 차로 폐쇄'
          : '정체 구간 · 앞차 감속 주의';
    if (s.time > this.noticeUntil) s.notice = '';
    if (s.distance >= this.course.length) this.finish('finish');
  }
  private tick = (t: number) => {
    if (this.disposed) return;
    const dt = Math.min((t - this.last) / 1000 || 0, 0.2);
    this.last = t;
    for (let left = dt; left > 0; left -= 0.025)
      this.simulate(Math.min(left, 0.025));
    const s = this.state;
    const ready = s.mode === 'ready';
    this.studio.visible = ready;
    this.world.root.visible = !ready;
    this.hazardRoot.visible = !ready && !this.peaceful;
    if (ready) {
      this.scene.background = new T.Color('#d6dfe6');
      this.scene.environment = this.environment.texture;
      if (this.scene.fog instanceof T.FogExp2) {
        this.scene.fog.color.set('#d6dfe6');
        this.scene.fog.density = 0.009;
      }
      this.scene.environmentIntensity = 0.8;
    } else if (this.studioWasReady)
      this.configureExperience(this.daylight, this.peaceful, this.cruise);
    this.studioWasReady = ready;
    this.hit = Math.max(0, this.hit - dt);
    if (s.mode !== 'racing') s.boost = false;
    const f = ready
      ? {
          position: new T.Vector3(),
          tangent: new T.Vector3(0, 0, -1),
          right: new T.Vector3(1, 0, 0),
          pitch: 0,
          heading: 0,
        }
      : this.course.sample(s.distance, this.x);
    if (this.sunlight) {
      this.sunlight.castShadow = !ready && this.daylight;
      this.sunlight.position.copy(f.position).add(new T.Vector3(-30, 60, -25));
      this.sunlight.target.position.copy(f.position);
    }
    this.player.position.copy(f.position);
    this.player.position.y += 0.025;
    this.player.rotation.set(
      f.pitch,
      f.heading - this.steer * (s.drift ? 0.38 : 0.1) * (s.speed / 150),
      -this.steer * (s.drift ? 0.09 : 0.025),
      'YXZ',
    );
    this.traffic.forEach((c) => {
      const p = this.course.sample(c.z, c.x);
      c.mesh.position.copy(p.position);
      const turning =
        c.phase === 'change'
          ? Math.sin(
              Math.PI *
                Math.min(1, c.elapsed / (c.kind === 'motorcycle' ? 2.5 : 3.8)),
            ) * c.signal
          : 0;
      c.mesh.rotation.set(
        p.pitch,
        p.heading - turning * 0.13,
        c.kind === 'motorcycle' ? -turning * 0.18 : 0,
        'YXZ',
      );
      for (const lamp of (c.mesh.userData.signals || []) as T.Mesh[])
        lamp.visible =
          c.signal !== 0 &&
          lamp.userData.side === c.signal &&
          Math.floor(s.time * 2.5) % 2 === 0;
      if (c.mesh.userData.brakeMaterial)
        c.mesh.userData.brakeMaterial.emissiveIntensity =
          (c.actualSpeed ?? c.speed) < c.speed - 1 ? 5 : 1.4;
      for (const w of (c.mesh.userData.wheels || []) as T.Object3D[])
        if (s.mode === 'racing')
          w.rotation.x -= ((c.actualSpeed ?? c.speed) * dt) / 0.4;
      c.mesh.visible =
        !ready && c.z - s.distance < 700 && c.z - s.distance > -125;
    });
    this.wheels.forEach((w) => {
      if (s.mode === 'racing') w.rotation.x -= ((s.velocity / 3.6) * dt) / 0.34;
    });
    this.flames.forEach((flame) => {
      flame.visible = s.boost;
      flame.scale.y = 1 + Math.sin(t * 0.08) * 0.25;
    });
    this.playerIndicators.scale.set(
      this.vehicle.width,
      this.vehicle.height,
      this.vehicle.length,
    );
    this.playerIndicators.children.forEach(
      (l) =>
        (l.visible =
          s.mode === 'racing' &&
          s.indicator === l.userData.side &&
          Math.floor(s.time * 2.5) % 2 === 0),
    );
    this.world.animate(t, s.time, s.distance);
    const hood = s.camera === 1 && !ready,
      narrow = this.camera.aspect < 0.8;
    this.player.visible = !hood;
    const desired = f.position
      .clone()
      .addScaledVector(
        f.tangent,
        ready
          ? -(narrow ? 11 : 7.8)
          : hood
            ? s.selector === 'R'
              ? -1.6
              : 1.6
            : s.selector === 'R'
              ? 12
              : -12,
      );
    desired.addScaledVector(f.right, ready ? 6 : 0);
    desired.y += ready ? 2.3 : hood ? 1.35 : 4.6;
    if (ready) {
      const radius = this.vehicle.length * (narrow ? 2.3 : 1.55);
      desired.set(
        Math.sin(this.showroomYaw) * radius,
        1.1 + radius * Math.sin(this.showroomPitch),
        Math.cos(this.showroomYaw) * radius,
      );
    }
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 9));
    const target = ready
      ? f.position.clone()
      : this.course.sample(
          s.distance + (s.selector === 'R' ? -25 : 25),
          this.x * 0.9,
        ).position;
    target.y += ready ? this.vehicle.height * 0.55 : 1;
    this.camera.lookAt(target);
    this.camera.fov = T.MathUtils.damp(
      this.camera.fov,
      ready ? 42 : hood ? 72 : 54 + s.speed * 0.025 + (s.boost ? 5 : 0),
      4,
      dt,
    );
    this.camera.updateProjectionMatrix();
    if (this.hit > 0)
      this.camera.position.x += Math.sin(t * 0.08) * this.hit * 0.09;
    const lineMat = this.speedLines.material as T.LineBasicMaterial;
    lineMat.opacity = s.boost ? 0.3 : s.speed > 220 ? 0.07 : 0;
    if (lineMat.opacity > 0) {
      for (let i = 0; i < 60; i++) {
        const p = f.position
          .clone()
          .addScaledVector(f.right, (i % 2 ? 1 : -1) * (3 + rand(i) * 12))
          .addScaledVector(
            f.tangent,
            ((t * 0.12 + rand(i + 19) * 60) % 60) - 8,
          );
        p.y += 1 + rand(i + 99) * 7;
        const q = p.clone().addScaledVector(f.tangent, s.boost ? 7 : 3);
        this.lineData.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
      }
      this.speedLines.geometry.attributes.position.needsUpdate = true;
      this.speedLines.geometry.computeBoundingSphere();
    }
    this.audio.update(
      s.speed,
      s.gear,
      s.throttle && !s.braking,
      s.boost,
      s.mode,
      s.rpm,
      s.drift,
      this.vehicle.spec.powertrain === 'electric',
    );
    this.composer.passes[1].enabled = !ready && !this.daylight;
    this.composer.render();
    if (t - this.ui > 85) {
      this.ui = t;
      Object.assign(this.canvas.dataset, {
        streetLoaded: String(!!this.world.street.root.userData.loaded),
        drivingScore: String(s.drivingScore),
        indicator: String(s.indicator),
        speedLimit: String(s.speedLimit),
        signal: s.signal?.phase || 'none',
        mode: s.mode,
        vehicle: this.vehicleId,
        orbit: String(this.showroomYaw.toFixed(2)),
        speed: String(Math.round(s.speed)),
        loaded: String(s.loaded),
        camera: String(s.camera),
        route: s.route,
        distance: String(Math.round(s.distance)),
        offset: String(this.x.toFixed(2)),
        reason: s.endReason,
      });
      this.update({ ...s });
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  private disposeObject(root: T.Object3D) {
    const geos = new Set<T.BufferGeometry>(),
      mats = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        geos.add(o.geometry);
        for (const mat of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          mats.add(mat);
          Object.values(mat).forEach((v) => {
            if (v instanceof T.Texture) textures.add(v);
          });
        }
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.draco.dispose();
    this.world.dispose();
    this.disposeObject(this.scene);
    this.environment.dispose();
    this.daylightSky?.dispose();
    this.daylightEnvironment?.dispose();
    this.composer.passes.forEach((p) => p.dispose());
    this.composer.dispose();
    this.renderer.dispose();
    this.audio.dispose();
  }
}
