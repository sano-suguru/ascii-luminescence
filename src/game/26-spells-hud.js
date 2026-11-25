// ---------------------------------------------------------------- spells meet the world: doors stop them, sight lines matter, ice freezes water and puts out fire, thunder runs through water, fire lights poison mist
// doorAt is the door number of each cell (-1 where there is no door), as generate() made it
function doorBlock(ci){ const di=here.D.doorAt[ci], d=di>=0?here.D.doors[di]:null; return !!d&&!d.gone&&d.o<0.5; }
function losClear(ax,ay,az,bx,by,bz){ const d=Math.hypot(bx-ax,by-ay,bz-az), n=Math.ceil(d/0.3);
  for(let k=1;k<n;k++){ const f=k/n, x=ax+(bx-ax)*f, y=ay+(by-ay)*f, z=az+(bz-az)*f, ci=Math.floor(z/CELL)*MW+Math.floor(x/CELL); if(ci<0||ci>=NCELL)return false;
    const tt=here.D.tile[ci]; if(tt===TW||tt===TX||doorBlock(ci)||y>here.D.ceil[ci])return false; }
  return true; }
// mCenter は src/lib/math.ts（src/game/imports.mjs で読む）
function beamFrame(h){ const o=handPoint(h), a=assistPoint(o,'beam')||aimPoint(), dx=a[0]-o[0], dy=a[1]-o[1], dz=a[2]-o[2], l=Math.hypot(dx,dy,dz); return {o,d:l>1?[dx/l,dy/l,dz/l]:viewDir()}; }
// ice: puts out fire, freezes water for a while (walkable, slippery); fire melts it again
function chillArea(x,z,r){ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL), rr=Math.ceil(r/CELL)+1; let ch=false, froze=false;
  for(let dz=-rr;dz<=rr;dz++)for(let dx=-rr;dx<=rr;dx++){ if(cx+dx<0||cx+dx>=MW||cz+dz<0||cz+dz>=MH)continue; const i=(cz+dz)*MW+cx+dx; const px=(cx+dx+0.5)*CELL, pz=(cz+dz+0.5)*CELL; if(Math.hypot(px-x,pz-z)>r+0.7)continue;
    if(blaze.fire[i]>0){ blaze.fire[i]=0; ch=true; for(let q=0;q<5;q++)spawn(px+(mr()-0.5)*1.4,0.3,pz+(mr()-0.5)*1.4,0,0.9+mr(),0,0.9,G(mpick(['~','.'])),0.16,1.6,1.7,1.8,0); }
    const lq=here.D.liquid[i]; if((lq===LQ_WATER||lq===LQ_DEEP)&&!blaze.frozen.has(i)){ blaze.frozen.set(i,{t:25,liq:lq,surf:here.D.surface[i]}); here.D.liquid[i]=0; here.D.surface[i]=SF_ICE; ch=true; froze=true;
      for(const m of here.monsters){ if(m.dead||m.cx!==cx+dx||m.cz!==cz+dz)continue; const s2=m.st||(m.st={}); s2.chill=Math.max(s2.chill||0,4); } }
    else if(blaze.frozen.has(i))blaze.frozen.get(i).t=25; }
  if(ch)uploadCells();
  if(froze&&sndReady()){ const t=SND.ctx.currentTime, o=sOut(x,z,0.3); sEnv(sTone(t,'sine',2093,3136,0.4,o),t,0.004,0.35); sEnv(sNoise(t,0.3,'highpass',5000,0.6,o),t,0.003,0.25,0.4); } }
function updateFrozen(dt){ if(!blaze.frozen.size)return; let ch=false;
  for(const [i,f] of blaze.frozen){ f.t-=dt; if(f.t<=0||blaze.fire[i]>0.1){ here.D.liquid[i]=f.liq; here.D.surface[i]=f.surf; blaze.fire[i]=0; blaze.fuel[i]=0; blaze.frozen.delete(i); ch=true; const [x,z]=cpos(i); for(let q=0;q<8;q++){ const a=mr()*6.28; spawn(x+Math.cos(a)*0.6,0.1,z+Math.sin(a)*0.6,Math.cos(a),0.6+mr(),Math.sin(a),0.6,G(mpick(['/','\\','~'])),0.14,0.7,0.95,1.2,1); } } }
  if(ch)uploadCells(); }
function drawFrozen(t){ for(const [i,f] of blaze.frozen){ const [x,z]=cpos(i); if(Math.hypot(x-player.x,z-player.z)>30)continue; const crack=f.t<5;
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){ const sh=0.85+0.15*Math.sin(t*2+a+b*1.7); dyn(x+(a-1)*0.62,0.08,z+(b-1)*0.62,G(crack&&((a+b)%2)?'/':'='),0.36,0.7*sh,0.92*sh,1.25*sh); } } }
// thunder runs through water: everything standing in the same water near the hit takes a share
function conductWater(m,base){ if(!inWater(m))return; let n=0;
  for(const o of here.monsters){ if(o===m||!foe(o)||!inWater(o))continue; if(Math.hypot(o.x-m.x,o.z-m.z)>6)continue; if(n++>5)break;
    addBolt([m.x,0.15,m.z],[o.x,0.15,o.z],RUNE_DEF.thunder.col,'thunder'); const r=(RES[o.key]||{}).thunder, k=r===undefined?1:r, d2=Math.round(Math.max(1,base*0.5)*k*1.5);
    if(d2>0)damageMonster(o,d2,'thunder'); if(!o.dead){ const s2=o.st||(o.st={}); s2.shock=Math.max(s2.shock||0,0.3); o.wind=0; } sparkCrown(o,RUNE_DEF.thunder.col); } }
// what an element does where it lands (walls, doors, floor, water)
function landElem(sp,x,y,z,ci){ if(!sp.elem||ci<0||ci>=NCELL)return; const areaK=1+(sp.aff.area||0)/100;
  if(sp.elem==='fire'){ if(doorBlock(ci)||(here.D.tile[ci]!==TW&&here.D.tile[ci]!==TX&&!here.D.liquid[ci]))burstFire(ci,0.5*areaK,0.9); }
  else if(sp.elem==='ice')chillArea(x,z,1.2*areaK);
  else if(sp.elem==='thunder'){ const lq=here.D.liquid[ci]; if(lq===LQ_WATER||lq===LQ_DEEP){ for(const o of here.monsters){ if(!foe(o)||!inWater(o)||Math.hypot(o.x-x,o.z-z)>5)continue; addBolt([x,0.15,z],[o.x,0.15,o.z],RUNE_DEF.thunder.col,'thunder'); damageMonster(o,2,'thunder'); } } } }
// fire reaching a poison mist sets the whole mist off
function cloudsMeetFire(){ for(const c of fight.clouds){ if(c.t<=0)continue; const cx=Math.floor(c.x/CELL), cz=Math.floor(c.z/CELL), rr=Math.ceil(c.r/CELL); let lit=false;
    for(let dz=-rr;dz<=rr&&!lit;dz++)for(let dx=-rr;dx<=rr;dx++){ if(cx+dx<0||cx+dx>=MW||cz+dz<0||cz+dz>=MH)continue; const i=(cz+dz)*MW+cx+dx; if(blaze.fire[i]>0.1){ lit=true; break; } }
    if(!lit)continue; c.t=0; const R=c.r+0.6;
    for(let q=0;q<46;q++){ const a=mr()*6.28, e=mr(); spawn(c.x+Math.cos(a)*e*R,0.4+mr()*1.2,c.z+Math.sin(a)*e*R,Math.cos(a)*2.4,0.8+mr()*2,Math.sin(a)*2.4,0.9+mr()*0.5,G(mpick(['*','#','%','\''])),0.22,3.2,1.8,0.6,0); }
    for(const o of here.monsters){ if(!foe(o)||Math.hypot(o.x-c.x,o.z-c.z)>R)continue; if(!losClear(c.x,0.6,c.z,...mCenter(o)))continue; damageMonster(o,roll(5,9),'fire'); }
    if(Math.hypot(player.x-c.x,player.z-c.z)<R*0.8)hurtPlayer(roll(1,3),'爆炎'); burstFire(cz*MW+cx,c.r/CELL+0.5,1.0); sBoom(0.4); vfx.shake=Math.max(vfx.shake,0.25); vfx.flash=Math.max(vfx.flash,0.3);
    if(!saved.BOOK.has('blast')){ saved.BOOK.add('blast'); try{ localStorage.setItem('al_book',JSON.stringify([...saved.BOOK])); }catch(e){} } } }
// a perfect dodge: the dodge rune answers only when an attack was actually evaded
function onDodged(m){ if(!gear.hands)return; let any=false;
  for(const h of ['L','R']){ const H=gear.hands[h]; if(!(H.trig&&H.trig.type==='dodge'&&H.atk)||fight.trigCd[h]>0||gear.swapSt)continue;
    if(((atkType(h)==='blade'||atkType(h)==='gsweep')&&Math.hypot(m.x-player.x,m.z-player.z)>2.9)||(atkType(h)==='dash'&&Math.hypot(m.x-player.x,m.z-player.z)>4.5))continue;
    const [ox,oy,oz]=handPoint(h), c=mCenter(m), d=Math.hypot(c[0]-ox,c[1]-oy,c[2]-oz)||1; fight.trigCd[h]=0.6; any=true;
    castNow(h,{dir:[(c[0]-ox)/d,(c[1]-oy)/d,(c[2]-oz)/d],auto:true}); }
  for(let q=0;q<16;q++){ const a=mr()*6.28; spawn(player.x+Math.cos(a)*0.6,1.0+mr(),player.z+Math.sin(a)*0.6,Math.cos(a)*1.5,0.3,Math.sin(a)*1.5,0.4,G(mpick(['~','\'','.'])),0.12,1.6,2.2,2.6,0); }
  if(any&&sndReady()){ const t=SND.ctx.currentTime; sEnv(sTone(t,'sine',1320,1980,0.18,sOut(undefined,undefined,0.12)),t,0.003,0.16); } }

// ---------------------------------------------------------------- the chant as a voice: whispered syllables that swell into a choir; each syllable lights one rune of the circle
// VOWELS・CHANT_STEPS は src/lib/sound.ts（src/game/imports.mjs で読む）
const ELEM_ROOT={fire:110,ice:294,thunder:196,poison:98};
function chantStart(el){
  if(!sndReady())return null; const ctx=SND.ctx, out=ctx.createGain(); out.gain.value=1; out.connect(sOut(undefined,undefined,0.85));
  const root=ELEM_ROOT[el]||165; let next=ctx.currentTime+0.03, syl=0, k=0, full=false, pad=[], stopped=false;
  const syllable=(t,f,vow,dur)=>{
    const amp=0.035*(0.25+0.75*k), breath=0.05*(1-k)+0.004;
    const f1=ctx.createBiquadFilter(), f2=ctx.createBiquadFilter(); f1.type='bandpass'; f2.type='bandpass'; f1.frequency.value=vow[0]; f2.frequency.value=vow[1]; f1.Q.value=7; f2.Q.value=9;
    const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(amp,t+0.04); g.gain.setValueAtTime(amp,t+dur*0.6); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    f1.connect(g); f2.connect(g); g.connect(out);
    const n=1+Math.floor(k*3); for(let j=0;j<n;j++){ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f*[1,2,1.5,0.5][j]*Math.pow(2,(Math.random()-0.5)*0.014); o.connect(f1); o.connect(f2); o.start(t); o.stop(t+dur+0.05); }
    // the whisper: breath through a vowel-shaped band
    const s0=ctx.createBufferSource(); s0.buffer=SND.noise; const wf=ctx.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=vow[1]; wf.Q.value=2.5;
    const wg=ctx.createGain(); wg.gain.setValueAtTime(0.0001,t); wg.gain.exponentialRampToValueAtTime(breath,t+0.03); wg.gain.exponentialRampToValueAtTime(0.0001,t+dur*0.9);
    s0.connect(wf); wf.connect(wg); wg.connect(out); s0.start(t,Math.random()*1.5); s0.stop(t+dur+0.05);
    // a consonant at the front of the syllable
    sEnv(sNoise(t,0.04,'highpass',3500+Math.random()*2500,0.8,out),t,0.003,0.035,0.02*(0.5+0.5*(1-k)));
    // the element's own colour
    if(el==='ice')sEnv(sTone(t,'sine',f*4,f*4,0.5,out),t,0.004,0.45,0.012);
    else if(el==='thunder'&&Math.random()<0.6){ const tc=t+dur*(0.2+0.6*Math.random()); sEnv(sNoise(tc,0.04,'highpass',4500,1,out),tc,0.004,0.03,0.018); }
    else if(el==='fire')sEnv(sTone(t,'sawtooth',f*0.5,f*0.5,dur,out),t,0.03,dur*0.9,0.01);
    else if(el==='poison'){ const o=sTone(t,'sine',root*0.5,root*0.48,dur,out); sEnv(o,t,0.05,dur*0.9,0.02); }
  };
  const startPad=()=>{ const t=ctx.currentTime; for(const [mul,vow] of [[2,VOWELS[0]],[3,VOWELS[1]],[4,VOWELS[0]]]){
      const o=ctx.createOscillator(), f1=ctx.createBiquadFilter(), g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain(); o.type='sawtooth'; o.frequency.value=root*mul;
      lfo.frequency.value=5+Math.random(); lg.gain.value=root*mul*0.006; lfo.connect(lg); lg.connect(o.frequency);
      f1.type='bandpass'; f1.frequency.value=vow[0]; f1.Q.value=6; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.03,t+0.12);
      o.connect(f1); f1.connect(g); g.connect(out); o.start(t); lfo.start(t); pad.push({o,lfo,g}); }
    sEnv(sTone(t,'sine',root*8,root*8,1.4,out),t,0.003,1.3,0.05); sEnv(sTone(t+0.02,'sine',root*12,root*12,1.0,out),t+0.02,0.003,0.9,0.025); };
  return {
    tick(kk,isFull){ if(stopped)return; k=kk; if(isFull&&!full){ full=true; startPad(); }
      while(next<ctx.currentTime+0.06){ const step=CHANT_STEPS[Math.min(CHANT_STEPS.length-1,(syl%4)+Math.floor(k*3)+(syl%3===2?1:0))], f=root*Math.pow(2,step/12);
        const dur=full?0.3:0.2; syllable(next,f,VOWELS[(syl*3)%5],dur); if(gear.castSt){ gear.castSt.syl=syl; gear.castSt.sylT=clock.time; } syl++; next+=full?0.3:0.21; } },
    stop(){ if(stopped)return; stopped=true; const t=ctx.currentTime; try{ out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value,t); out.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
      for(const p of pad){ p.o.stop(t+0.25); p.lfo.stop(t+0.25); } }catch(e){} } };
}

// ---------------------------------------------------------------- HUD at the bottom: what each hand holds, the chant
// 下の HUD を描き直す renderHotbar は src/lib/hotbar.ts（src/game/imports.mjs で読む）

// dodge roll (after Minecraft Dungeons): a quick burst in the direction you are moving, untouchable while it lasts
function startRoll(){
  if(adv.dead||here.trans||(player.rollCd||0)>0||player.netT>0||player.roll)return;
  const k=keys, fw=((k.KeyW||k.ArrowUp)?1:0)-((k.KeyS||k.ArrowDown)?1:0), st=(k.KeyD?1:0)-(k.KeyA?1:0), sy=Math.sin(player.yaw), cy=Math.cos(player.yaw);
  let ix=-sy*fw+cy*st, iz=-cy*fw-sy*st; const l=Math.hypot(ix,iz); if(l<0.01){ ix=sy; iz=cy; } else { ix/=l; iz/=l; }
  player.roll={t:0,dx:ix,dz:iz}; player.rollCd=1.0; sWhoosh();
  if(gear.swapSt){ restoreHands(gear.swapSt.snap); gear.swapSt=null; renderHotbar(); }
  if(gear.castSt){ gear.castSt=null; fight.beamSegs=[]; fizzle(); renderHotbar(); }
  if(fight.beamRun){ fight.beamRun=null; fight.beamSegs=[]; }
  for(let q=0;q<10;q++){ const a=mr()*6.28; spawn(player.x,0.1,player.z,Math.cos(a)*0.8,0.2+mr()*0.4,Math.sin(a)*0.8,0.6,G(mpick(['.',',','\''])),0.14,0.5,0.48,0.55,1); }
}

// ---------------------------------------------------------------- inventory as a list; hotbar (wheel / 1-5, right click) and a pack screen (Tab); a menu (Esc)
let newRunArm=0;
const isPaused=()=>ui.invOpen||ui.menuOpen||ui.dbgOpen||ui.altarOpen||ui.lvlOpen;
