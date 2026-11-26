// ---------------------------------------------------------------- spells meet the world: doors stop them, sight lines matter, ice freezes water and puts out fire, thunder runs through water, fire lights poison mist
// doorAt is the door number of each cell (-1 where there is no door), as generate() made it
// doorBlock は src/lib/aim.ts（src/game/imports.mjs で読む）
// losClear は src/lib/aim.ts（src/game/imports.mjs で読む）
// mCenter は src/lib/math.ts（src/game/imports.mjs で読む）
// beamFrame は src/lib/aim.ts（src/game/imports.mjs で読む）
// 冷気 chillArea と、凍らせた水が溶ける updateFrozen は src/lib/ground.ts（src/game/imports.mjs で読む）
// 凍らせた水を描く drawFrozen は src/lib/fx.ts（src/game/imports.mjs で読む）
// thunder runs through water: everything standing in the same water near the hit takes a share
// conductWater は src/lib/combat.ts（src/game/imports.mjs で読む）
// what an element does where it lands (walls, doors, floor, water)
// landElem は src/lib/combat.ts（src/game/imports.mjs で読む）
// fire reaching a poison mist sets the whole mist off
function cloudsMeetFire(){ for(const c of fight.clouds){ if(c.t<=0)continue; const cx=Math.floor(c.x/CELL), cz=Math.floor(c.z/CELL), rr=Math.ceil(c.r/CELL); let lit=false;
    for(let dz=-rr;dz<=rr&&!lit;dz++)for(let dx=-rr;dx<=rr;dx++){ if(cx+dx<0||cx+dx>=MW||cz+dz<0||cz+dz>=MH)continue; const i=(cz+dz)*MW+cx+dx; if(blaze.fire[i]>0.1){ lit=true; break; } }
    if(!lit)continue; c.t=0; const R=c.r+0.6;
    for(let q=0;q<46;q++){ const a=mr()*6.28, e=mr(); spawn(c.x+Math.cos(a)*e*R,0.4+mr()*1.2,c.z+Math.sin(a)*e*R,Math.cos(a)*2.4,0.8+mr()*2,Math.sin(a)*2.4,0.9+mr()*0.5,G(mpick(['*','#','%','\''])),0.22,3.2,1.8,0.6,0); }
    for(const o of here.monsters){ if(!foe(o)||Math.hypot(o.x-c.x,o.z-c.z)>R)continue; if(!losClear(c.x,0.6,c.z,...mCenter(o)))continue; damageMonster(o,roll(5,9),'fire'); }
    if(Math.hypot(player.x-c.x,player.z-c.z)<R*0.8)hurtPlayer(roll(1,3),'爆炎'); burstFire(cz*MW+cx,c.r/CELL+0.5,1.0); sBoom(0.4); vfx.shake=Math.max(vfx.shake,0.25); vfx.flash=Math.max(vfx.flash,0.3);
    if(!saved.BOOK.has('blast')){ saved.BOOK.add('blast'); try{ localStorage.setItem('al_book',JSON.stringify([...saved.BOOK])); }catch(e){} } } }
// a perfect dodge: the dodge rune answers only when an attack was actually evaded
// onDodged は src/lib/combat.ts（src/game/imports.mjs で読む）

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
    const n=1+Math.floor(k*3); for(let j=0;j<n;j++){ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f*[1,2,1.5,0.5][j]*Math.pow(2,(sndRand()-0.5)*0.014); o.connect(f1); o.connect(f2); o.start(t); o.stop(t+dur+0.05); }
    // the whisper: breath through a vowel-shaped band
    const s0=ctx.createBufferSource(); s0.buffer=SND.noise; const wf=ctx.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=vow[1]; wf.Q.value=2.5;
    const wg=ctx.createGain(); wg.gain.setValueAtTime(0.0001,t); wg.gain.exponentialRampToValueAtTime(breath,t+0.03); wg.gain.exponentialRampToValueAtTime(0.0001,t+dur*0.9);
    s0.connect(wf); wf.connect(wg); wg.connect(out); s0.start(t,sndRand()*1.5); s0.stop(t+dur+0.05);
    // a consonant at the front of the syllable
    sEnv(sNoise(t,0.04,'highpass',3500+sndRand()*2500,0.8,out),t,0.003,0.035,0.02*(0.5+0.5*(1-k)));
    // the element's own colour
    if(el==='ice')sEnv(sTone(t,'sine',f*4,f*4,0.5,out),t,0.004,0.45,0.012);
    else if(el==='thunder'&&sndRand()<0.6){ const tc=t+dur*(0.2+0.6*sndRand()); sEnv(sNoise(tc,0.04,'highpass',4500,1,out),tc,0.004,0.03,0.018); }
    else if(el==='fire')sEnv(sTone(t,'sawtooth',f*0.5,f*0.5,dur,out),t,0.03,dur*0.9,0.01);
    else if(el==='poison'){ const o=sTone(t,'sine',root*0.5,root*0.48,dur,out); sEnv(o,t,0.05,dur*0.9,0.02); }
  };
  const startPad=()=>{ const t=ctx.currentTime; for(const [mul,vow] of [[2,VOWELS[0]],[3,VOWELS[1]],[4,VOWELS[0]]]){
      const o=ctx.createOscillator(), f1=ctx.createBiquadFilter(), g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain(); o.type='sawtooth'; o.frequency.value=root*mul;
      lfo.frequency.value=5+sndRand(); lg.gain.value=root*mul*0.006; lfo.connect(lg); lg.connect(o.frequency);
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

// 止まっているか isPaused は src/lib/status.ts（src/game/imports.mjs で読む）
