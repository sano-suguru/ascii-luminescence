// PV の台本の決まり（tools/pv/script.mjs）の単体テスト：入れてある台本に誤りが無い・誤りを見つける・消す物の既定・字幕の出し入れ
import { describe, expect, it } from 'vitest';
import SCENES from '../../tools/pv/scenes.mjs';
import { captionAlpha, checkScene, checkScenes, ease, hideOf } from '../../tools/pv/script.mjs';

const base = { name: 'a', place: 'seed=1&depth=1', sec: 2 };
const one = (s) => checkScene({ ...base, ...s });

describe('台本', () => {
  it('入れてある台本（tools/pv/scenes.mjs）に誤りが無い', () => {
    expect(checkScenes(SCENES)).toEqual([]);
  });

  it('名前の重なり・長さ・場所の無い場面を止める', () => {
    expect(checkScenes([base, { ...base }])).toEqual(['a：name がほかの場面と重なる']);
    expect(one({ sec: 0 })).toEqual(['a：sec は正の数']);
    expect(one({ place: undefined })).toEqual(['a：place が無い（title でなければ要る）']);
    expect(one({ place: undefined, title: true })).toEqual([]);
  });

  it('置いていない生き物を、止める・的にする・カメラで見ることを止める', () => {
    expect(one({ setup: [['hold', 'x', {}]] })).toEqual(['a：hold の x は、前の summon で置いていない']);
    expect(one({ target: 'x' })).toEqual(['a：target の x は summon で置いていない']);
    expect(one({ cam: { from: { side: 1, back: 0, up: 1 }, to: { side: 1, back: 0, up: 1 }, at: 'target' } })).toEqual([
      'a：cam.at には target が要る',
    ]);
    const ok = { setup: [['summon', 'T', { ahead: 4, as: 'x' }]], target: 'x' };
    expect(one({ ...ok, cam: { orbit: { r: 5, a0: 0, a1: 30, up: 2 }, at: 'target' }, events: [[0.5, 'strike', 'R']] })).toEqual([]);
  });

  it('知らない物と、場面の外の時刻を止める', () => {
    expect(one({ setup: [['fly']] })).toEqual(['a：setup に知らない物：["fly"]']);
    expect(one({ events: [[0.5, 'jump']] })).toEqual(['a：events に知らない物：[0.5,"jump"]']);
    expect(one({ events: [[3, 'key', 'Tab']] })).toEqual(['a：events の時刻 3 が場面の外']);
    expect(one({ events: [[0.5, 'click', {}]] })).toEqual(['a：click には {bag} か {slot} が要る']);
    expect(one({ events: [[0.5, 'strike', 'R']] })).toEqual(['a：strike には target が要る']);
    expect(one({ hide: ['sky'], show: ['map'], expect: { fun: 1 } })).toEqual([
      'a：hide に知らない物：sky',
      'a：show に知らない物：map',
      'a：expect に知らない物：fun',
    ]);
  });

  it('消す物の既定は、画面の表示と、カメラのある場面の手元の武器', () => {
    expect([...hideOf(base)]).toEqual(['hud']);
    expect([...hideOf({ ...base, cam: {} })]).toEqual(['hud', 'hands']);
    expect([...hideOf({ ...base, cam: {}, hide: ['others'] })]).toEqual(['others']);
  });

  it('字幕は出だしと終わりの 12 フレームで出し入れし、カメラの動きは端で止まる', () => {
    expect(captionAlpha(9, 90)).toBe(0);
    expect(captionAlpha(21, 90)).toBe(1);
    expect(captionAlpha(84, 90)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
  });
});
