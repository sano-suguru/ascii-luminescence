// パネルの文字の幅と枠・幅に合わせて HTML を切る clipHtml（もとは src/game/12-hud-text.js・19-hands-runes.js・27-rune-screen.js）。
//
// パネルのフォントは M PLUS 1 Code（半角は1マス、全角は2マス）。M PLUS 1 Code に無い文字（← → と全角の ！：？［］）は
// BIZ UDGothic で補っていて、そこでも全角（2マス）。全角スペース（U+3000）は M PLUS 1 Code では半角なので1マス。
// tests/panels.mjs が、本物のフォントで測った幅と合うかを確かめている。

/**
 * M PLUS 1 Code に無く、BIZ UDGothic で補ってよい文字（どれも全角2マス）。ゲームの文言に使える文字は、M PLUS 1 Code にある文字とこれだけ。
 * 足す時は、BIZ UDGothic にあることと、visW の幅を合わせる（tests/glyphs.mjs と tests/panels.mjs が確かめる）
 */
export const BIZ_CHARS = '←→！：？［］';

const WIDE: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x3000, 0x30ff],
];

/** パネルの文字列（HTML を含んでよい）が何マスの幅か。タグは数えず、<input size="n"> は n マス、文字参照は1文字に戻して数える */
export function visW(html: string): number {
  const t = html
    .replace(/<input[^>]*size="(\d+)"[^>]*>/g, (_m, n: string) => ' '.repeat(+n))
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  let w = 0;
  for (const ch of t) {
    const c = ch.codePointAt(0) ?? 0;
    w += c === 0x3000 ? 1 : c === 0x2190 || c === 0x2192 ? 2 : WIDE.some(([a, b]) => c >= a && c <= b) ? 2 : 1;
  }
  return w;
}

const frame = (t: string): string => `<span class="f">${t}</span>`;

/**
 * パネルの枠を描く。lines の1行目は見出し（「+-- 名前 ---」の形）、最後の行は下の線で、どちらも描き直す。
 * 間の行の右に縦線を足して、揃える。fixedW があれば、中の幅をそれ以上にする
 */
export function boxText(lines: readonly string[], fixedW?: number): string {
  const all = lines.join('\n').split('\n'),
    top = all[0] ?? '',
    body = all.slice(1, -1);
  const title = top
    .replace(/<[^>]*>/g, '')
    .replace(/^\+-+\s*/, '')
    .replace(/\s*-*\+?\s*$/, '');
  const T = fixedW ? Math.max(fixedW, ...body.map(visW)) : Math.max(visW(`+-- ${title} `) + 4, ...body.map(visW));
  const head = `+-- ${title} `;
  const out = [frame(head + '-'.repeat(Math.max(1, T + 1 - visW(head))) + '+')];
  for (const l of body) out.push(l + ' '.repeat(Math.max(0, T - visW(l))) + ' ' + frame('|'));
  out.push(frame('+' + '-'.repeat(T) + '+'));
  return out.join('\n');
}

/** 右を半角スペースで埋めて、w マスの幅にする（全角スペースは1マスなので、埋めるのに使わない） */
export const padTo = (html: string, w: number): string => html + ' '.repeat(Math.max(0, w - visW(html)));

/** タグの無い文字列を、w マスごとの行に折る */
export function wrapPlain(str: string, w: number): string[] {
  const out: string[] = [];
  let line = '',
    lw = 0;
  for (const ch of str) {
    const cw = visW(ch);
    if (lw + cw > w) {
      out.push(line);
      line = '';
      lw = 0;
    }
    line += ch;
    lw += cw;
  }
  if (line) out.push(line);
  return out;
}
/** HTML を、見える幅 w（visW で数える）までに切る（タグは残し、はみ出した文字と、その後ろの物を消す）。画面の部品で切るので、ブラウザで使う */
export function clipHtml(html: string, w: number): string {
  if (visW(html) <= w) return html;
  const box = document.createElement('span');
  box.innerHTML = html;
  let left = w;
  const walk = (n: Node): void => {
    // oxlint-disable-next-line unicorn/no-useless-spread -- 回しながら消すので、childNodes（消すと縮む）を先に配列に写す
    for (const c of [...n.childNodes]) {
      if (left <= 0) {
        n.removeChild(c);
        continue;
      }
      if (c.nodeType === 3) {
        let out = '';
        for (const ch of c.textContent ?? '') {
          const cw = visW(ch);
          if (cw > left) {
            left = 0;
            break;
          }
          out += ch;
          left -= cw;
        }
        c.textContent = out;
      } else walk(c);
    }
  };
  walk(box);
  return box.innerHTML;
}
