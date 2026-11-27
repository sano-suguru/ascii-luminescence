// 粒子と世界の中に置く文字（src/lib/particles.ts）・頭の上の印（status.ts の drawMark）・装備の画面の開け閉めと付け替えの詠唱（inventory.ts）・
// マウスを捕まえる・視点・音量（screens.ts）の単体テスト。
// 指紋の値は、移す前の古い JS（src/game/05・12・15・16・27・28）で数えた値から、音が見た目の乱数を引かず、音の乱数（sndRand）を使う分と、
// マウスを捕まえられない時の扱い（lockFailed：requestPointerLock が無い時も失敗とし、案内の伝言を1回出す）と、下の HUD が指の操作の [持ち替え]（#swapB）を出し分ける分だけ違う
// （音の乱数を Math.random に回し、lockFailed と [持ち替え] の分を除くと、古い JS と同じ値になる。screens-cases.mjs の場合を、古い関数で数えて確かめた）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
import { describe, expect, it } from 'vitest';
import * as INV from '../../src/lib/inventory.ts';
import * as PT from '../../src/lib/particles.ts';
import * as SC from '../../src/lib/screens.ts';
import * as ST from '../../src/lib/status.ts';
import { G } from '../../src/lib/glyphs.ts';
import { adv, msgs, ui } from '../../src/lib/state.ts';
import { fakeScreen, particleCases, screenCases } from './screens-cases.mjs';
import { caseOut } from './case-out.mjs';

const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
};

describe('移す前と同じ', () => {
  it('粒子を出す・消す・文字を置く（300の場合）の指紋', () => {
    const all = particleCases(PT, 300);
    // 場合が中身を通っているか：粒子と文字の数が上限に達する場合も通る
    expect([all.split('\n').length, all.includes('"pN":3600'), all.includes('"dn":12000')]).toEqual([300, true, true]);
    caseOut('screens-1', all);
    expect([fnv(all), all.length]).toEqual(['04640061', 87148]);
  });
  it('頭の上の印・装備の画面の開け閉め・付け替えの詠唱・マウスを捕まえる・視点・音量（300の場合）の指紋', async () => {
    const all = await screenCases({ ...INV, ...ST, ...SC }, 300, fakeScreen()),
      has = (k) => all.includes(k),
      cases = all.split('\n').map((l) => JSON.parse(l)),
      calls = cases.flatMap((c) => c.calls),
      gs = new Set(calls.flatMap((c) => c.gs ?? []));
    // 場合が中身を通っているか：7つの関数が全部呼ばれ、マウスを捕まえる時の返し方の全部、音量を変える、マウスを放す、視点を保存する場合も通る
    expect(new Set(calls.map((c) => c.f)).size).toBe(7);
    expect(
      [
        '["rpl","throw"]',
        '["rpl","plain"]',
        '["rpl?","none"]',
        '["rpl","ok"]',
        '"setTargetAtTime"',
        '"exitPointerLock"',
        '"al_cam"',
      ].filter((k) => !has(k)),
    ).toEqual([]);
    // 頭の上の印は z・!・? の3つとも出る
    expect(['z', '!', '?'].filter((c) => !gs.has(G(c)))).toEqual([]);
    // 付け替え：詠唱を始める場合と、石碑のそばですぐ替わる場合（粒子が16増える）。両手を変えて閉じると詠唱になる場合。
    // 石碑のそばで、鈴の音を鳴らす場合（鳴らせる偽の Web Audio に、音の部品を作った記録が残る）
    const swaps = calls.filter((c) => c.f === 'startSwap' || (c.f === 'setInv' && !c.on));
    expect([
      calls.some((c) => c.f === 'startSwap' && c.swap),
      swaps.some((c) => c.grew === 16 && !c.swap),
      calls.some((c) => c.f === 'setInv' && !c.on && c.swap),
      cases.some((c) => c.calls.some((x) => x.grew === 16) && c.log.some((e) => e[1] === 'start')),
    ]).toEqual([true, true, true, true]);
    caseOut('screens-2', all);
    expect([fnv(all), all.length]).toEqual(['7254ffee', 763699]);
  });
});

describe('マウスを捕まえるのに失敗した時（lockFailed）', () => {
  // 失敗の返し方ごとに tryLock を n 回呼び、捕まえられないと決めたかと、案内の伝言の数を見る。lockedOnce は、このページで一度でも捕まえたか。
  // 伝言の一覧・ui・document は、終わったら元に戻す（document は Node には元々無い）
  const run = async (lock, lockedOnce, n = 2, escKey = false, unlockedAt = -1e9) => {
    const page = fakeScreen(),
      hadDoc = 'document' in globalThis,
      doc = globalThis.document,
      keep = { plFailed: ui.plFailed, lockedOnce: ui.lockedOnce, lockTries: ui.lockTries, escKey: ui.escKey, unlockedAt: ui.unlockedAt },
      msgs0 = msgs.splice(0);
    globalThis.document = page.document;
    try {
      Object.assign(ui, { plFailed: false, lockedOnce, lockTries: 0, escKey, unlockedAt });
      page.st.lock = lock;
      for (let i = 0; i < n; i++) {
        SC.tryLock();
        await new Promise((res) => setImmediate(res));
        // Promise の reject と pointerlockerror の両方が来るブラウザ（Chromium）の分
        SC.lockFailed();
      }
      return {
        plFailed: ui.plFailed,
        hints: msgs.filter((m) => m.html.includes('ドラッグして視点')).length,
        calls: page.log.filter((e) => e[0] === 'rpl').length,
        resume: page.log.filter((e) => e[1] === 'resume').length,
      };
    } finally {
      if (hadDoc) globalThis.document = doc;
      else delete globalThis.document;
      Object.assign(ui, keep);
      msgs.splice(0, msgs.length, ...msgs0);
    }
  };
  it('一度も捕まえていなければ、捕まえられないと決め、案内は1回だけ。それからは捕まえようとしない', async () => {
    expect(await run('reject', false)).toMatchObject({ plFailed: true, hints: 1, calls: 1 });
    expect(await run('throw', false)).toMatchObject({ plFailed: true, hints: 1, calls: 1 });
    expect(await run('none', false)).toMatchObject({ plFailed: true, hints: 1, calls: 0 });
  });
  it('一度でも捕まえていれば、2回続けて失敗しても決めず、次もまた捕まえようとする（Esc で外した直後に断られる時）', async () => {
    expect(await run('reject', true)).toMatchObject({ plFailed: false, hints: 0, calls: 2 });
    expect(await run('throw', true)).toMatchObject({ plFailed: false, hints: 0, calls: 2 });
  });
  it('一度でも捕まえていても、3回続けて失敗したら、捕まえられないと決め、案内を1回出す', async () => {
    expect(await run('reject', true, 4)).toMatchObject({ plFailed: true, hints: 1, calls: 3 });
    expect(await run('none', true, 4)).toMatchObject({ plFailed: true, hints: 1, calls: 0 });
  });
  it('外れてから1.5秒の間の失敗は数えない（何回断られても決めない）。断られるたびに「クリックで視点操作に戻る」を出し直す', async () => {
    const r = await run('reject', true, 5, false, performance.now());
    expect(r).toMatchObject({ plFailed: false, hints: 0, calls: 5 });
    expect(r.resume).toBeGreaterThanOrEqual(5);
  });
  it('Esc のキーを処理している間は、捕まえにいかない', async () => {
    expect(await run('ok', true, 2, true)).toMatchObject({ plFailed: false, hints: 0, calls: 0 });
  });
  it('終わったら、伝言の一覧と document を元に戻す', async () => {
    const before = [...msgs];
    await run('reject', false);
    expect([msgs, 'document' in globalThis]).toEqual([before, false]);
  });
  it('「クリックで視点操作に戻る」は、捕まえる遊び方で探索中なのにマウスが外れている時だけ出す', () => {
    const page = fakeScreen(),
      hadDoc = 'document' in globalThis,
      doc = globalThis.document,
      keep = { started: ui.started, lockedOnce: ui.lockedOnce, plFailed: ui.plFailed, locked: ui.locked, dead: adv.dead };
    globalThis.document = page.document;
    try {
      const shown = (st) => {
        Object.assign(ui, { started: true, lockedOnce: true, plFailed: false, locked: false, ...st });
        adv.dead = st.dead ?? false;
        SC.updateResume();
        const last = page.log.filter((e) => e[1] === 'resume').at(-1);
        return [SC.lockLost(), last && last[3]];
      };
      expect([
        shown({}),
        shown({ locked: true }),
        shown({ plFailed: true }),
        shown({ lockedOnce: false }),
        shown({ started: false }),
        shown({ dead: true }),
      ]).toEqual([
        [true, 'block'],
        [false, 'none'],
        [false, 'none'],
        [false, 'none'],
        [false, 'none'],
        [false, 'none'],
      ]);
    } finally {
      if (hadDoc) globalThis.document = doc;
      else delete globalThis.document;
      Object.assign(ui, { started: keep.started, lockedOnce: keep.lockedOnce, plFailed: keep.plFailed, locked: keep.locked });
      adv.dead = keep.dead;
    }
  });
  it('描く画面を押した時、lockLost の時だけ捕まえ直す（true）。そうでなければ何もしない（false）', () => {
    const page = fakeScreen(),
      hadDoc = 'document' in globalThis,
      doc = globalThis.document,
      keep = {
        started: ui.started,
        lockedOnce: ui.lockedOnce,
        plFailed: ui.plFailed,
        locked: ui.locked,
        lockTries: ui.lockTries,
        dead: adv.dead,
      };
    globalThis.document = page.document;
    page.st.lock = 'ok';
    try {
      const click = (st) => {
        Object.assign(ui, { started: true, lockedOnce: true, plFailed: false, locked: false, lockTries: 0, ...st });
        adv.dead = false;
        const n0 = page.log.filter((e) => e[0] === 'rpl').length;
        return [SC.relockClick(), page.log.filter((e) => e[0] === 'rpl').length - n0];
      };
      expect([click({}), click({ locked: true }), click({ plFailed: true }), click({ lockedOnce: false })]).toEqual([
        [true, 1],
        [false, 0],
        [false, 0],
        [false, 0],
      ]);
    } finally {
      if (hadDoc) globalThis.document = doc;
      else delete globalThis.document;
      Object.assign(ui, {
        started: keep.started,
        lockedOnce: keep.lockedOnce,
        plFailed: keep.plFailed,
        locked: keep.locked,
        lockTries: keep.lockTries,
      });
      adv.dead = keep.dead;
    }
  });
  it('マウスが外れた時にメニューを開くのは、探索中で、止まっている画面が開いていない時だけ', () => {
    const keys = ['started', 'locked', 'invOpen', 'menuOpen', 'dbgOpen', 'altarOpen', 'lvlOpen'],
      keep = Object.fromEntries(keys.map((k) => [k, ui[k]])),
      dead = adv.dead;
    try {
      const open = (st, was = true) => {
        Object.assign(ui, {
          started: true,
          locked: false,
          invOpen: false,
          menuOpen: false,
          dbgOpen: false,
          altarOpen: false,
          lvlOpen: false,
          ...st,
        });
        adv.dead = st.dead ?? false;
        return SC.menuOnUnlock(was);
      };
      expect([
        open({}),
        open({}, false),
        open({ locked: true }),
        open({ started: false }),
        open({ dead: true }),
        open({ invOpen: true }),
        open({ dbgOpen: true }),
        open({ altarOpen: true }),
        open({ lvlOpen: true }),
      ]).toEqual([true, false, false, false, false, false, false, false, false]);
    } finally {
      Object.assign(ui, keep);
      adv.dead = dead;
    }
  });
});
