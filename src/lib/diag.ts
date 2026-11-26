// 診断の記録：claude.ai の Artifact の中で、持ち主が開いた時だけ、端末・速さ・できごと・エラーを Artifact のデータベース（db の機能）に書く。
// Claude が ArtifactData の道具で読んで、本物の端末での様子を確かめるため（スマホ対応の間）。
// window.claude.use が無い所（ふつうの公開用の版・テスト）や、持ち主でない人が開いた時は、何もしない。乱数は使わない（ゲームの動きを変えない）。
// 記録は、開くたびに1件（diag/<開いた時刻>）。書き込みは、変わった時だけ、10秒に1回まで（ページを離れる時も1回）。
// 公開する時は、capabilities に db（diag は持ち主だけが読み書き）と user を渡す（CLAUDE.md の「Artifact に公開する」）。
import { adv, fight, gear, ui } from './state.ts';

interface ClaudeLike {
  use(name: string): Promise<unknown>;
}
interface UserLike {
  isOwner(): Promise<boolean>;
}
interface DocLike {
  set(data: Record<string, unknown>): Promise<void>;
}
interface DbLike {
  collection(path: string): { doc(id: string): DocLike };
}
const hasFn = (v: unknown, k: string): boolean => typeof v === 'object' && v !== null && typeof Reflect.get(v, k) === 'function';
const isClaude = (v: unknown): v is ClaudeLike => hasFn(v, 'use');
const isUser = (v: unknown): v is UserLike => hasFn(v, 'isOwner');
const isDb = (v: unknown): v is DbLike => hasFn(v, 'collection');

/** 速さの記録の数・できごとの数・エラーの数の上限（古い物から捨てる） */
const KEEP = { fps: 60, events: 50, errors: 20 };
/** 速さをまとめる間（ミリ秒）と、書き込みの間 */
const SPAN = 10_000;

/** 今の場所（タイトル・探索中・止まっている・死んだ） */
const phase = (): string =>
  !ui.started ? 'title' : adv.dead ? 'dead' : ui.menuOpen || ui.invOpen || ui.altarOpen || ui.lvlOpen ? 'paused' : 'play';

/** 端末のこと（開いた時と、画面の大きさが変わった時） */
function device(): Record<string, unknown> {
  const d = document,
    el = d.documentElement,
    mq = (q: string): boolean => window.matchMedia(q).matches;
  return {
    ua: navigator.userAgent,
    screen: [screen.width, screen.height],
    view: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    coarse: mq('(pointer: coarse)'),
    touchPoints: navigator.maxTouchPoints,
    standalone: mq('(display-mode: standalone)'),
    fullscreenEnabled: d.fullscreenEnabled,
    webkitFullscreenEnabled: Reflect.get(d, 'webkitFullscreenEnabled') ?? null,
    requestFullscreen: typeof Reflect.get(el, 'requestFullscreen') === 'function',
    webkitRequestFullscreen: typeof Reflect.get(el, 'webkitRequestFullscreen') === 'function',
    pointerLock: typeof Reflect.get(el, 'requestPointerLock') === 'function',
  };
}

/** 記録を始める（ページを開いた時に1回）。持ち主かを確かめてから動く */
export async function initDiag(): Promise<void> {
  const c: unknown = Reflect.get(window, 'claude');
  if (!isClaude(c)) return;
  const user = await c.use('user');
  if (!isUser(user) || !(await user.isOwner())) return;
  const db = await c.use('db');
  if (!isDb(db)) return;
  const t0 = Date.now(),
    since = (): number => Math.round((Date.now() - t0) / 100) / 10;
  const doc = db.collection('diag').doc(new Date(t0).toISOString().replace(/[:.]/g, '-'));
  type Row = Record<string, unknown>;
  const rec: { t0: string; device: Row; fps: Row[]; events: Row[]; errors: Row[] } = {
    t0: new Date(t0).toISOString(),
    device: device(),
    fps: [],
    events: [],
    errors: [],
  };
  // busy：書き込みの途中。again：その途中に、また書くよう頼まれた（終わったらもう一度書く。ページを離れる時の分が抜けないように）
  let dirty = true,
    busy = false,
    again = false;
  const push = (list: Record<string, unknown>[], max: number, item: Record<string, unknown>): void => {
    list.push({ t: since(), ...item });
    if (list.length > max) list.splice(0, list.length - max);
    dirty = true;
  };
  const event = (k: string, v?: unknown): void => push(rec.events, KEEP.events, v === undefined ? { k } : { k, v });
  const flush = (): void => {
    if (busy) {
      again = true;
      return;
    }
    if (!dirty) return;
    dirty = false;
    busy = true;
    doc
      .set({ ...rec, saved: since() })
      .catch((e: unknown) => {
        // 書けなかった時は、次の機会にもう一度（書けない理由は、エラーとして残す）
        dirty = true;
        push(rec.errors, KEEP.errors, { k: 'db', v: String(e) });
      })
      .finally(() => {
        busy = false;
        if (again) {
          again = false;
          flush();
        }
      });
  };

  // できごと：旗が変わった時（ゲームのコードには手を入れず、0.25秒ごとに見る。飛ぶ物は1秒もたたずに消えることがあるため）と、ボタンや描く画面を押した時。
  // cast は溜めている手（無ければ ''）、projs は飛ぶ物があるか（攻撃が出たかの手がかり）
  const flags = (): Record<string, unknown> => ({
    touch: ui.touch,
    started: ui.started,
    dead: adv.dead,
    menu: ui.menuOpen,
    pack: ui.invOpen,
    altar: ui.altarOpen,
    levelup: ui.lvlOpen,
    locked: ui.locked,
    cast: gear.castSt?.h ?? '',
    projs: fight.projs.length > 0,
  });
  let last = flags();
  setInterval(() => {
    const now = flags();
    for (const [k, v] of Object.entries(now)) if (last[k] !== v) event(k, v);
    last = now;
  }, 250);
  window.addEventListener(
    'pointerdown',
    (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (b) event('press', `${b.id || b.textContent?.trim().slice(0, 20) || 'button'} (${e.pointerType})`);
      else if (e.target instanceof Element && e.target.id === 'gl')
        event('tap', `${e.clientX < innerWidth / 2 ? 'left' : 'right'} (${e.pointerType})`);
    },
    true,
  );
  window.addEventListener('resize', () => {
    rec.device = device();
    event('resize', [innerWidth, innerHeight]);
  });
  window.addEventListener('error', (e) =>
    push(rec.errors, KEEP.errors, { k: 'error', v: `${e.message} ${e.filename}:${e.lineno}:${e.colno}` }),
  );
  window.addEventListener('unhandledrejection', (e) => push(rec.errors, KEEP.errors, { k: 'rejection', v: String(e.reason) }));

  // 速さ：描くたびの間を数え、SPAN ごとに平均と、一番遅かった1回を記録する
  let frames = 0,
    worst = 0,
    prev = performance.now(),
    from = prev;
  // 時刻は performance.now で読む（rAF の引数ではなく。テスト用モードでは、ゲームの時計に合わせて進むため）
  const frame = (): void => {
    const now = performance.now();
    frames++;
    worst = Math.max(worst, now - prev);
    prev = now;
    if (now - from >= SPAN) {
      push(rec.fps, KEEP.fps, {
        phase: phase(),
        avg: Math.round((frames * 10_000) / (now - from)) / 10,
        min: worst > 0 ? Math.round(10_000 / worst) / 10 : null,
      });
      frames = 0;
      worst = 0;
      from = now;
      flush();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    event('visible', document.visibilityState);
    if (document.visibilityState === 'hidden') flush();
  });
  event('open');
  flush();
}
