// 生き物の処理と加護の段（もとは src/game/18-level-player.js の statOf・BL・hostile・foe・initMonsterLife、11-monster-move.js の makeMonster・fireAt・fireNear・canStep・chooseNext、
// 13-creatures.js の critterStep・houndScent、15-sound-fire.js の summon）：生き物を作る、歩いて行けるか、次に向かうマス、敵か。
// 状態の入れ物 adv（選んでいる試練・加護の段）・here（今の階と生き物）・blaze（火と匂い）・player・clock・ui（伝言の時刻）・stealth（忍び足）に頼る。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う動きになるので、順番を変えないこと。
import { lookup, must, nth } from './array.ts';
import { hittable } from './aim.ts';
import { sHowl } from './audio.ts';
import { buildForm } from './bodies/build.ts';
import { css } from './color.ts';
import { type MonsterType, MSTAT, MTYPES } from './creatures.ts';
import type { Spawn } from './generate.ts';
import { msg } from './log.ts';
import { mname } from './names.ts';
import { mr } from './random.ts';
import { type Mob, adv, blaze, clock, here, player, stealth, ui } from './state.ts';
import { trialOn } from './unlocks.ts';
import { CELL, D4, LQ_BOG, LQ_DEEP, LQ_LAVA, LQ_WATER, MW, NCELL, SF_LUMEN, TF, blocksWalk, cpos } from './world.ts';

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

/** 生き物を作る（湧く所 s から。ゴーレムは部屋の中に見回りの道を作る。強い個体は体力が 2.5 倍、剣を操る者は剣を3本持つ） */
export function makeMonster(s: Spawn): Mob {
  const ty = lookup(MTYPES, s.key);
  if (ty && ty.golem && !s.route && here.D && here.D.roomOf) {
    const r = (here.D.roomOf[s.cz * MW + s.cx] ?? NaN) >= 0 ? nth(here.D.rooms, must(here.D.roomOf[s.cz * MW + s.cx], '部屋の番号')) : null;
    if (r && r.cells.length > 12) {
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const c = nth(r.cells, Math.floor(Math.random() * r.cells.length));
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
/**
 * 生き物 m がマス i に歩いて行けるか。火（溶岩に住む物は平気）・守りの印（小さな生き物は平気）・閉じた鉄格子・自分の部屋の外には行かない。
 * 住む所ごと：沼の物は沼だけ、深みの物は深い水だけ、両生の物は溶岩と沼のほか、溶岩の物は水のほか、水の物は水だけ、うなぎは深い水だけ、ほかは歩ける床だけ
 */
export const canStep = (m: Mob, i: number): boolean =>
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
/** 小さな生き物 m が次のマスに着いた時、次に向かうマスを選ぶ。逃げる時はプレイヤーから遠く、掃除機・修復機は仕事の所へ、草を食べる物は光る苔へ、ほかはなるべくまっすぐ */
export function critterStep(m: Mob, away: boolean): void {
  const opts = [];
  for (const d of D4) {
    const i = (m.cz + d[1]) * MW + m.cx + d[0];
    if (canStep(m, i)) opts.push(d);
  }
  if (!opts.length) return;
  let ch;
  if (away) {
    let bd = -1;
    for (const d of opts) {
      const dd = Math.hypot((m.cx + d[0] + 0.5) * CELL - player.x, (m.cz + d[1] + 0.5) * CELL - player.z) + mr() * 0.4;
      if (dd > bd) {
        bd = dd;
        ch = d;
      }
    }
  } else if ((m.ty.critter === 'cleaner' || m.ty.critter === 'engineer') && (m.job ?? NaN) >= 0) {
    const [gx, gz] =
      m.ty.critter === 'engineer'
        ? [nth(level().doors, must(m.job, '仕事 job')).bx, nth(level().doors, must(m.job, '仕事 job')).bz]
        : cpos(must(m.job, '仕事 job'));
    let bd = 1e9;
    for (const d of opts) {
      const dd = Math.hypot((m.cx + d[0] + 0.5) * CELL - gx, (m.cz + d[1] + 0.5) * CELL - gz) + mr() * 0.5;
      if (dd < bd) {
        bd = dd;
        ch = d;
      }
    }
  } else if (m.ty.critter === 'grazer') {
    const moss = opts.filter((d) => level().surface[(m.cz + d[1]) * MW + m.cx + d[0]] === SF_LUMEN);
    ch = moss.length && mr() < 0.8 ? nth(moss, Math.floor(mr() * moss.length)) : nth(opts, Math.floor(mr() * opts.length));
  } else {
    const fwd = opts.find((o) => o[0] === m.dir[0] && o[1] === m.dir[1]);
    const nrev = opts.filter((o) => !(o[0] === -m.dir[0] && o[1] === -m.dir[1]));
    ch = fwd && mr() < 0.6 ? fwd : nrev.length ? nth(nrev, Math.floor(mr() * nrev.length)) : nth(opts, 0);
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
 * 型だけの declare namespace で欄の型を付ける（組み立てで消える。古い JS の houndScent.msgT の文をそのまま残すため）
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
