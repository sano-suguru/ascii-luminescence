#!/usr/bin/env node
// 段階7b の道具：古い JS（src/game/）の一番外の状態（let など）を、TypeScript の入れ物（src/lib/state.ts）の欄に移す書き換え。
//   node tools/state-move.mjs vfx shake flash          書き換えて、一覧を出す
//   node tools/state-move.mjs vfx shake flash --dry    書き換えずに、一覧だけ出す
// 名前がどの宣言を指すかは eslint-scope で見分ける（同じ名前の局所の変数・引数は書き換えない）。
//   - ゲームの状態を指す所を「入れ物.名前」にする。縮めた書き方 {shake} は {shake:vfx.shake} に開く
//   - 元の宣言を消す（初めの値は一覧に出すので、src/lib/state.ts の入れ物に書く）
//   - 書き換える場所で、入れ物の名前が別の宣言に隠されていたら、何も書き換えずに止める
// 書き漏れがあれば、宣言が無くなった名前を lint（定義されていない名前）が止める。入れ物は src/game/imports.mjs で読むこと。
// 単体テスト（tests/unit/state-move.test.mjs）は、小さな見本のフォルダを dir に渡して確かめる。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';
import * as eslintScope from 'eslint-scope';
import { gameLayout, gameSource } from './game-source.mjs';

const GAME_DIR = join(import.meta.dirname, '..', 'src/game');

/**
 * dir（既定は src/game/）の古い JS で、名前 names の状態を、入れ物 box の欄に移す。
 * 返り値の report は名前ごとの一覧（初めの値・書き換えた数・ファイルごとの数・書き換えなかった同じ名前の局所の宣言）。
 * 入れ物の名前が隠されている所があれば、何も書き換えずに Error を投げる（clash に一覧）。dry なら書き換えない
 */
export function stateMove({ dir = GAME_DIR, box, names, dry = false }) {
  const code = gameSource({ dir }),
    ast = parseAst(code, { lang: 'js' });
  // oxc の位置（start・end）を、eslint-scope が読む range に写す。縮めた書き方の欄（{shake}）も集める
  const shorthand = new Map(); // 値の名前の始まり → 欄
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n.type === 'string' && typeof n.start === 'number') n.range = [n.start, n.end];
    if (n.type === 'Property' && n.shorthand) shorthand.set(n.value.start, n);
    for (const k in n) if (k !== 'range') walk(n[k]);
  };
  walk(ast);
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: 'module', fallback: 'iteration' });
  const wrap = sm.scopes.find((s) => s.type === 'function' && s.upper?.type === 'module');
  if (!wrap) throw new Error('包みの関数のスコープが見つからない');

  // つないだ文の位置 → ファイルと、その中の位置
  const lineStart = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStart.push(i + 1);
  const parts = gameLayout({ dir }).map((e) => {
    const name = e.file.replace(/^src\/game\//, ''),
      path = join(dir, name),
      base = lineStart[e.start - 1],
      text = readFileSync(path, 'utf8');
    if (code.slice(base, base + text.length) !== text) throw new Error(`つないだ文と ${name} の位置が合わない`);
    return { name, path, base, text, edits: [] };
  });
  const partAt = (pos) => {
    const p = parts.findLast((e) => e.base <= pos);
    if (!p || pos >= p.base + p.text.length) throw new Error(`位置 ${pos} がどのファイルにも入らない`);
    return p;
  };
  const edit = (start, end, text) => {
    const p = partAt(start);
    p.edits.push({ start: start - p.base, end: end - p.base, text });
  };
  const lineOf = (pos) => lineStart.findLast((s) => s <= pos);

  const report = [],
    clash = [];
  for (const name of names) {
    const v = wrap.set.get(name);
    if (!v) throw new Error(`${name} は古い JS の一番外の宣言に無い`);
    if (v.defs.length !== 1 || v.defs[0].type !== 'Variable')
      throw new Error(`${name} は変数の宣言1つではない（関数・引数・いくつもの宣言）`);
    const def = v.defs[0],
      decl = def.parent,
      d = def.node;
    if (d.id.type !== 'Identifier') throw new Error(`${name} は分割代入で宣言されている`);
    const init = d.init ? code.slice(d.init.start, d.init.end) : 'undefined';
    // 宣言を消す（いくつも並んだ宣言なら、その1つと区切りのコンマだけ。1つだけの宣言なら、その行ごと）
    const ds = decl.declarations,
      k = ds.indexOf(d);
    if (ds.length === 1) {
      const lineEnd = code.indexOf('\n', decl.end),
        alone = code.slice(lineOf(decl.start), decl.start).trim() === '' && code.slice(decl.end, lineEnd).trim() === '';
      if (alone) edit(lineOf(decl.start), lineEnd + 1, '');
      else edit(decl.start, decl.end, '');
    } else if (k < ds.length - 1) edit(d.start, ds[k + 1].start, '');
    else edit(ds[k - 1].end, d.end, '');
    // ゲームの状態を指す所を書き換える（宣言の初めの値への書き込みは除く。宣言ごと消すので）
    const files = {};
    let n = 0;
    for (const r of v.references) {
      if (r.init) continue;
      const id = r.identifier,
        prop = shorthand.get(id.start);
      if (prop && prop.value !== id) throw new Error(`${name} の縮めた書き方が読めない（既定値つきの分割代入など）`);
      // 書き換える場所で、入れ物の名前が別の宣言（局所の変数・引数）に隠されていないこと。隠されていると「入れ物.名前」が
      // その別の物を指し、構文は正しいまま、動かした時に初めて壊れる（座標の fx を入れ物と取り違えた、など）
      for (let s = r.from; s && s.type !== 'module'; s = s.upper)
        if (s.set.has(box)) clash.push(`${partAt(id.start).name} の ${name}（${box} という名前が、そこで別に宣言されている）`);
      edit(id.start, id.end, prop ? `${name}:${box}.${name}` : `${box}.${name}`);
      const f = partAt(id.start).name;
      files[f] = (files[f] ?? 0) + 1;
      n++;
    }
    // 同じ名前の局所の宣言（書き換えない所）
    const locals = sm.scopes
      .filter((s) => s !== wrap && s.set.get(name)?.defs.length)
      .map((s) => {
        const def0 = s.set.get(name).defs[0];
        return `${partAt(def0.name.start).name}（${def0.type}）`;
      });
    report.push({ name, init, n, files, locals });
  }
  if (clash.length) {
    const e = new Error(`入れ物の名前 ${box} が、書き換える場所で隠されている（別の名前にする）：\n  ${[...new Set(clash)].join('\n  ')}`);
    e.clash = [...new Set(clash)];
    throw e;
  }
  if (!dry)
    for (const p of parts) {
      if (!p.edits.length) continue;
      p.edits.sort((a, b) => b.start - a.start);
      for (let i = 1; i < p.edits.length; i++) if (p.edits[i].end > p.edits[i - 1].start) throw new Error(`${p.name} で書き換えが重なった`);
      let t = p.text;
      for (const e of p.edits) t = t.slice(0, e.start) + e.text + t.slice(e.end);
      writeFileSync(p.path, t);
    }
  return { report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    dry = args.includes('--dry'),
    [box, ...names] = args.filter((a) => a !== '--dry');
  if (!box || !names.length) {
    console.log('使い方：node tools/state-move.mjs <入れ物> <名前>… [--dry]');
    process.exit(1);
  }
  let report;
  try {
    ({ report } = stateMove({ box, names, dry }));
  } catch (e) {
    console.log(`✗ ${e.message}`);
    process.exit(1);
  }
  for (const r of report) {
    console.log(`${r.name}：初めの値 ${r.init}、書き換え ${r.n} か所`);
    console.log(
      `  ${Object.entries(r.files)
        .map(([f, c]) => `${f} ${c}`)
        .join('・')}`,
    );
    if (r.locals.length) console.log(`  書き換えなかった、同じ名前の局所の宣言：${r.locals.join('・')}`);
  }
  if (!dry) console.log(`書き換えた（${box}）。src/lib/state.ts の入れ物に初めの値を書き、src/game/imports.mjs で ${box} を読むこと`);
}
