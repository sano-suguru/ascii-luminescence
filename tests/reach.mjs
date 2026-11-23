// 階に、歩いて行けない所が無いかを調べる（tests/levels.mjs のブラウザのテストと、tests/unit/generate.test.mjs の Node のテストが使う）。
//   歩けるマス＝床（タイル 1）で、深い水（液体 2）でも溶岩（液体 3）でもない。上下左右。ゲームの mainPathAltars の bfs と同じ決まり
//   スタートから、階段・支道の入口・異界の門・戻りの階段・置かれた物まで行けること。目印のマスそのものが歩けなくても（柱や台）、隣まで行ければよい
const W = 70; // MW

// L：生成した階（tile・liquid・start・stairs・bstairs・portal・upstairs・items）。final：最深部か（階段が無くてよい）。行けない物の説明の配列を返す
export function reachProblems(L, final) {
  const N = L.tile.length,
    ok = (i) => i >= 0 && i < N && L.tile[i] === 1 && L.liquid[i] !== 2 && L.liquid[i] !== 3;
  // 上下左右の隣（左右は行の端で回り込まない）
  const nb = (c) => [c % W > 0 ? c - 1 : -1, c % W < W - 1 ? c + 1 : -1, c - W, c + W].filter((j) => j >= 0 && j < N);
  const d = new Int32Array(N).fill(-1),
    q = [L.start];
  d[L.start] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const j of nb(c)) {
      if (ok(j) && d[j] < 0) {
        d[j] = d[c] + 1;
        q.push(j);
      }
    }
  }
  const reach = (i) => d[i] >= 0 || nb(i).some((j) => d[j] >= 0);
  const goals = [];
  if (L.stairs >= 0) goals.push(['階段', L.stairs]);
  if (L.bstairs) goals.push(['支道の入口', L.bstairs.cell]);
  if (L.portal) goals.push(['異界の門', L.portal.cell]);
  if (L.upstairs >= 0) goals.push(['戻りの階段', L.upstairs]);
  for (const it of L.items) goals.push([`物（${it.kind}）`, it.i]);
  const missing = goals.filter(([, i]) => !reach(i)).map(([k, i]) => `${k} @${i % W},${(i / W) | 0}`);
  if (!ok(L.start)) missing.unshift('スタートが歩けないマス');
  if (L.stairs < 0 && !final && !L.bstairs) missing.push('階段が無い');
  return missing;
}

// ブラウザから Node へ渡す、調べるのに要る所だけ。タイルと液体は、1マス1文字の文字列に詰める（数の配列のままだと、渡すのが遅い）。
// ページの中で動かすので、外の名前を使わない
export const reachPart = (L) => {
  const pack = (a) => {
    let s = '';
    for (let i = 0; i < a.length; i += 4096) s += String.fromCharCode(...a.subarray(i, i + 4096));
    return s;
  };
  return {
    tile: pack(L.tile),
    liquid: pack(L.liquid),
    start: L.start,
    stairs: L.stairs,
    bstairs: L.bstairs && { cell: L.bstairs.cell },
    portal: L.portal && { cell: L.portal.cell },
    upstairs: L.upstairs,
    items: L.items.map((it) => ({ kind: it.kind, i: it.i })),
  };
};
// reachPart で詰めた物を、reachProblems に渡せる形に戻す
export const unpackReach = (P) => ({
  ...P,
  tile: Uint8Array.from(P.tile, (c) => c.charCodeAt(0)),
  liquid: Uint8Array.from(P.liquid, (c) => c.charCodeAt(0)),
});
