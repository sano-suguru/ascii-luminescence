// テストの道具：霧と目の慣れ・3人称の自分の姿・岩の断面（src/lib/camera.ts の updateAtmosphere・updateAvatar・rockAt・drawSection）を、たくさんの場合で呼び、
// 結果を1つの文字列にまとめる。F は関数をまとめた物。camera.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階の層の種類（洞・遺跡・そのまま）と洞窟の部屋を決め、プレイヤーを部屋・通路・マップの端に置き、近くの生き物（5 の内と外）・備品（3 の内と外、
// 溶岩・噴いている火口と噴いていない火口）・火の明かり・図鑑の目を合わせる段・1人称と3人称・目の高さ（水中。1人称で 0.62 より低い時も）・画面の光りを変えて、何フレームか updateAtmosphere を呼ぶ
// （途中で暗い所・明るい所へ動かし、目が両方の向きに慣れるようにする）。updateAvatar は、姿が無い時・速さ（0.3 の前後）・振る・転がる・目の低さ・傷の光りを変えて呼ぶ。
// rockAt はマップの外・壁・天井と床の境・裂け目の点を、drawSection は3人称のカメラの位置（無い・頭の近く・壁の中）を変えて呼ぶ。
// 記録するのは、偽の uniform の値・目の慣れ vfx.expo・画面の光り・図鑑の段・自分の姿の欄と形の指紋・岩か・置いた文字（数を丸めない）・その後の見た目の乱数1つ。
// テストを .mjs で書くのは、偽の uniform を本物の型に合わせられないためと、古い JS の関数と同じ台本で比べるため。書き換えた状態は、終わったら元に戻す。
import { buf } from '../../src/lib/state.ts';
import { dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { mr, withVisualRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { blaze, gfx, here, player, ui, vfx } from '../../src/lib/state.ts';
import { CELL, MH, MW, NCELL, TC, TF, TW, TX } from '../../src/lib/world.ts';
import { PLACES, gen, loadEnv } from './gen-places.ts';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** seeds：場合の数 */
export async function cameraCases(F, seeds) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { D: here.D, monsters: here.monsters, fixtures: here.fixtures },
    blaze: { fireLight: blaze.fireLight },
    player: { ...player },
    ui: { gallery: ui.gallery, camMode: ui.camMode, camPos: ui.camPos, avatar: ui.avatar },
    vfx: { ...vfx },
    gfx: { U: gfx.U, finalPass: gfx.finalPass, fogBase: gfx.fogBase },
    buf: { ...buf },
  };
  const U = { uFogDen: { value: 0.05 } },
    fp = { uniforms: { uExposure: { value: 1.1 }, uHeat: { value: 0 }, uSwim: { value: 0 } } };
  Object.assign(gfx, { U, finalPass: fp });
  vfx.expo = 1.1;
  const atmo = () =>
    `fog=${U.uFogDen.value} expo=${vfx.expo} exp=${fp.uniforms.uExposure.value} heat=${fp.uniforms.uHeat.value} swim=${fp.uniforms.uSwim.value} flash=${vfx.flash} settle=${ui.gallery ? ui.gallery.settle : '-'}`;
  try {
    for (let s = 0; s < seeds; s++) {
      const place = PLACES[s % PLACES.length],
        R = mulberry32(5300 + s * 17);
      const D = gen(env, 7000 + s * 11, place).level;
      withVisualRand(mulberry32(31 + s), () => {
        D.stratum = { ...D.stratum, k: ['cavern', 'ruins', D.stratum.k, 'cavern'][s % 4] };
        D.rooms = D.rooms.map((r, i) => ({ ...r, cave: s % 3 === 0 ? true : s % 3 === 1 ? false : i % 2 === 0 }));
        here.D = D;
        gfx.fogBase = 0.05 + (s % 7) * 0.002;
        // プレイヤー：部屋の中・通路（部屋の外）・マップの端
        const inRoom = [],
          outRoom = [];
        for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) (D.roomOf[i] >= 0 ? inRoom : outRoom).push(i);
        const put = (k) => {
          const list = k === 0 ? inRoom : outRoom.length ? outRoom : inRoom,
            pc = list[Math.floor(R() * list.length)];
          player.x = ((pc % MW) + R()) * CELL;
          player.z = (Math.floor(pc / MW) + R()) * CELL;
        };
        put(s % 2);
        // 火の明かり（まわりの明るさ）
        blaze.fireLight = new Float32Array(NCELL);
        const pcx = Math.floor(player.x / CELL),
          pcz = Math.floor(player.z / CELL);
        if (s % 4 === 1)
          for (let k = 0; k < 9; k++)
            blaze.fireLight[Math.max(0, pcz - 1 + (k % 3)) * MW + Math.max(0, pcx - 1 + Math.floor(k / 3))] = 0.5 + R();
        // 近くの生き物と備品
        const at = (d) => {
          const a = R() * Math.PI * 2;
          return { x: player.x + Math.cos(a) * d, z: player.z + Math.sin(a) * d };
        };
        here.monsters = [0, 2.5, 4.99, 5, 5.01, 7].slice(0, 1 + (s % 6)).map((d) => ({ ...at(d), ty: { name: 'x' } }));
        here.fixtures = [
          { type: 'torch', ...at(1) },
          { type: 'torch', ...at(2.99) },
          { type: 'brazier', ...at(3.01) },
          { type: 'lava', ...at(4 + (s % 7)) },
          { type: 'crater', active: s % 2 === 0, ...at(2 + (s % 9)) },
          { type: 'crater', active: false, ...at(1) },
          { type: 'lava', ...at(10.5) },
        ].slice(0, s % 8);
        ui.gallery = s % 5 === 1 ? { mode: 'beast', settle: 2 } : s % 5 === 2 ? { mode: 'beast', settle: 1 } : null;
        ui.camMode = s % 4 < 2 ? 'fps' : 'tps';
        player.eye = [1.62, 1.2, 0.62, 0.5, 0.9, 1.7][s % 6];
        vfx.flash = s % 3 === 0 ? 0.8 : 0;
        if (s % 4 === 2) vfx.expo = 0.55 + R() * 0.7;
        out.push(`== case ${s} place=${JSON.stringify(place)} k=${D.stratum.k} cam=${ui.camMode} eye=${player.eye}`);
        // 目の慣れ：何フレームか。途中で暗い所（ほかの場所）へ動かし、また明るい物のそばへ
        const DTS = [1 / 30, 0.05, 0, 1 / 30, 0.2, 1 / 30, 0.7];
        for (let f = 0; f < DTS.length; f++) {
          if (f === 3) {
            put((s + 1) % 2);
            here.monsters = [];
            here.fixtures = [];
          }
          if (f === 5)
            here.monsters = [
              { x: player.x + 0.5, z: player.z, ty: { name: 'x' } },
              { x: player.x, z: player.z + 1, ty: { name: 'x' } },
            ];
          F.updateAtmosphere(DTS[f]);
          out.push(`atmo f${f} ${atmo()}`);
        }
        // 自分の姿
        if (s % 4 === 0) ui.avatar = null;
        for (let f = 0; f < 4; f++) {
          const sp = [0, 0.29, 0.31, 2, 0.3][(s + f) % 5],
            a = R() * 6.28;
          player.vx = Math.sin(a) * sp;
          player.vz = Math.cos(a) * sp;
          player.yaw = R() * 6.28 - 3.14;
          player.swing = [undefined, 0, 0.4, 0.01][(s + f) % 4];
          player.roll = (s + f) % 4 === 1 ? { t: 0.05 + R() * 0.25, dx: 0, dz: 1 } : null;
          player.eye = [1.62, 0.8, 1.05, 1, 0.99][(s + f) % 5];
          vfx.hurtFlash = [0, 0.3, 1][(s + f) % 3];
          F.updateAvatar([1 / 30, 0.25, 0.016, 0][f]);
          const av = ui.avatar;
          out.push(
            `avatar f${f} ${av.ty.name} form=${fnv(JSON.stringify(av.form))} x=${av.x} z=${av.z} y=${av.y} yaw=${av.yaw} walk=${av.walk} moving=${av.moving} ph=${av.ph} glow=${av.glow} surf=${av.surf}`,
          );
        }
        // 岩の中か：マップの外・壁・天井と床の境・裂け目
        let rk = '';
        const walls = [],
          chasm = [];
        for (let i = 0; i < NCELL; i += 3) {
          if (D.tile[i] === TW || D.tile[i] === TX) walls.push(i);
          if (D.tile[i] === TC) chasm.push(i);
        }
        for (let k = 0; k < 160; k++) {
          const pool = k % 4 === 0 && walls.length ? walls : k % 4 === 1 && chasm.length ? chasm : k % 4 === 2 ? inRoom : null;
          let x, z;
          if (pool) {
            const i = pool[Math.floor(R() * pool.length)];
            x = ((i % MW) + R()) * CELL;
            z = (Math.floor(i / MW) + R()) * CELL;
          } else {
            x = (R() * 1.1 - 0.05) * MW * CELL;
            z = (R() * 1.1 - 0.05) * MH * CELL;
          }
          const ci = Math.floor(z / CELL) * MW + Math.floor(x / CELL),
            ceil = D.ceil[ci] ?? 5;
          const y = [ceil, ceil + 0.001, ceil - 0.001, 0, -0.001, R() * 6 - 1][k % 6];
          rk += F.rockAt(x, y, z) ? '1' : '0';
        }
        out.push(`rock ${rk}`);
        // 岩の断面：3人称のカメラの位置を変えて
        for (let f = 0; f < 4; f++) {
          ui.camMode = f === 3 ? 'fps' : 'tps';
          player.eye = 1.62;
          player.roll = f === 1 ? { t: 0.1, dx: 0, dz: 1 } : null;
          ui.camPos =
            f === 2 && s % 2
              ? null
              : [
                  player.x - Math.sin(player.yaw) * (1 + f * 2) + (R() - 0.5),
                  1 + R() * 2.5 + (f === 0 ? 3 : 0),
                  player.z - Math.cos(player.yaw) * (1 + f * 2) + (R() - 0.5),
                ];
          buf.dn = 0;
          F.drawSection();
          const n = buf.dn;
          out.push(
            `section f${f} n=${n} pos=${fnv(Array.prototype.join.call(dPos.subarray(0, n * 3), ','))} col=${fnv(Array.prototype.join.call(dCol.subarray(0, n * 3), ','))} par=${fnv(Array.prototype.join.call(dPar.subarray(0, n * 4), ','))}`,
          );
        }
        out.push(`next=${mr()}`);
      });
    }
  } finally {
    Object.assign(here, keep.here);
    Object.assign(blaze, keep.blaze);
    Object.assign(player, keep.player);
    Object.assign(ui, keep.ui);
    Object.assign(vfx, keep.vfx);
    Object.assign(gfx, keep.gfx);
    Object.assign(buf, keep.buf);
  }
  return out.join('\n');
}
