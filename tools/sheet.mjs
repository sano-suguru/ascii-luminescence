// 写真を、生き物の体のまわりで切り抜いて大きくし、枡に並べた1枚にする道具（tools/shots.mjs・tools/field.mjs・tools/glare.mjs が使う）。
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/**
 * 体のまわりの切り抜き：画面の範囲（ページの CSS の画素。__test.monsterView の screen。いくつかあれば合わせた範囲）を、
 * 写真（ページの clip の所を写した物）の中の正方形にする。体の大きい方の辺の 1.3 倍（と 16 画素）。小さすぎない（96 画素）・写真からはみ出さない。
 * 返す x・y は写真の中の位置
 */
export function cropRect(boxes, clip) {
  const bs = boxes.filter(Boolean);
  if (!bs.length) return { x: 0, y: 0, side: Math.min(clip.width, clip.height) };
  const x0 = Math.min(...bs.map((b) => b.x0)) - clip.x,
    x1 = Math.max(...bs.map((b) => b.x1)) - clip.x,
    y0 = Math.min(...bs.map((b) => b.y0)) - clip.y,
    y1 = Math.max(...bs.map((b) => b.y1)) - clip.y;
  const side = Math.round(Math.min(clip.width, clip.height, Math.max(96, Math.max(x1 - x0, y1 - y0) * 1.3 + 16))),
    fit = (c, lim) => Math.round(Math.max(0, Math.min(lim - side, c - side / 2)));
  return { x: fit((x0 + x1) / 2, clip.width), y: fit((y0 + y1) / 2, clip.height), side };
}

/** 写真の行の並び（行ごとに [{ file, rect }]。file が null の枡は黒のまま）を、1つの枡 cell に切り抜いて大きく（近い画素のまま）並べ、1枚に書く */
export function writeSheet(rows, file, cell = 270) {
  const cols = Math.max(...rows.map((r) => r.length)),
    out = new PNG({ width: cols * cell, height: rows.length * cell });
  out.data.fill(0);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
  rows.forEach((row, r) =>
    row.forEach(({ file: f, rect }, c) => {
      if (!f) return;
      const img = PNG.sync.read(readFileSync(f)),
        k = rect.side / cell;
      for (let y = 0; y < cell; y++)
        for (let x = 0; x < cell; x++) {
          const sx = Math.min(img.width - 1, rect.x + Math.floor(x * k)),
            sy = Math.min(img.height - 1, rect.y + Math.floor(y * k)),
            si = (sy * img.width + sx) * 4,
            di = ((r * cell + y) * out.width + c * cell + x) * 4;
          for (let q = 0; q < 4; q++) out.data[di + q] = img.data[si + q] ?? 0;
        }
    }),
  );
  writeFileSync(file, PNG.sync.write(out));
}
