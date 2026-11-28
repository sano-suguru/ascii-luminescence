// タイトルの画面（src/lib/intro.ts）・入力（src/lib/input.ts）・開発用の命令（src/lib/debug.ts）の単体テスト。
// 指紋は、intro-cases.mjs の場合の結果。
// ここで確かめない処理は、下の vi.mock で、呼んだ時の記録（globalThis.__alMock.log）だけ取る物にする（返す値は __alMock.ret）。
// 動きを意図して変えた時や、場合の入力を変えた時は、変わり方を確かめてから作り直す（何が変わったかは、コミットと PR に書く）。
// 開発用の命令の場合は Node で本物の迷宮を生成するので、迷宮の生成を変えると、この指紋も変わる。
// テストを .mjs で書くのは、偽の画面の部品を、本物の型に合わせられないため。
import { describe, expect, it, vi } from 'vitest';
import { dbg, dbgUrl, initDbg, setDbg } from '../../src/lib/debug.ts';
import { initInput, initPointer, nextBuild, toggleMenu, togglePack } from '../../src/lib/input.ts';
import { buildIntroPanel, initIntro, redrawIntroLater } from '../../src/lib/intro.ts';
import { caseOut } from './case-out.mjs';
import { fnv } from './fight-cases.mjs';
import { NAMES, debugCases, introCases } from './intro-cases.mjs';

// ---------------------------------------------------------------- 入れ替える処理（呼んだ記録を取る。返す値は M.ret）
const { M, rec } = vi.hoisted(() => {
  const M = (globalThis.__alMock ??= { log: [], ret: {} });
  const rec =
    (name, ret = () => undefined) =>
    (...a) => {
      M.log.push([name, ...a.map((x) => (x && typeof x === 'object' ? (x.type ?? x.key ?? 'obj') : x))]);
      return ret(...a);
    };
  return { M, rec };
});
vi.mock('../../src/lib/levels.ts', async (orig) => ({ ...(await orig()), newLevel: rec('newLevel'), showStratum: rec('showStratum') }));
vi.mock('../../src/lib/audio.ts', async (orig) => ({ ...(await orig()), sndInit: rec('sndInit'), sChime: rec('sChime') }));
vi.mock('../../src/lib/auto.ts', async (orig) => ({
  ...(await orig()),
  canOfferAuto: rec('canOfferAuto', () => !!M.ret.canOfferAuto),
  startAuto: rec('startAuto'),
}));
vi.mock('../../src/lib/gallery.ts', async (orig) => {
  const o = await orig(),
    names = [
      'openBestiary',
      'openRange',
      'showBeast',
      'galleryReset',
      'galleryWheel',
      'galleryView',
      'galleryDrag',
      'renderGallery',
      'galleryZoom',
      'galleryHold',
    ];
  return { ...o, ...Object.fromEntries(names.map((n) => [n, rec(n)])) };
});
vi.mock('../../src/lib/layout.ts', async (orig) => ({ ...(await orig()), initFitIntro: rec('initFitIntro') }));
vi.mock('../../src/lib/screens.ts', async (orig) => ({
  ...(await orig()),
  tryLock: rec('tryLock'),
  updateResume: rec('updateResume'),
  relockClick: rec('relockClick', () => !!M.ret.relockClick),
  sndToggle: rec('sndToggle'),
  lockFailed: rec('lockFailed'),
}));
vi.mock('../../src/lib/took.ts', async (orig) => ({ ...(await orig()), took: rec('took') }));
vi.mock('../../src/lib/log.ts', async (orig) => ({ ...(await orig()), msg: rec('msg') }));
vi.mock('../../src/lib/touch.ts', async (orig) => ({
  ...(await orig()),
  homeHint: rec('homeHint', () => !!M.ret.homeHint),
  initTouch: rec('initTouch', (h) => void (M.touchHooks = h)),
}));
vi.mock('../../src/lib/touchpad.ts', async (orig) => ({
  ...(await orig()),
  initTouchpad: rec('initTouchpad', (h) => void (M.padHooks = h)),
  releaseTouch: rec('releaseTouch'),
}));
vi.mock('../../src/lib/status.ts', async (orig) => {
  const o = await orig(),
    names = ['setHelp', 'renderStatus', 'cycleUi', 'renderChron', 'flashHint'];
  return { ...o, ...Object.fromEntries(names.map((n) => [n, rec(n)])) };
});
vi.mock('../../src/lib/menu.ts', async (orig) => {
  const { ui } = await import('../../src/lib/state.ts');
  return { ...(await orig()), setMenu: rec('setMenu', (on) => void (ui.menuOpen = on)), returnToTitle: rec('returnToTitle') };
});
vi.mock('../../src/lib/inventory.ts', async (orig) => {
  const { ui } = await import('../../src/lib/state.ts');
  return {
    ...(await orig()),
    setInv: rec('setInv', (on) => void (ui.invOpen = on)),
    applyBuild: rec('applyBuild', () => !!M.ret.applyBuild),
    startSwap: rec('startSwap'),
  };
});
vi.mock('../../src/lib/panels.ts', async (orig) => {
  const { ui } = await import('../../src/lib/state.ts');
  return { ...(await orig()), closeAltar: rec('closeAltar', () => void (ui.altarOpen = false)) };
});
vi.mock('../../src/lib/results.ts', async (orig) => ({ ...(await orig()), startNewRun: rec('startNewRun') }));
vi.mock('../../src/lib/chant.ts', async (orig) => ({
  ...(await orig()),
  beginCast: rec('beginCast'),
  releaseCast: rec('releaseCast'),
  startRoll: rec('startRoll'),
}));
vi.mock('../../src/lib/hotbar.ts', async (orig) => ({
  ...(await orig()),
  buildsHave: rec('buildsHave', () => M.ret.buildsHave ?? []),
  renderHotbar: rec('renderHotbar'),
}));
vi.mock('../../src/lib/gear.ts', async (orig) => ({
  ...(await orig()),
  snapHands: rec('snapHands', () => 'snap'),
  resetRunes: rec('resetRunes'),
}));
vi.mock('../../src/lib/diag.ts', async (orig) => ({
  ...(await orig()),
  initDiag: rec('initDiag', async (onOwner) => {
    if (M.ret.owner) onOwner();
  }),
}));
vi.mock('../../src/lib/save.ts', async (orig) => {
  const { saved } = await import('../../src/lib/state.ts');
  return { ...(await orig()), saveMeta: rec('saveMeta', () => void M.log.push(['META', JSON.stringify(saved.META)])) };
});
vi.mock('../../src/lib/combat.ts', async (orig) => {
  const { here } = await import('../../src/lib/state.ts');
  return {
    ...(await orig()),
    damageMonster: (m, n, why) => (M.log.push(['damageMonster', here.monsters.indexOf(m), n, why]), (m.dead = true)),
    gainExp: rec('gainExp'),
    hurtPlayer: rec('hurtPlayer'),
  };
});
vi.mock('../../src/lib/pickup.ts', async (orig) => ({ ...(await orig()), openSlot: rec('openSlot') }));
vi.mock('../../src/lib/altars.ts', async (orig) => ({ ...(await orig()), takeRune: rec('takeRune') }));
vi.mock('../../src/lib/legend.ts', async (orig) => ({ ...(await orig()), getLegend: rec('getLegend', () => M.ret.legend ?? null) }));
vi.mock('../../src/lib/aim.ts', async (orig) => {
  const { player } = await import('../../src/lib/state.ts');
  return { ...(await orig()), aimOrigin: () => [player.x, 1.5, player.z] };
});

const F = {
  initIntro,
  buildIntroPanel,
  redrawIntroLater,
  initPointer,
  initInput,
  nextBuild,
  togglePack,
  toggleMenu,
  initDbg,
  setDbg,
  dbgUrl,
  dbg,
};
const SEEDS = 16;

describe('指紋', () => {
  it('タイトルの画面と入力（16の場合）の指紋', async () => {
    const all = await introCases(F, SEEDS),
      lines = all.split('\n'),
      calls = lines.flatMap((l) => JSON.parse(l).calls),
      names = new Set(calls.map((c) => c.name.split(' ')[0]));
    // 場合が中身を通っているか：全部の場合が迷宮に入り、タイトルのボタンを押し、キーとマウスの処理を通る。例外は無い
    expect(lines.length).toBe(SEEDS);
    for (const n of [
      'initIntro',
      'enter',
      'click',
      'redrawIntroLater',
      'buildIntroPanel',
      'initPointer',
      'initInput',
      'keydown',
      'mousedown',
      'wheel',
      'touch',
    ])
      expect(names, n).toContain(n);
    expect(calls.filter((c) => c.threw).map((c) => `${c.name}:${c.threw}`)).toEqual([]);
    expect(calls.filter((c) => c.name === 'enter' && c.mock.includes('took')).length).toBeGreaterThan(5);
    expect(calls.filter((c) => c.mock.includes('setDbg') || c.dom.includes('dbgp')).length).toBeGreaterThan(0);
    caseOut('intro', all);
    expect([fnv(all), all.length]).toEqual(['db31bf91', 3183958]);
  }, 120000);
  it('開発用の命令（8の場合）の指紋', async () => {
    const all = await debugCases(F, 8),
      calls = all.split('\n').flatMap((l) => JSON.parse(l).calls);
    for (const n of NAMES.filter((n) => ['initDbg', 'setDbg', 'dbgUrl'].includes(n)))
      expect(
        calls.some((c) => c.name.startsWith(n)),
        n,
      ).toBe(true);
    expect(calls.filter((c) => c.threw).map((c) => `${c.name}:${c.threw}`)).toEqual([]);
    caseOut('debug', all);
    expect([fnv(all), all.length]).toEqual(['93baf1a9', 1127955]);
  }, 120000);
});
