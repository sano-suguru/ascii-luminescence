// テストの道具：音を鳴らす所が、見た目の乱数（mr・mpick・Math.random）を引いていないかを、構文の木で調べる。
// 音は音の乱数（sndRand。src/lib/random.ts）を使う。見た目の乱数を引くと、音を足したり鳴らす頻度を変えたりしただけで、
// テスト用モードの見た目の乱数の並びがずれ、粒子の位置などが変わって、画面写真の基準が変わる。
// 調べる形（どれかに当たれば、その場所を返す）：
//   1. 音を鳴らす関数の引数の中で引く（sDrip(x, z, 0.2 + mr()) など）
//   2. if の条件で引き、中身は音を鳴らすだけ（if(mr()<0.3)sBubble(…) など。中で音のほかのこともする所は、ゲームの判定なので調べない）
//   3. 音だけの処理の中で引く（if(…sndReady()){…} の中と、if(!sndReady())return で始まる関数の中）
//   4. 音を鳴らすブロックの中で、clock.time を使う時刻を、引いた値で決める（次に鳴らす時刻）
// 音を鳴らす関数は、src/lib/audio.ts の s で始まる export と、本体が if(!sndReady())return で始まる関数。
import { parseAst } from 'vite';

const VISUAL = new Set(['mr', 'mpick', 'Math.random']);
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
  for (const { ast } of parsed)
    walk(ast, (n) => n.type === 'FunctionDeclaration' && n.id && isGuard(n.body.body[0]) && sound.add(n.id.name));
  const visual = (n) => callsIn(n).filter((c) => VISUAL.has(nameOf(c)));
  const sounds = (n) => callsIn(n).filter((c) => sound.has(nameOf(c)));
  // 中身が音を鳴らすだけか（音を鳴らす呼び出しの文だけ）
  const soundOnly = (st) =>
    st.type === 'BlockStatement'
      ? st.body.length > 0 && st.body.every(soundOnly)
      : st.type === 'ExpressionStatement' && st.expression.type === 'CallExpression' && sound.has(nameOf(st.expression));
  const bad = [];
  for (const p of parsed) {
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
            /\bclock\.time\b/.test(p.text.slice(s.start - p.off, s.end - p.off))
          )
            at(s, '次に鳴らす時刻');
    });
  }
  return { bad: [...new Set(bad)], sound: [...sound].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
}
