// stealth・lantern・hudInfo は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
// LIGHT_NAMES・LIGHT_COLS は src/lib/hud.ts（src/game/imports.mjs で読む）
// 状態の表示 renderStatus・明るさと気配 updateStealth・年代記 renderChron・操作の案内 renderHelp と setHelp・表示の量 cycleUi・忍び足 toggleSneak・
// 見つかった時 onNoticed・物音 makeNoise・飛べるマス flyOpen は src/lib/status.ts（src/game/imports.mjs で読む）
// ---------------------------------------------------------------- 生き物の頭の上の印（眠っている z・気づいた !・怪しんでいる ?）
// パネルの文字の幅（visW）と枠（boxText）は src/lib/text.ts（src/game/imports.mjs で読む）
// MARK_H は src/lib/hud.ts（src/game/imports.mjs で読む）
function drawMark(m,t,dp){
  if(m.ty.peaceful||!m.visible||m.ty.invisible||dp>22)return;
  m.mark+=1/60;
  const y=m.y+(MARK_H[m.ty.form]||1.5)*m.ty.scale+0.25, near=clamp(dp/4,0.5,1);
  if(m.sleep){ for(let k=0;k<2;k++){ const q=(t*0.45+k*0.5)%1; dyn(m.x+q*0.25,y+q*0.45,m.z,G('z'),(0.16+0.1*(1-q))*(k?0.8:1),0.55*(1-q)*near,0.6*(1-q)*near,1.0*(1-q)*near); } }
  else if(m.noticed){ const pop=1+Math.max(0,1-m.mark*3)*0.6; dyn(m.x,y+Math.sin(t*6)*0.03,m.z,G('!'),0.36*pop,2.4*near,0.55*near,0.3*near); }
  else if(m.aware>0.35){ dyn(m.x,y+Math.sin(t*3)*0.04,m.z,G('?'),0.32,2.0*near,1.7*near,0.5*near); }
}
// lerpAngle は src/lib/math.ts（src/game/imports.mjs で読む）
// mname は src/lib/names.ts（src/game/imports.mjs で読む）
