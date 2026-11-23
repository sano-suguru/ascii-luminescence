// 階に、歩いて行けない所が無いか（調べ方は tests/reach.mjs。ブラウザの tests/levels.mjs と同じ決まり）
import { beforeAll, describe, expect, it } from 'vitest';
import { PLACES, gen, isFinal, loadEnv } from '../gen-places.mjs';
import { reachProblems } from '../reach.mjs';

let env;
beforeAll(async () => {
  env = await loadEnv();
});

describe('歩いて行けるか', () => {
  it('歩いて行けるかの調べ方：壁や深い水の向こうの物を見つける（作った小さな階で）', () => {
    // 70 マス×3 行。1 行目だけが床で、x=5 が壁、x=8 が深い水
    const tile = new Uint8Array(210),
      liquid = new Uint8Array(210);
    for (let x = 0; x < 70; x++) tile[70 + x] = 1;
    tile[75] = 0;
    liquid[78] = 2;
    const L = { tile, liquid, start: 71, stairs: 74, bstairs: null, portal: null, upstairs: -1, items: [{ kind: 'rune', i: 77 }] };
    expect(reachProblems(L, false)).toEqual(['物（rune） @7,1']);
    expect(reachProblems({ ...L, stairs: 80, items: [] }, false)).toEqual(['階段 @10,1']);
    expect(reachProblems({ ...L, stairs: -1, items: [] }, false)).toEqual(['階段が無い']);
    expect(reachProblems({ ...L, stairs: -1, items: [] }, true)).toEqual([]);
  });
  // ブラウザの tests/levels.mjs（20 シード）と同じ決まり。ここでは少ないシードで、編集のたびに確かめる
  it('始まりの場所から、階段・入口・門・置かれた物まで歩いて行ける（5 シード）', () => {
    const fails = [];
    for (const seed of [3, 58, 777, 4096, 31337])
      for (const pl of PLACES) {
        const missing = reachProblems(gen(env, seed, pl, seed).level, isFinal(pl));
        if (missing.length) fails.push(`シード ${seed} ${JSON.stringify(pl)}：${missing.join('、')}`);
      }
    expect(fails).toEqual([]);
  }, 30000);
});
