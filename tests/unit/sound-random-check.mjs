// テストの道具：音を鳴らす所が、見た目の乱数（mr・mpick・roll・Math.random）を引いていないかを、構文の木で調べる。
// 音は音の乱数（sndRand。src/lib/random.ts）を使う。見た目の乱数を引くと、音を足したり鳴らす頻度を変えたりしただけで、
// テスト用モードの見た目の乱数の並びがずれ、粒子の位置などが変わって、画面写真の基準が変わる。
// 見た目の乱数は、呼ぶ形（mr()）と、関数の値として渡す形（shuffle(a, mr)）の両方を数える。ファイルの中で同じ名前を自分で宣言していれば
// （audio.ts の中の「鳴らすか」の roll など）、そのファイルではその名前を数えない。
// 調べる形（どれかに当たれば、その場所を返す）：
//   1. 音を鳴らす関数の引数の中で引く（sDrip(x, z, 0.2 + mr()) など）
//   2. if の条件で引き、中身は音を鳴らすだけ（if(mr()<0.3)sBubble(…) など。else があれば、else も音を鳴らすだけの時。
//      中や else で音のほかのこともする所と、中の if の条件でゲームの処理を呼ぶ所は、ゲームの判定なので調べない）
//   3. 音だけの処理の中で引く（if(…sndReady()){…} の中と、if(!sndReady())return で始まる関数の中）
//   4. 次に鳴らす時刻を、引いた値で決める（if(clock.time>t0){ t0=clock.time+6+mr()*5; sPing(1); }）。次に鳴らす時刻と見るのは、
//      入れる文が、時刻（clock.time・performance.now()・currentTime）と入れる先を比べる if の中（then か else）か、その if(…)return の後ろにあり、
//      その範囲が音のことだけをする時（音を鳴らす呼び出し・入れる先への代入・音の引数と入れる先への代入にだけ使う変数の宣言・条件も中身も音だけの if。
//      if の条件に sndReady() があれば、中身は問わない）。比べた結果や入れる先を変数に入れてから比べる形（const due = clock.time > m.t; if(due){…}）も数える。
//      入れる文がある関数の中身が音のことだけをする時は、その関数を呼ぶ所が、時刻と入れる先を比べる if で決められている形も数える
//      （if(clock.time>m.dripT) dripNow(m) と、dripNow の中の m.dripT=clock.time+mr()*3。入れる先が欄の時だけ。名前は関数ごとに別の物なので）。
//      入れる先は、名前なら同じ宣言の物、欄（m.hissT など）なら同じ書き方の物と比べる。音のほかのことも決める時刻（攻撃の待ち時間など）は、
//      見た目やゲームの時刻なので見ない。値は、時刻と同じ式の中の物だけ（オブジェクトと配列は、値が入っている欄・要素の中に時刻がある時だけ）
//   5. 引いた値を変数に入れてから、1〜4の所で使う（const v = mr(); … sDrip(x, z, v)）。変数から変数へ移す形（const a = mr(); const b = a * 2;）と、
//      その場で変える形（p *= 0.5）も追う。分割代入（const [a, b] = [mr(), 0.3]）は、名前ごとに入る値の式だけを見る（分からない形は右の式全体）。
//      止めるのは、変数を読む所が全部、1〜4の所か、ほかの「そういう変数」に入れる所の時だけ。音のほかのことにも使う変数（罠を見つけたかの判定、
//      粒子の位置など）は止めない。場所は、引いた所（const v = mr() の行）を返す。
// 音を鳴らす関数は、src/lib/audio.ts の s で始まる export と、本体が if(!sndReady())return で始まる関数（function の宣言と、名前を付けた関数の式・矢印関数）。
// 変数は、関数の中で宣言した物だけを追う（名前がどの宣言を指すかは eslint-scope で見分ける。中の関数から読む所も数える）。追いきれない形（見ない）：
//   - 一番外の変数（モジュールと、古い JS を包んだ関数の一番外）：ほかのファイルからも読まれうるので、読む所を全部は見られず、音だけに使うかを決められない
//   - 関数の引数と返り値を経る形（play(mr()) で、play が引数を音だけに使う、など）、関数の値を経る形（const g = () => k * v; … sDrip(0, 0, g())。
//     中の関数の本体は値に数えない。const g = () => { spawn(v); } を音の引数の中で呼んでも、v を音に使うとは言えないため）と、
//     オブジェクトの欄を経る形（m.t = mr(); … sDrip(0, 0, m.t)）
//   今の src/ で、引数を音だけに使う関数（音を鳴らす関数のほか）は grabItem（位置を渡す）くらいで、一番外の変数とオブジェクトの欄にも、
//   見た目の乱数を入れて音に使う物は無いので、そこまでは追わない。src/lib/audio.ts と詠唱の声は、別に丸ごと調べる（audio.test.mjs）。
import { parseAst } from 'vite';
import * as eslintScope from 'eslint-scope';

const VISUAL = ['mr', 'mpick', 'roll', 'Math.random'];
const TIME = /\bclock\.time\b|\bperformance\.now\(|\bcurrentTime\b/;
// 木の部分ごとの子（何度も歩くので、一度作ったら覚えておく。range は eslint-scope のために足す位置で、子ではない）
const kidCache = new WeakMap();
const kids = (n) => {
  let out = kidCache.get(n);
  if (!out) {
    out = [];
    for (const k in n)
      if (k !== 'range') for (const v of Array.isArray(n[k]) ? n[k] : [n[k]]) if (v && typeof v.type === 'string') out.push(v);
    kidCache.set(n, out);
  }
  return out;
};
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
  // 条件で呼ぶのが、音を鳴らす関数と sndReady だけか（中の if の条件でゲームの処理を呼ぶ所は、音だけではない）
  const soundTest = (test) => callsIn(test).every((c) => sound.has(nameOf(c)) || nameOf(c) === 'sndReady');
  // 中身が音を鳴らすだけか（音を鳴らす呼び出しの文と、条件も中身も音だけの if だけ）
  const soundOnly = (st) =>
    st.type === 'BlockStatement'
      ? st.body.length > 0 && st.body.every(soundOnly)
      : st.type === 'IfStatement'
        ? soundTest(st.test) && soundOnly(st.consequent) && (!st.alternate || soundOnly(st.alternate))
        : st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && sound.has(nameOf(st.expression));
  const textOf = (p, n) => p.text.slice(n.start - p.off, n.end - p.off).replace(/\s+/g, '');
  const exits = (st) =>
    ['ReturnStatement', 'ContinueStatement'].includes(st.type) ||
    (st.type === 'BlockStatement' && st.body.length > 0 && exits(st.body.at(-1)));
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
    const at = (node, why, ds) => {
      for (const d of ds) seen.add(d);
      bad.push(`${p.name}:${line(node)} ${why}`);
    };

    // 引いた値を入れた変数（関数の中で宣言した物）。書き込む式に、見た目の乱数か、引いた値を入れた変数があれば、その変数も引いた値を入れた物
    const sm = scopes(p.ast);
    // 一番外（モジュールと、古い JS を包んだ関数）の変数は追わない（ほかのファイルからも読まれうるので、読む所を全部は見られない）
    const wrapper = p.off ? p.ast.body[0].expression : null;
    const vars = sm.scopes
      .flatMap((sc) => sc.variables)
      .filter((v) => v.scope.variableScope.type === 'function' && v.scope.variableScope.block !== wrapper);
    // 変数に入る値の式。分割代入（const [a, b] = [mr(), 0.3]）は、名前ごとに、入る値の式だけ（分からない形は、右の式全体）
    const patOf = new Map(); // 右の式 → 左の形
    walk(p.ast, (n) => {
      if (n.type === 'VariableDeclarator' && n.init) patOf.set(n.init, n.id);
      if (n.type === 'AssignmentExpression' && n.operator === '=') patOf.set(n.right, n.left);
    });
    const keyOf = (x) => (x.type === 'Property' && !x.computed ? (x.key.name ?? x.key.value) : undefined);
    const pick = (pat, e, id) => {
      if (pat === id) return [e];
      if (pat.type === 'AssignmentPattern') return pick(pat.left, e, id);
      if (pat.type === 'ArrayPattern' && e.type === 'ArrayExpression' && !e.elements.some((x) => x?.type === 'SpreadElement')) {
        const i = pat.elements.findIndex((x) => x && inside(id, x));
        if (pat.elements[i]?.type === 'RestElement') return [e];
        return e.elements[i] ? pick(pat.elements[i], e.elements[i], id) : [];
      }
      const pp = pat.type === 'ObjectPattern' ? pat.properties.find((x) => inside(id, x)) : null;
      if (pp && keyOf(pp) !== undefined && e.type === 'ObjectExpression' && e.properties.every((x) => keyOf(x) !== undefined)) {
        const ep = e.properties.findLast((x) => keyOf(x) === keyOf(pp));
        return ep ? pick(pp.value, ep.value, id) : [];
      }
      return [e];
    };
    const srcs = (r) =>
      !r.writeExpr ? [] : patOf.has(r.writeExpr) ? pick(patOf.get(r.writeExpr), r.writeExpr, r.identifier) : [r.writeExpr];
    // 値の中か（中の関数の本体は、値ではないので数えない。const g = () => { spawn(v); } の v は g の値に入らない）
    const fnCache = new WeakMap();
    const fnsIn = (e) => {
      let out = fnCache.get(e);
      if (!out) {
        out = [];
        walk(e, (x) => ['FunctionExpression', 'ArrowFunctionExpression'].includes(x.type) && out.push(x));
        fnCache.set(e, out);
      }
      return out;
    };
    const inVal = (x, e) => inside(x, e) && !fnsIn(e).some((f) => inside(x, f));
    const tainted = new Set();
    for (let grew = true; grew;) {
      grew = false;
      for (const v of vars)
        if (
          !tainted.has(v) &&
          v.references.some((r) =>
            srcs(r).some(
              (e) =>
                direct(e).some((d) => inVal(d, e)) ||
                [...tainted].some((t) => t.references.some((u) => u.isRead() && inVal(u.identifier, e))),
            ),
          )
        ) {
          tainted.add(v);
          grew = true;
        }
    }
    const refVar = new Map(); // 読む所の名前の節 → 変数
    for (const v of tainted) for (const r of v.references) if (r.isRead()) refVar.set(r.identifier, v);
    const visual = (n) => direct(n).concat([...refVar.keys()].filter((id) => inside(id, n)));
    // 次に鳴らす時刻の入れ先か（4つ目の形。決まりはファイルの頭）。入れる先は、名前なら同じ宣言の物、欄（m.hissT など）なら同じ書き方の物と比べる
    const parent = new Map();
    walk(p.ast, (n) => {
      for (const k of kids(n)) parent.set(k, n);
    });
    const resolvedOf = new Map(); // 名前の節 → 変数（一番外で宣言されていない名前は null）
    for (const sc of sm.scopes) for (const r of sc.references) resolvedOf.set(r.identifier, r.resolved);
    const same = (id, target) =>
      id.type === 'Identifier' && id.name === target.name && (resolvedOf.get(id) ?? null) === (resolvedOf.get(target) ?? null);
    const mentions = (e, target) => {
      if (target.type !== 'Identifier') {
        const t = textOf(p, target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?<![\\w$.])${t}(?![\\w$])`).test(textOf(p, e));
      }
      let found = false;
      walk(e, (x) => {
        if (same(x, target)) found = true;
      });
      return found;
    };
    // 時刻と入れる先を比べる条件か。比べた結果や入れる先を変数に入れてから使う形（const due = clock.time > m.t、const due = m.t; … clock.time > due）も数える
    const gateTest = (test, target) => {
      const timed = TIME.test(textOf(p, test));
      if (timed && mentions(test, target)) return true;
      let flag = false;
      walk(test, (x) => {
        const v = x.type === 'Identifier' ? resolvedOf.get(x) : null;
        const init = v?.defs.length === 1 && v.defs[0].type === 'Variable' ? v.defs[0].node.init : null;
        if (init && (timed || TIME.test(textOf(p, init))) && mentions(init, target)) flag = true;
      });
      return flag;
    };
    // 音を鳴らす呼び出しか（extra は、中身が音のことだけをする関数の名前。呼ぶ側で比べる形を見る時に使う）
    const isSnd = (c, extra) => sound.has(nameOf(c)) || Boolean(extra?.has(nameOf(c)));
    // 音の引数の中か、入れる先への代入の右の中か
    const forSound = (id, target) => {
      for (let x = id, up = parent.get(x); up; x = up, up = parent.get(up)) {
        if (up.type === 'CallExpression' && sound.has(nameOf(up)) && up.arguments.includes(x)) return true;
        if (up.type === 'AssignmentExpression' && up.right === x && textOf(p, up.left) === textOf(p, target)) return true;
      }
      return false;
    };
    // 範囲が音のことだけをするか：音を鳴らす呼び出し、入れる先への代入、音の引数と入れる先への代入にだけ使う変数の宣言、条件も中身も音だけの if
    const soundish = (st, target, extra) =>
      st.type === 'BlockStatement'
        ? st.body.every((x) => soundish(x, target, extra))
        : st.type === 'IfStatement'
          ? soundTest(st.test) && soundish(st.consequent, target, extra) && (!st.alternate || soundish(st.alternate, target, extra))
          : st.type === 'ExpressionStatement'
            ? (st.expression.type === 'CallExpression' && isSnd(st.expression, extra)) ||
              (st.expression.type === 'AssignmentExpression' && textOf(p, st.expression.left) === textOf(p, target))
            : st.type === 'VariableDeclaration'
              ? sm
                  .getDeclaredVariables(st)
                  .every((v) => v.references.filter((r) => r.isRead()).every((r) => forSound(r.identifier, target)))
              : st.type === 'ReturnStatement' || st.type === 'EmptyStatement';
    const region = (sts, gate, target, extra) =>
      gateTest(gate.test, target) &&
      sts.some((x) => callsIn(x).some((c) => isSnd(c, extra))) &&
      (callsIn(gate.test).some((c) => nameOf(c) === 'sndReady') || sts.every((x) => soundish(x, target, extra)));
    const fnName = (f) => {
      const up = parent.get(f);
      return f.type === 'FunctionDeclaration'
        ? f.id?.name
        : up?.type === 'VariableDeclarator' && up.id.type === 'Identifier'
          ? up.id.name
          : undefined;
    };
    const callSites = (name) => {
      const out = [];
      walk(p.ast, (n) => n.type === 'CallExpression' && nameOf(n) === name && out.push(n));
      return out;
    };
    // from（入れる文か、呼ぶ所）から上へ、同じ関数の中で、時刻と入れる先を比べる if の中（then と else）と、その if(…)return の後ろを探す。
    // 見つからず、入れる文がある関数の中身が音のことだけをする時は、その関数を呼ぶ所でも探す（欄の時だけ。名前は関数ごとに別の物なので）
    const timer = (from, target, extra = null) => {
      let x = from;
      for (let up = parent.get(x); up && !/Function/.test(x.type); x = up, up = parent.get(up)) {
        if (up.type === 'IfStatement' && (up.consequent === x || up.alternate === x)) {
          if (region(x.type === 'BlockStatement' ? x.body : [x], up, target, extra)) return true;
        }
        if (up.type === 'BlockStatement' || up.type === 'Program') {
          const j = up.body.indexOf(x);
          for (let i = 0; i < j; i++) {
            const g = up.body[i];
            if (g.type === 'IfStatement' && exits(g.consequent) && region(up.body.slice(i + 1), g, target, extra)) return true;
          }
        }
      }
      if (extra || target.type === 'Identifier' || !/Function/.test(x.type) || x.body.type !== 'BlockStatement') return false;
      const name = fnName(x),
        body = x.body.body;
      if (!name || !body.every((st) => soundish(st, target, null)) || !body.some((st) => sounds(st).length)) return false;
      return callSites(name).some((c) => timer(c, target, new Set([name])));
    };
    const sinks = new Map(); // 読む所 → どの形か
    // 見つけた所：見た目の乱数を直に引いていれば、その場所を返す。引いた値を入れた変数を読む所は、音に使う所として覚える
    const hit = (refs, node, why) => {
      const ds = refs.filter((r) => !refVar.has(r));
      if (ds.length) at(node ?? ds[0], why, ds);
      for (const r of refs) if (refVar.has(r) && !sinks.has(r)) sinks.set(r, why);
    };
    walk(p.ast, (n) => {
      if (n.type === 'CallExpression' && sound.has(nameOf(n)))
        for (const a of n.arguments) for (const v of visual(a)) hit([v], null, `${nameOf(n)} の引数`);
      if (n.type === 'IfStatement' && visual(n.test).length && soundOnly(n.consequent) && (!n.alternate || soundOnly(n.alternate)))
        hit(visual(n.test), n, 'if の条件で、音を鳴らすか');
      if (n.type === 'IfStatement' && !isGuard(n) && callsIn(n.test).some((c) => nameOf(c) === 'sndReady'))
        for (const v of visual(n.consequent)) hit([v], null, 'sndReady の中');
      const fn = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type) ? n.body : null;
      if (fn?.type === 'BlockStatement' && isGuard(fn.body[0])) for (const v of visual(fn)) hit([v], null, '音を鳴らす関数の中');
      if (
        n.type === 'ExpressionStatement' &&
        n.expression.type === 'AssignmentExpression' &&
        visual(n.expression.right).length &&
        timer(n, n.expression.left)
      ) {
        // 時刻と同じ式の中の値だけを見る。オブジェクトと配列は、値が入っている欄・要素の中に時刻がある時だけ
        // （o.next = { t: clock.time + mr() } の mr() は見る。b.morph = { from, t0: clock.time } の from は時刻ではない）
        const right = n.expression.right;
        const slotOf = (r) => {
          let slot = right;
          walk(right, (x) => {
            const parts = x.type === 'ObjectExpression' ? x.properties : x.type === 'ArrayExpression' ? x.elements : [];
            for (const e of parts) if (e && inside(r, e) && inside(e, slot)) slot = e;
          });
          return slot;
        };
        const refs = visual(right).filter((r) => TIME.test(textOf(p, slotOf(r))));
        if (refs.length) hit(refs, n, '次に鳴らす時刻');
      }
    });
    // 引いた値を入れた変数のうち、読む所が全部、音に使う所か、ほかの「音だけに使う変数」に入れる所の物（ゲームの判定にも使う変数は止めない）
    // r が入る先の変数。その場で変える形（p *= 0.5、p++）は、その変数自身に入れる
    const flowsTo = (r) =>
      [...tainted].filter(
        (w) => (r.isWrite() && r.resolved === w) || w.references.some((u) => srcs(u).some((e) => inVal(r.identifier, e))),
      );
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
      v.references
        .flatMap((r) => srcs(r).flatMap((e) => direct(e).filter((d) => inVal(d, e))))
        .map((d) => ({ d, why: `変数 ${ns.join('・')} を経て ${why}` })),
    );
    for (const { d, why } of found.sort((a, b) => a.d.start - b.d.start)) if (!seen.has(d)) at(d, why, [d]);
  }
  return { bad: [...new Set(bad)], sound: [...sound].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
}
