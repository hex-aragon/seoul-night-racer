import { VEHICLES, PAINTS, getVehicle } from './vehicles';
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
export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<RaceEngine | null>(null),
    profileRef = useRef(blankProfile()),
    gesture = useRef({ x: 0, y: 0, moved: false, lastTap: 0 }),
    dialog = useRef<HTMLDialogElement>(null);
  const [hud, setHud] = useState(() => initial()),
    [profile, setProfile] = useState(blankProfile),
    [reward, setReward] = useState<ReturnType<typeof awardRun> | null>(null),
    [turning, setTurning] = useState(false),
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
  const turnStart = useRef({ x: 0, y: 0 });
  const chooseVehicle = (id: string) =>
    settings({
      vehicle: id,
      color: getVehicle(id).color,
      transmission: 'auto',
    });
  const cycleVehicle = (delta: number) =>
    chooseVehicle(
      VEHICLES[
        (VEHICLES.findIndex((v) => v.id === vehicle.id) +
          delta +
          VEHICLES.length) %
          VEHICLES.length
      ].id,
    );
  useEffect(() => {
    document.querySelector('.brand-tab[aria-pressed="true"]')?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [vehicle.id]);
  const preferences = () => (
    <div className="preferences">
      {storageError && (
        <p role="status">
          저장 공간을 사용할 수 없어 이번 세션에만 설정이 유지됩니다.
        </p>
      )}
      <fieldset>
        <legend>도로 상황</legend>
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
      </fieldset>
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
          운전점수 100점 시작 · 결승에서 80점 이상 합격. 과속 2초마다
          −2점(20km/h 초과 시 −4점), 적색 신호 위반 −15점, 깜빡이 없이 차선 변경
          −5점. 변경 1초 전에 Z(좌) / X(우) 또는 깜빡이 버튼을 누르세요. 화면
          제한속도는 게임 규칙입니다.
        </p>
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
      {import.meta.env.DEV &&
        new URLSearchParams(location.search).has('qa') &&
        hud.mode === 'ready' && (
          <button
            style={{ position: 'absolute', top: 80, right: 20, zIndex: 100 }}
            onClick={() => engine.current?.previewCrossing()}
          >
            신호등 테스트
          </button>
        )}
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
          {hud.signal && (
            <div className={'signal-pill ' + hud.signal.phase} role="status">
              <i />
              {hud.signal.phase === 'red'
                ? '정지'
                : hud.signal.phase === 'amber'
                  ? '감속'
                  : '진행'}{' '}
              <span>
                {hud.signal.distance}m · {hud.signal.remaining}초
              </span>
            </div>
          )}
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
          <div
            className={
              'driving-assessment ' + (hud.drivingScore < 80 ? 'at-risk' : '')
            }
            aria-label="운전점수와 제한속도"
          >
            <strong>
              {hud.drivingScore}
              <small> / 100</small>
            </strong>
            <span>합격 80점</span>
            <b className={hud.speed > hud.speedLimit + 3 ? 'overspeed' : ''}>
              {hud.speedLimit}
            </b>
            <span>제한 km/h</span>
          </div>
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
              <div className="turn-indicators" aria-label="방향지시등">
                <button
                  aria-label="좌측 깜빡이 Z"
                  aria-pressed={hud.indicator === -1}
                  onClick={() => engine.current?.toggleIndicator(-1)}
                >
                  ◀ <span>깜빡이 Z</span>
                </button>
                <button
                  aria-label="우측 깜빡이 X"
                  aria-pressed={hud.indicator === 1}
                  onClick={() => engine.current?.toggleIndicator(1)}
                >
                  <span>깜빡이 X</span> ▶
                </button>
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
        <div className="showroom-ui">
          <header className="showroom-header">
            <a
              className="showroom-wordmark"
              href="#"
              aria-label="드라이빙 차고"
            >
              Seoul / Drive
            </a>
            <nav className="brand-rail" aria-label="브랜드 선택">
              {VEHICLES.map((v) => (
                <button
                  className="brand-tab"
                  key={v.id}
                  aria-pressed={vehicle.id === v.id}
                  onClick={() => chooseVehicle(v.id)}
                >
                  {v.brand}
                </button>
              ))}
            </nav>
            <button
              className="showroom-settings"
              aria-label="드라이브 설정"
              onClick={() => setSoundPanel(!soundPanel)}
            >
              <Settings2 size={20} />
            </button>
          </header>
          <div className="showroom-title" aria-live="polite">
            <span>{vehicle.brand}</span>
            <h1>{vehicle.name}</h1>
            <p>
              {electric
                ? '전기 구동 · 회생제동'
                : `AT / MT · ${vehicle.spec.forwardGears}단`}{' '}
              <span>최고 {vehicle.spec.maxSpeed} km/h</span>
            </p>
          </div>
          <div
            className={`showroom-touch ${turning ? 'turning' : ''}`}
            role="region"
            aria-label="차량 360도 미리보기. 드래그하거나 방향키로 회전"
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              turnStart.current = { x: e.clientX, y: e.clientY };
              setTurning(true);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              engine.current?.orbitShowroom(
                e.clientX - turnStart.current.x,
                e.clientY - turnStart.current.y,
              );
              turnStart.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => setTurning(false)}
            onPointerCancel={() => setTurning(false)}
            onLostPointerCapture={() => setTurning(false)}
            onKeyDown={(e) => {
              if (
                ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                e.stopPropagation();
                engine.current?.orbitShowroom(
                  e.key === 'ArrowLeft' ? -55 : e.key === 'ArrowRight' ? 55 : 0,
                  e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0,
                );
              }
            }}
          />
          <button
            className="vehicle-arrow previous"
            aria-label="이전 차량"
            onClick={() => cycleVehicle(-1)}
          >
            ‹
          </button>
          <button
            className="vehicle-arrow next"
            aria-label="다음 차량"
            onClick={() => cycleVehicle(1)}
          >
            ›
          </button>
          <div className="showroom-load" role="status">
            {hud.error ? (
              <>
                <span>{hud.error}</span>
                <button
                  onClick={() => engine.current?.selectVehicle(vehicle.id)}
                >
                  다시 불러오기
                </button>
              </>
            ) : !hud.loaded ? (
              '상세 모델 불러오는 중…'
            ) : null}
          </div>
          <div className="showroom-paint">
            <span>드래그해서 360° 둘러보기</span>
            <div className="paint-options" aria-label="차량 색상">
              {PAINTS.map(([color, label]) => (
                <button
                  key={color}
                  aria-label={label}
                  aria-pressed={profile.settings.color === color}
                  style={{ background: color }}
                  onClick={() => settings({ color })}
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
          </div>
          <section className="trip-tray" aria-label="드라이빙 코스 선택">
            <div className="trip-heading">
              <h2>어디로 떠날까요?</h2>
              <label>
                전체 코스
                <select
                  aria-label="전체 코스 선택"
                  value={hud.route}
                  onChange={(e) => select(e.target.value)}
                >
                  {ROUTES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="trip-bottom">
              <div className="destination-rail" aria-label="추천 명소 슬라이드">
                {(course.config.featured
                  ? ROUTES.filter((r) => r.featured)
                  : [course.config, ...ROUTES.filter((r) => r.featured)]
                ).map((r) => (
                  <button
                    key={r.id}
                    className="destination-card"
                    aria-pressed={hud.route === r.id}
                    onClick={() => select(r.id)}
                  >
                    <RouteMap id={r.id} small />
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        {(getCourse(r.id).length / 1000).toFixed(1)} km ·{' '}
                        {r.district || '서울'}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
              <button
                className="depart-button"
                disabled={!hud.loaded || !!hud.error}
                onClick={start}
              >
                <span>{course.config.name}</span>드라이브 시작{' '}
                <ArrowUpRight size={23} />
              </button>
            </div>
          </section>
          <a
            className="showroom-credit"
            href={`${import.meta.env.BASE_URL}models/ATTRIBUTION.md`}
            target="_blank"
            rel="noreferrer"
          >
            3D 모델 · 제작자 및 라이선스
          </a>
        </div>
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
                ? 'DRIVING TEST · PASS'
                : hud.endReason === 'low-score'
                  ? 'DRIVING TEST · FAIL'
                  : 'CRASH / GAME OVER'}
            </span>
            <h2>
              {hud.endReason === 'finish'
                ? '운전 평가에 합격했습니다.'
                : hud.endReason === 'low-score'
                  ? '운전점수 미달 · 불합격'
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
                : hud.endReason === 'low-score'
                  ? '결승에 도착했지만 80점 미만입니다. 교통규칙을 지켜 다시 도전하세요.'
                  : '속도를 줄이고 다음 코너에 다시 도전하세요.'}
            </p>
            <div
              className={
                'result-driving-score ' +
                (hud.drivingScore < 80 ? 'at-risk' : '')
              }
            >
              <b>{hud.drivingScore}</b> / 100점 · 합격 기준 80점
            </div>
            <p className="deduction-summary">
              과속 −{hud.violations.speeding} · 신호 위반{' '}
              {hud.violations.redLights}회 · 깜빡이 미사용{' '}
              {hud.violations.unsignalled}회
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
