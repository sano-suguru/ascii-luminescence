// ---------------------------------------------------------------- renderer & post
// 描画の部品を作る。WebGL を作れなかった時は、わけを出して false を返す（呼ぶ所が、ゲームの用意をそこでやめる）
function initRenderer(){
gfx.canvas=document.getElementById('gl');
try{ gfx.renderer=new T.WebGLRenderer({canvas:gfx.canvas,antialias:false,powerPreference:'high-performance',stencil:false}); }
catch(e){ ui.errEl.textContent='WebG Lを初期化できませんでした。ハードウェアアクセラレーションを有効にしてください。'.replace('WebG L','WebGL'); return false; }
const isGL2=gfx.renderer.capabilities.isWebGL2;
gfx.pixelRatio=Math.min(window.devicePixelRatio||1,1.5);
gfx.renderer.setPixelRatio(gfx.pixelRatio);
gfx.renderer.setSize(window.innerWidth,window.innerHeight,false);
gfx.scene=new T.Scene();
gfx.camera=new T.PerspectiveCamera(74,window.innerWidth/window.innerHeight,0.05,110);
gfx.camera.rotation.order='YXZ';
// fogCol は src/lib/three.ts（src/game/imports.mjs で読む）
gfx.renderer.setClearColor(new T.Color(fogCol.x,fogCol.y,fogCol.z),1);

const rt=new T.WebGLRenderTarget(window.innerWidth*gfx.pixelRatio,window.innerHeight*gfx.pixelRatio,{type:T.HalfFloatType,samples:isGL2?4:0});
gfx.composer=new T.EffectComposer(gfx.renderer,rt);
gfx.composer.setPixelRatio(gfx.pixelRatio);
gfx.composer.setSize(window.innerWidth,window.innerHeight);
gfx.composer.addPass(new T.RenderPass(gfx.scene,gfx.camera));
gfx.bloom=new T.UnrealBloomPass(new T.Vector2(window.innerWidth,window.innerHeight),0.8,0.55,0.76);
[gfx.bloom.renderTargetBright,...gfx.bloom.renderTargetsHorizontal,...gfx.bloom.renderTargetsVertical].forEach(t=>{ if(t)t.texture.type=T.HalfFloatType; });
gfx.composer.addPass(gfx.bloom);
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
gfx.finalPass=new T.ShaderPass(FinalShader);
gfx.composer.addPass(gfx.finalPass);

// GLSL_COMMON（古い JS は使わない）・STATIC_VS・WATER_VS・WATER_FS・GLYPH_FS・DYN_VS・PT_VS・PT_FS は src/lib/shaders.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- shared uniforms
// 灯りを描画に渡す配列 SL・DLP・DLC と、マスの絵の中身 cellData は src/lib/state.ts（src/game/imports.mjs で読む。マスの絵 gfx.cellTex はここでその場で入れる）
gfx.cellTex=new T.DataTexture(cellData,MW,MH,T.RGBAFormat,T.UnsignedByteType);
gfx.cellTex.magFilter=T.LinearFilter; gfx.cellTex.minFilter=T.LinearFilter; gfx.cellTex.needsUpdate=true;
gfx.U={
  uCell:{value:gfx.cellTex}, uCollT:{value:-100},
  uAtlas:{value:null}, uTime:{value:0}, uSL:{value:SL}, uDLP:{value:DLP}, uDLC:{value:DLC},
  uCamP:{value:new T.Vector3()}, uCutP:{value:new T.Vector3()}, uCut:{value:0},
  uFogDen:{value:0.05}, uFogColor:{value:fogCol}, uScale:{value:600}, uRamp:{value:new Float32Array([...RAMP_CH].map(c=>c.charCodeAt(0)-32))}, uAmb:{value:1}
};

// ---------------------------------------------------------------- glyph atlas
// 文字の絵の表を作る buildAtlas は src/lib/render.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- dynamic glyph billboards
// 置く文字の配列 dPos・dCol・dPar と、文字を置く dyn は src/lib/particles.ts、置いた数 buf.dn は src/lib/state.ts（src/game/imports.mjs で読む）
gfx.dynGeo=new T.InstancedBufferGeometry();
{ const pg=new T.PlaneGeometry(1,1); gfx.dynGeo.index=pg.index; gfx.dynGeo.setAttribute('position',pg.attributes.position); gfx.dynGeo.setAttribute('uv',pg.attributes.uv); }
gfx.aPos=new T.InstancedBufferAttribute(dPos,3).setUsage(T.DynamicDrawUsage);
gfx.aCol=new T.InstancedBufferAttribute(dCol,3).setUsage(T.DynamicDrawUsage);
gfx.aPar=new T.InstancedBufferAttribute(dPar,4).setUsage(T.DynamicDrawUsage);
gfx.dynGeo.setAttribute('iPos',gfx.aPos); gfx.dynGeo.setAttribute('iCol',gfx.aCol); gfx.dynGeo.setAttribute('iP',gfx.aPar);
gfx.dynGeo.instanceCount=0;
// 置いた文字の数を描画に渡す flushDyn は src/lib/render.ts（src/game/imports.mjs で読む）

// ---------------------------------------------------------------- particles
// 粒子の配列 ptPos・ptCol・ptSize・ptGly は src/lib/particles.ts、描く形 gfx.ptGeo と属性 gfx.bpPos などは src/lib/state.ts（ここでその場で入れる）、粒子を動かす updateParticles は src/lib/motes.ts（src/game/imports.mjs で読む）
gfx.ptGeo=new T.BufferGeometry();
gfx.bpPos=new T.BufferAttribute(ptPos,3).setUsage(T.DynamicDrawUsage); gfx.bpCol=new T.BufferAttribute(ptCol,3).setUsage(T.DynamicDrawUsage); gfx.bpSize=new T.BufferAttribute(ptSize,1).setUsage(T.DynamicDrawUsage); gfx.bpGly=new T.BufferAttribute(ptGly,1).setUsage(T.DynamicDrawUsage);
gfx.ptGeo.setAttribute('position',gfx.bpPos); gfx.ptGeo.setAttribute('aCol',gfx.bpCol); gfx.ptGeo.setAttribute('aSize',gfx.bpSize); gfx.ptGeo.setAttribute('aGlyph',gfx.bpGly);
// dust は src/lib/state.ts（src/game/imports.mjs で読む）
// 粒子の配列 P と、粒子を出す spawn・消す killP は src/lib/particles.ts、生きている数 buf.pN は src/lib/state.ts（src/game/imports.mjs で読む）

return true;
}
if(!initRenderer())return;
