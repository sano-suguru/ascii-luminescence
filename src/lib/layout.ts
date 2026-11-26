// 画面の大きさに合わせる：タイトルの枠（#intropanel）と、指で遊ぶ時のパネル（装備・メニュー・祭壇とレベルアップ・結果）を、画面に収まるように縮める。
// 文字の大きさを変えると枠の縦線がずれるので、CSS の zoom で丸ごと縮める（zoom は場所の大きさも縮むので、はみ出しのスクロールバーも消える）。
import { ui } from './state.ts';

/** これより小さくは縮めない（読めなくなるため）。収まらない分は、タイトルの画面（#intro。overflow:auto）やパネルの中で送る */
export const FIT_MIN = 0.75;

/** タイトルの枠を、ロゴや伝言と並べた時に #intro の中に収まる倍率（1 以下、FIT_MIN 以上）にする */
export function fitIntro(): void {
  const intro = document.getElementById('intro'),
    panel = document.getElementById('intropanel');
  if (!intro || !panel) return;
  panel.style.zoom = '1';
  const cs = getComputedStyle(intro),
    num = (v: string): number => parseFloat(v) || 0;
  const kids = [...intro.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetParent !== null);
  // 枠の他の物（ロゴ・伝言）の高さと、並びの間
  const others = kids.filter((c) => c !== panel).reduce((h, c) => h + c.getBoundingClientRect().height, 0),
    gaps = num(cs.rowGap) * Math.max(0, kids.length - 1);
  const w = intro.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight),
    h = intro.clientHeight - num(cs.paddingTop) - num(cs.paddingBottom) - others - gaps;
  const r = panel.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return;
  // 1px の余裕は、端数の丸めではみ出さないため
  const s = Math.min(1, (w - 1) / r.width, (h - 1) / r.height);
  panel.style.zoom = String(Math.max(FIT_MIN, s));
}

/** 画面の大きさが変わった時・枠の中身が書き直された時・フォントを読み終えた時に、fitIntro する */
export function initFitIntro(): void {
  const panel = document.getElementById('intropanel');
  if (!panel) return;
  window.addEventListener('resize', fitIntro);
  new MutationObserver(fitIntro).observe(panel, { childList: true });
  void document.fonts.ready.then(fitIntro);
  fitIntro();
}

/** 指で遊ぶ時に収めるパネルと、出ているか（祭壇の画面は、選ぶ画面として開いている時だけ。近づいた時の下の小さな案内は収めない） */
const PANELS: [string, (el: HTMLElement) => boolean][] = [
  ['pack', (el) => el.classList.contains('show')],
  ['menu', (el) => el.classList.contains('show')],
  ['altarp', (el) => el.classList.contains('open')],
  ['death', (el) => el.classList.contains('show')],
];
/** パネルと画面の端の間（px） */
const PANEL_GAP = 8;

/**
 * 指で遊ぶ時、出ているパネル el を画面に収まる倍率（1 以下、FIT_MIN 以上）に縮め、それでも入らない分は、パネルの中を送れるように高さを決める
 * （送れるのは CSS の overflow-y:auto。src/index.html）。マウスの時と、出ていないパネルは元に戻す。
 * 測る間は高さの決まりを外すので、送った所（scrollTop）を覚えて戻す（中身を書き直すたびに呼ばれるので、戻さないと一番上へ跳ぶ）
 */
function fitPanel(el: HTMLElement, shown: (el: HTMLElement) => boolean): void {
  const scroll = el.scrollTop;
  el.style.zoom = '';
  el.style.maxHeight = '';
  el.style.top = '';
  if (!ui.touch || !shown(el)) return;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return;
  // 上の [装備] [メニュー]（#touchbar）が出ていれば、その下から画面の下の端までに収める
  const bar = document.getElementById('touchbar')?.getBoundingClientRect(),
    top = bar && bar.height > 0 ? bar.bottom + PANEL_GAP / 2 : PANEL_GAP,
    w = innerWidth - PANEL_GAP * 2,
    h = innerHeight - PANEL_GAP - top,
    z = Math.max(FIT_MIN, Math.min(1, w / r.width, h / r.height));
  el.style.zoom = String(z);
  // zoom を付けた物の長さ（max-height と、真ん中からずらす量）は、縮める前の大きさで書く（画面では z 倍になる）
  if (r.height * z > h) el.style.maxHeight = `${h / z}px`;
  el.style.top = `calc(50% + ${(top - PANEL_GAP) / 2 / z}px)`;
  el.scrollTop = scroll;
}
/** 全部のパネルを fitPanel する（遊び方が変わった時・画面の大きさが変わった時など） */
export function fitPanels(): void {
  for (const [id, shown] of PANELS) {
    const el = document.getElementById(id);
    if (el) fitPanel(el, shown);
  }
}

/** パネルの中身が書き直された時・出し入れされた時（そのパネルだけ）と、画面の大きさが変わった時・フォントを読み終えた時（全部）に、収め直す */
export function initFitPanels(): void {
  const mo = new MutationObserver((list) => {
    for (const el of new Set(list.map((m) => m.target)))
      for (const [id, shown] of PANELS) if (el instanceof HTMLElement && el.id === id) fitPanel(el, shown);
  });
  for (const [id] of PANELS) {
    const el = document.getElementById(id);
    // 自分で書き換える style は見ない（見ると、書き換えるたびにまた呼ばれる）
    if (el) mo.observe(el, { childList: true, attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('resize', fitPanels);
  void document.fonts.ready.then(fitPanels);
}
