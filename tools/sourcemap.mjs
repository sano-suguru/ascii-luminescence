// ソースマップの小さな道具（依存を増やさないため、自前で書く）。
//   encodeMappings / decodeMappings   mappings の文字列 ⇔ 行ごとの区切りの配列（どれも絶対値）
//   originalPosition(map, 行, 列)     組み立てた JS の位置（行は1始まり、列は0始まり）→ 元のファイルの位置
//   findMap(jsのパス, mapの置き場)     組み立てた JS に対応するソースマップを読む（公開しないので、dist の外に置いている）
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64I = Object.fromEntries([...B64].map((c, i) => [c, i]));

function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1,
    out = '';
  do {
    let d = v & 31;
    v >>>= 5;
    if (v) d |= 32;
    out += B64[d];
  } while (v);
  return out;
}

// lines[i] = その行の区切り [生成の列, ソースの番号, 元の行(0始まり), 元の列] の配列
export function encodeMappings(lines) {
  const prev = [0, 0, 0, 0];
  return lines
    .map((segs) => {
      prev[0] = 0; // 生成の列だけは、行ごとに0から数え直す
      return segs
        .map((s) => {
          const out = s.map((v, k) => vlq(v - prev[k])).join('');
          s.forEach((v, k) => (prev[k] = v));
          return out;
        })
        .join(',');
    })
    .join(';');
}

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

// 行（1始まり）と列（0始まり）の直前の区切りを探す。ゲーム本体は行の中身を変えずに組み立てるので、列は区切りからの差で数える
export function originalPosition(map, line, column = 0) {
  map._decoded ??= decodeMappings(map.mappings);
  const segs = map._decoded[line - 1];
  if (!segs?.length) return null;
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
