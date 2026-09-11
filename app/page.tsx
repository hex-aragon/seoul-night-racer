import { VEHICLES, PAINTS, getVehicle, type Vehicle } from './vehicles';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Pause,
  Play,
  RotateCcw,
  ArrowRight,
  Camera,
  Settings2,
  Trophy,
  MapPin,
  Flag,
  X,
} from 'lucide-react';
import { RaceEngine, initial } from './race-engine';
import { ROUTES, getCourse, type RouteId } from './routes';
import {
  awardRun,
  blankProfile,
  levelInfo,
  parseProfile,
  saveProfile,
  STORAGE_KEY,
  BADGES,
  type Profile,
} from './progress';
const time = (t: number) =>
  `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(t % 60)
    .toString()
    .padStart(2, '0')}.${Math.floor((t % 1) * 100)
    .toString()
    .padStart(2, '0')}`;
function RouteMap({
  id,
  distance = 0,
  small = false,
}: {
  id: RouteId;
  distance?: number;
  small?: boolean;
}) {
  const c = getCourse(id),
    points = Array.from(
      { length: 100 },
      (_, i) => c.sample((i / 99) * c.length).position,
    ),
    xs = points.map((p) => p.x),
    min = Math.min(...xs),
    max = Math.max(...xs),
    project = (d: number) => {
      const p = c.sample(d).position;
      return {
        x: 15 + ((p.x - min) / (max - min || 1)) * 100,
        y: 135 + (d / c.length) * -120,
      };
    },
    path = points
      .map((_, i) => {
        const p = project((i / 99) * c.length);
        return `${i ? 'L' : 'M'}${p.x},${p.y}`;
      })
      .join(' '),
    p = project(distance);
  return (
    <svg
      className={small ? 'route-sketch' : 'mini-map'}
      viewBox="0 0 130 150"
      role="img"
      aria-label={`${c.config.name} 곡선 코스 지도`}
    >
      <path
        d={path}
        fill="none"
        stroke="#ffffff20"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path d={path} fill="none" stroke={c.config.color} strokeWidth="3" />
      {c.config.landmarks.map((l) => {
        const q = project(l.at * c.length);
        return <circle key={l.id} cx={q.x} cy={q.y} r="4" fill="#ffdf99" />;
      })}
      <circle
        cx={p.x}
        cy={p.y}
        r="5"
        fill="white"
        stroke={c.config.color}
        strokeWidth="2"
      />
    </svg>
  );
}
function CarSilhouette({
  vehicle,
  color,
}: {
  vehicle: Vehicle;
  color: string;
}) {
  const tall = vehicle.style === 'suv',
    short = vehicle.style === 'compact';
  return (
    <svg className="car-silhouette" viewBox="0 0 180 66" aria-hidden="true">
      <ellipse cx="90" cy="56" rx="78" ry="5" fill="#0b1c2860" />
      <path
        d={
          tall
            ? 'M12 44 L17 22 L38 20 L53 8 L130 8 L150 23 L167 27 L172 48 L12 48 Z'
            : short
              ? 'M20 44 L27 33 L50 30 L63 13 L115 13 L139 32 L159 37 L161 49 L19 49 Z'
              : 'M8 43 L20 32 L49 29 L69 14 L111 14 L139 30 L166 36 L172 49 L8 49 Z'
        }
        fill={color}
        stroke="#edf6f666"
        strokeWidth="1.2"
      />
      <path
        d={
          tall
            ? 'M45 22 L57 12 L126 12 L140 24 Z'
            : 'M58 29 L72 18 L108 18 L129 30 Z'
        }
        fill="#233e51"
      />
      <path d="M90 17 L90 30" stroke={color} strokeWidth="3" />
      <path
        d="M17 39 L32 38 M151 38 L166 40"
        stroke="#eaf4f5"
        strokeWidth="3"
      />
      {[43, 137].map((x) => (
        <g key={x}>
          <circle cx={x} cy="49" r="12" fill="#15242c" />
          <circle cx={x} cy="49" r="7" fill="#a7bbc7" />
          <circle cx={x} cy="49" r="3" fill="#3b5260" />
        </g>
      ))}
    </svg>
  );
}
export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<RaceEngine | null>(null),
    profileRef = useRef(blankProfile()),
    gesture = useRef({ x: 0, y: 0, moved: false, lastTap: 0 }),
    dialog = useRef<HTMLDialogElement>(null);
  const [hud, setHud] = useState(() => initial()),
    [profile, setProfile] = useState(blankProfile),
    [reward, setReward] = useState<ReturnType<typeof awardRun> | null>(null),
    [query, setQuery] = useState(''),
    [featuredOnly, setFeaturedOnly] = useState(true),
    [showroom, setShowroom] = useState(false),
    [catalogPage, setCatalogPage] = useState(0),
    [soundPanel, setSoundPanel] = useState(false),
    [storageError, setStorageError] = useState(false);
  const store = (p: Profile) => {
    profileRef.current = p;
    setProfile(p);
    setStorageError(!saveProfile(p));
  };
  useEffect(() => {
    let p = blankProfile();
    try {
      p = parseProfile(localStorage.getItem(STORAGE_KEY));
    } catch {
      setStorageError(true);
    }
    profileRef.current = p;
    setProfile(p);
    try {
      const e = new RaceEngine(
        canvas.current!,
        setHud,
        (result) => {
          const r = awardRun(
            profileRef.current,
            result,
            getCourse(result.route).config.target,
          );
          profileRef.current = r.profile;
          setProfile(r.profile);
          setStorageError(!saveProfile(r.profile));
          setReward(r);
        },
        p.settings.route,
      );
      engine.current = e;
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa'))
        (window as Window & { __race?: RaceEngine }).__race = e;
      e.selectVehicle(p.settings.vehicle);
      e.setTraffic(p.settings.traffic);
      e.setColor(p.settings.color);
      e.setTransmission(p.settings.transmission);
      e.configureExperience(
        p.settings.daylight,
        p.settings.peaceful,
        p.settings.cruise,
      );
      e.audio.setVolumes(p.settings.music, p.settings.engine);
    } catch (error) {
      console.error(error);
      setHud((s) => ({
        ...s,
        error:
          '3D 화면을 시작하지 못했습니다. 하드웨어 가속을 켠 브라우저에서 다시 열어 주세요.',
      }));
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  const start = () => {
    setReward(null);
    setShowroom(false);
    setSoundPanel(false);
    engine.current?.start();
  };
  const settings = (patch: Partial<Profile['settings']>) => {
    const p = {
      ...profileRef.current,
      settings: { ...profileRef.current.settings, ...patch },
    };
    store(p);
    if (patch.vehicle) engine.current?.selectVehicle(p.settings.vehicle);
    if (patch.traffic) engine.current?.setTraffic(p.settings.traffic);
    engine.current?.setColor(p.settings.color);
    engine.current?.audio.setVolumes(p.settings.music, p.settings.engine);
    engine.current?.setTransmission(p.settings.transmission);
    engine.current?.configureExperience(
      p.settings.daylight,
      p.settings.peaceful,
      p.settings.cruise,
    );
  };
  const select = (id: RouteId) => {
    engine.current?.selectRoute(id);
    settings({ route: id });
    setReward(null);
  };
  const pedal = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      engine.current?.keys.add(key);
    },
    onPointerUp: () => engine.current?.keys.delete(key),
    onPointerCancel: () => engine.current?.keys.delete(key),
    onLostPointerCapture: () => engine.current?.keys.delete(key),
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        engine.current?.keys.add(key);
      }
    },
    onKeyUp: () => engine.current?.keys.delete(key),
    onBlur: () => engine.current?.keys.delete(key),
  });
  const filtered = ROUTES.filter(
    (r) =>
      (!featuredOnly || r.featured) &&
      `${r.name} ${r.subtitle} ${r.difficulty}`.includes(query.trim()),
  );
  const vehicle = getVehicle(profile.settings.vehicle),
    electric = vehicle.spec.powertrain === 'electric';
  useEffect(() => {
    if (hud.mode === 'paused') {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else {
      dialog.current?.close();
      if (hud.mode === 'racing') canvas.current?.focus();
    }
  }, [hud.mode]);
  const releaseGesture = () => {
    if (engine.current) {
      engine.current.steeringInput = 0;
      engine.current.keys.delete('s');
      engine.current.keys.delete('w');
    }
  };
  const course = getCourse(hud.route),
    active = hud.mode === 'racing' || hud.mode === 'paused',
    level = levelInfo(profile.xp),
    record = profile.records[hud.route];
  const preferences = () => (
    <div className="preferences">
      {storageError && (
        <p role="status">
          저장 공간을 사용할 수 없어 이번 세션에만 설정이 유지됩니다.
        </p>
      )}
      <fieldset>
        <legend>풍경</legend>
        <div className="choice-row">
          <button
            aria-pressed={profile.settings.daylight}
            onClick={() => settings({ daylight: true })}
          >
            ☀ 맑은 낮
          </button>
          <button
            aria-pressed={!profile.settings.daylight}
            onClick={() => settings({ daylight: false })}
          >
            ☾ 도시의 밤
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>달리는 방식</legend>
        <div className="choice-row">
          <button
            aria-pressed={profile.settings.peaceful}
            onClick={() => settings({ peaceful: true })}
          >
            힐링 드라이브
          </button>
          <button
            aria-pressed={!profile.settings.peaceful}
            onClick={() => settings({ peaceful: false })}
          >
            레이싱
          </button>
        </div>
        <p>
          {profile.settings.peaceful
            ? '충돌해도 끝나지 않아요. 커브를 부드럽게 보조합니다.'
            : '충돌 시 종료됩니다. 기록은 설정에서 확인하세요.'}
        </p>
        <label className="check-setting">
          <input
            type="checkbox"
            checked={profile.settings.cruise}
            onChange={(e) => settings({ cruise: e.target.checked })}
          />
          편안한 정속 주행 · 브레이크로 감속
        </label>
      </fieldset>
      <fieldset>
        <legend>소리</legend>
        <a
          className="sound-credit"
          href={`${import.meta.env.BASE_URL}AUDIO-CREDITS.md`}
          target="_blank"
          rel="noreferrer"
        >
          실제 녹음 기반 엔진 · 음원 출처
        </a>
        <label>
          시티팝 BGM
          <input
            aria-label="BGM 볼륨"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={profile.settings.music}
            onChange={(e) => settings({ music: Number(e.target.value) })}
          />
        </label>
        <label>
          엔진과 도로
          <input
            aria-label="엔진 볼륨"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={profile.settings.engine}
            onChange={(e) => settings({ engine: Number(e.target.value) })}
          />
        </label>
      </fieldset>
      <details>
        <summary>시점 · 변속 · 조작 방법</summary>
        <p>
          {electric ? '배터리' : '연료'} {hud.fuel.toFixed(1)}% · 게임 주행량
          기준
        </p>
        <button
          className="setting-camera"
          disabled={hud.speed > 1}
          onClick={() => engine.current?.refuel()}
        >
          {electric ? '정차 후 충전' : '정차 후 주유'}
        </button>
        <button
          className="setting-camera"
          onClick={() => engine.current?.changeCamera()}
        >
          시점: {hud.camera === 1 ? '앞유리 시점' : '멀리서 보기'} · 변경
        </button>
        <div className="choice-row">
          <button
            aria-pressed={profile.settings.transmission === 'auto'}
            onClick={() => settings({ transmission: 'auto' })}
          >
            오토 AT
          </button>
          <button
            disabled={electric}
            aria-pressed={
              !electric && profile.settings.transmission === 'manual'
            }
            onClick={() => settings({ transmission: 'manual' })}
          >
            수동 MT
          </button>
        </div>
        <div className="choice-row">
          {(['P', 'R', 'N', 'D'] as const).map((g) => (
            <button
              key={g}
              aria-pressed={hud.selector === g}
              onClick={() => engine.current?.selectGear(g)}
            >
              {g} · {{ P: '잠금', R: '후진', N: '중립', D: '전진' }[g]}
            </button>
          ))}
        </div>
        {hud.notice && <p role="status">{hud.notice}</p>}
        <p>
          ← → 버튼: 좌우 조향 · 페달을 누른 채 가속 또는 제동
          <br />
          W/S: 액셀/브레이크 · A/D 또는 ←/→: 조향
          <br />
          Space: 드리프트 · Q/E: 변속 (AT에서도 가능) · C: 시점 · Esc: 설정
          <br />
          방향과 P 잠금은 차량이 정지한 뒤 바꿀 수 있어요.
        </p>
      </details>
    </div>
  );
  return (
    <main className={`game-shell ${hud.mode} ${hud.boost ? 'boosting' : ''}`}>
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="드라이브 화면. 좌우로 드래그해 조향, 아래로 드래그해 브레이크. 두 번 탭하거나 Escape 키로 설정."
        onPointerDown={(e) => {
          if (hud.mode !== 'racing') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            ...gesture.current,
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          if (
            hud.mode !== 'racing' ||
            !e.currentTarget.hasPointerCapture(e.pointerId) ||
            !engine.current
          )
            return;
          const dx = e.clientX - gesture.current.x,
            dy = e.clientY - gesture.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 12) gesture.current.moved = true;
          engine.current.steeringInput = Math.max(-1, Math.min(1, dx / 100));
          if (dy > 45) engine.current.keys.add('s');
          else engine.current.keys.delete('s');
          if (dy < -45) engine.current.keys.add('w');
          else engine.current.keys.delete('w');
        }}
        onPointerUp={() => {
          if (hud.mode !== 'racing') return;
          releaseGesture();
          const now = Date.now();
          if (!gesture.current.moved && now - gesture.current.lastTap < 350) {
            engine.current?.pause();
            gesture.current.lastTap = 0;
          } else gesture.current.lastTap = gesture.current.moved ? 0 : now;
        }}
        onPointerCancel={releaseGesture}
        onLostPointerCapture={releaseGesture}
      />
      {hud.mode === 'racing' && (
        <>
          {hud.camera === 1 && (
            <div className="windshield-frame" aria-hidden="true" />
          )}
          <nav className="drive-toolbar" aria-label="주행 시점과 설정">
            <div className="view-switch">
              <button
                aria-pressed={hud.camera === 0}
                onClick={() => engine.current?.setCamera(0)}
              >
                멀리서 보기
              </button>
              <button
                aria-pressed={hud.camera === 1}
                onClick={() => engine.current?.setCamera(1)}
              >
                앞유리 시점
              </button>
            </div>
            <button
              className="drive-menu"
              aria-label="드라이브 설정 열기"
              onClick={() => engine.current?.pause()}
            >
              <Settings2 size={19} />
            </button>
          </nav>
          {!profile.settings.peaceful && (
            <div className="race-ribbon">
              <b className={hud.timeLeft < 20 ? 'urgent' : ''}>
                {Math.max(0, Math.ceil(hud.timeLeft))}s
              </b>
              <span>
                {hud.drift
                  ? 'DRIFT'
                  : `회피 ${hud.dodged} · 추월 ${hud.passed}`}{' '}
                <small>×{hud.combo}</small>
              </span>
              <strong>{hud.warning || '체크포인트를 향해 달리세요'}</strong>
            </div>
          )}
          <section className="driver-dash" aria-label="운전 조작부">
            <div className="driver-wheel">
              <div
                className="steering-wheel steering-feedback"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 160 160"
                  style={{ transform: `rotate(${hud.steering * 110}deg)` }}
                  aria-hidden="true"
                >
                  <circle cx="80" cy="80" r="63" />
                  <path d="M20 70 L65 80 M140 70 L95 80 M80 96 L80 143" />
                  <circle className="wheel-hub" cx="80" cy="80" r="24" />
                  <path className="wheel-mark" d="M80 12 L80 27" />
                </svg>
              </div>
              <span>
                좌우 조향 <small>← / →</small>
              </span>
              <div className="steer-buttons">
                <button aria-label="왼쪽 조향" {...pedal('arrowleft')}>
                  ◀
                </button>
                <button aria-label="오른쪽 조향" {...pedal('arrowright')}>
                  ▶
                </button>
              </div>
              <button
                className="drift-button"
                data-active={hud.drift}
                {...pedal(' ')}
              >
                드리프트 <small>SPACE</small>
              </button>
            </div>
            <div className="instrument-cluster">
              <div className="instrument-main">
                <div className="driver-speed">
                  <strong>
                    {Math.round(hud.speed).toString().padStart(2, '0')}
                  </strong>
                  <small>km/h</small>
                </div>
                <div className="drive-direction">
                  <b>
                    {hud.selector === 'D'
                      ? electric
                        ? 'D'
                        : `D${hud.gear}`
                      : hud.selector}
                  </b>
                  <span>
                    {hud.selector === 'R'
                      ? '후진'
                      : hud.selector === 'P'
                        ? '주차 잠금'
                        : hud.selector === 'N'
                          ? '중립'
                          : '전진'}{' '}
                    ·{' '}
                    {
                      [
                        '북 N',
                        '북동 NE',
                        '동 E',
                        '남동 SE',
                        '남 S',
                        '남서 SW',
                        '서 W',
                        '북서 NW',
                      ][Math.round(hud.bearing / 45) % 8]
                    }
                  </span>
                </div>
              </div>
              <div className="fuel-indicator" data-low={hud.fuel <= 20}>
                <label>
                  <span>{electric ? '배터리' : '연료'}</span>
                  <b>{hud.fuel.toFixed(1)}%</b>
                </label>
                <div
                  role="meter"
                  aria-label={electric ? '남은 배터리' : '남은 연료'}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={hud.fuel}
                >
                  <i style={{ width: `${hud.fuel}%` }} />
                </div>
              </div>
              <div className="drive-gear-row">
                {(['P', 'R', 'N', 'D'] as const).map((g) => (
                  <button
                    key={g}
                    aria-label={
                      {
                        P: '주차 잠금 P',
                        R: '후진 R',
                        N: '중립 N',
                        D: '전진 D',
                      }[g]
                    }
                    aria-pressed={hud.selector === g}
                    disabled={
                      hud.speed > 1 &&
                      g !== hud.selector &&
                      g !== 'N' &&
                      !(g === 'D' && hud.selector === 'N' && hud.velocity > 0)
                    }
                    onClick={() => engine.current?.selectGear(g)}
                  >
                    {g}
                  </button>
                ))}
                <button
                  className="at-mt"
                  disabled={electric}
                  aria-label="자동 수동 변속 전환"
                  onClick={() =>
                    settings({
                      transmission:
                        profile.settings.transmission === 'auto'
                          ? 'manual'
                          : 'auto',
                    })
                  }
                >
                  {electric
                    ? 'EV'
                    : profile.settings.transmission === 'auto'
                      ? 'AT'
                      : 'MT'}
                </button>
              </div>
              {
                <div className="dash-shift">
                  <button
                    aria-label="기어 내리기"
                    disabled={electric || hud.selector !== 'D'}
                    onClick={() => engine.current?.shift(-1)}
                  >
                    −
                  </button>
                  <span>
                    {electric
                      ? '전기 구동 · 회생제동'
                      : `${hud.transmission === 'auto' ? 'AT 패들' : 'MT'} · ${hud.gear}단`}
                  </span>
                  <button
                    aria-label="기어 올리기"
                    disabled={electric || hud.selector !== 'D'}
                    onClick={() => engine.current?.shift(1)}
                  >
                    ＋
                  </button>
                </div>
              }
              {hud.fuel <= 20 ? (
                <div className="fuel-help" role="status">
                  <span>
                    {electric
                      ? '배터리 부족 · 정차 후 충전'
                      : hud.fuel === 0
                        ? '연료 소진 · 정차 후 주유'
                        : '연료 부족'}
                  </span>
                  <button
                    disabled={hud.speed > 1}
                    onClick={() => engine.current?.refuel()}
                  >
                    {electric ? '충전' : '주유'}
                  </button>
                </div>
              ) : (
                <small className="driver-hint">
                  {hud.notice ||
                    (profile.settings.cruise
                      ? '정속 주행 켜짐'
                      : hud.speed > 1
                        ? '방향 전환은 정차 후'
                        : '액셀을 밟아 출발하세요')}
                </small>
              )}
            </div>
            <div className="pedals driver-pedals">
              <button
                className="brake-pedal"
                data-pressed={hud.braking}
                {...pedal('arrowdown')}
              >
                <i />
                <strong>브레이크</strong>
                <small>S / ↓</small>
              </button>
              <button
                className="gas-pedal"
                data-pressed={hud.throttle && !hud.braking}
                {...pedal('arrowup')}
              >
                <i />
                <strong>액셀</strong>
                <small>W / ↑</small>
              </button>
            </div>
          </section>
        </>
      )}
      <div className="grain" />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          S<span>／</span>MR <small>SEOUL MIDNIGHT RUN</small>
        </a>
        <div className="top-actions">
          <span className="level-badge">LV. {level.level}</span>
          <button
            aria-label="드라이브 설정"
            aria-expanded={soundPanel}
            onClick={() => {
              setSoundPanel(!soundPanel);
              void engine.current?.audio.unlock().catch(() => {});
            }}
          >
            <Settings2 size={19} />
          </button>
          {active && (
            <>
              <button
                onClick={() => engine.current?.changeCamera()}
                aria-label="카메라 시점 변경"
              >
                <Camera size={19} />
              </button>
              <button
                onClick={() => engine.current?.pause()}
                aria-label={hud.mode === 'paused' ? '계속하기' : '일시정지'}
              >
                {hud.mode === 'paused' ? (
                  <Play size={19} />
                ) : (
                  <Pause size={19} />
                )}
              </button>
            </>
          )}
        </div>
      </header>
      {soundPanel && hud.mode === 'ready' && (
        <aside className="audio-panel experience-panel">
          <div>
            <strong>드라이브 설정</strong>
            <button aria-label="설정 닫기" onClick={() => setSoundPanel(false)}>
              <X size={18} />
            </button>
          </div>
          {preferences()}
        </aside>
      )}
      {hud.mode === 'ready' && (
        <>
          <section
            className={`garage-intro fleet-garage ${showroom ? 'showroom-hidden' : ''}`}
          >
            <h1>오늘은 어디까지?</h1>
            <p>차를 고르고, 한국의 드라이빙 명소로.</p>
            <div className="fleet-heading">
              <h2>내 차 고르기</h2>
              <button
                className="preview-toggle"
                onClick={() => setShowroom(true)}
              >
                3D로 보기
              </button>
            </div>
            <div className="fleet-grid" aria-label="차량 선택">
              {VEHICLES.map((v) => (
                <button
                  key={v.id}
                  className="fleet-car"
                  aria-label={`${v.brand} ${v.name}`}
                  aria-pressed={vehicle.id === v.id}
                  onClick={() =>
                    settings({
                      vehicle: v.id,
                      color: v.color,
                      transmission: 'auto',
                    })
                  }
                >
                  <CarSilhouette
                    vehicle={v}
                    color={
                      vehicle.id === v.id ? profile.settings.color : v.color
                    }
                  />
                  <strong>{v.brand}</strong>
                  <small>
                    {v.style === 'suv'
                      ? 'SUV'
                      : v.spec.powertrain === 'electric'
                        ? '전기차'
                        : v.style === 'sedan'
                          ? '세단'
                          : v.style === 'compact'
                            ? '컴팩트'
                            : '스포츠'}
                  </small>
                </button>
              ))}
            </div>
            <div className="vehicle-summary">
              <strong>
                {vehicle.brand} {vehicle.name}
              </strong>
              <span>{vehicle.detail}</span>
              <small>
                게임 최고 {vehicle.spec.maxSpeed} km/h ·{' '}
                {electric
                  ? '전기 / 회생제동'
                  : `AT·MT ${vehicle.spec.forwardGears}단`}
              </small>
            </div>
            <div className="paint-options" aria-label="차량 색상">
              {PAINTS.map(([value, label]) => (
                <button
                  key={value}
                  aria-label={label}
                  title={label}
                  aria-pressed={profile.settings.color === value}
                  style={{ background: value }}
                  onClick={() => settings({ color: value })}
                />
              ))}
              <label className="custom-paint" title="직접 색상 선택">
                <input
                  type="color"
                  aria-label="직접 차량 색상 선택"
                  value={profile.settings.color}
                  onChange={(e) => settings({ color: e.target.value })}
                />
                <span>+</span>
              </label>
            </div>
            <div className="departure-summary">
              {course.config.name}
              <span>
                {profile.settings.daylight ? '낮 드라이브' : '야간 드라이브'}
              </span>
            </div>
            <button
              className="start-button"
              disabled={!hud.loaded || !!hud.error}
              onClick={start}
            >
              {hud.error
                ? '3D 로드 실패'
                : hud.loaded
                  ? '이 코스로 출발'
                  : '차량 준비 중…'}
              <ArrowUpRight size={22} />
            </button>
            <div className="enter-hint">
              {hud.error ||
                '← → 버튼을 누른 채 조향 · 액셀과 브레이크로 속도 조절'}
            </div>
            <button
              className="touge-start"
              onClick={() => {
                select('namsan');
                settings({
                  daylight: false,
                  peaceful: false,
                  cruise: false,
                  transmission: 'auto',
                });
                start();
              }}
            >
              남산 야간 타임어택
            </button>
          </section>
          {showroom && (
            <div className="showroom-bar">
              <strong>
                {vehicle.brand} {vehicle.name}
              </strong>
              <button onClick={() => setShowroom(false)}>
                차고로 돌아가기
              </button>
              <div className="paint-options">
                {PAINTS.map(([color, label]) => (
                  <button
                    key={color}
                    aria-label={label}
                    style={{ background: color }}
                    onClick={() => settings({ color })}
                  />
                ))}
              </div>
            </div>
          )}
          <section
            className={`route-picker ${showroom ? 'showroom-hidden' : ''}`}
            aria-label="맵 선택"
          >
            <div className="picker-heading">
              <span>한국 드라이빙 명소</span>
              <span>추천 10곳</span>
            </div>
            <div className="catalog-tabs">
              <button
                aria-pressed={featuredOnly}
                onClick={() => {
                  setFeaturedOnly(true);
                  setCatalogPage(0);
                }}
              >
                명소 10곳
              </button>
              <button
                aria-pressed={!featuredOnly}
                onClick={() => {
                  setFeaturedOnly(false);
                  setCatalogPage(0);
                }}
              >
                전체 {ROUTES.length} 코스
              </button>
            </div>
            <label className="traffic-choice">
              도로 상황
              <select
                aria-label="도로 상황"
                value={profile.settings.traffic}
                onChange={(e) =>
                  settings({
                    traffic: e.target.value as Profile['settings']['traffic'],
                  })
                }
              >
                <option value="route">코스별 추천 상황</option>
                <option value="free">일상 교통</option>
                <option value="works">도로 공사</option>
                <option value="busy">퇴근길 정체</option>
              </select>
            </label>
            <input
              className="route-search"
              aria-label="코스 검색"
              placeholder="인천 · 동해 · 부산 · 숲길 검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCatalogPage(0);
              }}
            />
            <div className="scenic-filters">
              {['전체', '해안', '인천', '동해', '숲'].map((label) => (
                <button
                  key={label}
                  aria-pressed={query === (label === '전체' ? '' : label)}
                  onClick={() => {
                    setQuery(label === '전체' ? '' : label);
                    setCatalogPage(0);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="catalog-list">
              {filtered
                .slice(catalogPage * 6, catalogPage * 6 + 6)
                .map((route) => {
                  const r = profile.records[route.id];
                  return (
                    <button
                      className={`route-card ${hud.route === route.id ? 'selected' : ''}`}
                      key={route.id}
                      aria-pressed={hud.route === route.id}
                      onClick={() => select(route.id)}
                      style={
                        { '--route-color': route.color } as React.CSSProperties
                      }
                    >
                      <RouteMap id={route.id} small />
                      <div>
                        <small>{route.subtitle}</small>
                        <h2>{route.name}</h2>
                        <p>
                          {route.difficulty} ·{' '}
                          {
                            (
                              {
                                free: '일상 교통',
                                works: '도로 공사',
                                busy: '정체 구간',
                              } as const
                            )[
                              profile.settings.traffic === 'route'
                                ? route.trafficPreset || 'free'
                                : profile.settings.traffic
                            ]
                          }
                        </p>
                        <span>
                          {(getCourse(route.id).length / 1000).toFixed(1)} km{' '}
                          <b>
                            코스 평점 {'★'.repeat(r?.stars || 0)}
                            {'☆'.repeat(3 - (r?.stars || 0))}
                          </b>
                        </span>
                        {r?.bestTime && <em>BEST {time(r.bestTime)}</em>}
                      </div>
                    </button>
                  );
                })}
            </div>
            <div className="catalog-pages">
              <button
                disabled={catalogPage === 0}
                onClick={() => setCatalogPage((p) => p - 1)}
              >
                이전
              </button>
              <span>
                {filtered.length ? catalogPage + 1 : 0} /{' '}
                {Math.ceil(filtered.length / 6)} · {filtered.length}개
              </span>
              <button
                disabled={(catalogPage + 1) * 6 >= filtered.length}
                onClick={() => setCatalogPage((p) => p + 1)}
              >
                다음
              </button>
            </div>
            {!filtered.length && (
              <p>검색 결과가 없습니다. 다른 지역을 입력해 주세요.</p>
            )}
            <p className="route-note">
              국내 드라이빙 명소를 재해석한 {ROUTES.length}개 가상 코스입니다.
              <br />
              실제 도로와 경로는 다릅니다.
            </p>
          </section>
          <div className="selected-route-caption">
            <MapPin size={15} />
            {course.config.landmarks.map((l) => l.name).join(' → ')}
          </div>
          <a
            className="model-credit"
            href="https://threejs.org/examples/webgl_materials_car.html"
            target="_blank"
            rel="noreferrer"
          >
            Ferrari 모델 출처 · 다른 차량은 브랜드에서 영감을 받은 게임용 디자인
            ↗
          </a>
        </>
      )}
      <dialog
        ref={dialog}
        className="drive-settings"
        onCancel={(e) => {
          e.preventDefault();
          engine.current?.pause();
        }}
        aria-label="드라이브 설정"
      >
        <div className="settings-heading">
          <div>
            <small>{course.config.name}</small>
            <h2>잠시 쉬어가기</h2>
          </div>
          <button
            autoFocus
            onClick={() => engine.current?.pause()}
            aria-label="설정 닫고 계속 달리기"
          >
            <X size={22} />
          </button>
        </div>
        {preferences()}
        <details>
          <summary>이번 주행과 내 기록</summary>
          <p>
            주행 {(hud.distance / 1000).toFixed(2)} km · {Math.round(hud.speed)}{' '}
            km/h · {Math.round(hud.rpm)} RPM
            <br />
            레벨 {level.level} · {profile.xp} XP · 누적{' '}
            {(profile.distance / 1000).toFixed(1)} km
          </p>
          <RouteMap id={hud.route} distance={hud.distance} />
        </details>
        <div className="settings-actions">
          <button
            className="start-button"
            onClick={() => engine.current?.pause()}
          >
            계속 달리기 <Play size={18} />
          </button>
          <button
            className="text-button"
            onClick={() => engine.current?.garage()}
          >
            다른 코스 고르기
          </button>
        </div>
      </dialog>
      {hud.mode === 'finished' && (
        <div className="overlay">
          <section className="result">
            <span className="eyebrow">
              {hud.endReason === 'finish'
                ? 'CIRCUIT COMPLETE'
                : 'CRASH / GAME OVER'}
            </span>
            <h2>
              {hud.endReason === 'finish'
                ? '코스를 공략했습니다.'
                : hud.endReason === 'traffic'
                  ? '차량과 충돌했습니다.'
                  : hud.endReason === 'timeout'
                    ? '제한 시간이 끝났습니다.'
                    : hud.endReason === 'obstacle'
                      ? '방호벽에 충돌했습니다.'
                      : '가드레일과 충돌했습니다.'}
            </h2>
            <p>
              {hud.endReason === 'finish'
                ? course.config.name
                : '속도를 줄이고 다음 코너에 다시 도전하세요.'}
            </p>
            <div className="finish-stars">
              {'★'.repeat(reward?.stars || 0)}
              {'☆'.repeat(3 - (reward?.stars || 0))}
            </div>
            <div className="result-stats">
              <div>
                <span>주행 시간</span>
                <b>{time(hud.time)}</b>
              </div>
              <div>
                <span>주행 거리</span>
                <b>{(hud.distance / 1000).toFixed(2)} km</b>
              </div>
              <div>
                <span>획득 경험치</span>
                <b>+{reward?.xp || 0} XP</b>
              </div>
            </div>
            <div className="reward-line">
              {reward?.levelUp && <strong>LEVEL UP · LV.{level.level}</strong>}
              {reward?.newBest && <span>NEW BEST</span>}
              {reward?.newBadges.map((b) => (
                <span key={b}>{BADGES[b]}</span>
              ))}
            </div>
            <p className="save-status">
              {storageError
                ? '저장 공간을 사용할 수 없어 이번 세션에만 기록됩니다.'
                : '경험치와 기록을 이 브라우저에 저장했습니다.'}
            </p>
            <button className="start-button" onClick={start}>
              같은 맵 재시작 <RotateCcw size={20} />
            </button>
            <button
              className="text-button"
              onClick={() => engine.current?.garage()}
            >
              다른 맵 선택 <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
      {storageError && hud.mode !== 'finished' && (
        <div className="storage-warning" role="status">
          브라우저 저장소를 사용할 수 없습니다. 현재 세션에서만 기록됩니다.
        </div>
      )}
      <footer className="bottom-bar">
        <div className="coordinates">
          SEOUL, AFTER HOURS <span>로컬 레벨 · 로그인 없이 저장</span>
        </div>
        <div className="keyboard-guide">
          <span>
            <kbd>W</kbd>
            <kbd>↑</kbd> 액셀
          </span>
          <span>
            <kbd>A</kbd>
            <kbd>D</kbd> 조향
          </span>
          <span>
            <kbd>S</kbd> 브레이크
          </span>
          <span>
            <kbd>Q</kbd>
            <kbd>E</kbd> 변속
          </span>
          <span>
            <kbd>C</kbd> 시점 <kbd>P</kbd> 일시정지
          </span>
        </div>
        <span className="circuit-label">
          {record?.bestTime
            ? `BEST ${time(record.bestTime)}`
            : `${vehicle.brand} ${vehicle.name}`}
        </span>
      </footer>
    </main>
  );
}
