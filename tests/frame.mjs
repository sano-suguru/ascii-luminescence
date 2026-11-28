#!/usr/bin/env node
// サンドボックス付きの iframe の中（allow-scripts だけ。allow-pointer-lock も allow-same-origin も無い。claude.ai の Artifact より厳しい。
// Artifact では、マウスを捕まえられ、保存も残る）で、止まらずに最後まで遊べるか。
// 外のページ（about:blank）に iframe を置き、テスト用モードのページを開く。起源が null になるので、localStorage にさわると SecurityError になり、
// ポインタロックは断られる（Chromium は Promise の reject と pointerlockerror の両方）。ポインタロックは差し替えない（newPage の realLock）。
//   1. 本物のサンドボックス：タイトル → 探索（ドラッグの案内が1回）→ ドラッグで見回す → Esc でメニュー → 続ける → レベルアップ（Esc では何もしない）→ 祭壇を Esc で閉じる
//      → Esc でメニュー → 死 → 始め直し → タイトル → 図鑑 → もう一度探索
//      同じ流れを、Artifact 版（.build/artifact/index.html。JS・CSS・フォントを全部入れた HTML 1つ）でも通す。Artifact 版は、ほかのファイルを読まないことも確かめる。
//      本物の Artifact には URL の指定が届かず、いつもテスト用モードでない形で動くので、Artifact 版はテスト用モードでなくてもタイトルが出ることも確かめる
//   2. ほかのブラウザ（初めに動く台本で作る）：requestPointerLock が無い（iPhone の Safari など）・呼んでも何も起きない・音の部品を作れない。
//      どれも Esc でメニューが開き、ドラッグで見回せる
// iframe の中のキー入力は、iframe の中を一度クリックしてから届く（タイトルのボタンを押すので届く）。ページのエラーは iframe の中の物も errs に集まる（最後に確かめる）。
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';
import { serve } from '../tools/serve.mjs';
import { ROOT, withBrowser, newPage } from './lib.mjs';

const errs = [];
const W = 960,
  H = 540;

// iframe にテスト用モードのページを開き、準備ができるまで待つ。iframe の中の __test を呼ぶ E を返す
async function openFrame(pg, base, query = '') {
  await pg.setContent(
    `<body style="margin:0"><iframe sandbox="allow-scripts" style="width:${W}px;height:${H}px;border:0;display:block" src="${base}?test=1${query ? '&' + query : ''}"></iframe></body>`,
  );
  const fr = await (await pg.waitForSelector('iframe')).contentFrame();
  await fr.waitForFunction(() => window.__test && (window.__test.ready() || window.__test.error()), null, { timeout: 90000, polling: 200 });
  const err = await fr.evaluate(() => __test.error());
  if (err) throw new Error(`起動に失敗：${err}`);
  return { fr, E: (f, a) => fr.evaluate(f, a) };
}

// 今の様子（止まっているか・メニュー・祭壇やレベルアップの画面・伝言）
const view = (E) =>
  E(() => {
    const s = __test.state();
    return {
      started: s.started,
      dead: s.dead,
      paused: s.paused,
      yaw: s.yaw,
      menu: document.getElementById('menu').classList.contains('show'),
      panel: document.getElementById('altarp').classList.contains('open'),
      log: document.getElementById('log').innerText,
    };
  });
const HINT = 'マウスをドラッグして視点を動かせます';
const count = (s, k) => s.split(k).length - 1;

// 描く画面の上で、左のボタンを押したまま横に動かす（見回す）。押した時に左手の詠唱も始まるので、しばらく進めて終わらせる
async function drag(pg, E, dx) {
  await pg.mouse.move(W / 2, H / 2);
  await pg.mouse.down();
  await pg.mouse.move(W / 2 + dx, H / 2, { steps: 5 });
  await pg.mouse.up();
  await E(() => __test.advance(1.5));
}

// Esc を押して、メニューが開く（開いたらすぐ閉じる）
async function escMenu(pg, E, label) {
  await pg.keyboard.press('Escape');
  await E(() => __test.advance(0.1));
  const v = await view(E);
  if (!v.menu || !v.paused) errs.push(`${label}：Esc でメニューが開かない（menu ${v.menu}、paused ${v.paused}）`);
  return v;
}

// Artifact 版：まとめて走らせる時（tests/run.mjs）は組み立て済み（AL_PREBUILT）
if (process.env.AL_PREBUILT !== '1') await build({ configFile: join(ROOT, 'vite.config.mjs'), mode: 'artifact', logLevel: 'warn' });
if (!existsSync(join(ROOT, '.build/artifact/index.html')))
  throw new Error('Artifact 版（.build/artifact/index.html）が無い。AL_PREBUILT を消すか、pnpm build:artifact で組み立てる');
const artSrv = await serve(join(ROOT, '.build/artifact'), 0, { cors: true });
const artBase = `http://127.0.0.1:${artSrv.port}/index.html`;

await withBrowser(async ({ browser, base }) => {
  // ---------------------------------------------------------------- 1. 本物のサンドボックス（テスト版と Artifact 版）
  for (const [label, url] of [
    ['1', base],
    ['1・Artifact 版', artBase],
  ]) {
    console.log(`■ ${label}`);
    const pg = await newPage(browser, errs, { width: W, height: H, realLock: true });
    // 読んだ物（data: は数えない）。Artifact 版は index.html だけのはず
    const reqs = [];
    pg.on('request', (r) => {
      if (/^https?:/.test(r.url())) reqs.push(r.url().replace(/^https?:\/\/[^/]+\//, ''));
    });
    const { fr, E } = await openFrame(pg, url, 'seed=202');
    // テストの前提：起源が null で、localStorage にさわると例外になる
    const pre = await E(() => {
      let ls = 'ok';
      try {
        void localStorage.length;
      } catch (e) {
        ls = e.name;
      }
      return { origin: self.origin, ls };
    });
    if (pre.origin !== 'null' || pre.ls !== 'SecurityError')
      errs.push(`${label}：テストの前提が崩れた（起源 ${pre.origin}、localStorage ${pre.ls}）`);

    await fr.click('#enter');
    await E(() => __test.advance(2));
    let v = await view(E);
    if (!v.started || v.paused) errs.push(`${label}：探索が始まらない（started ${v.started}、paused ${v.paused}）`);
    if (count(v.log, HINT) !== 1) errs.push(`${label}：ドラッグの案内が1回でない（${count(v.log, HINT)}回）`);

    await drag(pg, E, 100);
    const y1 = (await view(E)).yaw;
    if (Math.abs(y1 - v.yaw) < 0.2) errs.push(`${label}：ドラッグしても向きが変わらない（${v.yaw} → ${y1}）`);

    await escMenu(pg, E, `${label}・探索中`);
    await fr.click('#menu button[data-k="resume"]');
    await E(() => __test.advance(0.1));
    v = await view(E);
    if (v.menu || v.paused) errs.push(`${label}：メニューの「探索を続ける」で戻らない（menu ${v.menu}、paused ${v.paused}）`);

    // レベルアップの画面：選ぶと閉じて、探索に戻る（選べるのは開いてから少したってから）
    await E(() => dbg.exp(400));
    await E(() => __test.advance(0.5));
    if (!(await view(E)).panel) errs.push(`${label}：レベルアップの画面が開かない（テストの前提が崩れた）`);
    // レベルアップの画面では、Esc を押しても何もしない（メニューが上に重なると、選択肢のクリックがメニューに取られる）
    await pg.keyboard.press('Escape');
    await E(() => __test.advance(0.1));
    v = await view(E);
    if (v.menu || !v.panel)
      errs.push(`${label}：レベルアップの画面で Esc を押すと、メニューが開くか画面が閉じる（menu ${v.menu}、panel ${v.panel}）`);
    for (let i = 0; i < 10 && (await view(E)).panel; i++) {
      await E(() => __test.advance(0.8));
      await fr.click('#altarp button[data-lk]');
      await E(() => __test.advance(0.2));
    }
    v = await view(E);
    if (v.panel || v.paused) errs.push(`${label}：レベルアップを選んでも探索に戻らない（panel ${v.panel}、paused ${v.paused}）`);

    // 祭壇の画面：Esc で閉じて探索に戻り、次の Esc でメニューが開く（seed=202 の3階には祭壇がある。tests/smoke.mjs と同じ）
    await E(() => dbg.go(3));
    await E(() => __test.advance(2));
    const near = await E(() => {
      dbg.to('altar');
      const [px, pz] = __test.state().pos,
        d = (o) => Math.hypot(o.pos[0] - px, o.pos[1] - pz);
      const a = dbg
        .items()
        .filter((o) => o.altar && o.slot === 1)
        .sort((p, q) => d(p) - d(q))[0];
      if (!a) return false;
      const [ax, az] = a.pos,
        k = 1.2 / (d(a) || 1);
      dbg.step(ax + (px - ax) * k, az + (pz - az) * k);
      return true;
    });
    await E(() => __test.advance(0.5));
    if (!near || !(await view(E)).panel) errs.push(`${label}：祭壇の画面が開かない（テストの前提が崩れた。祭壇 ${near}）`);
    await pg.keyboard.press('Escape');
    await E(() => __test.advance(0.2));
    v = await view(E);
    if (v.panel || v.paused) errs.push(`${label}：祭壇の画面が Esc で閉じない（panel ${v.panel}、paused ${v.paused}）`);
    await escMenu(pg, E, `${label}・祭壇の後`);
    await pg.keyboard.press('Escape');
    await E(() => __test.advance(0.1));
    if ((await view(E)).menu) errs.push(`${label}：もう一度 Esc を押しても、メニューが閉じない`);

    // 死んで、R で始め直す
    await E(() => dbg.hurt(9999));
    await E(() => __test.advance(3));
    if (!(await view(E)).dead) errs.push(`${label}：死なない（テストの前提が崩れた）`);
    await pg.keyboard.press('KeyR');
    await E(() => __test.advance(2));
    v = await view(E);
    if (v.dead || !v.started || v.paused) errs.push(`${label}：始め直せない（dead ${v.dead}、started ${v.started}、paused ${v.paused}）`);

    // メニューからタイトルへ（2回押して確かめる）、図鑑を開いて戻り、もう一度探索
    await escMenu(pg, E, `${label}・始め直した後`);
    await fr.click('#menu button[data-k="title"]');
    await fr.click('#menu button[data-k="title"]');
    await E(() => __test.advance(1));
    if ((await view(E)).started) errs.push(`${label}：タイトルに戻らない`);
    await fr.click('#galB');
    await E(() => __test.advance(1));
    const glyphs = await E(() => __test.galleryDraw().glyphs);
    if (!(glyphs > 0)) errs.push(`${label}：図鑑の生き物が描かれない（文字 ${glyphs}）`);
    await pg.keyboard.press('Escape');
    await E(() => __test.advance(0.5));
    await fr.click('#enter');
    await E(() => __test.advance(2));
    v = await view(E);
    if (!v.started || v.paused) errs.push(`${label}：図鑑の後、探索が始まらない`);

    // iframe の中のページのエラーも errs に集まるか（集まらないと、このテストは何も確かめていないことになる）
    const n0 = errs.length;
    await E(() => __test.failLater('frame-error-check'));
    await E(() => __test.advance(0.5));
    const got = errs.splice(n0).filter((e) => e.includes('frame-error-check'));
    if (got.length !== 1) errs.push(`${label}：iframe の中のエラーが集まらない（テストの前提が崩れた）`);
    if (url === artBase) {
      const other = reqs.filter((u) => !u.startsWith('index.html'));
      if (other.length) errs.push(`${label}：ほかのファイルを読んでいる（${other.slice(0, 5).join(' ')}）`);
    } else if (!reqs.some((u) => u.endsWith('.woff2'))) errs.push(`${label}：読んだ物を集められていない（テストの前提が崩れた）`);
    await pg.close();
  }

  // ---------------------------------------------------------------- 1'. Artifact 版を、テスト用モードでなく開く（本物の Artifact と同じ）。
  // ゲームを止めて進められないので、タイトルが出て、背景の迷宮を描いたフレームが2つ進むまでだけ待つ（tests/title.mjs と同じ）
  {
    const label = "1'・Artifact 版（テスト用モードでない）";
    console.log(`■ ${label}`);
    const pg = await newPage(browser, errs, { width: W, height: H, realLock: true });
    await pg.setContent(
      `<body style="margin:0"><iframe sandbox="allow-scripts" style="width:${W}px;height:${H}px;border:0;display:block" src="${artBase}"></iframe></body>`,
    );
    const fr = await (await pg.waitForSelector('iframe')).contentFrame();
    await fr.waitForSelector('#enter', { timeout: 90000 });
    const st = await fr.evaluate(
      () =>
        new Promise((ok) => {
          let n = 0;
          const f = () =>
            ++n >= 2
              ? ok({ test: typeof window.__test, title: document.getElementById('intropanel')?.innerText ?? '' })
              : requestAnimationFrame(f);
          requestAnimationFrame(f);
        }),
    );
    if (st.test !== 'undefined') errs.push(`${label}：テスト用モードになっている（テストの前提が崩れた）`);
    if (!st.title.includes('シード')) errs.push(`${label}：タイトルの画面が出ない（${st.title.slice(0, 80)}）`);
    await pg.close(); // テスト用モードでないので、開いたままだと描き続けて重い
  }

  // ---------------------------------------------------------------- 2. ほかのブラウザ
  const kinds = {
    // requestPointerLock が無い（iPhone の Safari など）：ドラッグの案内も出る
    none: () => {
      HTMLCanvasElement.prototype.requestPointerLock = undefined;
      delete Element.prototype.requestPointerLock;
    },
    // 呼んでも何も起きない（Promise も事件も無い）：案内は出ないが、Esc でメニューは開く
    silent: () => {
      HTMLCanvasElement.prototype.requestPointerLock = () => undefined;
    },
    // 音の部品を作れない
    noaudio: () => {
      window.AudioContext = function () {
        throw new Error('audio blocked');
      };
    },
  };
  for (const [kind, init] of Object.entries(kinds)) {
    const label = `2・${kind}`;
    console.log(`■ ${label}`);
    const pg = await newPage(browser, errs, { width: W, height: H, realLock: true });
    await pg.addInitScript(init); // ページの中の iframe でも動く
    const { fr, E } = await openFrame(pg, base, 'seed=202');
    await fr.click('#enter');
    await E(() => __test.advance(2));
    let v = await view(E);
    if (!v.started || v.paused) errs.push(`${label}：探索が始まらない（started ${v.started}、paused ${v.paused}）`);
    const hints = count(v.log, HINT);
    if (hints !== (kind === 'silent' ? 0 : 1)) errs.push(`${label}：ドラッグの案内が ${hints} 回`);
    await drag(pg, E, 100);
    const y1 = (await view(E)).yaw;
    if (Math.abs(y1 - v.yaw) < 0.2) errs.push(`${label}：ドラッグしても向きが変わらない（${v.yaw} → ${y1}）`);
    await escMenu(pg, E, label);
    await pg.keyboard.press('Escape');
    await E(() => __test.advance(0.1));
    v = await view(E);
    if (v.menu || v.paused) errs.push(`${label}：もう一度 Esc を押しても、メニューが閉じない`);
    await pg.close();
  }
});
artSrv.close();
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
