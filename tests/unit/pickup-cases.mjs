// テストの道具：足元の物を拾う処理（src/lib/pickup.ts）・立ち直り（combat.ts の updateRally）・最深部（levels.ts の updateFinal・spawnFinalBoss）を、
// たくさんの場合で呼び、結果を1つの文字列にまとめる。makeF は、場合ごとに関数をまとめた物を返す（場合ごとに、関数が覚える状態を初めに戻すため）。
// pickup.test.mjs が、この文字列の指紋を、移す前の古い JS と同じ値として確かめる。
// 階は Node で本物の迷宮を生成する（gen-places.ts の全部の場所）ので、迷宮の生成を変えると、この指紋も変わる。
// 1つの場合では、本物の階に、拾う物の種類ごとの物（ルーン・組の祭壇・番人のいる祭壇・墓・泉・枠・伝説の物・宝物庫の褒美）と生き物を置き、分かれ道ごとの「場面」を通す
// （拾える距離の内と外・出てすぐ・番人が倒れる・鍛える・枠を開ける・癒す・置き場所を選ぶ・開ける枠が0と1と2つ以上・番人が起きる・天井が崩れて石が当たる・
// 立ち直りの光の粒が着く・王の影が立ち上がり、二つ目の姿になり、亡霊を呼ぶ）。setTimeout は、時計を進めながらここで流す。
// 記録するのは、返す値と、呼ぶたびの状態（プレイヤー・生き物・今の階の物・探索の記録・手と袋・保存した物・伝説の物・最深部・粒子と置いた文字・伝言・画面の部品・音の記録）と、
// 見た目の乱数と音の乱数を引いた数。入れ物に移した状態（fight.rockfall・fight.rallyChime・hudInfo.rallyShown・adv.slotPickN）そのものは記録しない
// （古い JS では包みの一番外の変数だったので。動きは、置いた文字・傷・伝言・画面の描き直しに出る）。
// テストを .mjs で書くのは、偽の画面の部品・偽の Web Audio を、本物の型に合わせられないため。
// 書き換えた状態と、document・window・localStorage・performance・setTimeout・Math.random・音の乱数は、終わったら元に戻す。
import { sndInit } from '../../src/lib/audio.ts';
import { addLooks } from '../../src/lib/bodies/build.ts';
import { MTYPES } from '../../src/lib/creatures.ts';
import { makeRune } from '../../src/lib/gear.ts';
import { makeHistory } from '../../src/lib/history.ts';
import { getLegend } from '../../src/lib/legend.ts';
import { makeMonster } from '../../src/lib/monsters.ts';
import { META_DEF } from '../../src/lib/progress.ts';
import { P, dCol, dPar, dPos } from '../../src/lib/particles.ts';
import { setSoundRand } from '../../src/lib/random.ts';
import { mulberry32 } from '../../src/lib/rng.ts';
import { RUNE_TYPES, TRAITS } from '../../src/lib/runes.ts';
import { SND, adv, buf, clock, fight, gear, gfx, here, hudInfo, msgs, player, saved, ui, vfx } from '../../src/lib/state.ts';
import { CELL, FINAL_DEPTH, MW, NCELL, TF, cpos } from '../../src/lib/world.ts';
import { fakeAudioClass } from './fake-audio.mjs';
import { fakeCamera, fakeTimers, fakeUniforms, fnv, hashArr, text } from './fight-cases.mjs';
import { PLACES, gen, loadEnv } from './gen-places.ts';
import { swapGlobals } from './ui-cases.mjs';
import { stateFp } from './case-out.mjs';

/** 移した関数の名前（場合が全部を呼ぶか、pickup.test.mjs が確かめる） */
export const NAMES = [
  'pickupItems',
  'grabItem',
  'vaultSprung',
  'updateRockfall',
  'openSlot',
  'pickLegend',
  'updateRally',
  'updateFinal',
  'spawnFinalBoss',
];
/** 古い JS から取り出す時の名前（関数と、関数が読む包みの一番外の変数） */
export const LEGACY_NAMES = [...NAMES, 'rockfall', 'rallyShown', 'rallyChime', 'slotPickN'];
const LEGENDS = ['candle', 'bell', 'mirror'];

/** makeF：場合ごとに呼ぶ、関数をまとめた物を返す関数（async でもよい）。seeds：場合の数。page：fakeDom() の偽の画面 */
export async function pickupCases(makeF, seeds, page) {
  const env = await loadEnv(),
    out = [];
  const keep = {
    here: { ...here },
    adv: { ...adv },
    player: { ...player },
    ui: { ...ui },
    vfx: { ...vfx },
    fight: { ...fight },
    SND: { ...SND },
    buf: { ...buf },
    gear: { ...gear },
    gfx: { ...gfx },
    saved: { ...saved },
    hudInfo: { ...hudInfo },
    time: clock.time,
    lord: MTYPES['lord'],
    X: MTYPES['X'],
    final: MTYPES['final'],
    final2: MTYPES['final2'],
    random: Math.random,
    sound: setSoundRand(Math.random),
    msgs: [...msgs],
  };
  const LOOK_FIELDS = ['look', 'form', 'trail', 'col', 'lcol'],
    keptTypes = Object.entries(MTYPES).map(([k, t]) => [k, LOOK_FIELDS.map((f) => [f, Object.getOwnPropertyDescriptor(t, f)])]);
  addLooks();
  const alog = [],
    timers = fakeTimers(),
    errs = [];
  let msgN = 0;
  msgs.push = (...a) => (msgN++, Array.prototype.push.apply(msgs, a));
  const restoreGlobals = swapGlobals({
    document: page.document,
    window: { AudioContext: fakeAudioClass(alog, 'running') },
    localStorage: { setItem: (k, v) => alog.push(['store', k, v]), getItem: () => null },
    performance: { now: () => clock.time * 1000 },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  const keepErr = console.error;
  console.error = (e) => errs.push(String(e && e.message));
  try {
    Math.random = mulberry32(1);
    Object.assign(SND, { ctx: null, master: null, inp: null, wet: null, noise: null, on: true });
    sndInit();
    const actx = SND.ctx;
    for (let s = 1; s <= seeds; s++) {
      const r = mulberry32(s * 48271 + 31),
        pick = (a) => a[Math.floor(r() * a.length)],
        chance = (p) => r() < p;
      let mrN = 0;
      const mrSrc = mulberry32(s * 7919 + 47);
      Math.random = () => (mrN++, mrSrc());
      let sndN = 0;
      const sndSrc = mulberry32(s * 104729 + 53);
      setSoundRand(() => (sndN++, sndSrc()));
      page.reset();
      timers.clear();
      alog.length = 0;
      msgs.length = 0;
      errs.length = 0;
      SND.ctx = actx;
      SND.on = true;
      const place = pick(PLACES);
      adv.runSeed = (r() * 4294967296) >>> 0;
      Object.assign(here, {
        depth: place.depth,
        branch: place.branch ? { ...place.branch } : null,
        realm: place.realm ? { ...place.realm } : null,
        inter: place.inter ? { ...place.inter } : null,
      });
      const res = gen(env, (r() * 4294967296) >>> 0, place, adv.runSeed);
      if (res.lordType) MTYPES['lord'] = res.lordType;
      if (res.beastType) MTYPES['X'] = res.beastType;
      delete MTYPES['final'];
      delete MTYPES['final2'];
      const D = res.level;
      here.D = D;
      here.fixtures = D.fixtures;
      adv.HIST = makeHistory(adv.runSeed);
      adv.HIST_SEED = adv.runSeed;
      saved.LEGEND = null;
      saved.META = { ...META_DEF, grave: null };
      adv.dead = false;
      adv.won = false;
      adv.PLAYER_MAX = 40;
      adv.lvl = { n: 3, exp: 0, pending: 0, bless: {}, strata: new Set() };
      adv.runStats = { kills: 0, t0: 0, maxDepth: here.depth, book0: 0, beastsNew: 0 };
      adv.runState = {
        startChosen: false,
        altar1: false,
        taken: new Set(),
        lordsDone: new Set(),
        bodyOpen: Math.floor(r() * 3),
        slotPend: null,
      };
      Object.assign(ui, {
        started: true,
        gallery: null,
        godMode: false,
        camMode: chance(0.5) ? 'tps' : 'fps',
        invOpen: chance(0.3),
        menuOpen: false,
        altarOpen: false,
        lvlOpen: false,
        locked: true,
        noticeMsgT: {},
      });
      Object.assign(here, { finalSt: null, trans: null, lockCell: -1, mobSeq: 0 });
      clock.time = 20 + r() * 100;
      Object.assign(vfx, { shake: 0, flash: 0, hurtFlash: 0, hpFlash: 0, zapFlash: null });
      buf.pN = 0;
      buf.dn = 0;
      fight.rallyMotes = [];
      gfx.camera = fakeCamera();
      gfx.U = fakeUniforms();
      const F = await makeF();
      const floors = [];
      for (let i = 0; i < NCELL; i++) if (D.tile[i] === TF) floors.push(i);
      const c0 = pick(floors),
        [px, pz] = cpos(c0);
      Object.assign(player, {
        x: px,
        z: pz,
        vx: 0,
        vz: 0,
        yaw: r() * 6.28,
        eye: 1.62,
        hp: adv.PLAYER_MAX,
        rally: 0,
        lastHurt: -99,
        rallyRate: chance(0.5) ? 3 : undefined,
      });
      // 両手：片手の武器を2つ（特性も）。枠の数は 2〜4（4 なら開ける枠が無い）
      const atk = RUNE_TYPES.atk.filter((t) => !['bolt', 'rain', 'gsword', 'mstaff'].includes(t)),
        weapon = () => {
          const w = makeRune(pick(atk)),
            ks = Object.keys(TRAITS[w.type] || {});
          w.traits = ks.filter(() => chance(0.4)).map((k) => ({ k, lv: 1 + Math.floor(r() * 4) }));
          return w;
        },
        hand = () => ({ atk: weapon(), slots: [null, null, null, null], slotN: 2 + Math.floor(r() * 3), turn: 0, elem: null, trig: null });
      gear.hands = { L: hand(), R: hand(), B: { b0: null, b1: null } };
      gear.bag = [];
      gear.castSt = null;
      gear.swapSt = null;
      // 生き物：表の種類の一部（プレイヤーのまわりに）
      here.monsters = [];
      const nearFloor = (rr) => {
        for (let k = 0; k < 30; k++) {
          const cx = Math.floor((player.x + (r() - 0.5) * rr) / CELL),
            cz = Math.floor((player.z + (r() - 0.5) * rr) / CELL),
            i = Math.max(0, Math.min(NCELL - 1, cz * MW + cx));
          if (D.tile[i] === TF) return i;
        }
        return c0;
      };
      const kinds = Object.keys(MTYPES).filter((k) => MTYPES[k].col && !MTYPES[k].dummy && k !== 'final' && k !== 'final2');
      for (const key of kinds) {
        if (!chance(0.25)) continue;
        const i = nearFloor(chance(0.6) ? 5 : 12);
        here.monsters.push(makeMonster({ key, cx: i % MW, cz: (i / MW) | 0, g: -1 }));
      }
      for (const m of here.monsters) m.hp = m.maxHp = 5 + Math.floor(r() * 30);

      const calls = [];
      let rockHit = [false, false];
      const state = () =>
        text({
          player: { x: player.x, z: player.z, hp: player.hp, rally: player.rally },
          mons: here.monsters.map((m) => [
            m.key,
            m.x,
            m.z,
            m.hp,
            m.maxHp,
            m.dead,
            m.sleep,
            m.aware,
            m.noticed,
            m.alert,
            m.phase2,
            m.invulnT,
            m.heartOn,
            m.ty.name,
          ]),
          items: D.items,
          lit: D.lit,
          runState: adv.runState,
          hands: gear.hands,
          bag: gear.bag,
          grave: saved.META.grave,
          legend: saved.LEGEND && { have: saved.LEGEND.have },
          finalSt: here.finalSt && { ...here.finalSt, boss: here.finalSt.boss ? here.monsters.indexOf(here.finalSt.boss) : null },
          final: MTYPES['final'] ? [MTYPES['final'].name, MTYPES['final'].scale, MTYPES['final'].form] : null,
          final2: MTYPES['final2'] ? [MTYPES['final2'].scale, MTYPES['final2'].form] : null,
          motes: fight.rallyMotes,
          vfx: [vfx.hpFlash, vfx.shake, vfx.flash, vfx.hurtFlash],
          pN: buf.pN,
          p: Object.values(P)
            .map((a) => hashArr(a, 0, buf.pN))
            .join(''),
          dn: buf.dn,
          d: [hashArr(dPos, 0, buf.dn * 3), hashArr(dCol, 0, buf.dn * 3), hashArr(dPar, 0, buf.dn * 4)].join(''),
          dom: fnv(JSON.stringify(page.log)),
          errs,
        });
      const call = (name, ...args) => {
        const m0 = mrN,
          s0 = sndN,
          g0 = msgN,
          t0 = timers.st.n,
          a0 = alog.length;
        let ret, threw;
        try {
          ret = F[name](...args);
        } catch (e) {
          threw = String(e && e.message).slice(0, 60);
        }
        calls.push({
          name,
          ret: text(ret),
          threw,
          mr: mrN - m0,
          snd: sndN - s0,
          msg: msgN - g0,
          timers: timers.st.n - t0,
          audio: fnv(JSON.stringify(alog.slice(a0))),
          state: stateFp(state(), fnv),
          msgs: msgs.map((m) => m.html).join('|'),
        });
        return ret;
      };
      // ゲームの時計を進め、setTimeout を流す。置いた文字は、ゲームと同じくフレームごとに数え直す
      const tick = (dt) => {
        clock.time += dt;
        actx.currentTime += dt;
        timers.flush();
        buf.dn = 0;
      };
      const at = (i) => {
        [player.x, player.z] = cpos(i);
      };
      const away = () => {
        player.x = px + 40;
        player.z = pz + 40;
      };
      const add = (o) => (D.items.push({ taken: false, ...o }), D.items[D.items.length - 1]);
      const rune = () => makeRune(pick([...RUNE_TYPES.elem, ...RUNE_TYPES.mod, ...atk]));

      // ---- 場面：階に元からある物を、1つずつ踏む（祭壇の物は拾わない）
      for (const it of D.items.slice(0, 10)) {
        at(it.i);
        call('pickupItems');
        tick(0.1);
      }
      // ---- 場面：番人のいる祭壇。遠くで一度見て（番人がいる）、番人が倒れたら光が灯る（組と、組の無い強敵の褒美）
      const gi = nearFloor(4),
        gx = gi % MW,
        gz = (gi / MW) | 0;
      const guards = [0, 1].map(() => makeMonster({ key: pick(['O', 'k', 'g'].filter((k) => MTYPES[k])), cx: gx, cz: gz, g: 77 }));
      here.monsters.push(...guards);
      add({ i: gi, kind: 'rune', rune: rune(), guardG: 77, altar: true, grp: 'g77', slot: 0 });
      add({ i: gi + 1, kind: 'rune', rune: rune(), guardG: 77, elitePrize: true });
      away();
      call('pickupItems');
      for (const m of guards) m.dead = true;
      call('pickupItems');
      at(gi + 1);
      call('pickupItems');
      call('pickupItems');
      tick(0.1);
      // ---- 場面：ルーン（出てすぐは拾わない・遠いと拾わない・始めの台の組）
      for (const born of [clock.time, clock.time - 0.3, clock.time - 2, undefined]) {
        const i = nearFloor(6);
        add({ i, kind: 'rune', rune: rune(), born });
        at(i);
        if (chance(0.3)) player.x += 0.8;
        call('pickupItems');
        tick(0.2);
      }
      {
        const i = nearFloor(6);
        for (let k = 0; k < 3; k++) add({ i, kind: 'rune', rune: rune(), grp: 'start', pedestal: true, slot: k });
        at(i);
        call('pickupItems');
        tick(0.1);
      }
      // ---- 場面：墓・泉（傷が無いと使わない）・枠（出てすぐは拾わない）・伝説の物
      {
        const i = nearFloor(6);
        saved.META.grave = { rune: rune(), depth: 3 };
        add({ i, kind: 'grave', rune: rune() });
        at(i);
        call('pickupItems');
        tick(0.1);
      }
      for (const hp of [adv.PLAYER_MAX, adv.PLAYER_MAX - 0.3, 10]) {
        const i = nearFloor(6);
        player.hp = hp;
        player.rally = 3;
        add({ i, kind: 'spring' });
        at(i);
        call('pickupItems');
        tick(0.3);
      }
      for (const born of [clock.time - 0.5, clock.time - 3]) {
        const i = nearFloor(6);
        add({ i, kind: 'slot', born });
        at(i);
        call('pickupItems');
        tick(0.3);
      }
      getLegend();
      for (const k of LEGENDS) {
        const i = nearFloor(6);
        add({ i, kind: 'legend', legend: k, born: chance(0.3) ? clock.time : clock.time - 5 });
        at(i);
        call('pickupItems');
        tick(2);
      }
      call('pickLegend', { i: c0, kind: 'legend', legend: pick(LEGENDS), taken: true });
      tick(2);
      // ---- 場面：開ける枠の数ごと（0・1・2つ以上）。選ぶ祭壇が立てば、その1つを取る
      for (const [nL, nR, body] of [
        [4, 4, 2],
        [4, 3, 2],
        [2, 3, 0],
        [3, 2, 1],
      ]) {
        gear.hands.L.slotN = nL;
        gear.hands.R.slotN = nR;
        adv.runState.bodyOpen = body;
        const i = nearFloor(6);
        const n0 = D.items.length;
        call('openSlot', i);
        tick(0.3);
        const opt = D.items.slice(n0).find((o) => o.opt === 'open');
        if (opt) call('grabItem', opt, D.items.indexOf(opt), ...cpos(i));
        tick(0.1);
      }
      // ---- 場面：祭壇の選択肢（鍛える：ある特性・無い特性、枠を開ける、癒す、置き場所を選ぶ、ルーン）
      {
        const w = gear.hands.L.atk,
          ks = Object.keys(TRAITS[w.type] || {}),
          have = (w.traits || []).map((t) => t.k),
          fresh = ks.find((k) => !have.includes(k));
        const opts = [
          ...(have.length ? [{ opt: 'forge', forgeW: w, forgeK: have[0], forgeTo: 5 }] : []),
          ...(fresh ? [{ opt: 'forge', forgeW: w, forgeK: fresh, forgeTo: 1 }] : []),
          { opt: 'open', target: 'body', label: '身の護符の枠', grp: 'slotpick9' },
          { opt: 'heal' },
          { opt: 'rune', rune: rune(), dest: 'bag' },
          { opt: 'rune', rune: rune(), grp: 'altar1' },
        ];
        player.hp = 12;
        adv.runState.slotPend = 'slotpick9';
        for (const o of opts) {
          const i = nearFloor(6),
            { dest, ...rest } = o;
          const grp = rest.grp ?? 'alt' + D.items.length;
          const list = [0, 1, 2].map((k) => add({ i, kind: 'rune', altar: true, slot: k, rune: rest.rune ?? rune(), ...rest, grp }));
          const it = list[0];
          call('grabItem', it, D.items.indexOf(it), ...cpos(i), dest);
          tick(0.1);
        }
      }
      // ---- 場面：宝物庫の褒美（番人が起きる・天井が崩れる。部屋の中と、部屋の外の宝物庫のまわり）
      const room = D.rooms.find((rm) => rm.cells.length > 6);
      for (const [ev, inRoom] of [
        ['guard', true],
        ['guard', false],
        ['collapse', true],
        ['collapse', false],
      ]) {
        const i = inRoom && room ? (pick(room.cells.filter((c) => D.tile[c] === TF)) ?? c0) : nearFloor(8);
        const it = add({ i, kind: 'rune', rune: rune(), vault: true, ev });
        at(i);
        call('pickupItems');
        // 落石：崩れる間、プレイヤーのまわりに石が落ち、当たる（生き物も置く）
        if (ev === 'collapse') {
          for (let k = 0; k < 3; k++) {
            const m = makeMonster({ key: pick(kinds), cx: Math.floor(player.x / CELL), cz: Math.floor(player.z / CELL), g: -1 });
            m.hp = m.maxHp = 50;
            here.monsters.push(m);
          }
          const hp0 = player.hp,
            mon0 = here.monsters.reduce((a, m) => a + m.hp, 0);
          for (let k = 0; k < 120; k++) {
            call('updateRockfall', 0.1);
            tick(0.1);
          }
          rockHit = [rockHit[0] || player.hp < hp0, rockHit[1] || here.monsters.reduce((a, m) => a + m.hp, 0) < mon0];
          call('updateRockfall', 0.1);
        }
        void it;
        tick(0.1);
      }
      call('vaultSprung', add({ i: nearFloor(6), kind: 'rune', rune: rune(), vault: true, ev: 'guard', taken: true }));
      call('updateRockfall', 0.1);
      // ---- 場面：立ち直り（光の粒が手元へ飛んで着く・取り戻せる分が減る・死んでいる間は何もしない）
      for (let round = 0; round < 2; round++) {
        player.hp = 15;
        player.rally = 4 + r() * 6;
        player.lastHurt = clock.time - (chance(0.5) ? 0.2 : 2);
        for (let k = 0; k < 6; k++)
          fight.rallyMotes.push({
            x0: player.x + r(),
            y0: 1,
            z0: player.z + r(),
            t: -r() * 0.3,
            dur: 0.3 + r() * 0.5,
            amt: 1 + r() * 3,
            c: [r(), r(), r()],
            wob: r() * 6,
          });
        for (let k = 0; k < 14; k++) {
          call('updateRally', 0.07);
          tick(0.07);
        }
      }
      adv.dead = true;
      call('updateRally', 0.1);
      adv.dead = false;
      // ---- 場面：最深部（最深部でない・伝説の物が揃っていない・揃って王の影が立つ・半分を切ると二つ目の姿・亡霊を呼ぶ・死んでいる）
      here.finalSt = { c0, boss: null, bossT: -1, summonT: r() * 3, said: false };
      call('updateFinal', 0.1);
      Object.assign(here, { depth: FINAL_DEPTH, branch: null, realm: null, inter: null });
      ui.started = chance(0.7);
      saved.LEGEND.have = new Set(LEGENDS.slice(0, 2));
      call('updateFinal', 0.1);
      tick(2);
      saved.LEGEND.have = new Set(LEGENDS);
      for (let k = 0; k < 140; k++) {
        const b = here.finalSt.boss;
        if (b && k === 60) {
          b.hp = b.maxHp * 0.4;
          b.invulnT = 0.5;
        }
        if (k === 100) here.monsters = here.monsters.filter((m) => m.key !== 'W' || chance(0.5));
        if (k === 130 && b) b.dead = true;
        call('updateFinal', 0.25);
        tick(0.25);
      }
      adv.dead = true;
      call('updateFinal', 0.1);
      adv.dead = false;
      call('spawnFinalBoss');
      tick(2);

      out.push({ seed: s, place: place.key ?? `${place.depth}`, calls, timers: timers.st.threw, rockHit });
    }
  } finally {
    console.error = keepErr;
    restoreGlobals();
    delete msgs.push;
    Math.random = keep.random;
    setSoundRand(keep.sound);
    const boxes = { here, adv, player, ui, vfx, fight, SND, buf, gear, gfx, saved, hudInfo };
    for (const [k, obj] of Object.entries(boxes)) {
      for (const f of Object.keys(obj)) if (!(f in keep[k])) delete obj[f];
      Object.assign(obj, keep[k]);
    }
    clock.time = keep.time;
    for (const k of ['lord', 'X', 'final', 'final2']) {
      if (keep[k]) MTYPES[k] = keep[k];
      else delete MTYPES[k];
    }
    msgs.length = 0;
    msgs.push(...keep.msgs);
    for (const [k, fs] of keptTypes)
      for (const [f, d] of fs) {
        if (d) Object.defineProperty(MTYPES[k], f, d);
        else delete MTYPES[k][f];
      }
  }
  return out;
}

/** 記録を1つの文字列にする（pickup.test.mjs が指紋を取る） */
export const pickupText = (all) =>
  all.map((c) => JSON.stringify({ seed: c.seed, place: c.place, calls: c.calls, timers: c.timers })).join('\n');
