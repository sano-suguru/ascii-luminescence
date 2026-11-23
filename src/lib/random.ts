// 見た目のための乱数（もとは src/game/02-constants.js の mr・mpick）。
// 迷宮の生成に使う、シードで決まる乱数（rand・R・RI・pick）は、まだ src/game/02-constants.js にある。

/**
 * Math.random を呼ぶ。呼んだ時の Math.random を使う（テスト用モードは、ゲームの最初に Math.random をシードで決まる物に入れ替える。
 * このモジュールはそれより先に読まれるので、読んだ時の Math.random を覚えておくと、入れ替える前の物を使ってしまう）
 */
export const mr = (): number => Math.random();

/** 配列から1つ選ぶ（mr を使う）。空の配列は渡さないこと */
export const mpick = <T>(a: readonly T[]): T => a[Math.floor(mr() * a.length)] as T;
