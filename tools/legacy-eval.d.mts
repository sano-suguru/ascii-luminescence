// tools/legacy-eval.mjs の型（TypeScript の単体テストから使うため）
/** 古い JS（src/game/）のトップレベルの宣言を、名前で取り出して評価する。T は取り出す物の形（テスト側で決める） */
export function legacyValues<T = Record<string, unknown>>(names: readonly string[]): Promise<T>;
