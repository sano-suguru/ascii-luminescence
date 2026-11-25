// 伝言（もとは src/game/16-view-input.js）。状態の入れ物 msgs（伝言の一覧）に頼り、画面の #log に書く。
// 1秒ごとの描き直し（古い伝言を薄くして消す）は、古い JS（16-view-input.js）の setInterval が呼ぶ。
import { must, nth } from './array.ts';
import { clamp } from './rng.ts';
import { msgs } from './state.ts';

/** 伝言を出す（html。新しい3つまで残す） */
export function msg(html: string): void {
  msgs.push({ html, t: performance.now() });
  if (msgs.length > 3) msgs.shift();
  renderLog();
}
/** 伝言を描き直す（13秒たった物は消す。古い物ほど薄く、7秒を過ぎると5秒かけて消える） */
export function renderLog(): void {
  const now = performance.now();
  while (msgs.length && (now - nth(msgs, 0).t) / 1000 > 13) msgs.shift();
  must(document.getElementById('log'), '伝言の欄 #log').innerHTML = msgs
    .map((m, i) => {
      const age = (now - m.t) / 1000,
        rank = msgs.length - 1 - i;
      const o = (1 - rank * 0.3) * clamp(1 - (age - 7) / 5, 0, 1);
      return `<div class="m" style="opacity:${o.toFixed(2)}">${m.html}</div>`;
    })
    .join('');
}
