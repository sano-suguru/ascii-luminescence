// 指紋を取る単体テストの、場合の書き出し（tools/case-diff.mjs が使う）。
// 環境変数 AL_CASES_OUT が無い時は、何もしない（caseOut）・今までどおりの指紋を返す（stateFp）。
// ある時は、指紋の元の文を <AL_CASES_OUT>/<名前>.txt に書き、状態は指紋の代わりに欄ごとの指紋にする
// （なので、その時は指紋のテストが落ちる。tools/case-diff.mjs は、テストの成否を見ずに書き出しだけを比べる）。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = () => process.env.AL_CASES_OUT || '';

/** 指紋の元の文を書き出す（名前は、テストのファイルの中で重ならない物にする） */
export function caseOut(name, text) {
  if (dir()) writeFileSync(join(dir(), `${name}.txt`), text);
}

/**
 * 状態の文（JSON）の指紋。書き出す時は、上の欄ごと（fight などの入れ物は、その中の欄ごと）の指紋にし、
 * 生き物（key と ty を持つ物）は1体ずつ、欄ごとの指紋にする（どの生き物の、どの欄が違うかを見られるように）
 */
export function stateFp(text, hash) {
  if (!dir()) return hash(text);
  const h = (v) => hash(JSON.stringify(v) ?? 'undefined');
  const mob = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, k === 'key' ? v : h(v)]));
  const isMob = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && 'key' in v && 'ty' in v;
  const o = JSON.parse(text),
    out = {};
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v) && v.some(isMob)) out[k] = v.map((m) => (isMob(m) ? mob(m) : h(m)));
    else if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length <= 64)
      out[k] = Object.fromEntries(Object.entries(v).map(([q, x]) => [q, h(x)]));
    else out[k] = h(v);
  }
  return out;
}
