// Vite のプラグイン（vite.config.mjs から使う）。
//   testPage(outDir) テスト版：JetBrains Mono を指定した所の日本語も、決まったフォント（M PLUS 1 Code）で描く面を足す（cjkFallback。
//                    どのマシンでも同じ文字の形になる）。three.js とフォントは、公開用もテスト版も npm から組み立てに入れる
//   privateMaps(dir) ソースマップを出力の外（.build/maps/）へ移す。公開物には入れない（tools/where.mjs とテストだけが読む）
//   noCssStub()      ページの中の <style> から Vite が作る、空の JS モジュールを消す
//   fontCss()        @fontsource の CSS を絞る：古い形式（woff）の候補を外し、BIZ UDGothic は補いの文字（BIZ_CHARS）を含む面だけ残す
//   homeScreen()     公開用：ホーム画面に置けるようにする（Web アプリの宣言 manifest.webmanifest とアイコンを出し、HTML から読む）
//   inlineAll()      Artifact 版：JS と CSS を index.html の中に書き込み、HTML 1つにする（フォントは vite.config.mjs が CSS の data URI にする）。
//                    ARTIFACT_MAX を越えたら止める
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BIZ_CHARS } from '../src/lib/text.ts';

const root = join(import.meta.dirname, '..');

// ページの中の <style> を、Vite は一度 CSS のモジュール（index.html?html-proxy&inline-css…）として扱い、中身を HTML に戻す。
// 残ったモジュールは空の文字列を返すだけの JS になる（var index_html_html_proxy_… = ""）。使っていないコードを消さない設定
// （vite.config.mjs の rolldownOptions）なので、そのまま出力に残ってしまう。中身を HTML に戻した後なので、空にしてよい
export function noCssStub() {
  return {
    name: 'no-css-stub',
    apply: 'build',
    transform: {
      order: 'post',
      handler: (_code, id) => (/[?&]html-proxy&inline-css/.test(id) ? { code: '', map: null } : null),
    },
  };
}

// @fontsource の CSS を絞る（公開用もテスト版も同じ）。
// - 面ごとに src: url(….woff2) format('woff2'), url(….woff) format('woff') と2つの形式を書いている。woff は woff2 を読めない古いブラウザ向けで、
//   今のブラウザは読まない。外さないと、使われないファイルが同じ数だけ組み立てに入る
// - BIZ UDGothic は、M PLUS 1 Code に無い数文字（src/lib/text.ts の BIZ_CHARS）を補うだけなので、その文字を含む面だけ残す
//   （全部の面だと、ページを開くたびに読む CSS が約20万字増える。前の Google Fonts の text= と同じ考え）
// unicode-range（U+XXXX・U+XXXX-YYYY をコンマで並べた物）を [始め, 終わり] の並びにする。読めない形（U+4?? など）はエラー
const ranges = (range) =>
  range.split(',').map((t) => {
    const m = t.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) throw new Error(`読めない unicode-range：${t.trim()}（@fontsource の書き方が変わった？）`);
    const a = parseInt(m[1], 16);
    return [a, m[2] ? parseInt(m[2], 16) : a];
  });
// 補いの文字を、1文字（コードポイント）ずつに分けた物。unicode-range もコードポイントで書く
const BIZ_LIST = Array.from(BIZ_CHARS);
const inRanges = (rs, ch) => {
  const c = ch.codePointAt(0);
  return rs.some(([a, b]) => c >= a && c <= b);
};
export function fontCss() {
  return {
    name: 'font-css',
    transform: {
      order: 'pre',
      handler(code, id) {
        const path = id.split('?')[0]; // ?inline・?url などの問い合わせが付いても、同じく絞る
        if (!/[\\/]@fontsource[\\/].*\.css$/.test(path)) return null;
        let out = code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
        if (/\.woff\)/.test(out)) throw new Error(`woff の候補を外せなかった（@fontsource の書き方が変わった？）：${id}`);
        if (/[\\/]biz-udgothic[\\/]/.test(path)) {
          const faces = (out.match(/\/\*[^*]*\*\/\s*@font-face\s*\{[^}]*\}|@font-face\s*\{[^}]*\}/g) || []).map((f) => ({
            f,
            rs: ranges(f.match(/unicode-range:\s*([^;]+);/)?.[1] ?? 'U+0-10FFFF'),
          }));
          const keep = faces.filter(({ rs }) => BIZ_LIST.some((ch) => inRanges(rs, ch)));
          // 補いの文字が、どれも残した面のどれかに入っていること（入っていないと、その文字が別のフォントで描かれ、枠の縦線がずれる）
          const lost = BIZ_LIST.filter((ch) => !keep.some(({ rs }) => inRanges(rs, ch)));
          if (lost.length) throw new Error(`BIZ UDGothic に、補いの文字 ${lost.join(' ')} を含む面が無い：${id}`);
          out = keep.map(({ f }) => f).join('\n') + '\n';
        }
        return { code: out, map: null };
      },
    },
  };
}

// ゲームは JetBrains Mono を指定した所でも日本語を書く。JetBrains Mono に日本語は無いので、テスト版のほか（公開用の版・開発用サーバー）では
// システムの日本語フォントで描画される（マシンごとに違う）。テスト版では、M PLUS 1 Code の面を「JetBrains Mono」の名前でも登録して、日本語をそれで描く。
// 同じ名前の面は後に書いた方が先に使われるので、英数字では、本物の JetBrains Mono（後に置かれる、組み立てたフォントの CSS）が使われる。
// フォントそのものは、公開用もテスト版も src/main.js で @fontsource から読む。
function cjkFallback() {
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

export function testPage() {
  let outDir;
  return {
    name: 'test-page',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // Vite が HTML を処理した後に足す（先に足すと、Vite が中のフォントの URL を組み込もうとする）。
    // 同じ名前の面は後に書いた方が先に使われるので、組み立てたフォントの CSS（Vite が <head> の終わりに置く <link>）より前、<title> の直後に置く
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!html.includes('</title>\n')) throw new Error('src/index.html に </title> が見つからない');
        return html.replace('</title>\n', `</title>\n<style>\n${cjkFallback()}</style>\n`);
      },
    },
    writeBundle() {
      // cjkFallback の面は fonts/ から読む
      symlinkSync(join(root, 'node_modules/@fontsource'), join(outDir, 'fonts'), 'junction');
    },
  };
}

// ホーム画面に置けるようにする（公開用の組み立てだけ。テスト版と Artifact 版には入れない：Artifact はほかのファイルを読めず、テスト版は要らない）。
// display は standalone（iPhone は fullscreen が効かない。standalone ならアドレスバーが消える）。アイコンは src/icons/（tools/icons.mjs で作る）。
// iPhone はホーム画面のアイコンを apple-touch-icon から取り、アドレスバーを消すかを apple-mobile-web-app-capable で決める
export const HOME_ICONS = [192, 512];
export function homeScreen() {
  const manifest = {
    name: 'ASCII LUMINESCENCE',
    short_name: 'ASCII LUMI',
    lang: 'ja',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#030209',
    theme_color: '#030209',
    icons: HOME_ICONS.map((n) => ({ src: `icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })),
  };
  return {
    name: 'home-screen',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!html.includes('</title>\n')) throw new Error('src/index.html に </title> が見つからない');
        const head = [
          '<link rel="manifest" href="./manifest.webmanifest">',
          '<link rel="apple-touch-icon" href="./icon-192.png">',
          '<meta name="theme-color" content="#030209">',
          '<meta name="mobile-web-app-capable" content="yes">',
          '<meta name="apple-mobile-web-app-capable" content="yes">',
          '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
          '<meta name="apple-mobile-web-app-title" content="ASCII LUMI">',
        ];
        return html.replace('</title>\n', `</title>\n${head.join('\n')}\n`);
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: `${JSON.stringify(manifest, null, 2)}\n` });
      for (const n of HOME_ICONS)
        this.emitFile({ type: 'asset', fileName: `icon-${n}.png`, source: readFileSync(join(root, `src/icons/icon-${n}.png`)) });
    },
  };
}

export function privateMaps(mapDir) {
  let outDir;
  return {
    name: 'private-maps',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    buildStart() {
      rmSync(mapDir, { recursive: true, force: true });
    },
    // 書き出した .map を移し、sources をリポジトリからの相対（src/lib/xx.ts など）に直す
    writeBundle() {
      const assets = join(outDir, 'assets');
      let files = [];
      try {
        files = readdirSync(assets).filter((f) => f.endsWith('.map'));
      } catch {}
      mkdirSync(join(mapDir, 'assets'), { recursive: true });
      for (const f of files) {
        const src = join(assets, f),
          map = JSON.parse(readFileSync(src, 'utf8'));
        map.sources = map.sources.map((s) => relative(root, resolve(assets, s)));
        delete map.sourcesContent;
        writeFileSync(join(mapDir, 'assets', f), JSON.stringify(map));
        rmSync(src);
      }
    },
  };
}

// Artifact 版（vite build --mode artifact）：claude.ai の Artifact は、外から読める物が決まっている（決まった CDN の script と Google Fonts の CSS だけ）。
// 同じ所に置いたファイルを読めるかは決まりに書かれていないので、全部を HTML 1つに入れる。フォントは vite.config.mjs が CSS の data URI にする。
// HTML 1つは 16MB まで（Artifact の決まり）。少し手前で止める
export const ARTIFACT_MAX = 16_000_000;
export function inlineAll() {
  return {
    name: 'inline-all',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') throw new Error('index.html が出力に無い');
      let html = String(page.source);
      const take = (file) => {
        const f = bundle[file];
        if (!f) throw new Error(`index.html が読む ${file} が出力に無い`);
        delete bundle[file];
        delete bundle[`${file}.map`];
        return f.type === 'chunk' ? f.code : String(f.source);
      };
      // 中に書くと、文の中の </script や </style が、その場で要素を閉じてしまう。script の中の <!-- は、後に <script があると
      // パーサーの読み方を変え（double escaped）、本当の </script> で閉じなくなるので、これも止める
      const body = (code, tag) => {
        if (new RegExp(`</${tag}`, 'i').test(code)) throw new Error(`中に書く文に </${tag} がある`);
        if (tag === 'script' && code.includes('<!--')) throw new Error('中に書く script に <!-- がある');
        return code;
      };
      // まず読む所を印に替え、ほかのファイルを読む所が残っていないかを、中に書く前の HTML で確かめる（中に書いた JS の文字列は調べない）
      const parts = [];
      const mark = (code) => `\0${parts.push(code) - 1}\0`;
      html = html
        .replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_m, f) =>
          mark(`<script type="module">\n${body(take(f), 'script')}</script>`),
        )
        .replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_m, f) => mark(`<style>\n${body(take(f), 'style')}</style>`));
      if (/\s(?:src|href)="\.\//.test(html)) throw new Error('index.html に、ほかのファイルを読む所が残っている');
      html = html.replace(/\0(\d+)\0/g, (_m, i) => parts[Number(i)] ?? '');
      // ソースマップ（.map）は、中に書いた後は行が合わないので出さない
      for (const f of Object.keys(bundle)) if (f.endsWith('.map')) delete bundle[f];
      const left = Object.keys(bundle).filter((f) => f !== 'index.html');
      if (left.length) throw new Error(`HTML の中に入れられなかったファイルがある：${left.join(' ')}`);
      const size = Buffer.byteLength(html);
      if (size > ARTIFACT_MAX) throw new Error(`Artifact 版の HTML が大きすぎる：${size} バイト（${ARTIFACT_MAX} まで）`);
      page.source = html;
    },
  };
}
