// ソースマップの小さな道具（依存を増やさないため、自前で書く）。
//   decodeMappings(文字列)            mappings の文字列 → 行ごとの区切りの配列（どれも絶対値）
//   originalPosition(map, 行, 列)     組み立てた JS の位置（行は1始まり、列は0始まり）→ 元のファイルの位置
//   findMap(jsのパス, mapの置き場)     組み立てた JS に対応するソースマップを読む（公開しないので、dist の外に置いている）
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// oxlint-disable-next-line typescript/no-misused-spread -- B64 は ASCII だけ
const B64I = Object.fromEntries([...B64].map((c, i) => [c, i]));

// 行ごとの区切り [生成の列, ソースの番号, 元の行(0始まり), 元の列(, 名前の番号)] の配列
export function decodeMappings(str) {
  const prev = [0, 0, 0, 0, 0];
  return str.split(';').map((line) => {
    prev[0] = 0;
    if (!line) return [];
    return line.split(',').map((seg) => {
      const vals = [];
      let v = 0,
        shift = 0;
      for (const c of seg) {
        const d = B64I[c];
        if (d === undefined) throw new Error(`ソースマップの mappings に読めない文字：${c}`);
        v += (d & 31) << shift;
        if (d & 32) shift += 5;
        else {
          vals.push(v & 1 ? -(v >>> 1) : v >>> 1);
          v = shift = 0;
        }
      }
      return vals.map((x, k) => (prev[k] += x));
    });
  });
}

// 行（1始まり）と列（0始まり）の直前の区切りを探す。区切りの後ろの列は、区切りからの差で数える。
// 区切りは Vite（Rolldown）が書くので、区切りの間の列は近い値でしかない。
// 行が範囲外（ソースマップの行より後ろ）なら undefined、対応する行が無ければ null
export function originalPosition(map, line, column = 0) {
  map._decoded ??= decodeMappings(map.mappings);
  if (!(line >= 1 && line <= map._decoded.length)) return undefined;
  const segs = map._decoded[line - 1];
  if (!segs.length) return null;
  let s = null;
  for (const t of segs) if (t[0] <= column && t.length >= 4) s = t;
  s ??= segs.find((t) => t.length >= 4);
  if (!s) return null;
  return { source: map.sources[s[1]], line: s[2] + 1, column: s[3] + Math.max(0, column - s[0]) };
}

// 組み立てた JS（…/assets/index-xxxx.js）のソースマップを、置き場から読む。無ければ null
export function findMap(jsFile, mapDir) {
  const f = join(mapDir, 'assets', `${basename(jsFile)}.map`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}
