#!/usr/bin/env node
// PV を撮る（テスト版を組み立てて、テスト用モードで1フレームずつ描いて写し、ffmpeg でつなぐ）。台本は tools/pv/scenes.mjs（決まりは tools/pv/script.mjs の頭）。
//   node tools/pv.mjs                 全部の場面を下書きで撮る（960×540・4フレームに1枚。場面ごとに30秒ほど）
//   node tools/pv.mjs 反応 竜          名前で選ぶ
//   --full                            本番（1920×1080・毎フレーム。場面ごとに数分）
//   --jobs 3                          同時に撮る場面の数（既定 3）
//   --out <ディレクトリ>              置き場所（既定 tests/out/pv/。下書きは draft/、本番は full/ の下）
//   --no-video                        つながない（ffmpeg が無い時も、つながずに写真だけ残す）
// 撮った後に、台本の expect を確かめる（反応が起きたか・的が写っているか・火が燃え広がったか・生き物が逃げたか・手の名前が変わったか）。
// カメラは、決めた位置が岩の中・壁に近い・見る所まで岩を通る時、左右を入れ替える・近づけるを試して置ける所を探す（動かした時は知らせる）。
// 確かめが落ちた・カメラを置けない・ページのエラーがあれば、終わりのコードを 1 にする。写真・場面ごとの記録 summary.json・つないだ pv.mp4 は置き場所に。
// CI には入れない（遅い。ffmpeg も要る）。台本の決まりは単体テスト tests/unit/pv-script.test.mjs が確かめる
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { withBrowser, newPage, openTest, advance, frames, arg, OUT } from '../tests/lib.mjs';
import { installPageLib } from './pv/page.mjs';
import SCENES from './pv/scenes.mjs';
import { FPS, captionAlpha, checkScenes, ease, hideOf } from './pv/script.mjs';

const argv = process.argv.slice(2);
const FULL = argv.includes('--full'),
  VIDEO = !argv.includes('--no-video');
const JOBS = Math.max(1, Number(arg('--jobs', 3)) || 3);
const W = FULL ? 1920 : 960,
  H = FULL ? 1080 : 540,
  STRIDE = FULL ? 1 : 4;
const VALUED = new Set(['--jobs', '--out']);
const pick = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1] ?? ''));
const outDir = join(resolve(arg('--out', join(OUT, 'pv'))), FULL ? 'full' : 'draft');
// 隠す画面の表示（'hud'）。show で見せる物は除く
const HUD = [
  '#status',
  '#help',
  '#mapwrap',
  '#log',
  '#look',
  '#hint',
  '#arrows',
  '#hotbar',
  '#resume',
  '#under',
  '#touchbar',
  '#dbgp',
  '#cross',
  '#stratum',
  '#pack',
];

const errs = checkScenes(SCENES);
if (errs.length) {
  console.log(`台本の誤り：\n  ${errs.join('\n  ')}`);
  process.exit(1);
}
const scenes = SCENES.filter((s) => !pick.length || pick.includes(s.name));
const unknown = pick.filter((p) => !SCENES.some((s) => s.name === p));
if (unknown.length) {
  console.log(`台本に無い場面：${unknown.join('・')}（ある場面：${SCENES.map((s) => s.name).join('・')}）`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

/** 1つの場面を撮る。{name, frames, fails（確かめが落ちた・撮れなかった）, info（知らせ）, sec} を返す */
async function shoot(browser, base, S) {
  const dir = join(outDir, S.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const pageErrs = [],
    fails = [],
    info = [],
    t0 = Date.now();
  const pg = await newPage(browser, pageErrs, { width: W, height: H, still: true });
  await openTest(pg, base, S.title ? '' : S.place);
  const hide = hideOf(S),
    show = new Set(S.show ?? []);
  const css = S.title
    ? '#intropanel{display:none!important}'
    : hide.has('hud')
      ? `${HUD.filter((id) => !show.has(id.slice(1))).join(',')}{visibility:hidden!important}`
      : '';
  if (css) await pg.addStyleTag({ content: css });
  await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(installPageLib);
  if (!S.title) {
    await advance(pg, 2.5); // 階に入ると、約1.25秒かけて明るくなる
    fails.push(...(await pg.evaluate(([steps, target, h]) => __pv.setup(steps, target, h), [S.setup ?? [], S.target ?? null, [...hide]])));
    if (S.cam) {
      const c = await pg.evaluate((C) => __pv.findCam(C), S.cam);
      if (!c) fails.push('カメラを置ける所が無い（左右を入れ替えても近づけても、岩の中か、見る所まで岩を通る）');
      else {
        if (!c.room) info.push(`カメラのそばに壁がある（横に ${S.cam.clear ?? 1.2} まで空いた所が無い）`);
        if (c.sign !== 1 || c.s !== 1) info.push(`カメラを動かした（${c.sign < 0 ? '左右を入れ替え・' : ''}距離 ${c.s} 倍）`);
      }
    }
  }
  const n = Math.round(S.sec * FPS),
    events = (S.events ?? []).map(([at, op, a]) => ({ at, op, a, done: false })),
    pending = new Map(); // 手 → 'charge'（溜めている）か 'hit'（当たるのを待つ）
  let lastHit = null,
    hp0 = null,
    camBad = 0,
    hand0 = null,
    mid = null;
  const away = {},
    held = new Set(),
    book0 = await pg.evaluate(() => localStorage.getItem('al_book'));
  for (let f = 0; f < n; f++) {
    const t = f / FPS;
    for (const e of events) {
      if (e.done) continue;
      const when = e.at === 'afterHit' ? (lastHit === null ? Infinity : lastHit + 6) : Math.round(e.at * FPS);
      if (f < when) continue;
      e.done = true;
      if (e.op === 'strike') {
        hp0 = await pg.evaluate(() => __pv.targetHp());
        await pg.evaluate(() => __pv.aimTarget());
        await pg.evaluate((h) => __test.press(h), e.a);
        const charging = await pg.evaluate(() => !!__test.state().cast);
        lastHit = null;
        pending.set(e.a, charging ? 'charge' : 'hit');
      } else if (e.op === 'key') await pg.keyboard.press(e.a);
      else if (e.op === 'click') {
        if (e.a.slot) hand0 = await pg.evaluate(() => document.getElementById('hotbar').textContent);
        const ok = await pg.evaluate((a) => {
          const b = a.bag
            ? [...document.querySelectorAll('#pack [data-b]')].find((x) => x.textContent.includes(a.bag))
            : document.querySelector(`#pack [data-h="${a.slot[0]}"][data-s="${a.slot[1]}"]`);
          if (b) b.click();
          return !!b;
        }, e.a);
        if (!ok) fails.push(`${t.toFixed(1)}秒：押すボタンが無い ${JSON.stringify(e.a)}`);
      } else if (e.op === 'kill') await pg.evaluate(() => dbg.kill('near'));
      else if (e.op === 'ignite') {
        const k = await pg.evaluate((r) => __pv.ignite(r), e.a);
        if (!k) fails.push(`${t.toFixed(1)}秒：的の足もとに燃える物のあるマスが無い`);
      }
    }
    // 溜めきったら、的へ向き直して離す。離した後（溜めない武器は押した後）は、的の体力が減るのを待つ
    for (const [h, phase] of pending) {
      if (phase === 'charge' && (await pg.evaluate(() => !!__test.state().cast?.full))) {
        await pg.evaluate(() => __pv.aimTarget());
        await pg.evaluate((hh) => __test.release(hh), h);
        pending.set(h, 'hit');
      } else if (phase === 'hit') {
        const hp = await pg.evaluate(() => __pv.targetHp());
        if (hp !== null && hp0 !== null && hp < hp0) {
          lastHit = f;
          pending.delete(h);
        }
      }
    }
    if (S.eye) {
      const want = new Set(S.eye.walk && t >= S.eye.walk[0] && t < S.eye.walk[1] ? ['KeyW'] : []);
      for (const k of want)
        if (!held.has(k)) {
          await pg.keyboard.down(k);
          held.add(k);
        }
      // Set を回しながら、今の物を消してよい（JS の決まり）
      for (const k of held)
        if (!want.has(k)) {
          await pg.keyboard.up(k);
          held.delete(k);
        }
      await pg.evaluate(([tt, k, eye]) => __pv.eyeLook(tt, k, eye), [t, f / n, S.eye]);
    }
    if (S.cam) {
      const r = await pg.evaluate(([C, k]) => __pv.placeCam(C, k), [S.cam, ease(f / n)]);
      if (r !== 'ok' && camBad++ === 0) info.push(`${t.toFixed(1)}秒：カメラを動かせない（${r}。前の所のまま）`);
    }
    if (S.caption) await pg.evaluate(([txt, a]) => __pv.caption(txt, a), [S.caption, captionAlpha(f, n)]);
    if (f % STRIDE === STRIDE - 1 || f === n - 1) {
      await frames(pg, 1);
      await pg.screenshot({ path: join(dir, `${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: FULL ? 93 : 85, timeout: 90000 });
      if (!mid && f >= n / 2 && S.target) mid = await pg.evaluate(() => __pv.targetView());
      // 火から逃げるのは 1.6 秒ほどで、その後はまたプレイヤーへ向かうので、場面の間で一番離れた距離を覚える
      if (S.expect?.away)
        for (const [k, v] of Object.entries(await pg.evaluate(() => __pv.away()))) away[k] = Math.max(away[k] ?? -Infinity, v);
    } else await advance(pg, 1 / FPS);
  }
  for (const k of held) await pg.keyboard.up(k);
  for (const [h] of pending) fails.push(`手 ${h} の一撃が、場面の終わりまでに当たらない`);
  const X = S.expect ?? {};
  if (X.book) {
    const b = await pg.evaluate(() => localStorage.getItem('al_book'));
    if (!(b ?? '').includes(`"${X.book}"`)) fails.push(`反応 ${X.book} が起きていない（魔導書の記録 ${book0} → ${b}）`);
  }
  if (X.visible && !(mid && mid.glyphs > 0 && mid.cut < 0.5))
    fails.push(`半ばで的が写っていない（${JSON.stringify(mid && { glyphs: mid.glyphs, cut: mid.cut })}）`);
  if (X.burning) {
    const k = await pg.evaluate(() => __pv.burning());
    if (k < X.burning) fails.push(`燃えているマスが ${k}（${X.burning} 以上のはず）`);
    else info.push(`燃えているマス ${k}`);
  }
  if (X.away) {
    const d = Object.fromEntries(Object.entries(away).map(([k, v]) => [k, +v.toFixed(2)]));
    if (!Object.values(d).some((v) => v >= X.away))
      fails.push(`火から ${X.away} 以上離れた生き物がいない（一番離れた時 ${JSON.stringify(d)}）`);
    else info.push(`火から一番離れた距離 ${JSON.stringify(d)}`);
  }
  if (X.hand) {
    const h1 = await pg.evaluate(() => document.getElementById('hotbar').textContent);
    if (hand0 === null || h1 === hand0) fails.push(`手の名前が変わらない（${h1.trim()}）`);
    else info.push(`手の名前 ${hand0.trim().replace(/\s+/g, ' ')} → ${h1.trim().replace(/\s+/g, ' ')}`);
  }
  fails.push(...pageErrs.map((e) => `ページのエラー：${e}`));
  await pg.close();
  return { name: S.name, frames: n, fails, info, sec: Math.round((Date.now() - t0) / 1000) };
}

const results = [];
await withBrowser(async ({ browser, base }) => {
  const queue = [...scenes];
  await Promise.all(
    Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
      for (let S = queue.shift(); S; S = queue.shift()) {
        const r = await shoot(browser, base, S);
        results.push(r);
        console.log(`${r.fails.length ? '✗' : '✓'} ${r.name}（${r.frames} フレーム・${r.sec}秒）`);
        for (const m of r.fails) console.log(`    落ちた：${m}`);
        for (const m of r.info) console.log(`    ${m}`);
      }
    }),
  );
});
results.sort((a, b) => scenes.findIndex((s) => s.name === a.name) - scenes.findIndex((s) => s.name === b.name));
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(results, null, 1));

// つなぐ：場面の順に、0.4 秒ずつ重ねて切り替え、頭は黒から、終わりは黒へ。音は無音の欄だけ入れる
if (VIDEO) {
  let ffmpeg = true;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    ffmpeg = false;
    console.log('ffmpeg が無いので、つながない（写真は残した）');
  }
  if (ffmpeg) {
    const rate = FPS / STRIDE,
      fade = 0.4,
      input = [],
      parts = [];
    let off = 0,
      prev = '';
    scenes.forEach((S, i) => {
      const files = readdirSync(join(outDir, S.name)).filter((f) => f.endsWith('.jpg'));
      input.push('-framerate', String(rate), '-pattern_type', 'glob', '-i', join(outDir, S.name, '*.jpg'));
      parts.push(`[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[v${i}]`);
      const d = files.length / rate;
      if (i === 0) [prev, off] = ['v0', d];
      else {
        const o = off - fade;
        parts.push(`[${prev}][v${i}]xfade=transition=fade:duration=${fade}:offset=${o.toFixed(3)}[x${i}]`);
        [prev, off] = [`x${i}`, o + d];
      }
    });
    parts.push(`[${prev}]fade=t=in:st=0:d=0.6,fade=t=out:st=${(off - 0.9).toFixed(3)}:d=0.9[out]`);
    const mp4 = join(outDir, 'pv.mp4');
    execFileSync(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-y',
        ...input,
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=48000:cl=stereo',
        '-filter_complex',
        parts.join(';'),
        '-map',
        '[out]',
        '-map',
        `${scenes.length}:a`,
        '-shortest',
        '-c:v',
        'libx264',
        '-preset',
        FULL ? 'slow' : 'veryfast',
        '-crf',
        FULL ? '16' : '23',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(FPS),
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        mp4,
      ],
      { stdio: 'inherit' },
    );
    console.log(`つないだ：${mp4}（${off.toFixed(1)} 秒）`);
  }
}
const bad = results.filter((r) => r.fails.length);
console.log(bad.length ? `落ちた場面：${bad.map((r) => r.name).join('・')}` : `全部の場面を撮れた（${results.length}）`);
console.log(`写真と summary.json：${outDir}`);
process.exit(bad.length ? 1 : 0);
