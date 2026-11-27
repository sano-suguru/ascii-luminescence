// ---------------------------------------------------------------- test mode (?test=1): the same result every time, for automated checks
// Math.random and the sound random (sndRand, its own sequence) are seeded, and the clock (performance.now / setTimeout / setInterval / the audio clock AudioContext.currentTime) only moves when the game steps.
// The game does not step by itself: window.__test.frames(n) draws n frames, __test.advance(sec) steps without drawing.
// テスト用モードか TEST は src/lib/state.ts（src/game/imports.mjs で読む）
// テスト用モードの1歩の秒 TEST_STEP は src/lib/state.ts（src/game/imports.mjs で読む）
function installTestMode(){
  const q=new URLSearchParams(location.search), sd=Number(q.get('seed'))>>>0||1;
  let a=(sd^0x9e3779b9)>>>0; Math.random=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  let now=0, nextId=1; const timers=new Map(); const realTimeout=window.setTimeout.bind(window);
  performance.now=()=>now;
  window.setTimeout=(fn,ms,...args)=>{ const id=nextId++; timers.set(id,{at:now+Math.max(0,+ms||0),fn,args}); return id; };
  window.setInterval=(fn,ms,...args)=>{ const id=nextId++; const every=Math.max(1,+ms||0); timers.set(id,{at:now+every,fn,args,every}); return id; };
  window.clearTimeout=window.clearInterval=id=>{ timers.delete(id); };
  // 音：音の乱数（sndRand）もシードで決める（見た目の乱数とは別の並び。音は見た目の乱数を引かない）。
  // 時計（currentTime）はゲームの時計、部品はいつも動いている扱い（state）。詠唱の円の文字は、詠唱の声の音節の時刻で光り、
  // 声は部品が動いている時だけ鳴るので、どちらも実時間で変わると、絵がずれる。
  // 音の速さ（sampleRate）は 44100 に決める。始めに作る響きと雑音は、音の速さの数だけ音の乱数を引くので、マシンで変わると、
  // その後の音（鳴らすか・声のゆらぎ）がマシンごとに違ってしまう。
  // 本物の音の部品は実時間で鳴るので、ゲームを速く進めると、鳴らす音は先の時刻に予約され、その時刻まで残る（テストの間だけのことなので、そのままにする）
  setSoundRand(mulberry32((sd^0x5bd1e995)>>>0));
  if(window.BaseAudioContext){ const P=BaseAudioContext.prototype;
    Object.defineProperty(P,'currentTime',{configurable:true,get(){ return now/1000; }});
    Object.defineProperty(P,'state',{configurable:true,get(){ return 'running'; }});
    Object.defineProperty(P,'sampleRate',{configurable:true,get(){ return 44100; }}); }
  return { advance(ms){ const end=now+ms;
    for(;;){ let id=-1, e=null; for(const [k,v] of timers)if(v.at<=end&&(!e||v.at<e.at||(v.at===e.at&&k<id))){ id=k; e=v; }
      if(!e)break; now=Math.max(now,e.at); if(e.every)e.at+=e.every; else timers.delete(id);
      // like a real browser: one failing timer is reported (a page error) and the others still run
      if(typeof e.fn==='function')try{ e.fn(...e.args); }catch(err){ queueMicrotask(()=>{ throw err; }); } }
    now=end; }, realTimeout };
}
clock.TESTCLK=TEST?installTestMode():null;
ui.errEl=document.getElementById('err');
// three.js と、光のにじみなどの部品 T は src/lib/three.ts（src/game/imports.mjs で読む）
// 自動で試す（?auto）間は、localStorage に書かない（保存の処理より先に。src/lib/auto.ts）
autoGuard();
