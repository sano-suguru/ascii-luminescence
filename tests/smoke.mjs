#!/usr/bin/env node
// スモークテスト：開発用の探索で dbg が動くか、探索の始め直しで前の場所や状態が残らないか（特別な階・階段を下りる途中で死んだ時、試しの間から始めた時）と、
// メニューの「もう一度押して確かめる」待ちが4秒で消えるか、図鑑を開いても探索の記録が変わらないか、閉じた祭壇の画面が離れるまで開かないか、起きている竜を見た時の伝言、
// 最深部で王の影が出て二つ目の姿になるか（背の高さ・画面への収まり・天井）、伝説の物が揃っていない時に12階の異界から最深部へ出ないか。テスト用モードでない時のタイトルの画面は tests/title.mjs、図鑑の生き物と図鑑を手で動かすのは
// tests/gallery.mjs、扉や火など、世界とのやり取りは tests/world.mjs。ページのエラーを確かめ、画面写真を tests/out/ に保存。
//   node tests/smoke.mjs          テスト版（.build/test/。既定）
//   node tests/smoke.mjs --prod   公開用の版（dist/）。JetBrains Mono を指定した所の日本語は、システムのフォントで描く
import { join } from 'node:path';
import { withBrowser, newPage, openTest, frames, advance, nearAltar, OUT } from './lib.mjs';

const errs = [];
await withBrowser(
  async ({ browser, base }) => {
    const pg = await newPage(browser, errs);
    // 1. テスト用モードで、開発用の探索（すべて解放済み、dbg が使える）
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

    // 2. 特別な階（大広間）で死んで、Enter で新しい探索を始めると、深さ1から（特別な階は残らない）
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

    // 3. 階段を下りて暗くなる途中に死んで、すぐ Enter で始め直しても、深さ1から（階を移る途中が残って深さ2へ動かない）
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

    // 4. 試しの間からメニューで新しい探索を始めると、試しの間でない探索（攻撃を受けると体力が減る）になる（試しの間のままだと、体力が減らない）
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

    // 5. メニューの「新しい探索」の、もう一度押して確かめる待ちは、4秒で消える（メニューを開いていて、ゲームの時刻が止まっていても）
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

    // 6. タイトルから図鑑を開いても、探索の記録の「届いた深さ」は変わらない（図鑑の見本の部屋は深さ4。部屋を作る間も、図鑑の中だと分かっていること）
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

    // 7. 祭壇の画面を閉じると、祭壇から離れて、また近づくまで開かない（装備の画面やメニューを開いて閉じても、開かない）
    const al = await newPage(browser, errs);
    await openTest(al, base, 'seed=202&depth=3&god=1');
    await advance(al, 2);
    if (!(await nearAltar(al))) errs.push('7：祭壇が見つからない（テストの前提が崩れた）');
    const lvl0 = await al.evaluate(() => __test.state().lvl);
    const altarShown = async () => {
      await advance(al, 0.5);
      return al.evaluate(() => document.getElementById('altarp').classList.contains('open'));
    };
    if (!(await altarShown())) errs.push('7：祭壇の近くに立っても、祭壇の画面が開かない（テストの前提が崩れた）');
    // 開いてしまった時は、Esc で閉じてから次を確かめる（前の失敗で、次の確かめのキーがずれないように）
    const stayClosed = async (what) => {
      if (!(await altarShown())) return;
      errs.push(`7：祭壇の画面を閉じた後、${what}、離れていないのに祭壇の画面がまた開いた`);
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
    if (!back) errs.push('7：祭壇から離れた床のマスが見つからない（テストの前提が崩れた）');
    else if (await altarShown()) errs.push('7：祭壇から離れた所で、祭壇の画面が開いている（テストの前提が崩れた）');
    else {
      await al.evaluate(([x, z]) => dbg.step(x, z), back);
      if (!(await altarShown())) errs.push('7：祭壇から離れて、また近づいたのに、祭壇の画面が開かない');
    }
    // 祭壇の画面とレベルアップの画面は同じ部品なので、途中でレベルが上がると、開いたかどうかを読み違える
    if ((await al.evaluate(() => __test.state().lvl)) !== lvl0) errs.push('7：途中でレベルが上がった（テストの前提が崩れた）');
    await al.close();

    // 8. 探索の中で、起きている竜を初めて見た時の伝言は、起きている時の文（眠っている時の文ではない）
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
    if (typeof placed === 'string') errs.push(`8：${placed}（テストの前提が崩れた）`);
    else {
      await advance(dr, 1);
      // 前提：竜は起きていて、見えている（どちらかが崩れると、伝言の文を確かめられない）
      const pre = await dr.evaluate((cell) => {
        __test.fov();
        const m = __test.state().monsters.find((o) => o[0] === 'D');
        return { awake: !!m && m[4] === 0, seen: __test.cell(cell).seen };
      }, placed.cell);
      if (!pre.awake || !pre.seen) errs.push(`8：竜が起きていないか、見えていない（テストの前提が崩れた）：${JSON.stringify(pre)}`);
      const log = await dr.evaluate(() => document.getElementById('log').textContent);
      if (!log.includes('大きな翼を広げ、熱い息を吐きながら辺りを見回している') || log.includes('翼を畳んで眠っている'))
        errs.push(`8：起きている竜を見た時の伝言が、起きている時の文でない：${log.slice(-200)}`);
    }
    await dr.close();

    // 9. 最深部：伝説の物を3つ持つと、少しして王の影が出る（持っていない間は出ない）。背の高さは約7（天井より低い）で、8離れて見ると全身が画面に収まる。
    // どこでも攻撃が当たり、体力を半分より減らすと二つ目の姿になる。大きさは一つ目のまま（天井が低い所だけ縮む）で、天井より低い
    const fin = await newPage(browser, errs);
    await openTest(fin, base, 'seed=202&depth=13&god=1');
    await advance(fin, 1);
    const king = await fin.evaluate(() => {
      __test.advance(4);
      if (__test.state().monsters.some((m) => m[0] === 'final')) return '伝説の物を持っていないのに、王の影が出た';
      dbg.give('legends');
      __test.advance(4);
      const b = __test.state().monsters.find((m) => m[0] === 'final');
      if (!b) return '王の影が出ない';
      const { w } = __test.size(),
        ci = (x, z) => Math.floor(z / 2) * w + Math.floor(x / 2);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2,
          x = b[1] + Math.sin(a) * 8,
          z = b[2] + Math.cos(a) * 8;
        if (!__test.cell(ci(x, z)).floor) continue;
        dbg.step(x, z);
        __test.fov();
        if (!__test.cell(ci(b[1], b[2])).seen) continue;
        __test.advance(1 / 30);
        dbg.look(b[1], 3.3, b[2]);
        __test.advance(1 / 30);
        const first = __test.monsterView('final');
        // 二つ目の姿：その場で攻撃して、体力を半分より減らす
        let second = null;
        for (let q = 0; q < 40 && !second; q++) {
          dbg.hit(25);
          __test.advance(0.1);
          const v = __test.monsterView('final');
          if (v && v.form === 'shadowserpent') second = v;
        }
        __test.advance(3);
        return { first, second, after: __test.monsterView('final') };
      }
      return '王の影を8離れて見通せる床が無い（テストの前提が崩れた）';
    });
    if (typeof king === 'string') errs.push(`9：${king}`);
    else {
      const { first, second, after } = king;
      if (!(first.world.y1 > 6 && first.world.y1 < 7.6)) errs.push(`9：王の影の背の高さが約7でない：${JSON.stringify(first.world)}`);
      if (!(first.world.y1 < first.ceil)) errs.push(`9：王の影が天井を突き抜ける：${first.world.y1} / ${first.ceil}`);
      if (!(first.cut < 0.02)) errs.push(`9：8離れて見た王の影が、画面からはみ出す（${first.cut}）`);
      if (!second) errs.push('9：体力を半分より減らしても、二つ目の姿にならない');
      else {
        const want = Math.max(1.2, Math.min(first.scale, (second.ceil - 0.3) / 3.6));
        if (Math.abs(second.scale - want) > 0.05)
          errs.push(`9：二つ目の姿の大きさが、一つ目のまま（天井が低い所だけ縮む）でない：${second.scale}（${want} のはず）`);
        if (!(after && after.world.y1 < after.ceil)) errs.push(`9：二つ目の姿が天井を突き抜ける：${JSON.stringify(after)}`);
      }
    }
    await fin.close();

    // 10. 最深部の1つ上の階（12）の異界の門から入り、異界を抜けて下りる：伝説の物が3つ揃っていなければ12階の門に戻され（最深部には出ない）、揃っていれば最深部（13）に出る
    const rl = await newPage(browser, errs);
    await openTest(rl, base, 'seed=202&depth=12&god=1');
    await advance(rl, 1);
    const realmExit = await rl.evaluate(() => {
      const out = [];
      for (const legends of [false, true]) {
        dbg.go(12);
        __test.advance(2);
        if (legends) dbg.give('legends');
        const r = dbg.realm('ice');
        if (typeof r === 'string') return `異界に入れない：${r}`;
        __test.advance(2);
        const from = __test.state().place;
        const sp = dbg.info().stairsPos;
        if (!sp) return '異界に下り階段が無い（テストの前提が崩れた）';
        dbg.step(sp[0], sp[1]);
        for (let k = 0; k < 40 && __test.state().place === from; k++) __test.advance(0.2);
        __test.advance(1);
        out.push({ legends, depth: __test.state().depth, place: __test.state().place });
      }
      return out;
    });
    if (typeof realmExit === 'string') errs.push(`10：${realmExit}`);
    else {
      const [without, withAll] = realmExit;
      if (!(without && without.depth === 12 && without.place === '12'))
        errs.push(`10：伝説の物が揃っていないのに、12階の異界から最深部へ出た：${JSON.stringify(without)}`);
      if (!(withAll && withAll.depth === 13))
        errs.push(`10：伝説の物が揃っているのに、12階の異界から最深部へ出ない：${JSON.stringify(withAll)}`);
    }
    await rl.close();
  },
  { prod: process.argv.includes('--prod') },
);
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
