// テストの道具：音を鳴らす所が、見た目の乱数（mr・mpick・roll・Math.random）を引いていないかを、構文の木で調べる。
// 音は音の乱数（sndRand。src/lib/random.ts）を使う。見た目の乱数を引くと、音を足したり鳴らす頻度を変えたりしただけで、
// テスト用モードの見た目の乱数の並びがずれ、粒子の位置などが変わって、画面写真の基準が変わる。
// 見た目の乱数は、呼ぶ形（mr()）と、関数の値として渡す形（shuffle(a, mr)）の両方を数える。ファイルの中で同じ名前を自分で宣言していれば
// （audio.ts の中の「鳴らすか」の roll など）、そのファイルではその名前を数えない。
// 調べる形（どれかに当たれば、その場所を返す）：
//   1. 音を鳴らす関数の引数の中で引く（sDrip(x, z, 0.2 + mr()) など）
//   2. if の条件で引き、中身は音を鳴らすだけ（if(mr()<0.3)sBubble(…) など。中で音のほかのこともする所は、ゲームの判定なので調べない）
//   3. 音だけの処理の中で引く（if(…sndReady()){…} の中と、if(!sndReady())return で始まる関数の中）
//   4. 音を鳴らすブロックの中で、時刻（clock.time・performance.now()・currentTime）を使う次に鳴らす時刻を、引いた値で決める
//      （時刻に足す値だけ。オブジェクトと配列の中の値は見ない）
//   5. 引いた値を変数に入れてから、1〜4の所で使う（const v = mr(); … sDrip(x, z, v)）。変数から変数へ移す形（const a = mr(); const b = a * 2;）も追う。
//      止めるのは、変数を読む所が全部、1〜4の所か、ほかの「そういう変数」に入れる所の時だけ。音のほかのことにも使う変数（罠を見つけたかの判定、
//      粒子の位置など）は止めない。場所は、引いた所（const v = mr() の行）を返す。
// 音を鳴らす関数は、src/lib/audio.ts の s で始まる export と、本体が if(!sndReady())return で始まる関数（function の宣言と、名前を付けた関数の式・矢印関数）。
// 変数は、関数の中で宣言した物だけを追う（名前がどの宣言を指すかは eslint-scope で見分ける。中の関数から読む所も数える）。追いきれない形（見ない）：
//   - 一番外の変数（モジュールと、古い JS を包んだ関数の一番外）：ほかのファイルからも読まれうるので、読む所を全部は見られず、音だけに使うかを決められない
//   - 関数の引数と返り値を経る形（play(mr()) で、play が引数を音だけに使う、など）と、オブジェクトの欄を経る形（m.t = mr(); … sDrip(0, 0, m.t)）
//   今の src/ で、引数を音だけに使う関数（音を鳴らす関数のほか）は grabItem（位置を渡す）くらいで、一番外の変数とオブジェクトの欄にも、
//   見た目の乱数を入れて音に使う物は無いので、そこまでは追わない。src/lib/audio.ts と詠唱の声は、別に丸ごと調べる（audio.test.mjs）。
import { parseAst } from 'vite';
import * as eslintScope from 'eslint-scope';

const VISUAL = ['mr', 'mpick', 'roll', 'Math.random'];
const TIME = /\bclock\.time\b|\bperformance\.now\(|\bcurrentTime\b/;
const kids = (n) =>
  Object.values(n)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v) => v && typeof v.type === 'string');
const walk = (n, fn) => {
  fn(n);
  for (const k of kids(n)) walk(k, fn);
};
const nameOf = (c) =>
  c.callee.type === 'Identifier'
    ? c.callee.name
    : c.callee.type === 'MemberExpression' && !c.callee.computed && c.callee.object.type === 'Identifier'
      ? `${c.callee.object.name}.${c.callee.property.name}`
      : null;
// 木の部分ごとの、中の呼び出しの一覧（何度も聞かれるので、一度作ったら覚えておく）
const callCache = new WeakMap();
const callsIn = (n) => {
  let out = callCache.get(n);
  if (!out) {
    out = n.type === 'CallExpression' ? [n] : [];
    for (const k of kids(n)) out = out.concat(callsIn(k));
    callCache.set(n, out);
  }
  return out;
};
const isGuard = (st) =>
  st?.type === 'IfStatement' &&
  st.test.type === 'UnaryExpression' &&
  st.test.operator === '!' &&
  st.test.argument.type === 'CallExpression' &&
  nameOf(st.test.argument) === 'sndReady';

// n の中で、names の物を呼ぶ所（mr()）と、関数の値として使う所（shuffle(a, mr)）。宣言の名前・欄の名前・import の名前は数えない
const refCache = new WeakMap();
function valueRefs(n, names) {
  let byNames = refCache.get(n);
  if (!byNames) refCache.set(n, (byNames = new Map()));
  const key = [...names].join(',');
  let out = byNames.get(key);
  if (out) return out;
  out = [];
  const visit = (x, parent, field) => {
    if (x.type === 'CallExpression' && names.has(nameOf(x))) out.push(x);
    else if (
      x.type === 'MemberExpression' &&
      names.has('Math.random') &&
      !x.computed &&
      x.object.type === 'Identifier' &&
      x.object.name === 'Math' &&
      x.property.name === 'random' &&
      !(parent?.type === 'CallExpression' && field === 'callee')
    )
      out.push(x);
    else if (
      x.type === 'Identifier' &&
      names.has(x.name) &&
      !(parent?.type === 'CallExpression' && field === 'callee') &&
      !(parent?.type === 'MemberExpression' && field === 'property' && !parent.computed) &&
      !(parent?.type === 'Property' && field === 'key' && !parent.computed) &&
      !(parent?.type === 'VariableDeclarator' && field === 'id') &&
      !(parent?.type === 'FunctionDeclaration' && field === 'id') &&
      !String(parent?.type).startsWith('Import')
    )
      out.push(x);
    for (const [f, v] of Object.entries(x)) for (const k of Array.isArray(v) ? v : [v]) if (k && typeof k.type === 'string') visit(k, x, f);
  };
  visit(n, null, null);
  byNames.set(key, out);
  return out;
}

// 名前がどの宣言を指すかは eslint-scope で見分ける。TypeScript の型の部分は見ない（as・! などは中の式だけを見る）
const TS_EXPR = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'TSInstantiationExpression']);
const SKIP = new Set(['typeAnnotation', 'returnType', 'typeParameters', 'typeArguments', 'range']);
function scopes(ast) {
  walk(ast, (n) => (n.range = [n.start, n.end]));
  return eslintScope.analyze(ast, {
    ecmaVersion: 2024,
    sourceType: 'module',
    fallback: (n) =>
      n.type.startsWith('TS')
        ? TS_EXPR.has(n.type)
          ? ['expression']
          : []
        : Object.keys(n).filter((k) => !SKIP.has(k) && kids({ [k]: n[k] }).length),
  });
}
const inside = (x, n) => x.start >= n.start && x.end <= n.end;

/**
 * files：[{ name, text }]（name が game/ で始まる物は古い JS として、関数で包んで読む。.ts は TypeScript として読む）。
 * audioNames：src/lib/audio.ts の音を鳴らす関数の名前。返り値：['name:行 どの形'] の一覧（見つかった音を鳴らす関数の名前も返す）
 */
export function soundRandomCheck(files, audioNames) {
  const parsed = files.map(({ name, text }) => {
    const legacy = name.startsWith('game/');
    return {
      name,
      text,
      off: legacy ? 13 : 0,
      ast: parseAst(legacy ? `(function(){\n${text}\n})` : text, { lang: name.endsWith('.ts') ? 'ts' : 'js' }),
    };
  });
  const sound = new Set(audioNames);
  const guarded = (f) =>
    f && ['FunctionExpression', 'ArrowFunctionExpression'].includes(f.type) && f.body.type === 'BlockStatement' && isGuard(f.body.body[0]);
  for (const { ast } of parsed)
    walk(ast, (n) => {
      if (n.type === 'FunctionDeclaration' && n.id && isGuard(n.body.body[0])) sound.add(n.id.name);
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && guarded(n.init)) sound.add(n.id.name);
    });
  const sounds = (n) => callsIn(n).filter((c) => sound.has(nameOf(c)));
  // 中身が音を鳴らすだけか（音を鳴らす呼び出しの文だけ）
  const soundOnly = (st) =>
    st.type === 'BlockStatement'
      ? st.body.length > 0 && st.body.every(soundOnly)
      : st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && sound.has(nameOf(st.expression));
  const bad = [];
  for (const p of parsed) {
    // このファイルで自分で宣言している名前は、見た目の乱数として数えない
    const own = new Set();
    walk(p.ast, (n) => {
      if ((n.type === 'VariableDeclarator' || n.type === 'FunctionDeclaration') && n.id?.type === 'Identifier') own.add(n.id.name);
    });
    const names = new Set(VISUAL.filter((v) => !own.has(v)));
    const direct = (n) => valueRefs(n, names);
    const line = (node) => p.text.slice(0, Math.max(0, node.start - p.off)).split('\n').length;
    const seen = new Set(); // もう出した、見た目の乱数を直に引く所（同じ所を、変数を経た形として二度出さない）
    const at = (node, why) => {
      for (const d of direct(node)) seen.add(d);
      bad.push(`${p.name}:${line(node)} ${why}`);
    };

    // 引いた値を入れた変数（関数の中で宣言した物）。書き込む式に、見た目の乱数か、引いた値を入れた変数があれば、その変数も引いた値を入れた物
    const sm = scopes(p.ast);
    // 一番外（モジュールと、古い JS を包んだ関数）の変数は追わない（ほかのファイルからも読まれうるので、読む所を全部は見られない）
    const wrapper = p.off ? p.ast.body[0].expression : null;
    const vars = sm.scopes
      .flatMap((sc) => sc.variables)
      .filter((v) => v.scope.variableScope.type === 'function' && v.scope.variableScope.block !== wrapper);
    const tainted = new Set();
    for (let grew = true; grew;) {
      grew = false;
      for (const v of vars)
        if (
          !tainted.has(v) &&
          v.references.some(
            (r) =>
              r.writeExpr &&
              (direct(r.writeExpr).length ||
                [...tainted].some((t) => t.references.some((u) => u.isRead() && inside(u.identifier, r.writeExpr)))),
          )
        ) {
          tainted.add(v);
          grew = true;
        }
    }
    const refVar = new Map(); // 読む所の名前の節 → 変数
    for (const v of tainted) for (const r of v.references) if (r.isRead()) refVar.set(r.identifier, v);
    const visual = (n) => direct(n).concat([...refVar.keys()].filter((id) => inside(id, n)));
    const sinks = new Map(); // 読む所 → どの形か
    // 見つけた所：見た目の乱数を直に引いていれば、その場所を返す。引いた値を入れた変数を読む所は、音に使う所として覚える
    const hit = (refs, node, why) => {
      if (refs.some((r) => !refVar.has(r))) at(node ?? refs.find((r) => !refVar.has(r)), why);
      for (const r of refs) if (refVar.has(r) && !sinks.has(r)) sinks.set(r, why);
    };
    walk(p.ast, (n) => {
      if (n.type === 'CallExpression' && sound.has(nameOf(n)))
        for (const a of n.arguments) for (const v of visual(a)) hit([v], null, `${nameOf(n)} の引数`);
      if (n.type === 'IfStatement' && visual(n.test).length && soundOnly(n.consequent)) hit(visual(n.test), n, 'if の条件で、音を鳴らすか');
      if (n.type === 'IfStatement' && !isGuard(n) && callsIn(n.test).some((c) => nameOf(c) === 'sndReady'))
        for (const v of visual(n.consequent)) hit([v], null, 'sndReady の中');
      const fn = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type) ? n.body : null;
      if (fn?.type === 'BlockStatement' && isGuard(fn.body[0])) for (const v of visual(fn)) hit([v], null, '音を鳴らす関数の中');
      if ((n.type === 'BlockStatement' || n.type === 'Program') && n.body.some((s) => sounds(s).length))
        for (const s of n.body) {
          if (s.type !== 'ExpressionStatement' || s.expression.type !== 'AssignmentExpression') continue;
          // 時刻に足す値だけを見る。オブジェクトと配列の中の値（b.morph = { from, t0: clock.time } の from など）は、時刻ではない
          const right = s.expression.right,
            lits = [];
          walk(right, (x) => (x.type === 'ObjectExpression' || x.type === 'ArrayExpression') && lits.push(x));
          const refs = visual(right).filter((r) => !lits.some((l) => inside(r, l)));
          if (refs.length && TIME.test(p.text.slice(s.start - p.off, s.end - p.off))) hit(refs, s, '次に鳴らす時刻');
        }
    });
    // 引いた値を入れた変数のうち、読む所が全部、音に使う所か、ほかの「音だけに使う変数」に入れる所の物（ゲームの判定にも使う変数は止めない）
    const flowsTo = (r) => [...tainted].filter((w) => w.references.some((u) => u.writeExpr && inside(r.identifier, u.writeExpr)));
    const reads = (v) => v.references.filter((r) => r.isRead());
    const only = new Set(tainted);
    for (let shrank = true; shrank;) {
      shrank = false;
      for (const v of only)
        if (!reads(v).every((r) => sinks.has(r.identifier) || flowsTo(r).some((w) => only.has(w)))) {
          only.delete(v);
          shrank = true;
        }
    }
    // 音に届く道（変数の名前の並びと、どの形か）
    const route = new Map();
    for (let grew = true; grew;) {
      grew = false;
      for (const v of only) {
        if (route.has(v)) continue;
        const r0 = reads(v).find((r) => sinks.has(r.identifier));
        const via = r0
          ? null
          : reads(v)
              .flatMap(flowsTo)
              .find((w) => route.has(w) && w !== v);
        if (r0 || via) {
          route.set(
            v,
            r0 ? { names: [v.name], why: sinks.get(r0.identifier) } : { names: [v.name, ...route.get(via).names], why: route.get(via).why },
          );
          grew = true;
        }
      }
    }
    const found = [...route].flatMap(([v, { names: ns, why }]) =>
      v.references.flatMap((r) => (r.writeExpr ? direct(r.writeExpr) : [])).map((d) => ({ d, why: `変数 ${ns.join('・')} を経て ${why}` })),
    );
    for (const { d, why } of found.sort((a, b) => a.d.start - b.d.start)) if (!seen.has(d)) at(d, why);
  }
  return { bad: [...new Set(bad)], sound: [...sound].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
}
