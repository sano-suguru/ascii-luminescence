#!/usr/bin/env node
// 診断の記録（src/lib/diag.ts が Artifact のデータベースの diag に書く物）を、読みやすい表にする。
//   node tools/diag-report.mjs <ファイルかフォルダ…>   JSON のファイル（ArtifactData の道具の list に out_dir を付けて保存した物）か、それを入れたフォルダ
// 記録ごとに：端末、音の部品の状態の移り変わり、場面が切り替わる時の処理にかかった時間（名前ごとの回数・中央・最大）、
// 遅いフレーム（近くにあった処理の名前ごと）、時刻の順の一覧（かかった時間と遅いフレーム）を出す。
// tools/transitions.mjs も、自分で作った記録をこれで出す
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[(s.length - 1) >> 1];
};
const pad = (v, w) => String(v ?? '-').padEnd(w);

/** 1つの記録を、行の配列にする */
export function report(rec) {
  const out = [];
  const d = rec.device || {};
  const ua = String(d.ua || '');
  const kind = /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : ua.slice(0, 40);
  out.push(`== ${rec.t0 ?? '?'}  ${kind}  画面 ${JSON.stringify(d.view)}  dpr ${d.dpr ?? '?'}  （記録した長さ ${rec.saved ?? '?'} 秒）`);
  const audio = (rec.events || []).filter((e) => e.k === 'audio').map((e) => `${e.v || '(無し)'}（${e.t}秒）`);
  out.push(`音の部品：${audio.length ? audio.join(' → ') : '変わっていない'}`);
  const took = rec.took || [];
  if (!took.length) out.push('かかった時間：記録が無い（took の無い古い版か、まだ何もしていない）');
  else {
    out.push('かかった時間（ms）：');
    out.push(`  ${pad('名前', 12)}${pad('回数', 6)}${pad('中央', 7)}${pad('最大', 7)}内訳`);
    const names = [...new Set(took.map((r) => r.k))];
    for (const k of names) {
      const rows = took.filter((r) => r.k === k),
        ms = rows.map((r) => r.ms);
      let extra = '';
      if (k === 'newLevel') extra = `生成 中央 ${median(rows.map((r) => r.gen))}・組み立て 中央 ${median(rows.map((r) => r.build))}`;
      if (k === 'applySize')
        extra = Object.entries(Object.groupBy(rows, (r) => r.why ?? '?'))
          .map(([w, a]) => `${w} ${a.length}回`)
          .join('・');
      if (k === 'sndInit') extra = rows.map((r) => (r.early ? '先に作った部品' : 'その場で作った')).join('・');
      out.push(`  ${pad(k, 12)}${pad(rows.length, 6)}${pad(median(ms), 7)}${pad(Math.max(...ms), 7)}${extra}`);
    }
  }
  const slow = rec.slow || [];
  out.push(`遅いフレーム（100ms 越え）：${slow.length} 回${slow.length ? `（一番長い ${Math.max(...slow.map((r) => r.ms))}ms）` : ''}`);
  if (slow.length) {
    const by = Object.groupBy(slow, (r) => r.near ?? '(近くに何も無い)');
    for (const [k, a] of Object.entries(by))
      out.push(`  ${pad(k, 22)}${pad(a.length + '回', 6)}中央 ${median(a.map((r) => r.ms))}ms・最大 ${Math.max(...a.map((r) => r.ms))}ms`);
  }
  const line = [
    ...took.map((r) => ({
      t: r.t,
      s: `took ${r.k} ${r.ms}ms ${r.phase ?? ''}${r.k === 'newLevel' ? `（生成 ${r.gen}・組み立て ${r.build}）` : ''}${r.why ? `（${r.why} ${r.w}x${r.h} 解像度 ${r.pr}）` : ''}`,
    })),
    ...slow.map((r) => ({ t: r.t, s: `slow ${r.ms}ms ${r.phase ?? ''} ${r.place ?? ''}${r.near ? ` 近く：${r.near}` : ''}` })),
  ].sort((a, b) => a.t - b.t);
  if (line.length) {
    out.push('時刻の順：');
    for (const l of line) out.push(`  ${String(l.t).padStart(7)}秒  ${l.s}`);
  }
  return out;
}

const files = (p) =>
  statSync(p).isDirectory()
    ? readdirSync(p)
        .sort()
        .flatMap((f) => files(join(p, f)))
    : p.endsWith('.json')
      ? [p]
      : [];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('使い方：node tools/diag-report.mjs <ファイルかフォルダ…>');
    process.exit(1);
  }
  for (const f of args.flatMap(files)) {
    console.log(report(JSON.parse(readFileSync(f, 'utf8'))).join('\n'));
    console.log('');
  }
}
