// 配列と表を読む道具。noUncheckedIndexedAccess では、a[i] や o[k] は「無いかもしれない」（undefined を含む）型になる。
// それを as で黙らせると、本当に無かった時に、undefined や NaN が黙って先へ広がる。ここで読めば、無い時はその場で止まり、どこで間違えたかが分かる。
// 名前は、古い JS の局所の変数（at など）とぶつからない物にしている（組み立てで名前が変わると、ソースマップのテストが名前を戻せない）。
// 範囲の外や、無い欄をわざと読む所では使わない（無い時の扱いを、その場ではっきり書く）

/** 配列 a の i 番目。無ければ RangeError */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i];
  if (v === undefined) throw new RangeError(`配列の ${i} 番目が無い（長さ ${a.length}）`);
  return v;
}

/** 表 o の欄 k。無ければ RangeError */
export function lookup<T>(o: Readonly<Record<string, T>>, k: string | number): T {
  const v = o[k];
  if (v === undefined) throw new RangeError(`表に ${k} が無い`);
  return v;
}

/** 必ずある値（null でも undefined でもない）。無ければ TypeError。find の結果・pop・Map の get・省ける欄（洞窟の床 cells0 など）に */
export function must<T>(v: T | null | undefined, what = '値'): T {
  if (v === null || v === undefined) throw new TypeError(`${what}が無い`);
  return v;
}
