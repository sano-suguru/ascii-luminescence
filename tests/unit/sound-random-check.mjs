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
// 音を鳴らす関数は、src/lib/audio.ts の s で始まる export と、本体が if(!sndReady())return で始まる関数（function の宣言と、名前を付けた関数の式・矢印関数）。
// 見ない形：引いた値を変数に入れてから、音を鳴らす関数に渡す形（音だけの処理の外で）。src/lib/audio.ts と詠唱の声は、別に丸ごと調べる（audio.test.mjs）。
import { parseAst } from 'vite';

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
    const visual = (n) => valueRefs(n, names);
    const at = (node, why) => bad.push(`${p.name}:${p.text.slice(0, Math.max(0, node.start - p.off)).split('\n').length} ${why}`);
    walk(p.ast, (n) => {
      if (n.type === 'CallExpression' && sound.has(nameOf(n)))
        for (const a of n.arguments) for (const v of visual(a)) at(v, `${nameOf(n)} の引数`);
      if (n.type === 'IfStatement' && visual(n.test).length && soundOnly(n.consequent)) at(n, 'if の条件で、音を鳴らすか');
      if (n.type === 'IfStatement' && !isGuard(n) && callsIn(n.test).some((c) => nameOf(c) === 'sndReady'))
        for (const v of visual(n.consequent)) at(v, 'sndReady の中');
      const fn = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type) ? n.body : null;
      if (fn?.type === 'BlockStatement' && isGuard(fn.body[0])) for (const v of visual(fn)) at(v, '音を鳴らす関数の中');
      if ((n.type === 'BlockStatement' || n.type === 'Program') && n.body.some((s) => sounds(s).length))
        for (const s of n.body)
          if (
            s.type === 'ExpressionStatement' &&
            s.expression.type === 'AssignmentExpression' &&
            visual(s.expression.right).length &&
            TIME.test(p.text.slice(s.start - p.off, s.end - p.off))
          )
            at(s, '次に鳴らす時刻');
    });
  }
  return { bad: [...new Set(bad)], sound: [...sound].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
}
