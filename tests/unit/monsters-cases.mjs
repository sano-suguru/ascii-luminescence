// テストの道具：生き物を作る・歩いて行けるか・次に向かうマス（src/lib/monsters.ts）と、小さな生き物と地面（src/lib/ground.ts）・叫び声の音（audio.ts の sShriek）を、
// たくさんの場合で呼び、結果を1つの文字列にまとめる。F は関数をまとめた物。monsters.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、表の全部の種類の生き物を、いろいろな湧き方（群れの頭・部屋の中だけ・見回りの道・野営・強い個体）で作り、
// 火・灰・匂い・焼け落ちた扉・光る苔・茂み・硫黄・薄い氷・水を足して、何歩か続けて、生き物の動きと地面の処理を呼ぶ。
// 返す値と、生き物の状態・マスの配列・マスの絵の中身・粒子の配列の中身・見た目の乱数と音の乱数を引いた数・伝言・偽の Web Audio の記録を記録する。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { P } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { SND, adv, blaze, buf, cellData, clock, gfx, here, iceT, msgs, player, stealth, ui, vfx } from '../../src/lib/state.ts';
import {
  CELL,
  D4,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MW,
  NCELL,
  SF_BRIM,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_LUMEN,
  TF,
  cpos,
} from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

/** 移した関数の名前（場合が全部を呼ぶか、monsters.test.mjs が確かめる） */
export const NAMES = [
  'makeMonster',
  'initMonsterLife',
  'fireAt',
  'fireNear',
  'canStep',
  'chooseNext',
  'critterStep',
  'houndScent',
  'hostile',
  'foe',
  'summon',
  'uploadCells',
  'updateCritter',
  'sShriek',
  'machineWork',
  'splash',
  'crackIce',
  'tallAt',
  'trample',
  'brimFlare',
  'ignite',
  'chillArea',
  'updateFrozen',
];
const LIQUIDS = [0, 0, LQ_WATER, LQ_DEEP, LQ_BOG, LQ_LAVA];
/**
 * 配列の中身の指紋（Float32Array・Uint8Array のバイト列）。NaN は1つの並びにそろえる
 * （NaN のビットの並びは、同じ計算でも、V8 が最適化する前と後で変わりうる。NaN どうしの違いは動きに関係しない）
 */
const hashArr = (a, from = 0, to = a.length) => {
  if (a instanceof Float32Array) a = a.slice(from, Math.max(from, to)).map((x) => (Number.isNaN(x) ? NaN : x));
  else a = a.subarray(from, Math.max(from, to));
  const b = new Uint8Array(a.buffer, a.byteOffset, a.length * a.BYTES_PER_ELEMENT);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ (b[i] ?? 0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};
/** 値を1つの文字列にする（NaN・Infinity・undefined も見分ける。生き物の種類は名前、形は点の指紋、群れの頭は並びの番号、配列の型は指紋） */
const text = (v) =>
  JSON.stringify(v, (k, x) =>
    x === undefined
      ? 'undefined'
      : typeof x === 'number' && !Number.isFinite(x)
        ? String(x)
        : typeof x === 'function'
          ? 'fn'
          : x instanceof Set
            ? { set: [...x] }
            : x instanceof Map
              ? { map: [...x] }
              : ArrayBuffer.isView(x)
                ? hashArr(x)
                : k === 'ty' && x && typeof x === 'object'
                  ? (x.name ?? 'ty')
                  : k === 'leader' && x && typeof x === 'object'
                    ? `#${here.monsters.indexOf(x)}`
                    : k === 'form' && Array.isArray(x)
                      ? fnv(JSON.stringify(x))
                      : x,
  );
/** 写しから元に戻す（写しに無い欄は消す） */
const restore = (obj, copy) => {
  for (const k of Object.keys(obj)) if (!(k in copy)) delete obj[k];
  Object.assign(obj, copy);
};

/** seeds：場合の数。返り値は、場合ごとの記録（呼んだ関数ごとの記録 calls と、歩みごとの状態 steps） */
export async function monsterCases(F, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { runSeed: adv.runSeed, HIST: adv.HIST },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    blaze: { ...blaze },
    stealth: { ...stealth },
    SND: { ...SND },
    buf: { ...buf },
    cellTex: gfx.cellTex,
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
    ice: [...iceT],
  };
  // ゲームと同じく、形を作る前に表へ見た目を書き足す。書き足す欄は、終わったら元に戻す（addLooks は2回呼ぶと灯りの色が変わる）
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  const els = { log: { innerHTML: '' } },
    alog = [];
  // 伝言を出した数（伝言の一覧は新しい3つまでなので、長さでは数えられない）
  let msgN = 0;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const restoreGlobals = swapGlobals({
    document: { getElementById: (id) => els[id] ?? null },
    window: { AudioContext: fakeAudioClass(alog, 'running') },
  });
  try {
    Math.random = mulberry32(1);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    gfx.cellTex = { needsUpdate: false };
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 69069 + 23),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 29);
      Math.random = () => (mrN++, mrSrc());
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 31);
      setSoundRand(() => (sndN++, sndSrc()));
      const place = pick(PLACES);
      adv.runSeed = (r() * 4294967296) >>> 0;
      Object.assign(here, { depth: place.depth, branch: place.branch ?? null, realm: place.realm ?? null, inter: place.inter ?? null });
      const res = gen(env, (r() * 4294967296) >>> 0, place, adv.runSeed);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      const D = res.level;
      here.D = D;
      here.fixtures = D.fixtures;
      adv.HIST = makeHistory(adv.runSeed);
      // 一度だけの伝言の旗と時刻（場合ごとに、初めの値か、もう出した物に）
      Object.assign(ui, {
        fleeMsgT: chance(0.7) ? -10 : 0,
        shriekMsgT: chance(0.7) ? -99 : 0,
        grazeMsg: chance(0.2),
        started: true,
      });
      Object.assign(here, { brimMsg: chance(0.2), repairMsg: chance(0.2) });
      D.crackMsg = chance(0.2);
      if (chance(0.7)) delete F.houndScent.msgT;
      else F.houndScent.msgT = 0;
      iceT.clear();
      msgs.length = 0;
      alog.length = 0;
      vfx.shake = 0;
      buf.pN = 0;
      stealth.sneak = chance(0.3);
      SND.on = true;
      clock.time = chance(0.3) ? r() * 30 : 40 + r() * 200;
      // 火と地面のマス
      Object.assign(blaze, {
        fire: new Float32Array(NCELL),
        fuel: new Float32Array(NCELL),
        burnt: new Uint8Array(NCELL),
        cellFlag: new Uint8Array(NCELL),
        fireLight: new Float32Array(NCELL),
        scent: new Float32Array(NCELL),
        burning: [],
        frozen: new Map(),
        trampled: [],
        gasAny: false,
      });
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) floors.push(i);
      const c0 = pick(floors),
        [px, pz] = cpos(c0);
      Object.assign(player, { x: px + (r() - 0.5) * CELL, z: pz + (r() - 0.5) * CELL });
      const near = (rr) => {
        const cx = Math.floor((player.x + (r() - 0.5) * rr) / CELL),
          cz = Math.floor((player.z + (r() - 0.5) * rr) / CELL);
        return Math.max(0, Math.min(NCELL - 1, cz * MW + cx));
      };
      const nearFloor = (rr) => {
        for (let k = 0; k < 20; k++) {
          const i = near(rr);
          if (D.tile[i] === TF) return i;
        }
        return c0;
      };
      for (let i = 0; i < NCELL; i++) {
        const sf = D.surface[i];
        blaze.fuel[i] = sf === SF_GRASS ? 0.7 : sf === SF_LUMEN ? 0.6 : sf === SF_FOLIAGE ? 1.0 : sf === SF_BRIM ? 0.8 : 0;
      }
      for (const d of D.doors) blaze.fuel[d.i] = Math.max(blaze.fuel[d.i], 1.4);
      // 近くの床：火・灰・匂い・光る苔・茂み・硫黄・薄い氷・液体
      for (let k = 0; k < 40; k++) {
        const i = nearFloor(chance(0.5) ? 10 : 30),
          w = Math.floor(r() * 12);
        if (w === 0) {
          blaze.fire[i] = r();
          blaze.burning.push(i);
          if (chance(0.3)) blaze.burning.push(i);
        }
        if (w === 1) blaze.burnt[i] = 1;
        if (w === 2) D.surface[i] = SF_LUMEN;
        if (w === 3) D.surface[i] = pick([SF_FOLIAGE, SF_FUNGFOR]);
        if (w === 4) {
          D.surface[i] = SF_BRIM;
          blaze.fuel[i] = chance(0.8) ? 0.8 : 0;
        }
        if (w === 5) D.liquid[i] = pick(LIQUIDS);
        if (w === 6) D.thin[i] = 1;
        if (w === 7) blaze.cellFlag[i] = pick([0, 20, 30]);
        if (w === 8) blaze.fireLight[i] = r() * 3;
        if (w === 9) D.glyph[i] = 1;
        blaze.scent[i] = chance(0.4) ? clock.time - r() * 60 : 0;
      }
      // 焼け落ちた扉（修復機の仕事）と鉄格子
      for (const d of D.doors) if (chance(0.3)) d.gone = true;
      if (D.gate && chance(0.5)) D.gate.o = r();
      // 生き物：階に湧く物の一部と、表の全部の種類（いろいろな湧き方で）
      here.monsters = [];
      const keys = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy);
      const calls = [],
        steps = [];
      const call = (name, ...args) => {
        const m0 = mrN,
          s0 = sndN,
          g0 = msgN;
        let ret, threw;
        try {
          ret = F[name](...args);
        } catch {
          threw = true;
        }
        calls.push({
          name,
          ret: ret && typeof ret === 'object' && 'ty' in ret ? `mon:${here.monsters.indexOf(ret)}` : ret,
          threw,
          mr: mrN - m0,
          snd: sndN - s0,
          msg: msgN - g0,
        });
        return ret;
      };
      for (const sp of D.spawns.slice(0, 12)) if (MTYPES[sp.key]) here.monsters.push(call('makeMonster', { ...sp }));
      const nKinds = 10 + Math.floor(r() * 20);
      for (let k = 0; k < nKinds; k++) {
        const key = pick(keys),
          ty = MTYPES[key],
          i = nearFloor(chance(0.6) ? 8 : 24);
        const sp = { key, cx: i % MW, cz: (i / MW) | 0, g: chance(0.5) ? Math.floor(r() * 3) : -1, lead: chance(0.6) };
        if (chance(0.25) && D.roomOf[i] >= 0) sp.home = D.roomOf[i];
        if (chance(0.15)) sp.camp = nearFloor(10);
        if (chance(0.15) || (ty.golem && chance(0.3))) sp.route = [nearFloor(12), nearFloor(12), nearFloor(12)];
        if (chance(0.1)) sp.elite = true;
        here.monsters.push(call('makeMonster', sp));
      }
      // 状態をいろいろに：気づいた・眠った・逃げている・呼ばれた所・群れの頭・匂いを追った・仕事・跳ねている・正体を現す
      const mons = here.monsters.filter(Boolean);
      for (const m of mons) {
        if (chance(0.3)) m.noticed = true;
        if (chance(0.2)) m.sleep = true;
        if (chance(0.2)) m.flee = r() * 2;
        if (chance(0.15)) {
          m.goal = [player.x + (r() - 0.5) * 10, player.z + (r() - 0.5) * 10];
          m.goalT = clock.time + (r() - 0.3) * 10;
        }
        if (chance(0.3)) m.leader = pick(mons);
        if (chance(0.1) && m.leader) m.leader.dead = true;
        if (chance(0.2)) m.tracked = true;
        if (chance(0.3)) m.dir = pick(D4);
        if (chance(0.5)) m.wait = chance(0.5) ? 0 : r();
        if (chance(0.15)) m.visible = true;
        else m.visible = chance(0.5);
        if (m.ty.critter === 'cleaner' || m.ty.critter === 'engineer') {
          if (chance(0.4)) m.job = m.ty.critter === 'engineer' ? (D.doors.length ? Math.floor(r() * D.doors.length) : -1) : nearFloor(6);
          // 修復機の仕事の扉は、たいてい焼け落ちている
          if (m.ty.critter === 'engineer' && m.job >= 0 && chance(0.7)) D.doors[m.job].gone = true;
          if (chance(0.3)) m.scanT = clock.time - r() * 3;
          if (chance(0.3) && m.job >= 0) {
            const [jx, jz] = m.ty.critter === 'engineer' ? [D.doors[m.job].bx, D.doors[m.job].bz] : cpos(m.job);
            Object.assign(m, { x: jx + (r() - 0.5) * 0.5, z: jz + (r() - 0.5) * 0.5, work: chance(0.5) ? r() * 4 : undefined });
          }
        }
        if (m.ty.critter === 'fish' && chance(0.4)) Object.assign(m, { jumpT: r() * 2 - 0.5, jump: chance(0.4) ? r() : 0 });
        if (m.ty.critter === 'mimic' && chance(0.3)) m.revealNow = true;
        if (m.ty.critter === 'shrieker' && chance(0.3)) m.shriekT = clock.time - r() * 20;
        // プレイヤーのそば（驚く・叫ぶ・正体を現す距離）
        if (chance(0.3)) Object.assign(m, { x: player.x + (r() - 0.5) * 6, z: player.z + (r() - 0.5) * 6 });
        if (chance(0.5)) Object.assign(m, { tx: m.cx, tz: m.cz });
        // 見回りの道の、次に向かうマスにいる
        if (m.route && m.route.length && chance(0.4)) {
          const rc = m.route[m.ri % m.route.length];
          Object.assign(m, { cx: rc % MW, cz: (rc / MW) | 0, tx: rc % MW, tz: (rc / MW) | 0, x: cpos(rc)[0], z: cpos(rc)[1] });
        }
        if (chance(0.1)) m.st = { chill: r() };
      }
      // 場面：叫ぶ物がプレイヤーのすぐそばにいる（まわりの獣がみな起きて気づいていれば、目を覚ます獣はいない）、
      // 修復機が焼け落ちた扉を作り直し終えるところ、掃除機が灰を消し終えるところ
      const crit = (c) => keys.find((k) => MTYPES[k].critter === c);
      if (crit('shrieker') && chance(0.5)) {
        const m = call('summon', crit('shrieker'), c0);
        Object.assign(m, { visible: true, shriekT: undefined });
        if (chance(0.5)) for (const o of here.monsters) Object.assign(o, { sleep: false, noticed: true });
      }
      const gone = D.doors.findIndex((d) => d.gone);
      if (crit('engineer') && gone >= 0 && chance(0.6)) {
        const d = D.doors[gone],
          m = call('summon', crit('engineer'), d.i);
        Object.assign(m, { job: gone, work: 2.9 + r() * 0.2, x: d.bx, z: d.bz, visible: chance(0.7) });
        // 着く前に、ほかの物が直した
        if (chance(0.3)) d.gone = false;
      }
      if (crit('cleaner') && chance(0.5)) {
        const i = nearFloor(6),
          m = call('summon', crit('cleaner'), i);
        blaze.burnt[i] = 1;
        Object.assign(m, { job: i, work: 1.7 + r() * 0.2 });
      }
      // 場面：猟犬の群れの頭が、隣のマスの匂いを嗅ぎつける
      const hound = keys.find((k) => MTYPES[k].hound && MTYPES[k].hound !== 'light');
      if (hound && chance(0.6)) {
        const i = nearFloor(10),
          m = call('summon', hound, i);
        Object.assign(m, { noticed: false, isLead: true, tracked: chance(0.3) });
        for (const [dx, dz] of D4) if (chance(0.7)) blaze.scent[i + dx + dz * MW] = clock.time - r() * 30;
      }
      // 場面：行き止まりのマスで、来た向きにしか戻れない
      const dead = floors.filter((i) => D4.filter(([dx, dz]) => D.tile[i + dx + dz * MW] === TF).length === 1);
      if (dead.length && chance(0.6)) {
        const i = pick(dead),
          back = D4.find(([dx, dz]) => D.tile[i + dx + dz * MW] === TF),
          m = call(
            'summon',
            pick(keys.filter((k) => !MTYPES[k].critter && !MTYPES[k].habitat && !MTYPES[k].aquatic && MTYPES[k].form !== 'eel')),
            i,
          );
        Object.assign(m, { dir: [-back[0], -back[1]], noticed: false, leader: null, route: undefined, camp: undefined, goal: undefined });
      }
      // 場面：つながった硫黄の床が、まとめて燃え上がる
      if (chance(0.5)) {
        const i = nearFloor(8);
        for (const j of [i, i + 1, i + MW]) {
          D.surface[j] = SF_BRIM;
          blaze.fuel[j] = chance(0.8) ? 0.8 : 0;
        }
        call('brimFlare', i);
      }
      // 歩みを続ける
      const nSteps = 12 + Math.floor(r() * 12);
      for (let st = 0; st < nSteps; st++) {
        const dt = pick([1 / 30, 0.1, 0.25, 0.5]);
        clock.time += dt;
        gfx.cellTex.needsUpdate = false;
        for (const m of here.monsters) {
          if (!m || chance(0.3)) continue;
          const dp = Math.hypot(player.x - m.x, player.z - m.z);
          if (m.ty.critter && chance(0.8)) call('updateCritter', m, dt, clock.time, chance(0.2) ? r() * 5 : dp);
          else if (chance(0.5)) call('chooseNext', m);
          else call('critterStep', m, chance(0.5));
          if (chance(0.15)) call('canStep', m, near(8));
          if (chance(0.1)) call('houndScent', m);
          if (chance(0.08)) call('hostile', m);
          if (chance(0.08)) call('foe', m);
          if (chance(0.05)) call('machineWork', m, dt);
          if (chance(0.03)) call('initMonsterLife', m);
        }
        const nAct = 3 + Math.floor(r() * 6);
        for (let k = 0; k < nAct; k++) {
          const w = Math.floor(r() * 16),
            i = chance(0.1) ? pick([-1, NCELL, 0, NCELL - 1]) : near(chance(0.5) ? 6 : 20);
          if (w === 0) call('ignite', i, r(), chance(0.3));
          else if (w === 1) call('fireNear', Math.floor(player.x / CELL), Math.floor(player.z / CELL), pick([1, 2, 5]));
          else if (w === 2) call('fireAt', i);
          else if (w === 3) call('tallAt', i);
          else if (w === 4) call('trample', i);
          else if (w === 5) call('brimFlare', i);
          else if (w === 6) {
            // 同じマスに何度か乗ると割れる
            const ci = chance(0.6) ? c0 : i;
            for (let q = 0; q < 1 + Math.floor(r() * 4); q++) call('crackIce', ci, pick([1 / 30, 0.2, 0.5]));
          } else if (w === 7) call('chillArea', player.x + (r() - 0.5) * 12, player.z + (r() - 0.5) * 12, r() * 3);
          else if (w === 8) call('updateFrozen', pick([0.5, 5, 30]));
          else if (w === 9) call('splash', player.x + (r() - 0.5) * 60, player.z + (r() - 0.5) * 60, [r(), r(), r()]);
          else if (w === 10) call('uploadCells');
          else if (w === 11) call('sShriek', player.x, player.z);
          else if (w === 12 && chance(0.3)) call('summon', pick(keys), nearFloor(10));
          else if (w === 13) {
            // 冷気で凍らせた所へ火（溶ける）
            for (const [j] of blaze.frozen) if (chance(0.3)) blaze.fire[j] = 0.5;
          } else if (w === 14) {
            stealth.sneak = !stealth.sneak;
            // 音を切る・入れる（音が鳴らない時）
            if (chance(0.3)) SND.on = !SND.on;
            // 獣がみな起きて気づいている（叫んでも、目を覚ます獣がいない）
            if (chance(0.3)) for (const m of here.monsters) if (m) Object.assign(m, { sleep: false, noticed: true });
          } else Object.assign(player, { x: player.x + (r() - 0.5) * 4, z: player.z + (r() - 0.5) * 4 });
        }
        steps.push({
          mons: here.monsters.map((m) => text(m)).join('\n'),
          fire: hashArr(blaze.fire),
          fuel: hashArr(blaze.fuel),
          burnt: hashArr(blaze.burnt),
          cellFlag: hashArr(blaze.cellFlag),
          liquid: hashArr(D.liquid),
          surface: hashArr(D.surface),
          thin: hashArr(D.thin),
          gas: hashArr(D.gas),
          cellData: hashArr(cellData),
          upload: gfx.cellTex.needsUpdate,
          burning: blaze.burning.join(','),
          frozen: text([...blaze.frozen]),
          trampled: text(blaze.trampled),
          ice: text([...iceT]),
          doors: D.doors.map((d) => `${d.gone ? 1 : 0}${d.o}`).join(''),
          flags: text([ui.fleeMsgT, ui.shriekMsgT, ui.grazeMsg, here.brimMsg, here.repairMsg, D.crackMsg, F.houndScent.msgT, vfx.shake]),
          pN: buf.pN,
          p: Object.values(P)
            .map((a) => hashArr(a, 0, buf.pN))
            .join(''),
          msgs: msgs.map((m) => m.html).join('|'),
          audio: fnv(text(alog)),
          mr: mrN,
          snd: sndN,
        });
      }
      out.push({ s, place: `${place.depth}${place.branch ?? ''}${place.realm ?? ''}${place.inter ?? ''}`, calls, steps });
    }
  } finally {
    restoreGlobals();
    delete msgs.push;
    for (const [k, fields] of keptTypes)
      for (const [f, d] of fields) {
        if (d) Object.defineProperty(MTYPES[k], f, d);
        else delete MTYPES[k][f];
      }
    restore(here, keep.here);
    Object.assign(adv, keep.adv);
    restore(player, keep.player);
    restore(ui, keep.ui);
    restore(vfx, keep.vfx);
    restore(blaze, keep.blaze);
    restore(stealth, keep.stealth);
    restore(SND, keep.SND);
    restore(buf, keep.buf);
    gfx.cellTex = keep.cellTex;
    clock.time = keep.time;
    if (keep.lord) MTYPES['lord'] = keep.lord;
    else delete MTYPES['lord'];
    if (keep.X) MTYPES['X'] = keep.X;
    else delete MTYPES['X'];
    Math.random = keep.random;
    setSoundRand(keep.sound);
    msgs.length = 0;
    msgs.push(...keep.msgs);
    iceT.clear();
    for (const [k, v] of keep.ice) iceT.set(k, v);
    delete F.houndScent.msgT;
  }
  return out;
}
/** 場合の記録を1つの文字列にする */
export const monsterText = (all) =>
  all.map((c) => `${c.s} ${c.place}\n${text(c.calls)}\n${c.steps.map((s) => text(s)).join('\n')}`).join('\n');
