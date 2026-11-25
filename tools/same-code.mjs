// TypeScript に移した関数が、移す前の古い関数と「同じ文」かを、構文の木で確かめる道具（翻訳の検証）。
//   node tools/same-code.mjs [--rev main | --old <古い src/game>] [--state 入れ物:名前,名前 …] src/lib/xx.ts …
// 新しい方の型を外し、型のために書き換えた決まった形（下の「規則」）を元の形に戻してから、古い JS の同じ名前の一番外の宣言と比べる。
// 整形・括弧・引用符・コメントの違いは、構文の木の段階で消える。違いが残れば、その場所を出して 1 で終わる。
// 動かして比べるテストと違い、通るかどうかに関係なく全部の行を見る（係数・比べ方・乱数を引く順番・抜けた文を見つける）。
//
// 規則（どれも「そう書き換えても動きが変わらない」所だけ。止まる時の扱いは変わりうる）：
//   nth(a, i) → a[i]、lookup(o, k) → o[k]：範囲の外や無い欄では止まる（元は undefined）
//   must(x, '…') → x：x が null・undefined の時は止まる（元はその先で止まるか、黙って進む）
//   level() → here.D：そのファイルの level が () => must(here.D, …) の時だけ
//   x ?? NaN → x：算術（- * / % **、文字でない物との +）・大小の比べ方・単項の - +・Math.* の引数の中だけ（undefined も NaN も同じ結果になる所）
//   Number(x) → x：算術（- * / %）の中だけ（算術は、もともと数に直してから計算する）
//   a op= b → a = a op b（両方に当てる。a は名前と欄の読み取りだけ）
//   使わない引数の頭の _ は外す。ファイルの一番外の別名（const specials = SPECIALS など、型を広げるためだけの物）は元の名前に戻す
//   先に読む：const X = 式（式は名前と欄の読み取りだけか、1回だけ使うオブジェクト）、const [a, b] = 式 の後ろで、X を式に戻す（両方に当てる）
// 「先に読む」と「一番外の別名」は、間で式の中身が変わらないことを機械では言えないので、新しく足した物を「人が確かめる一覧」に出す。
//
// 古い JS は、--rev の git の版（既定 HEAD）か、--old のフォルダから読む。状態を入れ物に移した名前は、--state で古い側にも同じ書き換え
// （tools/state-move.mjs の stateMove）をしてから比べる。古い JS から消えた名前で、渡した .ts のどれにも無い物は「比べていない」として出す（これも 1 で終わる）。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { parseAst } from 'vite';
import { gameParts } from './game-source.mjs';
import { stateMove } from './state-move.mjs';

const root = join(import.meta.dirname, '..');
const WRAP = '(function(){\n';

/** 文の一番外の宣言（関数と変数）を、名前 → { node, file, text, base（text の中で node の位置を引く量） } で集める */
function topDecls(body, file, text, base) {
  const out = new Map();
  for (let st of body) {
    if (st.type === 'ExportNamedDeclaration' && st.declaration) st = st.declaration;
    if (st.type === 'FunctionDeclaration') out.set(st.id.name, { node: st, file, text, base });
    else if (st.type === 'VariableDeclaration')
      for (const d of st.declarations)
        if (d.id.type === 'Identifier')
          out.set(d.id.name, {
            node: { type: 'VariableDeclaration', kind: st.kind, declarations: [d], start: st.start },
            file,
            text,
            base,
          });
  }
  return out;
}
/** 古い JS（ファイル名 → 文）の一番外の宣言 */
export function legacyDecls(files) {
  const out = new Map();
  for (const [file, text] of files) {
    const body = parseAst(`${WRAP}${text}\n})`, { lang: 'js' }).body[0].expression.body.body;
    for (const [k, v] of topDecls(body, file, text, WRAP.length)) out.set(k, v);
  }
  return out;
}
/** フォルダの古い JS（名前の順の「2桁の番号-名前.js」） */
export const readGame = (dir) => new Map(gameParts(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));

// ---------------------------------------------------------------- 書き換えを元に戻す
const isCall = (n, name) => n?.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === name;
const ident = (name) => ({ type: 'Identifier', name });
const member = (object, property, computed) => ({ type: 'MemberExpression', object, property, computed, optional: false });
/** 名前と欄の読み取りだけの式（here.D・def.vy・c[0]・V[E[i]] など。?? NaN の印が付いた物も） */
const isPath = (n) =>
  n?.type === 'Identifier' ||
  (n?.type === 'NaNDefault' && isPath(n.expr)) ||
  (n?.type === 'MemberExpression' && isPath(n.object) && (!n.computed || n.property.type === 'Literal' || isPath(n.property)));

/** 子をたどって写す（f が値を返せば、それに置き換える） */
function walk(n, f, parent = null, key = null) {
  if (Array.isArray(n)) return n.map((x) => walk(x, f, parent, key));
  if (!n || typeof n !== 'object') return n;
  const r = f(n, parent, key);
  if (r !== undefined) return r;
  const o = {};
  for (const k in n) o[k] = walk(n[k], f, n, k);
  return o;
}

/** 型だけの書き方（as・satisfies・後ろの !）を外す */
const unType = (n) =>
  walk(n, (x) =>
    ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion'].includes(x.type)
      ? unType(x.expression)
      : undefined,
  );

/** a op= b → a = a op b */
const OPS = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%' };
function norm(n, ctx) {
  return walk(n, (x) => {
    if (x.type !== 'AssignmentExpression' || !OPS[x.operator] || !isPath(x.left)) return undefined;
    ctx.hit('a op= b');
    const left = norm(x.left, ctx);
    return { ...x, operator: '=', left, right: { type: 'BinaryExpression', operator: OPS[x.operator], left, right: norm(x.right, ctx) } };
  });
}

/** nth・lookup・must・level() を戻し、?? NaN には印（NaNDefault）を付ける（印は、使われる所を見てから外す） */
function undo(n, ctx) {
  return walk(n, (x) => {
    if ((isCall(x, 'nth') || isCall(x, 'lookup')) && x.arguments.length === 2) {
      ctx.hit(x.callee.name);
      return member(undo(x.arguments[0], ctx), undo(x.arguments[1], ctx), true);
    }
    if (isCall(x, 'must') && x.arguments.length >= 1) return (ctx.hit('must'), undo(x.arguments[0], ctx));
    if (ctx.levelIsHereD && isCall(x, 'level') && x.arguments.length === 0)
      return (ctx.hit('level'), member(ident('here'), ident('D'), false));
    if (x.type === 'LogicalExpression' && x.operator === '??' && x.right.type === 'Identifier' && x.right.name === 'NaN')
      return { type: 'NaNDefault', expr: undo(x.left, ctx), start: x.start };
    return undefined;
  });
}
/** 算術（- * / %）の中の Number(x) → x */
function unNumber(n, ctx) {
  return walk(n, (x, parent, key) => {
    const arith =
      parent?.type === 'BinaryExpression' && ['-', '*', '/', '%'].includes(parent.operator) && (key === 'left' || key === 'right');
    if (arith && isCall(x, 'Number') && x.arguments.length === 1) return (ctx.hit('Number'), unNumber(x.arguments[0], ctx));
    return undefined;
  });
}
/** ?? NaN の印を、undefined と NaN が同じ結果になる所だけ外す（ほかは残り、違いとして出る） */
const NUM_OPS = new Set(['-', '*', '/', '%', '**', '<', '>', '<=', '>=']);
const isText = (n) => (n?.type === 'Literal' && typeof n.value === 'string') || n?.type === 'TemplateLiteral';
function resolveNaN(n, ctx) {
  return walk(n, (x) => {
    const fix = (child) => (child?.type === 'NaNDefault' ? (ctx.hit('?? NaN'), resolveNaN(child.expr, ctx)) : resolveNaN(child, ctx));
    if (x.type === 'BinaryExpression' && (NUM_OPS.has(x.operator) || (x.operator === '+' && !isText(x.left) && !isText(x.right)))) {
      return { ...x, left: fix(x.left), right: fix(x.right) };
    }
    if (x.type === 'UnaryExpression' && (x.operator === '-' || x.operator === '+')) return { ...x, argument: fix(x.argument) };
    if (
      x.type === 'CallExpression' &&
      x.callee.type === 'MemberExpression' &&
      x.callee.object.type === 'Identifier' &&
      x.callee.object.name === 'Math'
    )
      return { ...x, arguments: x.arguments.map((a) => fix(a)) };
    return undefined;
  });
}

// ---------------------------------------------------------------- 先に読む
/** name を使う数・書き換えるか・同じ名前を宣言し直すか */
function uses(n, name, acc = { n: 0, write: false, shadow: false }) {
  if (Array.isArray(n)) n.forEach((x) => uses(x, name, acc));
  else if (n && typeof n === 'object') {
    if (n.type === 'Identifier' && n.name === name) acc.n++;
    const target = n.type === 'AssignmentExpression' ? n.left : n.type === 'UpdateExpression' ? n.argument : null;
    if (target?.type === 'Identifier' && target.name === name) acc.write = true;
    if (
      (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name) ||
      ((n.type === 'FunctionDeclaration' || n.type.includes('Function')) &&
        n.params?.some((p) => p.type === 'Identifier' && p.name === name))
    )
      acc.shadow = true;
    for (const k in n)
      if (k !== 'type' && !(k === 'property' && n.type === 'MemberExpression' && !n.computed) && !(k === 'key' && !n.computed))
        uses(n[k], name, acc);
  }
  return acc;
}
/** name を expr に置き換える（欄の名前 a.name の name や、オブジェクトの鍵は名前ではない） */
const subst = (n, name, expr) =>
  walk(n, (x, parent, key) => {
    if (x.type !== 'Identifier' || x.name !== name) return undefined;
    if ((key === 'property' && parent?.type === 'MemberExpression' && !parent.computed) || (key === 'key' && parent && !parent.computed))
      return x;
    return expr;
  });
/** 先に読む書き換えを元に戻す。見つけた物を found に足す（where：関数の名前） */
function unalias(n, where, found, show) {
  return walk(n, (x) => {
    for (const key of ['body', 'consequent']) {
      const list = x[key];
      if (!Array.isArray(list)) continue;
      for (let i = 0; i < list.length; i++) {
        const st = list[i];
        if (st?.type !== 'VariableDeclaration' || st.kind !== 'const') continue;
        for (let d = 0; d < st.declarations.length; d++) {
          const dc = st.declarations[d],
            restDecls = st.declarations.slice(d + 1),
            tail = list.slice(i + 1);
          let names, exprs;
          if (dc.id.type === 'Identifier' && dc.init) {
            const u = uses([restDecls, tail], dc.id.name);
            if (!isPath(dc.init) && !(u.n === 1 && dc.init.type === 'ObjectExpression')) continue;
            names = [dc.id.name];
            exprs = [dc.init];
            found.push(`${where}：${dc.id.name} = ${show(dc.init)}`);
          } else if (dc.id.type === 'ArrayPattern' && dc.init && isPath(dc.init) && dc.id.elements.every((e) => e?.type === 'Identifier')) {
            names = dc.id.elements.map((e) => e.name);
            exprs = names.map((_, k) => member(dc.init, { type: 'Literal', value: k }, true));
            found.push(`${where}：[${names.join(', ')}] = ${show(dc.init)}`);
          } else continue;
          if (
            names.some((nm) => {
              const u = uses([restDecls, tail], nm);
              return u.write || u.shadow;
            })
          ) {
            found.pop();
            continue;
          }
          let decls = restDecls,
            rest = tail;
          names.forEach((nm, k) => {
            decls = subst(decls, nm, exprs[k]);
            rest = subst(rest, nm, exprs[k]);
          });
          decls = [...st.declarations.slice(0, d), ...decls];
          // 並びが変わったので、この入れ物を初めから見直す
          return unalias(
            { ...x, [key]: [...list.slice(0, i), ...(decls.length ? [{ ...st, declarations: decls }] : []), ...rest] },
            where,
            found,
            show,
          );
        }
      }
    }
    return undefined;
  });
}

// ---------------------------------------------------------------- 比べる
const SKIP = new Set([
  'start',
  'end',
  'range',
  'raw',
  'loc',
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'decorators',
  'definite',
  'declare',
]);
/** 比べる形：位置・raw・型の欄などを落とす（名前の optional は TS の ? だけなので落とす。a?.b の optional は残す） */
function canon(n) {
  if (Array.isArray(n)) return n.map(canon);
  if (!n || typeof n !== 'object') return n;
  const o = {};
  for (const k of Object.keys(n).sort()) {
    if (SKIP.has(k) || n[k] === undefined || (n[k] === null && k !== 'value')) continue;
    if (k === 'optional' && (n[k] === false || n.type === 'Identifier' || n.type === 'ArrayPattern' || n.type === 'ObjectPattern'))
      continue;
    o[k] = canon(n[k]);
  }
  return o;
}
const key = (n) => JSON.stringify(canon(n));
/** 違う所を、いちばん小さい組で集める（文の並びの長さが違う時は、同じ文で並びを揃える） */
function diff(a, b, out, pa = null, pb = null) {
  if (key(a) === key(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b) && a.type === b.type) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      // 片方にだけ null の欄がある（読み方の違い）のは、違いではない
      if (SKIP.has(k) || (a[k] == null && b[k] == null && k !== 'value')) continue;
      diff(a[k], b[k], out, a, b);
    }
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const A = a.map(key),
      B = b.map(key),
      L = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0,
      j = 0,
      ga = [],
      gb = [];
    const flush = () => {
      if (ga.length === gb.length) ga.forEach((x, k) => diff(x, gb[k], out, pa, pb));
      else if (ga.length || gb.length) out.push({ a: ga, b: gb, pa, pb });
      ga = [];
      gb = [];
    };
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && A[i] === B[j]) {
        flush();
        i++;
        j++;
      } else if (j < b.length && (i >= a.length || L[i][j + 1] >= L[i + 1][j])) gb.push(b[j++]);
      else ga.push(a[i++]);
    }
    flush();
    return;
  }
  out.push({ a, b, pa, pb });
}
/** 構文の木を、だいたいの JS に戻して見せる（短く） */
function show(n) {
  if (n === undefined) return '（無い）';
  if (Array.isArray(n)) return n.length ? n.map(show).join('; ') : '（無い）';
  if (!n || typeof n !== 'object') return JSON.stringify(n);
  switch (n.type) {
    case 'Identifier':
      return n.name;
    case 'Literal':
      return n.value === undefined ? String(n.raw) : JSON.stringify(n.value);
    case 'NaNDefault':
      return `(${show(n.expr)} ?? NaN)`;
    case 'MemberExpression':
      return `${show(n.object)}${n.computed ? `[${show(n.property)}]` : `.${show(n.property)}`}`;
    case 'CallExpression':
      return `${show(n.callee)}(${n.arguments.map(show).join(', ')})`;
    case 'BinaryExpression':
    case 'LogicalExpression':
      return `(${show(n.left)} ${n.operator} ${show(n.right)})`;
    case 'UnaryExpression':
      return `${n.operator}${show(n.argument)}`;
    case 'ConditionalExpression':
      return `(${show(n.test)} ? ${show(n.consequent)} : ${show(n.alternate)})`;
    case 'VariableDeclarator':
      return `${show(n.id)} = ${show(n.init)}`;
    case 'VariableDeclaration':
      return `${n.kind} ${n.declarations.map(show).join(', ')}`;
    case 'ExpressionStatement':
      return show(n.expression);
    case 'AssignmentExpression':
      return `${show(n.left)} ${n.operator} ${show(n.right)}`;
    case 'ArrayPattern':
    case 'ArrayExpression':
      return `[${n.elements.map(show).join(', ')}]`;
    case 'ReturnStatement':
      return `return ${show(n.argument)}`;
    case 'IfStatement':
      return `if (${show(n.test)}) …`;
    case 'ForStatement':
    case 'ForOfStatement':
    case 'ForInStatement':
    case 'WhileStatement':
      return `${n.type.replace('Statement', '')} …`;
    case 'BlockStatement':
      return `{ ${n.body.length} 文 }`;
    default:
      return n.type;
  }
}
/** 構文の木の中で、いちばん初めに位置を持つ物の位置 */
function firstPos(n) {
  if (Array.isArray(n)) {
    for (const x of n) {
      const p = firstPos(x);
      if (p !== undefined) return p;
    }
    return undefined;
  }
  if (!n || typeof n !== 'object') return undefined;
  if (typeof n.start === 'number') return n.start;
  for (const k in n) {
    const p = firstPos(n[k]);
    if (p !== undefined) return p;
  }
  return undefined;
}
const lineAt = (text, pos) => (pos === undefined ? '?' : text.slice(0, pos).split('\n').length);

/**
 * 新しい .ts の文（{ file, text } の並び）を、古い JS の宣言 old（legacyDecls）と比べる。
 * 返り値：関数ごとの結果 results（違い diffs は { old: 古い所, new: 新しい所, oldLine, newLine }）、人が確かめる一覧 review、当てた規則の数 used、比べた名前 compared
 */
export function compareSources(old, files) {
  const used = {},
    review = [],
    results = [],
    compared = new Set();
  const hit = (k) => (used[k] = (used[k] ?? 0) + 1);
  for (const { file, text } of files) {
    const ast = parseAst(text, { lang: 'ts' }),
      NEW = topDecls(ast.body, file, text, 0);
    // level が () => must(here.D, …) か
    const lv = NEW.get('level')?.node.declarations?.[0]?.init;
    const levelIsHereD =
      lv?.type === 'ArrowFunctionExpression' &&
      lv.params.length === 0 &&
      isCall(lv.body, 'must') &&
      show(lv.body.arguments[0]) === 'here.D';
    // ファイルの一番外の別名（古い JS に無い名前で、初めの値が名前だけの物）
    const tops = [...NEW].filter(
      ([k, v]) => !old.has(k) && v.node.type === 'VariableDeclaration' && v.node.declarations[0].init?.type === 'Identifier',
    );
    for (const [k, v] of tops) review.push(`${basename(file)} の一番外：${k} = ${v.node.declarations[0].init.name}`);
    const ctx = { hit, levelIsHereD };
    for (const [name, nd] of NEW) {
      const od = old.get(name);
      if (!od) continue;
      compared.add(name);
      const oldFound = [],
        newFound = [];
      const o = unalias(norm(od.node, ctx), name, oldFound, show);
      let n = unNumber(norm(undo(unType(nd.node), ctx), ctx), ctx);
      for (const [k, v] of tops) n = subst(n, k, v.node.declarations[0].init);
      n = resolveNaN(unalias(n, name, newFound, show), ctx);
      // 使わない引数の名前の頭の _ は外す
      for (const p of n.params ?? n.declarations?.[0]?.init?.params ?? [])
        if (p.type === 'Identifier' && p.name.startsWith('_')) p.name = p.name.slice(1);
      // 古い方にも同じ「先に読む」があれば、新しく足した物ではない
      const had = new Set(oldFound);
      review.push(...newFound.filter((x) => !had.has(x)));
      const out = [];
      diff(o, n, out);
      results.push({
        file,
        name,
        oldFile: od.file,
        diffs: out.map((d) => {
          // 葉の値（数など）で違った時は、それを持つ物の位置
          const po = firstPos(d.a) ?? firstPos(d.pa),
            pn = firstPos(d.b) ?? firstPos(d.pb);
          return {
            old: show(d.a),
            new: show(d.b),
            oldLine: lineAt(od.text, po === undefined ? undefined : po - od.base),
            newLine: lineAt(text, pn),
          };
        }),
      });
    }
  }
  return { results, review, used, compared };
}

/** git の版 rev の src/game を一時フォルダに写し、--state の書き換えをしてから読む */
function gameAtRev(rev, states) {
  const dir = mkdtempSync(join(tmpdir(), 'same-code-'));
  try {
    const names = execFileSync('git', ['ls-tree', '--name-only', rev, 'src/game/'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    for (const p of names)
      writeFileSync(join(dir, basename(p)), execFileSync('git', ['show', `${rev}:${p}`], { cwd: root, encoding: 'utf8' }));
    for (const s of states) stateMove({ dir, box: s.box, names: s.names });
    return readGame(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- コマンドとして
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const args = process.argv.slice(2),
    states = [],
    files = [];
  let rev = 'HEAD',
    oldDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rev') rev = args[++i];
    else if (args[i] === '--old') oldDir = args[++i];
    else if (args[i] === '--state') {
      const [box, names] = args[++i].split(':');
      states.push({ box, names: names.split(',') });
    } else files.push(args[i]);
  }
  if (!files.length) {
    console.log('使い方：node tools/same-code.mjs [--rev main | --old <古い src/game>] [--state 入れ物:名前,名前 …] src/lib/xx.ts …');
    process.exit(2);
  }
  if (oldDir && states.length) {
    console.log('--old のフォルダには --state を当てない（写したフォルダに、先に tools/state-move.mjs を当てること）');
    process.exit(2);
  }
  const oldGame = oldDir ? readGame(oldDir) : gameAtRev(rev, states),
    old = legacyDecls(oldGame),
    now = legacyDecls(readGame(join(root, 'src/game')));
  const { results, review, used, compared } = compareSources(
    old,
    files.map((f) => ({ file: relative(root, f), text: readFileSync(f, 'utf8') })),
  );
  let bad = 0;
  for (const r of results) {
    console.log(`${r.diffs.length ? '✗' : '✓'} ${r.file} ${r.name}${r.diffs.length ? `：違い ${r.diffs.length}` : ''}`);
    for (const d of r.diffs) {
      console.log(`    古 src/game/${r.oldFile}:${d.oldLine}  ${d.old.slice(0, 220)}`);
      console.log(`    新 ${r.file}:${d.newLine}  ${d.new.slice(0, 220)}`);
    }
    bad += r.diffs.length;
  }
  // 古い JS から消えたのに、渡した .ts で比べていない名前
  const gone = [...old.keys()].filter((k) => !now.has(k) && !compared.has(k));
  if (gone.length) console.log(`\n比べていない（古い JS から消えたが、渡した .ts に無い）：${gone.join('、')}`);
  if (review.length) console.log(`\n人が確かめる（間で中身が変わらないこと）${review.length} 件\n  ${review.join('\n  ')}`);
  console.log(`\n比べた ${results.length}　違い ${bad}　当てた規則 ${JSON.stringify(used)}`);
  process.exit(bad || gone.length ? 1 : 0);
}
