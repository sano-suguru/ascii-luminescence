// マウスを捕まえる（ポインタロック）・視点・音量（もとは src/game/16-view-input.js・28-camera-player.js・15-sound-fire.js）。状態の入れ物 ui・SND に頼る。
// ポインタロックの変わり目（pointerlockchange・pointerlockerror）を受け取る登録は、古い JS（16-view-input.js）にある。
import { must, nth } from './array.ts';
import { msg } from './log.ts';
import { SND_LV, SND_NAME } from './sound.ts';
import { SND, ui } from './state.ts';
import { showHint } from './status.ts';

/** 「クリックで視点操作に戻る」の一言（#resume）。今はいつも隠す */
export function updateResume(): void {
  must(document.getElementById('resume'), '#resume').style.display = 'none';
}

/**
 * マウスを捕まえるのに失敗した時（pointerlockerror・Promise の reject・例外・requestPointerLock が無い）。どれから来ても同じ扱い。
 * このページで一度も捕まえられていなければ、捕まえられないと決め（ui.plFailed）、それからは捕まえようとしない。案内の伝言は1回だけ出す。
 * 一度でも捕まえられていれば、最後に捕まえてから3回続けて失敗するまでは、そのたびの失敗とみなし、何もしない
 * （Esc で外した直後に掛け直すと断られるため。次のクリックで、また捕まえる）
 */
export function lockFailed(): void {
  if (ui.plFailed || (ui.lockedOnce && ui.lockTries < 3)) return;
  ui.plFailed = true;
  updateResume();
  msg('<b style="color:#8fe9ff">i</b>マウスをドラッグして視点を動かせます。');
}

/**
 * マウスを捕まえる（描く画面 #gl で）。失敗したら lockFailed。捕まえられないと決めた後（ui.plFailed）は、捕まえようとしない。
 * Esc のキーを処理している間（ui.escKey）も捕まえにいかない（Esc のキーで掛けたロックは、ブラウザがすぐ外すため。次のクリックで捕まえる）
 */
export function tryLock(): void {
  const canvas = must(document.getElementById('gl'), '#gl');
  if (ui.plFailed || ui.escKey) return;
  ui.lockTries++;
  // requestPointerLock が無いブラウザ（iPhone の Safari など。型には必ずある）
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (!canvas.requestPointerLock) {
    lockFailed();
    return;
  }
  try {
    const p: unknown = canvas.requestPointerLock();
    // 古いブラウザの requestPointerLock は Promise を返さない（catch が無い）
    if (typeof p === 'object' && p !== null && 'catch' in p && typeof p.catch === 'function') p.catch(lockFailed);
  } catch {
    lockFailed();
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
