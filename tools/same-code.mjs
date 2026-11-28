// TypeScript に移した関数が、移す前の古い関数と「同じ文」かを、構文の木で確かめる道具（翻訳の検証）。
//   node tools/same-code.mjs [--rev origin/main | --old <古い src/game>] [--state 入れ物:名前,名前 … | --auto-state] src/lib/xx.ts …（フォルダも渡せる）
// 新しい方の型を外し、型のために書き換えた決まった形（下の「規則」）を元の形に戻してから、古い JS の同じ名前の一番外の宣言と比べる。
// 比べるのは、古い JS から消えた名前だけ（src/lib の全部のファイルを渡してよい。今も古い JS にある同じ名前の別の物とは比べない）。
// 整形・括弧・引用符・コメントの違いは、構文の木の段階で消える。違いが残れば、その場所を出して 1 で終わる。
// 動かして比べるテストと違い、通るかどうかに関係なく全部の行を見る（係数・比べ方・乱数を引く順番・抜けた文を見つける）。
//
// 規則（どれも「そう書き換えても動きが変わらない」所だけ。止まる時の扱いは変わりうる）：
//   nth(a, i) → a[i]、lookup(o, k) → o[k]：範囲の外や無い欄では止まる（元は undefined）
//   o['k'] → o.k（k が名前にできる文字の時。両方に当てる）
//   must(x, '…') → x：x が null・undefined の時は止まる（元はその先で止まるか、黙って進む）
//   cssOf(c) → css(c)：表から読んだ色を css にする。色が無い・3つより少ない時は止まる（元は NaN の色か、その先で止まる）。そのファイルが cssOf を ./color.ts から読んでいる時だけ
//   level() → here.D：そのファイルの level が () => must(here.D, …) の時だけ
//   x ?? NaN → x：算術（- * / % **、もう片方が数と分かる +）・大小の比べ方・単項の - +・Math.* の引数の中だけ（undefined も NaN も同じ結果になる所）。
//     null は undefined と結果が違う（null * 2 は 0）が、道具は型を見ないので見分けられない。値が null にならない所でだけ ?? NaN を書くこと
//   Number(x) → x：算術（- * / %）の中だけ（算術は、もともと数に直してから計算する）
//   a op= b → a = a op b（両方に当てる。a は名前と欄の読み取りだけ）
//   使わない catch の引数は外す（両方に当てる）。使わない引数の頭の _ は外す（本体がどちらの名前も読まない時だけ）。ファイルの一番外の別名（const specials = SPECIALS など、型を広げるためだけの物）は
//   元の名前に戻す（const で、ファイルのどこでも書き換えず、関数の中でどちらかの名前を宣言し直していない時だけ）
//   ファイルの小さな道具（古い JS に無い名前の、const 名前 = (引数) => 式 の形の物）は、使う所で開く。渡す値が名前と欄の読み取りか定数で、
//   使う所で道具の中の名前を宣言し直さず、道具の中で渡す値の名前を宣言し直さない時だけ（toPlayer(m) → Math.hypot(m.x - player.x, m.z - player.z) など）。
//   ただし、古い方の関数も同じ名前で読んでいて、その名前を古い JS が src/game/imports.mjs でこのファイルから読んでいる道具（そのファイルが export する物。sndReady など）は、
//   古い方と同じ物を呼んでいるので開かない（export しない道具や、別のファイルから読んでいる名前と同じ名前の道具は開く）
//   古い JS が imports.mjs で別のファイルから読んでいる名前は、このファイルの同じ名前の物とは比べない（同じ名前の別の物。比べるのは読んでいるファイルの物）
//   一番外の文を関数に包んで移した物：今の古い JS の一番外の F();・if(!F())return;・x = 条件 ? F() : y; は、古い版の一番外の文（すぐ呼ぶ関数は中身を開く）を
//   F の本体の文の数だけ取って、古い側の関数 F にして比べる（詳しくは wrappedDecls）。ほかの一番外の文は、古い版と同じかを比べる
//   先に読む：const X = 式（式は名前と欄の読み取りだけか、数・名前とその計算だけでできた、ループや関数の内側でない所で1回だけ使うオブジェクト）、
//   const [a, b] = 式 の後ろで、X を式に戻す（両方に当てる。X を書き換えている・宣言し直している時と、式が読む名前をその先で宣言し直している時は戻さない。
//   古い方と新しい方の両方にある先読みは、消した所に印を残し、位置も比べる）
// 「先に読む」と「一番外の別名」は、間で式の中身が変わらないことを機械では言えないので、新しく足した物と、古い方にあって新しい方でやめた物を「人が確かめる一覧」に出す。
//
// 古い JS は、--rev の git の版（既定 HEAD）か、--old のフォルダから読む。状態を入れ物に移した名前は、--state で古い側にも同じ書き換え
// （tools/state-move.mjs の stateMove）をしてから比べる。--auto-state は、それを自分で見つける（古い JS から消えた変数の名前 X で、
// src/lib/state.ts の入れ物の欄として初めの値を書いてある物。CI はこれを使う。詳しくは detectStates）。
// 古い JS から消えた名前で、古い JS でも使われていなかった物と、今はどこからも使われていない物（呼ぶ所も一緒に消した物）は、
// 消しただけなので「消した」として出し、止めない（今も使っているかは、古い JS では名前がどの宣言を指すかで見る（gameUses。局所の同じ名前・欄の名前・コメントは数えない）。
// src/lib の .ts では文字で見る）。なので、移す時は名前を変えない。変えると「消した」に見えて比べない）。古い JS から消えた名前で、渡した .ts のどれにも無い物は「比べていない」として出す（これも 1 で終わる）。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import * as eslintScope from 'eslint-scope';
import { parseAst } from 'vite';
import { gameParts, gameSource } from './game-source.mjs';
import { fixed, stateMove } from './state-move.mjs';

const root = join(import.meta.dirname, '..');
const WRAP = '(function(){\n';

/** 文の一番外の宣言（関数と変数）を、名前 → { node, file, text, base（text の中で node の位置を引く量） } で集める */
function topDecls(body, file, text, base) {
  const out = new Map();
  for (let st of body) {
    if (st.type === 'ExportNamedDeclaration' && st.declaration) st = st.declaration;
    if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') out.set(st.id.name, { node: st, file, text, base });
    else if (st.type === 'VariableDeclaration')
      // 分けて読む形（const [a, b] = …・const {a, b} = …）は、作る名前ごとに、同じ宣言を持たせる
      for (const d of st.declarations)
        for (const name of boundNames(d.id))
          out.set(name, {
            node: { type: 'VariableDeclaration', kind: st.kind, declarations: [d], start: st.start },
            file,
            text,
            base,
          });
  }
  return out;
}
/** src/game/imports.mjs の文から、古い JS が読む名前 → 読むファイル（'src/lib/audio.ts' のように、リポジトリの根からの道） */
export function importedFrom(text) {
  const out = new Map();
  for (const st of parseAst(text, { lang: 'js' }).body)
    if (st.type === 'ImportDeclaration')
      for (const sp of st.specifiers) out.set(sp.local.name, join('src/game', st.source.value).replace(/\\/g, '/'));
  return out;
}
/** 古い JS（ファイル名 → 文）の一番外の宣言 */
export function legacyDecls(files) {
  const out = new Map();
  for (const [file, text] of files) {
    if (!/^\d{2}-[a-z0-9-]+\.js$/.test(file)) continue; // imports.mjs などは、包みの中の文ではない
    const body = parseAst(`${WRAP}${text}\n})`, { lang: 'js' }).body[0].expression.body.body;
    for (const [k, v] of topDecls(body, file, text, WRAP.length)) out.set(k, v);
  }
  return out;
}
/** フォルダの古い JS（名前の順の「2桁の番号-名前.js」） */
export const readGame = (dir) => new Map(gameParts(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));

// ---------------------------------------------------------------- 一番外の文を関数に包んで移した物
/**
 * 古い JS の一番外の文（すぐ呼ぶ関数は中身を開く）を、関数に包んで src/lib に移した物を、比べられる形にする。
 * 今の古い JS の一番外の文を、古い版の同じファイルの一番外の文と、順に突き合わせる：
 *   F();                  … 移した関数 F の本体の文の数だけ、古い版の文を取り、古い側の「関数 F」にする（取った文に包みから抜ける return; があれば違い）
 *   if(!F())return;       … 同じく（本体の最後は return true; でないと違い。それは数えない）。古い版の、包みから抜ける return; は return false; にし、最後に return true; を足す
 *   x = 条件 ? F() : y;   … 古い版の同じ形の文の、すぐ呼ぶ矢印の関数（(()=>{ … })()）の中身を、古い側の「関数 F」にする
 *   ほかの文              … 古い版の次の文と同じか（違えば mismatches に出す）。上の3つの形でも、古い版の次の文と同じなら、ただの文（前からある呼び出し）
 * F は、渡した .ts の一番外の関数で、今の古い JS に宣言が無い物。古い版の一番外の変数の宣言は、渡した .ts に同じ名前の一番外の宣言が無い物だけを文として数える
 * （ある物は、名前で比べる。無い物は、包んだ関数の中の局所の名前になったので absorbed に入れる）。
 * oldGame・nowGame はファイル名 → 文（oldGame は状態を入れ物に移した書き換えの後）。返すのは、古い側の関数の宣言（名前 → legacyDecls と同じ形）と、
 * 包んだ関数の中に入った古い変数の名前と、突き合わなかった文と、人が確かめる一覧
 */
export function wrappedDecls(oldGame, nowGame, files) {
  const decls = new Map(),
    absorbed = new Set(),
    mismatches = [],
    review = [];
  const tsFns = new Map(),
    tsTop = new Map();
  for (const { text, file } of files) {
    const body = parseAst(text, { lang: 'ts' }).body;
    for (const [k, v] of topDecls(body, file, text, 0)) {
      tsTop.set(k, { file, init: v.node.type === 'VariableDeclaration' ? v.node.declarations[0].init : null });
      if (v.node.type === 'FunctionDeclaration') tsFns.set(k, v.node.body.body);
    }
  }
  const nowDeclared = new Set(legacyDecls(nowGame).keys());
  const stmts = (text, keepVar) => {
    const out = [];
    for (const st of parseAst(`${WRAP}${text}\n})`, { lang: 'js' }).body[0].expression.body.body) {
      if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') continue;
      if (st.type === 'VariableDeclaration' && !keepVar(st)) continue;
      // すぐ呼ぶ関数 (function 名前(){ … })(); は、中身の文を並べる
      if (
        st.type === 'ExpressionStatement' &&
        st.expression.type === 'CallExpression' &&
        st.expression.callee.type === 'FunctionExpression' &&
        !st.expression.arguments.length
      ) {
        for (const b of st.expression.callee.body.body) out.push({ node: b, text, inFn: true });
        continue;
      }
      out.push({ node: st, text });
    }
    return out;
  };
  const src = (x) => x.text.slice(x.node.start - WRAP.length, x.node.end - WRAP.length);
  const calledFn = (n) =>
    n?.type === 'CallExpression' &&
    n.callee.type === 'Identifier' &&
    !n.arguments.length &&
    tsFns.has(n.callee.name) &&
    !nowDeclared.has(n.callee.name)
      ? n.callee.name
      : null;
  // 包みから抜ける return;（中の関数の return は数えない）を return false; にする
  // すぐ呼ぶ関数の中身を開いた文の return; は、その関数から抜ける物（包みからは抜けない）
  const exitsOf = (x) => {
    const at = [];
    if (x.inFn) return at;
    const walk = (n, inFn) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach((c) => walk(c, inFn));
      if (typeof n.type !== 'string') return;
      if (n.type === 'ReturnStatement' && !n.argument && !inFn) at.push(n);
      const fn = inFn || /Function/.test(n.type);
      for (const k in n) if (k !== 'type') walk(n[k], fn);
    };
    walk(x.node, false);
    return at;
  };
  const exitReturns = (x) => {
    const at = exitsOf(x);
    let t = src(x);
    const base = x.node.start;
    for (const r of at.sort((a, b) => b.start - a.start)) t = t.slice(0, r.start - base) + 'return false;' + t.slice(r.end - base);
    return t;
  };
  const make = (name, file, body) => {
    const text = `function ${name}(){\n${body}\n}`;
    decls.set(name, { node: parseAst(text, { lang: 'js' }).body[0], file, text, base: 0 });
  };
  // 古い版の変数の宣言で、名前が今の古い JS にも渡した .ts にも出てこず、初めの値が決まった値（数・文字列・それだけの配列など。何もしない）の物は、
  // 消した物（呼び出しの側の「消した」の一覧に出る）なので、突き合わせない。初めの値が何かする物（関数の呼び出しなど）は、消すと動きが変わるので突き合わせる
  const allNow = [...nowGame.values(), ...files.map((f) => f.text)].join('\n');
  const deletedVar = (x) =>
    x?.node.type === 'VariableDeclaration' &&
    x.node.declarations.every((d) => (!d.init || fixed(d.init)) && boundNames(d.id).every((nm) => !referenced(allNow, nm)));
  for (const [file, nowText] of nowGame) {
    if (!/^\d{2}-[a-z0-9-]+\.js$/.test(file)) continue;
    const oldText = oldGame.get(file);
    if (oldText === undefined) continue;
    // 名前で比べる宣言（.ts の一番外にも同じ名前がある）は、文の並びからは外す。.ts の側の初めの値が決まった値でなければ、
    // 古い JS では一番外の文の順に作っていた物を、モジュールを読んだ時に作るようになるので、人が確かめる一覧に出す（読む時に何かするか・乱数を引くか）
    const keepVar = (st) => {
      const names = st.declarations.flatMap((d) => boundNames(d.id)).filter((n) => tsTop.has(n));
      for (const n of names) {
        const t = tsTop.get(n);
        if (t.init && !fixed(t.init))
          review.push(`${t.file} の一番外：${n}（古い JS の一番外の宣言を、モジュールの一番外に移した。読み込んだ時に作られる）`);
      }
      return !names.length;
    };
    const olds = stmts(oldText, keepVar),
      nows = stmts(nowText, () => true);
    let i = 0;
    const take = (k, name) => {
      const got = olds.slice(i, i + k);
      i += k;
      if (got.length < k) mismatches.push({ file, old: '（無い）', new: `${name} の文 ${k} 個` });
      for (const g of got)
        if (g.node.type === 'VariableDeclaration') for (const d of g.node.declarations) for (const n of boundNames(d.id)) absorbed.add(n);
      return got;
    };
    for (const x of nows) {
      const n = x.node;
      while (deletedVar(olds[i])) i++;
      // 古い版の次の文と同じなら、ただの文（前からある呼び出し addLooks(); なども）
      if (olds[i] && key(olds[i].node) === key(n)) {
        i++;
        continue;
      }
      const f1 = n.type === 'ExpressionStatement' ? calledFn(n.expression) : null;
      const f2 =
        n.type === 'IfStatement' &&
        !n.alternate &&
        n.test.type === 'UnaryExpression' &&
        n.test.operator === '!' &&
        n.consequent.type === 'ReturnStatement' &&
        !n.consequent.argument
          ? calledFn(n.test.argument)
          : null;
      const cond =
        n.type === 'ExpressionStatement' &&
        n.expression.type === 'AssignmentExpression' &&
        n.expression.right.type === 'ConditionalExpression'
          ? n.expression
          : null;
      const f3 = cond ? calledFn(cond.right.consequent) : null;
      if (f1) {
        const got = take(tsFns.get(f1).length, f1);
        // 包みから抜ける return; は、関数に包むと、その関数から抜けるだけになる（後ろの文が走る）。if(!F())return; の形でないといけない
        if (got.some((g) => exitsOf(g).length))
          mismatches.push({ file, old: '包みから抜ける return; がある', new: `${f1}();（if(!${f1}())return; の形にする）` });
        else make(f1, file, got.map(src).join('\n'));
      } else if (f2) {
        const body = tsFns.get(f2),
          last = body[body.length - 1];
        // 本体の最後は return true;（呼ぶ所が、false の時だけ用意をやめる）
        if (!(last?.type === 'ReturnStatement' && last.argument?.type === 'Literal' && last.argument.value === true)) {
          mismatches.push({ file, old: '（本体の最後が return true; でない）', new: `if(!${f2}())return;` });
          i += body.length; // 古い版の文は、本体の文の数だけ読み飛ばす（後ろの文の突き合わせがずれないように）
        } else
          make(
            f2,
            file,
            take(body.length - 1, f2)
              .map(exitReturns)
              .join('\n') + '\nreturn true;',
          );
      } else if (f3) {
        const o = olds[i++],
          oc = o?.node.type === 'ExpressionStatement' && o.node.expression.type === 'AssignmentExpression' ? o.node.expression : null,
          iife = oc?.right.type === 'ConditionalExpression' ? oc.right.consequent : null;
        if (
          !iife ||
          iife.type !== 'CallExpression' ||
          iife.callee.type !== 'ArrowFunctionExpression' ||
          iife.callee.body.type !== 'BlockStatement' ||
          key(oc.left) !== key(cond.left) ||
          key(oc.right.test) !== key(cond.right.test) ||
          key(oc.right.alternate) !== key(cond.right.alternate)
        )
          mismatches.push({ file, old: o ? src(o) : '（無い）', new: src(x) });
        else make(f3, file, iife.callee.body.body.map((b) => src({ node: b, text: o.text })).join('\n'));
      } else {
        const o = olds[i++];
        if (!o || key(o.node) !== key(n)) mismatches.push({ file, old: o ? src(o) : '（無い）', new: src(x) });
      }
    }
    for (; i < olds.length; i++) if (!deletedVar(olds[i])) mismatches.push({ file, old: src(olds[i]), new: '（無い）' });
  }
  // 古い版にあって、今は無いファイルの一番外の文も、どこにも突き合わないので出す
  for (const [file, oldText] of oldGame)
    if (/^\d{2}-[a-z0-9-]+\.js$/.test(file) && !nowGame.has(file))
      for (const x of stmts(oldText, () => true)) if (!deletedVar(x)) mismatches.push({ file, old: src(x), new: '（ファイルが無い）' });
  return { decls, absorbed, mismatches, review };
}

// ---------------------------------------------------------------- 書き換えを元に戻す
const isCall = (n, name) => n?.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === name;
const ident = (name) => ({ type: 'Identifier', name });
const member = (object, property, computed) => ({ type: 'MemberExpression', object, property, computed, optional: false });
/** ?? NaN の印を外した形（先読みの一覧を、古い方と比べるため） */
const unMark = (n) => walk(n, (x) => (x.type === 'NaNDefault' ? unMark(x.expr) : undefined));
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
    // 使わない catch の引数は書かなくても同じ（catch (e) {…} と catch {…}）
    if (x.type === 'CatchClause' && x.param?.type === 'Identifier' && !uses(x.body, x.param.name).n)
      return { ...x, param: null, body: norm(x.body, ctx) };
    // 名前にできる文字の鍵の読み書き（o['lord']・lookup(o, 'lord')）は、欄の読み書き（o.lord）と同じ
    if (
      x.type === 'MemberExpression' &&
      x.computed &&
      x.property.type === 'Literal' &&
      typeof x.property.value === 'string' &&
      /^[A-Za-z_$][\w$]*$/.test(x.property.value)
    )
      return { ...x, object: norm(x.object, ctx), property: ident(x.property.value), computed: false };
    if (x.type !== 'AssignmentExpression' || !OPS[x.operator] || !isPath(x.left)) return undefined;
    ctx.hit('a op= b');
    const left = norm(x.left, ctx);
    return { ...x, operator: '=', left, right: { type: 'BinaryExpression', operator: OPS[x.operator], left, right: norm(x.right, ctx) } };
  });
}

/** nth・lookup・must・cssOf・level() を戻し、?? NaN には印（NaNDefault）を付ける（印は、使われる所を見てから外す） */
function undo(n, ctx) {
  return walk(n, (x) => {
    if ((isCall(x, 'nth') || isCall(x, 'lookup')) && x.arguments.length === 2) {
      ctx.hit(x.callee.name);
      return member(undo(x.arguments[0], ctx), undo(x.arguments[1], ctx), true);
    }
    if (isCall(x, 'must') && x.arguments.length >= 1) return (ctx.hit('must'), undo(x.arguments[0], ctx));
    if (ctx.cssOfIsColor && isCall(x, 'cssOf') && x.arguments.length === 1)
      return (ctx.hit('cssOf'), { ...x, callee: ident('css'), arguments: [undo(x.arguments[0], ctx)] });
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
/**
 * 数になると分かる式（数・単項の - +・算術・Math.* の呼び出し）。+ の中で ?? NaN を外すのは、もう片方がこれの時だけ（文字の変数との + は、undefined と NaN で結果が違う）。
 * ?? NaN の印の付いた物は数に数えない（(a ?? NaN) + (b ?? NaN) で、b が文字かもしれない）
 */
const isNum = (n) =>
  (n?.type === 'Literal' && typeof n.value === 'number') ||
  (n?.type === 'UnaryExpression' && (n.operator === '-' || n.operator === '+')) ||
  (n?.type === 'BinaryExpression' &&
    (['-', '*', '/', '%', '**'].includes(n.operator) || (n.operator === '+' && isNum(n.left) && isNum(n.right)))) ||
  (n?.type === 'CallExpression' &&
    n.callee.type === 'MemberExpression' &&
    n.callee.object.type === 'Identifier' &&
    n.callee.object.name === 'Math');
function resolveNaN(n, ctx) {
  return walk(n, (x) => {
    const fix = (child) => (child?.type === 'NaNDefault' ? (ctx.hit('?? NaN'), resolveNaN(child.expr, ctx)) : resolveNaN(child, ctx));
    if (x.type === 'BinaryExpression' && NUM_OPS.has(x.operator)) return { ...x, left: fix(x.left), right: fix(x.right) };
    if (x.type === 'BinaryExpression' && x.operator === '+')
      return {
        ...x,
        left: isNum(x.right) ? fix(x.left) : resolveNaN(x.left, ctx),
        right: isNum(x.left) ? fix(x.right) : resolveNaN(x.right, ctx),
      };
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
/** 宣言の形（名前・分けて読む形・既定値・残り）が作る名前 */
function boundNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) boundNames(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const e of p.elements) boundNames(e, out);
  else if (p.type === 'RestElement') boundNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') boundNames(p.left, out);
  return out;
}
/** この物が宣言する名前（変数・引数・catch の引数・関数とクラスの名前） */
function declares(n) {
  if (n.type === 'VariableDeclarator') return boundNames(n.id);
  if (n.type === 'CatchClause') return boundNames(n.param);
  if (n.type?.includes('Function')) return [...(n.id ? [n.id.name] : []), ...n.params.flatMap((p) => boundNames(p))];
  if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') return n.id ? [n.id.name] : [];
  return [];
}
/** name を使う数・書き換えるか・同じ名前を宣言し直すか */
function uses(n, name, acc = { n: 0, write: false, shadow: false }) {
  if (Array.isArray(n)) n.forEach((x) => uses(x, name, acc));
  else if (n && typeof n === 'object') {
    if (n.type === 'Identifier' && n.name === name) acc.n++;
    const target = n.type === 'AssignmentExpression' ? n.left : n.type === 'UpdateExpression' ? n.argument : null;
    if (target && boundNames(target).includes(name)) acc.write = true;
    if (declares(n).includes(name)) acc.shadow = true;
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
/** 式が読む名前（欄の名前 a.name の name や、オブジェクトの鍵は除く） */
function readNames(n) {
  const out = new Set();
  walk(n, (x, parent, k) => {
    if (
      x.type === 'Identifier' &&
      !(k === 'property' && parent?.type === 'MemberExpression' && !parent.computed) &&
      !(k === 'key' && parent && !parent.computed)
    )
      out.add(x.name);
    return undefined;
  });
  return out;
}
/** name を、ループか関数の内側で使っている数（その外で1回作った物を、内側で何度も使うと、物の同一性が変わる） */
function usesInLoops(n, name, inside = false) {
  if (Array.isArray(n)) return n.reduce((a, x) => a + usesInLoops(x, name, inside), 0);
  if (!n || typeof n !== 'object') return 0;
  const loop = inside || /^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(n.type) || n.type?.includes('Function');
  let c = n.type === 'Identifier' && n.name === name && inside ? 1 : 0;
  for (const k in n)
    if (k !== 'type' && !(k === 'property' && n.type === 'MemberExpression' && !n.computed) && !(k === 'key' && !n.computed))
      c += usesInLoops(n[k], name, loop);
  return c;
}
/** 名前 → 式 の表の名前を、まとめて1回で置き換える（置き換えた式の中は見ない） */
const substMany = (n, map) =>
  walk(n, (x, parent, key) => {
    if (x.type !== 'Identifier' || !map.has(x.name)) return undefined;
    if ((key === 'property' && parent?.type === 'MemberExpression' && !parent.computed) || (key === 'key' && parent && !parent.computed))
      return x;
    return map.get(x.name);
  });
/** オブジェクトの別名に入れてよい値（数・文字・名前と、その計算だけ。欄の読み取りや呼び出しは入れない） */
const plain = (n) =>
  n?.type === 'Literal' ||
  n?.type === 'Identifier' ||
  (n?.type === 'UnaryExpression' && plain(n.argument)) ||
  (n?.type === 'BinaryExpression' && plain(n.left) && plain(n.right));
/**
 * 先に読む書き換えを元に戻す。見つけた物を found に足す（where：関数の名前）。
 * mark に入っている先読み（古い方と新しい方の両方にある物）は、消した所に印を残す（両方で同じ位置にあるかも比べるため）
 */
function unalias(n, where, found, show, mark = new Set()) {
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
            // オブジェクトは、数・名前とその計算だけでできていて、ループや関数の内側でない所で1回だけ使う物
            const obj =
              u.n === 1 &&
              dc.init.type === 'ObjectExpression' &&
              dc.init.properties.every((p) => p.type === 'Property' && plain(p.value)) &&
              !usesInLoops([restDecls, tail], dc.id.name);
            if (!isPath(dc.init) && !obj) continue;
            names = [dc.id.name];
            exprs = [dc.init];
            found.push(`${where}：${dc.id.name} = ${show(unMark(dc.init))}`);
          } else if (dc.id.type === 'ArrayPattern' && dc.init && isPath(dc.init) && dc.id.elements.every((e) => e?.type === 'Identifier')) {
            names = dc.id.elements.map((e) => e.name);
            exprs = names.map((_, k) => member(dc.init, { type: 'Literal', value: k }, true));
            found.push(`${where}：[${names.join(', ')}] = ${show(unMark(dc.init))}`);
          } else continue;
          // 先読みした名前を書き換える・宣言し直す所があるか、置き換える式が読む名前を、その先で宣言し直している（捕まる）なら戻さない
          const reads = new Set(exprs.flatMap((e) => [...readNames(e)]));
          if (
            names.some((nm) => {
              const u = uses([restDecls, tail], nm);
              return u.write || u.shadow;
            }) ||
            [...reads].some((nm) => {
              // 式が読む名前を、その先で宣言し直す（捕まる）か、書き換える（i++ など。読む時が変わる）
              const u = uses([restDecls, tail], nm);
              return u.shadow || u.write;
            })
          ) {
            found.pop();
            continue;
          }
          const markIt = mark.has(found[found.length - 1]);
          let decls = restDecls,
            rest = tail;
          names.forEach((nm, k) => {
            decls = subst(decls, nm, exprs[k]);
            rest = subst(rest, nm, exprs[k]);
          });
          const before = st.declarations.slice(0, d),
            stmt = (ds) => (ds.length ? [{ ...st, declarations: ds }] : []);
          // 並びが変わったので、この入れ物を初めから見直す（印を残す時は、宣言を印の前と後ろに分ける）
          const next = markIt
            ? [...list.slice(0, i), ...stmt(before), { type: 'AliasMark', text: found[found.length - 1] }, ...stmt(decls), ...rest]
            : [...list.slice(0, i), ...stmt([...before, ...decls]), ...rest];
          return unalias({ ...x, [key]: next }, where, found, show, mark);
        }
      }
    }
    return undefined;
  });
}

/** ファイルの小さな道具を、使う所で開く（渡す値が名前と欄の読み取りか定数で、使う所が道具の中の名前を宣言し直していない時だけ） */
function inlineHelpers(fnNode, helpers, opened) {
  const free = (f) => {
    const names = new Set();
    walk(f.body, (x, parent, k) => {
      if (
        x.type === 'Identifier' &&
        !(k === 'property' && parent?.type === 'MemberExpression' && !parent.computed) &&
        !(k === 'key' && parent && !parent.computed)
      )
        names.add(x.name);
      return undefined;
    });
    for (const p of f.params) names.delete(p.name);
    return names;
  };
  const okArg = (a) => a?.type === 'Literal' || isPath(a);
  return walk(fnNode, (x) => {
    if (x.type !== 'CallExpression' || x.callee.type !== 'Identifier') return undefined;
    const f = helpers.get(x.callee.name);
    if (!f || f.params.length !== x.arguments.length || !x.arguments.every(okArg)) return undefined;
    // 道具の中の名前を、使う所で宣言し直している時と、渡す値が読む名前を、道具の中で宣言し直している時（捕まる）は開かない
    if ([...free(f)].some((nm) => uses(fnNode, nm).shadow)) return undefined;
    if (x.arguments.some((a) => [...readNames(a)].some((nm) => uses(f.body, nm).shadow))) return undefined;
    // 引数はまとめて1回で置き換える（1つずつ置き換えると、前に入れた値の中の名前まで、後の引数で置き換えてしまう）
    const body = substMany(f.body, new Map(f.params.map((p, i) => [p.name, x.arguments[i]])));
    opened(x.callee.name);
    return body;
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
  // BigInt の数は value と、同じ値の文字 bigint の両方を持つ
  'bigint',
]);
const TS_ONLY = new Set(['abstract', 'override', 'implements', 'superTypeArguments', 'accessibility', 'readonly']);
/** 比べる時に落とす欄か（canon と diff が同じ決まりで落とす） */
function dropped(n, k) {
  const v = n[k];
  // value の null は、数などの値（null の値）と見分けるために残す。ただし TS の残りの引数（...a: T[]）は、型の欄と一緒に value: null を持つ（JS には無い）ので落とす
  if (SKIP.has(k) || v === undefined || (v === null && (k !== 'value' || n.type === 'RestElement'))) return true;
  // TS だけが付ける欄（クラスの abstract・override・implements など）は、空なら JS と同じ
  if (TS_ONLY.has(k) && (v === false || (Array.isArray(v) && !v.length))) return true;
  // 名前の optional は TS の ? だけ（a?.b の optional は残す）
  return k === 'optional' && (v === false || n.type === 'Identifier' || n.type === 'ArrayPattern' || n.type === 'ObjectPattern');
}
/** 比べる形：位置・raw・型の欄などを落とす（名前の optional は TS の ? だけなので落とす。a?.b の optional は残す） */
function canon(n) {
  if (typeof n === 'bigint') return `${n}n`;
  if (Array.isArray(n)) return n.map(canon);
  if (!n || typeof n !== 'object') return n;
  const o = {};
  for (const k of Object.keys(n).sort()) if (!dropped(n, k)) o[k] = canon(n[k]);
  return o;
}
const key = (n) => JSON.stringify(canon(n));
/** 違う所を、いちばん小さい組で集める（文の並びの長さが違う時は、同じ文で並びを揃える） */
function diff(a, b, out, pa = null, pb = null) {
  if (key(a) === key(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b) && a.type === b.type) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      // 片方にだけ null や空の欄がある（読み方の違い）のは、違いではない
      if (dropped(a, k) && dropped(b, k)) continue;
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
  if (typeof n === 'bigint') return `${n}n`;
  if (!n || typeof n !== 'object') return JSON.stringify(n);
  switch (n.type) {
    case 'Identifier':
      return n.name;
    case 'ObjectExpression':
      return `{ ${n.properties.map((p) => (p.type === 'Property' ? `${show(p.key)}: ${show(p.value)}` : p.type)).join(', ')} }`;
    case 'Literal':
      return n.value === undefined ? String(n.raw) : typeof n.value === 'bigint' ? `${n.value}n` : JSON.stringify(n.value);
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
      return `${n.operator}${/^[a-z]/.test(n.operator) ? ' ' : ''}${show(n.argument)}`;
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
 * 新しい .ts の文（{ file, text } の並び）を、古い JS の宣言 old（legacyDecls）と比べる（only を渡したら、その名前だけ）。
 * imported は、古い JS が imports.mjs で読む名前 → 読むファイル（importedFrom。file と同じ書き方の道）。古い方と同じ物を呼んでいる道具を開かないために使う。
 * importedNow は、今の imports.mjs の同じ物。移した名前を、読んでいるファイルの物とだけ比べるために使う
 * 返り値：関数ごとの結果 results（違い diffs は { old: 古い所, new: 新しい所, oldLine, newLine }）、人が確かめる一覧 review、当てた規則の数 used、比べた名前 compared
 */
export function compareSources(old, files, only = null, imported = new Map(), importedNow = new Map()) {
  const used = {},
    review = [],
    results = [],
    compared = new Set();
  const hit = (k) => (used[k] = (used[k] ?? 0) + 1);
  for (const { file, text } of files) {
    const ast = parseAst(text, { lang: 'ts' }),
      NEW = topDecls(ast.body, file, text, 0),
      exported = new Set(
        ast.body.flatMap((st) =>
          st.type === 'ExportNamedDeclaration' && st.declaration ? [...topDecls([st.declaration], file, text, 0).keys()] : [],
        ),
      );
    // level が () => must(here.D, …) か
    const lv = NEW.get('level')?.node.declarations?.[0]?.init;
    const levelIsHereD =
      lv?.type === 'ArrowFunctionExpression' &&
      lv.params.length === 0 &&
      isCall(lv.body, 'must') &&
      show(lv.body.arguments[0]) === 'here.D';
    // cssOf が ./color.ts から読んだ物か（自分で定めた同じ名前の物には、規則を当てない）
    const cssOfIsColor = ast.body.some(
      (st) =>
        st.type === 'ImportDeclaration' &&
        st.source.value === './color.ts' &&
        st.specifiers.some((sp) => sp.type === 'ImportSpecifier' && sp.local.name === 'cssOf' && sp.imported.name === 'cssOf'),
    );
    // ファイルの一番外の別名（古い JS に無い名前で、初めの値が名前だけの const。ファイルのどこでも書き換えない物）
    const tops = [...NEW].filter(
      ([k, v]) =>
        !old.has(k) &&
        v.node.type === 'VariableDeclaration' &&
        v.node.kind === 'const' &&
        v.node.declarations[0].init?.type === 'Identifier' &&
        !uses(ast.body, k).write,
    );
    // ファイルの小さな道具（本体が式1つの矢印関数。level は上の規則で戻す）
    const helpers = new Map(
      [...NEW].flatMap(([k, v]) => {
        const f = v.node.type === 'VariableDeclaration' && v.node.kind === 'const' ? v.node.declarations[0].init : null;
        return !old.has(k) &&
          k !== 'level' &&
          f?.type === 'ArrowFunctionExpression' &&
          f.body.type !== 'BlockStatement' &&
          f.params.every((p) => p.type === 'Identifier')
          ? [[k, unType(f)]]
          : [];
      }),
    );
    const ctx = { hit, levelIsHereD, cssOfIsColor };
    for (const [name, nd] of NEW) {
      const od = old.get(name);
      // only を渡したら、その名前だけ（古い JS から消えた名前。今も古い JS にある同じ名前の別の物と取り違えないため）
      if (!od || (only && !only.has(name))) continue;
      // 古い JS がその名前を imports.mjs で別のファイルから読んでいれば、こちらは同じ名前の別の物（text.ts の中だけの frame と、loop.ts の frame など）
      if (importedNow.has(name) && importedNow.get(name) !== file) continue;
      compared.add(name);
      const o0 = norm(od.node, ctx);
      let n = unType(nd.node);
      // 古い方も同じ名前で読んでいて、古い JS がその名前をこのファイルから import している道具（このファイルが export する物）は、
      // 古い方と同じ物を呼んでいるので開かない（sndReady など）
      const open = new Map([...helpers].filter(([k]) => !(uses(od.node, k).n && exported.has(k) && imported.get(k) === file)));
      for (let round = 0; round < 5; round++) {
        const before = key(n);
        n = inlineHelpers(n, open, (k) => {
          const line = `${basename(file)} の道具を開いた：${k}`;
          if (!review.includes(line)) review.push(line);
        });
        if (key(n) === before) break;
      }
      n = unNumber(norm(undo(n, ctx), ctx), ctx);
      // 関数の中で、別名か元の名前を宣言し直していれば戻さない（違いとして出る）
      for (const [k, v] of tops) {
        const orig = v.node.declarations[0].init;
        if (!uses(n, k).n || uses(n, k).shadow || uses(n, orig.name).shadow) continue;
        n = subst(n, k, orig);
        const line = `${basename(file)} の一番外：${k} = ${orig.name}`;
        if (!review.includes(line)) review.push(line);
      }
      // 先に読む書き換え：まず両方の先読みを集め、両方にある物は、消した所に印を残して位置も比べる
      const oldFound = [],
        newFound = [];
      unalias(o0, name, oldFound, show);
      unalias(n, name, newFound, show);
      const shared = new Set(oldFound.filter((x) => newFound.includes(x)));
      const o = unalias(o0, name, [], show, shared);
      n = resolveNaN(unalias(n, name, [], show, shared), ctx);
      // 使わない引数の名前の頭の _ は外す
      // （本体がどちらの名前も読まない時だけ。外の同じ名前を読んでいると、別の物を同じと言ってしまうため）
      const fn = n.params ? n : n.declarations?.[0]?.init;
      for (const p of fn?.params ?? [])
        if (p.type === 'Identifier' && p.name.startsWith('_') && !uses(fn.body, p.name).n && !uses(fn.body, p.name.slice(1)).n)
          p.name = p.name.slice(1);
      // 古い方にも同じ「先に読む」があれば、新しく足した物ではない
      const had = new Set(oldFound);
      review.push(...newFound.filter((x) => !had.has(x)));
      // 古い方の「先に読む」を、新しい方でやめた物（読む時が遅くなる）
      const now = new Set(newFound);
      review.push(...oldFound.filter((x) => !now.has(x)).map((x) => `${x}（古い方の先読みを、やめた）`));
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

/**
 * 古い JS の名前 name が、古い JS の中で、自分の宣言の外から使われていなかったか（使っていない物を消しただけなら、比べる物は無い）。
 * 文字で数えるので、コメントや文字列に名前があれば「使われていた」になる（止まる方に倒れる）
 */
export function wasUnused(oldGame, old, name) {
  const d = old.get(name);
  if (!d) return false;
  const re = new RegExp(`(?<![\\w$.])${escapeRe(name)}(?![\\w$])`, 'g'),
    count = (t) => (t.match(re) ?? []).length;
  const all = [...oldGame].filter(([f]) => /^\d{2}-[a-z0-9-]+\.js$/.test(f)).reduce((a, [, t]) => a + count(t), 0),
    own = count(d.text.slice(firstPos(d.node) - d.base, lastPos(d.node) - d.base));
  return all - own === 0;
}
/**
 * 古い JS（dir の src/game/ をつないだ物）の中で、名前 names のうち、名前として使っている物（eslint-scope で見分ける）。
 * 包みの一番外の宣言か、imports.mjs で読んだ名前か、どこにも無い名前を指す所だけを数える
 * （同じ名前の局所の変数・引数を指す所と、欄の名前・コメント・文字列は数えない）
 */
export function gameUses(dir, names) {
  const ast = parseAst(gameSource({ dir }), { lang: 'js' });
  // oxc の位置（start・end）を、eslint-scope が読む range に写す
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n.type === 'string' && typeof n.start === 'number') n.range = [n.start, n.end];
    for (const k in n) if (k !== 'range') walk(n[k]);
  };
  walk(ast);
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: 'module', fallback: 'iteration' }),
    outer = (sc) => sc.type === 'module' || (sc.type === 'function' && sc.upper?.type === 'module'),
    used = new Set();
  for (const sc of sm.scopes)
    for (const r of sc.references)
      if (names.has(r.identifier.name) && (!r.resolved || outer(r.resolved.scope))) used.add(r.identifier.name);
  return used;
}
/** 正規表現の中で、文字をそのままの意味にする（記号を全部逃がす） */
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 文 text の中で、名前 name を使っているか（欄の名前 a.name の name は数えない。文字で数えるので、コメントや文字列にあれば「使っている」になる） */
export function referenced(text, name) {
  return new RegExp(`(?<![\\w$.])${escapeRe(name)}(?![\\w$])`).test(text);
}
/** src/lib の .ts（git に入っている物） */
const libFiles = () =>
  execFileSync('git', ['ls-files', 'src/lib'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts'));
/** 構文の木の中で、いちばん後ろの位置 */
function lastPos(n) {
  let m = -1;
  walk(n, (x) => {
    if (typeof x.end === 'number' && x.end > m) m = x.end;
    return undefined;
  });
  return m;
}
/** git の版 rev の src/game（ファイル名 → 文） */
function readRev(rev) {
  const names = execFileSync('git', ['ls-tree', '--name-only', rev, 'src/game/'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  return new Map(names.map((p) => [basename(p), execFileSync('git', ['show', `${rev}:${p}`], { cwd: root, encoding: 'utf8' })]));
}
/** 古い JS（ファイル名 → 文）に、状態を入れ物に移す書き換え（tools/state-move.mjs の stateMove）を当てた物。一時フォルダで行う */
function withStates(game, states) {
  if (!states.length) return game;
  const dir = mkdtempSync(join(tmpdir(), 'same-code-'));
  try {
    for (const [f, t] of game) writeFileSync(join(dir, f), t);
    for (const s of states) stateMove({ dir, box: s.box, names: s.names });
    return readGame(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
/** src/lib/state.ts の入れ物（export const 名前 = { … }）ごとの、初めの値を書いた欄の名前 */
export function boxFields(stateText) {
  const out = new Map();
  for (const st of parseAst(stateText, { lang: 'ts' }).body) {
    const d = st.type === 'ExportNamedDeclaration' && st.declaration?.type === 'VariableDeclaration' ? st.declaration.declarations : [];
    for (const dc of d)
      if (dc.id.type === 'Identifier' && dc.init?.type === 'ObjectExpression')
        out.set(
          dc.id.name,
          new Set(
            dc.init.properties.flatMap((p) => (p.type === 'Property' && !p.computed && p.key.type === 'Identifier' ? [p.key.name] : [])),
          ),
        );
  }
  return out;
}
/**
 * 状態を入れ物に移した名前を見つける：古い JS から消えた変数の名前 X で、src/lib/state.ts の入れ物の欄として初めの値を書いてある物
 * （状態を移す時は、必ず入れ物に初めの値を書く。tools/state-move.mjs）。同じ名前の欄が2つ以上の入れ物にある時は、今の文（古い JS と src/lib）に
 * 「入れ物.X」がある入れ物に絞る。それでも1つに決まらない物は見つけない（「比べていない」として止まる）。
 * fields は boxFields の返り値。返り値は stateMove に渡す形 [{ box, names }]
 */
export function detectStates(old, gone, text, fields) {
  const by = new Map();
  for (const x of gone) {
    if (old.get(x)?.node.type !== 'VariableDeclaration') continue;
    let cand = [...fields].filter(([, keys]) => keys.has(x)).map(([b]) => b);
    if (cand.length > 1) cand = cand.filter((b) => new RegExp(`(?<![\\w$.])${escapeRe(b)}\\.${escapeRe(x)}(?![\\w$])`).test(text));
    if (cand.length === 1) (by.get(cand[0]) ?? by.set(cand[0], []).get(cand[0])).push(x);
  }
  return [...by].map(([box, names]) => ({ box, names }));
}

// ---------------------------------------------------------------- コマンドとして
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const args = process.argv.slice(2),
    states = [],
    files = [];
  let rev = 'HEAD',
    oldDir = null,
    auto = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rev') rev = args[++i];
    else if (args[i] === '--old') oldDir = args[++i];
    else if (args[i] === '--auto-state') auto = true;
    else if (args[i] === '--state') {
      const [box, names] = args[++i].split(':');
      states.push({ box, names: names.split(',') });
    } else if (args[i].startsWith('--')) {
      console.log(`知らない指定：${args[i]}`);
      files.length = 0;
      break;
    } else if (statSync(args[i]).isDirectory())
      // フォルダは、その中の全部の .ts（.d.ts は除く）
      files.push(
        ...readdirSync(args[i], { recursive: true })
          .map(String)
          .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
          .sort()
          .map((f) => join(args[i], f)),
      );
    else files.push(args[i]);
  }
  if (!files.length) {
    console.log(
      '使い方：node tools/same-code.mjs [--rev origin/main | --old <古い src/game>] [--state 入れ物:名前,名前 … | --auto-state] src/lib/xx.ts …',
    );
    process.exit(2);
  }
  const rawOld = oldDir ? readGame(oldDir) : readRev(rev),
    nowGame = readGame(join(root, 'src/game')),
    now = legacyDecls(nowGame),
    sources = files.map((f) => ({ file: relative(root, f), text: readFileSync(f, 'utf8') }));
  if (auto) {
    // 状態の入れ物の欄と、今の文（古い JS と src/lib の全部）
    const fields = boxFields(readFileSync(join(root, 'src/lib/state.ts'), 'utf8')),
      text = [...nowGame.values(), ...libFiles().map((f) => readFileSync(join(root, f), 'utf8'))].join('\n'),
      old0 = legacyDecls(rawOld),
      gone0 = [...old0.keys()].filter((k) => !now.has(k));
    // .ts に同じ名前の一番外の宣言がある物は、状態ではなく移した物
    const tsNames = new Set(sources.flatMap((s) => [...topDecls(parseAst(s.text, { lang: 'ts' }).body, s.file, s.text, 0).keys()]));
    const found = detectStates(
      old0,
      gone0.filter((k) => !tsNames.has(k)),
      text,
      fields,
    );
    for (const s of found) console.log(`状態を入れ物に移したと見た：${s.names.map((n) => `${s.box}.${n}`).join('、')}`);
    states.push(...found);
  }
  const old = legacyDecls(withStates(rawOld, states));
  // 一番外の文を関数に包んで移した物（wrappedDecls）：古い側の関数として足し、ほかの関数と同じ規則で比べる
  const wrapped = wrappedDecls(withStates(rawOld, states), nowGame, sources);
  for (const [k, v] of wrapped.decls) if (!old.has(k)) old.set(k, v);
  // 比べるのは、古い JS から消えた名前だけ（src/lib の名前が、今も古い JS にある別の物と同じ名前のこともある）
  const goneAll = new Set([...old.keys()].filter((k) => !now.has(k)));
  // 古い JS が imports.mjs で読む名前（--rev は、その版の imports.mjs。--old は、そのフォルダの imports.mjs）
  const importsText = oldDir
    ? existsSync(join(oldDir, 'imports.mjs'))
      ? readFileSync(join(oldDir, 'imports.mjs'), 'utf8')
      : ''
    : (rawOld.get('imports.mjs') ?? '');
  const nowImports = join(root, 'src/game/imports.mjs');
  const { results, review, used, compared } = compareSources(
    old,
    sources,
    goneAll,
    importedFrom(importsText),
    importedFrom(existsSync(nowImports) ? readFileSync(nowImports, 'utf8') : ''),
  );
  let bad = 0;
  for (const m of wrapped.mismatches) {
    console.log(`✗ src/game/${m.file} の一番外の文が、古い版と違う`);
    console.log(`    古 ${m.old.slice(0, 220)}`);
    console.log(`    新 ${m.new.slice(0, 220)}`);
    bad++;
  }
  for (const r of results) {
    console.log(`${r.diffs.length ? '✗' : '✓'} ${r.file} ${r.name}${r.diffs.length ? `：違い ${r.diffs.length}` : ''}`);
    for (const d of r.diffs) {
      console.log(`    古 src/game/${r.oldFile}:${d.oldLine}  ${d.old.slice(0, 220)}`);
      console.log(`    新 ${r.file}:${d.newLine}  ${d.new.slice(0, 220)}`);
    }
    bad += r.diffs.length;
  }
  // 古い JS から消えたのに、渡した .ts で比べていない名前。古い JS でも使われていなかった物と、今はどこからも使われていない物（呼ぶ所も一緒に消した物）は、
  // 消しただけなので止めない（名前を変えて移すと、ここで「消した」に見えてしまうので、移す時は名前を変えない）
  const unchecked = [...goneAll].filter((k) => !compared.has(k) && !wrapped.absorbed.has(k)),
    oldGame = withStates(rawOld, states),
    // 今も使っているか：古い JS は名前がどの宣言を指すかで（局所の同じ名前は別の物）、src/lib の .ts は文字で見る
    gameUsed = gameUses(join(root, 'src/game'), new Set(unchecked)),
    libText = libFiles()
      .map((f) => readFileSync(join(root, f), 'utf8'))
      .join('\n'),
    deleted = unchecked.filter((k) => wasUnused(oldGame, old, k) || !(gameUsed.has(k) || referenced(libText, k))),
    gone = unchecked.filter((k) => !deleted.includes(k));
  if (deleted.length) console.log(`\n消した（古い JS でも使われていなかったか、今はどこからも使われていない）：${deleted.join('、')}`);
  if (gone.length) console.log(`\n比べていない（古い JS から消えたが、渡した .ts に無い）：${gone.join('、')}`);
  review.push(...wrapped.review);
  if (review.length) console.log(`\n人が確かめる（間で中身が変わらないこと）${review.length} 件\n  ${review.join('\n  ')}`);
  console.log(`\n比べた ${results.length}　違い ${bad}　当てた規則 ${JSON.stringify(used)}`);
  process.exit(bad || gone.length ? 1 : 0);
}
