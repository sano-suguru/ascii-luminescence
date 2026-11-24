function makeMonster(s){
  const ty=MTYPES[s.key];
  if(ty&&ty.golem&&!s.route&&here.D&&here.D.roomOf){ const r=here.D.roomOf[s.cz*MW+s.cx]>=0?here.D.rooms[here.D.roomOf[s.cz*MW+s.cx]]:null; if(r&&r.cells.length>12){ const pts=[]; for(let k=0;k<4;k++){ const c=r.cells[Math.floor(Math.random()*r.cells.length)]; if(here.D.tile[c]===TF&&!here.D.liquid[c]&&!here.D.solid.has(c))pts.push(c); } s.route=pts; } }
  const m={home:s.home,route:s.route,ri:0,camp:s.camp,ty,key:s.key,x:(s.cx+0.5)*CELL,z:(s.cz+0.5)*CELL,cx:s.cx,cz:s.cz,tx:s.cx,tz:s.cz,dir:[0,0],yaw:mr()*6.28,dirYaw:mr()*6.28,
    wait:mr()*2,alert:0,seen:false,visible:false,walk:mr()*10,moving:0,ph:mr()*100,form:buildForm(ty),acc:0,glow:1,y:0,
    g:s.g,isLead:s.lead,leader:null,dead:false,aware:0,noticed:false,sleep:false,mark:0,surf:0,surfT:2+mr()*6,vx:0,vz:0,vy:0,fy:1.8,flitT:0};
  if(ty.form==='eel')m.y=-0.6;
  if(ty.critter==='mimic'){ m.hidden=true; }
  initMonsterLife(m); if(s.elite){ m.maxHp=Math.round(m.maxHp*2.5); m.hp=m.maxHp; m.elite=true; }
  if(ty.conj){ m.blades=[0,1,2].map(k=>({a:k*2.094,x:m.x,y:1.5,z:m.z})); m.bladeMsg=false; }
  return m;
}
const fireAt=i=>i>=0&&i<NCELL&&fire[i]>0.1;
function fireNear(cx,cz,r){ let best=-1,bd=1e9; for(const i of burning){ if(fire[i]<=0.1)continue; const dx=i%MW-cx, dz=((i/MW)|0)-cz, d=Math.max(Math.abs(dx),Math.abs(dz)); if(d<=r&&d<bd){bd=d;best=i;} } return best; }
let fleeMsgT=-10;
const canStep=(m,i)=>(m.ty.habitat==='lava'||!fireAt(i))&&!(here.D.glyph&&here.D.glyph[i]&&!m.ty.critter)&&!(here.D.gate&&here.D.gate.o<0.7&&i===here.D.gate.cell)&&(m.home===undefined||here.D.roomOf[i]===m.home)&&(m.ty.habitat==='bog'?(here.D.tile[i]===TF&&here.D.liquid[i]===LQ_BOG):m.ty.habitat==='deep'?(here.D.tile[i]===TF&&here.D.liquid[i]===LQ_DEEP):m.ty.habitat==='amph'?(here.D.tile[i]===TF&&!here.D.solid.has(i)&&here.D.liquid[i]!==LQ_LAVA&&here.D.liquid[i]!==LQ_BOG):m.ty.habitat==='lava'?(here.D.tile[i]===TF&&!here.D.solid.has(i)&&here.D.liquid[i]!==LQ_DEEP&&here.D.liquid[i]!==LQ_WATER):m.ty.aquatic?(here.D.tile[i]===TF&&(here.D.liquid[i]===LQ_WATER||here.D.liquid[i]===LQ_DEEP)):m.ty.form==='eel'?(here.D.tile[i]===TF&&here.D.liquid[i]===LQ_DEEP):(here.D.tile[i]===TF&&!blocksWalk(here.D.liquid[i])&&!here.D.solid.has(i)));
function chooseNext(m){
  if(m.ty.form!=='eel'&&!m.leader&&m.ty.form!=='bloat'&&mr()<0.1)m.wait=1+mr()*3;
  const opts=[]; for(const d of D4){ const i=(m.cz+d[1])*MW+m.cx+d[0]; if(canStep(m,i))opts.push(d); }
  if(!opts.length)return;
  const fn=fireNear(m.cx,m.cz,2);
  if(fn>=0){
    let best=opts[0],bd=-1; for(const d of opts){ const dd=Math.hypot(m.cx+d[0]-fn%MW,m.cz+d[1]-((fn/MW)|0))+mr()*0.3; if(dd>bd){bd=dd;best=d;} }
    m.dir=best; m.tx=m.cx+best[0]; m.tz=m.cz+best[1]; m.flee=1.6;
    if(m.visible&&clock.time-fleeMsgT>6){ fleeMsgT=clock.time; msg(`<b style="color:${css(m.ty.col)}">${m.ty.ch}</b>${mname(m)}が炎から逃げ出した。`); }
    return;
  }
  let goal=null;
  if(m.noticed&&hostile(m)&&!(m.flee>0))goal=[player.x,player.z];
  if(!goal&&m.goal&&clock.time<m.goalT)goal=m.goal;
  if(!goal&&m.route&&m.route.length&&!m.noticed){ const rc=m.route[m.ri%m.route.length]; if(rc===m.cz*MW+m.cx)m.ri++; goal=cpos(m.route[m.ri%m.route.length]); }
  if(!goal&&m.camp>=0&&m.camp!==undefined&&!m.noticed){ const [cx2,cz2]=cpos(m.camp); if(Math.hypot(cx2-m.x,cz2-m.z)>3.2)goal=[cx2,cz2]; else if(mr()<0.85){ m.wait=2+mr()*4; return; } }
  if(!goal&&m.ty.hound&&m.isLead&&!m.noticed){
    if(m.ty.hound==='light'&&!stealth.sneak&&Math.hypot(player.x-m.x,player.z-m.z)<22)goal=[player.x,player.z];
    else { const sd=houndScent(m); if(sd){ m.dir=sd; m.tx=m.cx+sd[0]; m.tz=m.cz+sd[1]; if(!m.tracked){ m.tracked=true; if(clock.time-(houndScent.msgT||-99)>20){ houndScent.msgT=clock.time; msg(`<b style="color:${css(m.ty.col)}">Z</b>どこかで${mname(m)}の群れが、あなたの匂いを嗅ぎつけた。`); sHowl(m.x,m.z); } } return; } }
  }
  if(!goal&&m.leader&&!m.leader.dead){ const L=m.leader; if(Math.hypot(L.x-m.x,L.z-m.z)>3.2)goal=[L.x,L.z]; else if(mr()<0.5){ m.wait=0.3+mr()*0.8; return; } }
  if(m.ty.form==='bloat'&&m.noticed)goal=[player.x,player.z];
  if(goal){
    let best=opts[0],bd=1e9;
    for(const d of opts){ const x=(m.cx+d[0]+0.5)*CELL, z=(m.cz+d[1]+0.5)*CELL, dd=Math.hypot(x-goal[0],z-goal[1])+mr()*0.6; if(dd<bd){bd=dd;best=d;} }
    m.dir=best; m.tx=m.cx+best[0]; m.tz=m.cz+best[1]; return;
  }
  const fwd=opts.find(o=>o[0]===m.dir[0]&&o[1]===m.dir[1]);
  const nrev=opts.filter(o=>!(o[0]===-m.dir[0]&&o[1]===-m.dir[1]));
  const ch=(fwd&&mr()<0.6)?fwd:(nrev.length?nrev[Math.floor(mr()*nrev.length)]:opts[0]);
  m.dir=ch; m.tx=m.cx+ch[0]; m.tz=m.cz+ch[1];
}
