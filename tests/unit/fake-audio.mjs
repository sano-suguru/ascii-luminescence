// テストの道具：偽の Web Audio（AudioContext）。作った部品・値の書き込み・つなぎ方・鳴らす時刻を、全部 log に記録する。
// Node には Web Audio が無いので、音を鳴らす処理（src/lib/audio.ts）は、これを SND.ctx に入れて確かめる。
//   const log = []; SND.ctx = fakeAudio(log);  …  log は [部品, 欄, したこと, 値…] の並び
// 部品の名前は、作った順の番号つき（gain0・osc1 など）。state は 'running'（鳴らせる）か 'suspended'（止まっている）。
// 本物と同じく、音の値（AudioParam）に数でない値（NaN・Infinity）を入れると TypeError を出す。panner が false なら、左右の部品（createStereoPanner）が無い
/** window.AudioContext の代わり（new で呼ばれると、偽の Web Audio を返す） */
export function fakeAudioClass(log, state = 'running', panner = true) {
  return function FakeAudioContext() {
    return fakeAudio(log, state, panner);
  };
}
/** 記録を1つの文字列にする（NaN・Infinity・undefined も、null にまとめずに見分ける） */
export const logText = (v) =>
  JSON.stringify(v, (k, x) => (x === undefined ? 'undefined' : typeof x === 'number' && !Number.isFinite(x) ? String(x) : x));
const finite = (a) => {
  for (const x of a) if (typeof x === 'number' && !Number.isFinite(x)) throw new TypeError('The provided value is non-finite');
};
export function fakeAudio(log, state = 'running', panner = true) {
  let id = 0;
  const param = (owner, name) => {
    const p = { v: 0 };
    Object.defineProperty(p, 'value', {
      get: () => p.v,
      set: (v) => {
        finite([v]);
        log.push([owner, name, '=', v]);
        p.v = v;
      },
    });
    for (const m of ['setValueAtTime', 'setTargetAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime'])
      p[m] = (...a) => {
        finite(a);
        log.push([owner, name, m, ...a]);
        return p;
      };
    return p;
  };
  const node = (kind, params) => {
    const n = { id: kind + id++ };
    for (const k of params) n[k] = param(n.id, k);
    n.connect = (d) => {
      log.push([n.id, 'connect', d.id]);
      return d;
    };
    n.start = (...a) => log.push([n.id, 'start', ...a]);
    n.stop = (...a) => log.push([n.id, 'stop', ...a]);
    return new Proxy(n, {
      set(t, k, v) {
        log.push([t.id, 'set', k, v && v.id ? v.id : v]);
        t[k] = v;
        return true;
      },
    });
  };
  const ctx = {
    state,
    currentTime: 12.5,
    sampleRate: 50,
    destination: { id: 'dest' },
    createGain: () => node('gain', ['gain']),
    createOscillator: () => node('osc', ['frequency']),
    createBiquadFilter: () => node('filt', ['frequency', 'Q']),
    createBufferSource: () => node('src', []),
    createDynamicsCompressor: () => node('comp', []),
    createConvolver: () => node('conv', []),
    createBuffer: (ch, len, sr) => {
      const b = { id: 'buf' + id++, data: Array.from({ length: ch }, () => new Float32Array(len)) };
      b.getChannelData = (c) => b.data[c];
      log.push(['createBuffer', ch, len, sr]);
      return b;
    },
    resume: () => {
      log.push(['resume']);
      return Promise.resolve();
    },
  };
  if (panner) ctx.createStereoPanner = () => node('pan', ['pan']);
  return ctx;
}
