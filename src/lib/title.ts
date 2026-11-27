// タイトルのロゴ（もとは src/game/01-title.js）。ロゴを描く buildLogo と、ロゴの絵が無い時の点の字 buildDotLogo も。
import { must, nth } from './array.ts';
// ロゴの絵は、oh-my-logo の塗りのブロック字（cfonts の block）で1字ずつ描いて、文字のまま貼った物。
// タイトルを変える時は、同じやり方で描き直して（node gen2.mjs WORD1 WORD2）LOGO_ART を置き換える。TITLE_LINES は LOGO_ART の名前と合わせる。

/** タイトルの行（LOGO_ART の名前） */
export const TITLE_LINES = ['ASCII', 'LUMINESCENCE'];
/** タイトルの行ごとの、ブロック字の絵 */
export const LOGO_ART = {
  ASCII: [
    ' █████╗  ███████╗  ██████╗ ██╗ ██╗',
    '██╔══██╗ ██╔════╝ ██╔════╝ ██║ ██║',
    '███████║ ███████╗ ██║      ██║ ██║',
    '██╔══██║ ╚════██║ ██║      ██║ ██║',
    '██║  ██║ ███████║ ╚██████╗ ██║ ██║',
    '╚═╝  ╚═╝ ╚══════╝  ╚═════╝ ╚═╝ ╚═╝',
  ],
  LUMINESCENCE: [
    '██╗      ██╗   ██╗ ███╗   ███╗ ██╗ ███╗   ██╗ ███████╗ ███████╗  ██████╗ ███████╗ ███╗   ██╗  ██████╗ ███████╗',
    '██║      ██║   ██║ ████╗ ████║ ██║ ████╗  ██║ ██╔════╝ ██╔════╝ ██╔════╝ ██╔════╝ ████╗  ██║ ██╔════╝ ██╔════╝',
    '██║      ██║   ██║ ██╔████╔██║ ██║ ██╔██╗ ██║ █████╗   ███████╗ ██║      █████╗   ██╔██╗ ██║ ██║      █████╗',
    '██║      ██║   ██║ ██║╚██╔╝██║ ██║ ██║╚██╗██║ ██╔══╝   ╚════██║ ██║      ██╔══╝   ██║╚██╗██║ ██║      ██╔══╝',
    '███████╗ ╚██████╔╝ ██║ ╚═╝ ██║ ██║ ██║ ╚████║ ███████╗ ███████║ ╚██████╗ ███████╗ ██║ ╚████║ ╚██████╗ ███████╗',
    '╚══════╝  ╚═════╝  ╚═╝     ╚═╝ ╚═╝ ╚═╝  ╚═══╝ ╚══════╝ ╚══════╝  ╚═════╝ ╚══════╝ ╚═╝  ╚═══╝  ╚═════╝ ╚══════╝',
  ],
};

/** LOGO_ART を、無い行もある表として読む（ロゴの絵が無いタイトルなら、点の字にするため） */
const logoArt: Readonly<Record<string, string[] | undefined>> = LOGO_ART;
// fallback when no rendered art exists for the title: a 5x5 dot font filled with the dungeon's own glyphs
const LOGO_FONT: Readonly<Record<string, string[]>> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000'],
  G: ['01111', '10000', '10011', '10001', '01111'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  I: ['111', '010', '010', '010', '111'],
  J: ['00111', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '11100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '11110', '10000', '10000'],
  Q: ['01110', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '11110', '10010', '10001'],
  S: ['01111', '10000', '01110', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  X: ['10001', '01010', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
  Z: ['11111', '00010', '00100', '01000', '11111'],
  '0': ['01110', '10011', '10101', '11001', '01110'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['11110', '00001', '01110', '10000', '11111'],
  '3': ['11110', '00001', '01110', '00001', '11110'],
  '4': ['10010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '11110'],
  '6': ['01110', '10000', '11110', '10001', '01110'],
  '7': ['11111', '00010', '00100', '01000', '01000'],
  '8': ['01110', '10001', '01110', '10001', '01110'],
  '9': ['01110', '10001', '01111', '00001', '01110'],
  ' ': ['000', '000', '000', '000', '000'],
  '-': ['000', '000', '111', '000', '000'],
};
/** ロゴの絵が無い時：5x5 の点の字を、迷宮の文字で埋めて描く（ときどき文字が変わり、光の帯が横切る） */
function buildDotLogo(el: HTMLElement): void {
  const GL = '#%&8@$#8@',
    cA = [0.72, 0.6, 1.0],
    cB = [1.0, 0.8, 0.45],
    rows: string[] = [],
    cells: HTMLElement[] = [];
  const lineRows = TITLE_LINES.map((t) => {
    const r = ['', '', '', '', ''];
    [...t.toUpperCase()].forEach((ch, k) => {
      const f = must(LOGO_FONT[ch] || LOGO_FONT[' '], '点の字');
      for (let y = 0; y < 5; y++) r[y] += (k ? '0' : '') + nth(f, y);
    });
    return r;
  });
  const W = Math.max(...lineRows.map((r) => nth(r, 0).length));
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  lineRows.forEach((r, li) => {
    const pad = Math.floor((W - nth(r, 0).length) / 2);
    for (let y = 0; y < 5; y++) {
      let line = '';
      for (let x = 0; x < W; x++) {
        const on = nth(r, y)[x - pad] === '1';
        if (!on) {
          line += ' ';
          continue;
        }
        const f = x / Math.max(1, W - 1),
          c = cA.map((a, i) => a + (nth(cB, i) - a) * f),
          ch = nth(GL, Math.floor(rnd() * GL.length));
        line += `<span class="px" style="color:rgb(${c.map((v) => Math.round(v * 255)).join(',')})">${ch === '&' ? '&amp;' : ch}</span>`;
      }
      rows.push(line);
    }
    if (li < lineRows.length - 1) rows.push('');
  });
  el.innerHTML = rows.join('\n');
  cells.push(...el.querySelectorAll<HTMLElement>('.px'));
  const fit = () => {
    const fs = Math.max(
      5,
      Math.min(
        19,
        Math.min(window.innerWidth * 0.9, window.innerWidth - 56) / (W * 0.62),
        (window.innerHeight * (window.innerHeight < 520 ? 0.18 : 0.3)) / (11 * 0.62),
      ),
    );
    el.style.fontSize = fs + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
  // 古いブラウザには matchMedia が無い（型には必ずある）
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // a few glyphs change now and then, and a band of light sweeps across
  let sweep = -10;
  const tick = () => {
    if (document.body.classList.contains('started')) return;
    for (let k = 0; k < 5; k++) {
      const c = nth(cells, Math.floor(Math.random() * cells.length));
      c.textContent = nth(GL, Math.floor(Math.random() * GL.length));
    }
    sweep += 1.2;
    if (sweep > W + 30) sweep = -30;
    // @ts-expect-error -- 古い JS から写した、使っていない変数（消すのは別のコミット）
    const lit = new Set();
    cells.forEach((c) => {
      const x =
        c.dataset['x'] !== undefined
          ? +c.dataset['x']
          : ((c.dataset['x'] = String((c.offsetLeft / (c.offsetWidth || 1)) | 0)), +c.dataset['x']);
      c.classList.toggle('lit', Math.abs(x - sweep) < 2.5);
    });
    setTimeout(tick, 110);
  };
  setTimeout(tick, 600);
}
/** タイトルのロゴを #logo に描く（ブロック字の絵。絵が無いタイトルなら点の字）。画面の大きさに合わせて字の大きさを変える */
export function buildLogo(): void {
  const el = document.getElementById('logo');
  if (!el) return;
  if (!TITLE_LINES.every((t) => logoArt[t])) {
    el.classList.add('dots');
    const p = document.createElement('pre');
    el.appendChild(p);
    buildDotLogo(p);
    return;
  }
  const rows: string[] = [];
  const W = Math.max(...TITLE_LINES.map((t) => Math.max(...must(logoArt[t], 'ロゴの絵').map((l) => [...l].length))));
  TITLE_LINES.forEach((t, k) => {
    const art = must(logoArt[t], 'ロゴの絵'),
      w = Math.max(...art.map((l) => [...l].length)),
      pad = ' '.repeat(Math.floor((W - w) / 2));
    art.forEach((l) => rows.push(pad + l));
    if (k < TITLE_LINES.length - 1) rows.push('');
  });
  const face = rows.map((l) => [...l].map((c) => (c === '█' ? c : ' ')).join('')).join('\n'),
    shade = rows.map((l) => [...l].map((c) => (c === '█' || c === ' ' ? ' ' : c)).join('')).join('\n');
  el.innerHTML = `<pre class="lg-shade">${shade}</pre><pre class="lg-face">${face}</pre><pre class="lg-shine">${face}</pre>`;
  // 幅は、タイトルの画面（#intro）の左右の余白（24px ずつ）を引いた中に収める。背の低い画面（520px 未満。スマホの横向きなど）では、下の枠を見せるために小さくする
  const fit = () => {
    const ww = Math.min(window.innerWidth * 0.92, window.innerWidth - 56),
      hh = window.innerHeight * (window.innerHeight < 520 ? 0.16 : 0.26);
    const fs = Math.max(4, Math.min(15, ww / (W * 0.6), hh / rows.length));
    el.style.fontSize = fs + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
}
