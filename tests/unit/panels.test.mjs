// レベルアップ・祭壇・メニューのパネル（src/lib/panels.ts・src/lib/menu.ts）と命の一歩 updateLife（src/lib/combat.ts）の単体テスト。
// 指紋は、panels-cases.mjs の場合の結果。今の動き（魔導書の印は操作の案内・年代記で閉じる。レベルアップの説明は5行）の値。
// 場合は、新しい関数をわざと1か所変える（護符を選ぶ割合・開いてすぐのクリックを選ばない間・祭壇が開く距離・確かめ待ちが戻る間・タイトルに戻る深さ・閉じた祭壇の記録・
// 傷の光りが薄まる速さ）と、違いが出ることを確かめてある。
// 動きを意図して変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 階は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる（その時は generate.test.ts の指紋と一緒に作り直す）。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
import { describe, expect, it, vi } from 'vitest';
import { ui } from '../../src/lib/state.ts';
import { fnv } from './fight-cases.mjs';
import { NAMES, panelCases, panelDom, panelText } from './panels-cases.mjs';
import { swapGlobals } from './ui-cases.mjs';
import { caseOut } from './case-out.mjs';

// ここで移さない重い処理は、呼んだ時の記録だけ取る（新しい階・新しい探索・装備の画面の開け閉め。どれも古い関数と新しい関数の両方から、同じ入れ替えた物が呼ばれる）
const mocked = vi.hoisted(() => []);
vi.mock('../../src/lib/levels.ts', async (orig) => {
  const { here, adv, ui: u } = await import('../../src/lib/state.ts');
  return {
    ...(await orig()),
    newLevel: () => mocked.push(['newLevel', here.depth, adv.runSeed, u.started]),
    newRun: () => mocked.push(['newRun', here.depth, u.started]),
  };
});
vi.mock('../../src/lib/inventory.ts', async (orig) => {
  const { ui: u } = await import('../../src/lib/state.ts');
  return { ...(await orig()), setInv: (on) => (mocked.push(['setInv', on]), (u.invOpen = on)) };
});

const SEEDS = 24;
// 関数を返す（ui は panelCases が場合ごとに初めの値に戻す。ここでは、タイトルの画面の部品を入れ直す）
const makeF = async () => {
  const P = await import('../../src/lib/panels.ts'),
    M = await import('../../src/lib/menu.ts'),
    C = await import('../../src/lib/combat.ts');
  ui.introEl = document.getElementById('intro');
  return { ...P, ...M, updateLife: C.updateLife };
};

describe('移す前と同じ', () => {
  it(`レベルアップ・祭壇・メニュー・命の一歩（${SEEDS}の場合）の指紋`, { timeout: 120000 }, async () => {
    // モジュールを、場合の前に読んでおく（初めて読む時に、モジュールの一番外が見た目の乱数を引くことがあるため）
    await Promise.all([import('../../src/lib/panels.ts'), import('../../src/lib/menu.ts'), import('../../src/lib/combat.ts')]);
    const all = await panelCases(makeF, SEEDS, panelDom(), mocked),
      body = panelText(all),
      calls = all.flatMap((c) => c.calls);
    caseOut('panels', body);
    expect([fnv(body), body.length]).toEqual(['7a861a72', 1522996]);
    // 場合が中身を通っているか：移した関数が全部呼ばれ、どれも止まらず、待たせた処理も止まらない
    expect(new Set(calls.map((c) => c.name).filter((n) => NAMES.includes(n)))).toEqual(new Set(NAMES));
    expect(calls.filter((c) => c.threw).map((c) => [c.name, c.threw])).toEqual([]);
    expect(all.every((c) => c.timers === 0)).toBe(true);
  });
});

describe('魔導書', () => {
  it('操作の案内・年代記を出した後でも、メニューの「魔導書」を1回押すと魔導書が出る', async () => {
    const M = await import('../../src/lib/menu.ts'),
      S = await import('../../src/lib/status.ts'),
      page = panelDom(),
      keep = { ...ui },
      restore = swapGlobals({ document: page.document, performance: { now: () => 0 } });
    try {
      const help = () => page.document.getElementById('help'),
        shown = () => !help().classList.contains('off') && help().innerHTML.includes('魔導書');
      const before = {
        メニューの操作の案内: () => M.menuAct('help'),
        メニューの年代記: () => M.menuAct('chron'),
        '? キーの操作の案内': () => S.setHelp(true),
        '案内を消す（タイトルに戻る時など）': () => S.setHelp(false),
      };
      for (const [name, f] of Object.entries(before)) {
        Object.assign(ui, { started: true, touch: false, helpOn: false, chronOn: false, bookOn: false });
        M.menuAct('book');
        expect(shown(), `${name}の前`).toBe(true);
        f();
        M.menuAct('book');
        expect(shown(), `${name}の後`).toBe(true);
      }
    } finally {
      restore();
      Object.assign(ui, keep);
    }
  });
});
