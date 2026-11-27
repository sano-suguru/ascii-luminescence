#!/usr/bin/env node
// 世界とのやり取りのテスト：扉・火・氷と冷気・小さな生き物（修復機・清掃機・猟犬）が、マスや扉を変える処理（テスト用モード）。
//   1. 閉じた扉は視界を遮る（部屋の中から、扉の向こうの通路は見えない）
//   2. 扉のマスが燃え尽きると、扉は無くなる
//   3. 修復機（Re）が焼け落ちた扉を作り直すと、灰の印も消える
//   4. 焼け落ちた扉のマスに立っていて、そこで扉が作り直されても、足元で視界が止まらない
//   5. 階に残る物（魔法の場・遅れて当たる攻撃・雨・床の目印・撃っている途中の光線・稲妻・遅れて落ちる稲妻・稲妻の光・倒れた生き物が崩れて積もった文字）は、階を移ると消える。
//      発動のルーンの待ち時間は、新しい探索を始めると0に戻る。遅れて起きることの中の例外は、テスト用モードではページのエラーになる
//   6. 猟犬は、匂いの無いマスを追わない（ページを開いてすぐの、ゲームの時刻が40秒より前も）
//   7. 硫黄の床は、燃え尽きても硫黄のまま残り、しばらくすると灰の印が消えて、また燃えるようになる
//   8. 火で氷が溶けて水に戻ると、そのマスの火は消える（水の上で燃えず、灰の印も付かない）
//   9. 冷気は、マップの端で反対側の端に届かない
//  10. 消してすぐまた火がついたマスは、燃えているマスの一覧に1回だけ入る
//  11. 薄い氷に乗っていた秒は、階を移ると0に戻る（前の階の同じ番号のマスの秒が残らない）
//  12. 火山の異界の火口は、噴き上がると溶岩が流れ出し（状態 1）、しばらく待って（2）引き（3）、また待って（0）噴き上がる
//  13. 加護の身軽な詠唱と返しの一撃は、敵の攻撃を転がってかわすと効き始める（ただ転がっただけでは効かない）
//  14. 火口の溶岩は、生き物のいるマスにも、生き物が歩いて向かっているマスにも流れない（溶岩の上に立つ生き物がいない）。
//      生き物が塞いだマスは、後でまた試す（流し終えた後も、引き始めるまで）ので、引き始める前に、生き物のいないマスの穴が残らない
//  15. 吹き飛ばされた生き物は、溶岩の手前で止まる（溶岩は、歩けない生き物には壁と同じ。体の大きな生き物は、体が溶岩にかかる手前）。止まると、行き先は今いるマスになる
//  16. 宝物庫の落石は、ゲームの時刻で進む（溜めている間は半分の速さ、止まっている間は進まない）。階段を下りて暗くなり始めたら進まず、階を移ると消える
//  17. 倒れた生き物は崩れて、体の文字が床に積もる（残す文字の数の上限・光とみなしてすぐ消す文字は半分より少ない・床より下に沈まない・高い塔にならない・倒れた所の近く）。しばらくすると全部消え、
//      同時にたくさん倒れても、崩れる体の数は上限（12）を越えて残らない
//  18. 敵に攻撃を当てても、画面が白く飛ばない（トロルに照準を合わせ、すぐ近くで小剣を当てる。光っている間の画面全体の眩しい画素が 25% 以下）。
//      当たった光は残っている（体の範囲の明るさが、当てる前より 1.1 倍を越えて上がる）。数え方は tools/glare.mjs（pnpm glare）と同じ
//  19. 場面を作る道具：__test.elem で手に性質を付け替えられる（下の HUD の手の名前に出る）。__test.hold で止めた生き物は、すぐ隣でも歩かず攻撃せず、言った向きへ回り、
//      放すとまた動く。__test.cam で目と同じ所に置いたカメラは目と同じに写し、前へ出すと、見ている点を真ん中にしたまま大きく写す。null で目に戻る。
//      岩の中（地図の外・天井より上）には置かない。ほかの階へ移ると目に戻る。置いている間も、ゲームの一歩の間のカメラは目のまま（術はプレイヤーから出て、当たる）。
//      小さな生き物は止められない（わけの文を返す）。無い手・性質でない鍵・3つの数でない pos は受け付けない
//  20. 反応と火が重なっても、画面が白く飛ばない（大洞窟で、5 ほど先のトロルを氷の樫の杖で凍えさせ、炎の樫の杖を当てる。蒸気の反応が起き、枯れ草が燃える。
//      当たって 2〜8 フレームの間、画面全体の眩しい画素が 25% 以下・体の範囲の白飛びが 12% 以下）。体は当てる前より 1.1 倍を越えて明るくなり、画面の眩しい画素は増える
//  21. 気づいた敵に照準を合わせて当てても、体が白く飛ばない（20 と同じ場所のトロルに、氷の樫の杖を両手で当てる。火は起きない。当たって光っている間の体の範囲の白飛びが 5% 以下、
//      光り終わった後（照準の先のまま）が 2% 以下）。当たった光は残っている（当たって光っている間の体の明るさが、光り終わった後より 1.05 倍を越えて明るい）
// 生き物は __test.clearAll() で全部消してから、要る物だけを __test.summon で置く（近くの生き物が扉を開けたり、火を消したりしないように）。
import { PNG } from 'pngjs';
import { withBrowser, newPage, openTest, advance, frames, aimAt, strike } from './lib.mjs';

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
  if (!put.zones || !put.laters || !put.rains || !put.marks || !put.beam || !put.bolts || !put.zaps || !put.flash || !put.debris)
    errs.push(`5：階に残る物を置けていない（テストの前提が崩れた）：${JSON.stringify(put)}`);
  await pg.evaluate(() => dbg.go(2));
  await advance(pg, 0.5);
  const left = await pg.evaluate(() => __test.traces());
  if (left.zones || left.laters || left.rains || left.marks || left.beam || left.bolts || left.zaps || left.flash || left.debris)
    errs.push(`5：階を移っても、前の階の物が残っている：${JSON.stringify(left)}`);
  // 発動のルーンの待ち時間は探索のもの：階を移っても残り（60秒から少し減るだけ）、死んで新しい探索を始めると0に戻る
  if (!(left.trig[0] > 50)) errs.push(`5：発動のルーンの待ち時間を置けていない（テストの前提が崩れた）：${JSON.stringify(left.trig)}`);
  await pg.evaluate(() => dbg.hurt(9999));
  await advance(pg, 1);
  await pg.keyboard.press('Enter'); // 新しい探索（暗くなりきった時に newRun）
  await advance(pg, 0.9);
  const run = await pg.evaluate(() => __test.traces());
  if (run.trig[0] || run.trig[1])
    errs.push(`5：新しい探索を始めても、前の探索の発動のルーンの待ち時間が残っている：${JSON.stringify(run.trig)}`);
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

// 11：薄い氷（氷の洞窟の、深い水が凍った所）
async function thinIceChecks(pg, base) {
  await openTest(pg, base, 'seed=202&realm=ice&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => __test.clearAll());
  const t = await pg.evaluate(() => {
    const { w, h } = __test.size();
    for (let i = 0; i < w * h; i++) if (__test.cell(i).thin) return i;
    return -1;
  });
  if (t < 0) {
    errs.push('11：薄い氷が無い（テストの前提が崩れた。シードを変える）');
    return;
  }
  await pg.evaluate((i) => {
    const c = __test.cell(i);
    dbg.step(c.x, c.z);
  }, t);
  await advance(pg, 0.3); // 割れる（0.85秒）より前
  const before = await pg.evaluate((i) => __test.cell(i).iceT, t);
  if (!(before > 0)) {
    errs.push(`11：薄い氷に乗っても、乗っていた秒が増えない（${before}。テストの前提が崩れた）`);
    return;
  }
  await pg.evaluate(() => dbg.go(2));
  await advance(pg, 0.5);
  const after = await pg.evaluate((i) => __test.cell(i).iceT, t);
  if (after !== 0) errs.push(`11：階を移っても、前の階で薄い氷に乗っていた秒が残っている（${after}）`);
}

// 12：火口の噴き上がり（火山の異界の、3つの火口）
async function eruptChecks(pg, base) {
  await openTest(pg, base, 'seed=7&realm=volcano&god=1');
  await advance(pg, 2);
  // 火口ごとに、変わった状態の並び（初めの 0 から）。溶岩のマスの数の、いちばん多い時と、その後の少ない時
  const seq = new Map(),
    lava = [];
  for (let t = 0; t < 100; t += 2) {
    const e = await pg.evaluate(() => __test.events());
    for (const ev of e.list.filter((x) => x.type === 'erupt')) {
      const a = seq.get(ev.src) ?? [];
      if (a.at(-1) !== ev.state) a.push(ev.state);
      seq.set(ev.src, a);
    }
    lava.push(e.lava);
    await advance(pg, 2);
  }
  if (seq.size === 0) {
    errs.push('12：火口の噴き上がりが無い（テストの前提が崩れた。シードを変える）');
    return;
  }
  // 100 秒あれば、どの火口も 1 回は最後まで進み（0 → 1 → 2 → 3 → 0）、また噴き上がる（20〜40 秒待つ）
  const full = [...seq].filter(([, a]) => a.join('').startsWith('012301'));
  if (full.length !== seq.size) errs.push(`12：火口の噴き上がりが、状態 0 → 1 → 2 → 3 → 0 → 1 と進まない（${JSON.stringify([...seq])}）`);
  const top = Math.max(...lava),
    back = lava.indexOf(0, lava.indexOf(top));
  if (!(top > 10) || back < 0 || !lava.slice(back).some((n) => n > 0))
    errs.push(`12：溶岩のマスが、増えてから 0 に戻り、また増える、にならない（2 秒ごと：${lava.join(',')}）`);
}

// 13：かわした時の加護（身軽な詠唱・返しの一撃）
async function dodgeChecks(pg, base) {
  await openTest(pg, base, 'seed=7&depth=2&god=1');
  await advance(pg, 2);
  await pg.mouse.click(480, 270); // キーを届かせる（押すと撃つので、生き物を置く前に）
  await advance(pg, 1);
  await pg.evaluate(() => {
    __test.bless(2);
    __test.clearAll();
  });
  // ただ転がっただけでは、効かない
  await pg.keyboard.press('Space');
  await advance(pg, 0.1);
  const plain = await pg.evaluate(() => __test.state());
  if (!plain.roll) errs.push('13：Space で転がらない（テストの前提が崩れた）');
  if (plain.quick || plain.counter) errs.push(`13：ただ転がっただけで、かわした時の加護が効いた（${plain.quick}・${plain.counter}）`);
  await advance(pg, 1.5); // 転がりの待ち（1 秒）が明けるまで
  // 隣のマスに生き物を置き、攻撃の溜めが終わる直前に転がってかわす
  const put = await pg.evaluate(() => {
    const s = __test.state(),
      { w } = __test.size(),
      C = __test.cell(0).x * 2,
      pi = Math.floor(s.pos[1] / C) * w + Math.floor(s.pos[0] / C);
    for (const d of [1, -1, w, -w]) if (__test.cell(pi + d).floor) return __test.summon('k', pi + d);
    return null;
  });
  if (!put) {
    errs.push('13：隣に床が無く、生き物を置けない（テストの前提が崩れた。シードを変える）');
    return;
  }
  let st = null;
  for (let q = 0; q < 300; q++) {
    const s = await pg.evaluate(() => __test.state()),
      wind = s.monsters[0]?.[5] ?? 0;
    if (wind > 0 && wind < 0.07) {
      await pg.keyboard.press('Space');
      await advance(pg, 0.1);
      st = await pg.evaluate(() => __test.state());
      break;
    }
    await advance(pg, 1 / 30);
  }
  if (!st) {
    errs.push('13：生き物が攻撃の溜めに入らない（テストの前提が崩れた）');
    return;
  }
  // 加護 2 段目：身軽な詠唱は 2.5 秒、返しの一撃は 1.5 秒（かわした時刻から）
  const left = (until) => +(until - st.time).toFixed(2);
  if (!st.roll || !(left(st.quick) > 2.3 && left(st.quick) <= 2.5) || !(left(st.counter) > 1.3 && left(st.counter) <= 1.5))
    errs.push(
      `13：攻撃を転がってかわしても、加護が効かない（転がり ${st.roll}・身軽な詠唱の残り ${left(st.quick)}・返しの一撃の残り ${left(st.counter)}）`,
    );
}

// 14：溶岩の上に立つ生き物がいない・引き始める前に穴が無い（火口の流れる道の横に生き物を置き、プレイヤーは遠くへ。0.1 秒ごとに 70 秒見る）
async function lavaMobChecks(pg, base) {
  await openTest(pg, base, 'seed=42&realm=volcano&god=1');
  await advance(pg, 2);
  const r = await pg.evaluate(() => {
    __test.clearAll();
    const { w } = __test.size(),
      cellOf = (x, z) => Math.floor(z / (__test.cell(0).x * 2)) * w + Math.floor(x / (__test.cell(0).x * 2));
    for (const e of __test.events().list.filter((x) => x.type === 'erupt'))
      for (const [n, i] of e.order.entries())
        if (n % 2 === 0)
          for (const d of [1, -1, w, -w])
            if (__test.cell(i + d).floor) {
              __test.summon(['k', 'r', 'j'][n % 3], i + d);
              break;
            }
    dbg.to('stairs'); // 追いかけてこないように、遠くへ
    const n = __test.state().monsters.length,
      prev = new Map(),
      holes = [];
    let on = 0,
      first = null,
      lavaTop = 0;
    for (let q = 0; q < 700; q++) {
      __test.advance(0.1);
      const s = __test.state(),
        ev = __test.events(),
        hit = s.monsters.filter((m) => __test.cell(cellOf(m[1], m[2])).lava);
      lavaTop = Math.max(lavaTop, ev.lava);
      if (hit.length) {
        on++;
        first ??= [s.time, hit[0].slice(0, 3)];
      }
      // 引き始める直前（状態 2 の最後）に、流れる順のマスで溶岩でない物（生き物がいる・向かっているマスは除く。溶岩に囲まれて動けない生き物もいる）
      const taken = new Set();
      for (let k = 0; k < s.monsters.length; k++) {
        const m = __test.mob(k);
        taken.add(m.cz * w + m.cx).add(m.tz * w + m.tx);
      }
      for (const e of ev.list.filter((x) => x.type === 'erupt')) {
        const p = prev.get(e.src);
        if (p && p[0] === 2 && e.state === 3) holes.push([e.src, p[1]]);
        prev.set(e.src, [e.state, e.order.filter((i) => !__test.cell(i).lava && !taken.has(i)).length]);
      }
    }
    return { n, on, first, lavaTop, holes };
  });
  if (!(r.n > 10) || !(r.lavaTop > 20))
    errs.push(`14：生き物か溶岩の流れが足りない（生き物 ${r.n}・溶岩のマス ${r.lavaTop}。テストの前提が崩れた）`);
  if (r.on) errs.push(`14：溶岩の上に立つ生き物がいる（0.1 秒ごとに見て ${r.on} 回。初めは ${JSON.stringify(r.first)}）`);
  if (!r.holes.length || r.holes.some(([, k]) => k > 0))
    errs.push(`14：引き始める前に、流れの中に溶岩でないマスが残っている（火口ごとの [マス, 数]：${JSON.stringify(r.holes)}）`);
}

// 15：吹き飛ばされた生き物は、溶岩の手前で止まり、行き先は今いるマスになる（溶岩の西隣の床に置き、東へ吹き飛ばす）
async function knockLavaChecks(pg, base) {
  // 小さな生き物（コボルト）と体の大きな生き物（トロル・竜）。トロルは、体（半径 0.35×大きさ）が溶岩にかかる手前で止まる。
  // 竜は、マスの真ん中でも体が隣の溶岩にかかっているので、それより深くは入らない
  for (const key of ['k', 'T', 'D']) {
    await openTest(pg, base, 'seed=42&realm=volcano&god=1');
    await advance(pg, 2);
    const r = await pg.evaluate((key) => {
      __test.clearAll();
      const { w, h } = __test.size(),
        C = __test.cell(0).x * 2;
      for (let i = w; i < w * h - w; i++) {
        if (!__test.cell(i).floor || !__test.cell(i + 1).lava || !__test.cell(i - 1).floor) continue;
        __test.summon(key, i);
        const m0 = __test.mob(0),
          gap0 = ((i % w) + 1) * C - (m0.x + 0.35 * m0.scale);
        __test.knock(0, 14, 0);
        // 吹き飛びが止まるまで（止まった時の行き先を見る。その後は、また歩き出す）
        for (let q = 0; q < 60 && (__test.mob(0).kx || __test.mob(0).kz); q++) __test.advance(1 / 30);
        const m = __test.mob(0),
          // 体の東の端と、東隣の溶岩のマスの西の縁との間（0 以上なら、体は溶岩にかかっていない）
          gap = ((i % w) + 1) * C - (m.x + 0.35 * m.scale);
        return {
          i,
          at: m.cz * w + m.cx,
          to: m.tz * w + m.tx,
          lava: __test.cell(m.cz * w + m.cx).lava,
          gap: +gap.toFixed(3),
          gap0: +gap0.toFixed(3),
        };
      }
      return null;
    }, key);
    if (!r) {
      errs.push('15：溶岩の西隣に床が無い（テストの前提が崩れた。シードを変える）');
      return;
    }
    if (r.lava || r.at !== r.i || r.to !== r.at || !(r.gap >= Math.min(0, r.gap0)))
      errs.push(
        `15：吹き飛ばされた生き物（${key}）が、溶岩の手前で止まらない（置いたマス ${r.i}・今いるマス ${r.at}・行き先 ${r.to}・溶岩か ${r.lava}・体と溶岩の間 ${r.gap}・初めの間 ${r.gap0}）`,
      );
  }
}

// 16：落石（__test.rockfall でプレイヤーのまわりに落石を始め、経った秒を見る）
async function rockfallChecks(pg, base) {
  await openTest(pg, base, 'seed=7&depth=2&god=1');
  await advance(pg, 2);
  await pg.mouse.click(480, 270); // キーを届かせる（押すと撃つので、落石を始める前に）
  await advance(pg, 1);
  await pg.evaluate(() => {
    __test.clearAll();
    __test.equip('L', 'bolt');
    __test.rockfall(true);
  });
  await advance(pg, 1);
  const r1 = await pg.evaluate(() => __test.rockfall());
  if (!r1 || !(Math.abs(r1.t - 1) < 0.05)) errs.push(`16：1秒進めても、落石が1秒進まない（${JSON.stringify(r1)}）`);
  // 溜めている間は、ほかの物と同じく半分の速さ
  const held = await pg.evaluate(() => __test.press('L'));
  await advance(pg, 0.5);
  const st = await pg.evaluate(() => __test.state()),
    r2 = await pg.evaluate(() => __test.rockfall());
  await pg.evaluate(() => __test.release('L'));
  if (!held || !st.cast) errs.push('16：短弓を溜められない（テストの前提が崩れた）');
  else if (!r2 || !(Math.abs(r2.t - r1.t - 0.25) < 0.04))
    errs.push(`16：溜めている間に0.5秒進めると、落石が0.25秒でなく ${r2 && +(r2.t - r1.t).toFixed(3)} 秒進む`);
  // 止まっている間（装備の画面）は進まない
  await pg.keyboard.press('Tab');
  await advance(pg, 1);
  const paused = (await pg.evaluate(() => __test.state())).paused,
    r3 = await pg.evaluate(() => __test.rockfall());
  await pg.keyboard.press('Tab');
  if (!paused) errs.push('16：Tab で装備の画面が開かない（テストの前提が崩れた）');
  else if (!r3 || !(r3.t - r2.t < 0.05)) errs.push(`16：止まっている間も、落石が進む（${r2 && r2.t} → ${r3 && r3.t}）`);
  // 階を移ると消える（前の階のマスに石が落ち続けない）
  await pg.evaluate(() => dbg.go(3));
  await advance(pg, 0.5);
  const r4 = await pg.evaluate(() => __test.rockfall());
  if (r4) errs.push(`16：階を移っても、前の階の落石が続いている（${JSON.stringify(r4)}）`);
  // 階段を下りて暗くなり始めたら、落石は進まない（石が落ちず、当たらない）
  await advance(pg, 1);
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
  if (tr !== 'out') {
    errs.push('16：階段を下り始められない（テストの前提が崩れた）');
    return;
  }
  await pg.evaluate(() => __test.rockfall(true));
  await advance(pg, 0.3);
  const r5 = await pg.evaluate(() => [__test.state().trans, __test.rockfall()]);
  if (r5[0] !== 'out') errs.push(`16：0.3秒で暗くなり終わった（テストの前提が崩れた。${r5[0]}）`);
  else if (!r5[1] || r5[1].t !== 0) errs.push(`16：階段を下りて暗くなる間も、落石が進む（${JSON.stringify(r5[1])}）`);
  await advance(pg, 1.5);
  const r6 = await pg.evaluate(() => __test.rockfall());
  if (r6) errs.push(`16：階段を下りた後も、前の階の落石が続いている（${JSON.stringify(r6)}）`);
}

// 17：倒れた生き物が崩れて積もり、消える（src/lib/debris.ts）
async function debrisChecks(pg, base) {
  await openTest(pg, base, 'seed=202&god=1&depth=5');
  await advance(pg, 2);
  // [種類, 残す文字の上限, 倒れた所から積もった文字までの一番遠い距離の上限]
  for (const [key, cap, farMax] of [
    ['r', 120, 1.5],
    ['Zi', 120, 2],
    ['T', 120, 3.5],
    ['D', 250, 6],
  ]) {
    const r = await pg.evaluate((key) => {
      __test.clearAll();
      const W = __test.size().w,
        p = __test.state().pos;
      __test.summon(key, Math.floor(p[1] / 2) * W + Math.floor(p[0] / 2) + 2);
      __test.advance(0.2);
      dbg.kill('near');
      const a = __test.debris();
      __test.advance(2.5);
      const b = __test.debris();
      __test.advance(25);
      return { a, b, c: __test.debris() };
    }, key);
    const a = r.a[0],
      b = r.b[0];
    if (r.a.length !== 1 || !a || !(a.n > 0)) {
      errs.push(`17：${key} を倒しても、崩れる体ができない（${JSON.stringify(r.a)}）`);
      continue;
    }
    if (a.kept > cap) errs.push(`17：${key} の残す文字が上限 ${cap} を越える（${a.kept}）`);
    // 光（目・心臓など）とみなして、落とさずにすぐ消す文字（様子 3）は、体の半分より少ない（明るく描く生き物でも、体は崩れて積もる）
    if (a.st[3] * 2 >= a.n) errs.push(`17：${key} の文字の半分より多くが、光とみなされてすぐ消える（${a.st[3]} / ${a.n}）`);
    if (!b || b.st[0] || b.st[1]) errs.push(`17：${key} の文字が、2.5秒たっても落ちきらない（${JSON.stringify(b)}）`);
    else if (!b.rest) errs.push(`17：${key} の文字が積もらない（${JSON.stringify(b)}）`);
    else {
      if (b.rest.y0 < 0) errs.push(`17：${key} の積もった文字が床より下にある（${b.rest.y0}）`);
      if (b.rest.y1 > 0.7) errs.push(`17：${key} の積もった文字が高く積み上がる（${b.rest.y1}）`);
      if (b.rest.far > farMax) errs.push(`17：${key} の積もった文字が、倒れた所から遠くまで散らばる（${b.rest.far}）`);
    }
    if (r.c.length) errs.push(`17：${key} の積もった文字が、25秒たっても消えない（${JSON.stringify(r.c)}）`);
  }
  // 同時に14体倒れても、崩れる体は12を越えて残らない（古い物から早く消す）
  const many = await pg.evaluate(() => {
    __test.clearAll();
    const W = __test.size().w,
      p = __test.state().pos,
      c = Math.floor(p[1] / 2) * W + Math.floor(p[0] / 2);
    for (let k = 0; k < 14; k++) __test.summon('S', c + 2);
    __test.advance(0.1);
    for (let k = 0; k < 14; k++) dbg.kill('near');
    const n0 = __test.debris().length;
    __test.advance(3);
    return [n0, __test.debris().length];
  });
  if (many[0] !== 14) errs.push(`17：14体倒したのに、崩れる体が ${many[0]} 個（テストの前提が崩れた）`);
  else if (many[1] > 12) errs.push(`17：同時に14体倒すと、3秒たっても崩れる体が ${many[1]} 個残る（上限は12）`);
}

// 18：敵に攻撃を当てた時の眩しさ（src/lib/bodies/draw.ts の glowBoost・src/lib/fx.ts の drawWave）
async function glareChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  // トロルを 1.8 マスほど先の見えている床に置き、小剣を右手に持つ
  const ok = await pg.evaluate(() => {
    __test.equip('R', 'blade');
    __test.clearAll();
    __test.fov();
    const s = __test.state(),
      { w, h } = __test.size();
    let best = null;
    for (let i = 0; i < w * h; i++) {
      const c = __test.cell(i);
      if (!c.floor || !c.seen) continue;
      const d = Math.abs(Math.hypot(c.x - s.pos[0], c.z - s.pos[1]) - 1.8);
      if (!best || d < best[0]) best = [d, i];
    }
    if (!best) return false;
    __test.summon('T', best[1]);
    return true;
  });
  if (!ok) {
    errs.push('18：トロルを置く床が無い（テストの前提が崩れた）');
    return;
  }
  // 照準を合わせ（照準の先は明るく描くので、当てる前もそうしておく）、当てる前を写す
  try {
    await aimAt(pg, 'T');
  } catch (e) {
    errs.push(`18：${e.message}（テストの前提が崩れた）`);
    return;
  }
  await frames(pg, 1);
  const box = await pg.evaluate(() => __test.monsterView('T')?.screen ?? null);
  if (!box) {
    errs.push('18：トロルの体が描かれていない（テストの前提が崩れた）');
    return;
  }
  const before = PNG.sync.read(await pg.screenshot({ timeout: 90000 }));
  // 小剣は押した時に当たる。当たった次のフレームを描いて写す（光るのは 0.2 秒ほど）
  try {
    const { frame } = await strike(pg, 'R', 'T');
    if (frame !== 0) throw new Error(`小剣が押した時に当たらず、${frame} フレーム後に当たった`);
  } catch (e) {
    errs.push(`18：${e.message}（テストの前提が崩れた）`);
    return;
  }
  await frames(pg, 1);
  const lit = await pg.evaluate(() => __test.mob(0).hitT);
  const hit = PNG.sync.read(await pg.screenshot({ timeout: 90000 }));
  if (!(lit > 0)) {
    errs.push(`18：写した時に、トロルが当たって光っていない（テストの前提が崩れた。hitT ${lit}）`);
    return;
  }
  const lum = (png, i) => 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  const bright = (png) => {
    let n = 0;
    for (let i = 0; i < png.data.length; i += 4) if (lum(png, i) >= 200) n++;
    return n / (png.width * png.height);
  };
  const mean = (png) => {
    let s = 0,
      n = 0;
    for (let y = box.y0; y < box.y1; y++)
      for (let x = box.x0; x < box.x1; x++) {
        s += lum(png, (y * png.width + x) * 4);
        n++;
      }
    return n ? s / n : 0;
  };
  const scr = bright(hit),
    m0 = mean(before),
    m1 = mean(hit);
  if (scr > 0.25) errs.push(`18：トロルに小剣を当てると、画面の ${(scr * 100).toFixed(1)}% が眩しい画素になる（上限 25%）`);
  if (!(m1 > m0 * 1.1)) errs.push(`18：トロルに小剣を当てても、体が明るくならない（明るさの平均 ${m0.toFixed(1)} → ${m1.toFixed(1)}）`);
  console.log(`18：当たった時の画面の眩しい画素 ${(scr * 100).toFixed(1)}%、体の明るさ ${m0.toFixed(1)} → ${m1.toFixed(1)}`);
}

// 20・21 の用意：大洞窟（床に枯れ草が多い）で、樫の杖を両手に持ち、左に性質 elL、右に elR を付け、5 ほど先の見えている床にトロルを置いて止め、照準を合わせる。
// うまくいかなければ、わけの文を返す
async function trollAhead(pg, base, elL, elR) {
  await openTest(pg, base, 'seed=7&depth=3&god=1');
  await advance(pg, 2);
  const set = await pg.evaluate(
    ([elL, elR]) => {
      __test.clearAll();
      const got = [__test.equip('L', 'orb'), __test.equip('R', 'orb'), __test.elem('L', elL), __test.elem('R', elR)].join();
      if (got !== `orb,orb,${elL},${elR}`) return `手の用意ができない（${got}）`;
      __test.fov();
      const s = __test.state(),
        { w, h } = __test.size(),
        fx = -Math.sin(s.yaw),
        fz = -Math.cos(s.yaw);
      let best = null;
      for (let i = 0; i < w * h; i++) {
        const c = __test.cell(i);
        if (!c.floor || !c.seen || c.water || c.lava) continue;
        const dx = c.x - s.pos[0],
          dz = c.z - s.pos[1],
          d = Math.hypot(dx, dz);
        if (d < 4 || d > 6) continue;
        // 5 に近く、前にある床ほど良い
        const score = Math.abs(d - 5) - (dx * fx + dz * fz) / d;
        if (!best || score < best[0]) best = [score, i];
      }
      if (!best) return 'トロルを置く床が無い';
      __test.summon('T', best[1]);
      __test.hold(0, {});
      return null;
    },
    [elL, elR],
  );
  if (set) return set;
  try {
    await aimAt(pg, 'T');
  } catch (e) {
    return e.message;
  }
  await frames(pg, 1);
  return null;
}
// 写して数える：画面全体の眩しい画素（明るさ 200 以上）の割合と、トロルの体の範囲の白飛び（3つの色がどれも 245 以上）の割合と明るさの平均（数え方は tools/glare.mjs と同じ）。
// 体の範囲は写すたびに読み直す（当たって吹き飛んだり向きを変えたりしても、体の所で数える）。体が描かれていなければ null
async function trollShot(pg) {
  const box = await pg.evaluate(() => __test.monsterView('T')?.screen ?? null);
  if (!box) return null;
  const png = PNG.sync.read(await pg.screenshot({ timeout: 90000 }));
  const lum = (i) => 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  let scr = 0,
    white = 0,
    sum = 0,
    n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (lum(i) >= 200) scr++;
  for (let y = Math.max(0, box.y0); y < Math.min(png.height, box.y1); y++)
    for (let x = Math.max(0, box.x0); x < Math.min(png.width, box.x1); x++) {
      const i = (y * png.width + x) * 4;
      n++;
      sum += lum(i);
      if (png.data[i] >= 245 && png.data[i + 1] >= 245 && png.data[i + 2] >= 245) white++;
    }
  return { scr: scr / (png.width * png.height), white: n ? white / n : 0, mean: n ? sum / n : 0 };
}

// 20：反応と火が重なった時の眩しさ（src/lib/lightmap.ts の LIT_MAX・src/lib/shaders.ts の火の明かり）
async function reactFireGlareChecks(pg, base) {
  const set = await trollAhead(pg, base, 'ice', 'fire');
  if (set) {
    errs.push(`20：${set}（テストの前提が崩れた）`);
    return;
  }
  const before = await trollShot(pg);
  if (!before) {
    errs.push('20：トロルの体が描かれていない（テストの前提が崩れた）');
    return;
  }
  // 氷で凍えさせてから炎を当てる（蒸気の反応が起き、炎の玉は当たった所の枯れ草に火をつける）
  try {
    await strike(pg, 'L', 'T');
    await aimAt(pg, 'T');
    await strike(pg, 'R', 'T');
  } catch (e) {
    errs.push(`20：${e.message}（テストの前提が崩れた）`);
    return;
  }
  const fire = await pg.evaluate(() => {
    const { w, h } = __test.size();
    let n = 0;
    for (let i = 0; i < w * h; i++) if (__test.cell(i).fire > 0) n++;
    return n;
  });
  if (fire < 4) {
    errs.push(`20：炎の玉を当てても、燃えているマスが ${fire} 個（テストの前提が崩れた。4 個以上のはず）`);
    return;
  }
  // 当たってから 2・4・6・8 フレーム目（白く飛んでいたのは 4〜6 フレーム目）の、一番悪い値を見る
  const after = [];
  for (let k = 0; k < 4; k++) {
    await frames(pg, 2);
    const a = await trollShot(pg);
    if (!a) {
      errs.push(`20：当たって ${2 * (k + 1)} フレーム目に、トロルの体が描かれていない（テストの前提が崩れた）`);
      return;
    }
    after.push(a);
  }
  const top = (k) => Math.max(...after.map((a) => a[k]));
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  if (top('scr') > 0.25) errs.push(`20：凍えたトロルに炎を当てると、画面の ${pct(top('scr'))} が眩しい画素になる（上限 25%）`);
  if (top('white') > 0.12) errs.push(`20：凍えたトロルに炎を当てると、体の範囲の ${pct(top('white'))} が白く飛ぶ（上限 12%）`);
  // 手応えは残る：体は当てる前より明るく、火で画面の眩しい所は増える
  if (!(top('mean') > before.mean * 1.1))
    errs.push(`20：凍えたトロルに炎を当てても、体が明るくならない（明るさの平均 ${before.mean.toFixed(1)} → ${top('mean').toFixed(1)}）`);
  if (!(top('scr') > before.scr)) errs.push(`20：炎を当てても、画面の眩しい画素が増えない（${pct(before.scr)} → ${pct(top('scr'))}）`);
  console.log(
    `20：燃えているマス ${fire}、画面の眩しい画素 ${pct(before.scr)} → ${pct(top('scr'))}、体の白飛び ${pct(before.white)} → ${pct(top('white'))}、体の明るさ ${before.mean.toFixed(1)} → ${top('mean').toFixed(1)}`,
  );
}

// 21：気づいた敵に照準を合わせて当てた時の眩しさ（src/lib/bodies/draw.ts の hitGlow・glowBoost・drawMonster1）
async function hitGlowChecks(pg, base) {
  // 氷の樫の杖を両手に持つ（火を起こさない）
  const set = await trollAhead(pg, base, 'ice', 'ice');
  if (set) {
    errs.push(`21：${set}（テストの前提が崩れた）`);
    return;
  }
  try {
    await strike(pg, 'L', 'T');
    await aimAt(pg, 'T');
    await strike(pg, 'R', 'T');
  } catch (e) {
    errs.push(`21：${e.message}（テストの前提が崩れた）`);
    return;
  }
  const mob = () => pg.evaluate(() => __test.mob(0));
  // 当たってから 2・4・6・8 フレーム目（白く飛んでいたのは 4〜8 フレーム目）の、一番悪い値を見る
  const hit = [];
  for (let k = 0; k < 4; k++) {
    await frames(pg, 2);
    const m = await mob();
    if (!(m?.hitT > 0)) break;
    const a = await trollShot(pg);
    if (!a) {
      errs.push(`21：当たって ${2 * (k + 1)} フレーム目に、トロルの体が描かれていない（テストの前提が崩れた）`);
      return;
    }
    hit.push(a);
  }
  if (hit.length < 2) {
    errs.push(`21：当たって光っている間に ${hit.length} 回しか写せない（テストの前提が崩れた）`);
    return;
  }
  // 光り終わったフレーム（照準の先のまま、気づいている。弾けた粒が引くと白さも引くので、すぐ写す）
  for (let k = 0; k < 15 && (await mob())?.hitT > 0; k++) await frames(pg, 1);
  // 当たって吹き飛び、照準から外れていたら、合わせ直してから写す
  if (!(await mob())?.aimed)
    try {
      await aimAt(pg, 'T');
      await frames(pg, 1);
    } catch (e) {
      errs.push(`21：${e.message}（テストの前提が崩れた）`);
      return;
    }
  const m = await mob();
  if (!(m && m.hitT === 0 && m.aimed && m.glow > 1.5)) {
    errs.push(`21：光り終わった後、気づいたトロルが照準の先にいない（テストの前提が崩れた。${JSON.stringify(m)}）`);
    return;
  }
  const after = await trollShot(pg);
  if (!after) {
    errs.push('21：光り終わった後、トロルの体が描かれていない（テストの前提が崩れた）');
    return;
  }
  const top = (k) => Math.max(...hit.map((a) => a[k]));
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  if (top('white') > 0.05)
    errs.push(`21：気づいたトロルに氷の樫の杖を当てると、当たって光っている間に体の範囲の ${pct(top('white'))} が白く飛ぶ（上限 5%）`);
  if (after.white > 0.02) errs.push(`21：光り終わった後も、照準の先の気づいたトロルの体の範囲の ${pct(after.white)} が白く飛ぶ（上限 2%）`);
  if (!(top('mean') > after.mean * 1.05))
    errs.push(
      `21：当たって光っている間の体が、光り終わった後より明るくない（明るさの平均 ${top('mean').toFixed(1)}、後 ${after.mean.toFixed(1)}）`,
    );
  console.log(
    `21：体の白飛び 当たって光っている間 ${pct(top('white'))}・光り終わった後 ${pct(after.white)}、体の明るさ ${top('mean').toFixed(1)} → ${after.mean.toFixed(1)}、画面の眩しい画素 ${pct(top('scr'))}`,
  );
}

async function sceneToolChecks(pg, base) {
  await openTest(pg, base, 'seed=202&depth=1');
  await advance(pg, 2);
  // 性質：付けると手の名前に出て、別の性質を付けると入れ替わる。null で外れる。無い鍵は受け付けない
  const el = await pg.evaluate(() => {
    __test.equip('R', 'bolt');
    const hb = () => document.getElementById('hotbar').textContent;
    const a = __test.elem('R', 'fire'),
      fire = hb(),
      b = __test.elem('R', 'ice'),
      ice = hb(),
      c = __test.elem('R', null),
      none = hb();
    return { a, b, c, fire, ice, none, bad: __test.elem('R', 'blade'), badHand: __test.elem('r', 'fire') };
  });
  if (el.a !== 'fire' || !el.fire.includes('炎の')) errs.push(`19：右手に炎を付けても、手の名前に炎が出ない（${el.a}・${el.fire}）`);
  if (el.b !== 'ice' || !el.ice.includes('氷の') || el.ice.includes('炎の'))
    errs.push(`19：炎を氷に付け替えられない（${el.b}・${el.ice}）`);
  if (el.c !== null || el.none.includes('炎の') || el.none.includes('氷の')) errs.push(`19：性質を外せない（${el.c}・${el.none}）`);
  if (!String(el.bad).startsWith('no such element')) errs.push(`19：性質でない鍵を受け付けた（${el.bad}）`);
  if (!String(el.badHand).startsWith('no such hand')) errs.push(`19：無い手を受け付けた（${el.badHand}）`);
  // 止める：プレイヤーのすぐ隣のトロルを、プレイヤーから見て横を向かせて止める。3 秒たっても動かず、体力も減らず、言った向きを向く
  const put = await pg.evaluate(() => {
    __test.clearAll();
    __test.fov();
    const s = __test.state(),
      { w, h } = __test.size();
    let best = null;
    for (let i = 0; i < w * h; i++) {
      const c = __test.cell(i);
      if (!c.floor || !c.seen) continue;
      const d = Math.abs(Math.hypot(c.x - s.pos[0], c.z - s.pos[1]) - 1.6);
      if (!best || d < best[0]) best = [d, i];
    }
    if (!best) return null;
    // 小さな生き物（清掃機）は止められない（動きが別の処理なので）
    __test.summon('Rc', best[1]);
    const critter = __test.hold(0, {});
    __test.clearAll();
    __test.summon('T', best[1]);
    __test.hold(0, { yaw: 1.2 });
    const m0 = __test.mob(0);
    __test.advance(3);
    const m1 = __test.mob(0),
      s1 = __test.state();
    __test.hold(0, null);
    __test.advance(4);
    const m2 = __test.mob(0),
      s2 = __test.state();
    return { m0, m1, m2, hp0: s.hp, hp1: s1.hp, hp2: s2.hp, critter };
  });
  if (!put) errs.push('19：トロルを置く床が無い（テストの前提が崩れた）');
  else {
    const { m0, m1, m2, hp0, hp1, hp2, critter } = put,
      turn = Math.abs(Math.atan2(Math.sin(m1.yaw - 1.2), Math.cos(m1.yaw - 1.2)));
    if (Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.01)
      errs.push(`19：止めたトロルが歩いた（${JSON.stringify([m0.x, m0.z])} → ${JSON.stringify([m1.x, m1.z])}）`);
    if (!String(critter).startsWith('cannot hold a critter')) errs.push(`19：小さな生き物を止めたと言う（${critter}）`);
    if (hp1 < hp0) errs.push(`19：止めたトロルが攻撃した（体力 ${hp0} → ${hp1}）`);
    if (turn > 0.05) errs.push(`19：止めたトロルが、言った向き 1.2 を向かない（${m1.yaw}）`);
    if (!(hp2 < hp1 || Math.hypot(m2.x - m1.x, m2.z - m1.z) > 0.1)) errs.push(`19：放したトロルが、動きも攻撃もしない`);
  }
  // カメラ：トロルを 5 マスほど先に置いて止め、目からトロルの体の真ん中を見る（dbg.look）。目と同じ所に置いたカメラで同じ点を見ると、同じに写る。
  // 3 後ろへ下げると、真ん中は同じ所のまま小さく写る。null で目に戻ると、置く前と同じに写る
  const cam = await pg.evaluate(() => {
    __test.clearAll();
    const s = __test.state(),
      { w, h } = __test.size();
    let best = null;
    for (let i = 0; i < w * h; i++) {
      const c = __test.cell(i);
      if (!c.floor || !c.seen) continue;
      const d = Math.abs(Math.hypot(c.x - s.pos[0], c.z - s.pos[1]) - 5);
      if (!best || d < best[0]) best = [d, i];
    }
    if (!best) return null;
    __test.summon('T', best[1]);
    // 向きを決めて止め、気づき終わるまで進める（気づく度合いで明るさが変わるので）
    __test.hold(0, { yaw: 0.5 });
    __test.advance(4);
    const m = __test.mob(0);
    dbg.look(m.x, 1.2, m.z);
    return true;
  });
  if (!cam) {
    errs.push('19：トロルを 5 マス先に置く床が無い（テストの前提が崩れた）');
    return;
  }
  await frames(pg, 2);
  const view = async () => {
    await frames(pg, 2);
    const v = await pg.evaluate(() => __test.monsterView('T'));
    return v && v.screen ? { x: (v.screen.x0 + v.screen.x1) / 2, y: (v.screen.y0 + v.screen.y1) / 2, h: v.screen.y1 - v.screen.y0 } : null;
  };
  const v0 = await view();
  // 目の位置（揺れの無い時の、カメラの位置）と、見ている点
  const eye = await pg.evaluate(() => {
    const c = __test.cam(),
      m = __test.mob(0);
    return { pos: c.pos, at: [m.x, 1.2, m.z] };
  });
  await pg.evaluate((eye) => __test.cam(eye), eye);
  const v1 = await view();
  const fwd = await pg.evaluate((eye) => {
    const [x, y, z] = eye.pos,
      [ax, , az] = eye.at,
      d = Math.hypot(ax - x, az - z);
    return __test.cam({ pos: [x + ((ax - x) / d) * 2, y, z + ((az - z) / d) * 2], at: eye.at });
  }, eye);
  const v2 = await view();
  // 岩の中には置かない（地図の外と、天井より上）。pos・at が3つの数でなければ置かない
  const inRock = await pg.evaluate(() => {
    const s = __test.state();
    return [
      __test.cam({ pos: [-1, 1.5, -1], at: [s.pos[0], 1.5, s.pos[1]] }),
      __test.cam({ pos: [s.pos[0], 99, s.pos[1]], at: [s.pos[0] + 1, 1.5, s.pos[1]] }),
      __test.cam({ pos: [s.pos[0], 1.5], at: [s.pos[0] + 1, 1.5, s.pos[1]] }),
    ];
  });
  await pg.evaluate(() => __test.cam(null));
  const v3 = await view();
  // 置いている間も、ゲームの一歩の外のカメラは目のまま。右手の光弾で撃つと、トロルに当たる
  await pg.evaluate((fwd) => __test.cam(fwd), fwd);
  const during = await pg.evaluate(() => __test.cam());
  await pg.evaluate(() => __test.equip('R', 'mstaff'));
  let hit = null;
  try {
    hit = await strike(pg, 'R', 'T');
  } catch (e) {
    errs.push(`19：カメラを置いている間に撃っても当たらない（${e.message}）`);
  }
  await pg.evaluate(() => __test.cam(null));
  const near = (a, b, px) => a && b && Math.abs(a.x - b.x) <= px && Math.abs(a.y - b.y) <= px;
  if (!fwd || typeof fwd === 'string' || !fwd.clear)
    errs.push(`19：トロルへ 2 前へ出したカメラを置けないか、トロルまでの線が岩を通ると言う（${JSON.stringify(fwd)}）`);
  if (!near(v0, v1, 2))
    errs.push(`19：目と同じ所に置いたカメラで、写り方が変わる（目 ${JSON.stringify(v0)}、置いたカメラ ${JSON.stringify(v1)}）`);
  // 前へ出すと大きく写り、見ている点（画面の真ん中）からのずれも、同じ割合で伸びる（体の範囲の真ん中は、見ている点の真上とは限らないので）
  const k = v0 && v2 ? v2.h / v0.h : 0;
  if (!(k > 1.2) || Math.abs(v2.x - 480 - (v0.x - 480) * k) > 6 || Math.abs(v2.y - 270 - (v0.y - 270) * k) > 6)
    errs.push(
      `19：2 前へ出したカメラで、大きく写らないか、写る所が見ている点からずれる（目 ${JSON.stringify(v0)}、前へ出したカメラ ${JSON.stringify(v2)}）`,
    );
  if (Math.hypot(during.pos[0] - eye.pos[0], during.pos[1] - eye.pos[1], during.pos[2] - eye.pos[2]) > 0.05)
    errs.push(
      `19：カメラを置いている間に、ゲームの一歩の外のカメラが目でない（目 ${JSON.stringify(eye.pos)}、${JSON.stringify(during.pos)}）`,
    );
  if (!inRock.slice(0, 2).every((r) => String(r).startsWith('camera in rock')))
    errs.push(`19：岩の中にカメラを置けた（${JSON.stringify(inRock)}）`);
  if (!String(inRock[2]).startsWith('pos and at')) errs.push(`19：数が2つの pos でカメラを置けた（${JSON.stringify(inRock[2])}）`);
  // ほかの階へ移ると、置いたカメラは捨てて目に戻る（同じ階の間は残る）
  const moved = await pg.evaluate((fwd) => {
    __test.cam(fwd);
    const before = __test.cam().placed;
    dbg.go(2);
    __test.advance(2);
    return { before, after: __test.cam().placed, depth: __test.state().depth };
  }, fwd);
  if (!moved.before || moved.after !== null || moved.depth !== 2)
    errs.push(
      `19：ほかの階へ移っても、置いたカメラが残る（移る前 ${JSON.stringify(moved.before)}、移った後 ${JSON.stringify(moved.after)}、深さ ${moved.depth}）`,
    );
  if (!near(v0, v3, 2)) errs.push(`19：__test.cam(null) で目に戻らない（置く前 ${JSON.stringify(v0)}、戻した後 ${JSON.stringify(v3)}）`);
  console.log(
    `19：トロルの写る所 目 ${JSON.stringify(v0)}・同じ所のカメラ ${JSON.stringify(v1)}・2 前へ出したカメラ ${JSON.stringify(v2)}・戻した後 ${JSON.stringify(v3)}。置いている間に撃って ${hit ? hit.frame + ' フレーム目に当たった' : '当たらない'}`,
  );
}

await withBrowser(async ({ browser, base }) => {
  const pg = await newPage(browser, errs);
  await doorChecks(pg, base);
  await traceChecks(pg, base);
  await houndChecks(pg, base);
  await brimChecks(pg, base);
  await chillChecks(pg, base);
  await thinIceChecks(pg, base);
  await eruptChecks(pg, base);
  await dodgeChecks(pg, base);
  await lavaMobChecks(pg, base);
  await knockLavaChecks(pg, base);
  await rockfallChecks(pg, base);
  await debrisChecks(pg, base);
  await glareChecks(pg, base);
  await reactFireGlareChecks(pg, base);
  await hitGlowChecks(pg, base);
  await sceneToolChecks(pg, base);
});
console.log('page errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
