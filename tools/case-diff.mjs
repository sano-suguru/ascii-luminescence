#!/usr/bin/env node
// 指紋を取る単体テストの「場合の書き出し」を、前の版と今の版で比べる。
// 見た目などを意図して変え、指紋を作り直す前に、違いがねらった所（その生き物と、それに続く物）だけかを確かめるのに使う。
//   node tools/case-diff.mjs                 指紋のテスト全部を、origin/main の src/ と今の src/ で比べる
//   node tools/case-diff.mjs view fight      tests/unit/view.test.mjs と fight.test.mjs だけ
//   --rev <版>                               比べる前の版（既定 origin/main）
//   --update [テストの名前…]                 比べ合わせはせず、今の版で指紋のテストを走らせ、落ちた指紋の値だけを今の値に書き換える
//                                            （比べ合わせで、違いがねらった所とそれに続く物だけと確かめた後に使う。main を取り込んで指紋の行がぶつかった時は、
//                                            main の値を取ってから、比べ合わせ → これ）
// しくみ：今の作業場所でテストを走らせ、次に、一時的な作業場所（git worktree。tests/ は今の物を写し、src/ だけを --rev の版にする）で走らせる。
// どちらも環境変数 AL_CASES_OUT を渡すので、テストは指紋の元の文を書き出す（tests/unit/case-out.mjs。その時は指紋のテストが落ちるが、成否は見ない）。
// 書き出しは tests/out/case-diff/old/・new/、まとめは tests/out/case-diff/summary.txt。
// Vitest は pnpm を通さずに走らせる（vitestCmd）。前の版を走らせた後に、本体の node_modules のリンクが変わっていたら止める（linkSnapshot）。
// まとめ：テストごとに、違う行の数・違う所（場所を一般にした道すじ。配列の要素は、呼び出しなら [名前]、生き物なら {鍵}）ごとの数と、
// 数の違い（後 − 前）・行ごとの最初の違い。状態は欄ごとの指紋になる（stateFp）ので、どの欄・どの生き物の欄が違うかまで見える。
// --update が書き換えるのは、caseOut の呼び出しから 4 行以内の toEqual(…)・toBe(…) の行で、テストが期待していた値がその行の値と同じ時だけ
// （そのほかの失敗は書き出すだけで、触らない）。1つのテストに指紋が並ぶ時（長さと指紋を別の行で確かめる、など）は、前の行が落ちると後の行まで進まないので、
// 落ちる指紋が無くなるまで、最大 4 回走らせ直す。走らなかったファイル（構文の誤りなど）も、書き換えなかった失敗として出す。書き換えたファイルは最後に整形する。
import { spawnSync, execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Vitest を走らせる命令（pnpm を通さず、本体の node_modules の Vitest を Node で直に動かす）。
 * 一時的な作業場所で pnpm exec を走らせると、pnpm が走らせる前に依存を確かめ、記録した場所（本体）と違うので入れ直し、
 * リンクした本体の node_modules を、一時的な作業場所から見た道で張り直してしまう（作業場所を消すと、本体の three などが切れる）
 */
export const vitestCmd = (args) => [process.execPath, [join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', ...args]];
/** node_modules の一番上（@scope の中も）のリンクの行き先（前の版を走らせる前と後で比べ、本体の node_modules が張り直されていないか確かめる） */
export function linkSnapshot(dir) {
  const out = {};
  const walk = (d, pre) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (lstatSync(p).isSymbolicLink()) out[pre + n] = readlinkSync(p);
      else if (n.startsWith('@') && !pre) walk(p, n + '/');
    }
  };
  walk(dir, '');
  return out;
}
/** 2つの linkSnapshot の違う名前 */
export const linkChanges = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isMob = (v) => isObj(v) && typeof v.key === 'string' && 'ty' in v;
/** JSON に見える文字列なら読む。行ごとに JSON の文字列（生き物の一覧など）は、配列にする。読めなければ undefined */
const tryJson = (s) => {
  if (typeof s !== 'string' || s.length < 2 || !'[{'.includes(s[0] ?? '')) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    if (!s.includes('\n')) return undefined;
    try {
      return s.split('\n').map((l) => JSON.parse(l));
    } catch {
      return undefined;
    }
  }
};
const short = (v, n = 80) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s === undefined ? 'undefined' : s.length > n ? s.slice(0, n) + '…' : s;
};

/** 2つの値の違う所（葉）を、一般にした道すじ path と、そのままの道すじ where で集める（msgs は、違う所を含む呼び出しの伝言） */
function walk(x, y, path, where, out, msgs = '') {
  if (x === y) return;
  const px = tryJson(x),
    py = tryJson(y);
  if (px !== undefined && py !== undefined) return walk(px, py, path, where, out, msgs);
  if (Array.isArray(x) && Array.isArray(y)) {
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const e = x[i],
        label = isMob(e) ? `{${e.key}}` : isObj(e) && typeof e.name === 'string' ? `[${e.name}]` : '[]';
      walk(
        e,
        y[i],
        path + label,
        `${where}[${i}]${label === '[]' ? '' : label}`,
        out,
        isObj(e) && typeof e.msgs === 'string' ? e.msgs : msgs,
      );
    }
    // 数の違いは、要素の違いの後に（行ごとの最初の違いに、先に違った要素が出るように）
    if (x.length !== y.length) out.push({ path: path + '.length', where: where + '.length', old: x.length, new: y.length, msgs });
    return;
  }
  if (isObj(x) && isObj(y)) {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${path}.${k}`, `${where}.${k}`, out, msgs);
    return;
  }
  out.push({ path, where, old: x, new: y, msgs });
}

/** JSON でない行の違い：最初に違う文字の場所と、その手前 */
function textDiff(x, y, n) {
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return {
    path: `(文) ${x.slice(0, 24)}`,
    where: `行${n} ${i}文字目`,
    old: x.slice(i, i + 80),
    new: y.slice(i, i + 80),
    before: x.slice(Math.max(0, i - 160), i),
  };
}

/** 前の書き出し a と今の書き出し b を比べて、まとめる */
export function summarize(a, b) {
  const A = a.split('\n'),
    B = b.split('\n'),
    paths = new Map(),
    firsts = [];
  let lines = 0;
  for (let n = 0; n < Math.max(A.length, B.length); n++) {
    const x = A[n],
      y = B[n];
    if (x === y) continue;
    lines++;
    const out = [];
    if (x === undefined || y === undefined)
      out.push({ path: '(行が無い)', where: `行${n}`, old: x === undefined ? '無い' : short(x), new: y === undefined ? '無い' : short(y) });
    else {
      const px = tryJson(x),
        py = tryJson(y);
      if (px !== undefined && py !== undefined) walk(px, py, '', `行${n}`, out);
      else out.push(textDiff(x, y, n));
    }
    const f = out[0];
    if (f) firsts.push(f);
    for (const d of out) {
      const e = paths.get(d.path) ?? { n: 0, deltas: new Map() };
      e.n++;
      if (typeof d.old === 'number' && typeof d.new === 'number') {
        const k = Math.round((d.new - d.old) * 1e6) / 1e6;
        e.deltas.set(k, (e.deltas.get(k) ?? 0) + 1);
      }
      paths.set(d.path, e);
    }
  }
  return { lines, total: Math.max(A.length, B.length), paths, firsts };
}

/** 伝言の HTML から印を除いた文。< で分け、それぞれの > までを捨てる（正規表現の置き換えと違い、結果に < が残らない） */
export const plainText = (html) =>
  html
    .split('<')
    .map((p, i) => (i ? p.slice(p.indexOf('>') + 1) : p))
    .join('');

/** まとめを文にする */
export function report(name, s, { maxPaths = 25, maxFirsts = 6 } = {}) {
  if (!s.lines) return `== ${name}：同じ（${s.total} 行）\n`;
  let r = `== ${name}：${s.total} 行のうち ${s.lines} 行が違う\n  違う所（数の多い順）：\n`;
  const ps = [...s.paths].sort((p, q) => q[1].n - p[1].n);
  for (const [p, e] of ps.slice(0, maxPaths)) {
    const ds = [...e.deltas].sort((u, v) => v[1] - u[1]).slice(0, 4);
    r += `    ${String(e.n).padStart(6)}  ${p || '(全体)'}${ds.length ? `  数の違い ${ds.map(([d, c]) => `${d > 0 ? '+' : ''}${d}×${c}`).join(' ')}` : ''}\n`;
  }
  if (ps.length > maxPaths) r += `    …ほか ${ps.length - maxPaths} 種類\n`;
  r += '  行ごとの最初の違い：\n';
  for (const f of s.firsts.slice(0, maxFirsts)) {
    r += `    ${f.where}\n      前：${short(f.old)}\n      後：${short(f.new)}\n`;
    if (f.before) r += `      手前：${short(f.before, 160)}\n`;
    // 呼び出しの中の違いなら、その時の伝言の終わり（何が起きた所か。例：〜を倒した）。印（HTML）を除く
    if (f.msgs) r += `      伝言：…${plainText(f.msgs).slice(-80)}\n`;
  }
  if (s.firsts.length > maxFirsts) r += `    …ほか ${s.firsts.length - maxFirsts} 行\n`;
  return r;
}

/** 書き出しの置き場所 old・new の、同じ名前のファイルを比べて、まとめの文にする */
export function compareDirs(oldDir, newDir) {
  const names = [...new Set([...readdirSync(oldDir), ...readdirSync(newDir)])]
    .filter((f) => f.endsWith('.txt'))
    .sort((p, q) => p.localeCompare(q));
  let r = '';
  for (const f of names) {
    const name = f.replace(/\.txt$/, ''),
      a = join(oldDir, f),
      b = join(newDir, f);
    if (!existsSync(a) || !existsSync(b)) {
      r += `== ${name}：${existsSync(a) ? '今の版' : '前の版'}の書き出しが無い（テストが途中で止まったかもしれない）\n`;
      continue;
    }
    r += report(name, summarize(readFileSync(a, 'utf8'), readFileSync(b, 'utf8')));
  }
  return r;
}

/** Vitest の値の書き方（[ 'a', 1 ]）を、ソースの書き方（['a', 1]）にする */
const srcForm = (v) => v.replace(/\[ /g, '[').replace(/ \]/g, ']');
/** 空白を除いた形（比べるため） */
const bare = (v) => v.replace(/\s+/g, '');
/**
 * 落ちた指紋の1件を、ソースに当てる。msg は失敗の文の1行目（expected <今の値> to deeply equal|be <期待していた値>）、line は落ちた行（1 から）。
 * 書き換えられれば新しいソースを、書き換えない時は理由を返す
 */
export function applyFix(src, line, msg) {
  const m = /^AssertionError: expected (.+?) to (?:deeply equal|be) (.+?)(?: \/\/ Object\.is equality)?$/.exec(msg);
  if (!m) return { why: '指紋の失敗の文ではない' };
  const [, actual = '', expected = ''] = m,
    lines = src.split('\n'),
    i = line - 1,
    text = lines[i];
  if (text === undefined) return { why: `${line} 行目が無い` };
  if (!lines.slice(Math.max(0, i - 4), i).some((l) => l.includes('caseOut('))) return { why: 'caseOut のすぐ後（4 行以内）の行ではない' };
  const call = /\.(toEqual|toBe)\((.*?)\);/.exec(text);
  if (!call || bare(call[2] ?? '') !== bare(srcForm(expected))) return { why: '行の値が、テストの期待していた値と違う' };
  lines[i] = text.replace(`.${call[1]}(${call[2]});`, `.${call[1]}(${srcForm(actual)});`);
  return { src: lines.join('\n') };
}

/** 今の版で指紋のテストを走らせ、落ちた指紋の値を書き換える（最大 4 回） */
function update(files) {
  const json = join(ROOT, 'tests/out/case-diff/update.json');
  mkdirSync(dirname(json), { recursive: true });
  const changed = new Set();
  let total = 0;
  // 書き換えた行は、値の桁が増えて行が長くなりうるので、最後に整形する
  const finish = () => {
    if (changed.size) spawnSync('pnpm', ['exec', 'oxfmt', ...changed], { cwd: ROOT, stdio: 'ignore' });
  };
  for (let round = 1; round <= 4; round++) {
    // 前の結果を読まないように、走らせる前に消す（Vitest が書かずに終わったら、止める）
    rmSync(json, { force: true });
    const r = spawnSync(...vitestCmd(['--reporter=json', `--outputFile=${json}`, ...files.map((f) => `tests/unit/${f}`)]), {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
    if (r.error) throw r.error;
    if (!existsSync(json)) {
      finish();
      throw new Error(`Vitest が結果を書かずに終わった：\n${(r.stderr || r.stdout || '').slice(-2000)}`);
    }
    const res = JSON.parse(readFileSync(json, 'utf8'));
    let fixed = 0;
    const left = [];
    for (const f of res.testResults) {
      // 読み込めなかったファイル（構文の誤り・読み込みの失敗など）は、中の結果が無く、ファイルの失敗だけが残る
      if (f.status === 'failed' && !f.assertionResults.some((a) => a.status === 'failed'))
        left.push(`${f.name.replace(ROOT + '/', '')}：ファイルが走らなかった\n    ${String(f.message ?? '').split('\n')[0]}`);
      for (const a of f.assertionResults) {
        if (a.status !== 'failed') continue;
        const msg = String(a.failureMessages?.[0] ?? ''),
          at = new RegExp(`${f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):\\d+`).exec(msg),
          src = readFileSync(f.name, 'utf8'),
          out = at ? applyFix(src, Number(at[1]), msg.split('\n')[0] ?? '') : { why: '落ちた行が分からない' };
        if (out.src !== undefined) {
          writeFileSync(f.name, out.src);
          changed.add(f.name);
          fixed++;
          console.log(`  書き換えた：${f.name.replace(ROOT + '/', '')}:${at?.[1]}  ${msg.split('\n')[0]}`);
        } else left.push(`${f.name.replace(ROOT + '/', '')}「${a.title}」：${out.why}\n    ${msg.split('\n')[0]}`);
      }
    }
    total += fixed;
    if (!fixed) {
      finish();
      if (left.length) {
        console.log(`\n書き換えなかった失敗（${left.length}）：\n  ` + left.join('\n  '));
        process.exitCode = 1;
      } else console.log(`指紋のテストは全部通る（指紋を ${total} か所書き換えた）`);
      return;
    }
  }
  finish();
  console.log(`4 回走らせ直しても、まだ落ちる指紋がある（指紋を ${total} か所書き換えた）。もう一度走らせて確かめる`);
  process.exitCode = 1;
}

function main() {
  const argv = process.argv.slice(2),
    ri = argv.indexOf('--rev'),
    rev = ri >= 0 ? argv[ri + 1] : 'origin/main';
  if (!rev || rev.startsWith('--')) throw new Error('--rev の後に、比べる前の版を書いてください');
  const names = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--rev');
  const unit = join(ROOT, 'tests/unit');
  // 既定は、書き出しの道具を使う指紋のテスト全部
  const all = readdirSync(unit).filter(
    (f) => /\.test\.(mjs|ts)$/.test(f) && readFileSync(join(unit, f), 'utf8').includes('./case-out.mjs'),
  );
  const files = names.length
    ? names.map((n) => {
        const f = all.find((x) => x.replace(/\.test\.(mjs|ts)$/, '') === n);
        if (!f) throw new Error(`指紋のテスト ${n} が無い（あるのは ${all.map((x) => x.replace(/\.test\.(mjs|ts)$/, '')).join('・')}）`);
        return f;
      })
    : all;
  if (argv.includes('--update')) {
    if (ri >= 0) throw new Error('--update は比べ合わせをしないので、--rev と一緒には使えない');
    update(files);
    return;
  }
  const out = join(ROOT, 'tests/out/case-diff'),
    dirs = { old: join(out, 'old'), new: join(out, 'new') };
  rmSync(out, { recursive: true, force: true });
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
  const vitest = (cwd, dir) => {
    const t0 = Date.now(),
      r = spawnSync(...vitestCmd(files.map((f) => `tests/unit/${f}`)), {
        cwd,
        env: { ...process.env, AL_CASES_OUT: dir },
        encoding: 'utf8',
        maxBuffer: 1 << 28,
      });
    if (r.error) throw r.error;
    console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)}秒`);
  };
  console.log(`今の版（作業場所のまま）：${files.length} のテストを走らせる`);
  vitest(ROOT, dirs.new);
  const tmp = mkdtempSync(join(tmpdir(), 'al-case-diff-')),
    links0 = linkSnapshot(join(ROOT, 'node_modules'));
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  try {
    git('worktree', 'add', '--detach', tmp, 'HEAD');
    // テストは今の物（まだコミットしていない変更も）、src/ だけを前の版にする
    rmSync(join(tmp, 'tests'), { recursive: true, force: true });
    cpSync(join(ROOT, 'tests'), join(tmp, 'tests'), { recursive: true, filter: (p) => !p.startsWith(join(ROOT, 'tests/out')) });
    rmSync(join(tmp, 'src'), { recursive: true, force: true });
    execFileSync('git', ['checkout', rev, '--', 'src'], { cwd: tmp, stdio: 'ignore' });
    symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'));
    console.log(`前の版（src/ は ${rev}）：同じテストを走らせる`);
    vitest(tmp, dirs.old);
  } finally {
    try {
      git('worktree', 'remove', '--force', tmp);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      git('worktree', 'prune');
    }
  }
  const moved = linkChanges(links0, linkSnapshot(join(ROOT, 'node_modules')));
  if (moved.length)
    throw new Error(
      `本体の node_modules のリンクが変わった（${moved.slice(0, 5).join('・')} など ${moved.length}）。pnpm install --frozen-lockfile で直す`,
    );
  const text = compareDirs(dirs.old, dirs.new);
  writeFileSync(join(out, 'summary.txt'), text);
  console.log('\n' + text + `\n（書き出しは ${dirs.old} と ${dirs.new}、まとめは ${join(out, 'summary.txt')}）`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
