import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Pause,
  Play,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Zap,
  Camera,
  Music2,
  Trophy,
  MapPin,
  Flag,
  Star,
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
    profileRef = useRef(blankProfile());
  const [hud, setHud] = useState(() => initial()),
    [profile, setProfile] = useState(blankProfile),
    [reward, setReward] = useState<ReturnType<typeof awardRun> | null>(null),
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
  };
  const select = (id: RouteId) => {
    engine.current?.selectRoute(id);
    settings({ route: id });
    setReward(null);
  };
  const touch = (key: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      engine.current?.keys.add(key);
    },
    onPointerUp: () => engine.current?.keys.delete(key),
    onPointerCancel: () => engine.current?.keys.delete(key),
    onLostPointerCapture: () => engine.current?.keys.delete(key),
  });
  const course = getCourse(hud.route),
    active = hud.mode === 'racing' || hud.mode === 'paused',
    level = levelInfo(profile.xp),
    nextLandmark = course.config.landmarks.find(
      (l) => l.at * course.length > hud.distance,
    ),
    record = profile.records[hud.route];
  return (
    <main className={`game-shell ${hud.mode} ${hud.boost ? 'boosting' : ''}`}>
      <canvas ref={canvas} aria-label="서울 명소 곡선 코스 3D 레이싱" />
      <div className="grain" />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          S<span>／</span>MR <small>SEOUL MIDNIGHT RUN</small>
        </a>
        <div className="top-actions">
          <span className="level-badge">LV. {level.level}</span>
          <button
            aria-label="음악·엔진 볼륨 설정"
            aria-expanded={soundPanel}
            onClick={() => {
              setSoundPanel(!soundPanel);
              void engine.current?.audio.unlock().catch(() => {});
            }}
          >
            <Music2 size={19} />
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
      {soundPanel && (
        <aside className="audio-panel">
          <div>
            <strong>NIGHT DRIVE RADIO</strong>
            <button
              aria-label="볼륨 설정 닫기"
              onClick={() => setSoundPanel(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            Han River Afterglow
            <br />
            <small>오리지널 시티팝 · CC0 · 104 BPM</small>
          </p>
          <label>
            BGM <span>{Math.round(profile.settings.music * 100)}%</span>
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
            엔진 / 효과음{' '}
            <span>{Math.round(profile.settings.engine * 100)}%</span>
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
          <a
            href={`${import.meta.env.BASE_URL}AUDIO-CREDITS.md`}
            target="_blank"
            rel="noreferrer"
          >
            음원 크레딧 ↗
          </a>
        </aside>
      )}
      {hud.mode === 'ready' && (
        <>
          <section className="garage-intro">
            <div className="eyebrow">SEOUL / CHAPTER 03</div>
            <h1>
              다음 코너엔,
              <br />
              <em>새로운 서울.</em>
            </h1>
            <p>강변에서 산길까지. 오늘의 코스를 고르세요.</p>
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
              {hud.error || '차량·가드레일 충돌 시 게임오버 · ENTER 출발'}
            </div>
          </section>
          <section className="route-picker" aria-label="맵 선택">
            <div className="picker-heading">
              <span>SELECT YOUR ROUTE</span>
              <span>03 COURSES</span>
            </div>
            {ROUTES.map((route) => {
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
                        {'★'.repeat(r?.stars || 0)}
                        {'☆'.repeat(3 - (r?.stars || 0))}
                      </b>
                    </span>
                    {r?.bestTime && <em>BEST {time(r.bestTime)}</em>}
                  </div>
                </button>
              );
            })}
            <p className="route-note">
              서울 명소를 재해석한 아케이드 코스입니다.
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
      {active && (
        <>
          <div className="race-top">
            <div>
              <span className="eyebrow">{course.config.subtitle}</span>
              <h2>{course.config.name}</h2>
              <span className="next-landmark">
                {nextLandmark
                  ? `${nextLandmark.name} · ${Math.max(0, Math.round(nextLandmark.at * course.length - hud.distance))} m`
                  : '마지막 코너 · 결승선으로'}
              </span>
            </div>
            <div className="timer">
              <span>RACE TIME</span>
              {time(hud.time)}
              <small>★ ★ ★ {time(course.config.target)} 이내</small>
            </div>
          </div>
          <div className="route-progress">
            <i style={{ width: `${(hud.distance / hud.length) * 100}%` }} />
          </div>
          <div className="live-route">
            <RouteMap id={hud.route} distance={hud.distance} />
            <span>
              {Math.abs(hud.curve) > 0.001
                ? hud.curve > 0
                  ? '우측 커브 ↗'
                  : '↖ 좌측 커브'
                : '직선 구간'}
            </span>
          </div>
          <div className="race-score">
            <strong>{hud.score.toLocaleString()}</strong>
            <span>SCORE · 추월 {hud.passed}</span>
          </div>
          {hud.notice && (
            <div className="race-notice" role="status">
              {hud.notice}
            </div>
          )}
          <div className="telemetry">
            <div className="speed">
              <b>{Math.round(hud.speed).toString().padStart(3, '0')}</b>
              <span>
                KM/H<small className="gear">GEAR {hud.gear}</small>
              </span>
            </div>
            <div className="meters">
              <label>
                <span>
                  BOOST <Zap size={12} />
                </span>
                <span>{Math.round(hud.nitro)}%</span>
              </label>
              <div>
                <i style={{ width: `${hud.nitro}%` }} />
              </div>
              <label>
                <span>NEAR MISS</span>
                <span>
                  {hud.nearMisses} · ×{hud.combo}
                </span>
              </label>
            </div>
          </div>
          <div className="remaining">
            <span>TO FINISH</span>
            <strong>
              {((hud.length - hud.distance) / 1000).toFixed(2)}
              <small> km</small>
            </strong>
          </div>
        </>
      )}
      {hud.mode === 'paused' && (
        <div className="overlay">
          <section className="result">
            <span className="eyebrow">PAUSED / {course.config.name}</span>
            <h2>잠시 쉬어가기</h2>
            <p>커브에서는 감속하세요. 한 번의 충돌로 레이스가 끝납니다.</p>
            <button
              className="start-button"
              onClick={() => engine.current?.pause()}
            >
              계속 달리기 <Play size={20} />
            </button>
            <button className="text-button" onClick={start}>
              처음부터 다시 시작
            </button>
            <button
              className="text-button secondary-action"
              onClick={() => engine.current?.garage()}
            >
              맵 선택으로
            </button>
          </section>
        </div>
      )}
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
                ? '서울의 밤을 완주했습니다.'
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
            <kbd>↑</kbd> 가속
          </span>
          <span>
            <kbd>A</kbd>
            <kbd>D</kbd> 조향
          </span>
          <span>
            <kbd>S</kbd> 제동
          </span>
          <span>
            <kbd>SPACE</kbd> 부스트
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
      {hud.mode === 'racing' && (
        <div className="touch-controls">
          <div>
            <button aria-label="왼쪽으로 조향" {...touch('arrowleft')}>
              <ArrowLeft />
            </button>
            <button aria-label="오른쪽으로 조향" {...touch('arrowright')}>
              <ArrowRight />
            </button>
          </div>
          <div>
            <button {...touch('arrowdown')}>제동</button>
            <button aria-label="부스트" className="boost-touch" {...touch(' ')}>
              <Zap size={19} />
            </button>
            <button {...touch('arrowup')}>가속</button>
          </div>
        </div>
      )}
    </main>
  );
}
