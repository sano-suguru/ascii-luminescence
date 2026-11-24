// テストの道具：偽の Web Audio（AudioContext）。作った部品・値の書き込み・つなぎ方・鳴らす時刻を、全部 log に記録する。
// Node には Web Audio が無いので、音を鳴らす処理（src/lib/audio.ts）は、これを SND.ctx に入れて確かめる。
//   const log = []; SND.ctx = fakeAudio(log);  …  log は [部品, 欄, したこと, 値…] の並び
// 部品の名前は、作った順の番号つき（gain0・osc1 など）。state は 'running'（鳴らせる）か 'suspended'（止まっている）
/** window.AudioContext の代わり（new で呼ばれると、偽の Web Audio を返す） */
export function fakeAudioClass(log, state = 'running') {
  return function FakeAudioContext() {
    return fakeAudio(log, state);
  };
}
export function fakeAudio(log, state = 'running') {
  let id = 0;
  const param = (owner, name) => {
    const p = { v: 0 };
    Object.defineProperty(p, 'value', {
      get: () => p.v,
      set: (v) => {
        log.push([owner, name, '=', v]);
        p.v = v;
      },
    });
    for (const m of ['setValueAtTime', 'setTargetAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime'])
      p[m] = (...a) => {
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
  return {
    state,
    currentTime: 12.5,
    sampleRate: 50,
    destination: { id: 'dest' },
    createGain: () => node('gain', ['gain']),
    createOscillator: () => node('osc', ['frequency']),
    createBiquadFilter: () => node('filt', ['frequency', 'Q']),
    createBufferSource: () => node('src', []),
    createStereoPanner: () => node('pan', ['pan']),
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
}
