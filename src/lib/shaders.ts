// 描画のシェーダーの文と、描画の入れ物の大きさ（もとは src/game/05-renderer.js）。
// シェーダーの文は、three.js の ShaderMaterial に渡す GLSL。迷宮の大きさ（MW・MH・CELL）と灯りの数（NSL・NDL）を文に埋め込む。
import { CELL, MH, MW, NDL, NSL } from './world.ts';

/** どのシェーダーも使う関数（hash と、文字の図鑑の中の座標 glyphUV） */
export const GLSL_COMMON = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2 glyphUV(float g, vec2 uv){ uv=uv*0.94+0.03; float cx=mod(g,16.0); float cy=floor(g/16.0); return vec2((cx+uv.x)/16.0, 1.0-(cy+1.0-uv.y)/7.0); }
`;
/** 迷宮の動かない文字（壁・床・備品など）の頂点シェーダー */
export const STATIC_VS = `
#define NSL ${NSL}
#define NDL ${NDL}
attribute float iGlyph; attribute vec3 iColor; attribute vec4 iEmit; attribute vec3 iLI; attribute vec3 iLW;
uniform float uTime; uniform vec3 uSL[NSL]; uniform vec4 uDLP[NDL]; uniform vec3 uDLC[NDL]; uniform float uFogDen; uniform float uRamp[16]; uniform float uAmb; uniform sampler2D uCell; uniform float uCollT; uniform vec3 uCamP; uniform vec3 uCutP; uniform float uCut;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
${GLSL_COMMON}
void main(){
  float kind=iEmit.z; float ph=iEmit.y;
  vec3 pos=position;
  if(kind>4.5&&kind<5.5) pos.x+=sin(uTime*1.4+ph*40.0)*0.16*(pos.y+0.5);
  if(kind>12.5&&kind<13.5) pos.x+=sin(uTime*1.1+ph*40.0)*0.08*(pos.y+0.5);
  vec4 wp=modelMatrix*instanceMatrix*vec4(pos,1.0);
  vec3 ctr=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*vec3(0.0,0.0,1.0));
  float cutG=0.0;
  if(uCut>0.5){ vec3 seg=uCutP-uCamP; float L2=max(dot(seg,seg),1e-4); float tc=clamp(dot(ctr-uCamP,seg)/L2,0.0,1.0);
    float rc=mix(2.6,0.9,tc), dc=length(ctr-(uCamP+seg*tc));
    if(tc<0.97&&dc<rc){ if(fract(ph*91.7)>0.1) wp.xyz=vec3(0.0,-1000.0,0.0); else cutG=1.0; }
    else if(tc<0.97&&dc<rc+0.35) cutG=-1.0; }
  // cell state: r = firelight (smooth), g = own fire, b = ash, a = event flag (100 statue gone, 200 floor collapsed)
  vec2 csz=vec2(${MW}.0,${MH}.0);
  float fireL=texture2D(uCell,(ctr.xz+n.xz*0.6)/(csz*${CELL}.0)).r;
  vec4 cs=texture2D(uCell,(floor(ctr.xz/${CELL}.0)+0.5)/csz);
  float evf=cs.a*255.0;
  bool isFloor=(kind>0.5&&kind<1.5)||(kind>4.5&&kind<5.5)||(kind>8.5&&kind<9.5);
  if(kind>11.5&&kind<12.5&&evf<150.0) wp.xyz=vec3(0.0,-1000.0,0.0);
  if(evf>150.0&&isFloor){ float ft=max(uTime-uCollT,0.0); wp.y-=4.9*ft*ft; if(ft>2.5) wp.xyz=vec3(0.0,-1000.0,0.0); }
  if(evf>50.0&&evf<150.0&&kind>7.5&&kind<8.5) wp.xyz=vec3(0.0,-1000.0,0.0);
  if(cs.b>0.5&&kind>4.5&&kind<5.5) wp.xyz=vec3(0.0,-1000.0,0.0);
  if(kind>12.5&&kind<13.5){ if(cs.b>0.5||(evf>40.0&&evf<80.0)) wp.xyz=vec3(0.0,-1000.0,0.0); else { wp.x+=sin(uTime*0.9+ctr.z*0.6+ph*9.0)*0.035*ctr.y; if(evf>15.0&&evf<25.0) wp.y*=0.16; } }
  if(evf>40.0&&evf<80.0){ if(kind>4.5&&kind<5.5) wp.xyz=vec3(0.0,-1000.0,0.0); else if(isFloor) wp.y+=0.05+sin(uTime*1.5+ctr.x*1.7)*0.015; }
  if(kind>2.5&&kind<3.5){ wp.y+=(sin(ctr.x*1.7+uTime*1.6)+sin(ctr.z*1.3-uTime*1.1))*0.018; }
  vec3 lit=vec3(0.0);
  for(int k=0;k<3;k++){ float id=iLI[k]; if(id>-0.5) lit+=uSL[int(id+0.5)]*iLW[k]; }
  for(int i=0;i<NDL;i++){
    vec3 d=uDLP[i].xyz-ctr; float dist=length(d); float x=clamp(1.0-dist/max(uDLP[i].w,0.001),0.0,1.0);
    float ndl=max(dot(n,d/max(dist,0.001))*0.6+0.4,0.0);
    lit+=uDLC[i]*x*x*ndl;
  }
  lit+=vec3(1.0,0.45,0.12)*fireL*3.4*(0.85+0.15*sin(uTime*11.0+ctr.x*3.0));
  // soft knee: lifts dim light, compresses hot spots near light sources while keeping hue
  float lm=max(max(lit.r,lit.g),lit.b);
  lit*=1.55/(1.0+lm*0.8);
  float spd=0.4+fract(ph*17.3)*0.9;
  float emis=iEmit.x*(0.72+0.28*sin(uTime*spd+ph*6.2831));
  if(kind<2.5||(kind>5.5&&kind<6.5)||(kind>7.5&&kind<9.5)) emis*=uAmb;
  float g=iGlyph;
  float tt=floor(uTime*(0.3+fract(ph*7.1)*0.5)+ph*31.0);
  float h=hash(vec2(ph*97.13,tt));
  float flash=0.0;
  if(kind<0.5||(kind>5.5&&kind<6.5)){
    if(h>0.991){ g=3.0+floor(hash(vec2(tt,ph*13.7))*90.0); flash=1.0; }
  } else if(kind>3.5&&kind<4.5){
    if(h>0.55) g=3.0+floor(hash(vec2(tt*1.3,ph*5.1))*90.0);
    emis*=1.0+1.1*pow(0.5+0.5*sin(uTime*2.0+ph*20.0),4.0);
  } else if(kind>1.5&&kind<2.5){
    emis*=0.45+1.3*pow(0.5+0.5*sin(uTime*(1.2+ph*2.5)+ph*50.0),6.0);
  } else if(kind>2.5&&kind<3.5){
    float wv=sin(ctr.x*2.1+ctr.z*1.3-uTime*1.8);
    if(iEmit.w>0.0005){ float an=(iEmit.w-0.001)*6.2831; vec2 fd=vec2(cos(an),sin(an)); wv=sin(dot(ctr.xz,fd)*1.8-uTime*3.2+sin(dot(ctr.xz,vec2(-fd.y,fd.x))*0.7+uTime*0.4)*0.9); }
    g = wv>0.62 ? 13.0 : (wv<-0.75 ? 29.0 : iGlyph);
    emis*=0.7+0.6*(0.5+0.5*wv);
  } else if(kind>6.5&&kind<7.5){
    emis*=0.6+0.6*pow(0.5+0.5*sin(uTime*0.9+ph*30.0),3.0);
  } else if(kind>10.5){
    float sh=0.5+0.5*sin(uTime*1.3+ctr.y*2.2+ph*20.0);
    emis*=0.7+0.7*sh*sh;
  }
  float wave=pow(0.5+0.5*sin(dot(ctr,vec3(0.23,0.11,0.17))-uTime*0.55),14.0);
  emis+=wave*0.09+flash*0.6;
  float heat=0.0;
  if(kind>9.5&&kind<10.5){
    // lava: slow flowing heat bands; the glyph itself shows the temperature
    float f1=sin(ctr.x*0.9+ctr.z*0.4-uTime*0.55+sin(ctr.z*0.7+uTime*0.3)*1.6);
    float f2=sin(ctr.z*1.3-ctr.x*0.6+uTime*0.8);
    heat=clamp(0.5+0.32*f1+0.22*f2,0.0,1.0);
    if(iEmit.w>0.5) heat*=0.22;
    else g = heat>0.82 ? 10.0 : (heat>0.55 ? 94.0 : (heat>0.32 ? 29.0 : 13.0));
    wp.y+=sin(uTime*1.3+ph*30.0)*0.02;
  }
  vCol=iColor*(lit+vec3(emis));
  if(kind>10.5){ vec3 pr=0.55+0.45*cos(6.2831*(vec3(0.0,0.33,0.67)+ctr.y*0.12+uTime*0.04+ph*0.5)); vCol=iColor*mix(vec3(1.0),pr,0.55)*(lit*0.7+vec3(emis)); }
  else if(kind>9.5){ vCol=mix(vec3(0.6,0.06,0.02),vec3(1.0,0.68,0.24),heat)*(0.6+3.0*heat*heat)+lit*iColor*0.15; }
  else if(kind>7.5){
    // ASCII-art shading: the glyph itself encodes how much light the rock receives
    float L=dot(vCol,vec3(0.3,0.55,0.15));
    float ri=sqrt(L*2.4)*15.99+(fract(ph*13.7)-0.5)*1.8;
    if(kind>8.5) ri=min(ri*0.6,8.0);
    g=uRamp[int(clamp(ri,0.0,15.0))];
  }
  if(isFloor){
    if(cs.b>0.5){ vCol*=vec3(0.32,0.3,0.3); g=hash(vec2(ph,3.0))>0.5?12.0:14.0; }
    if(evf>25.0&&evf<35.0&&kind>4.5&&kind<5.5){ vCol*=vec3(0.22,0.3,0.25); }
    if(evf>40.0&&evf<60.0){ float wv=sin(ctr.x*2.1+ctr.z*1.3-uTime*1.8); g=wv>0.5?13.0:94.0; vCol=vec3(0.25,0.6,1.0)*(lit*0.55+vec3(0.14+0.06*wv)); }
    else if(evf>60.0&&evf<80.0){ float f1=sin(ctr.x*0.9+ctr.z*0.4-uTime*0.55+sin(ctr.z*0.7+uTime*0.3)*1.6); float ht=clamp(0.5+0.4*f1,0.0,1.0); g=ht>0.75?10.0:(ht>0.45?94.0:29.0); vCol=mix(vec3(0.6,0.06,0.02),vec3(1.0,0.68,0.24),ht)*(0.6+3.0*ht*ht); }
    if(cs.g>0.02){ float fk=cs.g*(1.6+0.6*sin(uTime*13.0+ph*30.0)); vCol=mix(vCol,vec3(1.0,0.5,0.12)*fk*2.2,min(1.0,cs.g*1.2)); if(hash(vec2(ph,floor(uTime*6.0)))>0.6) g=62.0; }
  }
  if(kind>12.5&&kind<13.5&&evf>15.0&&evf<25.0) vCol*=0.55;
  if(cutG>0.5) vCol*=0.22; else if(cutG<-0.5) vCol=vCol*1.35+vec3(0.08,0.06,0.04);
  vUv=glyphUV(g,uv);
  vec4 mv=viewMatrix*wp;
  float dd=length(mv.xyz);
  vFog=1.0-exp(-uFogDen*uFogDen*dd*dd);
  gl_Position=projectionMatrix*mv;
}`;
// 水面：1枚の板に、フラグメントシェーダーで '~' の文字を描く
export const WATER_VS = `
varying vec3 vW;
void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
export const WATER_FS = `
#define NSL ${NSL}
#define NDL ${NDL}
uniform sampler2D uAtlas; uniform sampler2D uWater; uniform sampler2D uWaterL; uniform float uTime;
uniform vec3 uSL[NSL]; uniform vec4 uDLP[NDL]; uniform vec3 uDLC[NDL]; uniform float uFogDen; uniform vec3 uFogColor;
varying vec3 vW;
${GLSL_COMMON}
void main(){
  vec2 csz=vec2(${MW}.0,${MH}.0); vec2 cc=floor(vW.xz/${CELL}.0);
  if(cc.x<0.0||cc.y<0.0||cc.x>=csz.x||cc.y>=csz.y) discard;
  vec4 w=texture2D(uWater,(cc+0.5)/csz);
  if(w.r<0.25) discard;
  bool deep=w.r>0.75;
  float sub=deep?${CELL}.0/3.0:${CELL}.0/4.0;
  vec2 sp=vW.xz/sub; sp.x+=mod(floor(sp.y),2.0)*0.5; vec2 si=floor(sp), lp=fract(sp);
  vec2 ctr=(si+0.5)*sub;
  float hh=hash(si*0.37+1.3);
  lp+=vec2(hash(si+7.1),hash(si+3.3))*0.36-0.18;
  float wv=sin(ctr.x*2.1+ctr.y*1.3-uTime*1.8);
  if(w.g>0.0005){ float an=(w.g-0.001)*6.2831; vec2 fd=vec2(cos(an),sin(an)); wv=sin(dot(ctr,fd)*1.8-uTime*3.2+sin(dot(ctr,vec2(-fd.y,fd.x))*0.7+uTime*0.4)*0.9); }
  float g=wv>0.62?13.0:(wv<-0.75?29.0:94.0);
  float scale=(deep?0.58:0.5)/sub*(0.75+0.5*hash(si+11.7));
  vec2 uv=(lp-0.5)/scale+0.5; uv.y=1.0-uv.y;
  if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) discard;
  float a=texture2D(uAtlas,glyphUV(g,uv),-0.6).a;
  float fw=max(fwidth(a),0.04); a=clamp((a-0.42)/fw+0.5,0.0,1.0);
  if(a<0.03) discard;
  vec4 L=texture2D(uWaterL,(cc+0.5)/csz);
  vec3 lit=vec3(0.0);
  if(L.x>0.5) lit+=uSL[int(L.x-0.5)]*L.y;
  if(L.z>0.5) lit+=uSL[int(L.z-0.5)]*L.w;
  for(int i=0;i<NDL;i++){ vec3 d=uDLP[i].xyz-vW; float dist=length(d); float x=clamp(1.0-dist/max(uDLP[i].w,0.001),0.0,1.0); lit+=uDLC[i]*x*x*(max(d.y/max(dist,0.001),0.0)*0.6+0.4); }
  float lm=max(max(lit.r,lit.g),lit.b); lit*=1.55/(1.0+lm*0.8);
  vec3 wc=deep?vec3(0.1,0.22,0.55):(w.b>0.5?vec3(0.22,0.72,1.0):vec3(0.28,0.62,1.0));
  float emis=(deep?(w.b>0.5?0.12:0.06):(w.b>0.5?0.24:0.16))*(0.7+0.6*(0.5+0.5*wv));
  vec3 col=wc*(0.8+0.4*hh)*(lit+vec3(emis));
  if(w.a>0.5){ float ap=0.5+0.5*sin(uTime*0.9+ctr.x*0.7+ctr.y*0.5+hh*6.0); col+=vec3(0.15,0.9,0.55)*(0.25+0.55*ap*ap); }
  float dd=distance(cameraPosition,vW); float fog=1.0-exp(-uFogDen*uFogDen*dd*dd);
  gl_FragColor=vec4(mix(col,uFogColor,fog),a);
}`;
/** 文字のフラグメントシェーダー */
export const GLYPH_FS = `
uniform sampler2D uAtlas; uniform vec3 uFogColor;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
void main(){
  float a=texture2D(uAtlas,vUv,-0.6).a;
  float fw=max(fwidth(a),0.04);
  a=clamp((a-0.42)/fw+0.5,0.0,1.0);
  if(a<0.03) discard;
  gl_FragColor=vec4(mix(vCol,uFogColor,vFog),a);
}`;
/** dyn の文字（その時だけ描く文字）の頂点シェーダー */
export const DYN_VS = `
attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iP;
uniform float uFogDen;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
${GLSL_COMMON}
void main(){
  vec2 p=position.xy*iP.y;
  vec4 mv;
  if(iP.z<0.5){ mv=viewMatrix*vec4(iPos,1.0); mv.xy+=p; }
  else{
    float c=cos(iP.w), s=sin(iP.w); vec3 w=iPos;
    if(iP.z<1.5) w+=vec3(p.x*c-p.y*s,0.0,p.x*s+p.y*c);
    else w+=vec3(p.x*c,p.y,-p.x*s);
    mv=viewMatrix*vec4(w,1.0);
  }
  vCol=iCol; vUv=glyphUV(iP.x,uv);
  float dd=length(mv.xyz); vFog=1.0-exp(-uFogDen*uFogDen*dd*dd);
  gl_Position=projectionMatrix*mv;
}`;
/** 粒子（点）の頂点シェーダーとフラグメントシェーダー */
export const PT_VS = `
attribute vec3 aCol; attribute float aSize; attribute float aGlyph;
uniform float uScale; uniform float uFogDen;
varying vec3 vCol; varying float vGlyph;
void main(){
  vec4 mv=viewMatrix*vec4(position,1.0);
  float dd=length(mv.xyz);
  vCol=aCol*exp(-uFogDen*uFogDen*dd*dd)*smoothstep(0.25,1.4,dd);
  vGlyph=aGlyph;
  gl_PointSize=clamp(aSize*uScale/max(-mv.z,0.05),0.0,256.0);
  gl_Position=projectionMatrix*mv;
}`;
export const PT_FS = `
uniform sampler2D uAtlas;
varying vec3 vCol; varying float vGlyph;
void main(){
  vec2 pc=vec2(gl_PointCoord.x,1.0-gl_PointCoord.y);
  vec2 uv=pc*0.94+0.03;
  float cx=mod(vGlyph,16.0), cy=floor(vGlyph/16.0);
  float a=texture2D(uAtlas,vec2((cx+uv.x)/16.0,1.0-(cy+1.0-uv.y)/7.0)).a;
  float r=length(pc-0.5);
  float k=a+exp(-r*r*20.0)*0.3;
  if(k<0.01) discard;
  gl_FragColor=vec4(vCol*k,1.0);
}`;

/** dyn の文字を、1回に描ける数 */
export const DYN_MAX = 12000;
/** 粒子の入れ物の大きさ：塵 DUST_N・ガス GAS_N・そのほかの粒子 P_MAX。PT_TOTAL はその合計、P0 はそのほかの粒子の始まりの番号 */
export const DUST_N = 900,
  GAS_N = 700,
  P_MAX = 3600,
  PT_TOTAL = DUST_N + GAS_N + P_MAX,
  P0 = DUST_N + GAS_N;
