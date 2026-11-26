// 画面の大きさに合わせる：タイトルの枠（#intropanel）を、画面に収まるように縮める。
// 文字の大きさを変えると枠の縦線がずれるので、CSS の zoom で丸ごと縮める（zoom は場所の大きさも縮むので、はみ出しのスクロールバーも消える）。

/** これより小さくは縮めない（読めなくなるため）。収まらない分は、タイトルの画面（#intro。overflow:auto）の中で送る */
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
