// 保存（もとは src/game/17-meta.js と 25-gallery.js）。localStorage に書く。保存が使えない時（保存を止めたブラウザなど）は、何もしない。
import { saved } from './state.ts';

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
