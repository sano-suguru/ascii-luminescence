// Vite のプラグイン（vite.config.mjs から使う）。
//   legacyGame()     src/game/*.js を名前の順につなぎ、一番外側の関数で包んだ1つのモジュール（virtual:legacy-game）にする。
//                    ソースマップで、元のファイルの行に戻せる。開発用サーバーでは、src/game/ が変わったらページを読み直す
//   testPage(outDir) テスト版：JetBrains Mono を指定した所の日本語も、決まったフォント（M PLUS 1 Code）で描く面を足す（cjkFallback。
//                    どのマシンでも同じ文字の形になる）。three.js とフォントは、公開用もテスト版も npm から組み立てに入れる
//   privateMaps(dir) ソースマップを出力の外（.build/maps/）へ移す。公開物には入れない（tools/where.mjs とテストだけが読む）
//   noCssStub()      ページの中の <style> から Vite が作る、空の JS の部品を消す
//   fontCss()        @fontsource の CSS を絞る：古い形式（woff）の候補を外し、BIZ UDGothic は補いの文字（BIZ_CHARS）を含む面だけ残す
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { BIZ_CHARS } from '../src/lib/text.ts';
import { cjkFallback, gameSource, gameSourceMap } from './game-source.mjs';

const root = join(import.meta.dirname, '..');
const GAME_DIR = join(root, 'src/game');
// 解決した名前は、ファイルの形にする（'\0' で始まる仮の名前のモジュールには、Rolldown がソースマップを作らないため）。
// このファイルは実際には無く、中身は load が返す。src/game/ の中の名前にして、imports.mjs の相対パス（'../lib/…'）が、
// エディタで開いた時と同じ所を指すようにしている
const ID = 'virtual:legacy-game',
  RID = join(GAME_DIR, 'index.js');

// 開発用サーバーだけで、ゲーム本体の後ろに足す。テスト用モード（?test=1）は時計（setTimeout）を止めるので、Vite の読み直し
// （setTimeout で少し待ってから読み直す）が動かない。読み直しの合図を受けたら、すぐ読み直す。組み立てた物には入れない
const DEV_TAIL = `if (import.meta.hot && new URLSearchParams(location.search).get('test') === '1')
  import.meta.hot.on('vite:beforeFullReload', () => location.reload());
`;

export function legacyGame() {
  let serve = false;
  return {
    name: 'legacy-game',
    configResolved(config) {
      serve = config.command === 'serve';
    },
    resolveId: (id) => (id === ID ? RID : null),
    load(id) {
      if (id !== RID) return null;
      const map = gameSourceMap();
      for (const f of map.sources) this.addWatchFile(f);
      return { code: gameSource() + (serve ? DEV_TAIL : ''), map };
    },
    // 開発用サーバー：ゲームは HMR に対応していないので、ページを読み直す。
    // 変えた時は、Vite が自分で読み直す（load の addWatchFile で、つないだファイルを見張っている）。
    // 足した・消した時は Vite が知らないファイルなので、ここでつなぎ直して読み直させる（変えた時にもここで送ると、2回読み直してしまう）
    configureServer(server) {
      server.watcher.add(GAME_DIR);
      server.watcher.on('all', (ev, file) => {
        if ((ev !== 'add' && ev !== 'unlink') || dirname(resolve(file)) !== GAME_DIR) return;
        const env = server.environments.client,
          mod = env.moduleGraph.getModuleById(RID);
        if (mod) env.moduleGraph.invalidateModule(mod);
        env.hot.send({ type: 'full-reload' });
      });
    },
  };
}

// ページの中の <style> を、Vite は一度 CSS の部品（index.html?html-proxy&inline-css…）として扱い、中身を HTML に戻す。
// 残った部品は空の文字列を返すだけの JS になる（var index_html_html_proxy_… = ""）。使っていないコードを消さない設定
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
    // 書き出した .map を移し、sources をリポジトリからの相対（src/game/xx.js）に直す
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
