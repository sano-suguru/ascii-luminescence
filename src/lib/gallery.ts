// 見た物の記録・図鑑・試しの間。
// 見た物の記録 trackSeen、図鑑（一覧 galleryList・部屋 showroom・開く openBestiary・生き物を出す showBeast・カメラを動かす galleryWheel・galleryDrag・galleryZoom・
// galleryHold・galleryReset・毎フレームの updateGallery・説明 galleryDesc・galleryLine・renderGallery）、試しの間（部屋 galleryRoom・的 spawnDummy・開く openRange）と、
// 図鑑と試しの間の世界の中の文字 drawGallery。
import { lookup, must, nth } from './array.ts';
import { beastSamples, SHADOW_KING_SC } from './bodies/lords.ts';
import { css } from './color.ts';
import { type MonsterType, MTYPES } from './creatures.ts';
import { makeRune, makeStrong, resetRunes } from './gear.ts';
import { G } from './glyphs.ts';
import { renderHotbar } from './hotbar.ts';
import { sndInit } from './audio.ts';
import { newLevel } from './levels.ts';
import { ceilAt } from './lightmap.ts';
import { msg } from './log.ts';
import { returnToTitle } from './menu.ts';
import { makeMonster } from './monsters.ts';
import { DUMMY_KINDS, GALLERY_SLEEP, LORD_GAL } from './names.ts';
import { dyn, initDust, spawn } from './particles.ts';
import { keyedRand, mr, withVisualRand } from './random.ts';
import { clamp } from './rng.ts';
import { RES, RUNE_DEF, RUNE_TYPES, SLOT_MAX, TRAITS } from './runes.ts';
import { loadBeasts, recordBeast, saveSet } from './save.ts';
import { tryLock, updateResume } from './screens.ts';
import {
  adv,
  clock,
  fight,
  gear,
  gfx,
  type Gallery,
  type GalleryDummy,
  type GalleryEntry,
  type GalleryView,
  here,
  type Mob,
  player,
  saved,
  ui,
  vfx,
} from './state.ts';
import { renderStatus } from './status.ts';
import { boxText, padTo, wrapPlain } from './text.ts';
import { byInput } from './touch.ts';
import { CELL, MW, NCELL, TF } from './world.ts';

const level = () => must(here.D, '今の階 here.D');

// ---------------------------------------------------------------- what has been met and found (kept across runs); a developer switch shows everything
/** 見た物の記録の鍵（忘れられた獣は探索と名前ごと、主は支道ごと、王の影の二つ目の姿は final2） */
export const seenKey = (m: Mob): string =>
  m.ty.beast
    ? 'beast:' + adv.runSeed + ':' + m.ty.name
    : m.key === 'lord'
      ? 'lord:' + (here.branch ? here.branch.key : m.ty.sk)
      : m.key === 'final' && m.phase2
        ? 'final2'
        : m.key;
/** 近くに見えている生き物を、見た物として記録する（0.5 秒ごと。忘れられた獣は、出会った記録にも書く） */
export function trackSeen(dt: number): void {
  if (!ui.started || ui.gallery) return;
  ui.seenT -= dt;
  if (ui.seenT > 0) return;
  ui.seenT = 0.5;
  const n0 = saved.SEEN.size;
  for (const m of here.monsters) {
    if (m.dead || m.hidden || !m.visible || m.ty.dummy) continue;
    if (Math.hypot(m.x - player.x, m.z - player.z) < 26) {
      saved.SEEN.add(seenKey(m));
      if (m.ty.beast) recordBeast(m.ty);
    }
  }
  if (saved.SEEN.size !== n0) saveSet('al_seen', saved.SEEN);
}
/** 忘れられた獣の記録の1つ（src/lib/save.ts の recordBeast が書く欄） */
interface BeastRec {
  seed: number;
  name: string;
  col: MonsterType['col'];
  spec: MonsterType['spec'];
  lore: string;
  scale: number;
  fl: number;
  flier: boolean;
}
/** 図鑑の一覧（表の生き物・忘れられた獣（開発用モードでは見本も）・支道の主・王の影の二つの姿） */
export function galleryList(): GalleryEntry[] {
  const out: GalleryEntry[] = [];
  for (const k of Object.keys(MTYPES)) {
    if (k === 'lord' || k === 'final' || k === 'final2' || k === 'X' || k.startsWith('__') || k.startsWith('dummy')) continue;
    out.push({ key: k, ty: lookup(MTYPES, k) });
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 保存した獣の記録は、中身を確かめずに使う
  for (const rec of (loadBeasts() as BeastRec[]).concat(saved.DEVALL ? beastSamples() : []))
    out.push({
      key: 'beast:' + rec.seed + ':' + rec.name,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 記録に無い欄（速さ・光の尾）は無いまま（図鑑では動かない）
      ty: { ...rec, ch: 'X', form: 'beast', beast: true, light: 9, boss: false, verb: rec.lore } as unknown as MonsterType,
    });
  for (const [bk, L] of Object.entries(LORD_GAL)) {
    const base = MTYPES[L.base];
    if (!base) continue;
    out.push({
      key: 'lord:' + bk,
      ty: {
        ...base,
        sk: L.base,
        name: L.name,
        scale: L.scale,
        verb: L.verb,
        boss: true,
        col: L.base === 'L' ? [0.75, 0.9, 1.0] : base.col,
        // oxlint-disable-next-line typescript/consistent-type-assertions -- 表に無い支道（undefined）は元の生き物の見た目にする（表を文字の鍵で引くための型だけ）
        look: ({ crypt: null, lair: null, nest: null, snake: null } as Record<string, null | undefined>)[bk] || base.look,
        ...(bk === 'lair'
          ? { form: 'olddragon', light: 5 }
          : bk === 'sunken'
            ? { form: 'deepkraken', light: 5 }
            : bk === 'crypt'
              ? { form: 'lichking', light: 7 }
              : bk === 'nest'
                ? { form: 'spiderqueen', light: 6 }
                : bk === 'snake'
                  ? { form: 'nagaqueen', light: 6 }
                  : {}),
      },
    });
  }
  out.push({
    key: 'final',
    ty: {
      ...lookup(MTYPES, 'L'),
      ch: '&',
      look: null,
      form: 'shadowking',
      sk: 'final',
      name: '王の影',
      scale: SHADOW_KING_SC,
      col: [0.62, 0.48, 1.0],
      boss: true,
      lich: false,
      light: 6,
      verb: '光の届かない底で、長い剣を手に立っている。頭の上に、黒い太陽が浮かんでいる',
    },
  });
  out.push({
    key: 'final2',
    ty: {
      ...lookup(MTYPES, 'L'),
      ch: '&',
      look: null,
      form: 'shadowserpent',
      sk: 'final2',
      name: '王の影（底の闇）',
      scale: SHADOW_KING_SC,
      col: [0.62, 0.48, 1.0],
      boss: true,
      lich: false,
      light: 6,
      verb: '冠と外套を失い、底の闇から長い体をもたげた影',
    },
  });
  return out;
}
// a quiet room from a fixed maze: everything else is cleared away
/** 試しの間の部屋（決まったシードの深さ1の一番広い部屋。ほかの物は片付ける） */
export function galleryRoom(seed: number): { cx: number; cz: number; x: number; z: number } {
  here.depth = 1;
  here.branch = null;
  here.realm = null;
  here.inter = null;
  adv.runState.startChosen = true;
  adv.runState.altar1 = true;
  newLevel(seed);
  let best = null,
    bl = 0;
  for (const r of level().rooms) {
    if (r.cells.length > bl && !r.cave && !r.vault) {
      bl = r.cells.length;
      best = r;
    }
  }
  const cs = must(best, '試しの間の部屋').cells,
    cx = Math.round(cs.reduce((s, i) => s + (i % MW), 0) / cs.length),
    cz = Math.round(cs.reduce((s, i) => s + ((i / MW) | 0), 0) / cs.length);
  level().items = [];
  level().steles = [];
  here.monsters = [];
  fight.projs = [];
  fight.clouds = [];
  fight.boltFx = [];
  fight.zapQueue = [];
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 今の階に tall の欄は無い（いつも偽で、何もしない）
  const D = level() as unknown as { tall?: Uint8Array };
  if (D.tall) for (const i of cs) D.tall[i] = 0;
  return { cx, cz, x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL };
}
// ---------------------------------------------------------------- the bestiary: one creature at a time, turning slowly in the light
/** 図鑑の部屋（大広間の一番開けた所。カメラを向ける開けた向き dir と、その向きに床が続く距離 far も返す） */
export function showroom(): { cx: number; cz: number; x: number; z: number; dir: number; far: number } {
  // a run seed whose depth 4 is the great hall
  adv.runSeed = 7;
  here.depth = 4;
  here.branch = null;
  here.realm = null;
  here.inter = { key: 'bigroom', after: 4 };
  adv.runState.startChosen = true;
  adv.runState.altar1 = true;
  here.showroomGen = true;
  newLevel(424242);
  here.showroomGen = false;
  here.inter = null;
  const W = MW,
    open = (i: number) => i >= 0 && i < NCELL && level().tile[i] === TF && !level().liquid[i];
  let best = -1,
    bc = -1;
  for (let i = W * 2; i < NCELL - W * 2; i++) {
    if (!open(i)) continue;
    const cx = i % W,
      cz = (i / W) | 0;
    let c = 0;
    for (let r = 1; r <= 12; r++) {
      let ok = true;
      for (let a = 0; a < 16 && ok; a++) {
        const an = (a / 16) * Math.PI * 2,
          j = Math.round(cz + Math.sin(an) * r) * W + Math.round(cx + Math.cos(an) * r);
        if (!open(j)) ok = false;
      }
      if (!ok) break;
      c = r;
    }
    if (c > bc) {
      bc = c;
      best = i;
    }
  }
  const cx = best % W,
    cz = (best / W) | 0,
    x = (cx + 0.5) * CELL,
    z = (cz + 0.5) * CELL;
  // the room's events too (statues, eruptions, floods and the like start when the player comes near, and change the cells)
  level().items = [];
  level().steles = [];
  here.monsters = [];
  here.events = [];
  fight.projs = [];
  fight.clouds = [];
  fight.boltFx = [];
  fight.zapQueue = [];
  here.fixtures = here.fixtures.filter((f) => {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < 8 && f.li !== undefined && level().lights[f.li]) nth(level().lights, f.li).int = 0;
    return d >= 8;
  });
  for (const L of level().lights) if (Math.hypot(L.x - x, L.z - z) < 8) L.int = 0;
  // the open direction for the camera
  let dir = 0,
    far = 0;
  for (let a = 0; a < 16; a++) {
    const an = (a / 16) * Math.PI * 2;
    let d = 0;
    for (let r = 0.5; r < 30; r += 0.5) {
      const j = Math.floor((z + Math.sin(an) * r) / CELL) * W + Math.floor((x + Math.cos(an) * r) / CELL);
      if (!open(j)) break;
      d = r;
    }
    if (d > far) {
      far = d;
      dir = an;
    }
  }
  return { cx, cz, x, z, dir, far };
}
/** 図鑑を開く（タイトルから。見た生き物だけを並べる。開発用モードでは全部） */
export function openBestiary(): void {
  const all = galleryList(),
    list = saved.DEVALL ? all : all.filter((e) => saved.SEEN.has(e.key));
  must(ui.introEl, 'タイトルの画面').classList.add('gone');
  // 部屋を作る前に入れる（階を作る処理が、図鑑の中だと分かるように。探索の届いた深さや墓に触れない）
  ui.gallery = { mode: 'beast', list, all: all.length, idx: 0, room: null, m: null, t: 0 };
  ui.gallery.room = showroom();
  // the room's fittings and lamps as they are now: each creature shown puts them back (showBeast)
  ui.gallery.still = structuredClone({ fixtures: here.fixtures, lights: level().lights });
  showBeast(0);
  renderGallery();
  must(document.getElementById('gal'), '#gal').classList.add('show');
}
/** 図鑑の i 番目の生き物を出す（一覧の端で回る） */
export function showBeast(i: number): void {
  const g = must(ui.gallery, '図鑑');
  here.monsters = [];
  g.m = null;
  g.fix = null;
  g.view = null;
  g.drag = null;
  g.aimY = undefined;
  g.rNow = undefined;
  if (!must(g.list, '図鑑の一覧').length) {
    renderGallery();
    return;
  }
  g.idx = (i + must(g.list, '図鑑の一覧').length) % must(g.list, '図鑑の一覧').length;
  const e = nth(must(g.list, '図鑑の一覧'), g.idx);
  // while a creature is on show, the visual random (mr) reads a sequence of its own, from its key: here (its shape and first values, then the falling dust made anew),
  // and in each step of the game (stepTick). So draws elsewhere (before it was shown, or outside the game's steps) do not change the picture.
  // The player stands at the room's middle until the first step puts it at the camera: the dust is made round the player (and made again when it strays
  // 16 away), and a few auras look at how far the player is, so neither hangs on where the last creature's camera was. For the same reason the eye's
  // exposure and the fog settle at once, in the step after the camera is placed (settle: 1 waits for updateGallery to place it, 2 settles in updateAtmosphere).
  // The fittings and lamps go back to how they were when the bestiary opened: they keep counters that run only while the player is within 46
  // (the sparks' f.acc, f.next, the lamps' fade and boost). The lamps are refilled in place, the same number as then
  {
    const s = structuredClone(must(g.still, '図鑑を開いた時の備品と灯り')),
      Ls = level().lights;
    here.fixtures = s.fixtures;
    Ls.length = s.lights.length;
    s.lights.forEach((S, k) => {
      const L = Ls[k];
      if (!L) {
        Ls[k] = S;
        return;
      }
      // oxlint-disable-next-line typescript/no-dynamic-delete, typescript/consistent-type-assertions -- 灯りの欄を全部消してから、開いた時の欄を入れる（欄を名前で消すための型だけ）
      for (const a of Object.keys(L)) delete (L as unknown as Record<string, unknown>)[a];
      Object.assign(L, S);
    });
  }
  MTYPES['__gal'] = e.ty;
  g.rnd = keyedRand('gallery ' + e.key);
  player.x = must(g.room, '図鑑の部屋').x;
  player.z = must(g.room, '図鑑の部屋').z;
  g.settle = 1;
  // makeMonster is handed g.rnd as the creature's own sequence (m.rnd), so what it makes when first drawn (in the first step) reads it too
  const m = withVisualRand(g.rnd, () => {
    const m = makeMonster({ key: '__gal', cx: must(g.room, '図鑑の部屋').cx, cz: must(g.room, '図鑑の部屋').cz, g: -1, lead: true }, g.rnd);
    initDust();
    return m;
  });
  m.x = must(g.room, '図鑑の部屋').x;
  m.z = must(g.room, '図鑑の部屋').z;
  m.sleep = false;
  m.hidden = false;
  m.wait = 1e9;
  m.galShow = true;
  m.heartOn = true;
  m.rise = 1;
  m.surf = 1;
  m.yaw = 0;
  if (e.ty.form === 'eel') m.y = 0;
  g.water = e.ty.form === 'kraken' || e.ty.form === 'deepkraken' || e.ty.form === 'eel' || e.ty.form === 'fish' || e.ty.habitat === 'deep';
  if (g.water && e.ty.form === 'kraken') m.y = -0.7;
  if (e.ty.form === 'deepkraken') m.y = 0;
  if (e.ty.habitat === 'bog') m.y = 0;
  here.monsters.push(m);
  g.m = m;
  g.t = 0;
  renderGallery();
}
// the player's hands on the bestiary: the wheel moves in and out (the distance from 0.6 to 2 times the usual one), a drag with the left button turns the creature
// (across) and moves the camera up and down round it (up and down), R puts it back. After GAL_IDLE s with no hands on it, the creature turns by itself again;
// the distance and the angle stay. Moving to another creature puts everything back (showBeast)
// GAL_EASE: in the player's view, the aim and the distance move toward new ones at this rate (per second; most of the way in about half a second),
// so the camera does not jump when the wheel turns or a dragon wakes or falls asleep (its body changes over about a second)
export const GAL_IDLE = 3,
  GAL_ZOOM = [0.5, 1 / 0.6] as const,
  GAL_EASE = 8;
// a new view starts its eased aim and distance from where the camera is now (g.aimY, g.rNow), so the first turn of the wheel does not jump either
/** プレイヤーが動かすカメラ（無ければ作る）。動かした時刻を今にする */
export function galleryView(): GalleryView {
  const g = must(ui.gallery, '図鑑');
  if (!g.view) g.view = { zoom: 1, pitch: null, t: must(g.t, '図鑑の秒'), aimS: g.aimY, rS: g.rNow };
  g.view.t = must(g.t, '図鑑の秒');
  return g.view;
}
// dy: the wheel's movement in pixels (one notch of a mouse wheel is about 100, a 10% step; a trackpad sends many small ones, each a small step)
/** ホイールで寄る・引く */
export function galleryWheel(dy: number): void {
  const g = ui.gallery;
  if (!g || g.mode !== 'beast' || !g.m || g.fix || !dy) return;
  const v = galleryView();
  v.zoom = clamp(v.zoom * Math.pow(1.1, -clamp(dy, -100, 100) / 100), GAL_ZOOM[0], GAL_ZOOM[1]);
}
/** ドラッグで回す（横）・見下ろす（縦） */
export function galleryDrag(dx: number, dy: number): void {
  const g = ui.gallery;
  if (!g || g.mode !== 'beast' || !g.m || g.fix) return;
  const v = galleryView();
  // the first move up or down starts from where the camera is now: its angle (tiltNow), and its distance from the point it looks at as a part of R (stretchNow)
  g.m.yaw += dx * 0.01;
  if (dy) {
    if (v.pitch === null) v.stretch = g.stretchNow ?? 1;
    v.pitch = clamp((v.pitch ?? g.tiltNow ?? 0) + dy * 0.006, -0.3, 1.3);
  }
}
// fingers (src/lib/touchpad.ts): a pinch multiplies the distance's zoom by f, and while a finger is on the screen the creature does not turn by itself (as with g.drag for the mouse)
/** 2本指でつまんで寄る・引く（距離の倍率に f を掛ける） */
export function galleryZoom(f: number): void {
  const g = ui.gallery;
  if (!g || g.mode !== 'beast' || !g.m || g.fix || !(f > 0)) return;
  const v = galleryView();
  v.zoom = clamp(v.zoom * f, GAL_ZOOM[0], GAL_ZOOM[1]);
}
/** 指が触れている間は、ひとりでに回さない */
export function galleryHold(on: boolean): void {
  const g = ui.gallery;
  if (!g || g.mode !== 'beast') return;
  g.drag = on ? { x: 0, y: 0 } : null;
  galleryView();
}
/** 向きと距離を戻す */
export function galleryReset(): void {
  const g = ui.gallery;
  if (!g || g.mode !== 'beast') return;
  g.view = null;
  g.drag = null;
}
/** 図鑑と試しの間の一歩（図鑑：生き物を回し、姿を変え、カメラを置く。試しの間：倒れた的を起こす） */
export function updateGallery(dt: number): void {
  if (!ui.gallery) return;
  const g = ui.gallery;
  // g.fix (set only by __test.galleryShow): hold the creature at one angle (yaw from facing the camera) and one pose, and move the camera:
  // zoom divides the distance (still kept inside the room, and a zoom in stops outside the creature's body), pitch puts the camera that many radians above
  // the creature's middle, kept under the ceiling (null: the height the bestiary works out from the creature's size).
  // g.view (set by the player's wheel and drag, see galleryWheel): the same zoom and pitch; while the player handles it, and for GAL_IDLE s after, the creature stops turning
  if (g.mode === 'beast' && g.m) {
    const m = g.m,
      sc = m.ty.scale || 1,
      fix = g.fix,
      cam = fix || g.view;
    g.t = must(g.t, '図鑑の秒') + dt;
    const walking = fix ? fix.pose === 'walk' : Math.floor(g.t / 4) % 2 === 1;
    const handled = !!(g.drag || (g.view && g.t - g.view.t < GAL_IDLE));
    m.moving += ((walking ? 1 : 0) - m.moving) * Math.min(1, dt * 4);
    m.walk += dt * 2.2 * m.moving;
    if (!fix && !handled) m.yaw += dt * 0.45;
    m.x = must(g.room, '図鑑の部屋').x;
    m.z = must(g.room, '図鑑の部屋').z;
    // the conjurer's spirit blades circle it as they do in the dungeon while it has not noticed the player (the bestiary does not run updateMonster)
    if (m.blades)
      for (const b of m.blades) {
        b.a += dt * 1.6;
        b.x = m.x + Math.cos(b.a) * 0.9;
        b.y = 1.55 + Math.sin(b.a * 2) * 0.2;
        b.z = m.z + Math.sin(b.a) * 0.9;
      }
    if (fix) {
      m.sleep = fix.pose === 'sleep';
      if (m.sleep) m.moving = 0;
    } else if (m.ty.form === 'dragon' && !m.ty.boss) {
      m.sleep = Math.floor(g.t / 6) % 2 === 0;
      if (m.sleep) {
        m.moving = 0;
      }
    }
    {
      const ty = m.ty;
      if (ty.flier) m.y = (1.6 + Math.sin(g.t * 2.2) * 0.15) * Math.max(1, sc * 0.7);
      else if (ty.fl) m.y = ty.fl + Math.sin(g.t * 1.3) * 0.12;
    }
    // how far and how high the camera sits, by form (the old dragon's long neck brings its head close when it turns this way: 1.05 sits a little farther and higher than 1)
    const tall = m.ty.beast
        ? 1.3
        : m.ty.form === 'lichking'
          ? 1.6
          : m.ty.form === 'spiderqueen'
            ? 1.25
            : m.ty.form === 'nagaqueen'
              ? 1.3
              : m.ty.form === 'olddragon'
                ? 1.05
                : m.ty.form === 'shadowking'
                  ? 1.75
                  : m.ty.form === 'shadowserpent'
                    ? 1.9
                    : m.ty.form === 'deepkraken'
                      ? 2.0
                      : 1,
      zoom = cam ? cam.zoom : 1,
      tilt = cam ? cam.pitch : null;
    // the shape the camera is fitted to: a sleeping dragon or beast curls up into its own sleeping shape, which is built the first time it is drawn asleep;
    // until then (one tick) the centre waits for it, and the aim and the ball below keep the last ones (both are worked out again whenever the shape changes, as a dragon wakes and sleeps)
    const shape = cam ? (m.sleep && ((m.ty.form === 'dragon' && !m.ty.boss) || m.ty.beast) ? m.formSleep : m.form) : null;
    // center (set only by __test.galleryShow): look at the middle of the body's height (halfway between its lowest and highest point, worked out once per creature)
    // and put it in the middle of the picture; otherwise turn the camera a little below the point it aims at, so the creature stands high, above the bestiary's panel
    if (fix && fix.center && fix.midOff === undefined && shape) {
      let lo = Infinity,
        hi = -Infinity;
      for (const p of shape) {
        const y = (p.y || 0) * sc;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      fix.midOff = lo <= hi ? (lo + hi) / 2 : 0;
    }
    // the player's zoom in (g.view): the closer the camera, the more the aim rises from the usual point to the middle of the body's height, so a tall creature's head stays in the picture
    if (!fix && g.view && shape && g.view.midFor !== shape) {
      let lo = Infinity,
        hi = -Infinity;
      for (const p of shape) {
        const y = (p.y || 0) * sc;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      g.view.midFor = shape;
      g.view.midOff = lo <= hi ? (lo + hi) / 2 : 0;
    }
    const lift = !fix && g.view && g.view.midOff !== undefined ? clamp((zoom - 1) / (GAL_ZOOM[1] - 1), 0, 1) : 0,
      usual = m.y + (m.ty.flier ? 0 : 0.6 * sc * tall);
    const centered = !!(fix && fix.center && fix.midOff !== undefined);
    let ty2 = centered
      ? Math.max(0.3, m.y + must(must(fix, '止めた向き').midOff, '体の高さの真ん中'))
      : Math.max(
          0.3,
          lift ? usual + lift * Math.max(0, m.y + must(must(g.view, '図鑑のカメラ').midOff, '体の高さの真ん中') - usual) : usual,
        );
    const ease = Math.min(1, dt * GAL_EASE);
    if (!fix && g.view) {
      g.view.aimS = g.view.aimS === undefined ? ty2 : g.view.aimS + (ty2 - g.view.aimS) * ease;
      ty2 = g.view.aimS;
    }
    // a zoom in stops outside a ball round the point the camera looks at, wide enough to hold every point of the body (worked out again when the shape or that point changes)
    if (cam && zoom > 1 && shape && (cam.bodyFor !== shape || Math.abs((cam.bodyAt ?? NaN) - ty2) > 0.01)) {
      cam.bodyFor = shape;
      cam.bodyAt = ty2;
      cam.bodyR = shape.reduce(
        (r, p) => (p.part === 'train' ? r : Math.max(r, Math.hypot((p.x || 0) * sc, (p.y || 0) * sc + m.y - ty2, (p.z || 0) * sc))),
        0,
      );
    }
    const ball = cam && zoom > 1 && cam.bodyR !== undefined ? cam.bodyR + 0.8 : 0;
    const want = ((3.0 + 2.0 * sc) * tall) / zoom,
      a = (must(g.room, '図鑑の部屋').dir ?? NaN) + 0.25;
    let R = Math.max(Math.min(2, 2 / zoom), ball, Math.min(want, (must(g.room, '図鑑の部屋').far ?? NaN) - 0.8));
    if (!fix && g.view) {
      g.view.rS = g.view.rS === undefined ? R : g.view.rS + (R - g.view.rS) * ease;
      R = g.view.rS;
    }
    g.rNow = R;
    // Rt: how far the camera sits from the point it looks at when it has a pitch (the player's view keeps the distance it had before the first move up or down, see galleryDrag)
    const Rt = R * ((cam && cam.stretch) || 1);
    let Rh = tilt === null ? R : Rt * Math.cos(tilt),
      ch;
    if (tilt === null) ch = (1.0 + 0.75 * sc) * tall + (m.ty.flier || m.ty.fl > 0.5 ? m.y * 0.5 : 0);
    else {
      ch = Math.max(
        0.3,
        Math.min(
          ty2 + Rt * Math.sin(tilt),
          (ceilAt(must(g.room, '図鑑の部屋').x + Math.cos(a) * Rh, must(g.room, '図鑑の部屋').z + Math.sin(a) * Rh) ?? NaN) - 0.4,
        ),
      );
      // held by the floor or the ceiling: step back across the floor so the camera stays R from the point it looks at (but not out of the room)
      Rh = Math.min(
        Math.max(Rh, Math.sqrt(Math.max(0, Rt * Rt - (ch - ty2) * (ch - ty2)))),
        Math.max(Rh, (must(g.room, '図鑑の部屋').far ?? NaN) - 0.8),
      );
    }
    const cx = must(g.room, '図鑑の部屋').x + Math.cos(a) * Rh,
      cz = must(g.room, '図鑑の部屋').z + Math.sin(a) * Rh;
    player.x = cx;
    player.z = cz;
    player.yaw = Math.atan2(-(must(g.room, '図鑑の部屋').x - cx), -(must(g.room, '図鑑の部屋').z - cz));
    player.pitch = Math.atan2(ty2 - ch, Rh) - (centered ? 0 : 0.16);
    g.aimY = ty2;
    g.tiltNow = Math.atan2(ch - ty2, Rh);
    g.stretchNow = Math.hypot(Rh, ch - ty2) / R;
    if (fix) m.yaw = player.yaw + fix.yaw;
    if (!!m.sleep !== !!g.shownSleep) galleryLine(); // a dragon fell asleep or woke: show the line that fits
    gfx.camera.position.set(cx, ch, cz);
    gfx.camera.rotation.set(player.pitch, player.yaw, 0);
    if (g.settle === 1) g.settle = 2; // the camera is placed: the eye settles in the next step
    if (R < want - 0.2) {
      must(gfx.U, '分け合う値').uCamP.value.set(cx, ch, cz);
      must(gfx.U, '分け合う値').uCutP.value.set(must(g.room, '図鑑の部屋').x, ty2, must(g.room, '図鑑の部屋').z);
      must(gfx.U, '分け合う値').uCut.value = 1;
    } else must(gfx.U, '分け合う値').uCut.value = 0;
    vfx.zapFlash = {
      x: must(g.room, '図鑑の部屋').x + Math.cos(a) * Rh * 0.6,
      y: 2.2 + 1.2 * sc,
      z: must(g.room, '図鑑の部屋').z + Math.sin(a) * Rh * 0.6,
      col: [0.5, 0.48, 0.45],
      t: 999,
      r: 7 + 3 * sc,
    };
  }
  if (g.mode === 'range') {
    for (const d of must(g.dummies, '試しの間の的')) {
      if (must(d.m, '的').dead) {
        d.respawn = (d.respawn ?? NaN) - dt;
        if (d.respawn <= 0) spawnDummy(d);
      } else {
        d.respawn = 1.5;
        must(d.m, '的').dT = Math.max(0, (must(d.m, '的').dT || 0) - dt);
        if ((must(d.m, '的').dT ?? NaN) <= 0) must(d.m, '的').dsum = 0;
      }
    }
  }
}
// the two lines under the name follow the creature: while it sleeps, its sleeping line (GALLERY_SLEEP: only the dragon has one), otherwise what it does awake.
// Each line is padded to the same width, so the frame around them never moves when the words change
/** 名前の下の説明の2行（同じ幅に埋める） */
export function galleryDesc(g: Gallery): string[] {
  const e = must(g.list, '図鑑の一覧')[must(g.idx, '図鑑の番号')],
    ty = e && e.ty,
    GW = 64;
  g.shownSleep = !!(g.m && g.m.sleep);
  const desc = wrapPlain(
    ty ? (g.shownSleep && GALLERY_SLEEP[must(e, '図鑑の1つ').key]) || ty.verb || '' : '探索で出会ったものが、ここに並ぶ',
    GW - 4,
  );
  while (desc.length < 2) desc.push('');
  return desc.slice(0, 2).map((l) => padTo(l, GW - 4));
}
// change only those two lines (rebuilding the whole panel would swap the buttons under a press in progress)
/** 説明の2行だけを書き直す */
export function galleryLine(): void {
  const g = ui.gallery,
    el = document.getElementById('gal');
  if (!g || !el) return;
  const spans = el.querySelectorAll('span[data-gd]');
  if (spans.length !== 2) {
    renderGallery();
    return;
  }
  const desc = galleryDesc(g);
  spans.forEach((s, i) => {
    s.textContent = nth(desc, i);
  });
}
/** 図鑑のパネルを描く */
export function renderGallery(): void {
  const el = document.getElementById('gal');
  if (!el || !ui.gallery) return;
  const g = ui.gallery,
    f = (t: string) => `<span class="f">${t}</span>`;
  if (g.mode === 'beast') {
    const e = must(g.list, '図鑑の一覧')[must(g.idx, '図鑑の番号')],
      ty = e && e.ty,
      GW = 64;
    const head = ty
      ? `<b style="color:${css(ty.col || [1, 1, 1])}">${ty.ch === '&' ? '&amp;' : ty.ch}</b> <b>${ty.name}</b>`
      : '<span class="lab">まだ、何にも出会っていない</span>';
    const desc = galleryDesc(g);
    el.innerHTML = boxText(
      [
        f('+-- 図鑑 ---'),
        `${f('|')} ${head}`,
        `${f('|')} <span class="lab" data-gd="0">${nth(desc, 0)}</span>`,
        `${f('|')} <span class="lab" data-gd="1">${nth(desc, 1)}</span>`,
        f('|'),
        `${f('|')} <button class="row" data-g="prev">[&lt;]</button> ${String(must(g.list, '図鑑の一覧').length ? must(g.idx, '図鑑の番号') + 1 : 0).padStart(2, ' ')} / ${String(must(g.list, '図鑑の一覧').length).padStart(2, ' ')}  <span class="lab">（見つけた数 ${String([...saved.SEEN].filter((k) => k).length).padStart(2, ' ')} / ${must(g.all, '図鑑の全部の数')}）</span> <button class="row" data-g="next">[&gt;]</button>`,
        `${f('|')} <button class="row" data-g="back">[タイトルへ戻る]</button>   <span class="lab">${byInput('← → で切り替え　Esc で戻る', '')}</span>`,
        `${f('|')} ${byInput('<span class="lab">ドラッグで回す　ホイールで寄る　R で戻す</span>', '<span class="lab">指で回す　つまんで寄る</span>  <button class="row" data-g="reset">[向きを戻す]</button>')}`,
        f('+---'),
      ],
      GW,
    );
    for (const b of el.querySelectorAll<HTMLButtonElement>('button[data-g]'))
      b.onclick = () => {
        const k = b.dataset['g'];
        if (k === 'prev') showBeast(must(g.idx, '図鑑の番号') - 1);
        else if (k === 'next') showBeast(must(g.idx, '図鑑の番号') + 1);
        else if (k === 'reset') galleryReset();
        else returnToTitle();
      };
  }
}
// ---------------------------------------------------------------- the testing chamber: every rune found so far, and dummies that get back up
/** 試しの間の的の種類を、生き物の表 MTYPES と性質の効き目 RES に足す（ページの用意で1回。src/lib/boot.ts の boot が呼ぶ） */
export function addDummyKinds(): void {
  for (const d of DUMMY_KINDS)
    MTYPES[d.k] = {
      ch: '+',
      name: d.name,
      col: d.col,
      form: 'humanoid',
      scale: 0.95,
      speed: 0,
      fl: 0,
      light: 1.6,
      trail: 0,
      dummy: true,
      verb: '藁と石で組まれた的。何度倒れても、また起き上がる',
    };
  RES['dummyF'] = { fire: 0.2, ice: 2 };
  RES['dummyP'] = { poison: 0.2, fire: 2 };
  RES['dummyT'] = { thunder: 2, fire: 0.5 };
}
/** 試しの間の的を起こす（新しく作り、土ぼこりを出す） */
export function spawnDummy(d: GalleryDummy): void {
  const m = makeMonster({ key: d.k, cx: Math.floor(d.x / CELL), cz: Math.floor(d.z / CELL), g: -1, lead: true });
  m.x = d.x;
  m.z = d.z;
  m.yaw = 0;
  m.sleep = false;
  m.wait = 1e9;
  m.noticed = false;
  m.dsum = 0;
  here.monsters.push(m);
  d.m = m;
  d.respawn = 1.5;
  for (let q = 0; q < 14; q++) {
    const a = mr() * 6.28;
    spawn(d.x, 0.4, d.z, Math.cos(a), 0.6 + mr(), Math.sin(a), 0.6, G('.'), 0.12, 1.2, 1.1, 0.9, 0);
  }
}
/** 試しの間を開く（タイトルから。見つけた武器とルーン・特性 Lv3 と Lv5 の武器を袋に入れ、的を並べる） */
export function openRange(): void {
  must(ui.introEl, 'タイトルの画面').classList.add('gone');
  sndInit();
  resetRunes();
  ui.gallery = { mode: 'range', room: null, dummies: [] };
  const room = (ui.gallery.room = galleryRoom(52571)); // 部屋を作る前に入れる（図鑑と同じ）
  const types = Object.keys(RUNE_DEF).filter(
    (t) =>
      lookup(RUNE_DEF, t).cat !== 'open' &&
      lookup(RUNE_DEF, t).cat !== 'sub' &&
      (lookup(RUNE_DEF, t).cat !== 'mod' || RUNE_TYPES.mod.includes(t)) &&
      (saved.DEVALL || saved.RSEEN.has(t) || t === 'blade' || t === 'bolt' || lookup(RUNE_DEF, t).cat === 'mod'),
  );
  gear.bag = [];
  for (const t of types) gear.bag.push(makeRune(t));
  for (const h of ['L', 'R'] as const) {
    must(gear.hands, '手')[h].slotN = SLOT_MAX;
    while (must(gear.hands, '手')[h].slots.length < SLOT_MAX) must(gear.hands, '手')[h].slots.push(null);
  }
  for (const t of RUNE_TYPES.mod) gear.bag.push(makeStrong(t));
  for (const w of RUNE_TYPES.atk)
    for (const k of Object.keys(lookup(TRAITS, w)))
      for (const lv of [3, 5]) {
        const ru = makeRune(w);
        ru.traits = [{ k, lv }];
        gear.bag.push(ru);
      }
  must(gear.hands, '手').B = must(gear.hands, '手').B || { b0: null, b1: null };
  adv.runState.bodyOpen = 2;
  DUMMY_KINDS.forEach((dk, j) => {
    const d = { k: dk.k, x: room.x + (j - 1.5) * 2.4, z: room.z - 5 };
    must(must(ui.gallery, '試しの間').dummies, '試しの間の的').push(d);
    spawnDummy(d);
  });
  player.x = room.x;
  player.z = room.z + 3;
  player.yaw = 0;
  player.pitch = -0.05;
  player.hp = adv.PLAYER_MAX;
  adv.dead = false;
  ui.started = true;
  document.body.classList.add('started');
  adv.runStats = { kills: 0, t0: clock.time };
  must(gfx.canvas, '描く画面').focus();
  tryLock();
  updateResume();
  renderHotbar();
  renderStatus();
  setTimeout(() => {
    msg(
      '<b style="color:#bfe4ff">+</b>試しの間。<b>' +
        byInput('Tab', '[装備]') +
        '</b> で武器・ルーン・護符を自由に付け替えられる（ここでは付け替えが一瞬で済む）。',
    );
    msg(
      '<span class="lab">的の人形は動かず、何度倒れても起き上がる。頭の上の数字は、直前に与えたダメージの合計。メニューからタイトルへ戻れる。</span>',
    );
  }, 400);
}
/** 図鑑（生き物の足もとの輪と、水に住む物のさざ波）と試しの間（的の頭の上のダメージの数）の世界の中の文字 */
export function drawGallery(t: number): void {
  if (!ui.gallery) return;
  if (ui.gallery.mode === 'beast' && ui.gallery.m) {
    const g = ui.gallery,
      sc = ui.gallery.m.ty.scale || 1,
      r = 0.9 + 0.7 * sc,
      n = Math.round(18 + 8 * sc);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + t * 0.05;
      dyn(
        must(g.room, '図鑑の部屋').x + Math.cos(a) * r,
        0.06,
        must(g.room, '図鑑の部屋').z + Math.sin(a) * r,
        G('.'),
        0.1,
        0.35,
        0.33,
        0.4,
      );
    }
    if (g.water)
      for (let k = 0; k < Math.round(30 * sc); k++) {
        const a = k * 2.399,
          rr = (0.4 + ((k * 0.37) % 1)) * 1.6 * sc;
        dyn(
          must(g.room, '図鑑の部屋').x + Math.cos(a) * rr,
          0.05 + 0.03 * Math.sin(t * 2 + k),
          must(g.room, '図鑑の部屋').z + Math.sin(a) * rr,
          G('~'),
          0.22,
          0.25,
          0.55,
          0.9,
        );
      }
  }
  if (ui.gallery.mode === 'range') {
    for (const d of must(ui.gallery.dummies, '試しの間の的')) {
      const m = d.m;
      if (!m || m.dead || !((m.dsum ?? NaN) > 0)) continue;
      const s = String(Math.round(m.dsum ?? NaN)),
        y = m.y + 2.2;
      for (let k = 0; k < s.length; k++) dyn(m.x + (k - (s.length - 1) / 2) * 0.26, y, m.z, G(nth(s, k)), 0.32, 2.6, 2.3, 1.6);
    }
  }
}
