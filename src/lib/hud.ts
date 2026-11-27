// 画面の表示の大きさと、表示に使う小さな表（もとは src/game/12・16・18・21・27）。

/** 灯りの段階の名前と色（暗がり・薄明かり・光の中） */
export const LIGHT_NAMES = ['暗がり', '薄明かり', '光の中'],
  LIGHT_COLS = ['#8a92d6', '#d8c07e', '#ffd27a'];
/**
 * 生き物の頭の上の印の高さ（体の大きさ scale を掛ける前の値）。見た目（look）の行があればそれを、無ければ形（form）の行を使い、どちらも無ければ 1.5。
 * 印が体の一番上より少し上（0.1 から 0.7 の間）に出るように決める（単体テスト bodies-legacy.test.mjs が、表のどの種類も確かめる）
 */
export const MARK_H = {
  humanoid: 2.05,
  quad: 1.1,
  salamander: 0.5,
  orb: 0.55,
  bat: 0.38,
  bloat: 0.68,
  wraith: 2.0,
  jelly: 0.85,
  eel: 1.2,
  snake: 0.6,
  shroom: 1.0,
  spider: 1.0,
  cleaner: 0.8,
  watcher: 2.0,
  golem: 1.9,
  shadowking: 3.58,
  shadowserpent: 3.7,
};
const markTable: Readonly<Record<string, number>> = MARK_H;
/** 頭の上の印（眠っている z・気づいた !・怪しんでいる ?・攻撃の溜めの !）の、足もとからの高さ（MARK_H に体の大きさを掛けて 0.25 足す） */
export const markHeight = (ty: { look?: string | null | undefined; form: string; scale: number }): number =>
  (markTable[ty.look ?? ''] || markTable[ty.form] || 1.5) * ty.scale + 0.25;
/** ミニマップの大きさ：マスの数（横 MMC・縦 MMR）、1マスの幅 MCW・高さ MCH、余白 MPAD */
export const MMC = 45,
  MMR = 27,
  MCW = 8,
  MCH = 13,
  MPAD = 11;
/** ミニマップの明るさ（0 から 1 より上）を、色の値（0 から 255）にする */
export const tone = (v: number): number => Math.round(255 * (1 - Math.exp(-v * 1.7)));
/** 装備の画面の幅 PACK_W、手の枠の幅 PACK_SLOT、袋の行の数 BAG_LINES */
export const PACK_W = 84,
  PACK_SLOT = 14,
  BAG_LINES = 2;
/** 祭壇の画面の幅 */
export const ALTAR_W = 72;
