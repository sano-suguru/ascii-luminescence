// テストのための道具：古い JS（src/game/*.js）のトップレベルの宣言を、名前で取り出して評価する。
// まだ古い JS にある表や関数（生き物の表 MTYPES、ルーンを作る makeRune など）を、Node の単体テストで本物のまま使うため。
//   const { MTYPES, makeRune } = await legacyValues(['MTYPES', 'RUNE_DEF', 'runeUid', 'makeRune']);
// - 名前を挙げた宣言を、元のファイルの順につないで評価する（関数を挙げたら、その関数が使う古い宣言も挙げること）
// - TypeScript に移した物（src/lib/ の export）は、本物を渡す
// - 挙げていない古い名前を、評価の途中で読んだら止める（黙って undefined にしない）。関数の中から読む名前は、呼ばれるまで読まれない
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAst } from 'vite';
import { gameParts } from './game-source.mjs';

const root = join(import.meta.dirname, '..');
const GAME = join(root, 'src/game'),
  LIB = join(root, 'src/lib');

// 古い JS のトップレベルの宣言（名前 → 元の文と、つなぐ順）
function legacyDecls() {
  const out = new Map();
  let order = 0;
  for (const f of gameParts(GAME)) {
    const t = readFileSync(join(GAME, f), 'utf8');
    const body = parseAst(`(function(){\n${t}\n})`, { lang: 'js' }).body[0].expression.body.body;
    for (const st of body) {
      const names =
        st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration'
          ? [st.id.name]
          : st.type === 'VariableDeclaration'
            ? st.declarations.flatMap((d) => (d.id.type === 'Identifier' ? [d.id.name] : []))
            : [];
      const decl = { src: t.slice(st.start - 13, st.end - 13), order: order++, file: f };
      for (const n of names) out.set(n, decl);
    }
  }
  return out;
}

// src/lib/ の全部の export（TypeScript に移した物）
async function libExports() {
  const all = {};
  for (const f of readdirSync(LIB, { recursive: true })
    .map(String)
    .filter((f) => /\.(ts|js)$/.test(f)))
    Object.assign(all, await import(join(LIB, f)));
  return all;
}

export async function legacyValues(names) {
  const decls = legacyDecls(),
    lib = await libExports();
  const picked = [
    ...new Set(
      names.map(
        (n) =>
          decls.get(n) ??
          (() => {
            throw new Error(`古い JS に ${n} の宣言が無い`);
          })(),
      ),
    ),
  ].sort((a, b) => a.order - b.order);
  const legacy = new Set(decls.keys());
  // with の中で名前を引く：自分の宣言（const など）が先。次に src/lib の export。古い JS の、挙げていない名前は止める
  const scope = new Proxy(
    {},
    {
      has: (_t, k) => typeof k === 'string' && (k in lib || legacy.has(k)),
      get: (_t, k) => {
        if (k === Symbol.unscopables) return undefined;
        if (k in lib) return lib[k];
        throw new Error(`legacyValues：古い JS の ${String(k)} も要る（names に足すこと）`);
      },
    },
  );
  const code = picked.map((d) => d.src).join('\n');
  // with は strict でない関数でしか使えないので、new Function（strict でない）で評価する
  // oxlint-disable-next-line typescript/no-implied-eval -- テストのために、このリポジトリの古い JS（src/game/）だけを評価する道具
  return new Function('scope', `with (scope) {\n${code}\nreturn { ${names.join(', ')} };\n}`)(scope);
}
