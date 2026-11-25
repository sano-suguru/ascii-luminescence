// 画面の表示の大きさと、表示に使う小さな表（もとは src/game/12・16・18・21・27）。

/** 灯りの段階の名前と色（暗がり・薄明かり・光の中） */
export const LIGHT_NAMES = ['暗がり', '薄明かり', '光の中'],
  LIGHT_COLS = ['#8a92d6', '#d8c07e', '#ffd27a'];
/** 生き物の頭の上の印の高さ（形ごと。無い形は 1.5） */
export const MARK_H = {
  humanoid: 2.05,
  quad: 0.95,
  orb: 0.55,
  bat: 0.38,
  bloat: 0.68,
  wraith: 2.35,
  jelly: 0.85,
  eel: 1.2,
  shadowking: 3.58,
  shadowserpent: 3.7,
};
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
