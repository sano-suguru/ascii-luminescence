// 部屋の出来事と罠を進める。もとは src/game/15-sound-fire.js（updateEvents）・18-level-player.js（triggerTrap・updateTraps）。
// 部屋の出来事（src/lib/levels.ts の initEvents が作る）：目覚める像・崩れる床・神託・水攻めと溶岩・転移の陣・火口の噴き出し・墓の霊。
// 罠：隠れた罠を見つける・踏む（鐘・落とし穴・網・水・沼のガス）、網から抜け出す、レバーで鉄格子を上げる。
// 状態の入れ物 here（今の階・生き物・出来事・備品）・blaze（火と地面のマス）・player・adv（年代記）・clock・vfx（揺れ）・gfx（崩れた時刻 uCollT）・
// stealth（忍び足）・keys（押しているキー）に頼る。見た目の乱数 mr() を引く順番を変えると、同じシードでも違う動きと見た目になるので、順番を変えないこと。
import { lookup, must, nth } from './array.ts';
import { sAlarm, sBoom, sBubble, sChime, sCreak, sHiss, sRumble, sSplash } from './audio.ts';
import { css } from './color.ts';
import { boom } from './combat.ts';
import type { Trap } from './generate.ts';
import { G } from './glyphs.ts';
import { ignite, uploadCells } from './ground.ts';
import { oracleLegendHints } from './legend.ts';
import { msg } from './log.ts';
import { canStep, summon } from './monsters.ts';
import { TRAP_INFO, mname } from './names.ts';
import { spawn } from './particles.ts';
import { mpick, mr, sndRand } from './random.ts';
import { type Mob, adv, blaze, clock, gfx, here, keys, player, stealth, vfx } from './state.ts';
import { clamp } from './rng.ts';
import { makeNoise } from './status.ts';
import { CELL, LQ_LAVA, LQ_WATER, MW, NCELL, PROPHECIES, TC, TW, cpos } from './world.ts';

/**
 * 溶岩を歩けない生き物 m（飛ぶ物と溶岩に住む物は除く）が、マス i にいるか、i へ歩いている途中か、体（半径 0.35×大きさ）が i にかかっているか
 * （溶岩はそこへ流さない。行き先へ流すと、そのまま溶岩の上に立ってしまう）
 */
const onWay = (m: Mob, i: number): boolean => {
  if (m.ty.flier || m.ty.habitat === 'lava') return false;
  if (m.cz * MW + m.cx === i || m.tz * MW + m.tx === i) return true;
  const x0 = (i % MW) * CELL,
    z0 = Math.floor(i / MW) * CELL;
  return Math.hypot(m.x - clamp(m.x, x0, x0 + CELL), m.z - clamp(m.z, z0, z0 + CELL)) < 0.35 * m.ty.scale;
};
/** 溶岩をマス i に流せないか（プレイヤーの近くか、生き物がいる・向かっている・体がかかっている） */
const lavaBlocked = (i: number): boolean => {
  const [x, z] = cpos(i);
  return Math.hypot(x - player.x, z - player.z) < 1.6 || here.monsters.some((m) => onWay(m, i));
};
/** 流れる途中で、同じマスを試し直す回数 */
const FLOW_TRIES = 10;
/** 溶岩の流れ（噴き上がりと、部屋の出来事の流れ）の、流す順と進み具合 */
interface Flow {
  order: number[];
  k: number;
  tries?: Map<number, number>;
  retry?: number[];
  wait?: number[];
}
/** まだ流すマスがあるか（流す順の残りか、試し直すマス） */
const flowLeft = (ev: Flow): boolean => ev.k < ev.order.length || (ev.retry?.length ?? 0) > 0;
/**
 * 次に流すマスを返す。流す順（ev.order。並べ替えない）を先に、それが尽きたら試し直すマス ev.retry を順に見る。流せなければ null を返し、
 * そのマスを ev.retry の終わりに入れる（同じマスは FLOW_TRIES 回まで。越えたら、待つマス ev.wait に入れる。待つマスは、流し終えた後も retryWaiting で試し続ける）
 */
function nextFlow(ev: Flow): number | null {
  const fromOrder = ev.k < ev.order.length,
    i = fromOrder ? nth(ev.order, ev.k) : nth(ev.retry ?? [], 0);
  if (fromOrder) ev.k++;
  else ev.retry?.shift();
  if (!lavaBlocked(i)) return i;
  const tries = (ev.tries ??= new Map()),
    n = (tries.get(i) ?? 0) + 1;
  tries.set(i, n);
  if (n < FLOW_TRIES) (ev.retry ??= []).push(i);
  else (ev.wait ??= []).push(i);
  return null;
}
/** 待つマスのうち、今は流せるマスを、待つマスから外して返す */
function retryWaiting(ev: Flow): number[] {
  const free = (ev.wait ?? []).filter((i) => !lavaBlocked(i));
  if (free.length) ev.wait = (ev.wait ?? []).filter((i) => !free.includes(i));
  return free;
}
/** 今の階 */
const level = () => must(here.D, '今の階 here.D');

/** 部屋の出来事を進める（dt 秒。t はゲームの時刻。床が崩れた時刻を描画に渡す） */
export function updateEvents(dt: number, t: number): void {
  const pc = Math.floor(player.z / CELL) * MW + Math.floor(player.x / CELL);
  for (const ev of here.events) {
    if (ev.type === 'statue') {
      const [sx, sz] = cpos(ev.cell);
      if (!ev.done && Math.hypot(sx - player.x, sz - player.z) < 3.6) {
        ev.done = true;
        ev.active = true;
        ev.t = 0;
        sRumble(0.35, 1.2);
        blaze.cellFlag[ev.cell] = 100;
        level().solid.delete(ev.cell);
        level().decoCell.delete(ev.cell);
        uploadCells();
        for (let q = 0; q < 70; q++) {
          const a = mr() * 6.28,
            h = mr() * 2.4;
          spawn(
            sx + Math.cos(a) * 0.3,
            0.4 + h,
            sz + Math.sin(a) * 0.3,
            Math.cos(a) * 1.6,
            0.4 + mr(),
            Math.sin(a) * 1.6,
            1.1 + mr() * 0.4,
            G(mpick(['&', '#', '%', '&'])),
            0.2,
            0.8,
            0.78,
            1.0,
            1,
          );
        }
        vfx.shake = Math.max(vfx.shake, 0.25);
      }
      if (ev.active) {
        ev.t += dt;
        if (mr() < dt * 40) {
          const a = mr() * 6.28,
            r = 1.6 * (1 - ev.t / 1.3);
          spawn(
            sx + Math.cos(a) * r,
            0.3 + mr() * 2,
            sz + Math.sin(a) * r,
            -Math.cos(a) * 1.4,
            0,
            -Math.sin(a) * 1.4,
            0.4,
            G(mpick(['&', '#', '%'])),
            0.18,
            1,
            0.95,
            1.2,
            1,
          );
        }
        if (ev.t > 1.3 && !ev.chimed) {
          ev.chimed = true;
          sChime(sx, sz, 0.3);
        }
        if (ev.t > 1.3) {
          ev.active = false;
          const key = here.depth >= 5 ? 'O' : here.depth >= 3 ? 'g' : 'k';
          const m = summon(key, ev.cell);
          msg(`<b style="color:${css(m.ty.col)}">&</b>彫像が崩れ、${mname(m)}の姿へと組み直された！`);
        }
      }
    } else if (ev.type === 'collapse') {
      if (ev.state === 0) {
        if (
          level().roomOf[pc] === ev.ri &&
          must(ev.cells).some((c) => {
            const [x, z] = cpos(c);
            return Math.hypot(x - player.x, z - player.z) < 4.4;
          })
        ) {
          ev.state = 1;
          ev.t = 0;
          sRumble(0.45, 1.6);
          msg('<b style="color:#ffa060">:</b>足元で低い地鳴りが響く。床のひび割れが広がっていく……');
        }
      } else if (ev.state === 1) {
        ev.t += dt;
        vfx.shake = Math.max(vfx.shake, 0.18 + ev.t * 0.15);
        if (mr() < dt * 30) {
          const c = nth(must(ev.cells), Math.floor(mr() * must(ev.cells).length)),
            [x, z] = cpos(c);
          spawn(
            x + (mr() - 0.5) * 1.8,
            nth(level().ceil, c) - 0.1,
            z + (mr() - 0.5) * 1.8,
            0,
            -1.5,
            0,
            1.5,
            G(mpick(['.', ',', "'"])),
            0.12,
            0.4,
            0.38,
            0.45,
            1,
          );
        }
        if (ev.t > 1.4) {
          ev.state = 2;
          level().collapsed = true;
          sBoom(0.7);
          makeNoise(player.x, player.z, 22, 1.2);
          must(gfx.U).uCollT.value = t;
          for (const c of must(ev.cells)) {
            blaze.cellFlag[c] = 200;
            level().tile[c] = TC;
            must(level().pit)[c] = 1;
            const [x, z] = cpos(c);
            for (let q = 0; q < 10; q++)
              spawn(
                x + (mr() - 0.5) * 1.8,
                0.1,
                z + (mr() - 0.5) * 1.8,
                (mr() - 0.5) * 0.6,
                -0.5 - mr() * 2,
                (mr() - 0.5) * 0.6,
                1.6,
                G(mpick(['.', '#', ':', '%'])),
                0.2,
                0.6,
                0.55,
                0.6,
                1,
              );
          }
          for (const m of here.monsters) {
            if (must(level().pit)[m.cz * MW + m.cx] && !m.ty.flier) {
              m.dead = true;
            }
          }
          uploadCells();
          vfx.shake = 0.8;
          msg('<b style="color:#ffa060">:</b>轟音とともに床が崩れ落ちた！ 穴の底に、下の階層の光が見える。');
        }
      }
    } else if (ev.type === 'oracle') {
      if (ev.done) continue;
      const [ox2, oz2] = cpos(ev.cell);
      if (Math.hypot(ox2 - player.x, oz2 - player.z) < 3.4) {
        ev.done = true;
        const ru = nth(must(adv.HIST).rulers, Math.floor(mr() * must(adv.HIST).rulers.length));
        const hp = [
          `${ru.title}${ru.name}の名を口にする者は、もういない。`,
          `${must(adv.HIST).civ.name}の民が最後に見たものを、お前もやがて見るだろう。`,
          `${must(adv.HIST).beast}は、まだどこかで眠っている。`,
        ];
        const a = [nth(hp, Math.floor(mr() * hp.length)), nth(PROPHECIES, Math.floor(mr() * PROPHECIES.length))];
        sChime(ox2, oz2, 0.4);
        setTimeout(() => sChime(ox2, oz2, 0.3), 500);
        msg('<b style="color:#bfe4ff">?</b>巻物の文字がひとりでに光り、声なき声が告げる──');
        msg(`<b style="color:#bfe4ff">「</b>${nth(a, 0)}」`);
        msg(`<b style="color:#bfe4ff">「</b>${nth(a, 1)}」`);
        oracleLegendHints();
        for (let q = 0; q < 50; q++) {
          const an = mr() * 6.28;
          spawn(
            ox2 + Math.cos(an) * 0.3,
            1.2 + mr(),
            oz2 + Math.sin(an) * 0.3,
            Math.cos(an) * 0.7,
            0.4 + mr() * 0.8,
            Math.sin(an) * 0.7,
            2.5 + mr() * 2,
            G(mpick(['?', '*', '.', '+'])),
            0.14,
            1.0,
            1.6,
            2.2,
            2,
          );
        }
      }
    } else if (ev.type === 'flood' || ev.type === 'lavaflow') {
      const lava = ev.type === 'lavaflow';
      /** マス i に溶岩を流す（まわりの燃える物に火をつけ、燃えるガスは爆ぜる） */
      const pourLava = (i: number) => {
        const [x, z] = cpos(i);
        // この溶岩は引かないので、火口の噴き上がりが引く時に戻すマスから外す
        for (const o of here.events) if (o.type === 'erupt') o.poured?.delete(i);
        level().liquid[i] = LQ_LAVA;
        blaze.cellFlag[i] = 70;
        for (const j of [i + 1, i - 1, i + MW, i - MW]) if (j >= 0 && j < NCELL && nth(blaze.fuel, j) > 0) ignite(j, 0.6, false);
        if (nth(level().gas, i) > 0.1) boom(i);
        if (sndRand() < 0.3) sBubble(x, z, 0.25, true);
      };
      if (ev.state === 0) {
        if (level().roomOf[pc] === ev.ri) {
          ev.state = 1;
          ev.t = 0;
          const f = here.fixtures.find(
            (f) => f.type === (lava ? 'crater' : 'spring') && Math.floor(f.z / CELL) * MW + Math.floor(f.x / CELL) === ev.src,
          );
          if (f) {
            f.active = true;
            const L = level().lights[f.li];
            if (L) L.active = true;
          }
          if (lava) {
            sRumble(0.5, 2);
            vfx.shake = Math.max(vfx.shake, 0.3);
            msg('<b style="color:#ff7a3a">^</b>床の裂け目が割れ、溶岩がゆっくりとあふれ出した！');
          } else {
            sSplash(0.4);
            msg('<b style="color:#6ab4ff">~</b>壁の亀裂が崩れ、水が勢いよく噴き出した！');
          }
        }
      } else if (ev.state === 1) {
        ev.t += dt;
        const step = lava ? 0.38 : 0.11;
        let changed = false;
        while (ev.t >= step && (lava ? flowLeft(ev) : ev.k < ev.order.length)) {
          ev.t -= step;
          const i = lava ? nextFlow(ev) : nth(ev.order, ev.k++);
          if (i === null) continue;
          changed = true;
          if (lava) pourLava(i);
          else {
            level().liquid[i] = LQ_WATER;
            blaze.cellFlag[i] = 50;
            blaze.fire[i] = 0;
            blaze.fuel[i] = 0;
            if (sndRand() < 0.2) sSplash(0.12);
          }
        }
        if (changed) uploadCells();
        if (!(lava ? flowLeft(ev) : ev.k < ev.order.length)) ev.state = 2;
      } else if (ev.state === 2 && lava) {
        // 流せなかったマスは、空いたら流す
        const free = retryWaiting(ev);
        for (const i of free) pourLava(i);
        if (free.length) uploadCells();
      }
    } else if (ev.type === 'tele') {
      const [ax, az] = cpos(ev.a),
        [bx, bz] = cpos(ev.b),
        da = Math.hypot(player.x - ax, player.z - az),
        db = Math.hypot(player.x - bx, player.z - bz);
      if (ev.lock >= 0) {
        const [lx, lz] = cpos(ev.lock);
        if (Math.hypot(player.x - lx, player.z - lz) > 1.3) ev.lock = -1;
      }
      const from = da < 0.7 && ev.lock !== ev.a ? ev.a : db < 0.7 && ev.lock !== ev.b ? ev.b : -1;
      if (from >= 0 && !here.trans) {
        const to = from === ev.a ? ev.b : ev.a,
          [tx2, tz2] = cpos(to),
          [fx2, fz2] = cpos(from);
        for (const [px3, pz3] of [
          [fx2, fz2],
          [tx2, tz2],
        ] as const)
          for (let q = 0; q < 40; q++) {
            const an = mr() * 6.28;
            spawn(
              px3 + Math.cos(an) * 0.5,
              0.2 + mr() * 2,
              pz3 + Math.sin(an) * 0.5,
              Math.cos(an) * 0.8,
              mr() * 1.2,
              Math.sin(an) * 0.8,
              1.2 + mr(),
              G(mpick(['*', '+', '.', 'o'])),
              0.16,
              1.0,
              0.6,
              1.6,
              2,
            );
          }
        player.x = tx2;
        player.z = tz2;
        player.vx = player.vz = 0;
        ev.lock = to;
        sChime(tx2, tz2, 0.5);
        if (!level().teleMsg) {
          level().teleMsg = true;
          msg('<b style="color:#ff7ae0">*</b>魔法陣が閃き、体が別の場所へと運ばれた。対になった陣が、どこかにもうひとつある。');
        }
      }
    } else if (ev.type === 'erupt') {
      // 待つ間（0：次に噴き上がるまで、2：引き始めるまで）だけ時計を減らす。流れ出す（1）・引く（3）間は、下で時計を足して1マスずつ進める
      if (ev.state === 0 || ev.state === 2) ev.t -= dt;
      const f = here.fixtures.find((f) => f.type === 'crater' && Math.floor(f.z / CELL) * MW + Math.floor(f.x / CELL) === ev.src);
      /** マス i に溶岩を流す（まわりの燃える物に火をつける） */
      const pour = (i: number) => {
        // もう溶岩のマスには流さない。ほかの火口が流した溶岩なら、待つマスに入れ、その溶岩が引いた後に流す（引く時も、その火口に任せる）
        if (level().liquid[i] === LQ_LAVA) {
          if (here.events.some((o) => o !== ev && o.type === 'erupt' && o.poured?.has(i))) (ev.wait ??= []).push(i);
          return;
        }
        // 凍らせた水は、本当の中身（液体と床）を覚えて、氷を溶かす（氷が溶ける時と同じく、火と燃える物も消す）
        const ice = blaze.frozen.get(i);
        if (ice) {
          level().surface[i] = ice.surf;
          blaze.fire[i] = 0;
          blaze.fuel[i] = 0;
          blaze.frozen.delete(i);
        }
        (ev.poured ??= new Map()).set(i, [ice ? ice.liq : nth(level().liquid, i), nth(blaze.cellFlag, i)]);
        level().liquid[i] = LQ_LAVA;
        blaze.cellFlag[i] = 70;
        for (const j of [i + 1, i - 1, i + MW, i - MW]) if (j >= 0 && j < NCELL && nth(blaze.fuel, j) > 0) ignite(j, 0.6, false);
      };
      if (ev.state === 0 && ev.t <= 0) {
        ev.state = 1;
        ev.k = 0;
        ev.t = 0;
        ev.tries = new Map();
        ev.retry = [];
        ev.wait = [];
        ev.poured = new Map();
        if (f) {
          f.active = true;
          const L = level().lights[f.li];
          if (L) L.active = true;
        }
        const [sx, sz] = cpos(ev.src),
          dd = Math.hypot(sx - player.x, sz - player.z);
        if (dd < 30) {
          sRumble(0.6 * (1 - dd / 30) + 0.15, 2.2);
          vfx.shake = Math.max(vfx.shake, 0.5 * (1 - dd / 30));
        }
        if (dd < 24 && here.fovVis[ev.src] === here.fovStamp)
          msg('<b style="color:#ff7a3a">^</b>火口が轟音とともに噴き上がり、溶岩があふれ出した！');
        for (let q = 0; q < 70; q++) {
          const an = mr() * 6.28,
            sp2 = 1 + mr() * 2.4;
          spawn(
            sx,
            0.4,
            sz,
            Math.cos(an) * sp2 * 0.5,
            3 + mr() * 4,
            Math.sin(an) * sp2 * 0.5,
            1.4 + mr(),
            G(mpick(['*', 'o', "'", '.'])),
            0.18,
            2.4,
            1.1,
            0.3,
            0,
          );
        }
      } else if (ev.state === 1) {
        ev.t += dt;
        let ch = false;
        while (ev.t >= 0.3 && flowLeft(ev)) {
          ev.t -= 0.3;
          const i = nextFlow(ev);
          if (i === null) continue;
          pour(i);
          ch = true;
        }
        if (ch) uploadCells();
        if (!flowLeft(ev)) {
          ev.state = 2;
          ev.t = 12;
        }
      } else if (ev.state === 2 && ev.t > 0) {
        // 流せなかったマスは、空いたら流す（引き始めるまで）
        const free = retryWaiting(ev);
        for (const i of free) pour(i);
        if (free.length) uploadCells();
      } else if (ev.state === 2) {
        ev.wait = [];
        ev.state = 3;
        ev.k = ev.order.length - 1;
        ev.t = 0;
        if (f) {
          f.active = false;
          const L = level().lights[f.li];
          if (L) L.active = false;
        }
      } else if (ev.state === 3) {
        ev.t += dt;
        let ch = false;
        while (ev.t >= 0.15 && ev.k >= 0) {
          ev.t -= 0.15;
          const i = nth(ev.order, ev.k--),
            was = ev.poured?.get(i);
          // この噴き上がりで流したマスだけを、流す前の中身（液体と印）に戻す
          if (was && blaze.cellFlag[i] === 70) {
            level().liquid[i] = was[0];
            blaze.cellFlag[i] = was[1];
            // 踏み分けた草は、また生え戻るように一覧へ入れ直す（溶岩の間に、一覧から外れている）
            if (was[1] === 20) blaze.trampled.push([i, clock.time]);
            ch = true;
            const [x, z] = cpos(i);
            if (mr() < 0.4) spawn(x, 0.2, z, 0, 0.5, 0, 2, G('.'), 0.4, 0.15, 0.13, 0.13, 1);
          }
        }
        if (ch) uploadCells();
        if (ev.k < 0) {
          ev.state = 0;
          ev.t = 20 + mr() * 20;
        }
      }
    } else if (ev.type === 'haunt') {
      if (ev.done) continue;
      if (ev.t < 0 && level().roomOf[pc] === ev.ri) ev.t = 0;
      if (ev.t >= 0) {
        ev.t += dt;
        for (const c of ev.tombs.slice(0, 2)) {
          const [x, z] = cpos(c);
          if (mr() < dt * 25) {
            const a = mr() * 6.28,
              r = 1.4 * (1 - Math.min(1, ev.t / 2));
            spawn(
              x + Math.cos(a) * r,
              0.2 + mr() * 1.8,
              z + Math.sin(a) * r,
              -Math.cos(a) * 0.6,
              0.1,
              -Math.sin(a) * 0.6,
              0.6,
              G(mpick(['~', 'W', "'"])),
              0.2,
              0.5,
              0.4,
              0.9,
              1,
            );
          }
        }
        if (ev.t > 2 && !ev.chimed) {
          ev.chimed = true;
          sChime(...cpos(nth(ev.tombs, 0)), 0.3);
        }
        if (ev.t > 2) {
          ev.done = true;
          const ms = ev.tombs.slice(0, 2).map((c) => {
            const nb = [c + 1, c - 1, c + MW, c - MW].find((j) => canStep({ ty: { form: '' } }, j));
            return summon('W', nb !== undefined ? nb : c);
          });
          msg(`<b style="color:${css(nth(ms, 0).ty.col)}">W</b>墓石の間から、${mname(nth(ms, 0))}がゆらりと立ち上がった……`);
        }
      }
    }
  }
}

/** 罠 tr を踏んだ（鐘：まわりの獣を集める、落とし穴：下の階へ落ちる、網：しばらく動けない、水：水が噴き出す、沼のガス：ガスが噴き出す） */
export function triggerTrap(tr: Trap): void {
  tr.used = true;
  tr.hidden = false;
  const [x, z] = cpos(tr.i),
    info = lookup(TRAP_INFO, tr.type),
    tag = `<b style="color:${info[1]}">^</b>`;
  switch (tr.type) {
    case 'alarm':
      sAlarm(x, z);
      vfx.shake = Math.max(vfx.shake, 0.2);
      msg(tag + 'カチリ……鐘の音が響き渡った！ 辺りの獣が集まってくる。');
      for (const m of here.monsters) {
        if (m.ty.critter || m.dead) continue;
        if (Math.hypot(m.x - x, m.z - z) < 32) {
          m.sleep = false;
          m.aware = Math.max(m.aware, 0.8);
          m.goal = [x, z];
          m.goalT = clock.time + 15;
        }
      }
      break;
    case 'trapdoor':
      sRumble(0.5, 1.2);
      vfx.shake = Math.max(vfx.shake, 0.4);
      msg(tag + '床が抜けた！ 闇の中を、下の階へと落ちていく……');
      here.trans = { phase: 'out', t: 0, regen: false };
      player.fall = true;
      break;
    case 'net':
      player.netT = 3.2;
      sHiss(x, z, 0.5);
      msg(tag + '網が降ってきた！ もがいて抜け出そうとする……');
      break;
    case 'flood':
      sSplash(0.5);
      msg(tag + '床の穴から、水が勢いよく噴き出した！');
      here.events.push({
        type: 'flood',
        ri: -2,
        order: must(tr.order).slice(),
        src: tr.i,
        state: 1,
        t: 0,
        k: 0,
      });
      break;
    case 'methane':
      sHiss(x, z, 1.2);
      msg(tag + '床の穴から、沼のガスが噴き出した。火気に注意！');
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = tr.i + dx + dy * MW;
          if (j >= 0 && j < NCELL && level().tile[j] !== TW && Math.hypot(dx, dy) <= 2.3)
            level().gas[j] = Math.max(nth(level().gas, j), 0.9);
        }
      blaze.gasAny = true;
      break;
  }
}
/** 罠を進める（隠れた罠を近くで見つける・踏む）・網から抜け出す・壁のレバーを引くと鉄格子が上がる（dt 秒） */
export function updateTraps(dt: number): void {
  for (const tr of level().traps || []) {
    const [x, z] = cpos(tr.i),
      d = Math.hypot(x - player.x, z - player.z);
    if (tr.hidden && d < CELL * 1.3) {
      const mv = Math.hypot(player.vx, player.vz) > 0.3,
        rate = (stealth.sneak ? 1.1 : 0.3) * (mv ? 0.6 : 1.6);
      if (mr() < dt * rate) {
        tr.hidden = false;
        sChime(x, z, 0.15);
        msg(
          `<b style="color:${lookup(TRAP_INFO, tr.type)[1]}">^</b>隠された${lookup(TRAP_INFO, tr.type)[0]}罠を見つけた。踏まないように気をつけよう。`,
        );
      }
    }
    if (!tr.used && d < 0.6 && !here.trans) triggerTrap(tr);
  }
  if ((player.netT ?? NaN) > 0) {
    const mv = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
    player.netT = (player.netT ?? NaN) - dt * (mv ? 1.6 : 1);
    if (player.netT <= 0) msg('網から抜け出した。');
  }
  const G2 = level().gate;
  if (G2 && !G2.open) {
    const [lx, lz] = cpos(G2.lever);
    if (Math.hypot(player.x - lx - G2.ld[0] * 0.6, player.z - lz - G2.ld[1] * 0.6) < 1.1) {
      G2.open = true;
      G2.pulled = clock.time;
      sCreak(lx, lz);
      // @ts-expect-error -- 古い JS のまま（使っていない。鉄格子のマスの位置）
      const [gx, gz] = cpos(G2.cell);
      setTimeout(() => sRumble(0.25, 1.6), 500);
      msg('<b style="color:#ffd48a">/</b>壁のレバーを引いた。どこか遠くで、鉄格子が軋みながら上がっていく音がした。');
    }
  }
  if (G2) G2.o = G2.o + ((G2.open ? 1 : 0) - G2.o) * Math.min(1, dt * 0.8);
}
