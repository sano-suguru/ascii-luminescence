#!/usr/bin/env node
// スモークテスト：テスト用モードでない時にタイトルの画面が出るか、開発用の探索で dbg が動くか、探索の始め直しで前の場所や状態が残らないか
// （特別な階・階段を下りる途中で死んだ時、試しの間から始めた時）と、メニューの「もう一度押して確かめる」待ちが4秒で消えるか、図鑑を開いても探索の記録が変わらないか、開発用モードのまま読み直した時・保存が使えない時のタイトル、閉じた祭壇の画面が離れるまで開かないか、図鑑の全部の生き物を出して例外・描いた文字の数・NaN を確かめる、起きている竜を見た時の伝言、図鑑を手で動かす（ホイール・ドラッグ・R）。扉や火など、世界とのやり取りは tests/world.mjs。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/smoke.mjs          テスト版（.build/test/。既定）
//   node tests/smoke.mjs --prod   公開用の版（dist/）。JetBrains Mono を指定した所の日本語は、システムのフォントで描く
import { join } from 'node:path';
import { withBrowser, newPage, openTest, frames, advance, nearAltar, annotate, OUT } from './lib.mjs';

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
    await pg.evaluate(() => dbg.hurt(9999)); // god=1 でも、dbg.hurt では体力が減る
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

    // 5. 試しの間からメニューで新しい探索を始めると、試しの間でない探索（攻撃を受けると体力が減る）になる（試しの間のままだと、体力が減らない）
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
    if (!(hp1 < hp0)) errs.push(`試しの間から始めた新しい探索で、体力が減らない：体力 ${hp0} → ${hp1}`);

    // 6. メニューの「新しい探索」の、もう一度押して確かめる待ちは、4秒で消える（メニューを開いていて、ゲームの時刻が止まっていても）
    await pg.keyboard.press('Escape');
    await advance(pg, 0.1);
    await menu('new');
    await advance(pg, 6); // メニューを開いている間は止まっているので、ゲームの時刻は進まない（テストの時計は進む）
    await menu('new');
    let still = await pg.evaluate(() => __test.state().paused);
    if (!still) errs.push('メニューで「新しい探索」を押してから6秒たって、もう一度押したら、確かめずに新しい探索が始まった');
    else {
      // 確かめる待ちは1つだけ：「タイトルへ」を押すと「新しい探索」の待ちは消える（すぐ「新しい探索」を押しても、始まらずに確かめ直す）
      await advance(pg, 6);
      await menu('new');
      await menu('title');
      await menu('new');
      still = await pg.evaluate(() => __test.state().paused);
      if (!still)
        errs.push(
          'メニューで「新しい探索」「タイトルへ」「新しい探索」と押したら、確かめずに新しい探索が始まった（確かめる待ちが2つ同時に残っている）',
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

    // 10. 祭壇の画面を閉じると、祭壇から離れて、また近づくまで開かない（装備の画面やメニューを開いて閉じても、開かない）
    const al = await newPage(browser, errs);
    await openTest(al, base, 'seed=202&depth=3&god=1');
    await advance(al, 2);
    if (!(await nearAltar(al))) errs.push('10：祭壇が見つからない（テストの前提が崩れた）');
    const lvl0 = await al.evaluate(() => __test.state().lvl);
    const altarShown = async () => {
      await advance(al, 0.5);
      return al.evaluate(() => document.getElementById('altarp').classList.contains('open'));
    };
    if (!(await altarShown())) errs.push('10：祭壇の近くに立っても、祭壇の画面が開かない（テストの前提が崩れた）');
    // 開いてしまった時は、Esc で閉じてから次を確かめる（前の失敗で、次の確かめのキーがずれないように）
    const stayClosed = async (what) => {
      if (!(await altarShown())) return;
      errs.push(`10：祭壇の画面を閉じた後、${what}、離れていないのに祭壇の画面がまた開いた`);
      await al.keyboard.press('Escape');
      await advance(al, 0.2);
    };
    await al.keyboard.press('Escape'); // 祭壇の画面を閉じる
    await stayClosed('その場で');
    await al.keyboard.press('Tab'); // 装備の画面を開いて閉じる
    await advance(al, 0.2);
    await al.keyboard.press('Escape');
    await stayClosed('装備の画面を開いて閉じたら');
    await al.keyboard.press('Escape'); // メニューを開いて閉じる
    await advance(al, 0.2);
    await al.keyboard.press('Escape');
    await stayClosed('メニューを開いて閉じたら');
    // 離れて、また近づくと開く。離れる先は、どの祭壇からも4以上離れた床のマスのうち、いちばん近い物（そこで祭壇の画面が開かないことも確かめる）
    const back = await al.evaluate(() => {
      const [x, z] = __test.state().pos,
        { w, h } = __test.size(),
        altars = dbg.items().filter((o) => o.altar);
      let best = null;
      for (let i = 0; i < w * h; i++) {
        const c = __test.cell(i),
          d = Math.hypot(c.x - x, c.z - z);
        if (c.floor && altars.every((o) => Math.hypot(o.pos[0] - c.x, o.pos[1] - c.z) >= 4) && (!best || d < best.d))
          best = { x: c.x, z: c.z, d };
      }
      if (best) dbg.step(best.x, best.z);
      return best && [x, z];
    });
    if (!back) errs.push('10：祭壇から離れた床のマスが見つからない（テストの前提が崩れた）');
    else if (await altarShown()) errs.push('10：祭壇から離れた所で、祭壇の画面が開いている（テストの前提が崩れた）');
    else {
      await al.evaluate(([x, z]) => dbg.step(x, z), back);
      if (!(await altarShown())) errs.push('10：祭壇から離れて、また近づいたのに、祭壇の画面が開かない');
    }
    // 祭壇の画面とレベルアップの画面は同じ部品なので、途中でレベルが上がると、開いたかどうかを読み違える
    if ((await al.evaluate(() => __test.state().lvl)) !== lvl0) errs.push('10：途中でレベルが上がった（テストの前提が崩れた）');
    await al.close();

    // 11. 図鑑：全部の生き物（テスト用モードは開発用モードなので、全部並ぶ）を、立つ・歩く・眠るの姿で出して、少し進める。
    //    例外が出ないか、文字を描いているか（ファントムは、ほとんど火花で描く）、描いた文字と火花に NaN や Infinity が混じらないか。最後に Esc でタイトルへ戻る
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
            if (r.bad) bad.push(`${e.name}（${pose}）の文字と火花のうち ${r.bad} 個に、数でない値（NaN か Infinity）がある`);
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
            if (r.bad)
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）の文字と火花のうち ${r.bad} 個に、数でない値（NaN か Infinity）がある`);
            const c = r.camera;
            if (![c.dist, c.height, c.pitch].every(Number.isFinite) || c.height < 0.3)
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）のカメラの位置がおかしい：${JSON.stringify(c)}`);
            // 天井より下、部屋の壁より内。寄った時は、体を包む球（狙う点が中心）の外
            if (c.height > c.ceil - 0.39)
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）のカメラが天井に届いている：${JSON.stringify(c)}`);
            if (c.dist > c.roomR + 0.01)
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）のカメラが部屋の壁より外にある：${JSON.stringify(c)}`);
            if (zoom > 1 && !(c.aimed >= c.bodyR + 0.79))
              bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）のカメラが体を包む球に近すぎる：${JSON.stringify(c)}`);
          } catch (err) {
            bad.push(`${name}（zoom ${zoom}・pitch ${pitch}）で例外：${String(err && err.stack ? err.stack : err).slice(0, 300)}`);
          }
        }
      // 寄ると近づき、引くと遠ざかり、上からだと高く・下向きになる（ネズミ：体が小さいので、寄っても体を包む球で止まらない。
      // zoom 0.5 の距離 8.2 が、部屋の壁より内にあることも前提にする）
      const rat = list.find((o) => o.name === 'ネズミ');
      if (!rat) bad.push('寄る・引く・見下ろす角度の確かめに使う「ネズミ」が図鑑に無い');
      else {
        const cam = (opt) => (__test.galleryShow(rat.n, opt), __test.galleryDraw().camera);
        const [c1, c2, c05, side, top] = [cam({}), cam({ zoom: 2 }), cam({ zoom: 0.5 }), cam({ pitch: 0 }), cam({ pitch: 0.8 })];
        if (!(c05.dist < c05.roomR - 0.01))
          bad.push(`ネズミの zoom 0.5 の距離が部屋の壁で止まっていて、寄る・引くを比べられない：${JSON.stringify(c05)}`);
        if (!(c2.dist < c1.dist * 0.6)) bad.push(`zoom 2 で寄っていない：距離 ${c1.dist} → ${c2.dist}`);
        if (!(c05.dist > c1.dist * 1.6)) bad.push(`zoom 0.5 で引いていない：距離 ${c1.dist} → ${c05.dist}`);
        if (!(top.height > side.height + 1 && top.pitch < side.pitch - 0.5))
          bad.push(`pitch 0.8 で上から見下ろしていない：横から ${JSON.stringify(side)}、上から ${JSON.stringify(top)}`);
      }
      // center：狙う点を画面の真ん中に写す（カメラの角度が、狙う点への角度と同じ）。書かなければ 0.16 だけ下を向いて、生き物を上に写す。
      // 眠る竜は、眠った形（とぐろ）の高さの真ん中を狙う（起きた形より低い。眠った形は、初めて眠って描いた時に作られるので、少し進めてから見る）
      const dragon = list.find((o) => o.name === '竜');
      if (!dragon) bad.push('center の確かめに使う「竜」が図鑑に無い');
      else {
        const look = (opt) => (__test.galleryShow(dragon.n, opt), __test.advance(0.1), __test.galleryDraw().camera);
        const toAim = (c) => Math.atan2(c.aimY - c.height, c.dist);
        const [cOn, cOff, cSleep] = [look({ center: true }), look({}), look({ center: true, pose: 'sleep' })];
        if (!(Math.abs(cOn.pitch - toAim(cOn)) < 0.003)) bad.push(`center:true で狙う点が真ん中に来ない：${JSON.stringify(cOn)}`);
        if (!(Math.abs(cOff.pitch - (toAim(cOff) - 0.16)) < 0.003))
          bad.push(`center を書かない時に、狙う点より 0.16 下を向いていない：${JSON.stringify(cOff)}`);
        if (!(cSleep.aimY < cOn.aimY - 0.5))
          bad.push(`眠る竜の center が、眠った形の高さで決まっていない：起きた形 ${cOn.aimY}、眠った形 ${cSleep.aimY}`);
      }
      for (const opt of [
        { zoom: 0.4 },
        { zoom: 3.1 },
        { zoom: NaN },
        { pitch: -0.31 },
        { pitch: 1.31 },
        { pitch: '0.3' },
        { center: 'yes' },
      ]) {
        const r = __test.galleryShow(1, opt);
        if (typeof r !== 'string') bad.push(`範囲の外の値 ${JSON.stringify(opt, (k, v) => (Number.isNaN(v) ? 'NaN' : v))} を断らなかった`);
      }
      // 竜の説明の文は姿に合わせる：起きている間は起きている時の文、眠っている間は眠っている時の文（図鑑の枠の文で見る）
      if (dragon) {
        const line = (pose) => (__test.galleryShow(dragon.n, { pose }), __test.advance(0.2), document.getElementById('gal').textContent);
        const [awake, asleep] = [line('stand'), line('sleep')];
        if (!awake.includes('熱い息を吐きながら') || awake.includes('眠っている'))
          bad.push(`起きている竜の図鑑の文が、起きている時の文でない：${awake.slice(0, 120)}`);
        if (!asleep.includes('翼を畳んで眠っている')) bad.push(`眠っている竜の図鑑の文が、眠っている時の文でない：${asleep.slice(0, 120)}`);
      }
      // 図鑑の画面の「見つけた数 x / N」の N（図鑑の全部の数）。開発用モードでは、全部が一覧に並ぶはず
      const total = Number((document.getElementById('gal').textContent.match(/見つけた数\s*\d+\s*\/\s*(\d+)/) || [])[1]);
      return { n: list.length, total, bad };
    });
    console.log('bestiary:', gal.n, 'creatures');
    for (const b of gal.bad) errs.push(annotate(`図鑑：${b}`)); // 例外の場所に src/game/ のファイルと行を書き足す
    if (gal.n !== undefined && (gal.n < 40 || gal.n !== gal.total))
      errs.push(`図鑑の一覧に全部が並んでいない：一覧 ${gal.n}、図鑑の全部 ${gal.total}`);
    // 竜が寝起きして枠の文が変わっても、押している途中の [>] ボタンは入れ替わらない（押して離すと、次の生き物へ進む）。
    // ← → で竜へ移ると、止める印が消えて、図鑑は6秒ごとに寝起きをくり返す（0〜6秒は眠り）
    const pos = await pg.evaluate(() => {
      const t = document.getElementById('gal').textContent.match(/(\d+)\s*\/\s*\d+\s*（/);
      return { cur: Number(t && t[1]), n: __test.gallery().find((o) => o.name === '竜')?.n };
    });
    if (!pos.n || !pos.cur) errs.push(`図鑑：竜へ移れない（テストの前提が崩れた）：${JSON.stringify(pos)}`);
    else {
      // 今が竜の時も、いったん隣へ移ってから戻る（galleryShow の止める印を消すため）
      const steps = pos.cur === pos.n ? ['ArrowRight', 'ArrowLeft'] : [];
      for (let i = pos.cur; i < pos.n; i++) steps.push('ArrowRight');
      for (let i = pos.cur; i > pos.n; i--) steps.push('ArrowLeft');
      for (const k of steps) await pg.keyboard.press(k);
      await advance(pg, 5.8);
      const box = await pg.locator('#gal button[data-g="next"]').boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await pg.mouse.down();
      await advance(pg, 0.5); // ここで竜が目を覚まし、枠の文が起きている時の文に変わる
      const woke = await pg.evaluate(() => document.getElementById('gal').textContent.includes('熱い息を吐きながら'));
      await pg.mouse.up();
      await advance(pg, 0.1);
      const now = await pg.evaluate(() => Number((document.getElementById('gal').textContent.match(/(\d+)\s*\/\s*\d+\s*（/) || [])[1]));
      if (!woke) errs.push('図鑑：竜が6秒たっても目を覚まさない（テストの前提が崩れた）');
      else if (now !== pos.n + 1) errs.push(`図鑑：竜が目を覚ました時に押していた [>] で、次の生き物へ進まない：${pos.n} → ${now}`);
    }
    // 図鑑を手で動かす：ホイールで寄る・引く、ドラッグで回す（横）と見下ろす角度（縦）、R で戻す。手を離して3秒たつと、また自動で回る。
    // ← → で移ると元に戻る。ネズミ（1番目）で見る。枠の外（画面の上の方）で操作する
    {
      await pg.keyboard.press('ArrowLeft'); // 今が何番目でも、1番目へ移る（← → で止める印も消える）
      const goFirst = await pg.evaluate(() => Number((document.getElementById('gal').textContent.match(/(\d+)\s*\/\s*\d+\s*（/) || [])[1]));
      for (let i = goFirst; i > 1; i--) await pg.keyboard.press('ArrowLeft');
      await advance(pg, 0.5);
      const cam = () => pg.evaluate(() => __test.galleryDraw());
      const hint = await pg.evaluate(() => document.getElementById('gal').textContent.includes('ホイールで寄る'));
      if (!hint) errs.push('図鑑：枠に「ドラッグで回す　ホイールで寄る　R で戻す」の案内が無い');
      const c0 = await cam();
      await pg.mouse.move(480, 80);
      for (let i = 0; i < 4; i++) await pg.mouse.wheel(0, -100); // 寄る
      await advance(pg, 0.2);
      const cIn = await cam();
      for (let i = 0; i < 10; i++) await pg.mouse.wheel(0, 100); // 引く（いちばん遠くまで）
      await advance(pg, 0.2);
      const cOut = await cam();
      if (!(cIn.camera.dist < c0.camera.dist * 0.8)) errs.push(`図鑑：ホイールで寄っていない：${c0.camera.dist} → ${cIn.camera.dist}`);
      if (!(cOut.camera.dist > c0.camera.dist * 1.5 && cOut.camera.dist <= c0.camera.dist * 2.01))
        errs.push(`図鑑：ホイールで引いていないか、2倍より遠い：${c0.camera.dist} → ${cOut.camera.dist}`);
      // ドラッグ：横で回り、縦（下へ）で上から見下ろす。離した後3秒は回らず、その後また回る
      await pg.mouse.move(480, 80);
      await pg.mouse.down();
      await pg.mouse.move(580, 80, { steps: 4 });
      await pg.mouse.move(580, 160, { steps: 4 });
      await pg.mouse.up();
      await advance(pg, 0.1);
      const cDrag = await cam();
      const turned = Math.abs(Math.atan2(Math.sin(cDrag.turn - cOut.turn), Math.cos(cDrag.turn - cOut.turn)));
      if (!(turned > 0.7)) errs.push(`図鑑：横にドラッグしても回らない：${cOut.turn} → ${cDrag.turn}`);
      if (!(cDrag.camera.pitch < cOut.camera.pitch - 0.2))
        errs.push(`図鑑：下へドラッグしても、上から見下ろさない：${cOut.camera.pitch} → ${cDrag.camera.pitch}`);
      await advance(pg, 2);
      const cHold = await cam();
      if (Math.abs(cHold.turn - cDrag.turn) > 0.01) errs.push(`図鑑：手を離して2秒で、もう回り始めた：${cDrag.turn} → ${cHold.turn}`);
      await advance(pg, 2);
      const cBack = await cam();
      if (!(Math.abs(cBack.turn - cHold.turn) > 0.1))
        errs.push(`図鑑：手を離して4秒たっても、また回り始めない：${cHold.turn} → ${cBack.turn}`);
      if (Math.abs(cBack.camera.dist - cDrag.camera.dist) > 0.01 || Math.abs(cBack.camera.pitch - cDrag.camera.pitch) > 0.01)
        errs.push(
          `図鑑：また回り始めた時に、寄りや角度が戻ってしまった：${JSON.stringify(cDrag.camera)} → ${JSON.stringify(cBack.camera)}`,
        );
      // R で戻す
      await pg.keyboard.press('KeyR');
      await advance(pg, 0.2);
      const cR = await cam();
      if (Math.abs(cR.camera.dist - c0.camera.dist) > 0.01 || Math.abs(cR.camera.pitch - c0.camera.pitch) > 0.01)
        errs.push(`図鑑：R で寄りと角度が戻らない：はじめ ${JSON.stringify(c0.camera)}、R の後 ${JSON.stringify(cR.camera)}`);
      // ← → で移ると戻る（寄ってから、隣へ移って、また戻る）
      for (let i = 0; i < 4; i++) await pg.mouse.wheel(0, -100);
      await pg.keyboard.press('ArrowRight');
      await pg.keyboard.press('ArrowLeft');
      await advance(pg, 0.2);
      const cSw = await cam();
      if (Math.abs(cSw.camera.dist - c0.camera.dist) > 0.01)
        errs.push(`図鑑：← → で移っても、寄りが戻らない：${c0.camera.dist} → ${cSw.camera.dist}`);
    }
    await pg.keyboard.press('Escape');
    await advance(pg, 0.5);
    if (await pg.evaluate(() => document.getElementById('gal').classList.contains('show')))
      errs.push('図鑑で Esc を押しても、タイトルへ戻らない');

    // 12. 探索の中で、起きている竜を初めて見た時の伝言は、起きている時の文（眠っている時の文ではない）
    const dr = await newPage(browser, errs);
    await openTest(dr, base, 'seed=202&depth=9&god=1');
    await advance(dr, 2);
    const placed = await dr.evaluate(() => {
      __test.clearAll();
      const { w, h } = __test.size(),
        fl = (x, z) => x >= 0 && z >= 0 && x < w && z < h && __test.cell(z * w + x).floor;
      // 前後に開けた床の筋（幅5マス・長さ8マス）を探して、端に立ち、5マス先に竜を置く
      for (let z = 0; z < h; z++)
        for (let x = 0; x < w; x++)
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            let ok = true;
            for (let k = -1; k <= 7 && ok; k++) for (let s = -2; s <= 2 && ok; s++) ok = fl(x + dx * k + dz * s, z + dz * k + dx * s);
            if (!ok) continue;
            dbg.step((x + 0.5) * 2, (z + 0.5) * 2);
            const r = __test.summon('D', (z + dz * 5) * w + (x + dx * 5), { unseen: true });
            if (typeof r === 'string') return r;
            const m = __test.state().monsters[0];
            dbg.look(m[1], 2, m[2]);
            return { cell: (z + dz * 5) * w + (x + dx * 5) };
          }
      return '竜を置ける開けた床が無い';
    });
    if (typeof placed === 'string') errs.push(`12：${placed}（テストの前提が崩れた）`);
    else {
      await advance(dr, 1);
      // 前提：竜は起きていて、見えている（どちらかが崩れると、伝言の文を確かめられない）
      const pre = await dr.evaluate((cell) => {
        __test.fov();
        const m = __test.state().monsters.find((o) => o[0] === 'D');
        return { awake: !!m && m[4] === 0, seen: __test.cell(cell).seen };
      }, placed.cell);
      if (!pre.awake || !pre.seen) errs.push(`12：竜が起きていないか、見えていない（テストの前提が崩れた）：${JSON.stringify(pre)}`);
      const log = await dr.evaluate(() => document.getElementById('log').textContent);
      if (!log.includes('大きな翼を広げ、熱い息を吐きながら辺りを見回している') || log.includes('翼を畳んで眠っている'))
        errs.push(`12：起きている竜を見た時の伝言が、起きている時の文でない：${log.slice(-200)}`);
    }
    await dr.close();
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
