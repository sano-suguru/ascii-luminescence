// 音の小さな表と道具。

/** 音の大きさの段（大・中・小・オフ）と、その名前 */
export const SND_LV = [0.85, 0.5, 0.25, 0],
  SND_NAME = ['大', '中', '小', 'オフ'];
/** 音の大きさの形（立ち上がり a 秒で peak まで上げ、d 秒で消す） */
export function sEnv(node: { gain: AudioParam }, t: number, a: number, d: number, peak?: number): void {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak || 1, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
/** 詠唱の声の母音（2つの共鳴の高さ） */
export const VOWELS = [
  [800, 1150],
  [450, 800],
  [325, 700],
  [400, 1700],
  [300, 2200],
];
/** 詠唱の声の音の高さの段（半音） */
export const CHANT_STEPS = [0, 3, 5, 7, 10, 12, 15, 17];
