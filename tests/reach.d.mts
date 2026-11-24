// tests/reach.mjs の型（TypeScript の単体テストから使うため）
/** 歩いて行けるかを調べるのに要る、階の部分 */
export interface ReachLevel {
  tile: ArrayLike<number>;
  liquid: ArrayLike<number>;
  start: number;
  stairs: number;
  bstairs: { cell: number } | null;
  portal: { cell: number } | null;
  upstairs: number;
  items: readonly { kind: string; i: number }[];
}
/** 行けない物の説明の配列を返す（final：最深部か。階段が無くてよい） */
export function reachProblems(L: ReachLevel, final: boolean): string[];
/** ブラウザから Node へ渡す形に詰める */
export function reachPart(L: ReachLevel): Omit<ReachLevel, 'tile' | 'liquid'> & { tile: string; liquid: string };
/** reachPart で詰めた物を戻す */
export function unpackReach(P: ReturnType<typeof reachPart>): ReachLevel;
