#!/usr/bin/env node
// 世界とのやり取りのテスト：扉・火・小さな生き物が、世界に何かをする流れ（テスト用モード）。
//   1. 閉じた扉は視界を遮る（部屋の中から、扉の向こうの通路は見えない）
//   2. 扉のマスが燃え尽きると、扉は無くなる
//   3. 修復機（Re）が焼け落ちた扉を作り直すと、灰の印も消える
//   4. 焼け落ちた扉のマスに立っていて、そこで扉が作り直されても、足元で視界が止まらない
//   5. 階に残る物（魔法の場・遅れて当たる攻撃・雨・床の印・撃っている途中の光線）は、階を移ると消える
//   6. 猟犬は、匂いの無いマスを追わない（ページを開いてすぐの、ゲームの時刻が40秒より前も）
// 生き物は __test.clearAll() で全部消してから、要る物だけを __test.summon で置く（近くの生き物が扉を開けたり、火を消したりしないように）。
import { withBrowser, newPage, openTest, advance } from './lib.mjs';

const errs = [];

// 1〜4：扉
async function doorChecks(pg, base) {
  // 深さ3は大洞窟で扉が無いので、石の迷宮の深さ1で
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => __test.clearAll());
  const door = await pg.evaluate(() => {
    // 部屋の側に、扉から2マス続く床がある扉（そこに立つと、扉から 5 離れていて、扉は開かない）
    for (const d of __test.doors()) {
      const k = d.j - d.i;
      if (__test.cell(d.j + k).floor && __test.cell(d.j + 2 * k).floor) return { ...d, k, at: d.j + 2 * k, behind: d.i - k };
    }
    return null;
  });
  if (!door) {
    errs.push('部屋の側に床が続く扉が無い（テストの前提が崩れた。シードを変える）');
    return;
  }
  const stand = (i) =>
    pg.evaluate((i) => {
      const c = __test.cell(i);
      dbg.step(c.x, c.z);
    }, i);
  const look = () =>
    pg.evaluate(
      ({ i, j, behind }) => ({
        d: __test.doors().find((d) => d.i === i),
        door: __test.cell(i),
        room: __test.cell(j),
        behind: __test.cell(behind),
      }),
      door,
    );
  // 待つ：cond が true になるまで、step 秒ずつ、最大 sec 秒
  const until = async (cond, sec, step = 0.5) => {
    for (let t = 0; t < sec; t += step) {
      await advance(pg, step);
      if (cond(await look())) return true;
    }
    return false;
  };

  // 1. 閉じた扉は視界を遮る
  await stand(door.at);
  await advance(pg, 0.5);
  let v = await look();
  if (v.d.o >= 0.35) errs.push(`1：扉が開いている（テストの前提が崩れた）：${JSON.stringify(v.d)}`);
  else if (!v.door.seen) errs.push('1：扉のマスが見えていない（テストの前提が崩れた）');
  else if (v.behind.seen) errs.push('1：閉じた扉の向こうの通路が見えている（扉が視界を遮らない）');

  // 2. 燃え尽きると、扉は無くなる
  await pg.evaluate(({ i }) => __test.ignite(i), door);
  if (!(await until((v) => v.d.gone, 30, 1))) errs.push('2：扉のマスが燃え尽きても、扉が無くならない');
  v = await look();
  if (!v.door.burnt) errs.push('2：燃え尽きた扉のマスに、灰の印が無い（テストの前提が崩れた）');

  // 4 の支度：焼け落ちた扉のマスに立ち、修復機を部屋の側に置く
  await stand(door.i);
  await pg.evaluate(({ j }) => __test.summon('Re', j), door);
  // 作り直されるまで、1フレームずつ進めて、毎回「扉の向こうの通路と部屋が見えているか」を確かめる。
  // ゲームは視界を0.1秒ごとにしか数え直さず、作り直した扉が閉じかけている間（約3フレーム）を見逃しうるので、毎フレーム __test.fov() で数え直す
  let rebuilt = false,
    blind = 0;
  for (let n = 0; n < 30 * 40 && !rebuilt; n++) {
    await advance(pg, 1 / 30);
    await pg.evaluate(() => __test.fov());
    v = await look();
    rebuilt = !v.d.gone;
  }
  // 作り直した後の1秒（扉が開ききるまで）も、毎フレーム確かめる
  for (let n = 0; n < 30 && rebuilt; n++) {
    if (!v.behind.seen || !v.room.seen) blind++;
    await advance(pg, 1 / 30);
    await pg.evaluate(() => __test.fov());
    v = await look();
  }
  // 3. 作り直すと、灰の印も消える
  if (!rebuilt) errs.push('3：修復機が、焼け落ちた扉を40秒たっても作り直さない（テストの前提が崩れた）');
  else {
    if (v.door.burnt) errs.push('3：修復機が扉を作り直しても、灰の印が残っている（ミニマップが灰の , のまま）');
    // 4. 足元の扉が作り直されても、視界が止まらない
    if (blind) errs.push(`4：足元の扉が作り直された時、扉の向こうが見えなくなった（${blind} フレーム）`);
  }
}

// 5：階に残る物は、階を移ると消える
async function traceChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  const put = await pg.evaluate(() => __test.addTraces());
  if (!put.zones || !put.laters || !put.rains || !put.marks || !put.beam)
    errs.push(`5：階に残る物を置けていない（テストの前提が崩れた）：${JSON.stringify(put)}`);
  await pg.evaluate(() => dbg.go(2));
  await advance(pg, 0.5);
  const left = await pg.evaluate(() => __test.traces());
  if (left.zones || left.laters || left.rains || left.marks || left.beam)
    errs.push(`5：階を移っても、前の階の物が残っている：${JSON.stringify(left)}`);
}

// 6：猟犬は、匂いの無いマスを追わない。ページを開いてすぐ（ゲームの時刻が40秒より前）に、遠くに猟犬を置き、プレイヤーは動かない
async function houndChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => __test.clearAll());
  const at = await pg.evaluate(() => {
    // プレイヤーから 20〜40 離れた床（光のハウンドではないので、近さで気づくことは無い）
    const p = __test.state().pos;
    for (let i = 0; i < 1e5; i++) {
      // マスの数より十分大きい数まで（範囲の外のマスは床ではない）
      const c = __test.cell(i);
      const d = Math.hypot(c.x - p[0], c.z - p[1]);
      if (c.floor && d > 20 && d < 40) return i;
    }
    return -1;
  });
  if (at < 0) {
    errs.push('6：猟犬を置く床が無い（テストの前提が崩れた）');
    return;
  }
  await pg.evaluate((i) => __test.summon('Zf', i), at);
  await advance(pg, 5);
  const t = await pg.evaluate(() => __test.state().time);
  if (t >= 40) errs.push(`6：ゲームの時刻が40秒を過ぎている（テストの前提が崩れた）：${t}`);
  if (await pg.evaluate(() => document.body.innerText.includes('匂いを嗅ぎつけた')))
    errs.push('6：プレイヤーは動いていないのに、遠くの猟犬が「匂いを嗅ぎつけた」');
}

await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs);
  await doorChecks(pg, base);
  await traceChecks(pg, base);
  await houndChecks(pg, base);
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
