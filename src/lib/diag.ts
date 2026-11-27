// 診断の記録：claude.ai の Artifact の中で、持ち主が開いた時だけ、端末・速さ・できごと・場面が切り替わる時の処理にかかった時間（src/lib/took.ts）・遅いフレーム・エラーを
// Artifact のデータベース（db の機能）に書く。
// Claude が ArtifactData の道具で読んで、本物の端末での様子を確かめるため（スマホ対応の間）。
// window.claude.use が無い所（ふつうの公開用の版・テスト）や、持ち主でない人が開いた時は、何もしない。乱数は使わない（ゲームの動きを変えない）。
// 記録は、開くたびに1件（diag/<開いた時刻>）。書き込みは、変わった時だけ、10秒に1回まで（ページを離れる時も1回）。
// 公開する時は、capabilities に db（diag は持ち主だけが読み書き）と user を渡す（CLAUDE.md の「Artifact に公開する」）。
import { nth } from './array.ts';
import { sndState } from './audio.ts';
import { autoSt } from './auto.ts';
import { placeKey } from './levels.ts';
import { adv, fight, gear, ui } from './state.ts';
import { setTookSink } from './took.ts';

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

/** 速さの記録の数・できごとの数・エラーの数・かかった時間の数・遅いフレームの数の上限（遅いフレームは短い物から、ほかは古い物から捨てる） */
const KEEP = { fps: 60, events: 50, errors: 20, took: 40, slow: 40, menu: 100 };
/** これより長くかかった1フレームを、遅いフレームとして1つずつ書く（ミリ秒） */
const SLOW_MS = 100;
/** 速さをまとめる間（ミリ秒）と、書き込みの間 */
const SPAN = 10_000;

/** 自動で試した記録（src/lib/auto.ts。欄 auto に書く） */
const autoRec = (): Record<string, unknown> => ({
  laps: autoSt.laps,
  quick: autoSt.quick,
  lap: autoSt.lap,
  step: autoSt.step,
  done: autoSt.done,
  stop: autoSt.stop,
  wakeLock: autoSt.wakeLock,
  dev: autoSt.dev,
  depth: autoSt.depth,
  steps: autoSt.steps,
});

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
    // ページの URL に付いた物（Artifact のリンクに付けた物が、ゲームのページまで届くかを見るため）
    query: location.search + location.hash,
  };
}

/** 記録を始める（ページを開いた時に1回）。持ち主かを確かめてから動く。持ち主と分かったら onOwner を呼ぶ（タイトルを描き直すため） */
export async function initDiag(onOwner: () => void): Promise<void> {
  const c: unknown = Reflect.get(window, 'claude');
  if (!isClaude(c)) return;
  const user = await c.use('user');
  if (!isUser(user) || !(await user.isOwner())) return;
  const db = await c.use('db');
  if (!isDb(db)) return;
  // 記録が書けるので、タイトルに［開発用モード］と［自動で試す］を出す（タイトルを描き直すのは、呼んだ src/game/17-meta.js）
  ui.owner = true;
  try {
    onOwner();
  } catch (e) {
    // タイトルを描き直せなくても、記録は始める
    console.error(e);
  }
  const t0 = Date.now(),
    since = (): number => Math.round((Date.now() - t0) / 100) / 10;
  const doc = db.collection('diag').doc(new Date(t0).toISOString().replace(/[:.]/g, '-'));
  type Row = Record<string, unknown>;
  // took：場面が切り替わる時の処理にかかった時間（src/lib/took.ts）。slow：SLOW_MS より長くかかった1フレーム。
  // どちらも、できごとの一覧とは別に持つ（できごとは押すたびに増え、すぐ押し出されるため）
  // menu：メニューの項目を押した（項目 k・その前に押した項目 prev と、それからの秒 dt。メニューを開いて初めての1回は prev も dt も null）。
  // 押し間違いの目安を見るため（tools/diag-report.mjs が、すぐ押し直した回数を数える）。人の指の事件（isTrusted）だけ
  const rec: { t0: string; device: Row; fps: Row[]; events: Row[]; errors: Row[]; took: Row[]; slow: Row[]; menu: Row[] } = {
    t0: new Date(t0).toISOString(),
    device: device(),
    fps: [],
    events: [],
    errors: [],
    took: [],
    slow: [],
    menu: [],
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
  // 最後のできごとかかかった時間の名前と時刻（遅いフレームの近くで、何があったかを添える）。溜めている手・飛ぶ物・音の部品の旗の変化は数えない
  // （戦っている間は何度も変わり、本当の原因（階を作った時など）を上書きするため）
  let lastK = '',
    lastAt = -1e9;
  const mark = (k: string): void => {
    lastK = k;
    lastAt = performance.now();
  };
  const NOT_NEAR = new Set(['cast', 'projs', 'audio']);
  const event = (k: string, v?: unknown): void => {
    if (!NOT_NEAR.has(k)) mark(k);
    push(rec.events, KEEP.events, v === undefined ? { k } : { k, v });
  };
  setTookSink((k, ms, v) => {
    mark(k);
    push(rec.took, KEEP.took, { k, ms: Math.round(ms), phase: phase(), ...v });
  });
  const flush = (): void => {
    if (busy) {
      again = true;
      return;
    }
    if (!dirty) return;
    dirty = false;
    busy = true;
    doc
      .set({ ...rec, ...(autoSt.on ? { auto: autoRec() } : {}), saved: since() })
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
    audio: sndState(),
    // 自動で試している段（src/lib/auto.ts。遅いフレームの「近く」に段の名前が出る）
    ...(autoSt.on ? { auto: autoSt.step } : {}),
  });
  let last = flags();
  // メニューを開いてから最後に押した項目と時刻（メニューが閉じたら null。閉じたことは、#menu の show が外れたのを見て知る。
  // 0.25秒ごとの見回りで知ると、すぐ開き直した時に前の項目が残るため）
  let menuLast: { k: string; at: number } | null = null;
  const menuEl = document.getElementById('menu');
  if (menuEl)
    new MutationObserver(() => {
      if (!menuEl.classList.contains('show')) menuLast = null;
    }).observe(menuEl, { attributes: true, attributeFilter: ['class'] });
  // 音の部品の、記録を始めた時の状態（その後は、変わった時だけ書く。押す前に動いていないかを、後から確かめられるように）
  event('audio', last['audio']);
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
      const k = b instanceof HTMLElement && b.closest('#menu') ? b.dataset['k'] : undefined;
      if (k && e.isTrusted) {
        const at = performance.now();
        push(rec.menu, KEEP.menu, {
          k,
          prev: menuLast?.k ?? null,
          dt: menuLast ? Math.round((at - menuLast.at) / 100) / 10 : null,
        });
        menuLast = { k, at };
      } else if (e.target instanceof Element && e.target.id === 'gl')
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

  // 速さ：描くたびの間を数え、SPAN ごとに平均と、一番遅かった1回を記録する。その時にいる場所（placeKey）も書く（探索中だけ。タイトル・図鑑・試しの間では null。前の行と違えば、その間に場所を移った。
  // できごとの一覧は数が限られ、ボタンを押すとすぐ流れるので、場所はこちらに書く）
  let frames = 0,
    worst = 0,
    prev = performance.now(),
    from = prev;
  // 時刻は performance.now で読む（rAF の引数ではなく。テスト用モードでは、ゲームの時計に合わせて進むため）
  const frame = (): void => {
    const now = performance.now();
    frames++;
    worst = Math.max(worst, now - prev);
    // 遅いフレーム：その前の1秒の間に、できごとかかかった時間の記録があれば、その名前を添える
    if (now - prev > SLOW_MS) {
      push(rec.slow, Infinity, {
        ms: Math.round(now - prev),
        phase: phase(),
        place: ui.started && !ui.gallery ? placeKey() : null,
        near: now - lastAt < 1000 + (now - prev) ? lastK : null,
      });
      // 数が上限を越えたら、一番短い物（同じ長さなら古い物）を捨てる（遅いフレームが続く端末でも、飛び抜けて長い1回を残すため）
      if (rec.slow.length > KEEP.slow) {
        let k = 0;
        rec.slow.forEach((r, i) => {
          if (Number(r['ms']) < Number(nth(rec.slow, k)['ms'])) k = i;
        });
        rec.slow.splice(k, 1);
      }
    }
    prev = now;
    if (now - from >= SPAN) {
      push(rec.fps, KEEP.fps, {
        phase: phase(),
        place: ui.started && !ui.gallery ? placeKey() : null,
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
