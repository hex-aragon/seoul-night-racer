import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type Mode='ready'|'racing'|'paused'|'finished';
export type Snapshot={mode:Mode;speed:number;distance:number;time:number;nitro:number;health:number;passed:number;gear:number;boost:boolean;loaded:boolean;error:string;camera:number};
export const FINISH=4200;
export const initial=():Snapshot=>({mode:'ready',speed:0,distance:0,time:0,nitro:100,health:100,passed:0,gear:1,boost:false,loaded:false,error:'',camera:0});
const clamp=T.MathUtils.clamp;
const rand=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
type Traffic={mesh:T.Group;x:number;z:number;hit:boolean;passed:boolean;speed:number};

export class RaceEngine {
 state=initial(); keys=new Set<string>(); muted=true;
 private renderer:T.WebGLRenderer;private scene=new T.Scene();private camera=new T.PerspectiveCamera(58,1,.1,1000);
 private composer:EffectComposer;private bloom:UnrealBloomPass;private resizeObserver:ResizeObserver;
 private player=new T.Group();private wheels:T.Object3D[]=[];private paint=new T.MeshPhysicalMaterial({color:0xf31931,metalness:.75,roughness:.23,clearcoat:1,clearcoatRoughness:.1});
 private chunks:T.Group[]=[];private traffic:Traffic[]=[];private model?:T.Object3D;private flames:T.Mesh[]=[];
 private draco=new DRACOLoader();private disposed=false;private frame=0;private last=0;private ui=0;private x=0;private steer=0;private hit=0;private environment:T.WebGLRenderTarget;
 private audio?:{ctx:AudioContext;osc:OscillatorNode;harmonic:OscillatorNode;filter:BiquadFilterNode;gain:GainNode};
 private speedLines:T.LineSegments;private lineData:Float32Array;private audioWanted=false;private headlights:T.SpotLight[]=[];private materials=new Map<string,T.MeshStandardMaterial>();
 constructor(private canvas:HTMLCanvasElement,private update:(s:Snapshot)=>void){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.85;
  this.scene.background=new T.Color('#101b35');this.scene.fog=new T.FogExp2('#14223a',.0048);
  const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.42;pmrem.dispose();room.dispose();
  this.scene.add(new T.HemisphereLight('#afcaff','#273349',.9));
  const moon=new T.DirectionalLight('#b4ccff',1.4);moon.position.set(-30,70,-80);this.scene.add(moon);
  const pink=new T.DirectionalLight('#ffa3b9',.6);pink.position.set(35,15,20);this.scene.add(pink);
  this.scene.add(this.player);this.player.position.set(this.x,0,0);
  this.buildCity();
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.25,.3,1.5);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.lineData=new Float32Array(90*6);this.speedLines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#a6dfff',transparent:true,opacity:0,depthWrite:false}));this.speedLines.geometry.setAttribute('position',new T.BufferAttribute(this.lineData,3));this.scene.add(this.speedLines);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
  this.camera.position.set(5,2.5,8);
  window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);
  this.draco.setDecoderPath(import.meta.env.BASE_URL+'draco/');this.draco.setWorkerLimit(2);
  this.loadCar();this.frame=requestAnimationFrame(this.tick);
 }
 private resize(){const {width,height}=this.canvas.getBoundingClientRect();this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.composer?.setSize(width,height);}
 private material(color:T.ColorRepresentation,emissive?:T.ColorRepresentation){const key=String(color)+String(emissive);let mat=this.materials.get(key);if(!mat){mat=new T.MeshStandardMaterial({color,roughness:.55,metalness:.18,...(emissive?{emissive,emissiveIntensity:1.3}: {})});this.materials.set(key,mat);}return mat;}
 private box(parent:T.Object3D,size:number[],position:number[],material:T.Material){const m=new T.Mesh(new T.BoxGeometry(...size as [number,number,number]),material);m.position.set(...position as [number,number,number]);parent.add(m);return m;}
 private textTexture(text:string,sub:string,color:string){const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d')!;g.fillStyle='#092732';g.fillRect(0,0,512,192);g.strokeStyle=color;g.lineWidth=8;g.strokeRect(8,8,496,176);g.fillStyle=color;g.textAlign='center';g.font='bold 58px Arial';g.fillText(text,256,87);g.fillStyle='#d9f3fa';g.font='22px Arial';g.fillText(sub,256,143);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}
 private windowTexture(seed:number){const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d')!;g.fillStyle='#131e30';g.fillRect(0,0,128,256);for(let y=4;y<256;y+=16)for(let x=4;x<128;x+=16){g.fillStyle=rand(x+y+seed)>.35?(rand(x*y+seed)>.65?'#ecb986':'#88bfd2'):'#203047';g.fillRect(x,y,8,8);}const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;return tex;}
 private buildCity(){
  const roadMat=new T.MeshPhysicalMaterial({color:'#111a29',metalness:.25,roughness:.45,envMapIntensity:.06,clearcoat:.25,clearcoatRoughness:.35});
  const curb=this.material('#677583'),sidewalk=this.material('#263447'),stripe=new T.MeshBasicMaterial({color:'#b4c7d7'}),yellow=new T.MeshBasicMaterial({color:'#ffb557'}),pole=this.material('#596d82');
  const facades=Array.from({length:8},(_,i)=>{const tex=this.windowTexture(i*90);return new T.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:'#9ecbff',emissiveIntensity:.3,roughness:.32,metalness:.65});});
  const signs=[['강남대로','GANGNAM-DAERO'],['서울의 밤','SEOUL AFTER DARK'],['청담','CHEONGDAM'],['한강공원','HANGANG PARK'],['도산대로','DOSAN-DAERO'],['남산터널','NAMSAN TUNNEL'],['반포대교','BANPO BRIDGE'],['테헤란로','TEHERAN-RO']];
  for(let i=0;i<10;i++){
   const chunk=new T.Group();chunk.position.z=100-i*80;this.chunks.push(chunk);this.scene.add(chunk);
   this.box(chunk,[22,.2,80],[0,-.13,-40],roadMat);
   for(const side of [-1,1]){
    this.box(chunk,[.3,.22,80],[side*11,.04,-40],curb);this.box(chunk,[6,.25,80],[side*14,.04,-40],sidewalk);
    this.box(chunk,[.09,.015,80],[side*10.5,.012,-40],yellow);
    this.box(chunk,[.06,.03,80],[side*11.2,.2,-40],this.material('#3affdc','#3affdc'));
    for(let j=0;j<5;j++){
     const seed=i*100+j*7+(side+1)*31,bw=8+rand(seed)*8,bh=18+rand(seed+1)*94,z=-j*17;
     this.box(chunk,[bw,bh,12],[side*(19+bw/2),bh/2,z],facades[(i+j)%8]);
     this.box(chunk,[bw+1,.7,13],[side*(19+bw/2),bh,z],this.material('#334c6b'));
     if(j%2===0){const txt=signs[(i+j)%8],tex=this.textTexture(txt[0],txt[1],side<0?'#69fff2':'#ffaacb'),mat=new T.MeshBasicMaterial({map:tex,toneMapped:false});const sign=this.box(chunk,[.12,3.2,8],[side*18.7,8,z],mat);sign.rotation.y=side<0?0:Math.PI;}
     // Street-level storefronts and a lit canopy.
     this.box(chunk,[2.3,3.8,11],[side*18,2,z],this.material('#304957'));
     this.box(chunk,[2.8,.12,11],[side*17.8,4,z],this.material('#75d4ee','#75d4ee'));
    }
    for(let j=0;j<2;j++){
     const z=-j*40;this.box(chunk,[.16,8,.16],[side*11.9,4,z],pole);this.box(chunk,[3.3,.1,.14],[side*10.3,8,z],pole);this.box(chunk,[1.8,.07,.3],[side*9.5,7.96,z],this.material('#e3f1ff','#e3f1ff'));
     const glow=new T.Mesh(new T.PlaneGeometry(1.5,16),new T.MeshBasicMaterial({color:side>0?'#50adcc':'#d6779c',transparent:true,opacity:.09,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.set(side*7.5,.015,z+5);chunk.add(glow);
    }
   }
   for(const lane of [-6,-2,2,6])for(let j=0;j<8;j++)this.box(chunk,[.12,.018,4],[lane,.02,-j*10],stripe);
   if(i%3===0){for(let j=0;j<14;j++)this.box(chunk,[.7,.02,5],[-9+j*1.4,.025,-63],stripe);}
   if(i%3===1){
    this.box(chunk,[.28,8,.28],[-10,4,-50],pole);this.box(chunk,[.28,8,.28],[10,4,-50],pole);this.box(chunk,[20,.3,.3],[0,8,-50],pole);
    const tex=this.textTexture(signs[i%8][0]+' ↑','SEOUL CITY CIRCUIT  /  60', '#c3ffda');const sign=new T.Mesh(new T.PlaneGeometry(8,3),new T.MeshBasicMaterial({map:tex}));sign.position.set(0,7,-50);chunk.add(sign);
   }
   if(i===4||i===8){this.box(chunk,[55,2.5,9],[0,13,-20],this.material('#23374c'));for(const side of [-1,1])this.box(chunk,[2,13,2],[side*15,6,-20],curb);}
  }
  // Merge static meshes sharing materials to keep city draw calls bounded.
  for(const chunk of this.chunks){
   chunk.updateMatrixWorld(true);
   const groups=new Map<T.Material,T.Mesh[]>();
   for(const child of chunk.children){if(child instanceof T.Mesh&&!Array.isArray(child.material)){const list=groups.get(child.material)||[];list.push(child);groups.set(child.material,list);}}
   for(const [material,meshes] of groups){if(meshes.length<2)continue;const inputs=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrix));const geometry=mergeGeometries(inputs);inputs.forEach(g=>g.dispose());if(geometry){for(const m of meshes){chunk.remove(m);m.geometry.dispose();}chunk.add(new T.Mesh(geometry,material));}}
  }
  // Seoul skyline landmarks beyond the street canyon.
  const tower=new T.Group();tower.position.set(-95,0,-520);this.scene.add(tower);
  this.box(tower,[12,80,12],[0,40,0],this.material('#526c8d'));
  const shaft=new T.Mesh(new T.CylinderGeometry(1.8,3,100,12),this.material('#94a6bb'));shaft.position.y=126;tower.add(shaft);
  const deck=new T.Mesh(new T.CylinderGeometry(13,10,7,16),this.material('#a8d8f7','#467fab'));deck.position.y=155;tower.add(deck);this.box(tower,[.8,45,.8],[0,185,0],this.material('#ed828d','#ed828d'));
  const skyscraper=new T.Mesh(new T.ConeGeometry(18,240,4),this.material('#617695'));skyscraper.position.set(125,120,-600);this.scene.add(skyscraper);
  const moon=new T.Mesh(new T.SphereGeometry(9,24,24),new T.MeshBasicMaterial({color:'#dce8ff'}));moon.position.set(170,170,-650);this.scene.add(moon);
 }
 private loadCar(){
  new GLTFLoader().setDRACOLoader(this.draco).load(import.meta.env.BASE_URL+'models/ferrari.glb',gltf=>{
   if(this.disposed){this.disposeObject(gltf.scene);return;}
   const model=gltf.scene;
   model.traverse(o=>{if(o instanceof T.Mesh){o.frustumCulled=true;const n=o.name;
    if(n==='body')o.material=this.paint;
    else if(n==='glass')o.material=new T.MeshPhysicalMaterial({color:'#152332',metalness:.25,roughness:.07,transparent:true,opacity:.88,clearcoat:1});
    else if(n==='lights_red')o.material=new T.MeshStandardMaterial({color:'#ff172a',emissive:'#ff1020',emissiveIntensity:2});
    else if(n==='lights'||n==='leds')o.material=new T.MeshStandardMaterial({color:'#f0f7ff',emissive:'#d9efff',emissiveIntensity:1.8});
   }});
   const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());const scale=4.6/size.z;model.scale.setScalar(scale);bounds.setFromObject(model);model.position.y=-bounds.min.y+.04;model.position.x=-(bounds.min.x+bounds.max.x)/2;model.position.z=-(bounds.min.z+bounds.max.z)/2;
   this.model=model;this.player.add(model);
   ['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].forEach(n=>{const wheel=model.getObjectByName(n);if(wheel)this.wheels.push(wheel);});
   const shadow=new T.Mesh(new T.PlaneGeometry(3.4,6),new T.MeshBasicMaterial({map:new T.TextureLoader().load(import.meta.env.BASE_URL+'models/ferrari_ao.png'),transparent:true,depthWrite:false,premultipliedAlpha:true,toneMapped:false,blending:T.MultiplyBlending}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;this.player.add(shadow);
   for(const x of [-.7,.7]){
    const head=new T.SpotLight('#c0dcff',45,65,.3,.6,1.2);head.position.set(x,.6,-1.9);head.target.position.set(x,.05,-35);this.player.add(head,head.target);this.headlights.push(head);
    const flame=new T.Mesh(new T.ConeGeometry(.12,.9,10),new T.MeshBasicMaterial({color:'#5fecff',transparent:true,opacity:.9}));flame.rotation.x=Math.PI/2;flame.position.set(x,.32,2.6);this.player.add(flame);this.flames.push(flame);
   }
   const under=new T.PointLight('#ff2046',.5,5,2);under.position.set(0,.4,2);this.player.add(under);
   for(let i=0;i<5;i++){
    const mesh=new T.Group();const clone=model.clone(true);clone.traverse(o=>{if(o instanceof T.Mesh&&o.name==='body')o.material=new T.MeshPhysicalMaterial({color:['#cbd3df','#f8ad36','#24709d','#383c46'][i%4],metalness:.65,roughness:.3,clearcoat:1});});const lod=new T.LOD();lod.addLevel(clone,0);const proxy=new T.Group(),mat=this.material(['#cbd3df','#f8ad36','#24709d','#383c46'][i%4]);this.box(proxy,[1.85,.55,4.4],[0,.6,0],mat);this.box(proxy,[1.5,.5,2],[0,1,.15],this.material('#1b2a3d'));for(const x of [-.69,.69])this.box(proxy,[.35,.12,.05],[x,.72,2.21],this.material('#ff1c43','#ff1c43'));lod.addLevel(proxy,85);mesh.add(lod);this.scene.add(mesh);this.traffic.push({mesh,x:[-8,-4,0,4,8][i%5],z:-85-i*67,hit:false,passed:false,speed:18+rand(i)*13});
   }
   this.state.loaded=true;this.update({...this.state});
  },undefined,()=>{if(!this.disposed){this.state.error='차량을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';this.update({...this.state});}});
 }
 start=()=>{if(!this.state.loaded)return;const camera=this.state.camera;this.state={...initial(),loaded:true,mode:'racing',camera};this.x=0;this.steer=0;this.hit=0;this.keys.clear();this.traffic.forEach((c,i)=>{c.z=-85-i*67;c.hit=false;c.passed=false;});this.update({...this.state});if(this.audioWanted)void this.audio?.ctx.resume();};
 pause=()=>{if(this.state.mode==='racing')this.state.mode='paused';else if(this.state.mode==='paused')this.state.mode='racing';this.keys.clear();this.update({...this.state});};
 setColor=(color:string)=>this.paint.color.set(color);
 changeCamera=()=>{this.state.camera=(this.state.camera+1)%2;this.camera.position.set(this.player.position.x,this.state.camera?1.3:2.2,this.state.camera?-1.6:6.6);this.update({...this.state});};
 setSound=()=>{this.muted=!this.muted;this.audioWanted=!this.muted;if(!this.audio){const ctx=new AudioContext(),osc=ctx.createOscillator(),harmonic=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type='sawtooth';harmonic.type='triangle';filter.type='lowpass';filter.frequency.value=700;gain.gain.value=0;osc.connect(filter);harmonic.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();harmonic.start();this.audio={ctx,osc,harmonic,filter,gain};}void this.audio.ctx.resume();return this.muted;};
 private keydown=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();const k=e.key.toLowerCase();this.keys.add(k);if(e.repeat)return;if(k==='enter'&&(this.state.mode==='ready'||this.state.mode==='finished'))this.start();if(k==='p'||k==='escape')this.pause();if(k==='c')this.changeCamera();};
 private keyup=(e:KeyboardEvent)=>this.keys.delete(e.key.toLowerCase());
 private blur=()=>{this.keys.clear();if(this.state.mode==='racing')this.pause();};
 private visibility=()=>{if(document.hidden)this.blur();};
 private tick=(t:number)=>{
  if(this.disposed)return;const dt=Math.min((t-this.last)/1000||0,.15);this.last=t;const s=this.state,k=this.keys;
  if(s.mode==='racing'){
   s.time+=dt;this.hit=Math.max(0,this.hit-dt);const gas=k.has('w')||k.has('arrowup'),brake=k.has('s')||k.has('arrowdown');s.boost=k.has(' ')&&s.nitro>1&&s.speed>25&&!brake;
   const cap=s.boost?340:285;s.speed=clamp(s.speed+(brake?-185:s.boost?120:gas?90:-28)*dt,0,340);if(s.speed>cap)s.speed=Math.max(cap,s.speed-80*dt);
   s.nitro=clamp(s.nitro+(s.boost?-24:10)*dt,0,100);
   const input=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0);this.steer=T.MathUtils.damp(this.steer,input,7,dt);this.x=clamp(this.x+this.steer*(2+s.speed*.036)*dt,-10.2,10.2);
   if(Math.abs(this.x)>9.7&&s.speed>20){s.speed=Math.max(20,s.speed-100*dt);s.health=Math.max(0,s.health-9*dt);this.hit=.12;}
   s.distance+=s.speed/3.6*dt;s.gear=Math.min(7,1+Math.floor(s.speed/46));
   for(const car of this.traffic){const old=car.z;car.z+=(s.speed/3.6-car.speed)*dt;
    if(!car.hit&&this.hit<=0&&Math.min(old,car.z)<4.4&&Math.max(old,car.z)>-4.4&&Math.abs(car.x-this.x)<1.95){car.hit=true;s.speed*=.42;s.health=Math.max(0,s.health-22);this.hit=.8;}
    if(!car.passed&&car.z>5){car.passed=true;if(!car.hit)s.passed++;}
    if(car.z>45||car.z< -800){car.z=-570-rand(t)*90;car.x=[-8,-4,0,4,8][Math.floor(rand(t+car.speed)*5)];car.hit=false;car.passed=false;}
   }
   if(s.distance>=FINISH||s.health<=0){s.distance=Math.min(FINISH,s.distance);s.mode='finished';s.speed=0;s.boost=false;this.keys.clear();}
  }else s.boost=false;
  const dist=s.distance;this.chunks.forEach((chunk,i)=>{chunk.position.z=((100-i*80+dist+800)%800)-700;});
  this.traffic.forEach(c=>{c.mesh.position.set(c.x,0,c.z);});
  this.player.position.x=T.MathUtils.damp(this.player.position.x,this.x,10,dt);this.player.rotation.y=T.MathUtils.damp(this.player.rotation.y,-this.steer*.11*(s.speed/150),6,dt);this.player.rotation.z=T.MathUtils.damp(this.player.rotation.z,-this.steer*.022,7,dt);
  this.wheels.forEach(w=>{if(s.mode==='racing')w.rotation.x-=s.speed/3.6*dt/.34;});this.flames.forEach(f=>{f.visible=s.boost;f.scale.y=1+Math.sin(t*.08)*.25;});
  const ready=s.mode==='ready';const hood=s.camera===1&&!ready;
  const narrow=this.camera.aspect<.8;const desired=new T.Vector3(ready?this.x+6:this.player.position.x*.82,ready?2.3:hood?1.3:2.2,ready?(narrow?11:7.8):hood?-1.6:6.6+(s.boost?.6:0));
  this.camera.position.lerp(desired,1-Math.exp(-dt*4));const target=new T.Vector3(ready?this.x-(narrow?0:2.2):this.player.position.x*.92,ready?(narrow?1.5:.6):hood?.95:1,ready?0:-22);
  this.camera.lookAt(target);this.camera.fov=T.MathUtils.damp(this.camera.fov,ready?46:hood?78:58+s.speed*.043+(s.boost?5:0),4,dt);this.camera.updateProjectionMatrix();
  if(this.hit>0){this.camera.position.x+=Math.sin(t*.08)*this.hit*.1;this.camera.position.y+=Math.cos(t*.07)*this.hit*.04;}
  const lineMat=this.speedLines.material as T.LineBasicMaterial;lineMat.opacity=s.boost?.32:s.speed>210?.08:0;
  if(lineMat.opacity>0){for(let i=0;i<90;i++){const ix=i*6,side=i%2?1:-1,x=this.x+side*(4+rand(i)*13),y=1+rand(i+99)*9,z=8-((t*.12+rand(i+19)*80)%80);this.lineData.set([x,y,z,x,y,z-(s.boost?8:3)],ix);}this.speedLines.geometry.attributes.position.needsUpdate=true;}
  if(this.audio){const rpm=60+(s.speed%46)*3+s.gear*8;this.audio.osc.frequency.setTargetAtTime(rpm,this.audio.ctx.currentTime,.05);this.audio.harmonic.frequency.setTargetAtTime(rpm*2.01,this.audio.ctx.currentTime,.05);this.audio.filter.frequency.value=450+s.speed*6;this.audio.gain.gain.setTargetAtTime(!this.muted&&s.mode==='racing'?.035:0,this.audio.ctx.currentTime,.05);}
  this.composer.render();if(t-this.ui>85){this.ui=t;this.canvas.dataset.mode=s.mode;this.canvas.dataset.speed=String(Math.round(s.speed));this.canvas.dataset.loaded=String(s.loaded);this.canvas.dataset.drawcalls=String(this.renderer.info.render.calls);this.canvas.dataset.camera=String(s.camera);this.update({...s});}
  this.frame=requestAnimationFrame(this.tick);
 };
 private disposeObject(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){geometries.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material]){materials.add(mat);Object.values(mat).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);this.draco.dispose();this.disposeObject(this.scene);this.environment.dispose();this.composer.passes.forEach(p=>p.dispose());this.composer.dispose();this.renderer.dispose();void this.audio?.ctx.close();}
}
