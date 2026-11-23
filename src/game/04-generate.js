// levelDims は src/lib/strata.ts（古い JS は使わない。src/lib/ の生成などが使う）
// 迷宮の生成は src/lib/generate.js（generateLevel）。ここは、今のゲームの状態から入力を作り、結果をゲームの状態に入れる包み
function generate(seed,depth){
  if(HIST_SEED!==runSeed){ HIST=makeHistory(runSeed); HIST_SEED=runSeed; }
  const r=generateLevel(seed,depth,{runSeed,branch,realm,inter,showroom:showroomGen,hist:HIST,trials:runTrials,weapons:weaponPool()},{MTYPES,makeRune,rollTraits});
  if(r.lordType)MTYPES.lord=r.lordType;
  if(r.beastType)MTYPES.X=r.beastType;
  return r.level;
}

