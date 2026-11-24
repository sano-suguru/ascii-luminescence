// ゲーム本体（src/game/*.js）をつなぐ処理と、行の対応・ソースマップ。テスト版のページに使う物（フォントの組み合わせ）もここに置く。
// 組み立ては Vite（vite.config.mjs と tools/vite-plugins.mjs）。ここは Vite にも lint にもテストにも使う、ただの関数の集まり。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeMappings } from './sourcemap.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ゲームは JetBrains Mono を指定した所でも日本語を書く。JetBrains Mono に日本語は無いので、ふだんはシステムの日本語フォントで
// 描かれる（マシンごとに違う）。テスト版では、M PLUS 1 Code の面を「JetBrains Mono」の名前でも登録して、日本語をそれで描く。
// 同じ名前の面は後に書いた方が先に使われるので、本物の JetBrains Mono（後に置かれる、組み立てたフォントの CSS）が英数字では勝つ。
// フォントそのものは、公開用もテスト版も src/main.js で @fontsource から読む。
export function cjkFallback() {
  // 日本語の範囲だけ（記号と句読点・かな・漢字・全角）。罫線（タイトルのロゴ）などは含めない
  const CJK = [
    [0x3000, 0x30ff],
    [0x3400, 0x4dbf],
    [0x4e00, 0x9fff],
    [0xf900, 0xfaff],
    [0xff00, 0xffef],
  ];
  const hex = (n) => n.toString(16);
  const narrow = (range) => {
    const out = [];
    for (const t of range.split(',')) {
      const [a, b] = t
        .trim()
        .replace(/^U\+/i, '')
        .split('-')
        .map((x) => parseInt(x, 16));
      for (const [c0, c1] of CJK) {
        const lo = Math.max(a, c0),
          hi = Math.min(b ?? a, c1);
        if (lo <= hi) out.push(lo === hi ? `U+${hex(lo)}` : `U+${hex(lo)}-${hex(hi)}`);
      }
    }
    return out.join(',');
  };
  const faces = (pkg, w, weight) =>
    readFileSync(join(root, `node_modules/@fontsource/${pkg}/${w}.css`), 'utf8')
      .split('@font-face')
      .slice(1)
      .map((f) => {
        const range = f.match(/unicode-range:\s*([^;]+);/),
          src = f.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
        const r = range && src ? narrow(range[1]) : ''; // 読めない面は飛ばす（@fontsource の書き方が変わった時に落ちないように）
        return r
          ? `@font-face{font-family:'JetBrains Mono';font-style:normal;font-display:swap;font-weight:${weight};src:url(fonts/${pkg}/files/${src}) format('woff2');unicode-range:${r};}\n`
          : '';
      })
      .join('');
  // M PLUS 1 Code には全角の ！？：［］ などが無いので、BIZ UDGothic（ゲームの CSS でも次の候補）で補う。
  // 先に書いた面ほど後回しになるので、BIZ UDGothic を先、M PLUS 1 Code を後に書く。
  const set = (pkg) => faces(pkg, 400, 400) + faces(pkg, 700, 700) + faces(pkg, 700, 800);
  return set('biz-udgothic') + set('m-plus-1-code');
}

// ゲーム本体は src/game/ のファイルを、名前の順につないで、一番外側の関数で包む（ファイルの間で変数を共有するため）。
// 包みの前（モジュールの一番上）には src/game/imports.mjs を置く（TypeScript に移した物を読む import の文。import は関数の中に書けない）。
const GAME_DIR = join(root, 'src/game');
const WRAP_HEAD = "(function(){\n'use strict';\n",
  WRAP_TAIL = '})();\n',
  IMPORTS = 'imports.mjs';
// ファイル名は「2桁の番号-名前.js」。つなぐ順は名前の順なので、番号の無い名前は最後（初期化の後ろ）に回ってしまう
const PART_NAME = /^\d{2}-[a-z0-9-]+\.js$/;
export function gameParts(dir = GAME_DIR) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort();
  const bad = files.filter((f) => !PART_NAME.test(f));
  if (bad.length) throw new Error(`src/game/ のファイル名は「2桁の番号-名前.js」にする（つなぐ順が番号で決まるため）：${bad.join(', ')}`);
  return files;
}
// 改行で終わらないファイルは、次のファイルの1行目とつながってしまう（最後の行がコメントなら、次の行が消える）ので止める
function readPart(f, dir = GAME_DIR) {
  const t = readFileSync(join(dir, f), 'utf8');
  if (!t.endsWith('\n'))
    throw new Error(`src/game/${f} が改行で終わっていない（次のファイルの1行目とつながってしまう）。最後に改行を足すこと`);
  return t;
}
// 包みの前に置くもの（imports.mjs が無ければ空）と、包みの中につなぐもの
const hasImports = (dir) => existsSync(join(dir, IMPORTS));
function pieces(dir = GAME_DIR) {
  return [...(hasImports(dir) ? [IMPORTS] : []), ...gameParts(dir)];
}

export function gameSource({ dir = GAME_DIR } = {}) {
  const head = hasImports(dir) ? readPart(IMPORTS, dir) : '';
  return (
    head +
    WRAP_HEAD +
    gameParts(dir)
      .map((f) => readPart(f, dir))
      .join('') +
    WRAP_TAIL
  );
}

// 文字を調べるテスト（使う文字・文字の幅）のための、ゲームの文言を含む全部の文：ゲーム本体と、TypeScript に移した物（src/lib/）。
// lib は、本物の src/game の時だけ src/lib（テストで別のフォルダを渡した時に、その近くの関係のない .ts を読まないように）
export function gameText({ dir = GAME_DIR, lib = dir === GAME_DIR ? join(root, 'src/lib') : null } = {}) {
  const ts = lib && existsSync(lib) ? readdirSync(lib, { recursive: true }).filter((f) => String(f).endsWith('.ts')) : [];
  return gameSource({ dir }) + ts.map((f) => readFileSync(join(lib, String(f)), 'utf8')).join('');
}

// gameSource() の中で、各ファイルが何行目から何行あるか（imports.mjs は1行目から。包みの2行は、その後ろ）
const WRAP_LINES = WRAP_HEAD.split('\n').length - 1; // 包みの最初の2行
export function gameLayout({ dir = GAME_DIR } = {}) {
  const lines = (f) => readPart(f, dir).split('\n').length - 1,
    head = hasImports(dir) ? [{ file: `src/game/${IMPORTS}`, start: 1, n: lines(IMPORTS) }] : [];
  let at = (head[0]?.n ?? 0) + WRAP_LINES + 1; // 包みの2行の次から
  return head.concat(
    gameParts(dir).map((f) => {
      const e = { file: `src/game/${f}`, start: at, n: lines(f) };
      at += e.n;
      return e;
    }),
  );
}

// gameSource() の行（1始まり）が、どのファイルの何行目かを返す。包みの行なら null。何度も呼ぶ時は layout を渡す
export function locate(line, { layout = gameLayout() } = {}) {
  const e = layout.find((e) => line >= e.start && line < e.start + e.n);
  return e ? { file: e.file, line: line - e.start + 1 } : null;
}

// gameSource() のソースマップ。区切りは、各行の語（名前・数・記号）の頭ごとに置き、元のファイルの同じ行・同じ列に対応させる。
// Vite（Rolldown）は書き直した（字下げなどを整えた）JS を出すが、語の頭ごとに区切りがあるので、列まで正しく引き継がれる。
// 包みの行は対応なし。sources は絶対パス（Vite が出力の場所からの相対に直す）
const TOKEN = /[A-Za-z_$][\w$]*|\d[\w.]*|\S/g;
export function gameSourceMap({ dir = GAME_DIR } = {}) {
  const files = pieces(dir),
    lines = [];
  const add = (f) => {
    const src = files.indexOf(f),
      text = readPart(f, dir).split('\n');
    text.pop(); // 最後の改行の後ろ
    text.forEach((t, l) => {
      const segs = [...t.matchAll(TOKEN)].map((m) => [m.index, src, l, m.index]);
      lines.push(segs.length ? segs : [[0, src, l, 0]]);
    });
  };
  // gameSource() と同じ並び：imports.mjs、包みの2行、つなぐファイル、包みの終わり
  if (hasImports(dir)) add(IMPORTS);
  for (let k = 0; k < WRAP_LINES; k++) lines.push([]);
  gameParts(dir).forEach(add);
  lines.push([]); // WRAP_TAIL
  return { version: 3, sources: files.map((f) => join(dir, f)), names: [], mappings: encodeMappings(lines) };
}
