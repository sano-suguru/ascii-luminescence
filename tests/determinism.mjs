#!/usr/bin/env node
// 同じ結果になるかのテスト：同じシードで2回、同じ手順を踏み、ゲームの状態（__test.state）が一致するか。
// 違うシードでは違う結果になることも確かめる（何も動いていないのに「一致」するのを防ぐ）。
// もう1つ：見た目の乱数（Math.random）を余分に進めても、遊びの中身（階に入った時に眠っている生き物・祭壇の中身・レベルアップの選択肢・
// 開ける枠が無い時の代わりのルーン・宝物庫の番人の場所）は変わらないか。
// これらは出来事ごとの乱数（keyedRand）で決めるので、粒子を1つ足すような見た目だけの変更では変わらないはず。
import { withBrowser, newPage, openTest, advance, nearAltar } from './lib.mjs';

const steps = async (pg) => {
  await advance(pg, 3);
  await pg.evaluate(() => {
    dbg.to('hub');
  });
  await advance(pg, 4);
  await pg.evaluate(() => {
    dbg.hit(8);
    dbg.hit(8);
  }); // 近くの敵を叩いて、戦いを起こす
  await advance(pg, 5);
  return pg.evaluate(() => __test.state());
};
// 見た目の乱数を n 回進める
const burn = (pg, n) =>
  pg.evaluate((n) => {
    for (let i = 0; i < n; i++) Math.random();
  }, n);
// 遊びの中身を集める。各手順の前に、見た目の乱数を extra 回ずつ余分に進める
const contents = async (pg, extra) => {
  await advance(pg, 2);
  await burn(pg, extra);
  await pg.evaluate(() => dbg.go(3)); // 階に入る（眠っている生き物を決める。シード 202 の深さ3は、眠っている生き物がいて、祭壇に番人がいない）
  const sleep = await pg.evaluate(() =>
    __test
      .state()
      .monsters.map((m) => m[0] + m[4])
      .join(' '),
  );
  await burn(pg, extra);
  await nearAltar(pg); // 祭壇に近づく（中身を決める）
  await advance(pg, 0.5);
  const altar = await pg.evaluate(() =>
    dbg
      .items()
      .filter((o) => o.altar)
      .map((o) => `${o.slot}:${o.opt}:${o.type}`)
      .join(' '),
  );
  await burn(pg, extra);
  await pg.keyboard.press('Escape'); // 祭壇の画面を閉じる（開いている間は、レベルアップの画面が出ない）
  await advance(pg, 0.3);
  await pg.evaluate(() => dbg.exp(60)); // レベルを上げる（選択肢を決める）
  await advance(pg, 0.3);
  const levelup = await pg.evaluate(() => document.getElementById('altarp').textContent.replace(/\s+/g, ' '));
  await burn(pg, extra);
  // 枠を全部開けてから空の枠を拾う（代わりのルーンになる）。伝言の、姿を変えた後の文を見る
  const slot = await pg.evaluate(() => {
    for (let k = 0; k < 2; k++) for (const t of ['slotL', 'slotR', 'body']) __test.open(t);
    dbg.give('slot');
    const log = document.getElementById('log').textContent;
    return log.includes('姿を変えた。') ? log.slice(log.lastIndexOf('姿を変えた。')) : '';
  });
  return { sleep, altar, levelup, slot };
};
// 宝物庫の褒美を取って、目を覚ました番人のマスを集める（シード 208 の深さ3の宝物庫は、番人が目を覚ます）。番人は生き物の一覧の後ろに足される
const vaultGuards = async (pg, extra) => {
  await advance(pg, 2);
  await burn(pg, extra);
  const n0 = await pg.evaluate(() => {
    const v = dbg.items().find((o) => o.vault);
    if (!v) return -1;
    dbg.step(v.pos[0], v.pos[1]);
    return __test.state().monsters.length;
  });
  await advance(pg, 1 / 30); // 1フレームだけ（番人がマスの真ん中から動き出す前）
  return pg.evaluate((n0) => {
    const ms = __test.state().monsters;
    return n0 < 0 || ms.length !== n0 + 2
      ? ''
      : ms
          .slice(n0)
          .map((m) => `${m[0]}@${Math.floor(m[1] / 2)},${Math.floor(m[2] / 2)}`)
          .join(' ');
  }, n0);
};
const errs = [];
const [runs, looks] = await withBrowser(async ({ browser, base }) => {
  const out = [],
    looks = [];
  for (const seed of [202, 202, 203]) {
    const pg = await newPage(browser, errs, { width: 320, height: 180 });
    await openTest(pg, base, `seed=${seed}&depth=4&god=1`);
    out.push(await steps(pg));
    await pg.close();
  }
  for (const extra of [0, 37]) {
    const pg = await newPage(browser, errs, { width: 320, height: 180 });
    await openTest(pg, base, 'seed=202&depth=4&god=1');
    const got = await contents(pg, extra);
    await pg.close();
    const pv = await newPage(browser, errs, { width: 320, height: 180 });
    await openTest(pv, base, 'seed=208&depth=3&god=1');
    got.vault = await vaultGuards(pv, extra);
    await pv.close();
    looks.push(got);
  }
  return [out, looks];
});
const [a, b, c] = runs.map((s) => JSON.stringify(s));
let fail = false;
if (a !== b) {
  fail = true;
  const A = runs[0],
    B = runs[1];
  for (const k in A)
    if (JSON.stringify(A[k]) !== JSON.stringify(B[k]))
      console.log(`✗ 同じシードで違う：${k}\n  1回目 ${JSON.stringify(A[k]).slice(0, 300)}\n  2回目 ${JSON.stringify(B[k]).slice(0, 300)}`);
} else console.log(`✓ 同じシードで一致（ゲームの ${runs[0].time} 秒、敵 ${runs[0].monsters.length} 体）`);
if (a === c) {
  fail = true;
  console.log('✗ 違うシードなのに同じ結果（何も動いていない恐れ）');
} else console.log('✓ 違うシードでは違う結果');
if (!runs[0].monsters.length) {
  fail = true;
  console.log('✗ 敵がいない');
}
{
  const [A, B] = looks,
    empty = Object.keys(A).filter(
      (k) =>
        !A[k] ||
        (k === 'sleep' && !A[k].split(' ').some((m) => m.endsWith('1'))) || // 眠っている生き物が1体もいなければ、比べても確かめにならない
        (k === 'altar' && !A[k].includes(':rune:')) ||
        (k === 'levelup' && !A[k].includes('レベルが上がった')),
    );
  if (empty.length) {
    fail = true;
    console.log(`✗ 遊びの中身が集まっていない：${empty.join('・')}`, A);
  }
  const diff = Object.keys(A).filter((k) => A[k] !== B[k]);
  if (diff.length) {
    fail = true;
    for (const k of diff)
      console.log(`✗ 見た目の乱数を進めたら変わった：${k}\n  そのまま ${A[k].slice(0, 300)}\n  進めた後 ${B[k].slice(0, 300)}`);
  } else if (!empty.length)
    console.log(
      `✓ 見た目の乱数を進めても、眠っている生き物（${A.sleep.split(' ').filter((m) => m.endsWith('1')).length} 体）・祭壇の中身・レベルアップの選択肢・代わりのルーン・宝物庫の番人の場所は同じ`,
    );
}
if (errs.length) console.log('page errors:', errs);
process.exit(fail || errs.length ? 1 : 0);
