// levelDims は src/lib/strata.ts（古い JS は使わない。src/lib/ の生成などが使う）
// 迷宮の生成は src/lib/generate.ts（generateLevel）。ここは、今のゲームの状態から入力を作り、結果をゲームの状態に入れる呼び出し口
function generate(seed,depth){
  if(HIST_SEED!==adv.runSeed){ HIST=makeHistory(adv.runSeed); HIST_SEED=adv.runSeed; }
  const r=generateLevel(seed,depth,{runSeed:adv.runSeed,branch:here.branch,realm:here.realm,inter:here.inter,showroom:here.showroomGen,hist:HIST,trials:adv.runTrials,weapons:weaponPool()},{MTYPES,makeRune,rollTraits});
  if(r.lordType)MTYPES.lord=r.lordType;
  if(r.beastType)MTYPES.X=r.beastType;
  return r.level;
}

