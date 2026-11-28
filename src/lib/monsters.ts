// 生き物の処理と加護の段（statOf・BL・hostile・foe・initMonsterLife・makeMonster・fireAt・fireNear・canStep・chooseNext・
// critterStep・houndScent・updateMonster・summon）：生き物を作る、歩いて行けるか、次に向かうマス、敵か、生き物の動き。
// 状態の入れ物 adv（選んでいる試練・加護の段・年代記）・here（今の階と生き物）・blaze（火と匂い）・player・clock・ui（伝言の時刻）・stealth（忍び足）・vfx（揺れ）に頼る。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う動きになるので、順番を変えないこと。
import { lookup, must, nth } from './array.ts';
import { hittable } from './aim.ts';
import { sHowl, sBubble, sChime, sRumble, sSplash } from './audio.ts';
import { buildForm } from './bodies/build.ts';
import { css } from './color.ts';
import { type MonsterType, MSTAT, MTYPES } from './creatures.ts';
import type { Spawn } from './generate.ts';
import { levelSeed } from './levels.ts';
import { msg } from './log.ts';
import { mname } from './names.ts';
import { keyedRand, mr, mpick, sndRand, withVisualRand } from './random.ts';
import { type Mob, adv, blaze, clock, here, player, stealth, ui, vfx } from './state.ts';
import { trialOn } from './unlocks.ts';
import { CELL, D4, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MW, NCELL, SF_LUMEN, TF, blocksWalk, cpos, SF_BRIM, TW } from './world.ts';
import { G } from './glyphs.ts';
import { brimFlare, ignite, splash, tallAt, trample, updateCritter } from './ground.ts';
import { ceilAt } from './lightmap.ts';
import { clamp } from './rng.ts';
import { flyOpen, onNoticed } from './status.ts';
import { lerpAngle } from './math.ts';
import { monsterStrike } from './combat.ts';
import { spawn } from './particles.ts';

/** 加護 k の今の段（取っていなければ 0） */
export const BL = (k: string): number => adv.lvl.bless[k] || 0;

/**
 * 生き物 m の強さ [体力, 最小のダメージ, 最大のダメージ, 攻撃の間の秒]。種類 key（主は元にした種類 sk）で表を引く（無ければ並の強さ）。
 * 試練「猛り」（fury）では、体力とダメージが 1.3 倍
 */
export const statOf = (m: { ty: MonsterType; key: string }): readonly number[] => {
  const st = MSTAT[m.ty.sk || m.key] || ([12, 2, 5, 1.2] as const);
  return trialOn('fury') ? [st[0] * 1.3, st[1] * 1.3, st[2] * 1.3, st[3]] : st;
};

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/**
 * 生き物を作る（湧く所 s から）。形と初めの値（向き・待つ秒・歩きと揺れの位相・攻撃の間など）は、その生き物だけの見た目の乱数の並び rnd で決め、
 * 生き物に覚えさせる（m.rnd。初めて描く時に作る眠った姿やまわりの飾りも、これで作る）。rnd を省くと、階のシードと、その階で何体目か（here.mobSeq。
 * src/lib/levels.ts の newLevel が生き物を作る前に 0 に戻す）から作る。なので、ほかの所で見た目の乱数を引く回数が変わっても、形と初めの値は変わらない。
 * 何体目かは m.seq に覚えさせる（tick が、この生き物の動きと描画の見た目の乱数の鍵にする。rnd を渡した時は -1）
 */
export function makeMonster(s: Spawn, rnd?: () => number): Mob {
  const seq = rnd ? -1 : here.mobSeq++;
  const r = rnd ?? keyedRand('mob', levelSeed(), seq);
  return withVisualRand(r, () => newMonster(s, r, seq));
}

/** 生き物を作る中身（makeMonster が、見た目の乱数を rnd にして呼ぶ。ゴーレムは部屋の中に見回りの道を作る。強い個体は体力が 2.5 倍、剣を操る者は剣を3本持つ） */
function newMonster(s: Spawn, rnd: () => number, seq: number): Mob {
  const ty = lookup(MTYPES, s.key);
  if (ty && ty.golem && !s.route && here.D && here.D.roomOf) {
    const r = (here.D.roomOf[s.cz * MW + s.cx] ?? NaN) >= 0 ? nth(here.D.rooms, must(here.D.roomOf[s.cz * MW + s.cx], '部屋の番号')) : null;
    if (r && r.cells.length > 12) {
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const c = nth(r.cells, Math.floor(mr() * r.cells.length));
        if (here.D.tile[c] === TF && !here.D.liquid[c] && !here.D.solid.has(c)) pts.push(c);
      }
      s.route = pts;
    }
  }
  const m: Mob = {
    home: s.home,
    route: s.route,
    ri: 0,
    camp: s.camp,
    ty,
    key: s.key,
    x: (s.cx + 0.5) * CELL,
    z: (s.cz + 0.5) * CELL,
    cx: s.cx,
    cz: s.cz,
    tx: s.cx,
    tz: s.cz,
    dir: [0, 0],
    yaw: mr() * 6.28,
    dirYaw: mr() * 6.28,
    wait: mr() * 2,
    alert: 0,
    seen: false,
    visible: false,
    walk: mr() * 10,
    moving: 0,
    ph: mr() * 100,
    form: buildForm(ty),
    acc: 0,
    glow: 1,
    y: 0,
    g: s.g,
    isLead: s.lead,
    leader: null,
    dead: false,
    aware: 0,
    noticed: false,
    sleep: false,
    mark: 0,
    surf: 0,
    surfT: 2 + mr() * 6,
    vx: 0,
    vz: 0,
    vy: 0,
    fy: 1.8,
    flitT: 0,
    rnd,
    seq,
  };
  if (ty.form === 'eel') m.y = -0.6;
  if (ty.critter === 'mimic') {
    m.hidden = true;
  }
  initMonsterLife(m);
  if (s.elite) {
    m.maxHp = Math.round((m.maxHp ?? NaN) * 2.5);
    m.hp = m.maxHp;
    m.elite = true;
  }
  if (ty.conj) {
    m.blades = [0, 1, 2].map((k) => ({ a: k * 2.094, x: m.x, y: 1.5, z: m.z }));
    m.bladeMsg = false;
  }
  return m;
}

/** 生き物の体力（主は 1.5 倍）と、近接の攻撃の間・溜めを初めの値にする */
export function initMonsterLife(m: Mob): void {
  const st = statOf(m);
  m.maxHp = Math.round(nth(st, 0) * (m.ty.boss ? 1.5 : 1));
  m.hp = m.maxHp;
  m.atkCd = 0.5 + mr();
  m.wind = 0;
}
/** マス i が燃えているか */
export const fireAt = (i: number): boolean => i >= 0 && i < NCELL && (blaze.fire[i] ?? NaN) > 0.1;
/** マス cx・cz から r マス以内（上下左右・斜めの遠い方で数える）で、一番近い燃えているマス（無ければ -1） */
export function fireNear(cx: number, cz: number, r: number): number {
  let best = -1,
    bd = 1e9;
  for (const i of blaze.burning) {
    if ((blaze.fire[i] ?? NaN) <= 0.1) continue;
    const dx = (i % MW) - cx,
      dz = ((i / MW) | 0) - cz,
      d = Math.max(Math.abs(dx), Math.abs(dz));
    if (d <= r && d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
/** canStep が読む生き物の欄（墓の霊を立たせる所を探す時は、種類の form だけを持つ仮の物を渡す） */
export type Stepper = { ty: Pick<MonsterType, 'habitat' | 'critter' | 'aquatic' | 'form'>; home?: number | undefined };
/**
 * 生き物 m がマス i に歩いて行けるか。火（溶岩に住む物は平気）・守りの印（小さな生き物は平気）・閉じた鉄格子・自分の部屋の外には行かない。
 * 住む所ごと：沼の物は沼だけ、深みの物は深い水だけ、両生の物は溶岩と沼のほか、溶岩の物は水のほか、水の物は水だけ、うなぎは深い水だけ、ほかは歩ける床だけ
 */
export const canStep = (m: Stepper, i: number): boolean =>
  (m.ty.habitat === 'lava' || !fireAt(i)) &&
  !(level().glyph && level().glyph[i] && !m.ty.critter) &&
  !(level().gate && must(level().gate, '鉄格子 gate').o < 0.7 && i === must(level().gate, '鉄格子 gate').cell) &&
  (m.home === undefined || level().roomOf[i] === m.home) &&
  (m.ty.habitat === 'bog'
    ? level().tile[i] === TF && level().liquid[i] === LQ_BOG
    : m.ty.habitat === 'deep'
      ? level().tile[i] === TF && level().liquid[i] === LQ_DEEP
      : m.ty.habitat === 'amph'
        ? level().tile[i] === TF && !level().solid.has(i) && level().liquid[i] !== LQ_LAVA && level().liquid[i] !== LQ_BOG
        : m.ty.habitat === 'lava'
          ? level().tile[i] === TF && !level().solid.has(i) && level().liquid[i] !== LQ_DEEP && level().liquid[i] !== LQ_WATER
          : m.ty.aquatic
            ? level().tile[i] === TF && (level().liquid[i] === LQ_WATER || level().liquid[i] === LQ_DEEP)
            : m.ty.form === 'eel'
              ? level().tile[i] === TF && level().liquid[i] === LQ_DEEP
              : level().tile[i] === TF && !blocksWalk(must(level().liquid[i], '液体')) && !level().solid.has(i));
/**
 * 生き物 m が、マス starts のどれかから上下左右に（canStep のマスを）歩いて、各マスへ何歩で行けるか（行けないマスと limit 歩より先は -1）。
 * 始めのマスは 0 歩（歩けるかは見ない）。掃除機と修復機が、行ける仕事を選び、仕事の所への道を選ぶのに使う
 */
export function walkSteps(m: Stepper, starts: readonly number[], limit: number): Int16Array {
  const d = new Int16Array(NCELL).fill(-1),
    q: number[] = [];
  for (const s of starts)
    if (s >= 0 && s < NCELL && d[s] === -1) {
      d[s] = 0;
      q.push(s);
    }
  for (let h = 0; h < q.length; h++) {
    const c = nth(q, h),
      dc = d[c] ?? 0;
    if (dc >= limit) continue;
    const cx = c % MW;
    for (const [dx, dz] of D4) {
      if (cx + dx < 0 || cx + dx >= MW) continue; // 行の端で回り込まない
      const j = c + dz * MW + dx;
      if (j < 0 || j >= NCELL || d[j] !== -1 || !canStep(m, j)) continue;
      d[j] = dc + 1;
      q.push(j);
    }
  }
  return d;
}
/** 掃除機と修復機が、仕事を選ぶ・仕事の所へ歩く時に数える歩数の上限（掃除機は20、修復機は40） */
export const jobReach = (m: Stepper): number => (m.ty.critter === 'engineer' ? 40 : 20);
/** 掃除機と修復機が仕事をする所のマス（掃除機は仕事のマス、修復機は扉の両側のマス） */
export const jobCells = (m: Stepper, job: number): number[] => {
  if (m.ty.critter !== 'engineer') return [job];
  const d = nth(level().doors, job);
  return [d.i, d.j];
};
/**
 * 生き物 m が次のマスに着いた時、次に向かうマスを選ぶ（ときどき立ち止まる）。近くに火があれば逃げる。
 * 向かう所は、気づいた敵ならプレイヤー、呼ばれた所、見回りの道、野営の火、猟犬なら匂い（光の猟犬は灯り）、群れの頭の順。無ければ、なるべくまっすぐ歩き回る
 */
export function chooseNext(m: Mob): void {
  if (m.ty.form !== 'eel' && !m.leader && m.ty.form !== 'bloat' && mr() < 0.1) m.wait = 1 + mr() * 3;
  const opts = [];
  for (const d of D4) {
    const i = (m.cz + d[1]) * MW + m.cx + d[0];
    if (canStep(m, i)) opts.push(d);
  }
  if (!opts.length) return;
  const fn = fireNear(m.cx, m.cz, 2);
  if (fn >= 0) {
    let best = nth(opts, 0),
      bd = -1;
    for (const d of opts) {
      const dd = Math.hypot(m.cx + d[0] - (fn % MW), m.cz + d[1] - ((fn / MW) | 0)) + mr() * 0.3;
      if (dd > bd) {
        bd = dd;
        best = d;
      }
    }
    m.dir = best;
    m.tx = m.cx + best[0];
    m.tz = m.cz + best[1];
    m.flee = 1.6;
    if (m.visible && clock.time - ui.fleeMsgT > 6) {
      ui.fleeMsgT = clock.time;
      msg(`<b style="color:${css(m.ty.col)}">${m.ty.ch}</b>${mname(m)}が炎から逃げ出した。`);
    }
    return;
  }
  let goal = null;
  if (m.noticed && hostile(m) && !((m.flee ?? NaN) > 0)) goal = [player.x, player.z];
  if (!goal && m.goal && clock.time < (m.goalT ?? NaN)) goal = m.goal;
  if (!goal && m.route && m.route.length && !m.noticed) {
    const rc = m.route[m.ri % m.route.length];
    if (rc === m.cz * MW + m.cx) m.ri++;
    goal = cpos(nth(m.route, m.ri % m.route.length));
  }
  if (!goal && (m.camp ?? NaN) >= 0 && m.camp !== undefined && !m.noticed) {
    const [cx2, cz2] = cpos(m.camp);
    if (Math.hypot(cx2 - m.x, cz2 - m.z) > 3.2) goal = [cx2, cz2];
    else if (mr() < 0.85) {
      m.wait = 2 + mr() * 4;
      return;
    }
  }
  if (!goal && m.ty.hound && m.isLead && !m.noticed) {
    if (m.ty.hound === 'light' && !stealth.sneak && Math.hypot(player.x - m.x, player.z - m.z) < 22) goal = [player.x, player.z];
    else {
      const sd = houndScent(m);
      if (sd) {
        m.dir = sd;
        m.tx = m.cx + sd[0];
        m.tz = m.cz + sd[1];
        if (!m.tracked) {
          m.tracked = true;
          if (clock.time - (houndScent.msgT || -99) > 20) {
            houndScent.msgT = clock.time;
            msg(`<b style="color:${css(m.ty.col)}">Z</b>どこかで${mname(m)}の群れが、あなたの匂いを嗅ぎつけた。`);
            sHowl(m.x, m.z);
          }
        }
        return;
      }
    }
  }
  if (!goal && m.leader && !m.leader.dead) {
    const L = m.leader;
    if (Math.hypot(L.x - m.x, L.z - m.z) > 3.2) goal = [L.x, L.z];
    else if (mr() < 0.5) {
      m.wait = 0.3 + mr() * 0.8;
      return;
    }
  }
  if (m.ty.form === 'bloat' && m.noticed) goal = [player.x, player.z];
  if (goal) {
    let best = nth(opts, 0),
      bd = 1e9;
    for (const d of opts) {
      const x = (m.cx + d[0] + 0.5) * CELL,
        z = (m.cz + d[1] + 0.5) * CELL,
        dd = Math.hypot(x - nth(goal, 0), z - nth(goal, 1)) + mr() * 0.6;
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    m.dir = best;
    m.tx = m.cx + best[0];
    m.tz = m.cz + best[1];
    return;
  }
  const fwd = opts.find((o) => o[0] === m.dir[0] && o[1] === m.dir[1]);
  const nrev = opts.filter((o) => !(o[0] === -m.dir[0] && o[1] === -m.dir[1]));
  const ch = fwd && mr() < 0.6 ? fwd : nrev.length ? nth(nrev, Math.floor(mr() * nrev.length)) : nth(opts, 0);
  m.dir = ch;
  m.tx = m.cx + ch[0];
  m.tz = m.cz + ch[1];
}
/**
 * 掃除機・修復機 m が仕事の所へ向かう、歩数が一番少ない隣の向き（opts から選ぶ。歩数が同じなら opts の順）。仕事が無ければ null。
 * 仕事がもう済んでいるか（ほかの物が先に片付けた）、仕事の所へもう行けなければ（火が回った・鉄格子が閉じた・吹き飛ばされたなど）、
 * 仕事を手放し（仕事をした秒も 0 に戻す）、null（次に探す時に選び直す）
 */
function jobStep(m: Mob, opts: readonly (readonly [number, number])[]): readonly [number, number] | null {
  if ((m.ty.critter !== 'cleaner' && m.ty.critter !== 'engineer') || m.job === undefined || m.job < 0) return null;
  const drop = (): null => {
    m.job = -1;
    m.work = 0;
    return null;
  };
  // ほかの物が先に片付けた・作り直した仕事は、着く前に手放す
  if (m.ty.critter === 'engineer' ? !nth(level().doors, m.job).gone : !blaze.burnt[m.job]) return drop();
  const steps = walkSteps(
    m,
    jobCells(m, m.job).filter((i) => canStep(m, i)),
    jobReach(m),
  );
  let best = null,
    bd = 1e9;
  for (const d of opts) {
    const s = steps[(m.cz + d[1]) * MW + m.cx + d[0]] ?? -1;
    if (s >= 0 && s < bd) {
      bd = s;
      best = d;
    }
  }
  return best ?? drop();
}
/** 小さな生き物 m が次のマスに着いた時、次に向かうマスを選ぶ。逃げる時はプレイヤーから遠く、掃除機・修復機は仕事の所へ道なりに、草を食べる物は光る苔へ、ほかはなるべくまっすぐ */
export function critterStep(m: Mob, away: boolean): void {
  const opts = [];
  for (const d of D4) {
    const i = (m.cz + d[1]) * MW + m.cx + d[0];
    if (canStep(m, i)) opts.push(d);
  }
  if (!opts.length) return;
  let ch = null;
  if (away) {
    let bd = -1;
    for (const d of opts) {
      const dd = Math.hypot((m.cx + d[0] + 0.5) * CELL - player.x, (m.cz + d[1] + 0.5) * CELL - player.z) + mr() * 0.4;
      if (dd > bd) {
        bd = dd;
        ch = d;
      }
    }
  } else ch = jobStep(m, opts);
  if (!ch) {
    if (m.ty.critter === 'grazer') {
      const moss = opts.filter((d) => level().surface[(m.cz + d[1]) * MW + m.cx + d[0]] === SF_LUMEN);
      ch = moss.length && mr() < 0.8 ? nth(moss, Math.floor(mr() * moss.length)) : nth(opts, Math.floor(mr() * opts.length));
    } else {
      const fwd = opts.find((o) => o[0] === m.dir[0] && o[1] === m.dir[1]);
      const nrev = opts.filter((o) => !(o[0] === -m.dir[0] && o[1] === -m.dir[1]));
      ch = fwd && mr() < 0.6 ? fwd : nrev.length ? nth(nrev, Math.floor(mr() * nrev.length)) : nth(opts, 0);
    }
  }
  m.dir = must(ch, '向き ch');
  m.tx = m.cx + must(ch, '向き ch')[0];
  m.tz = m.cz + must(ch, '向き ch')[1];
}
/** 猟犬 m が追う向き：歩いて行ける隣のマスのうち、一番新しい匂い（40秒より古い物は追わない）。無ければ null。水は匂いを消す */
export function houndScent(m: Mob): readonly [number, number] | null {
  let best = null,
    bs = clock.time - 40;
  for (const d of D4) {
    const i = (m.cz + d[1]) * MW + m.cx + d[0];
    if (!canStep(m, i)) continue;
    if ((blaze.scent[i] ?? NaN) > 0 && (blaze.scent[i] ?? NaN) > bs) {
      bs = must(blaze.scent[i], '匂い');
      best = d;
    }
  } // 0 is a cell with no scent (in the first 40 s, bs is below 0)
  return best;
}
/**
 * 猟犬が匂いを嗅ぎつけた伝言を最後に出したゲームの時刻（関数の欄。20秒あける。chooseNext が読み書きする）。
 * 型だけの declare namespace で欄の型を付ける（組み立てで消える）
 */
export declare namespace houndScent {
  let msgT: number | undefined;
}
/** 生き物 m が敵か（小さな生き物・おとなしい物・監視の機械・膨れた物・死んだ物は敵ではない） */
export const hostile = (m: Mob): boolean => !m.ty.critter && !m.ty.peaceful && !m.ty.watcher && m.ty.form !== 'bloat' && !m.dead;
/** 生き物 m を攻撃の的にしてよいか（敵と、監視の機械・膨れた物・茸・正体を現した幻影） */
export const foe = (m: Mob): boolean =>
  hittable(m) && (hostile(m) || m.ty.watcher || m.ty.form === 'bloat' || m.ty.form === 'shroom' || (m.ty.critter === 'mimic' && !m.hidden));
/** 種類 key の生き物を、マス cell に呼び出す（警戒していて、見た物として。階の生き物に足して返す） */
export function summon(key: string, cell: number): Mob {
  const m = makeMonster({ key, cx: cell % MW, cz: (cell / MW) | 0, g: -1, lead: true });
  m.alert = 1;
  m.seen = true;
  here.monsters.push(m);
  return m;
}
/**
 * 視界の中にいても、体が描かれない生き物か（プレイヤーまでの距離 dp）：見えない種類・水に潜ったうなぎ（顔を出して 0.08 を越えるまで）・
 * 沼に沈んだ生き物（浮かび上がって 0.25 を越えるまで）・3 より遠い茂みの中の生き物。updateMonster の m.visible と、
 * 目の慣れ（src/lib/camera.ts の updateAtmosphere）が、近くの生き物を明るさに数えるかに使う
 */
export const bodyUnseen = (m: Mob, dp: number): boolean =>
  !!m.ty.invisible ||
  (m.ty.form === 'eel' && !(m.surf > 0.08)) ||
  (m.ty.habitat === 'bog' && !((m.rise || 0) > 0.25)) ||
  (tallAt(m.cz * MW + m.cx) && dp > 3);
/**
 * 生き物の動き（毎フレーム）：沼と深みの物が姿を現す、見えるか、茂みと硫黄、小さな生き物、ノームの昔話、
 * 気づき（明るい所ほど遠くから）と眠りから覚める、飛ぶ物・待つ物・歩く物の動き、向きと歩き、うなぎ、膨れた物が弾ける、剣を操る者の剣、
 * 初めて見た時の伝言、近接の攻撃、重い足音、溶岩と火の猟犬の火、氷の猟犬、忘れられた獣、光の尾
 */
export function updateMonster(m: Mob, dt: number, t: number): void {
  const ty = m.ty,
    dxp = player.x - m.x,
    dzp = player.z - m.z,
    dp = Math.hypot(dxp, dzp);
  const cell = m.cz * MW + m.cx;
  const inView = here.fovVis[cell] === here.fovStamp && dp < 28;
  if (ty.habitat === 'bog' || ty.habitat === 'deep') {
    const tgt = dp < (ty.habitat === 'bog' ? 4 : 9) || m.noticed ? 1 : 0;
    m.rise = (m.rise || 0) + (tgt - (m.rise || 0)) * Math.min(1, dt * (tgt ? 1.4 : 0.5));
    if (ty.habitat === 'bog') {
      m.y = -0.9 + 0.9 * m.rise;
      if (mr() < dt * 3 && dp < 24)
        spawn(m.x + (mr() - 0.5) * 1.2, 0.06, m.z + (mr() - 0.5) * 1.2, 0, 0.25, 0, 0.9, G('o'), 0.14, 0.35, 0.42, 0.15, 1);
      if (m.rise > 0.3 && !m.riseMsg && inView) {
        m.riseMsg = true;
        msg(`<b style="color:${css(ty.col)}">B</b>沼が盛り上がり、${mname(m)}が姿を現した！`);
        sBubble(m.x, m.z, 0.5, false);
      }
    } else {
      m.y = -0.7;
      if (m.rise > 0.3 && !m.riseMsg && inView) {
        m.riseMsg = true;
        msg(`<b style="color:${css(ty.col)}">K</b>水面が割れ、${mname(m)}の触手が立ち上がった！`);
        sSplash(0.5);
        vfx.shake = Math.max(vfx.shake, 0.2);
      }
    }
  }
  m.visible = inView && !bodyUnseen(m, dp);
  if (tallAt(cell) && !ty.flier && m.moving > 0.5 && mr() < dt * 0.5) trample(cell);
  if (level().surface[cell] === SF_BRIM && !ty.flier && m.moving > 0.5) brimFlare(cell);
  if (ty.critter) {
    if (dp > 30 && !ty.critter.startsWith('clean') && ty.critter !== 'engineer') {
      m.visible = false;
      return;
    }
    updateCritter(m, dt, t, dp);
    return;
  }
  // perception (after Brogue's stealth): the brighter the spot you stand in, the farther away you can be noticed
  if (ty.peaceful) {
    m.aware = 0;
    m.noticed = false;
    m.sleep = false;
    if (dp < 2.4 && clock.time - (m.talkT || -99) > 14) {
      m.talkT = clock.time;
      const ru = nth(must(adv.HIST).rulers, Math.floor(mr() * must(adv.HIST).rulers.length));
      const L = [
        `昔々、この上には${must(adv.HIST).civ.name}の都があったんだとさ。`,
        `${ru.title}${ru.name}の巨像を見たかい？ 眼だけは、まだ光ってるんだ。`,
        '溶岩の海の先には、何もない闇があるって話だ。',
        '灯りを絞って歩けば、獣にも見つからないよ。',
        '神殿の巻物は、近づくと勝手にしゃべるんだ。',
        `${must(adv.HIST).beast}の話を聞くと、子どもたちは眠れなくなる。`,
        '壁の彫刻を読んでごらん。この世界の昔話が刻んであるよ。',
      ];
      msg(
        `<b style="color:${css(ty.col)}">G</b><span style="color:${css(ty.col)}">ノーム</span>「${nth(L, Math.floor(mr() * L.length))}」`,
      );
    }
  } else if (ty.form !== 'eel' || m.surf > 0) {
    const sr = ui.started ? stealth.range * (m.sleep ? 0.5 : 1) : 0;
    if (inView && dp < sr) {
      const rate = (1 - dp / sr) * 2.2 + 0.35;
      m.aware = Math.min(1.25, m.aware + dt * rate * (m.sleep ? 0.35 : 1));
    } else m.aware = Math.max(0, m.aware - dt * (m.noticed ? 0.12 : 0.2));
  }
  if (m.sleep && m.aware > 0.35) {
    m.sleep = false;
    m.wait = 0.6;
  }
  if (!m.noticed && m.aware >= 1) onNoticed(m);
  if (m.noticed && m.aware < 0.55) m.noticed = false;
  m.alert += ((m.noticed ? 1 : m.aware > 0.35 ? 0.35 : 0) - m.alert) * Math.min(1, dt * 3);
  let moving = 0;
  if (m.sleep) {
    moving = 0;
  } else if (m.hold) {
    moving = m.hold.walk ? 1 : 0;
  } else if (ty.flier) {
    // erratic flight: picks a new heading every fraction of a second; circles the player once it notices them
    m.flitT -= dt;
    if (m.flitT <= 0) {
      m.flitT = 0.25 + mr() * 0.5;
      const a = mr() * 6.28;
      const tx = m.noticed ? player.x + Math.cos(a) * 2.5 : m.x + Math.cos(a) * 3,
        tz = m.noticed ? player.z + Math.sin(a) * 2.5 : m.z + Math.sin(a) * 3;
      const dx = tx - m.x,
        dz = tz - m.z,
        d = Math.hypot(dx, dz) || 1,
        sp = ty.speed * (0.6 + mr() * 0.6);
      m.vx = (dx / d) * sp;
      m.vz = (dz / d) * sp;
      m.vy = (mr() - 0.5) * 1.6;
    }
    {
      const fn = fireNear(m.cx, m.cz, 1);
      if (fn >= 0) {
        const ax = m.x - ((fn % MW) + 0.5) * CELL,
          az = m.z - (((fn / MW) | 0) + 0.5) * CELL,
          al = Math.hypot(ax, az) || 1;
        m.vx = (ax / al) * ty.speed;
        m.vz = (az / al) * ty.speed;
      }
    }
    const nx = m.x + m.vx * dt,
      nz = m.z + m.vz * dt;
    if (flyOpen(nx, m.z)) m.x = nx;
    else m.vx *= -1;
    if (flyOpen(m.x, nz)) m.z = nz;
    else m.vz *= -1;
    m.fy = clamp(m.fy + m.vy * dt, 1.0, Math.max(1.2, Math.min(3.0, (ceilAt(m.x, m.z) ?? NaN) - 0.4)));
    m.y = m.fy;
    m.cx = Math.floor(m.x / CELL);
    m.cz = Math.floor(m.z / CELL);
    moving = 1;
    m.dirYaw = Math.atan2(m.vx, m.vz);
  } else if (m.wait > 0) {
    m.wait -= dt;
    if (fireNear(m.cx, m.cz, 2) >= 0) m.wait = 0;
  } else {
    const tx = (m.tx + 0.5) * CELL,
      tz = (m.tz + 0.5) * CELL,
      ddx = tx - m.x,
      ddz = tz - m.z,
      d = Math.hypot(ddx, ddz);
    if (d < 0.04) {
      m.x = tx;
      m.z = tz;
      m.cx = m.tx;
      m.cz = m.tz;
      chooseNext(m);
    } else {
      if ((m.flee ?? NaN) > 0) m.flee = (m.flee ?? NaN) - dt;
      const calm =
        ty.form === 'bloat' || ty.form === 'eel' || (m.flee ?? NaN) > 0
          ? (m.flee ?? NaN) > 0
            ? 1.6
            : 1
          : m.noticed && hostile(m)
            ? 1.15
            : 1 - 0.88 * m.alert;
      const catchUp = m.leader && Math.hypot(m.leader.x - m.x, m.leader.z - m.z) > 4 ? 1.35 : 1;
      const sp = ty.speed * calm * catchUp * dt,
        st = Math.min(sp, d);
      m.x += (ddx / d) * st;
      m.z += (ddz / d) * st;
      moving = calm;
      m.dirYaw = Math.atan2(ddx, ddz);
      m.cx = Math.floor(m.x / CELL);
      m.cz = Math.floor(m.z / CELL);
    }
  }
  m.moving += (moving - m.moving) * Math.min(1, dt * 5);
  m.yaw = lerpAngle(
    m.yaw,
    m.hold && m.hold.yaw !== undefined
      ? m.hold.yaw
      : (m.alert > 0.3 || (ty.peaceful && dp < 4)) && !ty.flier && ty.form !== 'eel'
        ? Math.atan2(dxp, dzp)
        : m.dirYaw,
    1 - Math.exp(-dt * (ty.flier ? 8 : 3)),
  );
  m.walk += dt * m.moving * ty.speed * 5.5;
  m.glow = 1 + m.alert * 0.7;
  if (!ty.flier && ty.form !== 'eel')
    m.y = ty.fl ? ty.fl + Math.sin(t * 1.3 + m.ph) * 0.12 : ty.hop ? Math.abs(Math.sin(m.walk * 0.7)) * 0.45 * m.moving : 0;
  const c = ty.col;
  // eels: lurk below the surface, leaving only ripples, and now and then arc out of the water
  if (ty.form === 'eel') {
    m.surfT -= dt;
    if (m.surf <= 0 && m.surfT <= 0 && dp < 20) {
      m.surf = 0.001;
      m.surfT = 6 + mr() * 8;
      splash(m.x, m.z, c);
    }
    if (m.surf > 0) {
      m.surf += dt / 2.6;
      if (m.surf >= 1) {
        m.surf = 0;
        splash(m.x, m.z, c);
      }
    }
    m.acc += dt * (m.surf > 0 ? 0 : 3.5);
    while (m.acc >= 1) {
      m.acc--;
      if (dp > 22) continue;
      for (let q = 0; q < 6; q++) {
        const a = (q / 6) * Math.PI * 2;
        spawn(
          m.x + Math.cos(a) * 0.2,
          0.08,
          m.z + Math.sin(a) * 0.2,
          Math.cos(a) * 0.3,
          0.01,
          Math.sin(a) * 0.3,
          1.1,
          G('~'),
          0.14,
          0.12,
          0.3,
          0.45,
          1,
        );
      }
    }
  }
  if (ty.form === 'bloat' && ((dp < 1.4 && !m.sleep) || fireNear(m.cx, m.cz, 1) >= 0)) {
    m.dead = true;
    for (const d of [[0, 0], ...D4, [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const i = (m.cz + nth(d, 1)) * MW + m.cx + nth(d, 0);
      if (i >= 0 && i < NCELL && level().tile[i] !== TW) level().gas[i] = Math.min(1, nth(level().gas, i) + 0.95);
    }
    blaze.gasAny = true;
    for (let q = 0; q < 26; q++) {
      const a = mr() * 6.28,
        e2 = (mr() - 0.3) * 1.2;
      spawn(
        m.x,
        m.y,
        m.z,
        Math.cos(a) * 1.6,
        e2,
        Math.sin(a) * 1.6,
        1 + mr(),
        G(mpick(['o', '.', '*', '~'])),
        0.16,
        c[0] * 1.6,
        c[1] * 1.6,
        c[2] * 1.6,
        1,
      );
    }
    sBubble(m.x, m.z, 0.5, true);
    sSplash(0.2);
    msg(`<b style="color:${css(c)}">b</b>${mname(m)}が弾け、腐食性のガスが広がった。`);
    return;
  }
  if (ty.conj) {
    const hunt = m.noticed && dp < 10;
    if (hunt && !m.bladeMsg) {
      m.bladeMsg = true;
      msg(`<b style="color:${css(c)}">g</b>${mname(m)}の霊剣が、あなたの周りを旋回し始めた。`);
    }
    for (const b of must(m.blades)) {
      b.a += dt * (hunt ? 2.6 : 1.6);
      const ccx = hunt ? player.x : m.x,
        ccz = hunt ? player.z : m.z,
        r = hunt ? 1.7 : 0.9;
      const tx = ccx + Math.cos(b.a) * r,
        tz = ccz + Math.sin(b.a) * r,
        tyy = (hunt ? 1.35 : 1.55) + Math.sin(b.a * 2) * 0.2,
        k = Math.min(1, dt * (hunt ? 3 : 5));
      b.x += (tx - b.x) * k;
      b.y += (tyy - b.y) * k;
      b.z += (tz - b.z) * k;
      if (mr() < dt * 10 && dp < 24) spawn(b.x, b.y, b.z, 0, 0, 0, 0.5, G(mpick(['.', "'"])), 0.1, 0.8, 1.2, 1.5, 1);
    }
  }
  if (!m.seen) {
    if (m.visible && dp < 22 && ty.boss) {
      m.seen = true;
      msg(`<b style="color:${css(c)}">${ty.ch}</b>${mname(m)}がいる。この地の主だ。`);
      sRumble(0.25, 1.6);
    } else if (m.visible && dp < 16 && ty.beast) {
      m.seen = true;
      msg(`<b style="color:${css(c)}">X</b>${mname(m)}が、洞窟の奥で眠っている。`);
    } else if (m.visible && dp < 13) {
      m.seen = true;
      msg(
        `<b style="color:${css(c)}">${ty.ch}</b>${mname(m)}が${m.sleep ? '眠っている。忍び寄れば、気づかれずに通り抜けられるかもしれない' : ty.verb}。`,
      );
    } else if (ty.invisible && inView && dp < 7) {
      m.seen = true;
      msg(`<b style="color:${css(c)}">?</b>何かが、すぐ近くで空気を揺らしている……。`);
    }
  }
  if (!m.hold) monsterStrike(m, dt, dp);
  if ((m.hitT ?? NaN) > 0) m.hitT = (m.hitT ?? NaN) - dt;
  if (ty.heavy && !m.sleep && m.moving > 0.4 && dp < 16) {
    m.stepT = (m.stepT || 0) + dt * m.moving * ty.speed * 1.6;
    if (m.stepT > 1) {
      m.stepT = 0;
      vfx.shake = Math.max(vfx.shake, 0.12 * (1 - dp / 16));
      sRumble(0.12 * (1 - dp / 16), 0.4);
    }
  }
  if (ty.habitat === 'lava' && m.moving > 0.5) {
    const ci = m.cz * MW + m.cx;
    if (!level().liquid[ci] && (blaze.fuel[ci] ?? NaN) > 0 && (blaze.fire[ci] ?? NaN) <= 0 && mr() < dt * 0.8) ignite(ci, 0.5, false);
  }
  if (ty.hound && m.moving > 0.5) {
    const ci = m.cz * MW + m.cx;
    if (ty.hound === 'fire' && (blaze.fuel[ci] ?? NaN) > 0 && (blaze.fire[ci] ?? NaN) <= 0 && mr() < dt * 0.4) ignite(ci, 0.4, false);
    if (ty.hound === 'ice' && (blaze.fire[ci] ?? NaN) > 0) blaze.fire[ci] = 0;
  }
  if (ty.beast && !m.sleep) {
    if (must(ty.spec).fire) {
      const ci = m.cz * MW + m.cx;
      if ((blaze.fuel[ci] ?? NaN) > 0 && (blaze.fire[ci] ?? NaN) <= 0) ignite(ci, 0.5, false);
    }
    if (must(ty.spec).sing && dp < 22 && sndRand() < dt * 0.5) sChime(m.x, m.z, 0.35);
  }
  if (dp < 30 && ty.trail) {
    m.acc += dt * ty.trail * (m.sleep ? 0.25 : 1);
    while (m.acc >= 1) {
      m.acc--;
      const y =
        m.y +
        (ty.form === 'orb' || ty.form === 'bat' || ty.form === 'bloat'
          ? 0
          : ty.form === 'wraith'
            ? 0.4 + mr() * 1.2
            : 0.3 + mr() * 1.2 * ty.scale);
      spawn(
        m.x + (mr() - 0.5) * 0.4,
        y,
        m.z + (mr() - 0.5) * 0.4,
        (mr() - 0.5) * 0.15,
        ty.form === 'wraith' ? -0.08 : 0.12 + mr() * 0.15,
        (mr() - 0.5) * 0.15,
        1.5 + mr() * 2,
        G(mpick(['.', "'", '*', '`', ty.ch])),
        0.08 + mr() * 0.06,
        c[0] * 1.3,
        c[1] * 1.3,
        c[2] * 1.3,
        1,
      );
    }
  }
}
