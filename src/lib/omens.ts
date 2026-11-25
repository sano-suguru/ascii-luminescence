// 先にある物の手がかり（もとは src/game/22-world-hints.js）：言葉では告げず、近くで感じ取るだけの物。
// 下り階段から漏れる物（次の層・特別な階・支道の奥）、支道の入口のまわりの跡、異界の門の光、それぞれの小さな音。封じられた階段の封も描く。
// 状態の入れ物 here（今いる場所と階）・adv（探索のシード）・player・clock・ui（図鑑）に頼る。呼ぶのは古い JS の描画（30-loop-init.js の tick と
// 22-world-hints.js の drawRunesWorld）と、見た時の説明（29-look.js）・階段の封（18-level-player.js・30-loop-init.js）。
// 見た目の乱数 mr() を引く順番を変えると、同じシードでも違う見た目になるので、順番を変えないこと。次に音を鳴らせる時刻は、音の乱数 sndRand で決める（見た目の乱数とは別の並び）。
import { lookup, must } from './array.ts';
import { sBubble, sChime, sDrip, sHiss, sRumble, sndReady } from './audio.ts';
import { G } from './glyphs.ts';
import { interAfter } from './levels.ts';
import { msg } from './log.ts';
import { dyn, spawn } from './particles.ts';
import { mulberry32 } from './rng.ts';
import { mpick, mr, sndRand } from './random.ts';
import { type Omen, adv, clock, here, player, ui } from './state.ts';
import { SPECIALS, stratumAtDepth } from './strata.ts';
import { CELL, FINAL_DEPTH, MW, TF, cpos } from './world.ts';

/** 漏れてくる物（色・立ちのぼる粒子の文字 gl と上がる速さ vy（負なら上から降る）・見た時の説明 look・音 snd・床の輝き glow・床の霜 frost） */
export interface OmenDef {
  col: readonly number[];
  gl?: readonly string[];
  vy?: number;
  look: string;
  snd: string;
  glow?: readonly number[];
  frost?: boolean;
}
/** 立ちのぼる粒子（rise）の決まり */
type Rise = { col: readonly number[]; gl: readonly string[]; vy: number };

/** 下り階段の先が別の層の時：その層から漏れてくる物 */
export const STRATUM_OMEN: Readonly<Record<string, OmenDef>> = {
  cavern: {
    col: [0.55, 0.85, 0.5],
    gl: [',', '.', "'"],
    vy: 0.5,
    look: '下から、湿った土と苔の匂いが上がってくる。遠くで、水の滴る音がする',
    snd: 'drip',
  },
  ruins: {
    col: [0.78, 0.64, 1.0],
    gl: ['.', 'ᛁ', 'ᚱ', 'ᛊ', ':'],
    vy: 0.35,
    look: '下から、古い石の冷たい空気が流れてくる。遠くで、鐘のような響きがする',
    snd: 'chime',
  },
  magma: {
    col: [1.0, 0.42, 0.12],
    gl: ['*', "'", '.'],
    vy: 0.9,
    look: '下から、熱い風が吹き上がってくる。床が赤く照らされている',
    snd: 'rumble',
    glow: [1.0, 0.35, 0.1],
  },
  abyss: {
    col: [0.55, 0.42, 0.95],
    gl: ['.', ':', '`'],
    vy: 0.25,
    look: '下から、冷たい闇が這い上がってくる。かすかな囁きが聞こえる',
    snd: 'whisper',
    glow: [0.35, 0.2, 0.7],
  },
};
/** 下り階段の先が特別な階の時 */
export const SPECIAL_OMEN: Readonly<Record<string, OmenDef>> = {
  town: { col: [1.0, 0.78, 0.45], gl: ['.', '*'], vy: 0.4, look: '下から、焚き火の匂いと、かすかな人の声がする', snd: 'drip' },
  bigroom: { col: [0.82, 0.84, 0.95], gl: ['.'], vy: 0.6, look: '下から、広い空間を渡る風の音がする', snd: 'wind' },
  oracle: { col: [1.0, 0.9, 0.55], gl: ['*', '.'], vy: 0.3, look: '下から、澄んだ鈴の音と、静かな水音が聞こえる', snd: 'chime' },
  fortress: {
    col: [1.0, 0.58, 0.25],
    gl: ['*', '.', "'"],
    vy: 0.7,
    look: '下から、熱気と、鉄を打つような響きが上がってくる',
    snd: 'rumble',
  },
};
/** 支道の入口と、支道の奥へ下りる階段のまわり */
export const BRANCH_OMEN: Readonly<Record<string, OmenDef>> = {
  crypt: { col: [0.62, 0.82, 1.0], look: '周りに骨が散らばり、冷たい霧が這い出している', snd: 'chant' },
  lair: { col: [1.0, 0.62, 0.32], look: '床に深い爪痕が刻まれている。奥から、温かい獣の息が漂ってくる', snd: 'growl' },
  sunken: { col: [0.45, 0.8, 0.98], look: '床が濡れて光っている。奥から、水の音と泡の弾ける音がする', snd: 'bubble' },
  nest: { col: [0.88, 0.88, 0.95], look: '蜘蛛の糸が絡みついている。奥で、何かがかさかさと動く', snd: 'scuttle' },
  snake: { col: [0.62, 0.86, 0.45], look: '脱ぎ捨てられた蛇の皮が落ちている。奥から、低いシューという音がする', snd: 'hiss' },
};
/** 異界の門 */
export const REALM_OMEN: Readonly<Record<string, OmenDef>> = {
  ice: {
    col: [0.75, 0.92, 1.0],
    gl: ['*', '.'],
    vy: -0.25,
    look: '門の周りの床に霜が降り、凍てついた冷気が流れ出している',
    frost: true,
    snd: 'wind',
  },
  lab: {
    col: [1.0, 0.45, 0.88],
    gl: ['ᛁ', 'ᚱ', 'ᛊ', '*'],
    vy: 0.2,
    look: '門の周りに、宙に浮かぶ文字の欠片と、魔法陣の光が漂っている',
    snd: 'chime',
  },
  volcano: { col: [1.0, 0.5, 0.15], gl: ["'", '.', '*'], vy: 0.6, look: '門の向こうから、灰と熱気が吹きつけてくる', snd: 'rumble' },
};
/** 特別な階の表を、無い key も読める形で（無ければ undefined） */
const specials: Readonly<Record<string, { k: string }>> = SPECIALS;

/** 今の階の手がかりを作る（支道の跡の位置は、マスと探索のシードで決める） */
export function computeOmen(): Omen {
  const D = must(here.D, '今の階 here.D');
  const o: Omen = { stairs: null, branch: null, portal: null, traces: [], sndT: {} };
  if (here.branch) {
    if (here.branch.lvl < here.branch.len)
      o.stairs = { kind: 'branch', key: here.branch.key, strong: here.branch.lvl + 1 === here.branch.len };
  } else if (!here.realm && D.stairs >= 0 && !D.finalVault && here.depth < FINAL_DEPTH) {
    const ik = !here.inter ? interAfter(here.depth) : null;
    if (ik) o.stairs = { kind: 'special', key: ik };
    else {
      const nd = here.depth + 1,
        a = here.inter ? specials[here.inter.key] : stratumAtDepth(here.depth),
        b = stratumAtDepth(nd);
      if (a && b && a.k !== b.k) o.stairs = { kind: 'stratum', key: b.k };
    }
  }
  if (D.bstairs) o.branch = { key: D.bstairs.key, cell: D.bstairs.cell };
  if (D.portal) o.portal = { key: D.portal.key, cell: D.portal.cell };
  const lay = (cell: number, key: string, strong: boolean): void => {
    const [cx, cz] = cpos(cell),
      n = strong ? 44 : 24,
      R = strong ? 6 : 4.2,
      rr = mulberry32((cell * 7919 + adv.runSeed) >>> 0);
    for (let k = 0; k < n; k++) {
      const a = rr() * 6.28,
        d = 0.9 + rr() * (R - 0.9),
        x = cx + Math.cos(a) * d,
        z = cz + Math.sin(a) * d,
        ci = ((z / CELL) | 0) * MW + ((x / CELL) | 0);
      if (ci < 0 || ci >= D.tile.length || D.tile[ci] !== TF) continue;
      o.traces.push({ x, z, key, r: rr(), a: rr() * 6.28 });
    }
  };
  if (o.branch) lay(o.branch.cell, o.branch.key, false);
  if (o.stairs && o.stairs.kind === 'branch') lay(D.stairs, o.stairs.key, o.stairs.strong);
  return o;
}
/** 今の階の手がかり（はじめて読んだ時に作って、階に覚える）。階がまだ無ければ null */
export const omenOf = (): Omen | null => (here.D ? here.D.omen || (here.D.omen = computeOmen()) : null);

/** 手がかりの小さな音（kind ごとの音。遠いほど小さい） */
export function omenSound(kind: string, x: number, z: number): void {
  if (!sndReady()) return;
  const d = Math.hypot(x - player.x, z - player.z),
    v = Math.max(0.05, 1 - d / 10);
  if (kind === 'drip') sDrip(x, z, 0.4 * v);
  else if (kind === 'chime' || kind === 'chant') sChime(x, z, 0.22 * v);
  else if (kind === 'rumble' || kind === 'growl') sRumble(0.18 * v, kind === 'growl' ? 0.9 : 1.6);
  else if (kind === 'whisper' || kind === 'wind' || kind === 'hiss') sHiss(x, z, kind === 'hiss' ? 0.7 : 1.4);
  else if (kind === 'bubble') sBubble(x, z, 0.3 * v);
  else if (kind === 'scuttle') sHiss(x, z, 0.18);
}

/** 手がかりを描く（図鑑を見ている間は描かない）：階段から立ちのぼる物と床の輝き、門のまわりの光と霜、支道の跡、それぞれの音（場所ごとに 6 から 11 秒あける） */
export function drawOmens(t: number, dt: number): void {
  if (!here.D || ui.gallery) return;
  const o = omenOf();
  if (!o) return;
  const D = here.D;
  const near = (x: number, z: number, r: number): boolean => Math.hypot(x - player.x, z - player.z) < r,
    rate = (n: number): boolean => mr() < n * (dt || 0.016);
  // 立ちのぼる粒子を、1秒に n 個ほど出す（決まりに gl・vy が無ければ、元と同じく、ここで止まるか NaN になる）
  const rise = (x: number, z: number, def: OmenDef | Rise, n: number, spread?: number): void => {
    if (!rate(n)) return;
    const vy = def.vy ?? NaN,
      a = mr() * 6.28,
      rr = mr() * (spread || 0.7),
      down = vy < 0;
    spawn(
      x + Math.cos(a) * rr,
      down ? 2.2 + mr() * 0.6 : 0.15,
      z + Math.sin(a) * rr,
      (mr() - 0.5) * 0.15,
      vy * (0.7 + mr() * 0.6),
      (mr() - 0.5) * 0.15,
      2.4 + mr(),
      G(mpick(must(def.gl, '立ちのぼる粒子の文字'))),
      0.12,
      (def.col[0] ?? NaN) * 1.3,
      (def.col[1] ?? NaN) * 1.3,
      (def.col[2] ?? NaN) * 1.3,
      0,
    );
  };
  const sound = (key: string, kind: string, x: number, z: number): void => {
    if (!kind || !near(x, z, 10)) return;
    if (clock.time < (o.sndT[key] || 0)) return;
    o.sndT[key] = clock.time + 6 + sndRand() * 5;
    omenSound(kind, x, z);
  };
  // 階段：下にある物が漏れてくる
  if (o.stairs && o.stairs.kind !== 'branch') {
    const def = o.stairs.kind === 'special' ? SPECIAL_OMEN[o.stairs.key] : STRATUM_OMEN[o.stairs.key];
    const [x, z] = cpos(D.stairs);
    if (def && near(x, z, 20)) {
      rise(x, z, def, 3.2);
      if (def.glow)
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + t * 0.1,
            b = 0.5 + 0.25 * Math.sin(t * 1.7 + k);
          dyn(
            x + Math.cos(a) * 1.3,
            0.04,
            z + Math.sin(a) * 1.3,
            G('.'),
            0.15,
            (def.glow[0] ?? NaN) * b,
            (def.glow[1] ?? NaN) * b,
            (def.glow[2] ?? NaN) * b,
            0,
            0,
          );
        }
      sound('st', def.snd, x, z);
    }
  }
  // 異界の門：その異界の光
  if (o.portal) {
    const def = REALM_OMEN[o.portal.key],
      [x, z] = cpos(o.portal.cell);
    if (def && near(x, z, 20)) {
      rise(x, z, def, 3, 1.0);
      if (def.frost)
        for (let k = 0; k < 20; k++) {
          const a = k * 2.399,
            r = 0.8 + (k % 5) * 0.3;
          dyn(x + Math.cos(a) * r, 0.03, z + Math.sin(a) * r, G(k % 3 ? '.' : '*'), 0.13, 0.55, 0.7, 0.85, 0, 0);
        }
      sound('po', def.snd, x, z);
    }
  }
  // 支道の入口と、支道の奥へ下りる階段のまわりの跡
  for (const tr of o.traces) {
    if (!near(tr.x, tr.z, 18)) continue;
    const k = tr.key,
      r = tr.r;
    if (k === 'crypt') {
      dyn(tr.x, 0.03, tr.z, G(r < 0.15 ? 'O' : r < 0.5 ? mpick(['(', ')']) : r < 0.8 ? '=' : 'o'), 0.15, 0.62, 0.6, 0.55, 0, 0);
    } else if (k === 'lair') {
      if (r < 0.45) {
        for (let q = 0; q < 3; q++)
          dyn(tr.x + Math.cos(tr.a) * q * 0.1, 0.03, tr.z + Math.sin(tr.a) * q * 0.1, G('/'), 0.15, 0.55, 0.4, 0.3, 0, 0);
      } else if (r < 0.8) dyn(tr.x, 0.04, tr.z, G('"'), 0.14, 0.5, 0.36, 0.22, 0, 0);
      else dyn(tr.x, 0.03, tr.z, G('%'), 0.16, 0.18, 0.12, 0.09, 0, 0);
    } else if (k === 'sunken') {
      const b = 0.45 + 0.15 * Math.sin(t * 1.5 + tr.a);
      dyn(tr.x, 0.03, tr.z, G('~'), 0.16, 0.25 * b * 2, 0.5 * b * 2, 0.7 * b * 2, 0, 0);
      if (rate(0.25)) spawn(tr.x, 0.05, tr.z, 0, 0.35, 0, 1.0, G('o'), 0.08, 0.5, 0.8, 1.0, 0);
    } else if (k === 'nest') {
      if (r < 0.55) dyn(tr.x, 0.03, tr.z, G(mpick(['-', '/', '\\'])), 0.15, 0.5, 0.5, 0.55, 0, 0);
      else if (r < 0.85) {
        for (let q = 0; q < 3; q++) dyn(tr.x, 1.4 + q * 0.35, tr.z, G('|'), 0.13, 0.45, 0.45, 0.5, 0, 0);
      } else {
        const a = t * 1.5 + tr.a;
        dyn(tr.x + Math.cos(a) * 0.3, 0.05, tr.z + Math.sin(a) * 0.3, G('x'), 0.11, 0.5, 0.45, 0.4, 0, 0);
      }
    } else if (k === 'snake') {
      if (r < 0.6) {
        for (let q = 0; q < 4; q++)
          dyn(
            tr.x + Math.cos(tr.a) * q * 0.13,
            0.03,
            tr.z + Math.sin(tr.a) * q * 0.13 + Math.sin(q * 1.6) * 0.05,
            G(q % 2 ? 's' : '~'),
            0.14,
            0.62,
            0.6,
            0.42,
            0,
            0,
          );
      } else dyn(tr.x, 0.03, tr.z, G(','), 0.14, 0.3, 0.5, 0.24, 0, 0);
    }
  }
  if (o.branch) {
    const [x, z] = cpos(o.branch.cell),
      k = o.branch.key;
    if (near(x, z, 18)) {
      if (k === 'crypt') rise(x, z, { col: [0.45, 0.6, 0.8], gl: ['~', '.'], vy: 0.08 }, 1.5, 1.2);
      if (k === 'lair') rise(x, z, { col: [0.6, 0.45, 0.32], gl: ['~'], vy: 0.15 }, 0.8, 0.6);
      sound('br', lookup(BRANCH_OMEN, k).snd, x, z);
    }
  }
  if (o.stairs && o.stairs.kind === 'branch') {
    const [x, z] = cpos(D.stairs),
      k = o.stairs.key;
    if (near(x, z, 18)) {
      if (k === 'crypt') rise(x, z, { col: [0.45, 0.6, 0.8], gl: ['~', '.'], vy: 0.08 }, o.stairs.strong ? 3 : 1.5, 1.4);
      sound('st', lookup(BRANCH_OMEN, k).snd, x, z);
    }
  }
}

/** 階段が封じられているか（階段の前の部屋の群れが、まだ生きている）。階が無ければ null */
export const stairsGuarded = (): boolean | null =>
  here.D && here.D.stairGuard !== undefined && here.monsters.some((m) => !m.dead && m.g === must(here.D, '今の階 here.D').stairGuard);

/** 封じられた階段の封を描く（26 より遠ければ描かない。12 より近いと、ときどきうなり声）。封が解けたら、一度だけ伝言と音 */
export function drawStairSeal(t: number): void {
  if (!here.D || here.D.stairGuard === undefined) return;
  const D = here.D;
  const [x, z] = cpos(D.stairs);
  const d = Math.hypot(x - player.x, z - player.z);
  if (d > 26) return;
  const on = stairsGuarded();
  if (on) {
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + t * 0.4,
        b = 0.7 + 0.3 * Math.sin(t * 2 + k);
      dyn(
        x + Math.cos(a) * 0.9,
        0.3 + 0.12 * Math.sin(t * 1.5 + k),
        z + Math.sin(a) * 0.9,
        G(k % 3 ? '=' : '#'),
        0.18,
        1.4 * b,
        0.4 * b,
        0.55 * b,
        0,
        0,
      );
    }
    if (d < 12 && clock.time > (D.sealSnd || 0)) {
      D.sealSnd = clock.time + 7 + sndRand() * 4;
      omenSound('growl', x, z);
    }
  } else if (!D.sealOpenMsg) {
    D.sealOpenMsg = true;
    msg('<b style="color:#ffd27a">=</b>階段を閉ざしていた封が、静かに解けた。');
    sChime(x, z, 0.4);
  }
}
