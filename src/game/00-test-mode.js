// ---------------------------------------------------------------- test mode (?test=1): the same result every time, for automated checks
// Math.random is seeded, and the clock (performance.now / setTimeout / setInterval) only moves when the game steps.
// The game does not step by itself: window.__test.frames(n) draws n frames, __test.advance(sec) steps without drawing.
const TEST=(()=>{ try{ return new URLSearchParams(location.search).get('test')==='1'; }catch(e){ return false; } })();
const TEST_STEP=1/30;
const TESTCLK=TEST?(()=>{
  const q=new URLSearchParams(location.search), sd=Number(q.get('seed'))>>>0||1;
  let a=(sd^0x9e3779b9)>>>0; Math.random=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  let now=0, nextId=1; const timers=new Map(); const realTimeout=window.setTimeout.bind(window);
  performance.now=()=>now;
  window.setTimeout=(fn,ms,...args)=>{ const id=nextId++; timers.set(id,{at:now+Math.max(0,+ms||0),fn,args}); return id; };
  window.setInterval=(fn,ms,...args)=>{ const id=nextId++; const every=Math.max(1,+ms||0); timers.set(id,{at:now+every,fn,args,every}); return id; };
  window.clearTimeout=window.clearInterval=id=>{ timers.delete(id); };
  // 音の時計（currentTime）もゲームの時計に合わせ、音の部品はいつも動いている扱いにする。詠唱の声は音の時計で音節の数を決め、音節ごとに Math.random を引き、
  // 効果音は部品が動いている時だけ鳴る（乱数も引く）。実時間のままだと、マシンの混み具合で乱数を引く数が変わり、その後の結果（火花の位置など）がずれる
  if(window.BaseAudioContext){ const P=BaseAudioContext.prototype;
    Object.defineProperty(P,'currentTime',{configurable:true,get(){ return now/1000; }});
    Object.defineProperty(P,'state',{configurable:true,get(){ return 'running'; }}); }
  return { advance(ms){ const end=now+ms;
    for(;;){ let id=-1, e=null; for(const [k,v] of timers)if(v.at<=end&&(!e||v.at<e.at||(v.at===e.at&&k<id))){ id=k; e=v; }
      if(!e)break; now=Math.max(now,e.at); if(e.every)e.at+=e.every; else timers.delete(id);
      // like a real browser: one failing timer is reported (a page error) and the others still run
      if(typeof e.fn==='function')try{ e.fn(...e.args); }catch(err){ queueMicrotask(()=>{ throw err; }); } }
    now=end; }, realTimeout };
})():null;
const errEl=document.getElementById('err');
// three.js と、光のにじみなどの部品（src/game/imports.mjs で読む。組み立てに入っているので、読み込みの失敗を確かめる必要は無い）
const T={...THREE,EffectComposer,RenderPass,ShaderPass,UnrealBloomPass};

