#!/usr/bin/env node
// 世界とのやり取りのテスト：扉・火・小さな生き物が、世界に何かをする流れ（テスト用モード）。
//   1. 閉じた扉は視界を遮る（部屋の中から、扉の向こうの通路は見えない）
//   2. 扉のマスが燃え尽きると、扉は無くなる
//   3. 修復機（Re）が焼け落ちた扉を作り直すと、灰の印も消える
//   4. 焼け落ちた扉のマスに立っていて、そこで扉が作り直されても、足元で視界が止まらない
// 生き物は __test.clearAll() で全部消してから、要る物だけを __test.summon で置く（近くの生き物が扉を開けたり、火を消したりしないように）。
import { withBrowser, newPage, openTest, advance } from './lib.mjs';

const errs = [];
await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs);
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
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
