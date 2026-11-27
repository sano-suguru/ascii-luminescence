#!/usr/bin/env node
// 診断の記録（src/lib/diag.ts が Artifact のデータベースの diag に書く物）を、読みやすい表にする。
//   node tools/diag-report.mjs <ファイルかフォルダ…>   JSON のファイル（ArtifactData の道具の list に out_dir を付けて保存した物）か、それを入れたフォルダ
// 記録ごとに：端末、音の部品の状態の移り変わり、場面が切り替わる時の処理にかかった時間（名前ごとの回数・中央・最大）、
// 遅いフレーム（近くにあった処理の名前ごと）、メニューの押し方、自動で試した段の表（?auto）、画質の移り変わり、時刻の順の一覧（かかった時間と遅いフレーム）を出す。
//   node tools/diag-report.mjs --compare <前.json> <今.json>   自動で試した段を、前と今で並べる（tools/auto-run.mjs も使う）
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

/** すぐ押し直したと見る秒（メニューの項目を押してから、次の項目を押すまで） */
export const QUICK = 1.5;
/** 押すたびに切り替わる項目（2回押すと元に戻る） */
const TOGGLES = new Set(['cam', 'ui', 'snd', 'look', 'perf']);

/**
 * メニューの押し方（src/lib/diag.ts の menu）の表。押し間違いの目安：QUICK 秒以内に別の項目を押した（違う所を押して押し直した）回数と、
 * 切り替えの項目を QUICK 秒以内に押し戻した回数（同じ項目の2回目。ただし見回す速さ・音量は3段なので、続けて押すのは選び直しのこともある）
 */
export function menuRows(menu) {
  if (!menu) return [];
  if (!menu.length) return ['メニューの押し方：押していない'];
  const count = Object.entries(Object.groupBy(menu, (r) => r.k))
    .map(([k, a]) => `${k} ${a.length}`)
    .join('・');
  const quick = menu.filter((r) => r.dt !== null && r.dt <= QUICK);
  const other = quick.filter((r) => r.prev !== r.k),
    back = quick.filter((r) => r.prev === r.k && TOGGLES.has(r.k));
  const out = [`メニューの押し方：${menu.length} 回（${count}）`];
  out.push(
    `  ${QUICK}秒以内に別の項目：${other.length} 回${other.length ? `（${other.map((r) => `${r.prev}→${r.k} ${r.dt}秒`).join('・')}）` : ''}`,
  );
  out.push(`  ${QUICK}秒以内に押し戻した：${back.length} 回${back.length ? `（${back.map((r) => `${r.k} ${r.dt}秒`).join('・')}）` : ''}`);
  const dts = menu.map((r) => r.dt).filter((d) => d !== null);
  if (dts.length) out.push(`  押す間の秒：${dts.join(' ')}`);
  return out;
}

/** 画質の移り変わり（src/game/30-loop-init.js の setQuality が took に書く物：解像度を変えた applySize と、光のにじみだけ変えた quality。
 *  理由 why は auto（下げた）・back（下げても速くならず戻して止めた）・hold（比べる前に数えるのが途切れて戻した）） */
export function qualitySteps(took = []) {
  return took
    .filter((r) => (r.k === 'applySize' || r.k === 'quality') && ['auto', 'back', 'hold'].includes(r.why))
    .map((r) => ({ t: r.t, why: r.why, what: r.k === 'applySize' ? `解像度 ${r.pr}` : `光のにじみ ${r.bloom ? 'あり' : 'なし'}` }));
}

/** 自動で試した段の表（src/lib/auto.ts の記録 auto） */
export function autoRows(a) {
  if (!a) return [];
  const out = [
    `自動で試した：${a.lap}/${a.laps}周${a.quick ? '（短い台本）' : ''}・${a.done ? '終わった' : `途中（${a.step}）`}${a.stop ? `・${a.stop}` : ''}・Wake Lock ${a.wakeLock || '-'}${a.dev ? `・開発用モード（始めた深さ ${a.depth}）` : ''}`,
    `  ${pad('周', 4)}${pad('段', 8)}${pad('秒', 7)}${pad('フレーム', 9)}${pad('平均fps', 9)}${pad('最長ms', 8)}${pad('遅い', 6)}ほか`,
  ];
  for (const s of a.steps || [])
    out.push(
      `  ${pad(s.lap, 4)}${pad(s.k, 8)}${pad(s.sec, 7)}${pad(s.frames, 9)}${pad(s.avg, 9)}${pad(s.worst, 8)}${pad(s.slow, 6)}${[s.waited && `待った：${s.waited}`, s.miss && `違った：${s.miss}`].filter(Boolean).join('・')}`,
    );
  return out;
}

/** 2つの記録（前・今）の、自動で試した段を並べて比べる（周と段の名前で合わせる） */
export function compareRows(prev, cur) {
  const key = (s) => `${s.lap}:${s.k}`,
    old = new Map((prev?.auto?.steps || []).map((s) => [key(s), s]));
  const out = [
    `前と今（平均fps・最長ms・遅いフレームの数）：`,
    `  ${pad('周', 4)}${pad('段', 8)}${pad('平均fps', 16)}${pad('最長ms', 14)}遅い`,
  ];
  const arrow = (a, b) => `${a ?? '-'} → ${b ?? '-'}`;
  for (const s of cur?.auto?.steps || []) {
    const o = old.get(key(s));
    out.push(
      `  ${pad(s.lap, 4)}${pad(s.k, 8)}${pad(arrow(o?.avg, s.avg), 16)}${pad(arrow(o?.worst, s.worst), 14)}${arrow(o?.slow, s.slow)}`,
    );
  }
  const q = (r) =>
    qualitySteps(r?.took)
      .map((x) => `${x.why} ${x.what}`)
      .join(' → ') || '変えていない';
  out.push(`  画質：前 ${q(prev)}`, `        今 ${q(cur)}`);
  return out;
}

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
  out.push(...menuRows(rec.menu));
  out.push(...autoRows(rec.auto));
  const qs = qualitySteps(took);
  out.push(`画質の移り変わり：${qs.length ? qs.map((x) => `${x.why} ${x.what}（${x.t}秒）`).join(' → ') : '変えていない'}`);
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
    console.log('使い方：node tools/diag-report.mjs <ファイルかフォルダ…>  か  --compare <前.json> <今.json>');
    process.exit(1);
  }
  if (args[0] === '--compare') {
    const [a, b] = args.slice(1).map((f) => JSON.parse(readFileSync(f, 'utf8')));
    console.log(compareRows(a, b).join('\n'));
    process.exit(0);
  }
  for (const f of args.flatMap(files)) {
    console.log(report(JSON.parse(readFileSync(f, 'utf8'))).join('\n'));
    console.log('');
  }
}
