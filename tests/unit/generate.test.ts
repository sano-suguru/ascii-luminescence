// src/lib/generate.ts（迷宮の生成）の単体テスト。Node で動くので、ブラウザの「全部の階」のテストより速い。
// 共通部分（全部の場所・gen）は gen-places.ts。歩いて行けるかは reach.test.ts（別のファイルにして、並べて走らせる）
import { beforeAll, describe, expect, it } from 'vitest';
import type { GenEnv, GenResult } from '../../src/lib/generate.ts';
import { PLACES, type Place, gen as gen0, loadEnv } from './gen-places.ts';

let env: GenEnv;
beforeAll(async () => {
  env = await loadEnv();
});
const gen = (seed: number, place: Place, runSeed?: number): GenResult => gen0(env, seed, place, runSeed);
// 階を文字列にする。ルーンの番号 uid は、全体の数え上げなので除く。日本語の文（伝言・名前・碑文など）も、言い回しを直すたびに
// 指紋が変わらないように、印に置き換える（かなを含むか、漢字が2字以上の文字列。1字の漢字は、画面に描く字（字形）のことがあるので残す）。
// オブジェクトの欄は名前の順に並べ直す。欄の並び（部屋を作る時にどの欄から書いたか など）は迷宮に関係しないので、指紋も並びによらない
const PROSE = /[\u3040-\u30ff]|[\u4e00-\u9fff].*[\u4e00-\u9fff]/u;
/** 型付き配列（Uint8Array など。DataView は除く） */
const isTyped = (v: unknown): v is ArrayLike<number> => ArrayBuffer.isView(v) && !(v instanceof DataView);
/** ふつうのオブジェクト（配列・型付き配列・Map・Set 以外） */
const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !ArrayBuffer.isView(v) && !(v instanceof Map) && !(v instanceof Set);
const sortKeys = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]]),
  );
const text = (r: unknown): string =>
  JSON.stringify(r, (k: string, v: unknown): unknown =>
    k === 'uid'
      ? 0
      : typeof v === 'string' && PROSE.test(v)
        ? '文'
        : isTyped(v)
          ? Array.from(v)
          : v instanceof Map
            ? [...v]
            : v instanceof Set
              ? [...v]
              : isPlain(v)
                ? sortKeys(v)
                : v,
  );
const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
};

describe('迷宮の生成', () => {
  // ブラウザで続けて生成すると、シード 777 の蛇の穴 2 階などで、同じシードなのに違う迷宮になることがあった。生成に隠れた入力が無いことを確かめる
  it('同じ入力なら、同じ迷宮になる（ほかの階を間に挟んでも、順番を変えても）', () => {
    const first = PLACES.map((pl) => text(gen(777, pl)));
    for (const [i, pl] of [...PLACES.entries()].reverse()) expect(text(gen(777, pl)), `場所 ${JSON.stringify(pl)}`).toBe(first[i]);
  }, 30000);
  it('生き物の表に書き込まない（その階の主と忘れられた獣は、結果として返す）', () => {
    const before = JSON.stringify(env.MTYPES);
    const lords = PLACES.filter((p) => p.branch && p.branch.lvl === p.branch.len).map((p) => gen(5, p));
    expect(JSON.stringify(env.MTYPES)).toBe(before);
    expect(lords.every((r) => r.lordType && r.lordType.boss)).toBe(true);
    expect(PLACES.some((p) => gen(5, p).beastType)).toBe(true);
  });
  it('どの階にも、始まりの場所と下り階段がある', () => {
    for (const [i, pl] of PLACES.entries()) {
      const { level } = gen(11 + i, pl);
      expect(level.tile.length).toBe(level.liquid.length);
      expect(level.start).toBeGreaterThanOrEqual(0);
      expect(level.stairs).toBeGreaterThanOrEqual(0);
    }
  });
  // 全部の場所の生成の指紋（日本語の文は除き、欄の並びによらない）。ブラウザ（Chromium）の __test.gen でも同じ値になる。
  // 生成を変えると変わる。意図して変えた時は、ブラウザでも同じ値になることを確かめてから作り直す
  it('今の迷宮と同じになる（全部の場所の指紋）', () => {
    let all = '';
    for (const pl of PLACES) all += text(gen(202, pl));
    expect([fnv(all), all.length]).toEqual(['85351adf', 20044570]);
  }, 30000);
});
