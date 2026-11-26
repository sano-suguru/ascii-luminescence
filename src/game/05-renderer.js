// ---------------------------------------------------------------- renderer & post
const canvas=document.getElementById('gl');
let renderer;
try{ renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false}); }
catch(e){ errEl.textContent='WebG Lを初期化できませんでした。ハードウェアアクセラレーションを有効にしてください。'.replace('WebG L','WebGL'); return; }
const isGL2=renderer.capabilities.isWebGL2;
let pixelRatio=Math.min(window.devicePixelRatio||1,1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight,false);
const scene=new T.Scene();
gfx.camera=new T.PerspectiveCamera(74,window.innerWidth/window.innerHeight,0.05,110);
gfx.camera.rotation.order='YXZ';
const fogCol=new T.Vector3(...FOGS[0]);
renderer.setClearColor(new T.Color(fogCol.x,fogCol.y,fogCol.z),1);

const rt=new T.WebGLRenderTarget(window.innerWidth*pixelRatio,window.innerHeight*pixelRatio,{type:T.HalfFloatType,samples:isGL2?4:0});
const composer=new T.EffectComposer(renderer,rt);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth,window.innerHeight);
composer.addPass(new T.RenderPass(scene,gfx.camera));
const bloom=new T.UnrealBloomPass(new T.Vector2(window.innerWidth,window.innerHeight),0.8,0.55,0.76);
[bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical].forEach(t=>{ if(t)t.texture.type=T.HalfFloatType; });
composer.addPass(bloom);
const FinalShader={
  uniforms:{tDiffuse:{value:null},uTime:{value:0},uRes:{value:new T.Vector2(1,1)},uExposure:{value:1.1},uFade:{value:1},uHeat:{value:0},uSwim:{value:0},uHurt:{value:0},uSlow:{value:0},uTint:{value:new T.Vector3(1,1,1)}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uExposure; uniform float uFade; uniform float uHeat; uniform float uSwim; uniform float uHurt; uniform float uSlow; uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){
      vec2 uv0=vUv+vec2((sin(vUv.y*90.0+uTime*5.0)+sin(vUv.y*53.0-uTime*3.7))*0.0011*uHeat*(1.0-vUv.y),0.0);
      uv0.x+=sin(vUv.y*38.0+uTime*2.2)*0.0016*uSwim;
      vec2 c=uv0-0.5; float r2=dot(c,c);
      vec2 off=c*(0.0008+r2*0.0045);
      vec3 col=vec3(texture2D(tDiffuse,uv0+off).r,texture2D(tDiffuse,uv0).g,texture2D(tDiffuse,uv0-off).b);
      col*=uExposure;
      col=aces(col);
      col=mix(col,col*vec3(0.5,0.75,1.0)+vec3(0.0,0.015,0.04),uSwim*(0.25+0.6*smoothstep(0.6,0.3,vUv.y)));
      col=pow(col,vec3(0.4545));
      col+=vec3(0.010,0.005,0.026)*(1.0-col);
      float lum=dot(col,vec3(0.299,0.587,0.114)); col=mix(col,vec3(lum)*vec3(0.9,0.94,1.06),0.32*uSlow);
      col+=uTint*0.09*uSlow*smoothstep(0.08,0.5,r2);
      float vig=1.0-smoothstep(0.16,0.75,r2*1.3);
      col*=mix(0.32-0.12*uSlow,1.0,vig);
      col+=(hash(vUv*uRes+fract(uTime*7.31)*91.7)-0.5)*0.022;
      col=mix(col,col*vec3(1.0,0.35,0.3)+vec3(0.18,0.0,0.0),clamp(uHurt,0.0,1.0)*(0.25+0.75*smoothstep(0.05,0.45,r2)));
      gl_FragColor=vec4(col*uFade,1.0);
    }`
};
const finalPass=new T.ShaderPass(FinalShader);
composer.addPass(finalPass);

// GLSL_COMMON（古い JS は使わない）・STATIC_VS・WATER_VS・WATER_FS・GLYPH_FS・DYN_VS・PT_VS・PT_FS は src/lib/shaders.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- shared uniforms
// 灯りを描画に渡す配列 SL・DLP・DLC と、マスの絵の中身 cellData は src/lib/state.ts（src/game/imports.mjs で読む。マスの絵 gfx.cellTex はここでその場で入れる）
gfx.cellTex=new T.DataTexture(cellData,MW,MH,T.RGBAFormat,T.UnsignedByteType);
gfx.cellTex.magFilter=T.LinearFilter; gfx.cellTex.minFilter=T.LinearFilter; gfx.cellTex.needsUpdate=true;
const U={
  uCell:{value:gfx.cellTex}, uCollT:{value:-100},
  uAtlas:{value:null}, uTime:{value:0}, uSL:{value:SL}, uDLP:{value:DLP}, uDLC:{value:DLC},
  uCamP:{value:new T.Vector3()}, uCutP:{value:new T.Vector3()}, uCut:{value:0},
  uFogDen:{value:0.05}, uFogColor:{value:fogCol}, uScale:{value:600}, uRamp:{value:new Float32Array([...RAMP_CH].map(c=>c.charCodeAt(0)-32))}, uAmb:{value:1}
};
let staticMat, dynMat, ptMat, occMat;

// ---------------------------------------------------------------- glyph atlas
function buildAtlas(){
  const AC=128, c=document.createElement('canvas'); c.width=16*AC; c.height=7*AC;
  const x=c.getContext('2d');
  x.fillStyle='#fff'; x.strokeStyle='#fff'; x.textAlign='center'; x.textBaseline='middle';
  x.font=`800 ${Math.round(AC*0.74)}px "JetBrains Mono","DejaVu Sans Mono",Menlo,Consolas,monospace`;
  x.lineWidth=AC*0.03; x.lineJoin='round';
  for(let i=1;i<95;i++){ const ch=String.fromCharCode(32+i), cx=(i%16+0.5)*AC, cy=(Math.floor(i/16)+0.5)*AC+AC*0.03; x.fillText(ch,cx,cy); x.strokeText(ch,cx,cy); }
  x.font=`500 ${Math.round(AC*0.8)}px ${RUNE_FONT}`; x.lineWidth=AC*0.035;
  for(let k=0;k<RUNE_CHARS.length;k++){ const cx=(k+0.5)*AC, cy=6.5*AC+AC*0.02; x.fillText(RUNE_CHARS[k],cx,cy); x.strokeText(RUNE_CHARS[k],cx,cy); }
  const tex=new T.CanvasTexture(c);
  tex.generateMipmaps=true; tex.minFilter=T.LinearMipmapLinearFilter; tex.magFilter=T.LinearFilter;
  tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate=true;
  return tex;
}

// ---------------------------------------------------------------- dynamic glyph billboards
// 置く文字の配列 dPos・dCol・dPar と、文字を置く dyn は src/lib/particles.ts、置いた数 buf.dn は src/lib/state.ts（src/game/imports.mjs で読む）
const dynGeo=new T.InstancedBufferGeometry();
{ const pg=new T.PlaneGeometry(1,1); dynGeo.index=pg.index; dynGeo.setAttribute('position',pg.attributes.position); dynGeo.setAttribute('uv',pg.attributes.uv); }
const aPos=new T.InstancedBufferAttribute(dPos,3).setUsage(T.DynamicDrawUsage);
const aCol=new T.InstancedBufferAttribute(dCol,3).setUsage(T.DynamicDrawUsage);
const aPar=new T.InstancedBufferAttribute(dPar,4).setUsage(T.DynamicDrawUsage);
dynGeo.setAttribute('iPos',aPos); dynGeo.setAttribute('iCol',aCol); dynGeo.setAttribute('iP',aPar);
dynGeo.instanceCount=0;
function flushDyn(){
  dynGeo.instanceCount=buf.dn;
  for(const [a,s] of [[aPos,3],[aCol,3],[aPar,4]]){ a.updateRange.offset=0; a.updateRange.count=Math.max(1,buf.dn*s); a.needsUpdate=true; }
}

// ---------------------------------------------------------------- particles
// DUST_N・GAS_N・PT_TOTAL・P0 は src/lib/shaders.ts（src/game/imports.mjs で読む）
const ptPos=new Float32Array(PT_TOTAL*3), ptCol=new Float32Array(PT_TOTAL*3), ptSize=new Float32Array(PT_TOTAL), ptGly=new Float32Array(PT_TOTAL);
const ptGeo=new T.BufferGeometry();
const bpPos=new T.BufferAttribute(ptPos,3).setUsage(T.DynamicDrawUsage), bpCol=new T.BufferAttribute(ptCol,3).setUsage(T.DynamicDrawUsage),
      bpSize=new T.BufferAttribute(ptSize,1).setUsage(T.DynamicDrawUsage), bpGly=new T.BufferAttribute(ptGly,1).setUsage(T.DynamicDrawUsage);
ptGeo.setAttribute('position',bpPos); ptGeo.setAttribute('aCol',bpCol); ptGeo.setAttribute('aSize',bpSize); ptGeo.setAttribute('aGlyph',bpGly);
const dust={x:new Float32Array(DUST_N),y:new Float32Array(DUST_N),z:new Float32Array(DUST_N),ph:new Float32Array(DUST_N),g:new Float32Array(DUST_N),s:new Float32Array(DUST_N)};
// 粒子の配列 P と、粒子を出す spawn・消す killP は src/lib/particles.ts、生きている数 buf.pN は src/lib/state.ts（src/game/imports.mjs で読む）

