#!/usr/bin/env node
// 図鑑のテスト：全部の生き物を、立つ・歩く・眠るの姿で出して、例外・描いた文字の数・NaN を確かめる。寄る・引く・見下ろす角度、図鑑を手で動かす
// （ホイールで寄る・引く、ドラッグで回す・見下ろす、離すとしばらく止まってまた回る、R と ← → で戻る、ドラッグが外れる、背の高い生き物に寄ると狙う点が上がる）。
// 最後に Esc でタイトルへ戻る。図鑑の写真が、ほかの所で見た目の乱数を余分に引いても、前に別の生き物を出しても変わらないか（別の2つのページで比べる）。ページのエラーを確かめる。
//   node tests/gallery.mjs          テスト版（.build/test/。既定）
//   node tests/gallery.mjs --prod   公開用の版（dist/）
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GALLERY_SPECIMENS } from './gallery-specimens.mjs';
import { withBrowser, newPage, openTest, advance, annotate, OUT } from './lib.mjs';

const RAND_OUT = join(OUT, 'gallery-rand');

const errs = [];
await withBrowser(
  async ({ browser, base }) => {
    const pg = await newPage(browser, errs);
    // 図鑑：全部の生き物（テスト用モードは開発用モードなので、全部並ぶ）を、立つ・歩く・眠るの姿で出して、少し進める。
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
      for (const name of ['年老いた竜', 'ネズミ', '吸血コウモリ', 'ファントム', '王の影'])
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
    for (const b of gal.bad) errs.push(annotate(`図鑑：${b}`)); // 例外の場所に src/lib/ のファイルと行を書き足す
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
      for (let i = 0; i < 4; i++) await pg.mouse.wheel(0, -100); // 寄る（カメラは約0.5秒かけて動くので、1秒待つ）
      await advance(pg, 1);
      const cIn = await cam();
      for (let i = 0; i < 10; i++) await pg.mouse.wheel(0, 100); // 引く（いちばん遠くまで）
      await advance(pg, 1);
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
      // 初めて縦にドラッグした時、カメラが跳ばない（見下ろす角度は今の角度から、狙う点までの距離は今の距離から始まる）
      await pg.mouse.move(480, 80);
      await pg.mouse.down();
      await pg.mouse.move(480, 81);
      await advance(pg, 0.1);
      const cTilt = await cam();
      await pg.mouse.up();
      if (Math.abs(cTilt.camera.aimed - cR.camera.aimed) > 0.05 || Math.abs(cTilt.camera.height - cR.camera.height) > 0.05)
        errs.push(`図鑑：初めて縦にドラッグした時に、カメラが跳ぶ：${JSON.stringify(cR.camera)} → ${JSON.stringify(cTilt.camera)}`);
      await pg.keyboard.press('KeyR');
      // 横向きのホイール（deltaY が 0）では寄りも引きもせず、トラックパッドの小さな動きは小さく寄る
      await pg.evaluate(() =>
        document
          .querySelector('canvas')
          .dispatchEvent(new WheelEvent('wheel', { deltaX: 100, deltaY: 0, bubbles: true, cancelable: true })),
      );
      await advance(pg, 0.1);
      const cSide = await cam();
      if (Math.abs(cSide.camera.dist - c0.camera.dist) > 0.01)
        errs.push(`図鑑：横向きのホイールで寄りが変わった：${c0.camera.dist} → ${cSide.camera.dist}`);
      await pg.mouse.wheel(0, -10);
      await advance(pg, 0.1);
      const cSmall = await cam();
      if (!(cSmall.camera.dist < c0.camera.dist && cSmall.camera.dist > c0.camera.dist * 0.97))
        errs.push(`図鑑：小さなホイールの動きで、寄らないか寄りすぎる：${c0.camera.dist} → ${cSmall.camera.dist}`);
      await pg.keyboard.press('KeyR');
      // ボタンを離したのに mouseup が届かなかった時（ほかのウィンドウに移った時など）：ボタンを押さずに動かしても回らない
      await pg.mouse.move(480, 80);
      await pg.mouse.down();
      await advance(pg, 0.1);
      const cLost = await cam();
      await pg.evaluate(() => {
        for (const x of [500, 700]) window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 80, buttons: 0 }));
      });
      await advance(pg, 0.1);
      const cFree = await cam();
      await pg.mouse.up();
      if (Math.abs(cFree.turn - cLost.turn) > 0.01)
        errs.push(`図鑑：ボタンを押さずに動かしても、ドラッグが続く：${cLost.turn} → ${cFree.turn}`);
      await pg.keyboard.press('KeyR');
      // ← → で移ると戻る（寄ってから、隣へ移って、また戻る）
      for (let i = 0; i < 4; i++) await pg.mouse.wheel(0, -100);
      await pg.keyboard.press('ArrowRight');
      await pg.keyboard.press('ArrowLeft');
      await advance(pg, 0.2);
      const cSw = await cam();
      if (Math.abs(cSw.camera.dist - c0.camera.dist) > 0.01)
        errs.push(`図鑑：← → で移っても、寄りが戻らない：${c0.camera.dist} → ${cSw.camera.dist}`);
      // 背の高い生き物（不死の王）に寄ると、狙う点が体の高さの真ん中へ上がり（冠が画面の上で切れない）、カメラは体を包む球の外に止まる
      const lich = await pg.evaluate(() => __test.gallery().find((e) => e.form === 'lichking')?.n);
      if (!lich) errs.push('図鑑：不死の王が見つからない');
      else {
        for (let i = 1; i < lich; i++) await pg.keyboard.press('ArrowRight');
        await advance(pg, 0.5);
        const l0 = await cam();
        for (let i = 0; i < 8; i++) await pg.mouse.wheel(0, -100); // 寄りきる
        await advance(pg, 1);
        const lIn = await cam();
        if (!(lIn.camera.aimY > l0.camera.aimY + 0.5))
          errs.push(`図鑑：不死の王に寄っても、狙う点が上がらない：${l0.camera.aimY} → ${lIn.camera.aimY}`);
        if (!(lIn.camera.bodyR !== null && lIn.camera.aimed >= lIn.camera.bodyR + 0.79))
          errs.push(`図鑑：不死の王に寄ると、体を包む球の中に入る：${JSON.stringify(lIn.camera)}`);
      }
      // 寄った竜が起きる時（図鑑に出てから6秒）、カメラは1フレームで跳ばず、なめらかに起きた体に合わせる
      const dragonN = await pg.evaluate(() => __test.gallery().find((e) => e.name === '竜')?.n);
      if (!dragonN) errs.push('図鑑：竜が見つからない');
      else {
        const at = await pg.evaluate(() => Number((document.getElementById('gal').textContent.match(/(\d+)\s*\/\s*\d+\s*（/) || [])[1]));
        for (let i = at; i !== dragonN; i += dragonN > at ? 1 : -1) await pg.keyboard.press(dragonN > at ? 'ArrowRight' : 'ArrowLeft');
        for (let i = 0; i < 8; i++) await pg.mouse.wheel(0, -100); // 寄りきる
        await advance(pg, 5.8);
        const steps = [await cam()];
        for (let k = 0; k < 15; k++) {
          await advance(pg, 1 / 30);
          steps.push(await cam());
        }
        let maxStep = 0;
        for (let k = 1; k < steps.length; k++)
          maxStep = Math.max(
            maxStep,
            Math.abs(steps[k].camera.dist - steps[k - 1].camera.dist),
            Math.abs(steps[k].camera.aimY - steps[k - 1].camera.aimY),
          );
        const first = steps[0].camera,
          last = steps[steps.length - 1].camera;
        if (!(Math.abs(last.dist - first.dist) > 0.3))
          errs.push(`図鑑：寄った竜が起きても、カメラが合わせない：${first.dist} → ${last.dist}`);
        if (maxStep > 0.25) errs.push(`図鑑：寄った竜が起きる時に、カメラが1フレームで ${maxStep.toFixed(3)} 跳ぶ`);
      }
    }
    await pg.keyboard.press('Escape');
    await advance(pg, 0.5);
    if (await pg.evaluate(() => document.getElementById('gal').classList.contains('show')))
      errs.push('図鑑で Esc を押しても、タイトルへ戻らない');

    // 図鑑の写真は、ほかの所で引く見た目の乱数と、前に出した生き物から切り離されているか：生き物を出している間、見た目の乱数は、
    //    その種類から作った並びを読む（出す時に作る形・初めの値・降る粒子と、ゲームの一歩ごとの揺れ・まわりの粒子・ランプの揺らぎなど。withVisualRand）。
    //    3つのページで、画面写真の比較（tests/visual.mjs）と同じ4体を同じように出す。どの生き物の前にも、別の生き物を出して同じだけ進めておく
    //    （ゲームの時刻を揃えるため。動きの多くはゲームの時刻で決まる）。
    //    - ふつう：前にネズミをそのまま出す
    //    - 余分に引く：ふつうと同じ。ただ、図鑑を開く前に Math.random を1000回、その後も1フレームごとに1回、余分に引く（ほかの所で見た目の乱数を
    //      引く回数が変わった時の代わり）。1フレームごとに __test.galleryDraw() でも覗く。描いた物の指紋（形・初めの値・揺れ・まわりの粒子）と画面写真が、ふつうと同じか
    //    - 前が違う：前に年老いた竜を、一番引いて見下ろした所から出す（カメラが前の生き物の所、部屋の壁の近くにある）。描いた物の指紋と画面写真が、
    //      ふつうと同じか（降る粒子・目の慣れ（露出）・霧も、前の生き物の見え方を引きずらないか）
    const specimens = async ({ burn, before }) => {
      const p2 = await newPage(browser, errs, { still: true }); // タイトルが消える CSS のアニメーションは実時間で進むので、止める
      await openTest(p2, base);
      const out = [];
      for (const [i, sp] of GALLERY_SPECIMENS.entries()) {
        const r = await p2.evaluate(
          async ({ sp, burn, before, first }) => {
            if (first) for (let k = 0; k < burn * 1000; k++) Math.random();
            const list = __test.gallery(),
              e = list.find((o) => o.name === sp.name),
              other = list.find((o) => o.name === before.name);
            if (!e) return `図鑑に「${sp.name}」が無い`;
            if (!other) return `前に出す「${before.name}」が図鑑に無い`;
            const step = (n) => {
              for (let k = 0; k < n; k++) {
                for (let j = 0; j < burn; j++) Math.random();
                if (burn) __test.galleryDraw(); // 覗いても、生き物の並びは進まない
                __test.advance(1 / 30);
              }
            };
            const r1 = __test.galleryShow(other.n, before.opt);
            if (typeof r1 === 'string') return r1;
            step(15);
            const r0 = __test.galleryShow(e.n, { yaw: sp.yaw, pose: sp.pose, zoom: sp.zoom, center: true });
            if (typeof r0 === 'string') return r0;
            step(90);
            await __test.frames(1);
            return __test.galleryDraw();
          },
          { sp, burn, before, first: i === 0 },
        );
        if (typeof r === 'string') {
          errs.push(`図鑑の乱数：${r}`);
          continue;
        }
        out.push({ name: sp.name, hash: r.hash, png: await p2.screenshot({ timeout: 90000 }) });
      }
      await p2.close();
      return out;
    };
    // 目の慣れ（露出）は、生き物を出したらすぐ新しい画面に合う（暗く出てから明るくなったりしない）：出して2フレーム後と3秒後で、ほぼ同じか。
    //    前に年老いた竜を一番引いて見下ろした所から出しておく（前の画面の明るさが違う）
    const eye = await pg.evaluate(() => {
      const list = __test.gallery(),
        other = list.find((o) => o.name === '年老いた竜'),
        out = [];
      if (!other) return '前に出す「年老いた竜」が図鑑に無い';
      for (const name of ['竜', '不死の王', 'ネズミ']) {
        const e = list.find((o) => o.name === name);
        if (!e) return `図鑑に「${name}」が無い`;
        __test.galleryShow(other.n, { zoom: 0.5, pitch: 1.3 });
        __test.advance(1);
        __test.galleryShow(e.n);
        __test.advance(1 / 30);
        const now = __test.galleryDraw().exposure;
        __test.advance(3);
        out.push({ name, now, later: __test.galleryDraw().exposure });
      }
      return out;
    });
    if (typeof eye === 'string') errs.push(`図鑑の目の慣れ：${eye}`);
    else
      for (const o of eye)
        if (!(Math.abs(o.now - o.later) <= 0.03 * o.later))
          errs.push(`図鑑の目の慣れ：${o.name}を出した直後の露出 ${o.now} が、3秒後の ${o.later} と違う（すぐ合っていない）`);
    // __test.galleryDraw() は、生き物を出してから最初の一歩より前に呼んでも、跡を残さない：初めて描く時に作って覚える物（不死の王の剣、竜の眠った姿）を
    //    覗いた時に作っても、終わると外すので、次の一歩で、呼ばなかった時と同じに作る。← で生き物を出し（一歩も進めない）、すぐ覗くページと覗かないページで、
    //    2秒進めた後の描いた物の指紋が同じか
    const early = async (probe) => {
      const p3 = await newPage(browser, errs);
      await openTest(p3, base);
      const out = [];
      for (const name of ['不死の王', '竜']) {
        const n = await p3.evaluate((name) => {
          const list = __test.gallery(),
            e = list.find((o) => o.name === name);
          if (!e || e.n >= list.length) return `図鑑に「${name}」が無いか、一番後ろにある`;
          __test.galleryShow(e.n + 1);
          return e.n;
        }, name);
        if (typeof n === 'string') {
          errs.push(`図鑑の覗き：${n}`);
          continue;
        }
        await p3.keyboard.press('ArrowLeft'); // 一つ前（name）を出す。一歩も進めない
        out.push(
          await p3.evaluate((probe) => {
            if (probe) __test.galleryDraw();
            __test.advance(2);
            const d = __test.galleryDraw();
            return `${d.name} ${d.hash}`;
          }, probe),
        );
      }
      await p3.close();
      return out;
    };
    {
      const [a, b] = [await early(false), await early(true)];
      if (a.length !== 2) errs.push(`図鑑の覗き：2体を出せなかった（${a.join(' / ')}）`);
      for (const [k, x] of a.entries())
        if (!x.startsWith(['不死の王', '竜'][k] + ' ')) errs.push(`図鑑の覗き：← で出した生き物が違う（${x}）`);
        else if (x !== b[k]) errs.push(`図鑑の覗き：出してすぐ覗くと、後の描いた物が変わる（${x} → ${b[k]}）`);
    }
    rmSync(RAND_OUT, { recursive: true, force: true }); // 前に落ちた時の画像を残さない
    const rat = { name: 'ネズミ', opt: {} },
      plain = await specimens({ burn: 0, before: rat }),
      burnt = await specimens({ burn: 1, before: rat }),
      other = await specimens({ burn: 0, before: { name: '年老いた竜', opt: { zoom: 0.5, pitch: 1.3 } } });
    for (const a of plain) {
      const b = burnt.find((o) => o.name === a.name),
        c = other.find((o) => o.name === a.name);
      const why = [];
      if (b && a.hash !== b.hash)
        why.push(`ほかの所で見た目の乱数を余分に引くと、${a.name}の描いた物が変わる（指紋 ${a.hash} → ${b.hash}）`);
      else if (b && !a.png.equals(b.png))
        why.push(`ほかの所で見た目の乱数を余分に引くと、${a.name}の画面写真が変わる（描いた物の指紋は同じ）`);
      if (c && a.hash !== c.hash) why.push(`前に別の生き物を出すと、${a.name}の描いた物が変わる（指紋 ${a.hash} → ${c.hash}）`);
      else if (c && !a.png.equals(c.png)) why.push(`前に別の生き物を出すと、${a.name}の画面写真が変わる（描いた物の指紋は同じ）`);
      if (!why.length) continue;
      // 違った時は、画面写真を残す（tests/out/gallery-rand/。-a がふつう、-b が余分に引いた方、-c が前が違う方）
      mkdirSync(RAND_OUT, { recursive: true });
      for (const [k, o] of Object.entries({ a, b, c })) if (o) writeFileSync(join(RAND_OUT, `${a.name}-${k}.png`), o.png);
      for (const w of why) errs.push(`図鑑の乱数：${w}`);
    }
    console.log(`図鑑の乱数：${plain.length} 体を比べた`);
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
