// 自動で遊ぶ（?auto=<周の数>）：本物の iPhone で、人が触らずに速さを確かめるため。決まった台本（AUTO_STEPS）を、ページの中で指の事件を作って、本物の時計で流す。
// 段ごとのフレームの数・平均・一番遅い1回・遅いフレームの数を autoSt に貯め、診断の記録（src/lib/diag.ts）が欄 auto に書く（Claude が ArtifactData の道具で読む）。
// tools/auto-run.mjs も、同じ台本をこの環境で、遅さを足して流す。
// 始め方は2つ：
//   - タイトルの［自動で遊ぶ］：claude.ai の Artifact の中で、持ち主が開いた時だけ出す（診断の記録が書かれる時。src/lib/diag.ts の initDiag が offerAuto を呼ぶ）。AUTO_LAPS 周。
//     claude.ai は、Artifact のリンクに付けた ?auto をゲームのページに渡さないので、iPhone ではこちらで始める
//   - URL の ?auto=<n>：n 周（1 から 9。3周でおよそ5分）。?auto=quick：短い1周（各段を短くし、階段は1回）。tests/auto.mjs と tools/auto-run.mjs が使う
// 決まり：
//   - 自動で遊んでいる間は、ゲームの保存（al_ で始まる名前）を localStorage に書かない（autoGuard。伝承・解放・見た生き物・墓・視点・音量などを、
//     ふだん遊ぶ時の記録に残さないため。ほかの名前は書く。同じページのほかの仕組みを止めないように）。
//     開発用モードはオンにしない（?dev=1 は al_dev を書き残す）。生き物を置く・階段の前へ移る・体力を減らすのは、古い JS の dbg の中身を直に呼ぶ（AutoHooks）
//   - 探索のシードは、1周目だけ AUTO_SEED（毎回同じ迷宮で、前の結果と比べるため）。死んで［新しい探索へ］を押した後は、ゲームが選ぶ
//   - 生き物に倒されないように、死ぬ段の前までは開発用の不死（ui.godMode）にする
//   - 縦向きの間（探索が止まる）と、ページが隠れている間は待ち、その段の数を数えない。戻った時に、止まって開いたメニューを閉じる
//   - レベルアップの画面は1つ目を選び、祭壇の画面は閉じる（開いている間はゲームが止まり、ゲームの時刻で待つ所が終わらないため。閉じた回数を段の shut に書く）
//   - 止めた時・段の中で例外が起きた時も、台本が置いた指は全部離す（離さないと、スティックが倒れたままで歩き続け、本物の指のスティックも出ない）
//   - 画面が消えないように、Wake Lock を頼む（断られたら、その理由を記録に書く）
//   - 指の事件は合成した物（isTrusted が false）。順番や間は本物の指と違いうるので、手触りは確かめない。音は鳴らない（自動再生の決まり）ので確かめない
//   - テスト用モード（?test=1）では動かない（時計が止まっているため）
import { must } from './array.ts';
import { chooseLevel, closeAltar } from './panels.ts';
import { TEST, adv, clock, here, player, ui } from './state.ts';
import { CELL, MW, TF } from './world.ts';

/** タイトルの［自動で遊ぶ］で流す周の数（およそ5分） */
export const AUTO_LAPS = 3;
/** 1周目の探索のシード */
export const AUTO_SEED = 202;
/** これより長くかかった1フレームを、段の遅いフレームに数える（ミリ秒。診断の記録の slow と同じ） */
const SLOW_MS = 100;

/** 古い JS（src/game/23-debug.js の dbg）から受け取る処理 */
export interface AutoHooks {
  /** 階段の2マス手前に、階段を向いて立つ。できなければ false */
  toStairs: () => boolean;
  /** 近くの生き物を消す（主・小さな生き物は残す） */
  clear: () => void;
  /** プレイヤーに n のダメージ（不死を外して） */
  hurt: (n: number) => void;
  /** 生き物を置く */
  summon: (key: string, cell: number) => void;
}

/** 1つの段の数 */
export interface AutoStep {
  lap: number;
  k: string;
  /** かかった秒（待っていた間も含む） */
  sec: number;
  /** 数えたフレームの数・平均の fps・一番遅い1回（ミリ秒）・遅いフレームの数 */
  frames: number;
  avg: number;
  worst: number;
  slow: number;
  /** 途中で縦向きになった・隠れた（その間は数えていない） */
  waited?: string;
  /** 段の中でうまくいかなかったこと（階段で下りられないなど。例外が起きた時はその文） */
  miss?: string;
  /** レベルアップ・祭壇の画面を閉じた回数 */
  shut?: number;
}

/** 自動で遊ぶ様子（診断の記録が書く） */
export const autoSt: {
  on: boolean;
  quick: boolean;
  laps: number;
  lap: number;
  step: string;
  done: boolean;
  stop: string;
  wakeLock: string;
  steps: AutoStep[];
} = {
  on: false,
  quick: false,
  laps: 0,
  lap: 0,
  /** 今の段の名前（'' は始める前、'done' は終わった） */
  step: '',
  done: false,
  /** 途中で止まった理由（［止める］・エラー） */
  stop: '',
  /** Wake Lock：'ok'・断られた理由・'none'（無い） */
  wakeLock: '',
  steps: [],
};

/** URL から、自動で遊ぶか（周の数。quick は 1）と、短い台本かを読む */
export function autoMode(search: string): { laps: number; quick: boolean } {
  let v: string | null = null;
  try {
    v = new URLSearchParams(search).get('auto');
  } catch {
    return { laps: 0, quick: false };
  }
  if (v === 'quick') return { laps: 1, quick: true };
  return { laps: v && /^[1-9]$/.test(v) ? Number(v) : 0, quick: false };
}

/**
 * 自動で遊ぶなら、ゲームの保存（al_ で始まる名前）を localStorage に書かないようにする。保存の処理より先に（src/game/00-test-mode.js が、ゲームの古い JS の初めに）呼ぶ。
 * 読むのはそのまま（ふだんの視点・見回す速さで遊ぶ）
 */
export function autoGuard(): void {
  if (TEST || !autoMode(location.search).laps) return;
  guardSaves();
}
/** ゲームの保存（al_ で始まる名前）を localStorage に書かないようにし、自動で遊んでいる印を付ける */
function guardSaves(): void {
  autoSt.on = true;
  const game = (k: unknown): boolean => String(k).startsWith('al_');
  try {
    // 元の処理（読み方は Reflect。this を付けずに読むと、lint が止めるため）
    const set: unknown = Reflect.get(Storage.prototype, 'setItem'),
      remove: unknown = Reflect.get(Storage.prototype, 'removeItem');
    if (typeof set !== 'function' || typeof remove !== 'function') return;
    Storage.prototype.setItem = function (k: string, v: string): void {
      if (!game(k)) Reflect.apply(set, this, [k, v]);
    };
    Storage.prototype.removeItem = function (k: string): void {
      if (!game(k)) Reflect.apply(remove, this, [k]);
    };
  } catch {
    // 入れ替えられなくても、続ける（localStorage が使えない所では、もともと書けない）
  }
}

// ---------------------------------------------------------------- 時計とフレームの数
/** 今の段のフレームの数（rAF ごとに足す。数えない間は null） */
let cur: { frames: number; sum: number; worst: number; slow: number; shut: number } | null = null;
let prevAt = 0;
/** 待っている処理（rAF ごとに確かめる） */
const waiters: (() => boolean)[] = [];
function tickFrame(): void {
  const now = performance.now(),
    dt = prevAt ? now - prevAt : 0;
  prevAt = now;
  const held = ui.portrait || document.hidden;
  // 縦向きの間は数えない（戻った最初のフレームの間に、待っていた間が入らないように、次のフレームから数え直す。
  // 隠れている間はフレームが来ないので、visibilitychange で数え直す。initAuto）
  if (held) prevAt = 0;
  if (cur && dt > 0 && !held) {
    cur.frames++;
    cur.sum += dt;
    cur.worst = Math.max(cur.worst, dt);
    if (dt > SLOW_MS) cur.slow++;
  }
  settlePanels();
  for (let i = waiters.length - 1; i >= 0; i--) if (must(waiters[i], 'waiter')()) waiters.splice(i, 1);
  requestAnimationFrame(tickFrame);
}

/** レベルアップの画面は1つ目を選び、祭壇の画面は閉じる（台本を流している間だけ） */
function settlePanels(): void {
  if (!autoSt.on || autoSt.done) return;
  if (!ui.lvlOpen && !ui.altarOpen) return;
  if (ui.lvlOpen) chooseLevel(0);
  else closeAltar(true);
  if (cur) cur.shut++;
}

/** 台本を止めた（［止める］を押した）時に、待っている所から投げる */
class Stopped extends Error {}
let stopAsked = false;
/** 縦向きか隠れていた（段に書く） */
let waitedWhy = '';

/**
 * 縦向き・隠れている間は時計を数えずに待つ。sec 秒（その間を除く）たつか、cond が真になったら終わる。cond が真で終われば true。
 * game なら、ゲームの時刻（clock.time）で数える（遅い端末では1フレームで進むゲームの時間に上限があり、ゲームが本当の時間より遅く進むので、
 * ゲームの中で歩いて着くのを待つ時は、ゲームの時刻で待つ）
 */
function until(cond: () => boolean, sec: number, game = false): Promise<boolean> {
  const read = (): number => (game ? clock.time * 1000 : performance.now());
  return new Promise((ok, ng) => {
    let left = sec * 1000,
      last = read();
    waiters.push(() => {
      const now = read();
      if (stopAsked) {
        ng(new Stopped());
        return true;
      }
      if (ui.portrait || document.hidden) {
        waitedWhy = ui.portrait ? 'portrait' : 'hidden';
        last = now;
        return false;
      }
      left -= now - last;
      last = now;
      if (cond()) {
        ok(true);
        return true;
      }
      if (left <= 0) {
        ok(false);
        return true;
      }
      return false;
    });
  });
}
const wait = (sec: number): Promise<boolean> => until(() => false, autoSt.quick ? sec * 0.4 : sec);

// ---------------------------------------------------------------- 指の事件
let nextId = 1000;
/** 置いたまま離していない指（止めた時・例外の時に全部離す） */
const live = new Set<() => void>();
function fire(el: EventTarget, type: string, id: number, x: number, y: number): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType: 'touch',
      isPrimary: false,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}
const el = (sel: string): HTMLElement => must(document.querySelector<HTMLElement>(sel), sel);
const mid = (e: Element): [number, number] => {
  const r = e.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
};
/** ボタンを指で押す（押して離し、click） */
function tap(sel: string): void {
  const b = el(sel),
    [x, y] = mid(b),
    id = nextId++;
  fire(b, 'pointerdown', id, x, y);
  fire(b, 'pointerup', id, x, y);
  b.click();
}
/** 指を置く。動かして、離す */
function finger(target: Element, x: number, y: number): { move: (x: number, y: number) => void; up: () => void } {
  const id = nextId++;
  let at: [number, number] = [x, y];
  fire(target, 'pointerdown', id, x, y);
  const up = (): void => {
    if (!live.delete(up)) return;
    fire(target, 'pointerup', id, ...at);
  };
  live.add(up);
  return {
    move: (mx, my) => {
      at = [mx, my];
      fire(target, 'pointermove', id, mx, my);
    },
    up,
  };
}
/** sec 秒かけて、指を (dx,dy) だけ少しずつ動かす */
async function drag(f: ReturnType<typeof finger>, x0: number, y0: number, dx: number, dy: number, sec: number): Promise<void> {
  const n = Math.max(1, Math.round((autoSt.quick ? sec * 0.4 : sec) * 20));
  for (let i = 1; i <= n; i++) {
    f.move(x0 + (dx * i) / n, y0 + (dy * i) / n);
    await until(() => false, 0.05);
  }
}

// ---------------------------------------------------------------- 台本
const canPlay = (): boolean => ui.started && !adv.dead && !here.trans;
/** 左のスティックを前へ倒して sec 秒（side で斜め：-1 左・1 右）。cond があれば、真になったら早く終わり、ゲームの時刻で sec 秒待つ（短い台本でも縮めない） */
async function walk(sec: number, side = 0, cond?: () => boolean): Promise<boolean> {
  const x = innerWidth * 0.2,
    y = innerHeight * 0.65,
    f = finger(el('#gl'), x, y);
  f.move(x + side * 25, y - 40);
  const hit = cond ? await until(cond, sec, true) : await until(() => false, autoSt.quick ? sec * 0.4 : sec);
  f.up();
  return hit;
}
/**
 * 前のほうの床のマスを n 個（生き物を置く）。前と左右斜めの3本の向きに、プレイヤーから床が続く所だけを見る（床でないマスに当たったら、その向きはそこで止める。
 * 壁の向こうの床に置くと、撃っても壁に当たるだけになるため）
 */
function cellsAhead(n: number): number[] {
  const D = here.D,
    out: number[] = [];
  if (!D) return out;
  const open = [true, true, true];
  for (let d = 0.5; d < 9 && out.length < n; d += 0.35) {
    for (const [k, s] of [-1, 0, 1].entries()) {
      if (!open[k]) continue;
      const a = player.yaw + s * 0.5,
        x = player.x - Math.sin(a) * d * CELL * 0.5,
        z = player.z - Math.cos(a) * d * CELL * 0.5,
        i = Math.floor(z / CELL) * MW + Math.floor(x / CELL);
      if (D.tile[i] !== TF) {
        open[k] = false;
        continue;
      }
      if (d >= 3 && !out.includes(i) && out.length < n) out.push(i);
    }
  }
  return out;
}
/** 一番近い生き物のほうを向く（照準は合成した指では合わせにくいので、向きだけは直に変える） */
function faceNearest(): void {
  let best = Infinity;
  for (const m of here.monsters) {
    const d = Math.hypot(m.x - player.x, m.z - player.z);
    if (!m.dead && !m.ty.critter && d < best) {
      best = d;
      player.yaw = Math.atan2(-(m.x - player.x), -(m.z - player.z));
      player.pitch = -0.1;
    }
  }
}

type Step = [string, (h: AutoHooks) => Promise<string>];
/** 台本の段（1周ぶん。名前・すること。返した文は、うまくいかなかったこと（うまくいけば ''）） */
export const AUTO_STEPS: Step[] = [
  [
    'enter',
    async () => {
      if (ui.started) return '';
      const seed = document.querySelector<HTMLInputElement>('#seedIn');
      if (seed && autoSt.lap === 1) seed.value = String(AUTO_SEED);
      tap('#enter');
      if (!(await until(() => ui.started, 30))) return '迷宮に入れない';
      ui.godMode = true;
      await wait(3);
      return '';
    },
  ],
  [
    'walk',
    async () => {
      await walk(4);
      await walk(3, -1);
      await walk(3, 1);
      return '';
    },
  ],
  [
    'look',
    async () => {
      const x = innerWidth * 0.75,
        y = innerHeight * 0.45,
        f = finger(el('#gl'), x, y);
      // 右へ1回り（見回す速さ「ふつう」で、およそ 1250px）を、指を何度も置き直して回す。上下も少し
      for (let k = 0; k < 5; k++) {
        const g = k ? finger(el('#gl'), x, y) : f;
        await drag(g, x - 120, y, 250, k % 2 ? 30 : -30, 1);
        g.up();
      }
      return '';
    },
  ],
  [
    'fight',
    async (h) => {
      const n0 = here.monsters.length;
      for (const [k, i] of cellsAhead(3).entries()) h.summon(['r', 'j', 'S'][k % 3] ?? 'r', i);
      const foes = here.monsters.slice(n0),
        hp0 = foes.map((m) => m.hp ?? 0);
      for (let k = 0; k < 3; k++) {
        faceNearest();
        // 右手で溜めて放つ
        const r = el('#castR'),
          [rx, ry] = mid(r),
          f = finger(r, rx, ry);
        await wait(1);
        f.up();
        await wait(0.5);
        // 左手を続けて押す
        for (let j = 0; j < 5; j++) {
          faceNearest();
          const l = el('#castL'),
            [lx, ly] = mid(l),
            g = finger(l, lx, ly);
          await wait(0.12);
          g.up();
          await wait(0.2);
        }
        tap('#rollB');
        await wait(1);
      }
      h.clear();
      // 置いた生き物のどれにも当たらなければ、うまくいかなかったと書く（狙いや指の事件が効いていない）
      if (!foes.length) return '生き物を置けない';
      return foes.some((m, i) => m.dead || (m.hp ?? 0) < (hp0[i] ?? 0)) ? '' : '攻撃が当たらない';
    },
  ],
  [
    'stairs',
    async (h) => {
      const times = autoSt.quick ? 1 : 3;
      for (let k = 0; k < times; k++) {
        const d0 = here.depth;
        let down = false;
        // 歩いても下りられない時（行く手の物に引っかかるなど）は、階段の前に置き直す（3回まで）
        for (let tries = 0; tries < 3 && !down; tries++) {
          if (!h.toStairs()) return `${k + 1}回目：階段が無い`;
          h.clear();
          down = await walk(8, 0, () => here.depth !== d0 || !!here.trans);
        }
        if (!down) return `${k + 1}回目：階段で下りられない`;
        await until(() => !here.trans, 10, true);
        await wait(2);
      }
      return '';
    },
  ],
  [
    'menu',
    async () => {
      tap('#menuB');
      await wait(0.8);
      for (const k of ['ui', 'ui', 'cam', 'cam']) {
        tap(`#menu button[data-k="${k}"]`);
        await wait(0.8);
      }
      tap('#menu button[data-k="resume"]');
      await wait(1);
      return '';
    },
  ],
  [
    'pack',
    async () => {
      tap('#packB');
      await wait(1.5);
      tap('#packB');
      await wait(1);
      return '';
    },
  ],
  [
    'die',
    async (h) => {
      h.hurt(9999);
      if (!(await until(() => !!document.querySelector('#death.show #newRunB'), 20))) return '結果の画面が出ない';
      await wait(2);
      tap('#newRunB');
      if (!(await until(() => canPlay() && here.depth === 1, 10, true))) return '新しい探索が始まらない';
      ui.godMode = true;
      await wait(2);
      return '';
    },
  ],
];

// ---------------------------------------------------------------- 画面の帯と、流す処理
let bar: HTMLElement | null = null;
function showBar(): void {
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'autobar';
    bar.style.cssText =
      'position:fixed;left:50%;top:max(4px,env(safe-area-inset-top));transform:translateX(-50%);z-index:60;padding:2px 8px;' +
      'font:12px/1.5 "M PLUS 1 Code",monospace;color:#bfe4ff;background:rgba(0,0,0,0.6);border:1px solid #456;white-space:nowrap';
    document.body.appendChild(bar);
  }
  const s = autoSt;
  bar.innerHTML = s.done
    ? `自動で遊び終えた（${s.laps}周${s.stop ? `・${s.stop}` : ''}）。記録は書いた`
    : `自動で遊んでいる ${s.lap}/${s.laps}周・${s.step} <button id="autoStop" style="font:inherit;color:inherit;background:#234;border:1px solid #567;padding:0 6px">止める</button>`;
  const b = document.getElementById('autoStop');
  if (b) b.onclick = () => (stopAsked = true);
}

let wakeLock: { release: () => Promise<void> } | null = null;
async function lockScreen(): Promise<void> {
  const wl: unknown = Reflect.get(navigator, 'wakeLock');
  const req = typeof wl === 'object' && wl !== null ? Reflect.get(wl, 'request') : null;
  if (typeof req !== 'function') {
    autoSt.wakeLock = 'none';
    return;
  }
  try {
    const got: unknown = await Reflect.apply(req, wl, ['screen']);
    const rel = typeof got === 'object' && got !== null ? Reflect.get(got, 'release') : null;
    wakeLock = typeof rel === 'function' ? { release: () => Promise.resolve(Reflect.apply(rel, got, [])) } : null;
    autoSt.wakeLock = 'ok';
  } catch (e) {
    autoSt.wakeLock = String(e).slice(0, 120);
  }
}

/** 段を1つ流し、数を残す */
async function runStep(lap: number, k: string, fn: Step[1], h: AutoHooks): Promise<void> {
  autoSt.step = k;
  showBar();
  waitedWhy = '';
  const t0 = performance.now();
  cur = { frames: 0, sum: 0, worst: 0, slow: 0, shut: 0 };
  let miss = '';
  try {
    miss = await fn(h);
  } catch (e) {
    if (!(e instanceof Stopped)) miss = `例外：${String(e).slice(0, 200)}`;
    throw e;
  } finally {
    for (const up of live) up();
    const c = cur;
    cur = null;
    autoSt.steps.push({
      lap,
      k,
      sec: Math.round((performance.now() - t0) / 100) / 10,
      frames: c.frames,
      avg: c.sum > 0 ? Math.round((c.frames * 10_000) / c.sum) / 10 : 0,
      worst: Math.round(c.worst),
      slow: c.slow,
      ...(waitedWhy ? { waited: waitedWhy } : {}),
      ...(miss ? { miss } : {}),
      ...(c.shut ? { shut: c.shut } : {}),
    });
  }
}

/** 隠れて戻った時、止まって開いたメニューを閉じる */
function resumeIfPaused(): void {
  if (ui.menuOpen && document.querySelector('#menu button[data-k="resume"]')) tap('#menu button[data-k="resume"]');
}

/** 古い JS から受け取った処理（initAuto が入れる。入るまではタイトルのボタンを押しても始めない） */
let hooks: AutoHooks | null = null;

/** ゲームの用意ができた時に1回（src/game/30-loop-init.js が呼ぶ）。?auto があれば、そのまま流す */
export async function initAuto(h: AutoHooks): Promise<void> {
  hooks = h;
  const m = autoMode(location.search);
  if (TEST || !m.laps || !autoSt.on) return;
  await runAuto(h, m);
}

/**
 * タイトルに［自動で遊ぶ］を出す（持ち主が Artifact を開いた時に、src/lib/diag.ts が呼ぶ）。押すと、ゲームの保存を止めて AUTO_LAPS 周流す。
 * 迷宮に入ると隠れる（body.started）。テスト用モードと、?auto で流している時は出さない
 */
export function offerAuto(): void {
  if (TEST || autoSt.on || document.getElementById('autoB')) return;
  const st = document.createElement('style');
  st.textContent =
    '#autoB{position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:21;' +
    'font:13px "M PLUS 1 Code","BIZ UDGothic",monospace;color:#bfe4ff;background:rgba(4,3,12,.7);border:1px solid #456;border-radius:4px;padding:10px 10px}' +
    'body.started #autoB{display:none}';
  document.head.appendChild(st);
  const b = document.createElement('button');
  b.id = 'autoB';
  b.textContent = `自動で遊ぶ（${AUTO_LAPS}周・速さを測る）`;
  b.onclick = () => {
    if (!hooks || autoSt.on || ui.started) return;
    b.remove();
    guardSaves();
    void runAuto(hooks, { laps: AUTO_LAPS, quick: false });
  };
  document.body.appendChild(b);
}

/** 台本を流す */
async function runAuto(h: AutoHooks, m: { laps: number; quick: boolean }): Promise<void> {
  autoSt.laps = m.laps;
  autoSt.quick = m.quick;
  requestAnimationFrame(tickFrame);
  document.addEventListener('visibilitychange', () => {
    // 隠れている間はフレームが来ないので、戻った最初のフレームの間に隠れていた間が入る。数え直す
    prevAt = 0;
    if (cur) waitedWhy = 'hidden';
    if (document.visibilityState === 'visible') {
      if (autoSt.wakeLock === 'ok' || wakeLock) void lockScreen();
      setTimeout(resumeIfPaused, 300);
    }
  });
  void lockScreen();
  try {
    for (let lap = 1; lap <= m.laps; lap++) {
      autoSt.lap = lap;
      for (const [k, fn] of AUTO_STEPS) {
        resumeIfPaused();
        await runStep(lap, k, fn, h);
      }
    }
  } catch (e) {
    autoSt.stop = e instanceof Stopped ? '止めた' : `エラー：${String(e).slice(0, 200)}`;
  }
  ui.godMode = false;
  autoSt.step = 'done';
  autoSt.done = true;
  showBar();
  void wakeLock?.release().catch(() => undefined);
}
