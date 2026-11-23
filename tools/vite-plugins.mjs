// Vite のプラグイン（vite.config.mjs から使う）。
//   legacyGame()     src/game/*.js を名前の順につなぎ、一番外側の関数で包んだ1つのモジュール（virtual:legacy-game）にする。
//                    ソースマップで、元のファイルの行に戻せる。開発用サーバーでは、src/game/ が変わったらページを読み直す
//   testPage(outDir) テスト版：three.js とフォントを、CDN と Google Fonts の代わりに node_modules から読む（オフラインで動き、
//                    どのマシンでも同じ文字の形になる）
//   privateMaps(dir) ソースマップを出力の外（.build/maps/）へ移す。公開物には入れない（tools/where.mjs とテストだけが読む）
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { CDN, TEST_FONTS, cjkFallback, gameSource, gameSourceMap } from './game-source.mjs';

const root = join(import.meta.dirname, '..');
const GAME_DIR = join(root, 'src/game');
// 解決した名前は、ファイルの形にする（'\0' で始まる仮の名前のモジュールには、Rolldown がソースマップを作らないため）。
// このファイルは実際には無く、中身は load が返す
const ID = 'virtual:legacy-game',
  RID = join(root, 'src/legacy-game.js');

export function legacyGame() {
  return {
    name: 'legacy-game',
    resolveId: (id) => (id === ID ? RID : null),
    load(id) {
      if (id !== RID) return null;
      const map = gameSourceMap();
      for (const f of map.sources) this.addWatchFile(f);
      return { code: gameSource(), map };
    },
    // 開発用サーバー：ファイルを足した・消した・変えた時に、つなぎ直してページを読み直す（ゲームは HMR に対応していない）
    configureServer(server) {
      server.watcher.add(GAME_DIR);
      server.watcher.on('all', (_ev, file) => {
        if (dirname(resolve(file)) !== GAME_DIR) return;
        const env = server.environments.client,
          mod = env.moduleGraph.getModuleById(RID);
        if (mod) env.moduleGraph.invalidateModule(mod);
        env.hot.send({ type: 'full-reload' });
      });
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
    // Vite が HTML を処理した後に置き換える（先に置き換えると、Vite が three.js やフォントの CSS を組み込もうとする）
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!html.includes(CDN)) throw new Error('three.js の <script>（CDN）が src/index.html に見つからない');
        html = html.replaceAll(CDN, 'three/');
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
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      for (const [, f] of html.matchAll(/src="three\/([^"]+)"/g)) {
        const dst = join(outDir, 'three', f);
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(join(root, 'node_modules/three', f), dst);
      }
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
