// テストの道具：ミニマップ（src/lib/minimap.ts の sizeMap・drawMap）を、たくさんの場合で呼び、描き手にしたことを1つの文字列にまとめる。
// F は関数をまとめた物。minimap.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階のマスに、地面・液体・橋・鉱脈・水晶・穴・扉（開き・閉じ・焼け落ち）・火・灰・踏み分けた茂み・毒の霧・備品・飾りを散らし、
// 床の物・罠・鉄格子・クモの巣・生き物（見えている・化けている・透明で近い・遠い）を足して、見たマス・今見えているマス・覚えた色を決め、
// プレイヤー（マップの端も）の位置と向き・手元の灯りを変えて、drawMap を呼ぶ。sizeMap は、画面の倍率を変えて呼ぶ。
// 記録するのは、偽の描き手にした全部のこと（欄に書いた値と、呼んだ関数と引数。数は丸めない）・キャンバスの大きさ・描いた後の覚えた色 here.mem。
// テストを .mjs で書くのは、偽の描き手とキャンバスを、本物の型に合わせられないため。書き換えた状態と window は、終わったら元に戻す。
import { MTYPES } from '../../src/lib/creatures.ts';
import { TRAP_INFO } from '../../src/lib/names.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { blaze, here, lantern, player, ui } from '../../src/lib/state.ts';
import {
  CELL,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MH,
  MW,
  NCELL,
  SF_BRIM,
  SF_DEAD,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_HAY,
  SF_ICE,
  SF_LUMEN,
  SF_MUD,
  SF_OBSIDIAN,
  SF_RUBBLE,
  TC,
  TF,
  TP,
  TW,
  TX,
} from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';

const PROPS = ['fillStyle', 'shadowColor', 'shadowBlur', 'font', 'textAlign', 'textBaseline'],
  METHODS = ['clearRect', 'fillRect', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'arc', 'closePath', 'fill', 'setTransform'];
/** 偽のキャンバスと描き手。描き手にしたことを log に1行ずつ書く（数は String のまま。丸めない） */
export function fakeCanvas() {
  const log = [],
    ctx = {},
    vals = {};
  let grads = 0;
  for (const p of PROPS)
    Object.defineProperty(ctx, p, {
      get: () => vals[p],
      set: (v) => {
        vals[p] = v;
        log.push(`${p}=${typeof v === 'string' || typeof v === 'number' ? String(v) : v.id}`);
      },
    });
  for (const m of METHODS) ctx[m] = (...a) => void log.push(`${m}(${a.map(String).join(',')})`);
  ctx.createRadialGradient = (...a) => {
    const id = `grad${++grads}`;
    log.push(`${id}=createRadialGradient(${a.map(String).join(',')})`);
    return { id, addColorStop: (o, c) => void log.push(`${id}.addColorStop(${o},${c})`) };
  };
  const canvas = { width: 300, height: 150, getContext: (k) => (k === '2d' ? ctx : null) };
  return { canvas, ctx, log };
}

/** seeds：drawMap の場合の数。canvas：fakeCanvas() の結果（古い JS も新しい関数も、同じ物に描く） */
export async function minimapCases(F, fake, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { D: here.D, monsters: here.monsters, explored: here.explored, mem: here.mem, fovVis: here.fovVis, fovStamp: here.fovStamp },
    blaze: { fire: blaze.fire, burnt: blaze.burnt, cellFlag: blaze.cellFlag, fireLight: blaze.fireLight },
    player: { ...player },
    lantern: { ...lantern },
    lord: MTYPES['lord'],
    X: MTYPES['X'],
  };
  const win = { devicePixelRatio: 1 },
    restoreGlobals = swapGlobals({ window: win });
  try {
    // 画面の倍率（無い・小さい・2 を越える物も）
    for (const dpr of [undefined, 0, 0.5, 1, 1.25, 1.5, 2, 3]) {
      fake.log.length = 0;
      win.devicePixelRatio = dpr;
      F.sizeMap();
      out.push(`sizeMap ${dpr} ${fake.canvas.width}x${fake.canvas.height} ${fake.log.join(' ')}`);
    }
    const trapKinds = Object.keys(TRAP_INFO);
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 69069 + 7),
        pick = (a) => a[Math.floor(r() * a.length)];
      const place = PLACES[(s * 5) % PLACES.length];
      const res = gen(env, (r() * 4294967296) >>> 0, place, 42 + s);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      const D = res.level;
      here.D = D;
      // マスの中身を散らす（どの分かれ道も通るように）
      blaze.fire = new Float32Array(NCELL);
      blaze.burnt = new Uint8Array(NCELL);
      blaze.cellFlag = new Uint8Array(NCELL);
      blaze.fireLight = new Float32Array(NCELL);
      const floors = [],
        walls = [];
      for (let i = 0; i < NCELL; i++) (D.tile[i] === TF ? floors : D.tile[i] === TW ? walls : []).push(i);
      const surfs = [SF_ICE, SF_RUBBLE, SF_DEAD, SF_OBSIDIAN, SF_FOLIAGE, SF_FUNGFOR, SF_BRIM, SF_MUD, SF_HAY, SF_GRASS, SF_LUMEN, 0];
      const liqs = [LQ_DEEP, LQ_BOG, LQ_LAVA, LQ_WATER, 0];
      for (let k = 0; k < 400; k++) {
        const i = pick(floors),
          q = r();
        if (q < 0.3) D.surface[i] = pick(surfs);
        else if (q < 0.45) D.liquid[i] = pick(liqs);
        else if (q < 0.5) D.bridge[i] = 1;
        else if (q < 0.6) blaze.fire[i] = r() < 0.2 ? 0.04 : r() * 1.5;
        else if (q < 0.7) blaze.burnt[i] = 1;
        else if (q < 0.75) blaze.cellFlag[i] = r() < 0.7 ? 20 : 3;
        else if (q < 0.82) D.gas[i] = r() < 0.2 ? 0.07 : r() * 1.2;
        else if (q < 0.86) D.fixCell.set(i, { ch: pick(['&', '#', '!']), col: [r(), r(), r()] });
        else if (q < 0.9) D.decoCell.set(i, { ch: pick(['%', '=', '[']), col: [r(), r(), r()] });
        else if (q < 0.93) D.tile[i] = pick([TP, TC, TX]);
        else if (q < 0.96) {
          D.tile[i] = TX;
          if (r() < 0.5) D.xtalCol.set(i, [r(), r(), r()]);
        } else blaze.fireLight[i] = r() * 2;
      }
      for (let k = 0; k < 40; k++) D.vein[pick(walls)] = r() < 0.5 ? 1 : 2;
      // 灰は、床でないマス（階段など）にも置く（灰の印は床のマスにだけ描く）
      for (let k = 0; k < 60; k++) blaze.burnt[Math.floor(r() * NCELL)] = 1;
      // 崩れた穴（newLevel がマスの数の配列を作る。無い階も通す）
      if (r() < 0.7) {
        D.pit = new Uint8Array(NCELL);
        for (let k = 0; k < 30; k++) D.pit[pick(floors)] = 1;
      } else delete D.pit;
      for (const d of D.doors) {
        d.o = r();
        if (r() < 0.3) d.gone = true;
      }
      // 床の物・罠・鉄格子・クモの巣
      for (let k = 0; k < 10; k++)
        D.items.push({ i: pick(floors), kind: 'rune', taken: r() < 0.2, rune: r() < 0.7 ? { uid: k, type: 'bolt' } : null });
      for (const t of D.traps) t.hidden = r() < 0.4;
      for (const type of trapKinds) if (r() < 0.6) D.traps.push({ i: pick(floors), type, hidden: r() < 0.3, used: false });
      if (r() < 0.6) D.gate = { cell: pick(floors), lever: pick(floors), ld: 0, open: r() < 0.5, o: 0, axis: 0 };
      else if (r() < 0.5) D.gate = null;
      for (let k = 0; k < 6; k++) D.webs.push({ i: pick(floors), ax: 0, gone: r() < 0.3 });
      // プレイヤー（マップの端も）
      const c = r() < 0.2 ? pick([0, MW - 1, (MH - 1) * MW, NCELL - 1, MW * 3 + 2]) : pick(floors);
      Object.assign(player, {
        x: ((c % MW) + r()) * CELL,
        z: (Math.floor(c / MW) + r()) * CELL,
        yaw: (r() - 0.5) * 14,
      });
      Object.assign(lantern, { r: 1 + r() * 10, k: r() * 1.5 });
      // 見たマス・今見えているマス・覚えた色
      here.explored = new Uint8Array(NCELL);
      here.mem = new Float32Array(NCELL * 3);
      here.fovVis = new Uint32Array(NCELL);
      here.fovStamp = 1 + Math.floor(r() * 50);
      const mode = s % 3,
        pcx = player.x / CELL,
        pcz = player.z / CELL;
      for (let i = 0; i < NCELL; i++) {
        const near = Math.hypot((i % MW) - pcx, Math.floor(i / MW) - pcz) < 12;
        if (mode === 0 || (mode === 1 && r() < 0.6) || (mode === 2 && near)) here.explored[i] = 1;
        if (near && r() < 0.8) here.fovVis[i] = here.fovStamp;
        else if (r() < 0.1) here.fovVis[i] = here.fovStamp - 1;
        if (r() < 0.7) for (let k = 0; k < 3; k++) here.mem[i * 3 + k] = r() * 2;
      }
      // 生き物
      const kinds = Object.keys(MTYPES).filter((k) => MTYPES[k] && !MTYPES[k].dummy),
        ghosts = kinds.filter((k) => MTYPES[k].invisible);
      here.monsters = Array.from({ length: Math.floor(r() * 16) }, () => {
        const key = r() < 0.2 && ghosts.length ? pick(ghosts) : pick(kinds),
          far = r() < 0.3;
        const x = far ? r() * MW * CELL : player.x + (r() - 0.5) * 14,
          z = far ? r() * MH * CELL : player.z + (r() - 0.5) * 14;
        return { key, ty: MTYPES[key], x, z, cx: Math.floor(x / CELL), cz: Math.floor(z / CELL), visible: r() < 0.6, hidden: r() < 0.15 };
      });
      fake.log.length = 0;
      F.drawMap();
      out.push(`drawMap ${s}\n${fake.log.join('\n')}\nmem ${Array.from(here.mem).join(',')}`);
    }
  } finally {
    restoreGlobals();
    Object.assign(here, keep.here);
    Object.assign(blaze, keep.blaze);
    Object.assign(player, keep.player);
    Object.assign(lantern, keep.lantern);
    for (const k of ['lord', 'X'])
      if (keep[k]) MTYPES[k] = keep[k];
      else delete MTYPES[k];
  }
  return out.join('\n');
}
