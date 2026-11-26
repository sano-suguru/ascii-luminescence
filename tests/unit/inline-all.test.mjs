// Artifact 版の組み立て（tools/vite-plugins.mjs の inlineAll）が、HTML 1つにする時に、壊れる形・大きすぎる形を止めるか。
// 本物の組み立ては pnpm check が試す。ここでは、出力の束（bundle）の小さな偽物を渡して、止める所を1つずつ確かめる
import { describe, expect, it } from 'vitest';
import { ARTIFACT_MAX, inlineAll } from '../../tools/vite-plugins.mjs';

const PAGE = `<!DOCTYPE html><html><head><title>t</title>
  <script type="module" crossorigin src="./assets/a.js"></script>
  <link rel="stylesheet" crossorigin href="./assets/a.css">
</head><body></body></html>`;
const make = ({ js = 'console.log(1);', css = 'body{color:red}', html = PAGE, extra = {} } = {}) => ({
  'index.html': { type: 'asset', source: html },
  'assets/a.js': { type: 'chunk', code: js },
  'assets/a.js.map': { type: 'asset', source: '{}' },
  'assets/a.css': { type: 'asset', source: css },
  ...extra,
});
const run = (bundle) => {
  inlineAll().generateBundle({}, bundle);
  return bundle;
};

describe('inlineAll', () => {
  it('JS と CSS を中に書き、ほかのファイルとソースマップを消す', () => {
    const b = run(make());
    expect(Object.keys(b)).toEqual(['index.html']);
    const html = String(b['index.html'].source);
    expect(html).toContain('<script type="module">\nconsole.log(1);</script>');
    expect(html).toContain('<style>\nbody{color:red}</style>');
    expect(html).not.toMatch(/src="|href="/);
  });
  it('中に書いた JS の文字列にある src="./ は、残った読む所と見なさない', () => {
    const b = run(make({ js: `el.innerHTML = ' <img src="./x.png">';` }));
    expect(String(b['index.html'].source)).toContain('src="./x.png"');
  });
  it('$ を含む文も、そのまま書く（置き換えの $& などに化けない）', () => {
    const js = "const a = '$&$1$$';";
    expect(String(run(make({ js }))['index.html'].source)).toContain(js);
  });
  it('script の中の </script と <!-- 、style の中の </style を止める', () => {
    expect(() => run(make({ js: "s = '</script>';" }))).toThrow('</script');
    expect(() => run(make({ js: "s = '<!-- <script>';" }))).toThrow('<!--');
    expect(() => run(make({ css: 'a{content:"</style>"}' }))).toThrow('</style');
  });
  it('HTML の外に残るファイルや、ほかのファイルを読む所が残ると止める', () => {
    expect(() => run(make({ extra: { 'assets/f.woff2': { type: 'asset', source: 'x' } } }))).toThrow('入れられなかった');
    expect(() => run(make({ html: PAGE.replace('</head>', '<link rel="icon" href="./i.png"></head>') }))).toThrow('読む所');
  });
  it('大きすぎると止める', () => {
    expect(() => run(make({ js: `/*${'x'.repeat(ARTIFACT_MAX)}*/` }))).toThrow('大きすぎる');
  });
});
