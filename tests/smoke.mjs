#!/usr/bin/env node
// スモークテスト：テスト用モードでない時にタイトルの画面が出るか、開発用の探索で dbg が動くか、探索の始め直しで前の場所や状態が残らないか
// （特別な階・階段を下りる途中で死んだ時、試しの間から始めた時）と、メニューの確かめの受付が切れるか、図鑑を開いても探索の記録が変わらないか、開発用モードのまま読み直した時・保存が使えない時のタイトル、図鑑の全部の生き物を出して例外・描いた文字の数・NaN を確かめる。扉や火など、世界とのやり取りは tests/world.mjs。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/smoke.mjs          テスト版（.build/test/。既定）
//   node tests/smoke.mjs --prod   公開用の版（dist/）。JetBrains Mono を指定した所の日本語は、システムのフォントで描く
import { join } from 'node:path';
import { withBrowser, newPage, openTest, frames, advance, annotate, OUT } from './lib.mjs';

const errs = [];
await withBrowser(
  async ({ browser, base }) => {
    const pg = await newPage(browser, errs);
    // 1. テスト用モードでない時：タイトルの画面が出るまで
    await pg.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await pg.waitForSelector('#enter', { timeout: 90000 });
    await pg.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 90000 });
    await pg.waitForTimeout(3000); // メインループが背景の迷宮を描画するまで（テスト用モードでないので、実時間で待つ）
    await pg.screenshot({ path: join(OUT, 'title.png'), timeout: 90000 });

    // 2. テスト用モードで、開発用の探索（すべて解放済み、dbg が使える）
    await openTest(pg, base, 'seed=202&depth=3&god=1');
    await advance(pg, 2); // 階に入った時の明るくなる演出（約1.25秒）を終わらせる
    await frames(pg, 2);
    const info = await pg.evaluate(() => dbg.info());
    console.log('info:', JSON.stringify(info).slice(0, 200));
    if (info.depth !== 3 || !info.monsters) errs.push(`探索が始まっていない：${JSON.stringify(info).slice(0, 200)}`);
    await pg.evaluate(() => {
      dbg.to('altar');
    });
    await advance(pg, 1);
    await frames(pg, 2);
    await pg.screenshot({ path: join(OUT, 'run.png'), timeout: 90000 });

    // 3. 特別な階（大広間）で死んで、Enter で新しい探索を始めると、深さ1から（特別な階は残らない）
    await pg.evaluate(() => dbg.inter('bigroom'));
    await advance(pg, 2);
    const inBig = await pg.evaluate(() => dbg.info());
    if (inBig.inter !== 'bigroom') errs.push(`大広間に入れていない：${JSON.stringify(inBig).slice(0, 160)}`);
    await pg.evaluate(() => dbg.hurt(9999)); // god=1 でも dbg.hurt は傷を受ける
    await advance(pg, 1);
    await pg.keyboard.press('Enter');
    await advance(pg, 2);
    const again = await pg.evaluate(() => dbg.info());
    if (again.depth !== 1 || again.inter !== null)
      errs.push(`新しい探索が深さ1の普通の階で始まっていない：${JSON.stringify(again).slice(0, 160)}`);

    // 4. 階段を下りて暗くなる途中に死んで、すぐ Enter で始め直しても、深さ1から（階を移る途中が残って深さ2へ動かない）
    await pg.evaluate(() => dbg.go(3));
    await advance(pg, 2);
    await pg.evaluate(() => {
      dbg.to('stairs');
      dbg.clear(); // 階段の番人がいると、封じられて下りられない
    });
    await pg.keyboard.down('KeyW');
    let tr = null;
    for (let i = 0; i < 40 && tr !== 'out'; i++) {
      await advance(pg, 0.1);
      tr = await pg.evaluate(() => __test.state().trans);
    }
    await pg.keyboard.up('KeyW');
    if (tr !== 'out') errs.push('階段を下り始められていない（テストの前提が崩れた）');
    await pg.evaluate(() => dbg.hurt(9999));
    await advance(pg, 0.1);
    await pg.keyboard.press('Enter');
    await advance(pg, 2);
    const afterStairs = await pg.evaluate(() => dbg.info());
    if (afterStairs.depth !== 1) errs.push(`下りる途中に死んだ後の新しい探索が深さ1で始まっていない：深さ${afterStairs.depth}`);

    // 5. 試しの間からメニューで新しい探索を始めると、試しの間でない探索（傷を受ける）になる（試しの間のままだと、傷を受けない）
    const menu = async (k) => {
      await pg.evaluate((k) => document.querySelector(`#menu button.row[data-k="${k}"]`).click(), k);
      await advance(pg, 0.1);
    };
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('title');
    await menu('title'); // 2回押すとタイトルへ
    await advance(pg, 1);
    await pg.evaluate(() => document.getElementById('galR').click());
    await advance(pg, 2);
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('new');
    await menu('new'); // 2回押すと新しい探索
    await advance(pg, 2);
    const hp0 = await pg.evaluate(() => dbg.info().hp);
    await pg.evaluate(() => dbg.hurt(5));
    await advance(pg, 0.1);
    const hp1 = await pg.evaluate(() => dbg.info().hp);
    if (!(hp1 < hp0)) errs.push(`試しの間から始めた新しい探索で、傷を受けない：体力 ${hp0} → ${hp1}`);

    // 6. メニューの「新しい探索」の、もう一度押して確かめる受付は、4秒で切れる（メニューを開いていて、ゲームの時刻が止まっていても）
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('new');
    await advance(pg, 6); // メニューを開いている間は止まっているので、ゲームの時刻は進まない（テストの時計は進む）
    await menu('new');
    let still = await pg.evaluate(() => __test.state().paused);
    if (!still) errs.push('メニューで「新しい探索」を押してから6秒たって、もう一度押したら、確かめずに新しい探索が始まった');
    else {
      // 受付は1つだけ：「タイトルへ」を押すと「新しい探索」の受付は戻る（すぐ「新しい探索」を押しても、始まらずに確かめ直す）
      await advance(pg, 6);
      await menu('new');
      await menu('title');
      await menu('new');
      still = await pg.evaluate(() => __test.state().paused);
      if (!still)
        errs.push(
          'メニューで「新しい探索」「タイトルへ」「新しい探索」と押したら、確かめずに新しい探索が始まった（受付が2つ同時に立っている）',
        );
      else await pg.keyboard.press('Escape');
    }

    // 7. タイトルから図鑑を開いても、探索の記録の「届いた深さ」は変わらない（図鑑の見本の部屋は深さ4。部屋を作る間も、図鑑の中だと分かっていること）
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('title');
    await menu('title');
    await advance(pg, 1);
    const depth0 = await pg.evaluate(() => __test.state().maxDepth);
    if (typeof depth0 !== 'number' || !(depth0 < 4)) errs.push(`図鑑のテストの前提が崩れた（届いた深さが ${depth0}。4 より浅い数のはず）`);
    await pg.evaluate(() => document.getElementById('galB').click());
    await advance(pg, 1);
    const depth1 = await pg.evaluate(() => __test.state().maxDepth);
    if (depth1 !== depth0) errs.push(`図鑑を開いたら、探索の届いた深さが ${depth0} から ${depth1} に変わった`);
    await pg.keyboard.press('Escape');
    await advance(pg, 0.5);

    // 8. 開発用モードをオンにしたまま（localStorage の al_dev が '1'）、?dev=1 も ?test=1 も付けずにページを読み直しても、
    //    タイトルは開発用モードの形で出る（試練の行がある。ボタンは「オン」）。テスト用モードではないので、タイトルが出るまでだけ待つ
    const dev = await newPage(browser, errs);
    await dev.addInitScript(() => {
      try {
        localStorage.setItem('al_dev', '1');
      } catch {}
    });
    await dev.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await dev.waitForSelector('#enter', { timeout: 90000 });
    const title = await dev.evaluate(() => document.getElementById('intropanel').innerText);
    if (!title.includes('開発用モード：オン')) errs.push('開発用モードのまま読み直したのに、タイトルのボタンが「オン」でない');
    if (!title.includes('試練'))
      errs.push('開発用モードのまま読み直したのに、タイトルに試練の行が出ない（開発用モードではすべて解放済みのはず）');
    await dev.close();
    // 9. localStorage が使えない時（保存を止めたブラウザ）も、開発用モードのボタンを押すと、表示が「オン」に変わる
    const blocked = await newPage(browser, errs);
    await blocked.addInitScript(() => {
      const no = () => {
        throw new Error('storage blocked');
      };
      Storage.prototype.getItem = no;
      Storage.prototype.setItem = no;
    });
    await blocked.goto(base, { waitUntil: 'commit', timeout: 120000 });
    await blocked.waitForSelector('#galDev', { timeout: 90000 });
    await blocked.evaluate(() => document.getElementById('galDev').click());
    const label = await blocked.evaluate(() => document.getElementById('galDev').innerText);
    if (!label.includes('オン')) errs.push(`保存が使えない時、開発用モードを押しても表示が「オン」にならない：${label}`);
    await blocked.close();

    // 10. 図鑑：全部の生き物（テスト用モードは開発用モードなので、全部並ぶ）を、立つ・歩く・眠るの姿で出して、少し進める。
    //    例外が出ないか、文字を描いているか（ファントムは、ほとんど火花で描く）、描いた文字に NaN などが混じらないか。最後に Esc でタイトルへ戻る
    await openTest(pg, base);
    await advance(pg, 1);
    const gal = await pg.evaluate(() => {
      const list = __test.gallery(),
        bad = [],
        names = new Set();
      if (typeof list === 'string') return { bad: [list] };
      for (const e of list) {
        if (!e.name) bad.push(`${e.n} 番目（${e.key}）に名前が無い`);
        if (names.has(e.name)) bad.push(`名前が重なっている：${e.name}`);
        names.add(e.name);
        for (const pose of ['stand', 'walk', 'sleep']) {
          try {
            const r0 = __test.galleryShow(e.n, { yaw: 0.6, pose });
            if (typeof r0 === 'string') throw new Error(r0);
            __test.advance(pose === 'walk' ? 1.5 : 0.5); // 歩く姿は、歩幅がいっぱいになるまで（約1秒）
            const r = __test.galleryDraw();
            if (r.glyphs + r.sparks < 15) bad.push(`${e.name}（${pose}）が、ほとんど描かれていない：文字 ${r.glyphs}・火花 ${r.sparks}`);
            if (r.bad) bad.push(`${e.name}（${pose}）の文字と火花のうち ${r.bad} 個に、数でない値（NaN など）がある`);
          } catch (err) {
            bad.push(`${e.name}（${pose}）で例外：${String(err && err.stack ? err.stack : err).slice(0, 300)}`);
          }
        }
      }
      // 寄る・引く・見下ろす角度の端の値でも、例外や NaN が出ないか（大きい物・小さい物・飛ぶ物・ほとんど火花で描く物）。範囲の外の値は断るか
      for (const name of ['年老いた竜', 'ネズミ', '吸血コウモリ', 'ファントム', '最後の王の影'])
        for (const [zoom, pitch] of [
          [0.5, -0.3],
          [3, 1.3],
          [3, -0.3],
          [0.5, 1.3],
        ]) {
          const e = list.find((o) => o.name === name);
          if (!e) {
            bad.push(`寄る・引くの確かめに使う「${name}」が図鑑に無い`);
            break;
          }
          try {
            const r0 = __test.galleryShow(e.n, { zoom, pitch });
            if (typeof r0 === 'string') throw new Error(r0);
            __test.advance(0.5);
            const r = __test.galleryDraw();
            if (r.glyphs + r.sparks < 15)
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）が、ほとんど描かれていない：文字 ${r.glyphs}・火花 ${r.sparks}`);
            if (r.bad) bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）の文字と火花のうち ${r.bad} 個に、数でない値（NaN など）がある`);
            const c = r.camera;
            if (![c.dist, c.height, c.pitch].every(Number.isFinite) || c.height < 0.3)
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）のカメラの位置がおかしい：${JSON.stringify(c)}`);
          } catch (err) {
            bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）で例外：${String(err && err.stack ? err.stack : err).slice(0, 300)}`);
          }
        }
      // 寄ると近づき、上からだと高く・下向きになる（竜。図鑑の部屋は、竜の距離の2倍より広い）
      {
        const n = list.find((o) => o.name === '竜')?.n ?? 1;
        const cam = (opt) => (__test.galleryShow(n, opt), __test.galleryDraw().camera);
        const [c1, c2, side, top] = [cam({}), cam({ zoom: 2 }), cam({ pitch: 0 }), cam({ pitch: 0.8 })];
        if (!(c2.dist < c1.dist * 0.6)) bad.push(`zoom 2 で寄っていない：距離 ${c1.dist} → ${c2.dist}`);
        if (!(top.height > side.height + 1 && top.pitch < side.pitch - 0.5))
          bad.push(`pitch 0.8 で上から見下ろしていない：横から ${JSON.stringify(side)}、上から ${JSON.stringify(top)}`);
      }
      for (const opt of [{ zoom: 0.4 }, { zoom: 3.1 }, { zoom: NaN }, { pitch: -0.31 }, { pitch: 1.31 }, { pitch: '0.3' }]) {
        const r = __test.galleryShow(1, opt);
        if (typeof r !== 'string') bad.push(`範囲の外の値 ${JSON.stringify(opt)} を断らなかった`);
      }
      // 図鑑の画面の「見つけた数 x / N」の N（図鑑の全部の数）。開発用モードでは、全部が一覧に並ぶはず
      const total = Number((document.getElementById('gal').textContent.match(/見つけた数\s*\d+\s*\/\s*(\d+)/) || [])[1]);
      return { n: list.length, total, bad };
    });
    console.log('bestiary:', gal.n, 'creatures');
    for (const b of gal.bad) errs.push(annotate(`図鑑：${b}`)); // 例外の場所に src/game/ のファイルと行を書き足す
    if (gal.n !== undefined && (gal.n < 40 || gal.n !== gal.total))
      errs.push(`図鑑の一覧に全部が並んでいない：一覧 ${gal.n}、図鑑の全部 ${gal.total}`);
    await pg.keyboard.press('Escape');
    await advance(pg, 0.5);
    if (await pg.evaluate(() => document.getElementById('gal').classList.contains('show')))
      errs.push('図鑑で Esc を押しても、タイトルへ戻らない');
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
