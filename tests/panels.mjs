#!/usr/bin/env node
// 枠のテスト：パネルの枠（boxText）は、visW で文字の幅を数えて右の縦線を揃えている。
//   1. ゲームの文言に出る全部の文字を、パネルのフォントで描いて幅を測り、visW の数え方と一致するか
//      （ルーン文字は、パネルと同じく <b class="rn"> の中で測る）
//   2. 実際の画面（操作・装備・メニュー・レベルアップ・祭壇・結果）で、右の縦線が全部の行で同じ位置にあるか
//      レベルアップと祭壇は、一覧の見出しの後ろの名前の列も揃っているか
//   3. 十字の下：「クリックで視点操作に戻る」は、照準の先の説明があってもなくても同じ場所に出て、説明はその下に、一言（#hint）はさらにその下に、
//      8px ずつあけて並ぶ（重ならない）。説明だけの時は十字の下 22px、説明が1行なら一言はほぼ前と同じ所（十字の下 48px から 2px 以内）に出る
//   4. 十字の下の一言（#hint）が消える時：表示・音量・ビルドの持ち替えの一言は、塞がれていない間も自分の時計まで残り、時計の後に消える。
//      後から別の一言が出たら、前の一言の時計はそれを消さない。行く手を塞がれた時の一言は、塞がれなくなってから 0.9 秒ほどで消える
import { withBrowser, newPage, openTest, advance, nearAltar, gameText } from './lib.mjs';

const src = gameText();
// oxlint-disable-next-line typescript/no-misused-spread -- visW はコードポイントごとに数えるので、わざとコードポイントに分ける
const chars = [...new Set([...src].filter((c) => c.codePointAt(0) >= 0x20 && c !== '\u007f'))].sort();
const errs = [];
let fails = 0;
await withBrowser(async ({ browser, base }) => {
  let pg = await newPage(browser, errs, { width: 1280, height: 720, still: true });
  const pgSwap = (p) => {
    pg = p;
  };
  await openTest(pg, base, 'seed=202&depth=1&god=1');
  await advance(pg, 2);
  await pg.evaluate(() => document.fonts.ready);

  // 3. 十字の下（ゲームを進めずに、一言と説明を直接出して測る。進めると、ゲームが説明を書き直す）
  {
    const m = await pg.evaluate(() => {
      const res = document.getElementById('resume'),
        look = document.getElementById('look'),
        hint = document.getElementById('hint'),
        r = (el) => el.getBoundingClientRect(),
        keep = [res.style.display, look.innerHTML, hint.innerHTML];
      const long = '<b>骸骨の戦士</b>眠っている<span>' + 'とても長い説明の文。'.repeat(8) + '</span>';
      res.style.display = 'block';
      look.innerHTML = '';
      const alone = r(res);
      look.innerHTML = long;
      hint.innerHTML = '鉄格子が行く手を塞いでいる';
      const both = { res: r(res), look: r(look), hint: r(hint) };
      res.style.display = 'none';
      const lookOnly = r(look);
      look.innerHTML = '<b>骸骨の戦士</b>眠っている';
      const oneLine = { look: r(look), hint: r(hint) };
      [res.style.display, look.innerHTML, hint.innerHTML] = keep;
      return { alone, both, lookOnly, oneLine, mid: innerHeight / 2 };
    });
    const near = (a, b) => Math.abs(a - b) < 0.5,
      n0 = errs.length;
    const gap = m.both.look.top - m.both.res.bottom;
    if (!near(m.alone.top, m.both.res.top)) errs.push(`十字の下：説明が出ると、一言の場所が変わる（${m.alone.top} → ${m.both.res.top}）`);
    if (!near(gap, 8)) errs.push(`十字の下：一言と説明の間が 8px でない（${gap}）`);
    if (!(m.both.look.height > 30)) errs.push(`十字の下：長い説明が折り返されていない（テストの前提が崩れた。高さ ${m.both.look.height}）`);
    if (!near(m.lookOnly.top, m.mid + 22))
      errs.push(`十字の下：説明だけの時、十字の下 22px に出ない（${m.lookOnly.top}、真ん中 ${m.mid}）`);
    if (!near(m.alone.top, m.mid + 22)) errs.push(`十字の下：一言が十字の下 22px に出ない（${m.alone.top}）`);
    const hgap = m.both.hint.top - m.both.look.bottom;
    if (!near(hgap, 8)) errs.push(`十字の下：説明と、行く手を塞がれた時などの一言の間が 8px でない（${hgap}）`);
    if (Math.abs(m.oneLine.hint.top - (m.mid + 48)) > 2)
      errs.push(
        `十字の下：説明が1行の時、行く手を塞がれた時などの一言が、前の場所（十字の下 48px）から 2px より離れた（${m.oneLine.hint.top}）`,
      );
    console.log(
      `${errs.length > n0 ? '✗' : '✓'} 十字の下：一言は同じ場所、説明はその下に ${gap}px、行く手を塞がれた時などの一言はさらに ${hgap}px あけて並ぶ`,
    );
  }

  // 1. 文字ごとの幅
  const bad = await pg.evaluate(async (chars) => {
    const box = document.createElement('pre');
    box.id = 'pack';
    box.className = 'show';
    box.style.cssText = 'position:fixed;left:0;top:0;transform:none;visibility:hidden';
    document.body.appendChild(box);
    // ルーン文字は、ゲームと同じく1文字ずつ <b class="rn">（CSS で幅が1マスに固定）に入れる
    const wrap = (c) => (/[ᚠ-᛿]/.test(c) ? `<span>${`<b class="rn">${c}</b>`.repeat(8)}</span>` : `<span>${c.repeat(8)}</span>`);
    box.innerHTML = `<span>${'0'.repeat(40)}</span>` + chars.map((c) => wrap(c.replace('&', '&amp;').replace('<', '&lt;'))).join('');
    // 使うフォントを先に読み込む（描く時まで読み込まれないので、すぐ測ると幅が違う）
    const runes = chars.filter((c) => /[\u16a0-\u16ff]/.test(c)).join(''),
      rest = chars.filter((c) => !/[\u16a0-\u16ff]/.test(c)).join('');
    const fam = getComputedStyle(box).fontFamily,
      runeFam = getComputedStyle(box.querySelector('.rn') || box).fontFamily;
    await Promise.all(
      [400, 600, 700].map((w) => document.fonts.load(`${w} 14px ${fam}`, rest)).concat([document.fonts.load(`500 14px ${runeFam}`, runes)]),
    );
    await document.fonts.ready;
    const spans = [...box.children],
      cw = spans[0].getBoundingClientRect().width / 40,
      out = [];
    chars.forEach((c, i) => {
      const w = spans[i + 1].getBoundingClientRect().width / 8 / cw,
        n = __test.width(c);
      if (Math.abs(w - n) > 0.05)
        out.push(`${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}：数え方 ${n}、実際 ${w.toFixed(2)}`);
    });
    box.remove();
    return out;
  }, chars);
  if (bad.length) {
    fails += bad.length;
    console.log(`✗ visW と実際の幅が違う文字（${bad.length}）：\n  ${bad.join('\n  ')}`);
  } else console.log(`✓ ${chars.length} 文字、すべて visW の数え方どおりの幅`);

  // 2. 実際の画面で、右の縦線が揃うか
  // パネルのフォントは、文字の範囲ごとのファイルを使う時に読む。読み終わる前は代わりのフォントで描かれて幅が違うので、待ってから測る
  const fontsSettled = (id) =>
    pg.evaluate(async (id) => {
      void document.getElementById(id).offsetWidth;
      await document.fonts.ready;
    }, id);
  const rightEdges = async (id) => {
    await fontsSettled(id);
    return pg.evaluate((id) => {
      const el = document.getElementById(id),
        rng = document.createRange(),
        lines = [[]];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode()))
        for (let i = 0; i < n.data.length; i++) {
          if (n.data[i] === '\n') {
            lines.push([]);
            continue;
          }
          rng.setStart(n, i);
          rng.setEnd(n, i + 1);
          const b = rng.getBoundingClientRect();
          lines.at(-1).push([n.data[i], b.right]);
        }
      return lines
        .filter((l) => l.length)
        .map((l) => {
          const t = l
              .map((c) => c[0])
              .join('')
              .trimEnd(),
            last = [...l].reverse().find((c) => c[0] !== ' ');
          return { text: t, end: last[1], frame: /[|+]$/.test(t) };
        })
        .filter((l) => l.frame);
    }, id);
  };
  // 一覧の行（button.ao）で、見出しの後ろの名前が始まる位置
  const columns = (id) =>
    pg.evaluate(
      (id) =>
        [...document.getElementById(id).querySelectorAll('button.ao')]
          .map((b) => {
            const t = b.textContent,
              m = t.match(/^(\s*\S+\s+)\S/);
            if (!m) return null;
            const rng = document.createRange(),
              walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
            let n,
              at = m[1].length;
            while ((n = walk.nextNode())) {
              if (at < n.data.length) {
                rng.setStart(n, at);
                rng.setEnd(n, at + 1);
                return { text: t.trim(), x: rng.getBoundingClientRect().left };
              }
              at -= n.data.length;
            }
            return null;
          })
          .filter(Boolean),
      id,
    );
  const check = async (name, id, { column = false } = {}) => {
    const ls = await rightEdges(id);
    if (!ls.length) {
      fails++;
      console.log(`✗ ${name}：枠が見つからない`);
      return;
    }
    const ref = ls[ls.length - 1].end,
      off = ls.filter((l) => Math.abs(l.end - ref) > 1);
    if (off.length) {
      fails++;
      console.log(
        `✗ ${name}：右の縦線がずれている行（${off.length}）：\n  ${off.map((l) => `${(l.end - ref).toFixed(1)}px  ${l.text.slice(0, 50)}`).join('\n  ')}`,
      );
    } else console.log(`✓ ${name}：${ls.length} 行の右の縦線が揃っている`);
    if (!column) return;
    const cs = await columns(id);
    if (cs.length < 2) {
      fails++;
      console.log(`✗ ${name}：一覧の行が見つからない（${cs.length}）`);
      return;
    }
    const x0 = cs[0].x,
      bad = cs.filter((c) => Math.abs(c.x - x0) > 1);
    if (bad.length) {
      fails++;
      console.log(
        `✗ ${name}：名前の列がずれている行（${bad.length}）：\n  ${bad.map((c) => `${(c.x - x0).toFixed(1)}px  ${c.text.slice(0, 40)}`).join('\n  ')}`,
      );
    } else console.log(`✓ ${name}：${cs.length} 行の名前の列が揃っている`);
  };
  await check('操作', 'help');
  await pg.evaluate(() => {
    dbg.give('runes');
    dbg.give('slot');
    dbg.give('body');
  });
  await advance(pg, 0.5);
  await pg.keyboard.press('Tab');
  await advance(pg, 0.2);
  await check('装備', 'pack');
  await pg.keyboard.press('Tab');
  await advance(pg, 0.2);
  await pg.keyboard.press('Escape');
  await advance(pg, 0.2);
  await check('メニュー', 'menu');
  await pg.close();

  // レベルアップ：全部の加護を1段目にしてから上げる（2段目の「II」の印が出る）
  const open = async (q) => {
    const p = await newPage(browser, errs, { width: 1280, height: 720, still: true });
    await openTest(p, base, q);
    await advance(p, 2);
    return p;
  };
  let p2 = await open('seed=202&depth=1&god=1');
  await p2.evaluate(() => {
    __test.bless(1);
    dbg.exp(60);
  });
  await advance(p2, 0.3);
  pgSwap(p2);
  await check('レベルアップ', 'altarp', { column: true });
  await p2.close();
  // 祭壇
  p2 = await open('seed=202&depth=3&god=1');
  await nearAltar(p2);
  await advance(p2, 0.5);
  pgSwap(p2);
  await check('祭壇', 'altarp', { column: true });
  await p2.close();
  // 結果の画面（死んだ時）
  p2 = await open('seed=202&depth=1');
  await p2.evaluate(() => {
    dbg.hurt(999);
  });
  await advance(p2, 3);
  pgSwap(p2);
  await check('結果（死んだ時）', 'death');
  await p2.close();

  // 4. 十字の下の一言が消える時（立ったまま、行く手を塞がれていない間）
  {
    const n0 = errs.length;
    p2 = await open('seed=202&depth=1&god=1');
    await p2.evaluate(() => __test.clearAll());
    const hint = () => p2.evaluate(() => document.getElementById('hint').textContent);
    // 今の一言に want が入っているか（want が '' なら、消えているか）
    const expect = async (what, want) => {
      const h = await hint();
      if (want ? !h.includes(want) : h !== '') errs.push(`十字の下の一言：${what}（「${h}」）`);
    };
    await advance(p2, 1.2); // 塞がれていない秒（edge.idle）を 0.9 より長くする
    // 表示の切り替え（1.2 秒）
    await p2.keyboard.press('KeyH');
    await advance(p2, 0.1);
    await expect('表示を切り替えて 0.1 秒で、一言が出ていない', '表示：最小');
    await advance(p2, 1.0);
    await expect('表示を切り替えて 1.1 秒で、一言が消えている', '表示：最小');
    await advance(p2, 0.2);
    await expect('表示を切り替えて 1.3 秒たっても、一言が消えない', '');
    for (let i = 0; i < 2; i++) await p2.keyboard.press('KeyH'); // なし → 通常に戻す
    await advance(p2, 1.3);
    // 音量（1.2 秒）の 0.6 秒後に表示を出すと、音量の時計は表示の一言を消さない
    await p2.keyboard.press('KeyM');
    await advance(p2, 0.1);
    await expect('音量を変えて 0.1 秒で、一言が出ていない', '音量：');
    await advance(p2, 0.5);
    await p2.keyboard.press('KeyH');
    await advance(p2, 0.7);
    await expect('音量の一言の時計が、後から出た表示の一言を消した', '表示：最小');
    await advance(p2, 0.6);
    await expect('表示を切り替えて 1.3 秒たっても、一言が消えない', '');
    for (let i = 0; i < 2; i++) await p2.keyboard.press('KeyH');
    await advance(p2, 1.3);
    // ビルドの持ち替え（0.9 秒）：違う手でビルドを2つ保存して、ホイールで持ち替える
    const save = async (k) => {
      await p2.keyboard.press('Tab');
      await advance(p2, 0.1);
      await p2.click(`#pack button[data-save="${k}"]`);
      await p2.keyboard.press('Tab');
      await advance(p2, 0.1);
    };
    await save(0);
    await p2.evaluate(() => __test.equip('L', 'bolt'));
    await save(1);
    await advance(p2, 2); // 付け替えの詠唱と、塞がれていない秒
    await p2.evaluate(() => document.getElementById('gl').dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true })));
    await advance(p2, 0.1);
    await expect('ビルドを持ち替えて 0.1 秒で、一言が出ていない', 'ビルド');
    await advance(p2, 0.6);
    await expect('ビルドを持ち替えて 0.7 秒で、一言が消えている', 'ビルド');
    await advance(p2, 0.3);
    await expect('ビルドを持ち替えて 1.0 秒たっても、一言が消えない', '');
    await p2.close();

    // 行く手を塞がれた時：溶岩の隣のマスから、溶岩へ歩き続ける。離して 0.5 秒ではまだ出ていて、1.2 秒では消えている
    p2 = await open('seed=7&realm=volcano&god=1');
    await p2.evaluate(() => __test.clearAll());
    // 火口の噴き上がりが流れるマス（とその隣）は、溶岩が引いたり広がったりするので選ばない
    const at = await p2.evaluate(() => {
      const { w, h } = __test.size(),
        flow = new Set();
      for (const e of __test.events().list)
        for (const c of [e.src, ...(e.order || [])]) if (c !== null) for (const d of [0, -1, 1, -w, w]) flow.add(c + d);
      for (let i = w; i < w * (h - 1); i++) {
        if (!__test.cell(i).lava || flow.has(i)) continue;
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (!__test.cell(j).floor || flow.has(j)) continue;
          const a = __test.cell(j);
          dbg.step(a.x, a.z);
          return [i, j];
        }
      }
      return null;
    });
    if (at) {
      // dbg.look はカメラの位置から向きを決めるので、カメラが新しい場所に動いた次のフレームで向ける
      await advance(p2, 1 / 30);
      await p2.evaluate(([i]) => {
        const b = __test.cell(i);
        dbg.look(b.x, 1, b.z);
      }, at);
    }
    if (!at) errs.push('十字の下の一言：溶岩の隣の床が無い（テストの前提が崩れた。シードを変える）');
    else {
      await p2.keyboard.down('KeyW');
      await advance(p2, 0.8);
      await p2.keyboard.up('KeyW');
      await advance(p2, 0.1);
      await expect('溶岩へ歩き続けても、塞がれた時の一言が出ない', '溶岩');
      await advance(p2, 0.4);
      await expect('塞がれなくなって 0.5 秒で、塞がれた時の一言が消えている', '溶岩');
      await advance(p2, 0.7);
      await expect('塞がれなくなって 1.2 秒たっても、塞がれた時の一言が消えない', '');
    }
    await p2.close();
    console.log(
      `${errs.length > n0 ? '✗' : '✓'} 十字の下の一言：自分の時計まで残り、時計の後に消える（塞がれた時の一言は、塞がれなくなって 0.9 秒ほどで消える）`,
    );
  }
});
if (errs.length) console.log('page errors:', errs);
process.exit(fails || errs.length ? 1 : 0);
