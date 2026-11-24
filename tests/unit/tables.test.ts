// src/lib/ の表と小さな道具の単体テスト（world・light・runes・progress・hands・math・color、段階7a で移した title・glyphs・shaders・hud・names・sound など）
import { lookup, nth } from '../../src/lib/array.ts';
import { describe, expect, it } from 'vitest';
import { css } from '../../src/lib/color.ts';
import * as GL from '../../src/lib/glyphs.ts';
import { VM_MIRROR, vmGlyph, vmGlyphS } from '../../src/lib/hands.ts';
import * as HUD from '../../src/lib/hud.ts';
import { LANTERN, type Light, computeVis, topLights } from '../../src/lib/light.ts';
import { angDiff, flowW, jagged, lerpAngle, mCenter, sstep, turnDir } from '../../src/lib/math.ts';
import * as NM from '../../src/lib/names.ts';
import { META_DEF, UNLOCKS, expNeed, expOf } from '../../src/lib/progress.ts';
import { roll } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import * as R from '../../src/lib/runes.ts';
import * as SH from '../../src/lib/shaders.ts';
import * as SND from '../../src/lib/sound.ts';
import { stratumAtDepth } from '../../src/lib/strata.ts';
import * as TI from '../../src/lib/title.ts';
import * as W from '../../src/lib/world.ts';

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
};
const fingerprint = (v: unknown): [string, number] => {
  const s = JSON.stringify(v);
  return [fnv(s), s.length];
};

// どれも、TypeScript に移す前の実装で出した値
describe('移す前と同じ値', () => {
  it('迷宮の大きさ・タイル・支道・異界・岩・層ごとの変化', () => {
    const v = [
      W.CELL,
      W.BASE_H,
      W.EYE,
      W.MW,
      W.MH,
      W.NCELL,
      W.CH_D,
      W.TW,
      W.TF,
      W.TP,
      W.TC,
      W.TX,
      W.NSL,
      W.NDL,
      W.PR,
      W.D4,
      W.CHUNK,
      W.CXN,
      W.CZN,
      W.BRANCHES,
      W.REALMS,
      W.ROCKS,
      W.VEIN_COL,
      W.VEIN_NAME,
      W.FOGS,
      W.RUIN_KIND_MSG,
      W.FORT_KIND_MSG,
      W.PROPHECIES,
      W.VAULT_WALL_H,
      [0, 1, 2, 3, 4, 5].map(W.blocksWalk),
      Array.from({ length: 14 }, (_, d) => W.depthProfile(d)),
    ];
    expect(fingerprint(v)).toEqual(['bbeb36b3', 6423]);
  });
  it('特性の値と説明・反応・装備の画面の括弧', () => {
    const texts: string[] = [];
    for (const k of Object.keys(R.TRAIT_V)) for (const lv of R.TRAIT_LVS) texts.push(lookup(R.TD, k)(lv, '矢'));
    for (const [, ts] of Object.entries(R.TRAITS))
      for (const t of Object.values(ts)) for (const lv of R.TRAIT_LVS) texts.push(t.name + t.d(lv));
    const v = [
      R.TRAIT_V,
      texts,
      R.REACT,
      R.TIER_COL,
      R.ELEM_POW,
      R.CAT_BR,
      R.CAT_NAME,
      R.SLOT_MAX,
      R.TWO_SLOTS,
      R.RUNE_FONT,
      ['atk', 'body', 'rune', 'elem', 'zzz'].map((c) => R.emptyChip(c, 'x')),
    ];
    expect(fingerprint(v)).toEqual(['395df698', 8371]);
  });
  it('経験・伝承・解放', () => {
    expect(fingerprint([META_DEF, UNLOCKS, Array.from({ length: 12 }, (_, n) => expNeed(n))])).toEqual(['c3b913b9', 1300]);
  });
  it('灯りから見えるマスと、点を照らす灯り（シードで決まる迷宮で）', () => {
    const rnd = mulberry32(5),
      tile = new Uint8Array(W.NCELL).map(() => nth([0, 1, 1, 1, 2, 3], Math.floor(rnd() * 6)));
    const lights: Light[] = Array.from({ length: 10 }, () => {
      const L = { x: rnd() * 140, y: rnd() * 3, z: rnd() * 92, rad: 2 + rnd() * 14 };
      return { ...L, vis: computeVis(L, tile) };
    });
    const tops: number[][] = [];
    for (let q = 0; q < 200; q++) {
      const I = new Int32Array(3),
        Wt = new Float32Array(3),
        x = rnd() * 140,
        y = rnd() * 3,
        z = rnd() * 92;
      topLights(lights, x, y, z, q % 2 ? rnd() - 0.5 : null, 0.3, 0.2, q % 3 ? Math.floor(rnd() * W.NCELL) : -1, I, Wt, 0);
      tops.push(Array.from(I), Array.from(Wt));
    }
    expect(fingerprint([lights.map((L) => Array.from(L.vis).join('')), tops])).toEqual(['ab136769', 36222]);
  });
});

describe('特性とルーン', () => {
  it('武器に無い特性の名前は、種類の名前のまま。段が無ければ 0', () => {
    expect(R.trName('bolt', { k: 'pierce', lv: 1 })).toBe('貫き');
    expect(R.trName('bolt', { k: 'pull', lv: 1 })).toBe('pull');
    expect(R.trName('nope', { k: 'count', lv: 1 })).toBe('count');
    expect(R.TL(null, 'count')).toBe(0);
    expect(R.tv({ tr: { range: 2 } }, 'range')).toBe(1.35);
  });
  it('手のルーンは、使える枠の分だけ数え、空きを除く。保存の形は種類・強い印・特性だけ', () => {
    const H = {
      slots: [{ uid: 0, type: 'fire' }, null, { uid: 0, type: 'fire' }, { uid: 0, type: 'ice' }],
      slotN: 3,
    };
    expect(R.handRunes(H).map((r) => r.type)).toEqual(['fire', 'fire']);
    expect(R.elemCount(H, 'fire')).toBe(2);
    expect(R.elemCount({}, 'fire')).toBe(0);
    expect(R.serRune({ uid: 0, type: 'orb', traits: [{ k: 'speed', lv: 5 }], named: 'x' })).toEqual({
      type: 'orb',
      strong: false,
      traits: [{ k: 'speed', lv: 5 }],
    });
  });
  it('武器の名前の色：特性が無ければ無し、段5か名のある武器は金', () => {
    expect(R.weaponCol({ uid: 0, type: 'blade' })).toBe('');
    expect(R.weaponCol({ uid: 0, type: 'blade', traits: [{ k: 'range', lv: 3 }] })).toBe('#9fdcf0');
    expect(R.weaponCol({ uid: 0, type: 'blade', traits: [{ k: 'range', lv: 5 }] })).toBe(css([1.0, 0.82, 0.3]));
  });
});

describe('経験', () => {
  it('的・小さな生き物は 0、強い個体は3倍、主は10倍、上限 60', () => {
    expect(expOf({ ty: { dummy: true } })).toBe(0);
    expect(expOf({ ty: {}, maxHp: 9 })).toBe(2);
    expect(expOf({ ty: {}, maxHp: 9, elite: true })).toBe(6);
    expect(expOf({ ty: {}, maxHp: 9000, key: 'lord' })).toBe(60);
  });
});

describe('小さな道具', () => {
  it('角度：差は -PI から PI、近い向きに回る', () => {
    expect(angDiff(0.1, Math.PI * 2)).toBeCloseTo(0.1);
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
    const d = turnDir([1, 0.5, 0], Math.PI / 2);
    expect(d[0]).toBeCloseTo(0);
    expect(d[1]).toBe(0.5);
    expect(d[2]).toBeCloseTo(1);
    expect([sstep(0, 1, -1), sstep(0, 1, 0.5), sstep(0, 1, 2)]).toEqual([0, 0.5, 1]);
  });
  it('線の文字：横・斜め・縦。左右を入れ替えた文字', () => {
    expect([vmGlyph(1, 0), vmGlyph(1, 1), vmGlyph(0, 1), vmGlyph(-1, 1)]).toEqual(['-', '/', '|', '\\']);
    expect(vmGlyphS([0, 0, 1], [1, 1, 1])).toBe('/');
    expect(VM_MIRROR['/']).toBe('\\');
  });
  it('色：少し明るくして rgb() にする', () => {
    expect(css([0, 0, 0])).toBe('rgb(38,38,38)');
    expect(css([1, 1, 1])).toBe('rgb(255,255,255)');
  });
});

// 段階7a（後半）で移した物。どれも、移す前の実装で出した値（シェーダーの文は1字も違わないこと）
describe('段階7a（後半）で移した物：移す前と同じ値', () => {
  const asJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x: unknown) => (x instanceof Set ? ['Set', ...x] : x)));
  it('タイトル・文字の並び・シェーダーの文・描画の入れ物の大きさ', () => {
    const v = [
      TI.TITLE_LINES,
      TI.LOGO_ART,
      GL.RUNESET,
      GL.SWAPSET,
      GL.WG,
      GL.RAMP_CH,
      SH.GLSL_COMMON,
      SH.STATIC_VS,
      SH.WATER_VS,
      SH.WATER_FS,
      SH.GLYPH_FS,
      SH.DYN_VS,
      SH.PT_VS,
      SH.PT_FS,
      SH.DYN_MAX,
      SH.DUST_N,
      SH.GAS_N,
      SH.P_MAX,
      SH.PT_TOTAL,
      SH.P0,
    ];
    expect(fingerprint(v)).toEqual(['acdcd3', 12613]);
  });
  it('表示の大きさ・名前と説明・音・ルーンの表', () => {
    const v = asJson([
      HUD.LIGHT_NAMES,
      HUD.LIGHT_COLS,
      HUD.MARK_H,
      HUD.MMC,
      HUD.MMR,
      HUD.MCW,
      HUD.MCH,
      HUD.MPAD,
      HUD.PACK_W,
      HUD.PACK_SLOT,
      HUD.BAG_LINES,
      HUD.ALTAR_W,
      NM.FIX_NAMES,
      NM.DECO_NAMES,
      NM.DECO_K,
      NM.TRAP_INFO,
      NM.LEGEND_KINDS,
      NM.LEGEND_ORDER,
      NM.BRANCH_HINT,
      NM.LORD_GAL,
      NM.DUMMY_KINDS,
      NM.AVATAR_TY,
      SND.SND_LV,
      SND.SND_NAME,
      SND.VOWELS,
      SND.CHANT_STEPS,
      R.RALLY_FROM,
      R.WEAPON,
      R.SLEEP_MULT,
      W.FIRE_TYPES,
      LANTERN,
    ]);
    expect(fingerprint(v)).toEqual(['883558a6', 3069]);
  });
  it('小さな関数（たくさんの入力で）', () => {
    const out: unknown[] = [];
    const r = mulberry32(7);
    const saved = Math.random;
    Math.random = mulberry32(11);
    try {
      for (let s = 0; s < 200; s++) {
        const x = (r() - 0.5) * 40,
          p3 = (): [number, number, number] => [r() * 9, r() * 9, r() * 9];
        out.push(
          flowW(x),
          W.cpos(Math.floor(r() * W.NCELL)),
          HUD.tone(r() * 3),
          roll(s % 7, 10 + (s % 5)),
          stratumAtDepth(s % 18)?.k ?? null,
          mCenter({ x, y: r(), z: r(), ty: { scale: r() * 3 } }),
          jagged(p3(), p3(), r()),
          NM.mname({ ty: { col: p3(), name: '名', ch: 'a' } }),
          NM.lookLine('*', p3(), 'n', 'd'),
          R.sp_elem([null, undefined, {}, { sp: null }, { sp: {} }, { sp: { elem: 'fire' } }][s % 6]),
        );
      }
      for (const a of ['fire', 'ice', 'poison', 'thunder', 'blade'])
        for (const b of ['fire', 'ice', 'poison', 'thunder', 'blade']) out.push(R.reactionOf(a, b));
    } finally {
      Math.random = saved;
    }
    expect(fingerprint(out)).toEqual(['747f2e3b', 199889]);
  });
});
