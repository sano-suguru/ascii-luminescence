// ---------------------------------------------------------------- world state
let D=null, depth=1, staticMesh=null, occMesh=null, glyphCount=0;
let monsters=[], fixtures=[];
let explored=new Uint8Array(NCELL), mem=new Float32Array(NCELL*3), fovVis=new Uint32Array(NCELL), fovStamp=1;
let visitedRooms=new Set(), stairsSeen=false, fogBase=0.05;
const player={x:0,z:0,vx:0,vz:0,yaw:0,pitch:-0.04,bob:0,eye:1.62,hp:40};
const edge={t:0,k:'',idle:0};
let hintHTML='';
function showHint(h){ if(h===hintHTML)return; hintHTML=h; const el=document.getElementById('hint'); if(el)el.innerHTML=h; }
const ceilAt=(x,z)=>{ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); if(cx<0||cz<0||cx>=MW||cz>=MH)return BASE_H; return D.ceil[cz*MW+cx]; };

// value noise (deterministic per level)
let noiseSeed=1;
const hash3=(x,y,z)=>{ let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^noiseSeed; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; };
function vnoise(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z), xf=x-xi, yf=y-yi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf);
  const l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(hash3(xi,yi,zi),hash3(xi+1,yi,zi),u),l(hash3(xi,yi+1,zi),hash3(xi+1,yi+1,zi),u),v),
           l(l(hash3(xi,yi,zi+1),hash3(xi+1,yi,zi+1),u),l(hash3(xi,yi+1,zi+1),hash3(xi+1,yi+1,zi+1),u),v),w);
}
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

let chunks=[];
let waterMesh=null, waterTex=null, waterLTex=null;
function makeWater(){
  waterTex=new T.DataTexture(new Float32Array(NCELL*4),MW,MH,T.RGBAFormat,T.FloatType); waterTex.magFilter=waterTex.minFilter=T.NearestFilter;
  waterLTex=new T.DataTexture(new Float32Array(NCELL*4),MW,MH,T.RGBAFormat,T.FloatType); waterLTex.magFilter=waterLTex.minFilter=T.NearestFilter;
  const mat=new T.ShaderMaterial({uniforms:{uAtlas:U.uAtlas,uTime:U.uTime,uSL:U.uSL,uDLP:U.uDLP,uDLC:U.uDLC,uFogDen:U.uFogDen,uFogColor:U.uFogColor,uWater:{value:waterTex},uWaterL:{value:waterLTex}},
    vertexShader:WATER_VS,fragmentShader:WATER_FS,side:T.DoubleSide,alphaToCoverage:true,extensions:{derivatives:true}});
  const geo=new T.PlaneGeometry(MW*CELL,MH*CELL); geo.rotateX(-Math.PI/2);
  waterMesh=new T.Mesh(geo,mat); waterMesh.position.set(MW*CELL/2,0.06,MH*CELL/2); waterMesh.frustumCulled=false; scene.add(waterMesh);
}
function updateWater(){
  const W2=waterTex.image.data, L2=waterLTex.image.data, oI=new Float32Array(3), oW=new Float32Array(3);
  for(let i=0;i<NCELL;i++){
    const lq=D.liquid[i], o=i*4; W2[o]=W2[o+1]=W2[o+2]=W2[o+3]=0; L2[o]=L2[o+1]=L2[o+2]=L2[o+3]=0;
    if(lq!==LQ_WATER&&lq!==LQ_DEEP)continue;
    const r=D.roomOf[i]>=0?D.rooms[D.roomOf[i]]:null, lake=(r&&r.theme&&r.theme.k==='lake')||D.stratum.k==='cavern';
    W2[o]=lq===LQ_DEEP?1:0.5; W2[o+1]=D.flow[i]?flowW(D.flow[i]):0; W2[o+2]=lake?1:0; W2[o+3]=D.algae&&D.algae[i]?1:0;
    topLights(D.lights,(i%MW+0.5)*CELL,0.1,(((i/MW)|0)+0.5)*CELL,0,1,0,i,oI,oW,0);
    L2[o]=oI[0]>=0?oI[0]+1:0; L2[o+1]=oW[0]; L2[o+2]=oI[1]>=0?oI[1]+1:0; L2[o+3]=oW[1];
  }
  waterTex.needsUpdate=true; waterLTex.needsUpdate=true;
}

const flowW=f=>((((f-10)%(Math.PI*2))+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*0.998+0.001;
const CHUNK=8, CXN=Math.ceil(MW/CHUNK), CZN=Math.ceil(MH/CHUNK);
function buildWorld(){
  for(const c of chunks){ scene.remove(c.mesh); c.mesh.geometry.dispose(); }
  chunks=[];
  if(occMesh){ scene.remove(occMesh); occMesh.geometry.dispose(); }
  const {tile,liquid,surface,roomOf,rooms,lights,ceil}=D;
  noiseSeed=D.noiseSeed;
  const cap=360000;
  const M=new Float32Array(cap*16), GL=new Float32Array(cap), CO=new Float32Array(cap*3), EM=new Float32Array(cap*4), LI=new Float32Array(cap*3), LW=new Float32Array(cap*3);
  const CK=new Int16Array(cap), PY=new Float32Array(cap);
  let n=0; const occ=[];
  const m4=new T.Matrix4(), q=new T.Quaternion(), e=new T.Euler(0,0,0,'YXZ'), p=new T.Vector3(), s=new T.Vector3();
  const push=(x,y,z,ex,ey,size,g,r,gg,b,emis,kind,ref,nx,ny,nz)=>{
    if(n>=cap)return;
    e.set(ex,ey,0,'YXZ'); q.setFromEuler(e); p.set(x,y,z); s.set(size,size,size); m4.compose(p,q,s); m4.toArray(M,n*16);
    GL[n]=g; CO[n*3]=r; CO[n*3+1]=gg; CO[n*3+2]=b; EM[n*4]=emis; EM[n*4+1]=rand(); EM[n*4+2]=kind; EM[n*4+3]=0;
    topLights(lights,x,y,z,nx,ny,nz,ref,LI,LW,n*3);
    { const ci=cellOf(x,z), dm=ci>=0?D.darkMul[ci]:1; if(dm<1){ LW[n*3]*=dm; LW[n*3+1]*=dm; LW[n*3+2]*=dm; EM[n*4]*=0.3+0.7*dm; } }
    CK[n]=clamp(Math.floor(x/(CELL*CHUNK)),0,CXN-1)+clamp(Math.floor(z/(CELL*CHUNK)),0,CZN-1)*CXN; PY[n]=y;
    n++;
  };
  const pushX=(x,y,z,size,g,c,emis,kind,ref)=>{ const yaw=rand()*Math.PI; push(x,y,z,0,yaw,size,g,c[0],c[1],c[2],emis,kind,ref,null,0,0); push(x,y,z,0,yaw+Math.PI/2,size,g,c[0],c[1],c[2],emis,kind,ref,null,0,0); };
  const cellOf=(x,z)=>{ const cx=Math.floor(x/CELL), cz=Math.floor(z/CELL); return (cx<0||cz<0||cx>=MW||cz>=MH)?-1:cz*MW+cx; };

  // masonry wall face for ordinary rooms and corridors (layered glyphs receding into the stone)
  const RG='##==||[]HH#:=#|][', FGL='##H=+#|#=#';
  let faceStyle=null, faceSkip=null, faceVein=0;
  const face=(pcx,pcz,yaw,nX,nZ,y0,y1,ref,tint,layers,occl,th)=>{
    const ruinW=D.stratum.k==='ruins', fortW=D.stratum.k==='fortress', rmF=roomOf[ref]>=0?rooms[roomOf[ref]]:null;
    const tX=Math.cos(yaw), tZ=-Math.sin(yaw);
    const segs=[];
    if(y0<0)segs.push([y0,Math.min(y1,0),0.62,3,0.66]);
    if(y1>0&&y0<BASE_H)segs.push([Math.max(y0,0),Math.min(y1,BASE_H),0.4,5,0.44]);
    if(y1>BASE_H)segs.push([Math.max(y0,BASE_H),y1,0.66,3,0.7]);
    for(const [a,b,target,cols,size] of segs){
      const len=b-a; if(len<0.1)continue;
      const rows=Math.max(1,Math.round(len/target)), sp=len/rows;
      for(let row=0;row<rows;row++){
        const yc=a+(row+0.5)*sp;
        const lyr=((ruinW||fortW)&&(a>=BASE_H-0.01||!rmF))?1:layers;
        for(let L=0;L<lyr;L++){
          const off=(L%2)?(CELL/cols)*0.5:0, sz=size*(1-0.15*L), dim=1-0.36*L;
          for(let col=0;col<cols;col++){
            let u=(col+0.5)*(CELL/cols)-CELL/2+off; if(u>CELL/2)u-=CELL;
            if(faceSkip&&faceSkip(u,yc))continue;
            const dp=L===0?rand()*0.035:-(L*0.24+rand()*0.04), v=(0.75+rand()*0.45)*dim;
            let r=tint[0]*v, g=tint[1]*v, bb=tint[2]*v, emis=(0.03+rand()*0.035)*dim, kind=0, ch=faceStyle?faceStyle.wall[Math.floor(rand()*faceStyle.wall.length)]:ruinW?RG[Math.floor(rand()*RG.length)]:fortW?FGL[Math.floor(rand()*FGL.length)]:WG[Math.floor(rand()*WG.length)];
            if(yc<0){ const kd=clamp(1+yc/CH_D,0.15,1); r*=kd; g*=kd; bb*=kd; }
            if(L===0&&rand()<(faceStyle?0.05:ruinW?0.035:0.012)){ kind=4; const c=th?th.col:[0.6,0.45,1.0]; r=c[0]; g=c[1]; bb=c[2]; emis=0.5+rand()*0.6; ch=pick(RUNESET); }
            if(L===0&&faceVein&&kind!==4&&rand()<0.24){ const vc=VEIN_COL[faceVein]; ch=faceVein===1?'$':'*'; r=vc[0]; g=vc[1]; bb=vc[2]; emis=0.35+rand()*0.25; kind=7; }
            push(pcx+tX*u+nX*dp,yc,pcz+tZ*u+nZ*dp,0,yaw,sz,G(ch),r,g,bb,emis,kind,ref,nX,0,nZ);
          }
        }
      }
    }
    if(ruinW&&y1>2&&rand()<(rmF&&rmF.rkind==='garden'?0.55:0.16)){
      const tX=Math.cos(yaw), tZ=-Math.sin(yaw), u=R(-0.8,0.8), len=R(1.2,Math.min(4.2,y1-0.6)), glow=rmF&&rmF.rkind==='garden'&&rand()<0.5;
      for(let y=y1-0.2;y>y1-len;y-=0.3)push(pcx+tX*(u+Math.sin(y*2)*0.08)+nX*0.07,y,pcz+tZ*(u+Math.sin(y*2)*0.08)+nZ*0.07,0,yaw,0.34,G(pick([';','{','}','(',')','~'])),glow?0.35:0.3,glow?1.0:0.8,glow?0.85:0.4,glow?0.28:0.05,5,ref,nX,0,nZ);
    }
    if(occl){
      const od=layers*0.24+0.1, ocx=pcx-nX*od, ocz=pcz-nZ*od, hw=(CELL+0.1)/2;
      occ.push(ocx-tX*hw,y0,ocz-tZ*hw, ocx+tX*hw,y0,ocz+tZ*hw, ocx+tX*hw,y1,ocz+tZ*hw, ocx-tX*hw,y0,ocz-tZ*hw, ocx+tX*hw,y1,ocz+tZ*hw, ocx-tX*hw,y1,ocz-tZ*hw);
    }
  };

  // ---- organic cavern surfaces: a smoothed distance field + 3D noise, sliced into contour lines
  const FR=0.5, Y0=2.2;
  const rockN=(x,y,z)=>{ const nn=0.65*vnoise(x*0.5,y*0.5,z*0.5)+0.35*vnoise(x*1.25+31.7,y*1.25,z*1.25); const t=sstep(1.4,3.0,y); return (1-t)*nn*0.6+t*(nn-0.42)*1.7; };
  rooms.forEach((r,ri)=>{
    if(!r.cave)return;
    const tintOf=t2=>(t2.k==='magma'||t2.k==='basalt'||t2.k==='ashfield')?[0.46,0.3,0.32]:[0.5+t2.col[0]*0.22,0.47+t2.col[1]*0.22,0.66+t2.col[2]*0.22];
    const th=r.theme, tint=tintOf(th), thR=th, tintR=tint;
    const gx0=r.x-2, gz0=r.y-2, ox=gx0*CELL, oz=gz0*CELL, fw=(r.w+4)*4, fh=(r.h+4)*4, NF=fw*fh;
    const sdf=pred=>{
      const open=new Uint8Array(NF), dO=new Float32Array(NF), dC=new Float32Array(NF);
      for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ const c=cellOf(ox+(i+0.5)*FR,oz+(j+0.5)*FR); const o=c>=0&&pred(c)?1:0; const k=j*fw+i; open[k]=o; dO[k]=o?1e9:0; dC[k]=o?0:1e9; }
      const a=FR, b=FR*1.4142;
      for(const arr of [dO,dC]){
        for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ const k=j*fw+i; let v=arr[k];
          if(i>0)v=Math.min(v,arr[k-1]+a); if(j>0){ v=Math.min(v,arr[k-fw]+a); if(i>0)v=Math.min(v,arr[k-fw-1]+b); if(i<fw-1)v=Math.min(v,arr[k-fw+1]+b); } arr[k]=v; }
        for(let j=fh-1;j>=0;j--)for(let i=fw-1;i>=0;i--){ const k=j*fw+i; let v=arr[k];
          if(i<fw-1)v=Math.min(v,arr[k+1]+a); if(j<fh-1){ v=Math.min(v,arr[k+fw]+a); if(i<fw-1)v=Math.min(v,arr[k+fw+1]+b); if(i>0)v=Math.min(v,arr[k+fw-1]+b); } arr[k]=v; }
      }
      const sd0=new Float32Array(NF); for(let k=0;k<NF;k++)sd0[k]=open[k]?dO[k]-FR*0.5:-(dC[k]-FR*0.5);
      const sd=new Float32Array(NF); let mx=0;
      for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ let acc=0,c=0; for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){ const ii=i+di, jj=j+dj; if(ii<0||jj<0||ii>=fw||jj>=fh)continue; acc+=sd0[jj*fw+ii]; c++; } const v=acc/c; sd[j*fw+i]=v; if(v>mx)mx=v; }
      return {sd,mx};
    };
    const samp=(sd,x,z)=>{ let fx=clamp((x-ox)/FR-0.5,0,fw-1.001), fz=clamp((z-oz)/FR-0.5,0,fh-1.001); const i=Math.floor(fx), j=Math.floor(fz), u=fx-i, v=fz-j, k=j*fw+i;
      return (sd[k]*(1-u)+sd[k+1]*u)*(1-v)+(sd[k+fw]*(1-u)+sd[k+fw+1]*u)*v; };
    // contour slicing: emits glyphs along the iso-line of vf at each height
    const slice=(sd,vf,ys,accept,style,qb)=>{
      const vals=new Float32Array(NF), h=0.12;
      const V=(x,y,z)=>vf(samp(sd,x,z),x,y,z);
      for(const [y,sp,size,layers] of ys){
        const gq=qb?qb(y):0;
        for(let j=0;j<fh;j++)for(let i=0;i<fw;i++){ const k=j*fw+i; if(qb){ const b0=sd[k]-gq; if(b0>1.4||b0<-1.4){ vals[k]=b0; continue; } } const x=ox+(i+0.5)*FR, z=oz+(j+0.5)*FR; vals[k]=vf(sd[k],x,y,z); }
        let acc=rand()*sp;
        for(let j=0;j<fh-1;j++)for(let i=0;i<fw-1;i++){
          const k=j*fw+i, va=vals[k], vb=vals[k+1], vc=vals[k+fw+1], vd=vals[k+fw];
          const pts=[], x0=ox+(i+0.5)*FR, z0=oz+(j+0.5)*FR;
          const ed=(v1,v2,x1,z1,x2,z2)=>{ if((v1>0)!==(v2>0)){ const t=v1/(v1-v2); pts.push(x1+(x2-x1)*t,z1+(z2-z1)*t); } };
          ed(va,vb,x0,z0,x0+FR,z0); ed(vb,vc,x0+FR,z0,x0+FR,z0+FR); ed(vd,vc,x0,z0+FR,x0+FR,z0+FR); ed(va,vd,x0,z0,x0,z0+FR);
          for(let s2=0;s2+3<pts.length;s2+=4){
            const ax=pts[s2], az=pts[s2+1], bx=pts[s2+2], bz=pts[s2+3], len=Math.hypot(bx-ax,bz-az);
            acc+=len;
            while(acc>=sp){
              acc-=sp; const t=rand(), px=ax+(bx-ax)*t, pz=az+(bz-az)*t;
              let gx=V(px+h,y,pz)-V(px-h,y,pz), gy=V(px,y+h,pz)-V(px,y-h,pz), gz=V(px,y,pz+h)-V(px,y,pz-h);
              const gl=Math.hypot(gx,gy,gz); if(gl<1e-5)continue; gx/=gl; gy/=gl; gz/=gl;
              const hl=Math.hypot(gx,gz)||1;
              let ref=-1;
              for(const k2 of [0.6,1.2,2.0,3.0]){ const c=cellOf(px+gx/hl*k2,pz+gz/hl*k2); if(c<0)break; if(accept(c)){ref=c;break;} if(tile[c]!==TW)break; }
              if(ref<0)continue;
              style(px,y,pz,gx,gy,gz,ref,size,layers);
            }
          }
        }
      }
    };
    const rockGlyph=(px,y,pz,nx,ny,nz,ref,size,layers,deep)=>{
      const th=r.shell?rooms[roomOf[ref]].theme:thR, tint=r.shell?tintOf(th):tintR;
      const yaw=Math.atan2(nx,nz), pitch=-Math.asin(clamp(ny,-1,1));
      for(let L=0;L<layers;L++){
        const d=L*0.27, sz=size*(1-0.14*L), dim=1-0.33*L; let v=(0.8+rand()*0.4)*dim;
        const rk=D.rock, bnd=0.5+0.5*Math.sin(y*1.35+vnoise(px*0.15,y*0.3,pz*0.15)*5);
        let c=[(rk.a[0]*(1-bnd)+rk.b[0]*bnd)*0.55+tint[0]*0.45,(rk.a[1]*(1-bnd)+rk.b[1]*bnd)*0.55+tint[1]*0.45,(rk.a[2]*(1-bnd)+rk.b[2]*bnd)*0.55+tint[2]*0.45], emis=(0.025+rand()*0.03)*dim, kind=8, g=G('#');
        const wcI=cellOf(px-nx*0.6,pz-nz*0.6), ve=wcI>=0?D.vein[wcI]:0;
        if(L===0){
          const rr=rand();
          if(ve&&rr<0.32&&ny>-0.4){ kind=7; c=VEIN_COL[ve]; emis=R(0.35,0.6); g=G(ve===1?'$':'*'); }
          else if(ny<-0.5&&rr<(r.shell?0.17:0.07)){ kind=2; c=r.shell?pick([[0.6,0.55,1.0],[0.5,0.9,1.0],[1.0,0.82,0.6],[0.7,1.0,0.8]]):[0.6,0.55,1.0]; emis=R(0.4,0.8); g=G(pick(['*','+','*'])); }
          else if(th.k==='fungal'&&y<1.6&&rr<0.09){ kind=7; c=th.col; emis=R(0.3,0.6); g=G(pick(['"',',','v'])); }
          else if((th.k==='magma'||th.k==='basalt'||th.k==='ashfield')&&y<2.8&&rr<0.09){ kind=7; c=[1.0,0.38,0.08]; emis=R(0.5,1.1); g=G(pick(['~','=','-'])); }
          else if(th.k==='chasm'&&deep&&y<-2.5&&rr<0.07){ kind=7; c=[1.0,0.42,0.12]; emis=R(0.5,1.0); g=G(pick(['~','=','-'])); }
          else if(rr<0.012){ kind=4; c=th.col; emis=R(0.4,0.9); g=G(pick(RUNESET)); }
        }
        if(deep){ const k=clamp(1+y/CH_D,0.15,1); v*=k; }
        push(px-nx*d,y-ny*d,pz-nz*d,pitch,yaw,sz,g,c[0]*v,c[1]*v,c[2]*v,emis,kind,ref,nx,ny,nz);
      }
    };
    // cavern walls and vault
    if(!r.noShell){
      const C=sdf(c=>tile[c]!==TW), top=(D.finalVault&&(D.rooms[D.roomOf[D.stairs]]===r||r.cells.includes(D.stairs)||(r.cells0&&r.cells0.includes(D.stairs))))?Math.max(th.base,13):th.base, dmx=Math.max(1.5,C.mx);
      const gD=y=>y<Y0?0:dmx*Math.pow((y-Y0)/(top-Y0),1.6);
      for(const i of (r.shell?r.cells0.filter(i=>tile[i]!==TW):r.cells.concat(r.chasm))){ const sdc=samp(C.sd,(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL); ceil[i]=Y0+(top-Y0)*Math.pow(clamp(sdc/dmx,0,1),1/1.6); }
      const ys=[];
      if(r.shell){ for(let y=0.25;y<BASE_H;y+=0.5)ys.push([y,0.5,0.52,2]); for(let y=3.7;y<top+0.4;y+=0.8)ys.push([y,0.8,0.82,2]); }
      else { for(let y=0.21;y<BASE_H;y+=0.42)ys.push([y,0.42,0.47,3]); for(let y=3.6;y<top+0.4;y+=0.62)ys.push([y,0.62,0.68,2]); }
      const acc=r.shell?(c=>roomOf[c]>=0&&rooms[roomOf[c]].cave&&tile[c]!==TW):(c=>roomOf[c]===ri&&tile[c]!==TW);
      slice(C.sd,(sv,x,y,z)=>sv+rockN(x,y,z)-gD(y),ys,acc,(px,y,pz,nx,ny,nz,ref,size,layers)=>rockGlyph(px,y,pz,nx,ny,nz,ref,size,layers,false),gD);
    }
    // chasm throat narrowing into the dark
    if(r.chasm.length&&D.stratum.k!=='abyss'){
      const Cc=sdf(c=>tile[c]===TC||D.bridge[c]===1), dmc=Math.max(1,Cc.mx);
      const ysc=[]; for(let y=-0.3;y>-CH_D+0.3;y-=0.55)ysc.push([y,0.52,0.58,2]);
      slice(Cc.sd,(sv,x,y,z)=>{ const nn=0.65*vnoise(x*0.5,y*0.5,z*0.5)+0.35*vnoise(x*1.25,y*1.25+11,z*1.25); const t=clamp(-y/2,0,1); return sv-((1-t)*nn*0.4+t*(nn-0.5)*1.3)-dmc*0.55*Math.pow(-y/CH_D,1.3); },
        ysc,c=>(tile[c]===TC||D.bridge[c]===1)&&roomOf[c]===ri,(px,y,pz,nx,ny,nz,ref,size,layers)=>rockGlyph(px,y,pz,nx,ny,nz,ref,size,layers,true));
    }
  });

  // ---- per-cell content
  const FACES=[[1,0,-Math.PI/2],[-1,0,Math.PI/2],[0,1,Math.PI],[0,-1,0]];
  for(let cz=0;cz<MH;cz++)for(let cx=0;cx<MW;cx++){
    const i=cz*MW+cx, ti=tile[i]; if(ti!==TF&&ti!==TC)continue;
    const ri=roomOf[i], room=ri>=0?rooms[ri]:null, th=room?room.theme:(ti===TC?((rooms.find(r=>r.theme)||{}).theme||null):null), cave=!!(room&&room.cave);
    const tint=cave&&(th.k==='magma'||th.k==='basalt'||th.k==='ashfield')?[0.46,0.3,0.32]:cave?[0.5+th.col[0]*0.2,0.48+th.col[1]*0.2,0.66+th.col[2]*0.2]:(th?[0.6+th.col[0]*0.14,0.6+th.col[1]*0.14,0.78+th.col[2]*0.14]:[0.5,0.53,0.8]);
    const c0=ceil[i];
    if(!cave){
      for(let fi=0;fi<4;fi++){ const f=FACES[fi];
        const ax=cx+f[0], az=cz+f[1], j=az*MW+ax;
        const nt=(ax<0||az<0||ax>=MW||az>=MH)?TW:tile[j];
        const yaw=f[2], nX=-f[0], nZ=-f[1], pcx=(cx+0.5+f[0]*0.5)*CELL, pcz=(cz+0.5+f[1]*0.5)*CELL;
        if(nt===TW){ const vj=(ax<0||az<0||ax>=MW||az>=MH)?0:D.vaultCell[j]; faceStyle=vj?VAULTS[vj-1]:null;
          const top=vj&&c0>=5?VAULT_WALL_H:c0, vt=vj?[faceStyle.wcol[0]*0.85,faceStyle.wcol[1]*0.85,faceStyle.wcol[2]*0.85]:tint;
          let eg=D.engr.get(i*4+fi); faceVein=D.vein[j]||0;
          const tX=Math.cos(yaw), tZ=-Math.sin(yaw);
          if(eg&&eg.skip){ const sa=ARTS[eg.art], sh=sa.length*0.42, pOff=-((eg.mi%MW-cx)*tX+(((eg.mi/MW)|0)-cz)*tZ)*CELL/2*-1;
            faceSkip=(u,yc)=>Math.abs(u-pOff)<2.0&&yc>1.95-sh/2-0.35&&yc<1.95+sh/2+0.35; eg=null; }
          const art=eg&&ARTS[eg.art], wide=!!(eg&&eg.wide), sx=wide?0.5:0.27, sy=wide?0.42:0.3, gs=wide?0.48:0.33;
          const aH=art?art.length*sy:0, aY=wide?1.95:1.7, y0=aY+aH/2, cOff=wide?((eg.pi%MW-cx)*tX+(((eg.pi/MW)|0)-cz)*tZ)*CELL/2:0;
          if(art)faceSkip=(u,yc)=>Math.abs(u-cOff)<(wide?2.0:1.1)&&yc>aY-aH/2-0.35&&yc<aY+aH/2+0.35;
          face(pcx,pcz,yaw,nX,nZ,ti===TC?-CH_D:0,top,i,vt,2,true,th); faceStyle=null; faceSkip=null; faceVein=0;
          if(art){
            for(let r2=0;r2<art.length;r2++)for(let c2=0;c2<7;c2++){ const ch=art[r2][c2]; if(ch===' ')continue; const u=cOff+(c2-3)*sx, y=y0-(r2+0.5)*sy;
              push(pcx+tX*u+nX*0.05,y,pcz+tZ*u+nZ*0.05,0,yaw,gs,G(ch),1.0,0.86,0.6,0.3,7,i,nX,0,nZ); }
            const fz=gs*0.85;
            for(let c2=-1;c2<=7;c2++)for(const y of [y0+sy*0.5,y0-aH-sy*0.5]){ const u=cOff+(c2-3)*sx; push(pcx+tX*u+nX*0.04,y,pcz+tZ*u+nZ*0.04,0,yaw,fz,G(c2===-1||c2===7?'+':'-'),0.66,0.55,0.44,0.06,1,i,nX,0,nZ); }
            for(let r2=0;r2<art.length;r2++)for(const c2 of [-1,7]){ const u=cOff+(c2-3)*sx; push(pcx+tX*u+nX*0.04,y0-(r2+0.5)*sy,pcz+tZ*u+nZ*0.04,0,yaw,fz,G('|'),0.66,0.55,0.44,0.06,1,i,nX,0,nZ); } }
          continue; }
        if(ti===TC&&nt!==TC){ face(pcx,pcz,yaw,nX,nZ,-CH_D,0,i,tint,1,false,th); continue; }
        const nr=roomOf[j]; if(nr>=0&&rooms[nr].cave)continue;
        const c1=ceil[j]; if(c1<c0-0.01)face(pcx,pcz,yaw,nX,nZ,c1,c0,i,tint,1,false,th);
      }
      const per=2;
      for(let a=0;a<per;a++)for(let bb=0;bb<per;bb++){
        if(rand()>0.55)continue; const star=rand()<0.08;
        push((cx+(a+0.5)/per)*CELL+R(-0.25,0.25),c0-0.03,(cz+(bb+0.5)/per)*CELL+R(-0.25,0.25),Math.PI/2,R(0,6.28),star?0.42:0.5,
          G(star?pick(['*','+','*','x']):pick(['.','.','`','\'','-',':'])),0.55,0.5,0.95,star?R(0.45,0.85):R(0.02,0.07),2,i,0,-1,0);
      }
    }
    const deepWater=()=>{
      for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++)push((cx+(a+0.5)/2)*CELL+R(-0.3,0.3),-0.7,(cz+(bb+0.5)/2)*CELL+R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.5,G(pick(['.',':','~'])),0.08,0.18,0.45,0.07,2,i,0,1,0);
    };
    if(D.stratum.k==='abyss'&&ti===TF&&!D.bridge[i]){
      for(const f of FACES){ const ax=cx+f[0], az=cz+f[1]; if(ax<0||az<0||ax>=MW||az>=MH||tile[az*MW+ax]!==TC||D.bridge[az*MW+ax])continue;
        const dep=1.6+vnoise(ax*0.7,5.5,az*0.7)*4.2, pcx=(cx+0.5+f[0]*0.5)*CELL, pcz=(cz+0.5+f[1]*0.5)*CELL;
        faceStyle={wall:'%&8#:o',wcol:tint}; face(pcx,pcz,Math.atan2(f[0],f[1]),f[0],f[1],-dep,0,i,tint,1,false,th); faceStyle=null; }
    }
    if(ti===TC||D.bridge[i]===1){
      for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++){ if(rand()<0.35)continue; const c=th.col;
        push((cx+(a+0.5)/2)*CELL+R(-0.3,0.3),-CH_D+0.05,(cz+(bb+0.5)/2)*CELL+R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.7,G(pick(['.','*',':','~','\''])),c[0],c[1]*0.7,c[2]*0.7,R(0.12,0.3),2,i,0,1,0); }
    }
    if(ti===TC){
    } else if(D.bridge[i]){
      const dir=D.bridgeDir[i], ax=dir===0?[1,0]:[0,1], pr=dir===0?[0,1]:[1,0], x0=(cx+0.5)*CELL, z0=(cz+0.5)*CELL, rope=D.bridge[i]===1;
      const deckY=rope?0.02:0.22, wood=[0.62,0.42,0.25], stoneC=[0.6,0.6,0.76], dc2=rope?wood:stoneC;
      const nbW=(dx,dz)=>{ const x=cx+dx, z=cz+dz; if(x<0||z<0||x>=MW||z>=MH)return false; const j=z*MW+x; return tile[j]===TF&&(D.bridge[j]>0||(liquid[j]!==LQ_DEEP&&liquid[j]!==LQ_LAVA)); };
      const sideOpen=sd=>nbW(pr[0]*sd,pr[1]*sd), endOpen=e=>nbW(ax[0]*e,ax[1]*e), junction=sideOpen(-1)||sideOpen(1);
      for(let k=0;k<6;k++)for(let w=-1;w<=1;w++){ const u=(k+0.5)/6*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*w*0.42, pz=z0+ax[1]*u+pr[1]*w*0.42;
        push(px,deckY,pz,-Math.PI/2,dir===0?Math.PI/2:0,0.46,G(rope?'=':pick(['#','=','#'])),dc2[0],dc2[1],dc2[2],0.04,rope?1:8,i,0,1,0); }
      if(junction)for(let k=0;k<6;k++)for(const w of [-1,1]){ if(!sideOpen(w))continue; const u=(k+0.5)/6*CELL-CELL/2;
        for(const q of [0.62,0.9]){ const px=x0+pr[0]*w*q+ax[0]*u*0.5, pz=z0+pr[1]*w*q+ax[1]*u*0.5; push(px,deckY,pz,-Math.PI/2,dir===0?0:Math.PI/2,0.46,G(rope?'=':'#'),dc2[0],dc2[1],dc2[2],0.04,rope?1:8,i,0,1,0); } }
      if(junction&&rope)for(const e of [-1,1]){ if(endOpen(e))continue; const yawE=Math.atan2(ax[0]*e,ax[1]*e);
        for(let k=0;k<8;k++){ const f=(k+0.5)/8, v=f*CELL-CELL/2, px=x0+ax[0]*e*0.8+pr[0]*v, pz=z0+ax[1]*e*0.8+pr[1]*v; push(px,0.95-0.12*Math.sin(Math.PI*f),pz,0,yawE,0.24,G('~'),0.7,0.55,0.35,0.05,1,i,ax[0]*e,0,ax[1]*e); } }
      for(const sd of [-1,1]){
        if(sideOpen(sd))continue;
        const yawP=Math.atan2(pr[0]*sd,pr[1]*sd);
        if(rope){
          for(let k=0;k<=2;k++){ const u=k/2*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*sd*0.8, pz=z0+ax[1]*u+pr[1]*sd*0.8; for(let y=0.15;y<0.95;y+=0.25)pushX(px,y,pz,0.24,G('|'),wood,0.04,1,i); }
          for(let k=0;k<8;k++){ const f=(k+0.5)/8, u=f*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*sd*0.8, pz=z0+ax[1]*u+pr[1]*sd*0.8; push(px,0.95-0.12*Math.sin(Math.PI*f),pz,0,yawP,0.24,G('~'),0.7,0.55,0.35,0.05,1,i,pr[0]*sd,0,pr[1]*sd); }
        } else {
          for(let k=0;k<5;k++){ const u=(k+0.5)/5*CELL-CELL/2, px=x0+ax[0]*u+pr[0]*sd*0.85, pz=z0+ax[1]*u+pr[1]*sd*0.85; push(px,0.12,pz,0,yawP,0.3,G('='),stoneC[0],stoneC[1],stoneC[2],0.04,8,i,pr[0]*sd,0,pr[1]*sd); }
        }
      }
      if(!rope)deepWater();
    } else if(liquid[i]===LQ_DEEP){
      deepWater();
    } else if(liquid[i]===LQ_BOG){
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.6;
        push((cx+(a+0.5)/3)*CELL+R(-0.12,0.12),0.04,(cz+(bb+0.5)/3)*CELL+R(-0.12,0.12),-Math.PI/2,R(0,6.28),0.52,G(pick(['~','~',',','.','"'])),0.32*v,0.36*v,0.14*v,0.035,3,i,0,1,0); }
      if(rand()<0.3)for(let k=0;k<RI(2,3);k++){ const sz=R(0.4,0.65); push((cx+R(0.1,0.9))*CELL,sz*0.5,(cz+R(0.1,0.9))*CELL,0,R(0,6.28),sz,G(pick(['|','/','\\','Y'])),0.45,0.38,0.22,0.03,5,i,null,0,0); }
    } else if(liquid[i]===LQ_LAVA){
      for(let a=0;a<5;a++)for(let bb=0;bb<5;bb++){ const crust=rand()<0.1;
        push((cx+(a+0.5)/5)*CELL+R(-0.06,0.06),0.1,(cz+(bb+0.5)/5)*CELL+R(-0.06,0.06),-Math.PI/2,R(0,6.28),crust?0.44:0.56,G(crust?pick(['#','%','o']):'~'),1.0,0.32,0.06,1.0,10,i,0,1,0);
        if(crust)EM[(n-1)*4+3]=1; }
    } else if(surface[i]===SF_OBSIDIAN){
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const crack=rand()<0.28;
        push((cx+(a+0.5)/3)*CELL+R(-0.15,0.15),0.03,(cz+(bb+0.5)/3)*CELL+R(-0.15,0.15),-Math.PI/2,R(0,6.28),0.5,G(crack?pick(['~','-','=']):pick(['#','%','=',':'])),
          crack?1.0:0.3,crack?0.34:0.22,crack?0.08:0.26,crack?R(0.35,0.8):0.03,crack?7:9,i,0,1,0); }
    } else if(liquid[i]===LQ_WATER){
      const lake=th&&(th.k==='lake'||D.stratum.k==='cavern'), wc=lake?[0.22,0.72,1.0]:[0.28,0.62,1.0];
      const wn=D.stratum.flood?3:4, ws=D.stratum.flood?0.6:0.5;
      // the surface itself is drawn by the water plane
    } else if(surface[i]===SF_ICE){
      const tn=D.thin[i];
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=(tn?0.6:0.8)+rand()*0.4; push((cx+(a+0.5)/3)*CELL+R(-0.08,0.08),0.04,(cz+(bb+0.5)/3)*CELL+R(-0.08,0.08),-Math.PI/2,Math.floor(rand()*2)*Math.PI/2,0.56,G(tn?pick(['/','\\','-','=']):pick(['=','#','-','='])),0.62*v,0.85*v,1.0*v,(tn?0.08:0.12)+rand()*0.08,tn?1:11,i,0,1,0); }
    } else if(cave){
      // uneven rubble floor, shaded by the same density ramp
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.5;
        push((cx+(a+0.5)/3)*CELL+R(-0.18,0.18),0.02+rand()*0.05,(cz+(bb+0.5)/3)*CELL+R(-0.18,0.18),-Math.PI/2+R(-0.25,0.25),R(0,6.28),0.52,G('.'),tint[0]*0.6*v,tint[1]*0.6*v,tint[2]*0.6*v,0.03,9,i,0,1,0); }
      if(D.dfield[i]===1&&rand()<0.35){ const x0=(cx+R(0.2,0.8))*CELL, z0=(cz+R(0.2,0.8))*CELL; for(let k=0;k<RI(3,6);k++)pushX(x0+R(-0.3,0.3),0.12+k*0.12,z0+R(-0.3,0.3),0.34-k*0.03,G(pick(['o','0','O','.'])),[tint[0]*0.7,tint[1]*0.7,tint[2]*0.7],0.03,8,i); }
    } else if(surface[i]===SF_RUBBLE&&!liquid[i]){
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.5; push((cx+(a+0.5)/3)*CELL+R(-0.15,0.15),0.03,(cz+(bb+0.5)/3)*CELL+R(-0.15,0.15),-Math.PI/2,R(0,6.28),0.5,G(pick([':','.',',','%'])),tint[0]*0.55*v,tint[1]*0.5*v,tint[2]*0.5*v,0.03,9,i,0,1,0); }
      for(let k=0;k<RI(2,4);k++){ const x0=(cx+R(0.2,0.8))*CELL, z0=(cz+R(0.2,0.8))*CELL; for(let h2=0;h2<RI(1,3);h2++)pushX(x0+R(-0.15,0.15),0.14+h2*0.2,z0+R(-0.15,0.15),0.36-h2*0.06,G(pick(['#','%','o','='])),[tint[0]*0.75,tint[1]*0.7,tint[2]*0.72],0.03,8,i); }
    } else if(D.decoCell.get(i)&&D.decoCell.get(i).k==='carpet'){
    } else if(D.vaultCell[i]&&!cave){
      // mosaic floor: a fixed pattern marks vault ground as built, not natural
      const vs=VAULTS[D.vaultCell[i]-1];
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const gx=cx*3+a, gz=cz*3+bb, ch=(gx+gz)%2?'.':(gx%3===1&&gz%3===1?'*':'+');
        push((cx+(a+0.5)/3)*CELL,0.02,(cz+(bb+0.5)/3)*CELL,-Math.PI/2,0,0.5,G(ch),vs.wcol[0]*0.5,vs.wcol[1]*0.5,vs.wcol[2]*0.5,ch==='*'?0.14:0.05,1,i,0,1,0); }
    } else {
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){
        const r0=rand(), ch=r0<0.62?'.':r0<0.72?',':r0<0.8?'`':r0<0.87?'\'':r0<0.94?':':'-', v=0.7+rand()*0.5;
        push((cx+(a+0.5)/3)*CELL+R(-0.12,0.12),0.02,(cz+(bb+0.5)/3)*CELL+R(-0.12,0.12),-Math.PI/2,Math.floor(rand()*4)*Math.PI/2,0.5,G(ch),0.34*v,0.35*v,0.56*v,0.025+rand()*0.035,1,i,0,1,0);
      }
    }
    if(surface[i]===SF_DEAD){
      for(let j=0;j<RI(3,5);j++){ const sz=R(0.3,0.6);
        push((cx+R(0.1,0.9))*CELL,sz*0.5,(cz+R(0.1,0.9))*CELL,0,R(0,Math.PI*2),sz,G(pick(['|','/','\\',',','"','Y'])),0.55,0.44,0.26,0.03,5,i,null,0,0); }
    }
    if(surface[i]===SF_FOLIAGE||surface[i]===SF_FUNGFOR){
      const fung=surface[i]===SF_FUNGFOR, gc=fung?pick([[0.45,0.95,1.0],[0.7,0.55,1.0],[0.5,1.0,0.7]]):null;
      for(let k=0;k<4;k++){ const x0=(cx+0.15+rand()*0.7)*CELL, z0=(cz+0.15+rand()*0.7)*CELL, hgt=fung?R(1.5,2.4):R(1.3,2.0);
        for(let y=0.2;y<hgt;y+=0.42){ const top=y+0.42>=hgt; const ch=fung?(top?pick(['^','n','*']):'|'):(top?pick(['"','Y','*']):pick(['|','(',')','/','\\']));
          const c=fung?(top?gc:[0.55,0.6,0.62]):(top?[0.55,0.95,0.45]:[0.35,0.7,0.3]); pushX(x0,y,z0,top?0.32:0.28,G(ch),c,fung?(top?0.45:0.05):0.03,13,i); } }
    }
    if(D.glyph[i]){ for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const ch=(a+bb)%2?'o':(a===1&&bb===1?'*':'+'); push((cx+(a+0.5)/3)*CELL,0.05,(cz+(bb+0.5)/3)*CELL,-Math.PI/2,0,0.5,G(ch),1.0,0.9,0.6,0.32,7,i,0,1,0); } }
    if(surface[i]===SF_BRIM){ for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.8+rand()*0.4; push((cx+(a+0.5)/3)*CELL+R(-0.1,0.1),0.04,(cz+(bb+0.5)/3)*CELL+R(-0.1,0.1),-Math.PI/2,R(0,6.28),0.5,G(pick(['*','%',':','*'])),1.0*v,0.82*v,0.3*v,0.1,1,i,0,1,0); } }
    if(surface[i]===SF_MUD){ for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++){ const v=0.7+rand()*0.4; push((cx+(a+0.5)/3)*CELL+R(-0.1,0.1),0.03,(cz+(bb+0.5)/3)*CELL+R(-0.1,0.1),-Math.PI/2,0,0.55,G(pick(['~','=','.','~'])),0.5*v,0.36*v,0.2*v,0.02,1,i,0,1,0); } }
    if(surface[i]===SF_HAY){ for(let k=0;k<7;k++){ const x0=(cx+0.1+rand()*0.8)*CELL, z0=(cz+0.1+rand()*0.8)*CELL; pushX(x0,0.18,z0,0.3,G(pick(['"','/','\\',','])),[0.95,0.8,0.4],0.04,5,i); } }
    if(surface[i]===SF_GRASS||surface[i]===SF_LUMEN){
      const glow=surface[i]===SF_LUMEN, c=glow?((th&&(th.k==='emerald'||th.k==='fungal'||th.k==='lake'))?th.col:[0.4,0.95,0.85]):[0.35,0.85,0.5], k=RI(3,6);
      for(let j=0;j<k;j++){ const sz=R(0.28,0.55);
        push((cx+R(0.1,0.9))*CELL,sz*0.5,(cz+R(0.1,0.9))*CELL,0,R(0,Math.PI*2),sz,G(pick(['"','"',',','\'',';','v','Y'])),c[0],c[1],c[2],glow?R(0.2,0.5):R(0.03,0.08),5,i,null,0,0); }
    }
    if(cave&&th.k!=='cathedral'&&c0>4.5&&rand()<0.08){
      const x0=(cx+R(0.25,0.75))*CELL, z0=(cz+R(0.25,0.75))*CELL, len=R(1.0,Math.min(4.2,c0-2.4)), rock=[tint[0]*0.9,tint[1]*0.9,tint[2]*0.9];
      for(let y=c0+0.2;y>c0-len;y-=0.3){ const f=(c0-y)/len; pushX(x0,y,z0,0.44*(1-f*0.5),G('|'),rock,0.03,8,i); }
      pushX(x0,c0-len-0.1,z0,0.24,G('\''),th.col,0.7,7,i);
    }
    if(cave&&ti===TF&&!liquid[i]&&rand()<0.03){
      const x0=(cx+R(0.25,0.75))*CELL, z0=(cz+R(0.25,0.75))*CELL, len=R(0.6,2.2), rock=[tint[0]*0.85,tint[1]*0.85,tint[2]*0.85];
      for(let y=0.15;y<len;y+=0.28){ const f=y/len; pushX(x0,y,z0,0.44*(1-f*0.55),G('^'),rock,0.03,8,i); }
    }
  }
  // crystal formations: leaning prisms of glyphs that glow and refract
  for(let i=0;i<NCELL;i++){
    if(tile[i]!==TX)continue;
    const cx=i%MW, cz=(i/MW)|0, ri=roomOf[i], th=ri>=0?rooms[ri].theme:null;
    const col=D.xtalCol.get(i)||[0.6,0.85,1.0], top=Math.max(1.3,Math.min(ceil[i]-0.8,th&&th.k==='crystal'?6:3.2));
    for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++)push((cx+(a+0.5)/2)*CELL,0.03,(cz+(bb+0.5)/2)*CELL,-Math.PI/2,R(0,6.28),0.5,G(pick(['.',':','*'])),col[0]*0.5,col[1]*0.5,col[2]*0.5,0.15,11,i,0,1,0);
    for(let sN=RI(3,5),sh=0;sh<sN;sh++){
      const bx=(cx+R(0.15,0.85))*CELL, bz=(cz+R(0.15,0.85))*CELL, H=R(1.0,top), lx=R(-0.4,0.4), lz=R(-0.4,0.4);
      for(let y=0.12;y<H;y+=0.26){ const f=y/H, tip=y+0.26>=H; pushX(bx+lx*f,y,bz+lz*f,tip?0.3:0.38*(1-f*0.4),G(tip?'^':pick(['|','|','!',':','I'])),col,tip?R(0.9,1.4):R(0.25,0.55),11,i); }
      pushX(bx-0.14,0.15,bz,0.3,G('/'),col,0.3,11,i); pushX(bx+0.14,0.15,bz,0.3,G('\\'),col,0.3,11,i);
    }
  }
  // giant mushrooms in the fungal forest
  rooms.forEach(r=>{
    for(const i of (r.mush||[])){
      const gi=!!r.giant, S=gi?R(1.8,2.6):1;
      const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, H=gi?R(4.5,Math.max(5,Math.min(11,ceil[i]-1.5))):R(2.2,Math.max(2.4,Math.min(5,ceil[i]-1.2))), c=gi?pick([r.theme.col,[0.45,0.8,1.0],[0.9,0.6,1.0]]):pick([r.theme.col,[0.3,0.9,1.0],[0.7,1.0,0.35]]);
      const stems=gi?[[0,0],[0.22,0],[-0.11,0.19],[-0.11,-0.19]]:[[0,0]];
      for(const [sx,sz] of stems)for(let y=0.2;y<H;y+=0.3)pushX(x0+sx,y,z0+sz,gi?0.42:0.36,G(pick(['|','I','|','!'])),[0.62,0.78,0.72],0.05,0,i);
      const ring=(rad,y,n,set,em)=>{ for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+y, nx=Math.cos(a), nz=Math.sin(a); push(x0+nx*rad,y,z0+nz*rad,0,Math.atan2(nx,nz),0.42*(gi?1.3:1),G(pick(set)),c[0],c[1],c[2],R(em[0],em[1]),7,i,nx,0,nz); } };
      ring(0.95*S,H-0.05,Math.round(14*S),['^','n','~','*','n'],[0.45,0.8]);
      ring(0.6*S,H+0.25*S,Math.round(9*S),['^','n','*'],[0.5,0.9]);
      if(gi)ring(0.3*S,H+0.45*S,7,['^','*'],[0.6,1.0]);
      for(let k=0;k<Math.round(10*S*S);k++){ const a=k*2.399, rr=Math.sqrt((k+0.5)/(10*S*S))*0.9*S;
        push(x0+Math.cos(a)*rr,H-0.12,z0+Math.sin(a)*rr,Math.PI/2,R(0,6.28),0.32*(gi?1.2:1),G(pick(['.','\'','|',':'])),c[0],c[1],c[2],R(0.3,0.6),7,i,0,-1,0); }
    }
  });
  // ---- Brogue-style "machines": small set pieces that tell a story
  rooms.forEach(r=>{
    const md=r.mdata; if(!md)return;
    const cxy=i=>[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL];
    const stone=[0.62,0.6,0.78];
    if(md.type==='camp'){
      const [fx,fz]=cxy(md.fire);
      for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; pushX(fx+Math.cos(a)*0.45,0.12,fz+Math.sin(a)*0.45,0.26,G(pick(['o','0','o'])),stone,0.03,8,md.fire); }
      for(let k=0;k<6;k++)push(fx+R(-0.3,0.3),0.03,fz+R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.3,G(pick(['.',',','`'])),0.5,0.32,0.2,0.15,7,md.fire,0,1,0);
      for(const b of md.beds){ const [bx,bz]=cxy(b), yaw=rand()<0.5?0:Math.PI/2, ca=Math.cos(yaw), sa=Math.sin(yaw);
        for(let u=0;u<4;u++)for(let v=0;v<2;v++){ const lx=(u-1.5)*0.32, lz=(v-0.5)*0.32; push(bx+lx*ca+lz*sa,0.05,bz-lx*sa+lz*ca,-Math.PI/2,yaw,0.36,G(u===0?'0':pick(['=','~','='])),0.55,0.28,0.24,0.03,1,b,0,1,0); } }
      for(const b of md.bones){ const [bx,bz]=cxy(b); for(let k=0;k<5;k++)push(bx+R(-0.6,0.6),0.04,bz+R(-0.6,0.6),-Math.PI/2,R(0,6.28),0.34,G(pick(['%',',','\'','%','-'])),0.85,0.82,0.7,0.05,1,b,0,1,0);
        pushX(bx+R(-0.3,0.3),0.16,bz+R(-0.3,0.3),0.3,G('0'),[0.85,0.82,0.7],0.06,1,b); }
    } else if(md.type==='altar'){
      const [ax,az]=cxy(md.altar);
      for(let k=0;k<20;k++){ const a=k/20*Math.PI*2; push(ax+Math.cos(a)*1.5,0.03,az+Math.sin(a)*1.5,-Math.PI/2,-a,0.36,G(pick(RUNESET)),1.0,0.8,0.4,0.6,4,md.altar,0,1,0); }
      const W2=0.6, D2=0.38, H2=0.9;
      for(const [nx,nz,hw] of [[0,1,W2],[0,-1,W2],[1,0,D2],[-1,0,D2]]){
        const yaw=Math.atan2(nx,nz), tX=Math.cos(yaw), tZ=-Math.sin(yaw), px=ax+nx*(nz?D2:W2), pz=az+nz*(nz?D2:W2);
        const cols=Math.max(2,Math.round(hw*2/0.3));
        for(let row=0;row<3;row++)for(let col=0;col<cols;col++){ const u=(col+0.5)*(hw*2/cols)-hw; push(px+tX*u,0.15+row*0.3,pz+tZ*u,0,yaw,0.32,G(row===2?'=':'#'),stone[0],stone[1],stone[2],0.04,8,md.altar,nx,0,nz); }
      }
      for(let u=0;u<4;u++)for(let v=0;v<3;v++)push(ax+(u-1.5)*0.3,H2,az+(v-1)*0.24,-Math.PI/2,0,0.3,G('='),stone[0],stone[1],stone[2],0.05,8,md.altar,0,1,0);
    } else if(md.type==='library'){
      for(const sh of md.shelves){
        const [sx,sz]=cxy(sh.i), nx=-sh.dx, nz=-sh.dz, yaw=Math.atan2(nx,nz), tX=Math.cos(yaw), tZ=-Math.sin(yaw);
        const bx=sx+sh.dx*0.62, bz=sz+sh.dz*0.62;
        for(let row=0;row<8;row++)for(let col=0;col<6;col++){
          const u=(col+0.5)*(1.9/6)-0.95, y=0.18+row*0.34, shelf=row%3===0;
          let ch=shelf?'=':pick(['[',']','|','I','!','[',']']), c=shelf?[0.55,0.38,0.25]:pick([[0.75,0.3,0.25],[0.3,0.45,0.8],[0.35,0.65,0.4],[0.7,0.55,0.3],[0.55,0.35,0.65]]), em=0.035, kind=1;
          if(!shelf&&rand()<0.05){ ch='?'; c=[0.75,0.6,1.0]; em=0.7; kind=7; }
          push(bx+tX*u,y,bz+tZ*u,0,yaw,0.34,G(ch),c[0],c[1],c[2],em,kind,sh.i,nx,0,nz);
        }
      }
      for(const i of md.pages){ const [px,pz]=cxy(i); push(px+R(-0.7,0.7),0.03,pz+R(-0.7,0.7),-Math.PI/2,R(0,6.28),0.3,G(pick(['?','=','~'])),0.8,0.75,0.95,0.12,1,i,0,1,0); }
    } else if(md.type==='crypt'){
      for(const tb of md.tombs){
        const [tx,tz]=cxy(tb.i), yaw=tb.yaw, tX=Math.cos(yaw), tZ=-Math.sin(yaw), nx=Math.sin(yaw), nz=Math.cos(yaw);
        const rows=[['.','-','.'],['|','R','|'],['|','I','|'],['|','P','|']];
        rows.forEach((rw,ri2)=>rw.forEach((ch,ci)=>{ const u=(ci-1)*0.28, y=1.25-ri2*0.3; push(tx+tX*u,y,tz+tZ*u,0,yaw,0.34,G(ch),0.7,0.74,0.95,ci===1&&ri2>0?0.32:0.09,ci===1&&ri2>0?7:1,tb.i,nx,0,nz); }));
        for(let k=0;k<6;k++)push(tx+nx*R(0.3,0.8)+tX*R(-0.3,0.3),0.04,tz+nz*R(0.3,0.8)+tZ*R(-0.3,0.3),-Math.PI/2,R(0,6.28),0.3,G(pick(['~','.',',','o'])),0.45,0.48,0.62,0.04,1,tb.i,0,1,0);
      }
    } else if(md.type==='statues'){
      const form=buildForm({ch:'&',form:'humanoid'});
      for(const si of md.statues){
        const [sx,sz]=cxy(si), sc=1.35;
        for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(sx+nx*0.5,0.12,sz+nz*0.5,0,Math.atan2(nx,nz),0.3,G('='),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); push(sx+nx*0.45,0.36,sz+nz*0.45,0,Math.atan2(nx,nz),0.3,G('#'),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); }
        for(const pnt of form){ if(pnt.part==='core')continue; pushX(sx+pnt.x*sc,0.45+pnt.y*sc,sz+pnt.z*sc,pnt.s*sc*1.25,G(pick(['&','#','%','&'])),stone,0.07,8,si); }
        pushX(sx,0.45+1.52*sc,sz,0.5,G('&'),[0.7,0.68,0.9],0.05,8,si);
      }
    }
  });
  // roofs over houses in tall halls (the town): a ceiling inside, a roof outside
  for(let i=0;i<NCELL;i++){
    if(!D.vaultCell[i]||tile[i]===TW||ceil[i]<5)continue; const vs=VAULTS[D.vaultCell[i]-1]; if(!vs.roof)continue;
    const cx=i%MW, cz=(i/MW)|0;
    for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++){ const x=(cx+(a+0.5)/2)*CELL, z=(cz+(bb+0.5)/2)*CELL;
      push(x,VAULT_WALL_H-0.02,z,Math.PI/2,0,0.6,G(pick(['.',':','='])),0.5,0.45,0.42,0.03,8,i,0,-1,0);
      push(x,VAULT_WALL_H+0.04,z,-Math.PI/2,(a+bb)%2?0:Math.PI/2,0.62,G(pick(['=','#','='])),vs.wcol[0]*0.6,vs.wcol[1]*0.55,vs.wcol[2]*0.5,0.04,8,i,0,1,0); }
  }
  // fortress furniture: stone tables and anvils
  rooms.forEach(r=>{
    for(const i of (r.tables||[])){ const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, st=[0.72,0.6,0.48];
      for(const [lx,lz] of [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]])for(let y=0.15;y<0.8;y+=0.25)pushX(x0+lx,y,z0+lz,0.24,G('|'),st,0.03,8,i);
      for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++)push(x0+(a-1)*0.5,0.86,z0+(bb-1)*0.5,-Math.PI/2,0,0.52,G(a===1&&bb===1?'o':'='),st[0],st[1],st[2],0.04,8,i,0,1,0); }
    for(const i of (r.anvils||[])){ const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, ir=[0.55,0.55,0.62];
      pushX(x0,0.2,z0,0.4,G('#'),ir,0.03,8,i); pushX(x0,0.48,z0,0.34,G('I'),ir,0.03,8,i); pushX(x0,0.74,z0,0.5,G('T'),ir,0.05,8,i); }
  });
  // caps on low vault walls standing in tall halls, and vault carpets
  for(let i=0;i<NCELL;i++){
    if(tile[i]!==TW||!D.vaultCell[i])continue;
    let ref=-1, hi=0; for(const d of D4){ const j=i+d[0]+d[1]*MW; if(j>=0&&j<NCELL&&tile[j]!==TW){ if(ceil[j]>hi){hi=ceil[j];ref=j;} } }
    if(ref<0||hi<5)continue;
    const vs=VAULTS[D.vaultCell[i]-1], cx=i%MW, cz=(i/MW)|0;
    for(let a=0;a<3;a++)for(let bb=0;bb<3;bb++)push((cx+(a+0.5)/3)*CELL,VAULT_WALL_H+0.02,(cz+(bb+0.5)/3)*CELL,-Math.PI/2,0,0.6,G(vs.wall[(a+bb)%vs.wall.length]),vs.wcol[0]*0.7,vs.wcol[1]*0.7,vs.wcol[2]*0.7,0.06,8,ref,0,1,0);
  }
  rooms.forEach(r=>{
    const set=new Set(r.vcarpet||[]);
    for(const i of (r.vcarpet||[])){ const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL;
      for(let a=0;a<4;a++)for(let bb=0;bb<4;bb++){ const lx=(a+0.5)/4*CELL-CELL/2, lz=(bb+0.5)/4*CELL-CELL/2;
        const ex=(a===0&&!set.has(i-1))||(a===3&&!set.has(i+1)), ez=(bb===0&&!set.has(i-MW))||(bb===3&&!set.has(i+MW)), border=ex||ez;
        const ch=border?'=':((a+bb)%2?'+':'*'), c=border?[1.0,0.78,0.35]:((a+bb)%2?[0.85,0.22,0.3]:[0.55,0.3,0.85]);
        push(x0+lx,0.03,z0+lz,-Math.PI/2,border&&ez?0:Math.PI/2,0.48,G(ch),c[0],c[1],c[2],0.06,1,i,0,1,0); } }
  });
  // statues and altars drawn into vaults
  rooms.forEach(r=>{
    const stone=[0.62,0.6,0.78];
    for(const si of (r.vstat||[])){ const sx=(si%MW+0.5)*CELL, sz=(((si/MW)|0)+0.5)*CELL, sc=1.35;
      for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(sx+nx*0.5,0.12,sz+nz*0.5,0,Math.atan2(nx,nz),0.3,G('='),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); push(sx+nx*0.45,0.36,sz+nz*0.45,0,Math.atan2(nx,nz),0.3,G('#'),stone[0],stone[1],stone[2],0.04,8,si,nx,0,nz); }
      for(const pnt of buildForm({ch:'&',form:'humanoid'})){ if(pnt.part==='core')continue; pushX(sx+pnt.x*sc,0.45+pnt.y*sc,sz+pnt.z*sc,pnt.s*sc*1.25,G(pick(['&','#','%','&'])),stone,0.07,8,si); }
      pushX(sx,0.45+1.52*sc,sz,0.5,G('&'),[0.7,0.68,0.9],0.06,8,si); }
    for(const ai of (r.valtar||[])){ const ax=(ai%MW+0.5)*CELL, az=(((ai/MW)|0)+0.5)*CELL;
      for(let y=0.15;y<0.95;y+=0.28)for(let k=0;k<8;k++){ const a=k/8*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(ax+nx*0.5,y,az+nz*0.5,0,Math.atan2(nx,nz),0.32,G(y>0.7?'=':'#'),stone[0],stone[1],stone[2],0.05,8,ai,nx,0,nz); }
      for(let u=0;u<3;u++)for(let w=0;w<3;w++)push(ax+(u-1)*0.3,0.95,az+(w-1)*0.3,-Math.PI/2,0,0.3,G('='),stone[0],stone[1],stone[2],0.05,8,ai,0,1,0); }
  });
  // the beast's lair: bones and old remains scattered around
  rooms.forEach(r=>{ if(!r.lair)return; for(const i of r.cells.filter(()=>rand()<0.12)){ if(liquid[i])continue; const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL;
    for(let k=0;k<4;k++)push(x0+R(-0.7,0.7),0.04,z0+R(-0.7,0.7),-Math.PI/2,R(0,6.28),0.36,G(pick(['%',',','\'','-','%'])),0.85,0.8,0.68,0.05,1,i,0,1,0);
    if(rand()<0.4)pushX(x0+R(-0.4,0.4),0.18,z0+R(-0.4,0.4),0.34,G('0'),[0.85,0.8,0.68],0.05,1,i); } });
  // colossi in ruined plazas
  rooms.forEach(r=>{
    if(r.colossus===undefined)return;
    const c=r.colossus, sx=(c%MW+0.5)*CELL, sz=(((c/MW)|0)+0.5)*CELL, sc=Math.min(3.4,(ceil[c]-1.4)/2.1), stone=[0.66,0.64,0.8], col=r.theme.col;
    for(const [rad,y,ch] of [[1.5,0.15,'#'],[1.35,0.45,'='],[1.2,0.75,'#']])for(let k=0;k<22;k++){ const a=k/22*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a); push(sx+nx*rad,y,sz+nz*rad,0,Math.atan2(nx,nz),0.36,G(ch),stone[0],stone[1],stone[2],0.05,8,c,nx,0,nz); }
    for(const pnt of buildForm({ch:'&',form:'humanoid'})){ if(pnt.part==='core')continue; pushX(sx+pnt.x*sc,0.9+pnt.y*sc,sz+pnt.z*sc,pnt.s*sc*1.25,G(pick(['&','#','%','&','='])),stone,0.05,8,c); }
    for(const ex of [-0.07,0.07])push(sx+ex*sc,0.9+1.56*sc,sz+0.17*sc,0,0,0.22*sc,G('*'),col[0],col[1],col[2],1.1,7,c,0,0,1);
  });
  // remnant carpets, dismal rooms, idyll ferns, bloodwort stalks, steam vents
  rooms.forEach(r=>{
    const md=r.mdata; if(!md)return;
    const cxy=i=>[(i%MW+0.5)*CELL,(((i/MW)|0)+0.5)*CELL];
    if(md.type==='remnant'){
      const set=new Set(md.carpet);
      for(const i of md.carpet){ const [x0,z0]=cxy(i);
        for(let a=0;a<4;a++)for(let bb=0;bb<4;bb++){ const lx=(a+0.5)/4*CELL-CELL/2, lz=(bb+0.5)/4*CELL-CELL/2;
          const edgeX=(a===0&&!set.has(i-1))||(a===3&&!set.has(i+1)), edgeZ=(bb===0&&!set.has(i-MW))||(bb===3&&!set.has(i+MW));
          const border=edgeX||edgeZ, ch=border?'=':((a+bb)%2?'+':'*'), c=border?[1.0,0.78,0.35]:((a+bb)%2?[0.85,0.22,0.3]:[0.55,0.3,0.85]);
          push(x0+lx,0.03,z0+lz,-Math.PI/2,border&&edgeZ?0:Math.PI/2,0.48,G(ch),c[0],c[1],c[2],0.06,1,i,0,1,0); } }
      const form=buildForm({ch:'&',form:'humanoid'}), stone=[0.62,0.6,0.78];
      for(const si of md.inert){ const [sx,sz]=cxy(si); for(const pnt of form){ if(pnt.part==='core')continue; pushX(sx+pnt.x*1.3,0.3+pnt.y*1.3,sz+pnt.z*1.3,pnt.s*1.6,G(pick(['&','#','%'])),stone,0.06,8,si); } }
    } else if(md.type==='dismal'){
      for(const i of md.blood){ const [x0,z0]=cxy(i); for(let k=0;k<7;k++)push(x0+R(-0.6,0.6),0.035,z0+R(-0.6,0.6),-Math.PI/2,R(0,6.28),R(0.35,0.6),G(pick(['~',',','.','~'])),0.55,0.05,0.07,0.04,1,i,0,1,0); }
      for(const i of md.bones2){ const [x0,z0]=cxy(i); for(let k=0;k<5;k++)push(x0+R(-0.6,0.6),0.04,z0+R(-0.6,0.6),-Math.PI/2,R(0,6.28),0.34,G(pick(['%',',','\'','-'])),0.85,0.82,0.7,0.05,1,i,0,1,0); pushX(x0+R(-0.3,0.3),0.16,z0+R(-0.3,0.3),0.3,G('0'),[0.85,0.82,0.7],0.06,1,i); }
      for(const i of md.char){ const [x0,z0]=cxy(i); for(let k=0;k<3;k++)pushX(x0+R(-0.5,0.5),0.14+k*0.1,z0+R(-0.5,0.5),0.3,G(pick(['o','0','.'])),[0.3,0.28,0.3],0.02,8,i); }
    } else if(md.type==='bloodwort'){
      const [x0,z0]=cxy(md.plant);
      for(let y=0.15;y<1.4;y+=0.25)pushX(x0+Math.sin(y*3)*0.06,y,z0,0.3,G('|'),[0.35,0.6,0.3],0.05,1,md.plant);
      for(let k=0;k<6;k++){ const a=k/6*Math.PI*2, h=0.4+k*0.14; pushX(x0+Math.cos(a)*0.25,h,z0+Math.sin(a)*0.25,0.28,G(pick(['"','v','~'])),[0.3,0.65,0.3],0.06,5,md.plant); }
    }
  });
  // collapsing floors: cracks now, a hidden shaft (kind 12) revealed when the floor gives way
  rooms.forEach(r=>{
    const md=r.mdata; if(!md||md.type!=='collapse')return;
    const pit=new Set(md.pit);
    for(const i of md.pit){
      const cx=i%MW, cz=(i/MW)|0;
      for(let k=0;k<4;k++)push((cx+R(0.15,0.85))*CELL,0.03,(cz+R(0.15,0.85))*CELL,-Math.PI/2,R(0,6.28),0.42,G(pick(['/','\\','x','-'])),1.0,0.55,0.25,R(0.12,0.3),1,i,0,1,0);
      for(const f of [[1,0,-Math.PI/2],[-1,0,Math.PI/2],[0,1,Math.PI],[0,-1,0]]){
        const j=(cz+f[1])*MW+cx+f[0]; if(pit.has(j))continue;
        const yaw=f[2], nX=-f[0], nZ=-f[1], tX=Math.cos(yaw), tZ=-Math.sin(yaw), pcx=(cx+0.5+f[0]*0.5)*CELL, pcz=(cz+0.5+f[1]*0.5)*CELL;
        for(let y=-0.2;y>-6.2;y-=0.42)for(let col=0;col<5;col++){ const u=(col+0.5)*0.4-CELL/2, k2=clamp(1+y/7,0.2,1);
          push(pcx+tX*u,y,pcz+tZ*u,0,yaw,0.44,G(pick(['#','%','&','8',':'])),0.55*k2,0.5*k2,0.62*k2,0.03,12,i,nX,0,nZ); }
      }
      for(let a=0;a<2;a++)for(let bb=0;bb<2;bb++)push((cx+(a+0.5)/2)*CELL,-6.2,(cz+(bb+0.5)/2)*CELL,-Math.PI/2,R(0,6.28),0.7,G(pick(['*','.','~'])),1.0,0.55,0.25,0.9,12,i,0,1,0);
    }
  });
  // pillars (ordinary rooms)
  for(let i=0;i<NCELL;i++){
    if(tile[i]!==TP)continue;
    const x0=(i%MW+0.5)*CELL, z0=(((i/MW)|0)+0.5)*CELL, SEG=12, rr=0.38, ph=(D.vaultCell[i]&&ceil[i]>=5)?4.4:ceil[i];
    for(let k=0;k<SEG;k++){
      const a0=k/SEG*Math.PI*2, a1=(k+1)/SEG*Math.PI*2;
      const ax=x0+Math.cos(a0)*rr, az=z0+Math.sin(a0)*rr, bx=x0+Math.cos(a1)*rr, bz=z0+Math.sin(a1)*rr;
      occ.push(ax,0,az,bx,0,bz,bx,ph,bz, ax,0,az,bx,ph,bz,ax,ph,az);
    }
    const ys2=[]; for(let y=0.22;y<Math.min(ph,BASE_H);y+=0.31)ys2.push([y,11]); for(let y=BASE_H+0.1;y<ph-0.2;y+=0.5)ys2.push([y,8]);
    for(let row=0;row<ys2.length;row++){ const [y,nk]=ys2[row];
      for(let k=0;k<nk;k++){ const a=k/nk*Math.PI*2+row*0.29, nx=Math.cos(a), nz=Math.sin(a), v=0.75+rand()*0.4;
        push(x0+nx*0.48,y,z0+nz*0.48,0,Math.atan2(nx,nz),0.36,G(pick(['|','|','I','!','l','1',':','|'])),0.66*v,0.64*v,0.92*v,0.035+rand()*0.03,6,i,nx,0,nz); } }
    for(const yy of [0.1,ph-0.12])for(let k=0;k<14;k++){ const a=k/14*Math.PI*2, nx=Math.cos(a), nz=Math.sin(a);
      push(x0+nx*0.62,yy,z0+nz*0.62,0,Math.atan2(nx,nz),0.34,G('='),0.7,0.66,0.95,0.06,6,i,nx,0,nz); }
  }
  // ---- split into spatial chunks so whole regions can be culled each frame
  const count=new Int32Array(CXN*CZN); for(let k=0;k<n;k++)count[CK[k]]++;
  const order=new Int32Array(n), start=new Int32Array(CXN*CZN+1);
  for(let c=0;c<CXN*CZN;c++)start[c+1]=start[c]+count[c];
  const fill=start.slice(0,CXN*CZN); for(let k=0;k<n;k++)order[fill[CK[k]]++]=k;
  for(let c=0;c<CXN*CZN;c++){
    const cnt=count[c]; if(!cnt)continue;
    const gl=new Float32Array(cnt), co=new Float32Array(cnt*3), em=new Float32Array(cnt*4), li=new Float32Array(cnt*3), lw=new Float32Array(cnt*3), mm=new Float32Array(cnt*16);
    let ymin=1e9,ymax=-1e9;
    for(let a=0;a<cnt;a++){ const k=order[start[c]+a];
      gl[a]=GL[k]; co.set(CO.subarray(k*3,k*3+3),a*3); em.set(EM.subarray(k*4,k*4+4),a*4); li.set(LI.subarray(k*3,k*3+3),a*3); lw.set(LW.subarray(k*3,k*3+3),a*3); mm.set(M.subarray(k*16,k*16+16),a*16);
      if(PY[k]<ymin)ymin=PY[k]; if(PY[k]>ymax)ymax=PY[k]; }
    const geo=new T.PlaneGeometry(1,1);
    geo.setAttribute('iGlyph',new T.InstancedBufferAttribute(gl,1));
    geo.setAttribute('iColor',new T.InstancedBufferAttribute(co,3));
    geo.setAttribute('iEmit',new T.InstancedBufferAttribute(em,4));
    geo.setAttribute('iLI',new T.InstancedBufferAttribute(li,3));
    geo.setAttribute('iLW',new T.InstancedBufferAttribute(lw,3));
    const mesh=new T.InstancedMesh(geo,staticMat,cnt);
    mesh.instanceMatrix.array.set(mm); mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false; scene.add(mesh);
    const cxw=((c%CXN)+0.5)*CHUNK*CELL, czw=(((c/CXN)|0)+0.5)*CHUNK*CELL, cyw=(ymin+ymax)/2;
    const rad=Math.hypot(CHUNK*CELL*0.5+0.6,CHUNK*CELL*0.5+0.6,(ymax-ymin)/2+0.6);
    chunks.push({mesh,sphere:new T.Sphere(new T.Vector3(cxw,cyw,czw),rad)});
  }
  const og=new T.BufferGeometry(); og.setAttribute('position',new T.Float32BufferAttribute(occ,3));
  occMesh=new T.Mesh(og,occMat); occMesh.renderOrder=-10; occMesh.frustumCulled=false; scene.add(occMesh);
  glyphCount=n;
}
const _frus=new T.Frustum(), _pm=new T.Matrix4();
let chunksDrawn=0;
function cullChunks(){
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pm);
  const maxD=2.4/U.uFogDen.value; chunksDrawn=0;
  for(const c of chunks){ const d=c.sphere.center.distanceTo(camera.position)-c.sphere.radius; c.mesh.visible=d<maxD&&_frus.intersectsSphere(c.sphere); if(c.mesh.visible)chunksDrawn+=c.mesh.count; }
}

