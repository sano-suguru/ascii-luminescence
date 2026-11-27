// テストの道具：手元の武器（src/lib/hands.ts の形と色の表と VM_FIST、src/lib/held.ts の drawViewWeapons）を、たくさんの場合で呼び、
// 結果を1つの文字列にまとめる。F は関数と表をまとめた物。hands.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、プレイヤーを床のマス・マップの外に置き、壁・閉じた扉・開いた扉・燃え尽きた扉・マップの外へ、いろいろな距離で向け（手元の武器が縮む所）、
// 画面の横と縦の比・両手の武器（全部の種類、武器が無い、表に無い種類、両手持ち）・性質・詠唱（どちらの手か・溜めの途中・弦を引く手が出る 0.05 の前後・溜めきって持ち続ける・要る時間 0）・
// 振る（swing の 0 から 0.22 の前後と、どちらの手か）・撃った跳ね（vmKick の 0.16 秒の境の前後・0 の時刻・昔）・速さ・時刻を変えて、drawViewWeapons を呼ぶ。
// 描かずに戻る分かれ道（3人称・始まる前・死んだ・手が無い・階が無い・図鑑で獣を出している間。試しの間では描く）も通す。
// 記録するのは、置いた文字の全部（位置・色・文字と大きさ。丸めない）・出した粒子の全部・その後の見た目の乱数1つと、表（形・色・明るさ・握った手）の JSON。
// テストを .mjs で書くのは、偽のカメラを本物の型に合わせられないためと、古い JS の関数と同じ台本で比べるため。書き換えた状態は、終わったら元に戻す。
import { dCol, dPar, dPos, P } from '../../src/lib/particles.ts';
import { mr, withVisualRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { adv, buf, clock, gear, gfx, here, player, ui, vmKick } from '../../src/lib/state.ts';
import { CELL, MH, MW, NCELL, TF, TW } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';

const WEAPONS = ['blade', 'bolt', 'orb', 'beam', 'dash', 'rain', 'rapid', 'star', 'gsword', 'mstaff'];
const TWO = ['bolt', 'rain', 'gsword', 'mstaff'];
const ELEMS = [null, undefined, 'fire', 'ice', 'thunder', 'poison'];

/** 表を JSON に（形・色・明るさ・握った手を、決まった2つの点で作った物） */
export function handsTables(F) {
  const o1 = [],
    o2 = [];
  F.VM_FIST(o1, [0.1, -0.2, 0.6]);
  F.VM_FIST(o2, [-0.31, -0.45, 0.52]);
  return JSON.stringify({
    models: F.VM_MODELS,
    part: F.VM_PART,
    bright: F.VM_BRIGHT,
    rest: [F.VM_REST, F.VM_REST_HOT],
    tint: F.VM_TINT,
    fist: [o1, o2],
  });
}

/** seeds：場合の数 */
export async function handsCases(F, seeds) {
  const env = await loadEnv(),
    out = [handsTables(F)];
  const keep = {
    here: { D: here.D },
    player: { ...player },
    gear: { hands: gear.hands, castSt: gear.castSt },
    ui: { camMode: ui.camMode, started: ui.started, gallery: ui.gallery },
    adv: { dead: adv.dead },
    clock: { time: clock.time },
    gfx: { camera: gfx.camera },
    vmKick: { ...vmKick },
    buf: { ...buf },
  };
  // 階（場合ごとに作ると遅いので、いくつかを使い回す。扉の開き具合は場合ごとに書き換える）
  const levels = [0, 1, 2, 3, 4].map((k) => gen(env, 8100 + k * 37, PLACES[(k * 7) % PLACES.length]).level);
  let uid = 1;
  const rune = (type) => ({ uid: uid++, type });
  try {
    for (let s = 0; s < seeds; s++) {
      const R = mulberry32(6100 + s * 31),
        pick = (a) => a[Math.floor(R() * a.length)];
      const D = levels[s % levels.length];
      here.D = D;
      for (const d of D.doors) {
        d.o = R() < 0.5 ? 0 : R() < 0.5 ? 0.49 : 1;
        d.gone = R() < 0.15;
      }
      // プレイヤーの位置と向き
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) floors.push(i);
      const mode = s % 6;
      let yaw = R() * Math.PI * 2,
        px,
        pz;
      if (mode <= 1) {
        // 壁の手前：東西南北のどれかが壁の床に立ち、その向きへ、壁から決まった距離に
        const dirs = [
          [1, 0, -Math.PI / 2],
          [-1, 0, Math.PI / 2],
          [0, 1, Math.PI],
          [0, -1, 0],
        ];
        let c, dir;
        for (let tries = 0; tries < 500; tries++) {
          c = pick(floors);
          dir = pick(dirs);
          const n = c + dir[0] + dir[1] * MW;
          if (D.tile[n] === TW) break;
        }
        const dist = pick([0.01, 0.05, 0.12, 0.2, 0.35, 0.5, 0.6, 0.69, 0.7, 0.9, 1.5]);
        const cx = ((c % MW) + 0.5) * CELL,
          cz = (Math.floor(c / MW) + 0.5) * CELL;
        px = cx + dir[0] * (CELL / 2 - dist) + (dir[1] ? (R() - 0.5) * 1.5 : 0);
        pz = cz + dir[1] * (CELL / 2 - dist) + (dir[0] ? (R() - 0.5) * 1.5 : 0);
        yaw = dir[2] + (R() - 0.5) * 0.6;
      } else if (mode === 2 && D.doors.length) {
        // 扉に向かう（扉のマスの真ん中へ、少し離れた所から）
        const d = pick(D.doors),
          a = R() * Math.PI * 2,
          r = 0.9 + R() * 0.9;
        const dx = ((d.i % MW) + 0.5) * CELL,
          dz = (Math.floor(d.i / MW) + 0.5) * CELL;
        px = dx + Math.cos(a) * r;
        pz = dz + Math.sin(a) * r;
        yaw = Math.atan2(-(dx - px), -(dz - pz));
      } else if (mode === 3) {
        // マップの外とそば：上の外（マスの番号が負）・下の外（NCELL 以上）・下の外の左の端（NCELL ちょうど）・左右にはみ出す（前の行・次の行のマスになる）・端の行の中
        const k = Math.floor(s / 6) % 6;
        px = k === 2 ? 1 : k === 3 ? -0.2 : k === 4 ? MW * CELL + 0.2 : 2 + R() * (MW - 2) * CELL;
        pz = k === 0 ? -0.3 : k === 1 ? MH * CELL + 0.3 : k === 2 ? MH * CELL + 0.01 : k === 5 ? 0.3 : 2 + R() * (MH - 2) * CELL;
        yaw = k === 0 || k === 5 ? 0 : k === 1 || k === 2 ? Math.PI : k === 3 ? Math.PI / 2 : -Math.PI / 2;
        yaw += (R() - 0.5) * 0.2;
      } else {
        const c = pick(floors);
        px = ((c % MW) + R()) * CELL;
        pz = (Math.floor(c / MW) + R()) * CELL;
      }
      const pitch = (R() - 0.5) * 1.2,
        eye = 1.2 + R() * 0.6;
      Object.assign(player, {
        x: px,
        z: pz,
        yaw,
        pitch,
        eye,
        vx: pick([undefined, 0, 0.5, 2, 4, 7]),
        vz: pick([undefined, 0, -1, 3]),
        swing: pick([undefined, 0, -0.1, 0.001, 0.05, 0.11, 0.2, 0.22, 0.3]),
        swingH: pick(['L', 'R', undefined]),
      });
      gfx.camera = {
        position: { x: px, y: eye, z: pz, set: () => undefined },
        rotation: { set: () => undefined },
        aspect: pick([undefined, 0, 0.5, 1, 16 / 9, 2.4]),
      };
      // 両手
      const tw = s % 3 === 0 ? pick(TWO) : null;
      const hand = (side) => {
        const atkT = pick([...WEAPONS, ...WEAPONS, null, 'fire']),
          el = pick(ELEMS);
        return { atk: atkT ? rune(atkT) : null, slots: [null, null], slotN: 2, turn: 0, elem: el ? rune(el) : el, trig: null, side };
      };
      const L = hand('L'),
        Rh = hand('R');
      if (tw) {
        L.atk = Rh.atk = rune(tw);
        if (s % 2) Rh.elem = rune(pick(['fire', 'ice', 'thunder', 'poison']));
      }
      gear.hands = { L, R: Rh, B: { b0: null, b1: null } };
      // 詠唱（10 に 1 つは、弓を両手で持ち、弦を引く手が出る 0.05 の前後と、光る矢の文字の数が丸めで変わりやすい所まで溜めた所）
      const cs = s % 4,
        nock = s % 10 === 9;
      if (nock) {
        L.atk = Rh.atk = rune(pick(['bolt', 'rain']));
      }
      gear.castSt =
        cs === 0 && !nock
          ? null
          : {
              h: pick(['L', 'R']),
              t: nock ? pick([0.024, 0.025, 0.026, 0.03, 0.2, 0.2825, 0.4375]) : pick([0, 0.005, 0.025, 0.026, 0.1, 0.5, 1, 2]),
              need: nock ? 0.5 : pick([0, 0.005, 0.5, 1, 1.5]),
              full: R() < 0.5,
              hold: pick([0, 0.5, 2, 3]),
              beam: false,
              firing: false,
              tick: 0,
              beamT: 0,
            };
      // 時刻と跳ね
      clock.time = pick([0, 0.05, 3.7, 12.25, 80.5]);
      const kickOf = () => pick([0, -9, clock.time, clock.time - 0.08, clock.time - 0.159, clock.time - 0.161, clock.time - 1]);
      vmKick.L = kickOf();
      vmKick.R = kickOf();
      const t = R() < 0.5 ? clock.time : R() * 20;
      // 分かれ道
      Object.assign(ui, { camMode: 'fps', started: true, gallery: null });
      adv.dead = false;
      const br = s % 23;
      if (br === 1) ui.camMode = 'tps';
      else if (br === 2) ui.started = false;
      else if (br === 3) adv.dead = true;
      else if (br === 4) gear.hands = null;
      else if (br === 5) here.D = null;
      else if (br === 6) ui.gallery = { mode: 'beast' };
      else if (br === 7) ui.gallery = { mode: 'range' };
      buf.dn = 0;
      buf.pN = 0;
      let after = 0;
      withVisualRand(mulberry32(900 + s), () => {
        F.drawViewWeapons(t);
        after = mr();
      });
      const head = {
        s,
        br,
        x: px,
        z: pz,
        yaw,
        L: gear.hands && [gear.hands.L.atk?.type, gear.hands.L.elem?.type],
        R: gear.hands && [gear.hands.R.atk?.type, gear.hands.R.elem?.type],
        cast: gear.castSt,
        swing: [player.swing, player.swingH],
        kick: [vmKick.L, vmKick.R],
        time: clock.time,
        t,
        aspect: gfx.camera.aspect,
      };
      const lines = [`case ${JSON.stringify(head)} dn=${buf.dn} pN=${buf.pN} after=${after}`];
      for (let i = 0; i < buf.dn; i++)
        lines.push(
          `d ${dPos[i * 3]},${dPos[i * 3 + 1]},${dPos[i * 3 + 2]} ${dCol[i * 3]},${dCol[i * 3 + 1]},${dCol[i * 3 + 2]} ${dPar[i * 4]},${dPar[i * 4 + 1]},${dPar[i * 4 + 2]},${dPar[i * 4 + 3]}`,
        );
      for (let i = 0; i < buf.pN; i++)
        lines.push(
          `p ${Object.keys(P)
            .map((k) => P[k][i])
            .join(',')}`,
        );
      out.push(lines.join('\n'));
    }
  } finally {
    here.D = keep.here.D;
    // 場合で足した欄（swing など、初めは無かった物）も消して、元の形に戻す
    for (const k of Object.keys(player)) if (!(k in keep.player)) delete player[k];
    Object.assign(player, keep.player);
    Object.assign(gear, keep.gear);
    Object.assign(ui, keep.ui);
    Object.assign(adv, keep.adv);
    Object.assign(clock, keep.clock);
    Object.assign(gfx, keep.gfx);
    Object.assign(vmKick, keep.vmKick);
    Object.assign(buf, keep.buf);
  }
  return out.join('\n');
}
