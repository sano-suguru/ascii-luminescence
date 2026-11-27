// テストと道具の部品：ページに差し込む偽物（page.addInitScript に渡す関数）と、診断の記録を読む道具。
// tests/touch.mjs・tests/title.mjs・tools/transitions.mjs が使う。

/**
 * 偽の window.claude（claude.ai の Artifact の中の真似）：user は持ち主か（owner）を答え、db は書き込まれた物を window.__sets に貯める。
 * window.__hold が true の間は、書き込みを終わらせない（window.__release() で終わる。書き込みの途中を作るため）。
 * addInitScript でページに差し込むので、外の変数は使えない
 */
export const fakeClaude = (owner) => {
  window.__sets = [];
  window.__hold = false;
  const waits = [];
  window.__release = () => {
    window.__hold = false;
    for (const f of waits.splice(0)) f();
  };
  const set = async (p, id, d) => {
    window.__sets.push({ p, id, d: JSON.parse(JSON.stringify(d)) });
    if (window.__hold) await new Promise((ok) => waits.push(ok));
  };
  window.claude = {
    use: async (n) =>
      n === 'user'
        ? { isOwner: async () => owner }
        : n === 'db'
          ? { collection: (p) => ({ doc: (id) => ({ set: (d) => set(p, id, d) }) }) }
          : null,
  };
};

/**
 * 自動再生を許さないブラウザ（iPhone の Safari など）の音の部品の真似。ヘッドレスの Chromium は、操作の前に作った音の部品もすぐ動かすので、
 * その決まりを真似る：利用者の操作の事件（本物の pointerdown・pointerup・click・touchend・keydown）を処理している間に作るか、その間に resume した時だけ動く。
 * それまでは state が 'suspended'。navigator.userActivation は使わない（Playwright の evaluate も操作として数え、しかも5秒続くので、決まりを真似られない）。
 * 本物の部品の上に作るので、音を作る処理はそのまま動く。Playwright の click・tap・キーは本物の操作の事件になる
 */
export const strictAudio = () => {
  const Real = window.AudioContext;
  if (!Real) return;
  let gesture = false;
  for (const type of ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'])
    window.addEventListener(
      type,
      (e) => {
        if (!e.isTrusted) return;
        gesture = true;
        setTimeout(() => (gesture = false), 0); // この事件を処理し終えたら、操作の外
      },
      true,
    );
  class StrictAudioContext extends Real {
    constructor(o) {
      super(o);
      this.__ok = gesture;
      if (!this.__ok) void super.suspend();
    }
    get state() {
      return this.__ok ? super.state : 'suspended';
    }
    resume() {
      if (gesture) this.__ok = true;
      return this.__ok ? super.resume() : Promise.resolve();
    }
  }
  window.AudioContext = StrictAudioContext;
};

/**
 * 診断の記録を今すぐ書かせて、一番新しい記録を返す（ページが隠れた時に書く仕組みを使う。隠れたことにして visibilitychange を出し、すぐ見える状態に戻す）。
 * 書いていなければ null
 */
export async function readDiag(pg) {
  return pg.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
    const s = window.__sets || [];
    return s.length ? s[s.length - 1].d : null;
  });
}
