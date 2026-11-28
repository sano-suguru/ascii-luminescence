#!/usr/bin/env node
// 状態を入れ物に移す道具：古い JS（src/game/）の一番外の状態（let など）を、TypeScript の入れ物（src/lib/state.ts）の欄に移す書き換え。
//   node tools/state-move.mjs vfx shake flash          書き換えて、一覧を出す
//   node tools/state-move.mjs vfx shake flash --dry    書き換えずに、一覧だけ出す
// 名前がどの宣言を指すかは eslint-scope で見分ける（同じ名前の局所の変数・引数は書き換えない）。
//   - ゲームの状態を指す所を「入れ物.名前」にする。縮めた書き方 {shake} は {shake:vfx.shake} に開く
//   - 元の宣言を消す（初めの値は一覧に出すので、src/lib/state.ts の入れ物に書く）。初めの値が決まった値でなければ（関数の呼び出し・
//     Math.random の読み取りなど）、その場に「入れ物.名前=…;」として残す（入れ物の初めの値は仮でよい）
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

// 決まった値か（入れ物に移してよい初めの値）：数・文字列・true などと、それだけでできた配列・オブジェクト、-1 のような符号、空の new Set()・new Map()。
// 名前の読み取り（Math.random・undefined 以外の名前）、関数の呼び出し、ほかの new などは決まった値ではない（その場に残す）
export const fixed = (n) => {
  switch (n.type) {
    case 'Literal':
      return true;
    case 'Identifier':
      return n.name === 'undefined';
    case 'TemplateLiteral':
      return n.expressions.length === 0;
    case 'UnaryExpression':
      return ['-', '+', '!'].includes(n.operator) && fixed(n.argument);
    case 'ArrayExpression':
      return n.elements.every((e) => e && e.type !== 'SpreadElement' && fixed(e));
    case 'ObjectExpression':
      return n.properties.every((p) => p.type === 'Property' && !p.computed && p.kind === 'init' && !p.method && fixed(p.value));
    case 'NewExpression':
      return n.callee.type === 'Identifier' && ['Set', 'Map'].includes(n.callee.name) && n.arguments.length === 0;
    default:
      return false;
  }
};

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
    clash = [],
    moved = new Map(); // 宣言 → (移す宣言子 → その場に残す代入の文。残さないなら null)
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
    // 初めの値が決まった値（数・文字列・true など、それだけでできた配列・オブジェクト、空の new Set()・new Map()）なら、入れ物に移す。
    // ほかは（関数の呼び出し、Math.random のような名前や欄の読み取り、new Date() など）、入れ物に移さず、その場で「入れ物.名前=初めの値;」にする。
    // TypeScript のモジュールは古い JS より先に読まれるので、移すと値を作る時と順番が変わる（テスト用モードの乱数の入れ替えより前に引く、など）
    const keep = d.init ? !fixed(d.init) : false;
    // 宣言は、全部の名前を見てから、宣言ごとにまとめて消す（並んだ宣言の名前をいくつも移すと、消す範囲が重なるため）
    (moved.get(decl) ?? moved.set(decl, new Map()).get(decl)).set(d, keep);
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
    report.push({ name, init, n, files, locals, kept: keep });
  }
  // 宣言を消す。並んだ宣言の、移す宣言子の続き（ひとまとまり）ごとに、区切りのコンマと一緒に消す。残る宣言子の文には触れない
  // （残る宣言子の初めの値の中の書き換えと重ならないように）。全部を移すなら宣言ごと消し、1行それだけならその行ごと消す
  for (const [decl, ds] of moved) {
    const all = decl.declarations;
    // 並んだ宣言の中にその場に残す物があるなら、並んだ全部を移して、全部をその場に残す時だけ書ける（「入れ物.a=…; 入れ物.b=…;」）
    if (all.length > 1 && [...ds.values()].some(Boolean)) {
      const name = all.find((d) => ds.get(d))?.id.name;
      if (!all.every((d) => ds.get(d)))
        throw new Error(
          `${name} の初めの値は決まった値ではないので、その場に残したいが、並んだ宣言の中にある（並んだ全部を、その場に残す物として移すか、先に宣言を分ける）`,
        );
      edit(decl.start, all[0].id.end, `${box}.${all[0].id.name}`);
      for (let k = 1; k < all.length; k++) edit(all[k - 1].end, all[k].id.end, `; ${box}.${all[k].id.name}`);
      continue;
    }
    if (all.length === 1 && ds.get(all[0])) {
      // その場に残す：「let 名前」だけを「入れ物.名前」にする。「=」から後ろは元の文のまま（外側のかっこも残る。
      // 初めの値の中の、ほかの移す名前の書き換えとも重ならない）
      const d = all[0];
      edit(decl.start, d.id.end, `${box}.${d.id.name}`);
      continue;
    }
    if (all.every((d) => ds.has(d))) {
      const lineEnd = code.indexOf('\n', decl.end),
        alone = code.slice(lineOf(decl.start), decl.start).trim() === '' && code.slice(decl.end, lineEnd).trim() === '';
      if (alone) edit(lineOf(decl.start), lineEnd + 1, '');
      else edit(decl.start, decl.end, '');
      continue;
    }
    for (let i = 0; i < all.length;) {
      if (!ds.has(all[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < all.length && ds.has(all[j + 1])) j++;
      if (j + 1 < all.length) edit(all[i].start, all[j + 1].start, '');
      else edit(all[i - 1].end, all[j].end, '');
      i = j + 1;
    }
  }
  if (clash.length) {
    const e = new Error(`入れ物の名前 ${box} が、書き換える場所で隠されている（別の名前にする）：\n  ${[...new Set(clash)].join('\n  ')}`);
    e.clash = [...new Set(clash)];
    throw e;
  }
  // 全部のファイルの書き換えを先に作り、重なりが無いことを確かめてから書く（途中で止まって、一部のファイルだけ書き換わらないように）
  const out = parts
    .filter((p) => p.edits.length)
    .map((p) => {
      p.edits.sort((a, b) => b.start - a.start);
      for (let i = 1; i < p.edits.length; i++) if (p.edits[i].end > p.edits[i - 1].start) throw new Error(`${p.name} で書き換えが重なった`);
      let t = p.text;
      for (const e of p.edits) t = t.slice(0, e.start) + e.text + t.slice(e.end);
      return { path: p.path, text: t };
    });
  if (!dry) for (const o of out) writeFileSync(o.path, o.text);
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
    console.log(
      `${r.name}：初めの値 ${r.init}${r.kept ? '（決まった値ではないので、その場に「入れ物.名前=…;」として残す。入れ物の初めの値は仮でよい）' : ''}、書き換え ${r.n} か所`,
    );
    console.log(
      `  ${Object.entries(r.files)
        .map(([f, c]) => `${f} ${c}`)
        .join('・')}`,
    );
    if (r.locals.length) console.log(`  書き換えなかった、同じ名前の局所の宣言：${r.locals.join('・')}`);
  }
  if (!dry) console.log(`書き換えた（${box}）。src/lib/state.ts の入れ物に初めの値を書き、src/game/imports.mjs で ${box} を読むこと`);
}
