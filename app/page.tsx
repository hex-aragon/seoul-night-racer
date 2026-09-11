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
    dialog = useRef<HTMLDialogElement>(null),
    wheelStart = useRef(0);
  const [hud, setHud] = useState(() => initial()),
    [profile, setProfile] = useState(blankProfile),
    [reward, setReward] = useState<ReturnType<typeof awardRun> | null>(null),
    [query, setQuery] = useState(''),
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
  const centerWheel = () => {
    if (engine.current) engine.current.steeringInput = 0;
  };
  const filtered = ROUTES.filter((r) =>
    `${r.name} ${r.subtitle} ${r.difficulty}`.includes(query.trim()),
  );
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
        <p>연료 {hud.fuel.toFixed(1)}% · 게임 주행량 기준</p>
        <button
          className="setting-camera"
          disabled={hud.speed > 1}
          onClick={() => engine.current?.refuel()}
        >
          정차 후 주유
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
            aria-pressed={profile.settings.transmission === 'manual'}
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
          좌우 드래그: 핸들 · 아래 드래그: 브레이크 · 위 드래그: 액셀
          <br />
          W/S: 액셀/브레이크 · A/D: 조향 · Q/E: 수동 변속
          <br />
          C: 시점 · Esc: 설정 · 화면 두 번 탭: 설정
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
          <section className="driver-dash" aria-label="운전 조작부">
            <div className="driver-wheel">
              <div
                className="steering-wheel"
                role="slider"
                tabIndex={0}
                aria-label="핸들"
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={Math.round(hud.steering * 100)}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  wheelStart.current = e.clientX;
                }}
                onPointerMove={(e) => {
                  if (
                    e.currentTarget.hasPointerCapture(e.pointerId) &&
                    engine.current
                  )
                    engine.current.steeringInput = Math.max(
                      -1,
                      Math.min(1, (e.clientX - wheelStart.current) / 95),
                    );
                }}
                onPointerUp={centerWheel}
                onPointerCancel={centerWheel}
                onLostPointerCapture={centerWheel}
                onBlur={centerWheel}
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
                핸들 <small>A / D</small>
              </span>
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
                  <b>{hud.selector === 'D' ? `D${hud.gear}` : hud.selector}</b>
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
                  <span>연료</span>
                  <b>{hud.fuel.toFixed(1)}%</b>
                </label>
                <div
                  role="meter"
                  aria-label="남은 연료"
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
                    disabled={hud.speed > 1 && g !== hud.selector && g !== 'N'}
                    onClick={() => engine.current?.selectGear(g)}
                  >
                    {g}
                  </button>
                ))}
                <button
                  className="at-mt"
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
                  {profile.settings.transmission === 'auto' ? 'AT' : 'MT'}
                </button>
              </div>
              {profile.settings.transmission === 'manual' && (
                <div className="dash-shift">
                  <button
                    aria-label="기어 내리기"
                    disabled={hud.selector !== 'D'}
                    onClick={() => engine.current?.shift(-1)}
                  >
                    −
                  </button>
                  <span>{hud.gear}단 · Q / E</span>
                  <button
                    aria-label="기어 올리기"
                    disabled={hud.selector !== 'D'}
                    onClick={() => engine.current?.shift(1)}
                  >
                    ＋
                  </button>
                </div>
              )}
              {hud.fuel <= 20 ? (
                <div className="fuel-help" role="status">
                  <span>
                    {hud.fuel === 0 ? '연료 소진 · 정차 후 주유' : '연료 부족'}
                  </span>
                  <button
                    disabled={hud.speed > 1}
                    onClick={() => engine.current?.refuel()}
                  >
                    주유
                  </button>
                </div>
              ) : (
                <small className="driver-hint">
                  {profile.settings.cruise
                    ? '정속 주행 켜짐'
                    : hud.speed > 1
                      ? '방향 전환은 정차 후'
                      : '액셀을 밟아 출발하세요'}
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
          <section className="garage-intro">
            <div className="eyebrow">SEOUL / A QUIETER DRIVE</div>
            <h1>
              서두르지 않아도,
              <br />
              <em>좋은 하루.</em>
            </h1>
            <p>햇살 아래 강변, 또는 도시의 밤. 천천히 달려보세요.</p>
            <div className="driver-profile">
              <div>
                <Trophy size={18} />
                <strong>LEVEL {level.level}</strong>
                <span>{profile.xp.toLocaleString()} XP</span>
              </div>
              <div className="xp-bar">
                <i style={{ width: `${level.progress * 100}%` }} />
              </div>
              <small>
                다음 레벨까지 {level.remaining} XP · 누적{' '}
                {(profile.distance / 1000).toFixed(1)} km
              </small>
              <div className="badges">
                {profile.badges.length ? (
                  profile.badges.map((b) => (
                    <span key={b}>{BADGES[b] || b}</span>
                  ))
                ) : (
                  <span>첫 완주로 첫 번째 배지를 획득하세요</span>
                )}
              </div>
            </div>
            <div className="paint-options" aria-label="차량 색상">
              {[
                ['#f31931', '로쏘 레드'],
                ['#f7bd28', '레이싱 옐로'],
                ['#d5dfeb', '실버'],
                ['#172136', '미드나이트 블루'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-label={label}
                  aria-pressed={profile.settings.color === value}
                  title={label}
                  style={{ background: value }}
                  onClick={() => {
                    engine.current?.setColor(value);
                    settings({ color: value });
                  }}
                />
              ))}
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
                  : 'Ferrari 불러오는 중…'}
              <ArrowUpRight size={22} />
            </button>
            <div className="enter-hint">
              {hud.error || '하단 핸들·페달로 운전 · 카메라 버튼으로 시점 전환'}
            </div>
          </section>
          <section className="route-picker" aria-label="맵 선택">
            <div className="picker-heading">
              <span>SELECT YOUR ROUTE</span>
              <span>{ROUTES.length}개 코스</span>
            </div>
            <input
              className="route-search"
              aria-label="코스 검색"
              placeholder="해안 · 한강 · 숲길 · 대관령 검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCatalogPage(0);
              }}
            />
            <div className="scenic-filters">
              {['전체', '해안', '한강', '숲', '대관령'].map((label) => (
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
                        <p>{route.difficulty}</p>
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
            Ferrari 458 Italia / vicent091036 · Three.js ↗
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
                ? '기분 좋은 드라이브였습니다.'
                : hud.endReason === 'traffic'
                  ? '차량과 충돌했습니다.'
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
            : 'FERRARI 458 ITALIA'}
        </span>
      </footer>
    </main>
  );
}
