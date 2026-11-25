// マウスを捕まえる（ポインタロック）・視点・音量（もとは src/game/16-view-input.js・28-camera-player.js・15-sound-fire.js）。状態の入れ物 ui・SND に頼る。
// ポインタロックの変わり目（pointerlockchange・pointerlockerror）を受け取る登録は、古い JS（16-view-input.js）にある。
import { must, nth } from './array.ts';
import { SND_LV, SND_NAME } from './sound.ts';
import { SND, ui } from './state.ts';
import { showHint } from './status.ts';

/** 「クリックで視点操作に戻る」の一言（#resume）。今はいつも隠す */
export function updateResume(): void {
  must(document.getElementById('resume'), '#resume').style.display = 'none';
}

/** マウスを捕まえる（描く画面 #gl で）。捕まえられなかったら ui.plFailed にし、それからは捕まえようとしない */
export function tryLock(): void {
  const canvas = must(document.getElementById('gl'), '#gl');
  // 古いブラウザには requestPointerLock が無い（型には必ずある）
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (ui.plFailed || !canvas.requestPointerLock) return;
  try {
    const p: unknown = canvas.requestPointerLock();
    // 古いブラウザの requestPointerLock は Promise を返さない（catch が無い）
    if (typeof p === 'object' && p !== null && 'catch' in p && typeof p.catch === 'function')
      p.catch(() => {
        ui.plFailed = true;
        updateResume();
      });
  } catch {
    ui.plFailed = true;
  }
}

/** 視点を変える（'fps' は1人称、'tps' は3人称）。3人称のカメラは、狙う位置から始め直す。選んだ視点は保存する（保存できなくても続ける） */
export function setCamMode(m: string): void {
  ui.camMode = m;
  ui.camPos = null;
  try {
    localStorage.setItem('al_cam', m);
  } catch {
    // 保存できない時（プライベートモードなど）は、保存しないだけ
  }
}

/** 音量を次の段にする（大・中・小・オフの順に回る）。音を鳴らし始めていれば、0.25秒かけて変える。画面の下に1.2秒（実時間）出す */
export function sndToggle(): void {
  SND.lv = (SND.lv + 1) % SND_LV.length;
  SND.on = nth(SND_LV, SND.lv) > 0;
  if (SND.master) SND.master.gain.setTargetAtTime(nth(SND_LV, SND.lv), must(SND.ctx, 'SND.ctx').currentTime, 0.25);
  showHint('音量：' + nth(SND_NAME, SND.lv));
  setTimeout(() => showHint(''), 1200);
}
