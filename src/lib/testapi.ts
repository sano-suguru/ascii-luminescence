/* oxlint-disable typescript/consistent-type-assertions -- テストから受け取った値で、ゲームの状態を直に作る道具（元の書き方のまま。型を外すと元と同じ文） */
// テスト用モードの道具 window.__test（もとは src/game/30-loop-init.js）。テスト用モード（?test=1）の時だけ initTestApi が置く。
// 使い方は CLAUDE.md の「テスト用モード」。ゲームは自分では進まないので、advance（描かずに進める）か frames（描いて進める）で進める。
import { lookup, must, nth } from './array.ts';
import { beginCast, releaseCast } from './chant.ts';
import { rockAt } from './camera.ts';
import { addZone, later } from './combat.ts';
import { MTYPES } from './creatures.ts';
import { crumble, debrisInfo } from './debris.ts';
import { drawMonster, drawMonster0, drawTentacles } from './bodies/draw.ts';
import { buildWorld } from './build.ts';
import { openBestiary, showBeast } from './gallery.ts';
import { applyOpen, canPutAt, equipWeapon, makeRune, slotSet, syncHands } from './gear.ts';
import { chillArea, ignite } from './ground.ts';
import { renderHotbar } from './hotbar.ts';
import { computeFOV, generate, interAt, levelSeed } from './levels.ts';
import { ceilAt } from './lightmap.ts';
import { applySize, testTick, tick, withTestCam } from './loop.ts';
import { jagged } from './math.ts';
import { makeMonster, summon } from './monsters.ts';
import { dCol, dPar, dPos, P } from './particles.ts';
import { BLESS } from './progress.ts';
import { keyedRand, withVisualRand } from './random.ts';
import { RUNE_DEF } from './runes.ts';
import type { Spec } from './gear.ts';
import type { Rune } from './runes.ts';
import type { Level } from './generate.ts';
import type { Camera } from 'three';
import {
  adv,
  blaze,
  buf,
  clock,
  fight,
  gear,
  gfx,
  here,
  iceT,
  player,
  skipPhases,
  TEST,
  TEST_STEP,
  TESTQ,
  tickNoise,
  ui,
  vfx,
} from './state.ts';
import { isPaused, placeLabel } from './status.ts';
import { SPECIALS } from './strata.ts';
import { visW } from './text.ts';
import { T } from './three.ts';
import { TUNE } from './touchpad.ts';
import { BRANCHES, blocksWalk, CELL, FINAL_DEPTH, LQ_DEEP, LQ_LAVA, LQ_WATER, MW, MH, REALMS, SF_BRIM, SF_ICE, TF } from './world.ts';

/** __test の中で、this から呼ぶ物（ほかの欄は、置いた物の型のまま） */
interface TestApi {
  [k: string]: unknown;
  gallery(): string | { n: number }[];
  galleryDraw(): unknown;
  traces(): unknown;
}
declare global {
  interface Window {
    /** テスト用モードの道具（initTestApi が置く） */
    __test: TestApi;
  }
}
/** 部屋の出来事を、どの種類でも読める欄だけで見る（無い欄は undefined） */
interface EventView {
  type: string;
  src?: number | undefined;
  state?: number;
  t?: number;
  k?: number;
  order?: number[];
  done?: boolean;
}
/** 今の階（無ければ止まる） */
const level = () => must(here.D, '今の階 here.D');

/** テスト用モードの時だけ、window.__test を置く */
export function initTestApi(): void {
  if (TEST)
    window.__test = {
      step: TEST_STEP,
      ready() {
        return clock.testBoot === true && !!here.D;
      },
      error() {
        return typeof clock.testBoot === 'string' ? clock.testBoot : null;
      },
      // step the game without drawing (fast); returns the game time
      advance(sec: number) {
        const n = Math.max(0, Math.round(sec / TEST_STEP));
        for (let i = 0; i < n; i++) testTick(false);
        return +clock.time.toFixed(4);
      },
      // step and draw n frames (one per animation frame)
      frames(n: number) {
        if (TESTQ.done) return Promise.reject(new Error('__test.frames: the previous call has not finished'));
        return new Promise<void>((ok) => {
          TESTQ.n = Math.max(0, n | 0);
          if (!TESTQ.n) ok();
          else TESTQ.done = ok;
        });
      },
      // give every blessing at level n (default 1), so a level-up offers their next level (shown with II)
      // 指の操作の、試して合わせる値を変える（{look, analog}。src/lib/touchpad.ts の TUNE。tools/feel.mjs が使う）
      touchTune(o?: Partial<typeof TUNE>) {
        Object.assign(TUNE, o || {});
        return { ...TUNE };
      },
      // the quality the frame loop lowers on a slow device (src/lib/quality.ts; tests keep it fixed): pr is the pixel ratio, bloom whether the glow is drawn. Returns what it is now
      quality(q?: { pr?: number; bloom?: boolean }) {
        if (q) {
          if (q.pr !== undefined) gfx.pixelRatio = q.pr;
          if (q.bloom !== undefined) must(gfx.bloom, '光のにじみ gfx.bloom').enabled = q.bloom;
          applySize('auto');
        }
        return { pr: gfx.pixelRatio, bloom: must(gfx.bloom, '光のにじみ gfx.bloom').enabled };
      },
      bless(n = 1) {
        for (const k in BLESS) adv.lvl.bless[k] = n;
        return Object.keys(BLESS).length;
      },
      // how many columns the panels count for a piece of text (visW)
      width(text: string) {
        return visW(text);
      },
      // every phase of tick draws the visual random n more times at its end (each phase reads its own keyed sequence, so nothing should change)
      tickNoise(n: number) {
        tickNoise.n = Math.max(0, n | 0);
        return tickNoise.n;
      },
      // skip the phases of tick with these names (inPhase('hands',…), the creatures' drawing inMobPhase('mob draw',…)); [] brings them all back.
      // Returns the names skipped now. A name tick does not have is not taken (so a typo shows: the list comes back without it)
      // (the names are read from tick's own source, so the list does not need to be kept by hand; the build may rename inPhase to inPhase$1 and so on)
      skipPhase(names?: string[]) {
        const known = new Set([...tick.toString().matchAll(/in(?:Mob)?Phase[$\w]*\(\s*["'`]([^"'`]+)["'`]/g)].map((x) => x[1]));
        skipPhases.clear();
        for (const n of names || []) if (known.has(n)) skipPhases.add(n);
        return [...skipPhases];
      },
      // a plain copy of what matters, to compare runs
      state() {
        const f = (v: number | undefined) => +(+(v ?? NaN) || 0).toFixed(3);
        return {
          time: f(clock.time),
          seed: adv.runSeed,
          place: placeLabel(),
          depth: here.depth,
          started: ui.started,
          dead: adv.dead,
          hp: f(player.hp),
          pos: [f(player.x), f(player.z)],
          yaw: f(player.yaw),
          lvl: adv.lvl.n,
          monsters: here.monsters.map((m) => [m.key, f(m.x), f(m.z), f(m.hp), m.sleep ? 1 : 0, f(m.wind)]),
          projs: fight.projs.length,
          trans: here.trans ? here.trans.phase : null,
          maxDepth: adv.runStats && adv.runStats.maxDepth !== undefined ? adv.runStats.maxDepth : null,
          cast: gear.castSt ? { h: gear.castSt.h, t: f(gear.castSt.t), need: f(gear.castSt.need), full: gear.castSt.full } : null,
          recover: f(player.recover),
          paused: isPaused(),
          roll: !!player.roll,
          quick: f(player.qcUntil),
          counter: f(player.ctrUntil),
        };
      },
      // the room events of this level (type, crater cell, state, timer, step, the cells in the order they flood, done) and how many cells lava has flowed into (an eruption or a lava flow)
      events() {
        return {
          list: here.events.map((e: EventView) => ({
            type: e.type,
            src: e.src === undefined ? null : e.src,
            state: e.state === undefined ? null : e.state,
            t: e.t === undefined ? null : +e.t.toFixed(3),
            k: e.k === undefined ? null : e.k,
            order: e.order ? e.order.slice() : null,
            done: !!e.done,
          })),
          lava: blaze.cellFlag.reduce((n, v) => n + (v === 70 ? 1 : 0), 0),
        };
      },
      // hold a weapon (a RUNE_DEF key such as 'blade', 'bolt', 'orb'), and press / release a hand's button ('L' or 'R')
      open(t: string) {
        if (!['slotL', 'slotR', 'body'].includes(t)) return 'no such slot: ' + t;
        applyOpen(t);
        return t;
      },
      equip(h: 'L' | 'R', type: string) {
        if (!RUNE_DEF[type] || RUNE_DEF[type].cat !== 'atk') return 'no such weapon: ' + type;
        equipWeapon(h, makeRune(type));
        renderHotbar();
        return type;
      },
      // 手 h（'L'・'R'）に性質（RUNE_DEF の性質の鍵：'fire'・'ice'・'thunder'・'poison'）を付ける。手の性質のルーンを外してから、空いた枠に入れる。
      // 付けた性質を返す（無い手・無い鍵・入る枠が無い時は、わけの文。入らなければ、外したルーンを元に戻す）。null なら性質のルーンを外すだけ
      elem(h: string, type: string | null) {
        if (h !== 'L' && h !== 'R') return 'no such hand: ' + h;
        if (type !== null && (!RUNE_DEF[type] || RUNE_DEF[type].cat !== 'elem')) return 'no such element: ' + type;
        const H = must(gear.hands, '手 gear.hands')[h],
          n = H.slotN || 2,
          took: [number, Rune][] = [];
        for (let i = 0; i < n; i++) {
          const r = H.slots[i];
          if (r && lookup(RUNE_DEF, r.type).cat === 'elem') {
            took.push([i, r]);
            slotSet(h, 's' + i, null);
          }
        }
        let put = type === null;
        if (!put) {
          const ru = makeRune(must(type, '性質'));
          for (let i = 0; i < n && !put; i++)
            if (!H.slots[i] && canPutAt(h, i, ru)) {
              slotSet(h, 's' + i, ru);
              put = true;
            }
        }
        if (!put) for (const [i, r] of took) slotSet(h, 's' + i, r);
        syncHands();
        renderHotbar();
        return put ? type : 'no free slot: ' + h;
      },
      // n 番目（0 から。state().monsters の順）の生き物を、その場に止める（{yaw, walk}：yaw は向く向き（体の向き m.yaw と同じ、atan2(x の差, z の差)。無ければ今の向きのまま）、
      // walk なら足踏みする。止めている間は歩かず、攻撃もしない（止めた時に、攻撃の溜めも捨てる）。気づく・当たってひるむ・吹き飛ぶ・燃える・ブロートが近くで弾けるなどは、ふだんどおり）。
      // null で放す。止めたら true、いなければ false。小さな生き物（魚・清掃機など。動きが別の処理）は止められないので、わけの文を返す
      hold(n: number, o?: { yaw?: number; walk?: boolean } | null) {
        const m = here.monsters[n];
        if (!m) return false;
        if (m.ty.critter) return 'cannot hold a critter: ' + m.key;
        m.hold = o ? { ...(o.yaw !== undefined ? { yaw: o.yaw } : {}), walk: !!o.walk } : null;
        if (o) m.wind = 0;
        return true;
      },
      // 描く時のカメラを pos（[x,y,z]）に置いて at（[x,y,z]）を見る（ゲームの一歩は目のカメラのまま。上の testCam）。pos が岩の中（壁・地図の外・天井より上）か、
      // 横に 0.4 以内に壁がある時は置かず、わけの文を返す。置いたら {pos, at, clear}（clear は pos から at までの線が岩を通らないか）を返す。
      // null で目に戻す（ほかの階へ移っても目に戻る）。pos・at が3つの数でなければ、わけの文。引数なしなら何も変えず、目のカメラの位置と向きと置いたカメラ {pos, yaw, pitch, placed} を返す（placed は置いていなければ null）
      cam(o?: { pos: [number, number, number]; at: [number, number, number] } | null) {
        if (o === undefined) {
          if (gfx.testCam && gfx.testCam.lvl !== here.D) gfx.testCam = null;
          const p = gfx.camera.position;
          return {
            pos: [p.x, p.y, p.z],
            yaw: gfx.camera.rotation.y,
            pitch: gfx.camera.rotation.x,
            placed: gfx.testCam ? { pos: gfx.testCam.pos, at: gfx.testCam.at } : null,
          };
        }
        if (!o) {
          gfx.testCam = null;
          return null;
        }
        const v3 = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
        if (!v3(o.pos) || !v3(o.at)) return 'pos and at must be [x,y,z]';
        const [x, y, z] = o.pos,
          [ax, ay, az] = o.at;
        for (const [dx, dz] of [
          [0, 0],
          [0.4, 0],
          [-0.4, 0],
          [0, 0.4],
          [0, -0.4],
        ] as const)
          if (rockAt(x + dx, y, z + dz)) return 'camera in rock: ' + JSON.stringify(o.pos);
        let clear = true;
        for (let k = 1; k < 40 && clear; k++) {
          const f = k / 40;
          if (rockAt(x + (ax - x) * f, y + (ay - y) * f, z + (az - z) * f)) clear = false;
        }
        gfx.testCam = { pos: o.pos.slice() as [number, number, number], at: o.at.slice() as [number, number, number], lvl: here.D };
        return { pos: gfx.testCam.pos, at: gfx.testCam.at, clear };
      },
      // true when the hand started charging, or attacked at once (a weapon with no charge, such as the short sword)
      press(h: 'L' | 'R') {
        const r0 = player.recover || 0;
        beginCast(h);
        return !!gear.castSt || (player.recover || 0) > r0;
      },
      release(h: 'L' | 'R') {
        releaseCast(h);
      },
      // the doors of this level (cell i, the room cell j next to it, how open o, burnt away), a cell (its middle x z, floor to stand on, seen now, explored, ash,
      // sulphur or ice floor, thin ice and the seconds stood on it, water, lava, fire, fuel), the size of the map, setting a cell on fire (gas: as burning gas does, leaving a little fuel),
      // and putting a creature (an MTYPES key such as 'Re') on a cell
      doors() {
        return level().doors.map((d) => ({ i: d.i, j: d.j, o: +d.o.toFixed(3), gone: !!d.gone }));
      },
      cell(i: number) {
        return {
          x: ((i % MW) + 0.5) * CELL,
          z: (((i / MW) | 0) + 0.5) * CELL,
          floor: level().tile[i] === TF && !level().solid.has(i) && !blocksWalk(nth(level().liquid, i)),
          seen: here.fovVis[i] === here.fovStamp,
          explored: !!here.explored[i],
          burnt: !!blaze.burnt[i],
          brim: level().surface[i] === SF_BRIM,
          ice: level().surface[i] === SF_ICE,
          thin: !!level().thin[i],
          iceT: iceT.get(i) || 0,
          water: level().liquid[i] === LQ_WATER || level().liquid[i] === LQ_DEEP,
          lava: level().liquid[i] === LQ_LAVA,
          fire: +(blaze.fire[i] || 0).toFixed(3),
          fuel: +(blaze.fuel[i] || 0).toFixed(3),
        };
      },
      // the size of the map in cells (a cell number is row times w plus column)
      size() {
        return { w: MW, h: MH };
      },
      ignite(i: number, gas = false) {
        ignite(i, 1, gas);
      },
      // cold around a cell (r in world units, as an ice spell), and how many times a cell is in the list of burning cells
      chill(i: number, r: number) {
        chillArea(((i % MW) + 0.5) * CELL, (((i / MW) | 0) + 0.5) * CELL, r);
      },
      burning(i: number) {
        return blaze.burning.filter((j) => j === i).length;
      },
      // 落石：on なら、プレイヤーのまわり（3マス）の床で、宝物庫の天井が崩れた時と同じ落石を始める。今の落石（経った秒・落ちている石の数。無ければ null）を返す
      // 倒れた生き物が崩れて積もった文字（崩れる体ごとの、文字の数・残す数・消えていない数・様子ごとの数（体に付いたまま・落ちている・積もった・塵になって縮む・水に沈む・溶岩で燃える・消えた）・積もった文字の高さの範囲と倒れた所からの距離。src/lib/debris.ts）
      debris() {
        return debrisInfo();
      },
      rockfall(on?: boolean) {
        if (on) {
          const cx = Math.floor(player.x / CELL),
            cz = Math.floor(player.z / CELL),
            cells: number[] = [];
          for (let dz = -3; dz <= 3; dz++)
            for (let dx = -3; dx <= 3; dx++) {
              const x = cx + dx,
                z = cz + dz;
              if (x < 0 || x >= MW || z < 0 || z >= MH) continue;
              const c = z * MW + x;
              if (level().tile[c] === TF) cells.push(c);
            }
          fight.rockfall = { t: 0, dur: 9, cells, rocks: [], next: 0.2 };
        }
        const R = fight.rockfall;
        return R ? { t: +R.t.toFixed(4), rocks: R.rocks.length } : null;
      },
      // lingering things of this level (fields, delayed hits, rains, marks on the floor, a beam being fired, lightning, lightning still to fall and its flash):
      // put one of each where the player stands, made to do nothing for 60 s (a field and a rain with no element, a beam whose first shot is 60 s away),
      // and count them. It also sets both hands' trigger wait to 60 s (it belongs to the run, not to the level: a new run sets it back to 0).
      // It also makes an ice hound where the player stands (not added to the level's creatures) and lets it fall, so one crumbling body lies there
      addTraces() {
        const x = player.x,
          z = player.z;
        crumble(makeMonster({ key: 'Zi', cx: Math.floor(x / CELL), cz: Math.floor(z / CELL), g: -1, lead: true }));
        addZone(x, z, 2, { elem: null } as Spec, 60, false);
        later(60, () => {});
        fight.marks.push({ x, z, r: 1, t: 60, c: [1, 0.5, 0.2] });
        fight.rains.push({ x, z, r: 1, n: 1, left: 1, iv: 1, tick: 60, sp: { elem: null } as Spec, follow: false, elemK: 0, again: false });
        fight.beamRun = { h: 'L', t: 60, tick: 60, auto: true, dir: null };
        const a: [number, number, number] = [x, 1, z],
          b: [number, number, number] = [x, 1, z + 1];
        fight.boltFx.push({ a, b, col: [1, 1, 1], style: 'spark', amp: 0.1, t: 0, life: 60, re: 0, pts: jagged(a, b, 0.1) });
        fight.zapQueue.push({ t: 60, fn: () => {} });
        vfx.zapFlash = { x, y: 2, z, col: [1, 1, 1], t: 60, r: 6 };
        fight.trigCd = { L: 60, R: 60 };
        return this.traces();
      },
      traces() {
        return {
          zones: fight.zones.length,
          laters: fight.laters.length,
          rains: fight.rains.length,
          marks: fight.marks.length,
          beam: !!fight.beamRun,
          bolts: fight.boltFx.length,
          zaps: fight.zapQueue.length,
          flash: !!vfx.zapFlash,
          trig: [fight.trigCd.L, fight.trigCd.R],
          debris: fight.debris.length,
        };
      },
      // a delayed thing that throws (to see that an error inside one is not swallowed in test mode)
      failLater(message: string) {
        later(0, () => {
          throw new Error(message);
        });
      },
      // count the cells in sight now (the game does it every 0.1 s; a check that looks every frame should not miss a short moment)
      fov() {
        computeFOV();
      },
      // unseen: put it down as not seen yet, so the first sight of it gives its line (summon itself counts it as seen)
      summon(key: string, i: number, { unseen = false }: { unseen?: boolean } = {}) {
        if (!MTYPES[key]) return 'no such creature: ' + key;
        const m = summon(key, i);
        if (unseen) m.seen = false;
        return here.monsters.length;
      },
      // the bestiary, opened from the title (as its button does) if it is not open: every entry in order, n counted from 1
      gallery() {
        if (!(ui.gallery && ui.gallery.mode === 'beast')) {
          if (ui.started) return 'the bestiary opens from the title';
          openBestiary();
        }
        return must(must(ui.gallery, '図鑑 ui.gallery').list, '図鑑の一覧').map((e, i) => ({
          n: i + 1,
          key: e.key,
          name: e.ty.name,
          form: e.ty.form,
          scale: e.ty.scale,
        }));
      },
      // show entry n held still: yaw 0 faces the camera, + turns it to the right as seen from the camera; pose 'stand' | 'walk' | 'sleep'.
      // zoom (0.5-3, default 1) divides the camera's distance: 2 is half as far, so the creature looks bigger (the room still bounds it, and a zoom in stops outside the body).
      // pitch (-0.3 to 1.3 radians) moves the camera up around the creature, under the ceiling: 0 looks from the side, + looks down from above (left out: the height the bestiary works out from the creature's size).
      // center (true or false, default false) puts the middle of the body's height in the middle of the picture (otherwise the creature stands a little high, above the bestiary's panel).
      // It empties the sparks first (so a full pool does not swallow the sparks of a phantom, which is mostly sparks), then steps one tick so the angle
      // and pose take hold (a walk needs about 1 s more to reach its full stride). Returns what galleryDraw() returns
      galleryShow(
        n: number,
        {
          yaw = 0,
          pose = 'stand',
          zoom = 1,
          pitch = null,
          center = false,
        }: { yaw?: number; pose?: string; zoom?: number; pitch?: number | null; center?: boolean } = {},
      ) {
        const list = this.gallery();
        if (typeof list === 'string') return list;
        if (!(Number.isInteger(n) && n >= 1 && n <= list.length)) return 'no such entry: ' + n + ' (1-' + list.length + ')';
        if (!['stand', 'walk', 'sleep'].includes(pose)) return 'no such pose: ' + pose;
        if (typeof yaw !== 'number' || !Number.isFinite(yaw)) return 'no such yaw: ' + yaw + ' (a number of radians)';
        if (typeof zoom !== 'number' || !(zoom >= 0.5 && zoom <= 3)) return 'no such zoom: ' + zoom + ' (0.5-3)';
        if (pitch !== null && (typeof pitch !== 'number' || !(pitch >= -0.3 && pitch <= 1.3)))
          return 'no such pitch: ' + pitch + ' (-0.3 to 1.3 radians)';
        if (typeof center !== 'boolean') return 'no such center: ' + center + ' (true or false)';
        buf.pN = 0;
        showBeast(n - 1);
        must(ui.gallery, '図鑑 ui.gallery').fix = { yaw, pose, zoom, pitch, center };
        testTick(false);
        return this.galleryDraw();
      },
      // draw the creature on show once more and look at what it drew (then drop it again, even when the drawing throws): how many glyphs,
      // how many sparks it threw (a phantom is mostly sparks: its glyphs show only now and then), how many of those glyphs and sparks hold
      // a number that is not finite (place, colour, glyph, size, speed, life), the box the glyphs fill (width and depth across the floor, the lowest and highest point),
      // and where the camera is (distance across the floor to the creature, height, and how far it looks down: pitch is the camera's, so negative is down),
      // the height of the point it looks at (aimY) and the straight distance to it (aimed), and what bounds it: the ceiling over the camera, the farthest the room lets it go,
      // and the ball round the aimed point that holds the body (only worked out for a zoom in; otherwise null)
      // (what the creature makes and keeps when first drawn, such as the sleeping shape or the aura's things, reads its own sequence m.rnd, which is the creature's g.rnd:
      // while probing it reads a probe sequence instead, and what the probe added to the creature is taken off again, so the next step makes it as if galleryDraw was never called)
      galleryDraw() {
        const m = ui.gallery && ui.gallery.mode === 'beast' && ui.gallery.m;
        if (!m) return null;
        const d0 = buf.dn,
          p0 = buf.pN,
          r0 = m.rnd,
          k0 = new Set(Object.keys(m));
        let d1 = d0,
          p1 = p0;
        try {
          m.rnd = keyedRand('gallery probe looks');
          withVisualRand(keyedRand('gallery probe'), () => drawMonster(m, clock.time));
          d1 = buf.dn;
          p1 = buf.pN;
        } finally {
          buf.dn = d0;
          buf.pN = p0;
          m.rnd = r0;
          for (const k of Object.keys(m)) if (!k0.has(k)) delete (m as unknown as Record<string, unknown>)[k];
        }
        const sparks = p1 - p0;
        let bad = 0;
        const lo = [1e9, 1e9, 1e9],
          hi = [-1e9, -1e9, -1e9];
        for (let k = d0; k < d1; k++) {
          let ok = true;
          for (let j = 0; j < 3; j++) {
            const v = dPos[k * 3 + j];
            if (!Number.isFinite(v) || !Number.isFinite(dCol[k * 3 + j])) ok = false;
            else {
              lo[j] = Math.min(nth(lo, j), v ?? NaN);
              hi[j] = Math.max(nth(hi, j), v ?? NaN);
            }
          }
          for (let j = 0; j < 4; j++) if (!Number.isFinite(dPar[k * 4 + j])) ok = false;
          if (!ok) bad++;
        }
        for (let k = p0; k < p1; k++)
          if ((['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'gl', 'sz', 'r', 'g', 'b'] as const).some((a) => !Number.isFinite(P[a][k]))) bad++;
        const f = (v: number) => +v.toFixed(2),
          n = d1 - d0;
        // it draws with a sequence of its own (the same each time), so looking does not move on the creature's sequence (showBeast) that the next steps read
        // hash: a fingerprint of what it drew (the glyphs' place, colour, glyph and size, the sparks' place and colour, to 1/1000), so a check can see that two draws are the same
        let h = 0x811c9dc5;
        const mix = (v: number | undefined) => {
          h = Math.imul(h ^ (Math.round((v ?? NaN) * 1000) | 0), 0x01000193) >>> 0;
        };
        for (let k = d0; k < d1; k++) {
          for (let j = 0; j < 3; j++) {
            mix(dPos[k * 3 + j]);
            mix(dCol[k * 3 + j]);
          }
          for (let j = 0; j < 4; j++) mix(dPar[k * 4 + j]);
        }
        for (let k = p0; k < p1; k++) for (const a of ['x', 'y', 'z', 'r', 'g', 'b'] as const) mix(P[a][k]);
        const cp = gfx.camera.position;
        // turn: the creature's angle from facing the camera (radians, -pi to pi), so a check can see it turn or hold still
        const turn = Math.atan2(Math.sin(m.yaw - player.yaw), Math.cos(m.yaw - player.yaw));
        // exposure: the eye's exposure now (the screen's brightness factor), so a check can see that it settles at once when a creature is shown
        return {
          name: m.ty.name,
          turn: +turn.toFixed(4),
          glyphs: n,
          sparks,
          bad,
          hash: h.toString(16),
          exposure: +lookup(must(gfx.finalPass, '後処理 gfx.finalPass').uniforms, 'uExposure').value.toFixed(4),
          box: n ? { w: f(nth(hi, 0) - nth(lo, 0)), d: f(nth(hi, 2) - nth(lo, 2)), y0: f(nth(lo, 1)), y1: f(nth(hi, 1)) } : null,
          camera: {
            dist: +Math.hypot(cp.x - m.x, cp.z - m.z).toFixed(3),
            height: +cp.y.toFixed(3),
            pitch: +gfx.camera.rotation.x.toFixed(3),
            aimY: +(must(ui.gallery, '図鑑 ui.gallery').aimY ?? 0).toFixed(3),
            aimed: +Math.hypot(cp.x - m.x, cp.y - (must(ui.gallery, '図鑑 ui.gallery').aimY ?? 0), cp.z - m.z).toFixed(3),
            ceil: +must(ceilAt(cp.x, cp.z), '天井の高さ').toFixed(3),
            roomR: +((must(must(ui.gallery, '図鑑 ui.gallery').room, '図鑑の部屋').far ?? NaN) - 0.8).toFixed(3),
            bodyR:
              (must(ui.gallery, '図鑑 ui.gallery').fix || must(ui.gallery, '図鑑 ui.gallery').view)?.bodyR !== undefined
                ? +must(
                    must(must(ui.gallery, '図鑑 ui.gallery').fix || must(ui.gallery, '図鑑 ui.gallery').view, '図鑑の向き').bodyR,
                    '体を包む球',
                  ).toFixed(3)
                : null,
          },
        };
      },
      // where a creature's body is drawn (the first one alive with this key, e.g. 'lord' or 'final'; only the body and the deep lord's tentacles, not its aura or the sign
      // over its head): its glyphs' box in the world (y0, y1: lowest and highest), the ceiling above it, their box on the screen in CSS pixels (x0..x1, y0..y1,
      // kept to the screen), and the share of glyphs that fall outside the screen (cut)
      monsterView(key: string) {
        const m = here.monsters.find((m) => m.key === key && !m.dead);
        if (!m) return null;
        const d0 = buf.dn,
          p0 = buf.pN;
        let d1 = d0;
        const pts: [number, number, number][] = [];
        try {
          gfx.drawBodyOnly = true;
          if (m.ty.habitat === 'deep') drawTentacles(m, clock.time);
          drawMonster0(m, clock.time);
          d1 = buf.dn;
          for (let k = d0; k < d1; k++) pts.push([nth(dPos, k * 3), nth(dPos, k * 3 + 1), nth(dPos, k * 3 + 2)]);
        } finally {
          gfx.drawBodyOnly = false;
          buf.dn = d0;
          buf.pN = p0;
        }
        if (!pts.length) return { key, x: m.x, z: m.z, glyphs: 0 };
        // 画面の範囲は、描いたカメラ（__test.cam で置いていれば、そのカメラ）で数える
        const W = must(gfx.canvas, '描く画面 gfx.canvas').clientWidth,
          H = must(gfx.canvas, '描く画面 gfx.canvas').clientHeight,
          v = new T.Vector3();
        let out = 0,
          y0 = 1e9,
          y1 = -1e9;
        const sb = [1e9, 1e9, -1e9, -1e9];
        withTestCam(() => {
          gfx.camera.updateMatrixWorld();
          for (const [x, y, z] of pts) {
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
            v.set(x, y, z).project(gfx.camera as unknown as Camera);
            const sx = ((v.x + 1) / 2) * W,
              sy = ((1 - v.y) / 2) * H;
            if (v.z > 1 || sx < 0 || sx > W || sy < 0 || sy > H) {
              out++;
              if (v.z > 1) continue;
            }
            sb[0] = Math.min(nth(sb, 0), sx);
            sb[1] = Math.min(nth(sb, 1), sy);
            sb[2] = Math.max(nth(sb, 2), sx);
            sb[3] = Math.max(nth(sb, 3), sy);
          }
        });
        const c = (a: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, a)));
        return {
          key,
          name: m.ty.name,
          form: m.ty.form,
          scale: m.ty.scale,
          x: m.x,
          z: m.z,
          glyphs: pts.length,
          world: { y0: +y0.toFixed(2), y1: +y1.toFixed(2) },
          ceil: +must(ceilAt(m.x, m.z), '天井の高さ').toFixed(2),
          screen: { x0: c(nth(sb, 0), 0, W), y0: c(nth(sb, 1), 0, H), x1: c(nth(sb, 2), 0, W), y1: c(nth(sb, 3), 0, H) },
          cut: +(out / pts.length).toFixed(3),
        };
      },
      // stop drawing a creature (the first one alive with this key) for a moment, and draw it again (on false). It stays in the level, so its light still shines
      hideMonster(key: string, on: boolean) {
        const m = here.monsters.find((m) => m.key === key && !m.dead);
        if (!m) return false;
        m.drawHide = !!on;
        return true;
      },
      // the shapes and first values of the creatures (from the from-th on): for each, its key, a fingerprint of its shape (each point's place, size, brightness, glyph and part,
      // to 1/1000) and the first values makeMonster gives it (facing, the way it heads, the wait, the walk's and the sway's phases, the eel's surfacing, the strike's pause), to 1/10000
      mobLooks(from = 0) {
        const f = (v: number | undefined) => (v === undefined ? '-' : (+v).toFixed(4));
        return here.monsters.slice(from).map((m) => {
          let h = 0x811c9dc5;
          for (const ch of JSON.stringify(
            m.form.map((p) => [
              +p.x.toFixed(3),
              +p.y.toFixed(3),
              +p.z.toFixed(3),
              +(p.s || 0).toFixed(3),
              +(p.b || 0).toFixed(3),
              p.g,
              p.part || '',
            ]),
          )) {
            h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
          }
          return `${m.key}:${(h >>> 0).toString(16)}:${[m.yaw, m.dirYaw, m.wait, m.walk, m.ph, m.surfT, m.atkCd].map(f).join(',')}`;
        });
      },
      // build the world again (buildWorld) and count its draws from the shared visual random mr(): there are none (statueForm in src/lib/build.ts). Draws straight from
      // Math.random are not counted (three.js names each geometry and mesh it makes with one, 4 draws each: so many for each level, and nothing to do with statues).
      // Also how many statue sites the level has (a room of statues or a remnant's inert ones, a vault's statues, a colossus), so a check knows statues were built.
      // It uses up the maze random, so the world it builds is not quite the level's own: for checks at the end of a page
      worldDraws() {
        let n = 0;
        withVisualRand(
          () => (n++, Math.random()),
          () => buildWorld(),
        );
        const statues = level().rooms.reduce(
          (s, r) =>
            s +
            (r.mdata && (r.mdata.type === 'statues' || (r.mdata.type === 'remnant' && r.mdata.inert && r.mdata.inert.length)) ? 1 : 0) +
            (r.vstat || []).length +
            (r.colossus !== undefined ? 1 : 0),
          0,
        );
        return { draws: n, statues };
      },
      // remove every creature (lords too), so a check is not upset by one that happens to be near
      clearAll() {
        const n = here.monsters.length;
        here.monsters = [];
        return n;
      },
      // knock creature n (counted from 0, as in state().monsters) back with speed kx kz, as a hit's knockback does
      knock(n: number, kx: number, kz: number) {
        const m = here.monsters[n];
        if (!m) return false;
        m.st = m.st || {};
        m.kx = kx;
        m.kz = kz;
        return true;
      },
      // creature n's cell, the cell it walks to, its body scale, position and knockback speed
      mob(n: number) {
        const m = here.monsters[n];
        return m
          ? {
              cx: m.cx,
              cz: m.cz,
              tx: m.tx,
              tz: m.tz,
              scale: m.ty.scale,
              x: m.x,
              z: m.z,
              yaw: m.yaw,
              kx: m.kx || 0,
              kz: m.kz || 0,
              hitT: Math.max(0, m.hitT || 0),
              glow: m.glow,
              alert: m.alert,
              aimed: m === ui.aimMon,
            }
          : null;
      },
      // every place a run can visit, for generation checks
      places() {
        return [
          ...Array.from({ length: FINAL_DEPTH }, (_, i) => ({ depth: i + 1 })),
          ...Object.keys(SPECIALS).map((k) => ({ inter: k })),
          ...Object.values(BRANCHES).flatMap((B) => Array.from({ length: B.len }, (_, i) => ({ branch: B.key, lvl: i + 1 }))),
          ...Object.values(REALMS).map((R) => ({ realm: R.key, depth: R.minD + 2 })),
        ];
      },
      // generate one level only (no meshes). It restores where the run is (seed, depth, branch, realm, special level),
      // but not what generate() rewrites (the history adv.HIST, the level random rand, the light tables): use it on a page of its own
      gen(seed: number, pl: { branch?: string; lvl?: number; inter?: string; realm?: string; depth?: number }) {
        const keep = { runSeed: adv.runSeed, depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter };
        try {
          adv.runSeed = seed >>> 0;
          here.branch = null;
          here.realm = null;
          here.inter = null;
          if (pl.branch) {
            const B = lookup(BRANCHES, pl.branch);
            here.depth = nth(B.at, 0);
            here.branch = { key: B.key, lvl: pl.lvl || 1, len: B.len, ret: here.depth + 1 };
          } else if (pl.inter) {
            here.depth = must(interAt(pl.inter), '特別な階の場所');
            here.inter = { key: pl.inter, after: here.depth };
          } else if (pl.realm) {
            here.depth = pl.depth || 4;
            here.realm = { key: pl.realm, ret: here.depth + 1 };
          } else here.depth = must(pl.depth, '深さ');
          const L: Level & { place?: string; final?: boolean } = generate(levelSeed(), here.depth);
          L.place = placeLabel();
          L.final = here.depth === FINAL_DEPTH && !here.branch && !here.realm && !here.inter;
          return L;
        } finally {
          ({ runSeed: adv.runSeed, depth: here.depth, branch: here.branch, realm: here.realm, inter: here.inter } = keep);
        }
      },
    };
}
