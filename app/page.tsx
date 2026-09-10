'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Pause, Play, RotateCcw, Volume2, VolumeX, ArrowLeft, ArrowRight, Zap } from 'lucide-react';

type Mode = 'ready' | 'racing' | 'paused' | 'finished';
type Car = { z:number; x:number; color:string; hit:boolean };
type Race = { mode:Mode; speed:number; distance:number; time:number; x:number; nitro:number; health:number; hit:number; cars:Car[]; spawn:number; passed:number };
const fresh = ():Race => ({mode:'ready',speed:0,distance:0,time:0,x:0,nitro:100,health:100,hit:0,cars:[],spawn:0,passed:0});
const zones = ['여의도 · 한강대로', '반포 · 잠수교', '남산 · 도심 순환', '강남 · 테헤란로'];
const FINISH = 4200;
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

export default function Home(){
 const canvas=useRef<HTMLCanvasElement>(null), race=useRef<Race>(fresh()), keys=useRef(new Set<string>()), sound=useRef(false);
 const [hud,setHud]=useState({mode:'ready' as Mode,speed:0,distance:0,time:0,nitro:100,health:100,passed:0});
 const [muted,setMuted]=useState(true);
 const audio=useRef<{ctx:AudioContext;osc:OscillatorNode;gain:GainNode}|null>(null);
 const start=()=>{race.current={...fresh(),mode:'racing'};keys.current.clear();};
 const pause=()=>{const r=race.current;if(r.mode==='racing')r.mode='paused';else if(r.mode==='paused')r.mode='racing';keys.current.clear();};
 const toggleSound=()=>{sound.current=!sound.current;setMuted(!sound.current);if(!audio.current){const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sawtooth';gain.gain.value=0;osc.connect(gain);gain.connect(ctx.destination);osc.start();audio.current={ctx,osc,gain};}void audio.current.ctx.resume();};
 useEffect(()=>{
  const c=canvas.current!,g=c.getContext('2d')!;let w=1200,h=800,frame=0,last=0,ui=0;
  const resize=()=>{const box=c.getBoundingClientRect();w=box.width;h=box.height;const d=Math.min(devicePixelRatio,2);c.width=w*d;c.height=h*d;g.setTransform(d,0,0,d,0,0);};
  const observer=new ResizeObserver(resize);observer.observe(c);resize();
  const down=(e:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.repeat&&['p','Escape','Enter'].includes(e.key))return;keys.current.add(e.key.toLowerCase());if(e.key==='Enter'&&(race.current.mode==='ready'||race.current.mode==='finished'))start();if(e.key==='Escape'||e.key.toLowerCase()==='p')pause();};
  const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
  const blur=()=>{keys.current.clear();if(race.current.mode==='racing')race.current.mode='paused';};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  const polygon=(points:number[][],color:string)=>{g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
  const car=(x:number,y:number,s:number,color:string,player=false)=>{
   g.save();g.translate(x,y);g.scale(s,s);g.fillStyle='#01040c';g.beginPath();g.ellipse(0,3,56,13,0,0,Math.PI*2);g.fill();
   g.fillStyle='#02030b';g.fillRect(-48,-32,14,40);g.fillRect(34,-32,14,40);
   polygon([[-45,2],[-46,-28],[-32,-48],[-24,-68],[24,-68],[32,-48],[46,-28],[45,2]],color);
   polygon([[-28,-48],[-21,-64],[21,-64],[28,-48]],'#0b1a2b');
   g.fillStyle='#83c2d5';g.globalAlpha=.3;g.fillRect(-20,-62,39,2);g.globalAlpha=1;
   polygon([[-40,-26],[-31,-45],[31,-45],[40,-26]],player?'#a2acc1':'#53647d');
   g.fillStyle='#121723';g.fillRect(-41,-13,82,12);g.fillStyle='#080c16';g.fillRect(-30,-34,60,3);
   g.shadowBlur=14;g.shadowColor='#ff354d';g.fillStyle='#ff3557';g.fillRect(-39,-19,27,5);g.fillRect(12,-19,27,5);g.shadowBlur=0;
   g.fillStyle='#c5d7d3';g.fillRect(-10,-10,20,6);g.fillStyle='#343b48';g.fillRect(-36,-76,72,5);g.fillRect(-29,-76,3,15);g.fillRect(26,-76,3,15);
   if(player&&keys.current.has(' ')&&race.current.nitro>0&&race.current.speed>40&&race.current.mode==='racing'){g.shadowBlur=24;g.shadowColor='#54eaff';polygon([[-31,0],[-18,0],[-25,35+Math.random()*35]],'#81f9ff');polygon([[18,0],[31,0],[25,35+Math.random()*35]],'#81f9ff');}
   g.restore();
  };
  const tick=(t:number)=>{
   const dt=Math.min((t-last)/1000||0,0.05);last=t;const r=race.current,k=keys.current;
   if(r.mode==='racing'){
    r.time+=dt;r.hit=Math.max(0,r.hit-dt);const boost=k.has(' ')&&r.nitro>0&&r.speed>40;const throttle=k.has('arrowup')||k.has('w');const brake=k.has('arrowdown')||k.has('s');
    r.speed=clamp(r.speed+(boost?80:throttle?48:-18)*dt-(brake?125*dt:0),0,boost?310:220);
    r.nitro=clamp(r.nitro+(boost?-30:12)*dt,0,100);
    const steering=(k.has('arrowright')||k.has('d')?1:0)-(k.has('arrowleft')||k.has('a')?1:0);
    r.x=clamp(r.x+steering*dt*(.5+r.speed/190),-1.25,1.25);
    if(Math.abs(r.x)>1){r.speed=Math.max(0,r.speed-70*dt);r.health=Math.max(0,r.health-4*dt);}
    const travel=r.speed/3.6*dt;r.distance+=travel;r.spawn+=travel;
    if(r.spawn>100){r.spawn=0;r.cars.push({z:850,x:[-.67,0,.67][Math.floor(Math.random()*3)],color:['#d4ccaa','#698cff','#dd4f69','#41ac99'][Math.floor(Math.random()*4)],hit:false});}
    r.cars.forEach(o=>{const old=o.z;o.z-=(r.speed/3.6-12)*dt;if(old>20&&o.z<=20&&Math.abs(o.x-r.x)<.26&&!o.hit){o.hit=true;r.speed*=.45;r.health=Math.max(0,r.health-24);r.hit=.65;}if(old>=-15&&o.z< -15&&!o.hit)r.passed++;});r.cars=r.cars.filter(o=>o.z> -35&&o.z<1500);
    if(r.distance>=FINISH||r.health<=0){r.distance=Math.min(r.distance,FINISH);r.mode='finished';r.speed=0;keys.current.clear();}
   }
   if(audio.current){audio.current.osc.frequency.value=35+r.speed*.55;audio.current.gain.gain.value=sound.current&&r.mode==='racing'?.025:0;}
   const horizon=h*.43;const drift=Math.sin(r.distance/900)*w*.08;const center=w/2-r.x*w*.10;const far=center+drift;
   const sky=g.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#050b18');sky.addColorStop(.7,'#162a42');sky.addColorStop(1,'#b36579');g.fillStyle=sky;g.fillRect(0,0,w,h);
   g.fillStyle='#c5d6e8';for(let i=0;i<65;i++){const sx=(Math.sin(i*97.23)*.5+.5)*w,sy=(Math.cos(i*47.31)*.5+.5)*horizon*.7;g.globalAlpha=.25+(i%4)*.13;g.fillRect(sx,sy,i%5===0?2:1,1);}g.globalAlpha=1;
   g.fillStyle='#e5dcd0';g.shadowBlur=35;g.shadowColor='#e5dcd0';g.beginPath();g.arc(w*.78,h*.17,19,0,Math.PI*2);g.fill();g.shadowBlur=0;
   polygon([[0,horizon],[w*.17,horizon-55],[w*.28,horizon-24],[w*.47,horizon-85],[w*.60,horizon-35],[w*.73,horizon-47],[w,horizon]],'#12223a');
   for(let layer=0;layer<2;layer++)for(let i=0;i<28;i++){
    const bw=w/24, bx=i*bw-w*.07-r.x*(layer+1)*5, bh=30+(Math.sin(i*7.9+layer)*.5+.5)*(layer?120:165),by=horizon-bh+layer*12;
    g.fillStyle=layer?'#101c31':'#1c2a42';g.fillRect(bx,by,bw*.85,bh);
    for(let xx=5;xx<bw*.8;xx+=9)for(let yy=8;yy<bh-6;yy+=12)if(Math.sin(i*34+xx*yy)>.15){g.fillStyle=(i+xx)%3?'#5a748e':'#c19880';g.globalAlpha=.45;g.fillRect(bx+xx,by+yy,3,4);}g.globalAlpha=1;
   }
   // N Seoul Tower remains a recognizable route landmark.
   const tower=w*.44-r.x*8;g.fillStyle='#729eaa';g.fillRect(tower,horizon-202,5,133);g.fillRect(tower-10,horizon-169,25,9);g.fillRect(tower-6,horizon-180,17,9);g.fillStyle='#ecac9d';g.fillRect(tower+1,horizon-226,2,27);
   const road=(p:number)=>({y:horizon+(h-horizon)*p*p,half:w*(.025+.57*p*p),x:far+(center-far)*p*p});
   g.fillStyle='#17293b';g.fillRect(0,horizon,w,h-horizon);
   for(let i=0;i<70;i++){const a=road(i/70),b=road((i+1)/70);const alt=Math.floor(r.distance/10+i/3)%2;
    polygon([[a.x-a.half,a.y],[a.x+a.half,a.y],[b.x+b.half,b.y],[b.x-b.half,b.y]],alt?'#1c2636':'#1e293a');
    for(const side of [-1,1])polygon([[a.x+side*a.half,a.y],[a.x+side*a.half*1.03,a.y],[b.x+side*b.half*1.03,b.y],[b.x+side*b.half,b.y]],alt?'#d09183':'#54657b');
    if(Math.floor(r.distance/9+i/2)%3!==0)for(const lane of [-1/3,1/3])polygon([[a.x+a.half*lane-1,a.y],[a.x+a.half*lane+1,a.y],[b.x+b.half*lane+Math.max(1,b.half*.005),b.y],[b.x+b.half*lane-Math.max(1,b.half*.005),b.y]],'#8a9cac');
   }
   // Lamps use the same perspective and travel as the road.
   for(let i=0;i<12;i++){const z=(i*85-r.distance%85+1020)%1020,p=1/(1+z/95),a=road(Math.sqrt(p));for(const side of [-1,1]){const x=a.x+side*a.half*1.18,lh=140*p;g.strokeStyle='#44546d';g.lineWidth=Math.max(1,p*5);g.beginPath();g.moveTo(x,a.y);g.lineTo(x,a.y-lh);g.lineTo(x-side*30*p,a.y-lh-8*p);g.stroke();g.fillStyle='#ffdbb6';g.shadowColor='#ffa775';g.shadowBlur=15*p;g.fillRect(x-side*30*p-5*p,a.y-lh-8*p,12*p,4*p);g.shadowBlur=0;}}
   const sign=road(.29);g.strokeStyle='#4e6880';g.lineWidth=3;g.beginPath();g.moveTo(sign.x-sign.half*1.5,sign.y+12);g.lineTo(sign.x-sign.half*1.5,sign.y-57);g.lineTo(sign.x+sign.half*1.5,sign.y-57);g.lineTo(sign.x+sign.half*1.5,sign.y+12);g.stroke();g.fillStyle='#135150';g.fillRect(sign.x-100,sign.y-66,200,44);g.strokeStyle='#729a9a';g.strokeRect(sign.x-100,sign.y-66,200,44);g.fillStyle='#eef5e9';g.textAlign='center';g.font='bold 14px sans-serif';g.fillText(zones[Math.min(3,Math.floor(r.distance/1050))]+'  ↑',sign.x,sign.y-45);g.font='9px sans-serif';g.fillText('SEOUL CITY CIRCUIT',sign.x,sign.y-31);
   const traffic=r.mode==='ready'?[{z:175,x:-.67,color:'#dc786a',hit:false},{z:320,x:.67,color:'#8aafd7',hit:false}]:r.cars;
   [...traffic].sort((a,b)=>b.z-a.z).forEach(o=>{if(o.z<0)return;const p=1/(1+o.z/95),a=road(Math.sqrt(p));car(a.x+o.x*a.half,a.y,Math.max(.06,p*w/650),o.color);});
   const playerScale=Math.min(w/590,h/420), playerPoint=road(Math.sqrt(.825));car(playerPoint.x+r.x*playerPoint.half,playerPoint.y+Math.sin(t*.04)*r.speed*.004,playerScale,'#c3c9d5',true);
   if(r.hit>0){g.fillStyle=`rgba(255,60,65,${r.hit*.35})`;g.fillRect(0,0,w,h);}
   const shade=g.createLinearGradient(0,h*.72,0,h);shade.addColorStop(0,'#060c1500');shade.addColorStop(1,'#060c15bb');g.fillStyle=shade;g.fillRect(0,0,w,h);
   if(t-ui>80){ui=t;setHud({mode:r.mode,speed:Math.round(r.speed),distance:r.distance,time:r.time,nitro:r.nitro,health:r.health,passed:r.passed});}
   frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);if(audio.current)audio.current.gain.gain.value=0;};
 },[]);
 useEffect(()=>{
  type Context={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>Promise<unknown>},options:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document & {modelContext?:Context}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const register=async()=>{try{await context.registerTool({name:'control_seoul_race',description:'Start, pause, resume, or read telemetry for the Seoul race.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['start','pause','resume','status']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{
    if(typeof input!=='object'||input===null||!('action' in input)||Object.keys(input).length!==1)throw new Error('Expected only an action.');
    const action=(input as {action:unknown}).action;
    if(!['start','pause','resume','status'].includes(String(action)))throw new Error('Unknown race action.');
    if(action==='start')start();
    if(action==='pause'&&race.current.mode==='racing')pause();
    if(action==='resume'&&race.current.mode==='paused')pause();
    const r=race.current;setHud({mode:r.mode,speed:Math.round(r.speed),distance:r.distance,time:r.time,nitro:r.nitro,health:r.health,passed:r.passed});
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    return {mode:r.mode,distanceMeters:Math.round(r.distance),speedKmh:Math.round(r.speed),timeSeconds:r.time};
  }},{signal:lifecycle.signal});}catch(error){console.warn('Race tool unavailable',error);}};
  void register();return()=>lifecycle.abort();
 },[]);
 const touch=(key:string)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key);},onPointerUp:()=>keys.current.delete(key),onPointerCancel:()=>keys.current.delete(key),onLostPointerCapture:()=>keys.current.delete(key)});
 const active=hud.mode==='racing'||hud.mode==='paused';
 return <main className="game-shell">
  <canvas ref={canvas} aria-label="서울 야경 레이싱 트랙"/>
  <div className="grain"/>
  <header className="topbar"><a className="brand" href="/">S<span>／</span>MR <small>SEOUL MIDNIGHT RUN</small></a><div className="top-actions"><span className="live-dot"/> <span className="edition">NIGHT DRIVE · 01</span><button onClick={toggleSound} aria-label={muted?'소리 켜기':'소리 끄기'}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>{active&&<button onClick={pause} aria-label={hud.mode==='paused'?'계속하기':'일시정지'}>{hud.mode==='paused'?<Play size={19}/>:<Pause size={19}/>}</button>}</div></header>
  {hud.mode==='ready'&&<section className="start-panel"><div className="eyebrow"><span/> SEOUL, AFTER HOURS</div><h1>도시가 잠든 뒤,<br/><em>레이스가 시작된다.</em></h1><p>한강에서 강남까지, 4.2km의 서울 야간 서킷.<br/>차량을 피하고 부스트로 기록을 단축하세요.</p><button className="start-button" onClick={start}>레이스 시작 <ArrowUpRight size={24}/></button><div className="enter-hint">ENTER 를 눌러 출발</div></section>}
  {active&&<><div className="race-top"><div><span className="eyebrow">CURRENT SECTOR / 0{Math.min(4,Math.floor(hud.distance/1050)+1)}</span><h2>{zones[Math.min(3,Math.floor(hud.distance/1050))]}</h2></div><div className="timer"><span>RACE TIME</span>{formatTime(hud.time)}</div></div><div className="route-progress"><i style={{width:`${hud.distance/FINISH*100}%`}}/></div><div className="telemetry"><div className="speed"><b>{hud.speed.toString().padStart(3,'0')}</b><span>KM/H</span></div><div className="meters"><label><span>BOOST <Zap size={12}/></span><span>{Math.round(hud.nitro)}%</span></label><div><i style={{width:`${hud.nitro}%`}}/></div><label><span>차량 상태</span><span>{Math.round(hud.health)}%</span></label><div className="health"><i style={{width:`${hud.health}%`}}/></div></div></div><div className="remaining"><span>TO FINISH</span><strong>{((FINISH-hud.distance)/1000).toFixed(2)}<small> km</small></strong></div></>}
  {hud.mode==='paused'&&<div className="overlay"><section className="result"><span className="eyebrow">TAKE A BREATHER</span><h2>잠시 쉬어가기</h2><p>준비되면 서울의 밤을 계속 달리세요.</p><button className="start-button" onClick={pause}>계속 달리기 <Play size={20}/></button><button className="text-button" onClick={start}>처음부터 다시 시작</button></section></div>}
  {hud.mode==='finished'&&<div className="overlay"><section className="result"><span className="eyebrow">{hud.health>0?'CIRCUIT COMPLETE':'RUN ENDED'}</span><h2>{hud.health>0?'서울의 밤을 완주했습니다.':'이번 주행은 여기까지.'}</h2><p>{hud.health>0?'다음 레이스에서 새로운 기록에 도전하세요.':'차량이 파손되었습니다. 교통량을 살피며 다시 도전하세요.'}</p><div className="result-stats"><div><span>주행 시간</span><b>{formatTime(hud.time)}</b></div><div><span>주행 거리</span><b>{(hud.distance/1000).toFixed(2)} km</b></div><div><span>추월</span><b>{hud.passed}</b></div></div><button className="start-button" onClick={start}>다시 달리기 <RotateCcw size={20}/></button></section></div>}
  <footer className="bottom-bar"><div className="coordinates">37°33′ N &nbsp; 126°58′ E <span>서울, 대한민국</span></div><div className="keyboard-guide"><span><kbd>W</kbd><kbd>↑</kbd> 가속</span><span><kbd>A</kbd><kbd>D</kbd> 조향</span><span><kbd>S</kbd> 브레이크</span><span><kbd>SPACE</kbd> 부스트</span><span><kbd>P</kbd> 일시정지</span></div><span className="circuit-label">SEOUL CITY CIRCUIT <i>↗</i></span></footer>
  {hud.mode==='racing'&&<div className="touch-controls"><div><button aria-label="왼쪽으로 조향" {...touch('arrowleft')}><ArrowLeft/></button><button aria-label="오른쪽으로 조향" {...touch('arrowright')}><ArrowRight/></button></div><div><button {...touch('arrowdown')}>제동</button><button className="boost-touch" {...touch(' ')}><Zap size={19}/></button><button {...touch('arrowup')}>가속</button></div></div>}
 </main>;
}
function formatTime(t:number){return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}.${Math.floor(t%1*100).toString().padStart(2,'0')}`;}
