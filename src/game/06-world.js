// ---------------------------------------------------------------- world state
let staticMesh=null;
// player は src/lib/state.ts（src/game/imports.mjs で読む。丸ごと入れ替えないので、名前はそのまま）
// edge は src/lib/state.ts（src/game/imports.mjs で読む）
// 画面の下の一言 showHint は src/lib/status.ts（src/game/imports.mjs で読む）
// ceilAt は src/lib/lightmap.ts（src/game/imports.mjs で読む）

// vnoise は src/lib/noise.ts（src/game/imports.mjs で読む）
// hash3 は src/lib/noise.ts（古い JS は使わない。src/lib/ の生成などが使う）
// sstep は src/lib/math.ts（src/game/imports.mjs で読む）
// CHUNK・CXN・CZN は src/lib/world.ts（src/game/imports.mjs で読む）

let waterMesh=null;
function makeWater(){
  gfx.waterTex=new T.DataTexture(new Float32Array(NCELL*4),MW,MH,T.RGBAFormat,T.FloatType); gfx.waterTex.magFilter=gfx.waterTex.minFilter=T.NearestFilter;
  gfx.waterLTex=new T.DataTexture(new Float32Array(NCELL*4),MW,MH,T.RGBAFormat,T.FloatType); gfx.waterLTex.magFilter=gfx.waterLTex.minFilter=T.NearestFilter;
  const mat=new T.ShaderMaterial({uniforms:{uAtlas:gfx.U.uAtlas,uTime:gfx.U.uTime,uSL:gfx.U.uSL,uDLP:gfx.U.uDLP,uDLC:gfx.U.uDLC,uFogDen:gfx.U.uFogDen,uFogColor:gfx.U.uFogColor,uWater:{value:gfx.waterTex},uWaterL:{value:gfx.waterLTex}},
    vertexShader:WATER_VS,fragmentShader:WATER_FS,side:T.DoubleSide,alphaToCoverage:true,extensions:{derivatives:true}});
  const geo=new T.PlaneGeometry(MW*CELL,MH*CELL); geo.rotateX(-Math.PI/2);
  waterMesh=new T.Mesh(geo,mat); waterMesh.position.set(MW*CELL/2,0.06,MH*CELL/2); waterMesh.frustumCulled=false; gfx.scene.add(waterMesh);
}
// updateWater は src/lib/build.ts（src/game/imports.mjs で読む）

// flowW は src/lib/math.ts（src/game/imports.mjs で読む）
// buildWorld は src/lib/build.ts（src/game/imports.mjs で読む）
const _frus=new T.Frustum(), _pm=new T.Matrix4();
function cullChunks(){
  gfx.camera.updateMatrixWorld();
  _pm.multiplyMatrices(gfx.camera.projectionMatrix,gfx.camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pm);
  const maxD=2.4/gfx.U.uFogDen.value; hudInfo.chunksDrawn=0;
  for(const c of gfx.chunks){ const d=c.sphere.center.distanceTo(gfx.camera.position)-c.sphere.radius; c.mesh.visible=d<maxD&&_frus.intersectsSphere(c.sphere); if(c.mesh.visible)hudInfo.chunksDrawn+=c.mesh.count; }
}

