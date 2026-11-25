#!/usr/bin/env node
// 世界とのやり取りのテスト：扉・火・小さな生き物が、世界に何かをする流れ（テスト用モード）。
//   1. 閉じた扉は視界を遮る（部屋の中から、扉の向こうの通路は見えない）
//   2. 扉のマスが燃え尽きると、扉は無くなる
//   3. 修復機（Re）が焼け落ちた扉を作り直すと、灰の印も消える
//   4. 焼け落ちた扉のマスに立っていて、そこで扉が作り直されても、足元で視界が止まらない
//   5. 階に残る物（魔法の場・遅れて当たる攻撃・雨・床の印・撃っている途中の光線・稲妻・遅れて落ちる稲妻・稲妻の光）は、階を移ると消える。
//      引き金の待ちは、新しい探索を始めると0に戻る。遅れて起きることの中の例外は、テスト用モードではページのエラーになる
//   6. 猟犬は、匂いの無いマスを追わない（ページを開いてすぐの、ゲームの時刻が40秒より前も）
//   7. 硫黄の床は、燃え尽きても硫黄のまま残り、しばらくすると灰の印が消えて、また燃えるようになる
//   8. 火で氷が溶けて水に戻ると、そのマスの火は消える（水の上で燃えず、灰の印も付かない）
//   9. 冷気は、マップの端で反対側の端に届かない
//  10. 消してすぐまた火がついたマスは、燃えているマスの一覧に1回だけ入る
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
  if (!put.zones || !put.laters || !put.rains || !put.marks || !put.beam || !put.bolts || !put.zaps || !put.flash)
    errs.push(`5：階に残る物を置けていない（テストの前提が崩れた）：${JSON.stringify(put)}`);
  await pg.evaluate(() => dbg.go(2));
  await advance(pg, 0.5);
  const left = await pg.evaluate(() => __test.traces());
  if (left.zones || left.laters || left.rains || left.marks || left.beam || left.bolts || left.zaps || left.flash)
    errs.push(`5：階を移っても、前の階の物が残っている：${JSON.stringify(left)}`);
  // 引き金の待ちは探索のもの：階を移っても残り（60秒から少し減るだけ）、死んで新しい探索を始めると0に戻る
  if (!(left.trig[0] > 50)) errs.push(`5：引き金の待ちを置けていない（テストの前提が崩れた）：${JSON.stringify(left.trig)}`);
  await pg.evaluate(() => dbg.hurt(9999));
  await advance(pg, 1);
  await pg.keyboard.press('Enter'); // 新しい探索（newRun）。すぐ確かめる（待ちはゲームの時間で減っていくので）
  const run = await pg.evaluate(() => __test.traces());
  if (run.trig[0] || run.trig[1]) errs.push(`5：新しい探索を始めても、前の探索の引き金の待ちが残っている：${JSON.stringify(run.trig)}`);
  // 遅れて起きることの中の例外は、黙って消えずに、ページのエラーとして出る（テスト用モードだけ）
  const before = errs.length;
  await pg.evaluate(() => __test.failLater('遅れて起きることの中の、わざとの例外'));
  await advance(pg, 0.2);
  const mine = (e) => e.includes('わざとの例外');
  const seen = errs.slice(before).some(mine);
  // わざと起こした例外だけを外す（同じ間に出たほかのエラーは残して、テストの失敗にする）
  for (let k = errs.length - 1; k >= before; k--) if (mine(errs[k])) errs.splice(k, 1);
  if (!seen) errs.push('5：遅れて起きることの中の例外が、黙って消えた');
}

// 6：猟犬は、匂いの無いマスを追わない。ページを開いてすぐ（ゲームの時刻が40秒より前）に、遠くに猟犬を置き、プレイヤーは動かない
async function houndChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => __test.clearAll());
  const at = await pg.evaluate(() => {
    // プレイヤーから 20〜40 離れた床（光のハウンドではないので、近さで気づくことは無い）
    const p = __test.state().pos;
    for (let i = 0, { w, h } = __test.size(); i < w * h; i++) {
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

// マスを全部見て、kind に合う最初のマス（無ければ -1）。マスの番号は 行×w＋横（w はマップの横のマスの数、__test.size()）
const findCell = (pg, kind) =>
  pg.evaluate((kind) => {
    const { w, h } = __test.size();
    const inner = (i) => i % w > 5 && i % w < w - 6; // 端から離れている
    const ok = {
      brim: (c) => c.brim && c.floor,
      water: (c, i) => c.water && inner(i),
      edgeWater: (c, i) => c.water && (i % w >= w - 4 || i % w <= 3),
      dryFloor: (c, i) => c.floor && !c.water && inner(i),
    }[kind];
    for (let i = 0; i < w * h; i++) if (ok(__test.cell(i), i)) return i;
    return -1;
  }, kind);

// 7：硫黄の床（溶岩の海の深さ9）
async function brimChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=9&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => __test.clearAll());
  const at = await findCell(pg, 'brim');
  if (at < 0) {
    errs.push('7：硫黄のマスが無い（テストの前提が崩れた）');
    return;
  }
  // 灰の印の無い硫黄のマスを覚えておく（灰の野の部屋では、始めから硫黄に灰の印がある。それは数えない）
  const fresh = await pg.evaluate(() => {
    const out = [];
    for (let i = 0, { w, h } = __test.size(); i < w * h; i++) {
      const c = __test.cell(i);
      if (c.brim && !c.burnt) out.push(i);
    }
    return out;
  });
  await pg.evaluate((i) => __test.ignite(i), at);
  let burnt = false;
  for (let s = 0; s < 30 && !burnt; s++) {
    await advance(pg, 1);
    burnt = await pg.evaluate((i) => __test.cell(i).burnt, at);
  }
  if (!burnt) {
    errs.push('7：硫黄のマスが燃え尽きない（テストの前提が崩れた）');
    return;
  }
  // この火で燃え尽きたマス（覚えたマスのうち、灰の印が付いて火の無い物）が、硫黄のまま残っているか
  const burned = (cells) => pg.evaluate((cells) => cells.filter((i) => __test.cell(i).burnt && !__test.cell(i).fire), cells);
  await advance(pg, 3);
  const ash = await burned(fresh);
  const still = await pg.evaluate((cells) => cells.filter((i) => __test.cell(i).brim), ash);
  if (!still.length) {
    errs.push(`7：燃え尽きた硫黄（${ash.length} マス）が、硫黄のまま残っていない（もう燃えるようにならない）`);
    return;
  }
  // すぐに清掃機（Rc）を置き、灰を片付けさせる（片付けた硫黄は、灰の印が無く、燃える物も無い）
  await pg.evaluate((i) => __test.summon('Rc', i), still[0]);
  const isSwept = (cells) => pg.evaluate((cells) => cells.filter((i) => !__test.cell(i).burnt && !__test.cell(i).fuel), cells);
  let swept = [];
  for (let s = 0; s < 40 && !swept.length; s++) {
    await advance(pg, 1);
    swept = await isSwept(still);
  }
  await pg.evaluate(() => __test.clearAll());
  if (!swept.length) errs.push('7：清掃機が、硫黄の灰を40秒たっても片付けない（テストの前提が崩れた）');
  const rest = still.filter((i) => !swept.includes(i));
  // 戻るのは2秒ごとに8%なので、1マスが300秒たっても戻らない見込みは 0.92^150（10万分の1より小さい）
  const backOf = (cells) => pg.evaluate((cells) => cells.filter((i) => __test.cell(i).fuel > 0), cells);
  let back = [],
    sweptBack = [];
  for (let t = 0; t < 300 && (!back.length || (swept.length && !sweptBack.length)); t += 2) {
    await advance(pg, 2);
    back = await backOf(rest);
    sweptBack = await backOf(swept);
  }
  if (rest.length && !back.length) errs.push(`7：燃え尽きた硫黄（${rest.length} マス）が、300秒たっても1つも燃えるようにならない`);
  if (swept.length && !sweptBack.length)
    errs.push(`7：清掃機が灰を片付けた硫黄（${swept.length} マス）が、300秒たっても燃えるようにならない`);
}

// 8〜10：冷気と火（大洞窟の深さ4。水がマップの端にもある）
async function chillChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=4&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => __test.clearAll());
  // 8. 端から離れた水を凍らせて、火をつけると、溶けて水に戻った時に火が消える
  const w = await findCell(pg, 'water');
  if (w < 0) errs.push('8：水のマスが無い（テストの前提が崩れた）');
  else {
    await pg.evaluate((i) => __test.chill(i, 1), w);
    const iced = await pg.evaluate((i) => __test.cell(i).ice, w);
    if (!iced) errs.push('8：冷気で水が凍らない（テストの前提が崩れた）');
    else {
      await pg.evaluate((i) => __test.ignite(i, true), w); // 燃えるガスのように、燃える物を少し残す
      let melted = null;
      for (let n = 0; n < 30 && !melted; n++) {
        await advance(pg, 1 / 30);
        const c = await pg.evaluate((i) => __test.cell(i), w);
        if (c.water) melted = c;
      }
      if (!melted) errs.push('8：火をつけても氷が溶けない（テストの前提が崩れた）');
      else {
        if (melted.fire > 0) errs.push(`8：氷が溶けて水に戻っても、そのマスが燃えている（火 ${melted.fire}）`);
        if (melted.fuel > 0) errs.push(`8：氷が溶けて水に戻っても、そのマスに燃える物が残っている（${melted.fuel}）`);
        await advance(pg, 1);
        if (await pg.evaluate((i) => __test.cell(i).burnt, w)) errs.push('8：水に戻ったマスに、灰の印が付いた');
      }
    }
  }
  // 9. マップの端の近くの水の、隣の行の反対側の端で冷気を使っても、その水は凍らない
  //    （マスの番号は 行×横の幅＋横 なので、横が範囲の外に出ると、隣の行の反対側の端を指してしまう）
  const e = await findCell(pg, 'edgeWater');
  if (e < 0) errs.push('9：端の近くに水が無い（テストの前提が崩れた）');
  else {
    const { w } = await pg.evaluate(() => __test.size());
    const x = e % w,
      z = Math.floor(e / w);
    const center = x >= w - 4 ? (z + 1) * w : (z - 1) * w + w - 1; // 右の端なら次の行の横0、左の端なら前の行の右の端
    await pg.evaluate((c) => __test.chill(c, 9), center);
    if (await pg.evaluate((i) => __test.cell(i).ice, e)) errs.push('9：端で使った冷気で、隣の行の反対側の端の水が凍った');
  }
  // 10. 火をつけて、冷気で消して、すぐまたつけても、燃えているマスの一覧には1回だけ
  const f = await findCell(pg, 'dryFloor');
  if (f < 0) {
    errs.push('10：乾いた床が無い（テストの前提が崩れた）');
    return;
  }
  await pg.evaluate((i) => {
    __test.ignite(i);
    __test.chill(i, 1);
    __test.ignite(i);
  }, f);
  const times = await pg.evaluate((i) => __test.burning(i), f);
  if (times !== 1) errs.push(`10：消してすぐまた火がついたマスが、燃えているマスの一覧に ${times} 回入っている`);
}

await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs);
  await doorChecks(pg, base);
  await traceChecks(pg, base);
  await houndChecks(pg, base);
  await brimChecks(pg, base);
  await chillChecks(pg, base);
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
