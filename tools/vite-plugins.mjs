// Vite のプラグイン（vite.config.mjs から使う）。
//   legacyGame()     src/game/*.js を名前の順につなぎ、一番外側の関数で包んだ1つのモジュール（virtual:legacy-game）にする。
//                    ソースマップで、元のファイルの行に戻せる。開発用サーバーでは、src/game/ が変わったらページを読み直す
//   testPage(outDir) テスト版：フォントを、Google Fonts の代わりに node_modules の @fontsource から読む（オフラインで動き、
//                    どのマシンでも同じ文字の形になる）。three.js は、公開用もテスト版も npm から組み立てに入れる
//   privateMaps(dir) ソースマップを出力の外（.build/maps/）へ移す。公開物には入れない（tools/where.mjs とテストだけが読む）
//   noCssStub()      ページの中の <style> から Vite が作る、空の JS の部品を消す
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { TEST_FONTS, cjkFallback, gameSource, gameSourceMap } from './game-source.mjs';

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

export function testPage() {
  let outDir;
  return {
    name: 'test-page',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // Vite が HTML を処理した後に置き換える（先に置き換えると、Vite がフォントの CSS を組み込もうとする）
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const links = html.match(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g) || [];
        if (!links.some((l) => l.includes('stylesheet'))) throw new Error('Google Fonts の <link> が src/index.html に見つからない');
        html = html.replace(
          links[0],
          `<style>\n${cjkFallback()}</style>\n` + TEST_FONTS.map((f) => `<link rel="stylesheet" href="fonts/${f}.css">\n`).join(''),
        );
        for (const l of links.slice(1)) html = html.replace(l, '');
        return html;
      },
    },
    writeBundle() {
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
