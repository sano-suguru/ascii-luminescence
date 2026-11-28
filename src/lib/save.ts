// 保存。localStorage に書く。保存が使えない時（保存を止めたブラウザなど）は、何もしない。
import type { MonsterType } from './creatures.ts';
import { adv, saved } from './state.ts';

/** 集まり s（見たルーン・見た生き物など）を、名前 k で保存する */
export const saveSet = (k: string, s: Iterable<unknown>): void => {
  try {
    localStorage.setItem(k, JSON.stringify([...s]));
  } catch {
    // 保存が使えない時は、何もしない
  }
};
/** 伝承・解放・墓・試練の記録 META を保存する */
export function saveMeta(): void {
  try {
    localStorage.setItem('al_meta', JSON.stringify(saved.META));
  } catch {
    // 保存が使えない時は、何もしない
  }
}

/** 出会った忘れられた獣の記録（探索をまたいで残る。図鑑が名前ごとに並べる）。読めない時は空。中身は確かめずに返す */
export function loadBeasts(): unknown {
  try {
    return JSON.parse(localStorage.getItem('al_beasts') || '[]');
  } catch {
    return [];
  }
}
/**
 * 忘れられた獣 ty に出会ったことを記録する（同じ探索の同じ名前は1回だけ。新しく記した数を今の探索の記録に足す。残すのは新しい60まで）。
 * 記録が配列でない時と、中に null がある時は、何もしない
 */
export function recordBeast(ty: Pick<MonsterType, 'name' | 'col' | 'spec' | 'lore' | 'scale' | 'fl' | 'flier'>): void {
  try {
    const all = loadBeasts();
    if (!Array.isArray(all)) return;
    const met = all.some((b: unknown) => {
      if (b === null || b === undefined) throw new TypeError('獣の記録に null がある');
      return typeof b === 'object' && 'seed' in b && b.seed === adv.runSeed && 'name' in b && b.name === ty.name;
    });
    if (met) return;
    all.push({ seed: adv.runSeed, name: ty.name, col: ty.col, spec: ty.spec, lore: ty.lore, scale: ty.scale, fl: ty.fl, flier: ty.flier });
    if (adv.runStats) adv.runStats.beastsNew = (adv.runStats.beastsNew || 0) + 1;
    localStorage.setItem('al_beasts', JSON.stringify(all.slice(-60)));
  } catch {
    // 保存が使えない時は、何もしない
  }
}
/** 名前 k で保存した集まり（見た生き物・見たルーン）を読む。読めない時は空 */
export const loadSet = (k: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(k) || '[]'));
  } catch (e) {
    return new Set();
  }
};
