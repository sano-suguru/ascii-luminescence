// PV を撮る道具（tools/pv.mjs）が、ページの中に入れる道具。installPageLib は page.evaluate でページの中で動き、window.__pv を作る。
// テスト用モードの __test と dbg だけを使う（ゲームの中身は直に触らない）。
export function installPageLib() {
  const st = () => __test.state();
  const P = {
    names: {}, // 名前 → {key, x, z}（最後に見た所。生き物の番号は倒れると詰まるので、同じ種類で一番近い物を探し直す）
    target: null,
    lastC: null, // 的の体の真ん中（倒れた後もこれを使う）
    y0: 0,
    cam: null, // 置き場所を探した結果 {sign, s}
    fire: null, // 火をつけた所と、その時の生き物までの距離
  };
  const index = (name) => {
    const r = P.names[name];
    if (!r) return -1;
    let best = -1,
      bd = 1e9;
    st().monsters.forEach((m, i) => {
      if (m[0] !== r.key) return;
      const d = Math.hypot(m[1] - r.x, m[2] - r.z);
      if (d < bd && d < 3) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) {
      const m = st().monsters[best];
      r.x = m[1];
      r.z = m[2];
    }
    return best;
  };
  const center = (name) => {
    const n = index(name);
    if (n < 0) return null;
    const m = __test.mob(n),
      v = __test.monsterView(P.names[name].key);
    return [m.x, v && v.world ? (v.world.y0 + v.world.y1) / 2 : 1, m.z];
  };
  const targetCenter = () => {
    const c = P.target && center(P.target);
    if (c) P.lastC = c;
    return P.lastC;
  };
  // プレイヤーの前の、見えている床（燃えていない・水や溶岩でない）。向きのずれが小さい順
  const floorAhead = (dist, spread) => {
    const s = st(),
      { w, h } = __test.size(),
      out = [];
    for (let i = 0; i < w * h; i++) {
      const c = __test.cell(i);
      if (!c.floor || !c.seen || c.lava || c.water || c.fire > 0) continue;
      const dx = c.x - s.pos[0],
        dz = c.z - s.pos[1],
        d = Math.hypot(dx, dz);
      if (Math.abs(d - dist) > 1.2) continue;
      let da = Math.atan2(-dx, -dz) - s.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= spread) out.push([Math.abs(da), i]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  };
  // 的とプレイヤーを結ぶ線（u）とそれに直角な向き（n）。的が無ければプレイヤーの向き
  const axis = () => {
    const s = st(),
      p = [s.pos[0], s.pos[1]],
      c = targetCenter();
    let u;
    if (c) {
      const dx = c[0] - p[0],
        dz = c[2] - p[1],
        d = Math.hypot(dx, dz) || 1;
      u = [dx / d, dz / d];
    } else u = [-Math.sin(s.yaw), -Math.cos(s.yaw)];
    return { p, u, n: [-u[1], u[0]], c };
  };
  // カメラの位置と見る所（k は 0〜1 の進み、sign は左右、s は距離の倍率）
  const camPose = (C, k, sign, s) => {
    const a = axis();
    if (!a.c && C.at) return null;
    let pos;
    if (C.orbit) {
      const o = C.orbit,
        ang = (sign * (o.a0 + (o.a1 - o.a0) * k) * Math.PI) / 180,
        r = o.r * s;
      pos = [
        a.c[0] + r * (-a.u[0] * Math.cos(ang) + a.n[0] * Math.sin(ang)),
        o.up,
        a.c[2] + r * (-a.u[1] * Math.cos(ang) + a.n[1] * Math.sin(ang)),
      ];
    } else {
      const L = (x, y) => x + (y - x) * k,
        side = sign * s * L(C.from.side, C.to.side),
        back = s * L(C.from.back, C.to.back);
      pos = [a.p[0] - a.u[0] * back + a.n[0] * side, L(C.from.up, C.to.up), a.p[1] - a.u[1] * back + a.n[1] * side];
    }
    const tgt = a.c ?? [a.p[0] + a.u[0] * 5, 1, a.p[1] + a.u[1] * 5],
      at = C.at === 'between' ? [(a.p[0] + tgt[0]) / 2, 1.1, (a.p[1] + tgt[2]) / 2] : tgt;
    return { pos, at };
  };
  // 置いたカメラの手前に壁が無いか。__test.cam は横に 0.4 までしか見ないので、手前の大きな文字が画面を埋めないよう、もっと広く見る：
  // まわり（横に r まで）と、見る向きの左右 25 度までの斜め前（2r まで）。壁のほか、床の上の大きな岩（立てないマス。水と溶岩は除く）も数える
  const rock = (p) => {
    if (typeof __test.cam({ pos: p, at: [p[0], p[1], p[2] + 1] }) === 'string') return true;
    const c = __test.cell(Math.floor(p[2] / 2) * __test.size().w + Math.floor(p[0] / 2));
    return !c.floor && !c.water && !c.lava;
  };
  const roomy = (pos, at, r) => {
    for (const rr of [r * 0.5, r])
      for (let q = 0; q < 8; q++) {
        const a = (q / 8) * Math.PI * 2;
        if (rock([pos[0] + Math.cos(a) * rr, pos[1], pos[2] + Math.sin(a) * rr])) return false;
      }
    const yaw = Math.atan2(at[0] - pos[0], at[2] - pos[2]);
    for (const da of [-0.44, -0.22, 0, 0.22, 0.44])
      for (const d of [r, r * 1.5, r * 2])
        if (rock([pos[0] + Math.sin(yaw + da) * d, pos[1], pos[2] + Math.cos(yaw + da) * d])) return false;
    return true;
  };
  const lib = {
    setup(steps, target, hide) {
      const notes = [],
        s0 = st();
      P.target = target;
      P.y0 = s0.yaw;
      const used = new Set();
      for (const [op, a, b] of steps) {
        if (op === 'clear') __test.clearAll();
        else if (op === 'equip') {
          const r = __test.equip(a, b);
          if (r !== b) notes.push(`equip ${a} ${b}：${r}`);
        } else if (op === 'elem') {
          const r = __test.elem(a, b);
          if (r !== b) notes.push(`elem ${a} ${b}：${r}`);
        } else if (op === 'give') dbg.give(a);
        else if (op === 'summon') {
          const c = floorAhead(b.ahead, b.spread ?? 0.3).find((c) => !used.has(c));
          if (c === undefined) {
            notes.push(`summon ${b.as}：${b.ahead} 先に置ける床が無い`);
            continue;
          }
          used.add(c);
          __test.summon(a, c);
          const m = st().monsters.at(-1);
          P.names[b.as] = { key: a, x: m[1], z: m[2] };
        } else if (op === 'hold') {
          const n = index(a);
          if (n < 0) {
            notes.push(`hold ${a}：いない`);
            continue;
          }
          const m = __test.mob(n),
            s = st(),
            r = __test.hold(n, b && b.face === 'player' ? { yaw: Math.atan2(s.pos[0] - m.x, s.pos[1] - m.z) } : {});
          if (r !== true) notes.push(`hold ${a}：${r}`);
        }
      }
      __test.advance(0.3);
      const c = targetCenter();
      if (c) dbg.look(...c);
      const skip = hide.includes('hands') ? ['hands', 'castfx'] : [];
      __test.skipPhase(skip);
      if (hide.includes('others')) {
        const keep = P.target ? P.names[P.target].key : null;
        for (const m of st().monsters) if (m[0] !== keep) __test.hideMonster(m[0], true);
      }
      return notes;
    },
    // カメラの置き場所を探す：左右を入れ替える・近づける。始め・半ば・終わりの3か所とも、岩の中でなく、見る所まで岩を通らず、
    // 横に clear まで壁が無いこと。壁から離せる所が無ければ、岩の中でない所で我慢する（わけを返す）
    findCam(C) {
      const clear = C.clear ?? 1.2;
      let loose = null;
      for (const s of [1, 0.85, 0.7, 0.55, 0.4])
        for (const sign of [1, -1]) {
          let ok = true,
            room = true;
          for (const k of [0, 0.5, 1]) {
            const pose = camPose(C, k, sign, s),
              r = pose && __test.cam(pose);
            if (!pose || typeof r === 'string' || !r.clear) {
              ok = false;
              break;
            }
            if (room && !roomy(pose.pos, pose.at, clear)) room = false;
          }
          if (ok && room) {
            P.cam = { sign, s };
            __test.cam(null);
            return { sign, s, room: true };
          }
          if (ok && !loose) loose = { sign, s, room: false };
        }
      __test.cam(null);
      P.cam = loose;
      return loose;
    },
    placeCam(C, k) {
      if (!P.cam) return 'no place';
      const pose = camPose(C, k, P.cam.sign, P.cam.s);
      if (!pose) return 'no target';
      const r = __test.cam(pose);
      return typeof r === 'string' ? r : r.clear ? 'ok' : 'blocked';
    },
    // プレイヤーの目のまま撮る時の動き（walk のキーは撮る道具が押す）
    eyeLook(t, k, eye) {
      const s = st(),
        a = P.y0 + (eye.sway ? eye.sway * Math.sin(t * 1.6) : 0) + (eye.pan ? eye.pan * (0.5 - k) : 0);
      dbg.look(s.pos[0] - Math.sin(a) * 20, 0.9, s.pos[1] - Math.cos(a) * 20);
    },
    aimTarget() {
      const c = targetCenter();
      if (c) dbg.look(...c);
    },
    targetHp() {
      const n = P.target ? index(P.target) : -1;
      return n < 0 ? null : st().monsters[n][3];
    },
    ignite(radius) {
      const c = targetCenter();
      if (!c) return 0;
      const { w } = __test.size(),
        cx = Math.floor(c[0] / 2),
        cz = Math.floor(c[2] / 2),
        R = Math.ceil(radius / 2);
      let k = 0;
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const i = (cz + dz) * w + cx + dx,
            cell = __test.cell(i);
          if (cell && cell.floor && !cell.water && cell.fuel > 0 && Math.hypot(cell.x - c[0], cell.z - c[2]) <= radius) {
            __test.ignite(i);
            k++;
          }
        }
      P.fire = { x: c[0], z: c[2], d0: {} };
      for (const nm in P.names) {
        const n = index(nm);
        if (n >= 0) P.fire.d0[nm] = Math.hypot(__test.mob(n).x - c[0], __test.mob(n).z - c[2]);
      }
      return k;
    },
    burning() {
      const { w, h } = __test.size();
      let k = 0;
      for (let i = 0; i < w * h; i++) if (__test.cell(i).fire > 0) k++;
      return k;
    },
    away() {
      const out = {};
      if (!P.fire) return out;
      for (const nm in P.fire.d0) {
        const n = index(nm);
        if (n >= 0) out[nm] = +(Math.hypot(__test.mob(n).x - P.fire.x, __test.mob(n).z - P.fire.z) - P.fire.d0[nm]).toFixed(2);
      }
      return out;
    },
    targetView() {
      const n = P.target ? index(P.target) : -1;
      return n < 0 ? null : __test.monsterView(P.names[P.target].key);
    },
    caption(text, alpha) {
      let e = document.getElementById('pvcap');
      if (!e) {
        e = document.createElement('div');
        e.id = 'pvcap';
        e.style.cssText =
          'position:fixed;left:0;right:0;bottom:11%;text-align:center;z-index:99999;pointer-events:none;font-family:"M PLUS 1 Code","BIZ UDGothic",sans-serif;' +
          'font-weight:500;font-size:3.1vw;letter-spacing:.18em;color:#f4ecff;text-shadow:0 0 .35em rgba(170,130,255,.9),0 0 1.2em rgba(255,170,110,.45),0 .08em .2em #000';
        document.body.appendChild(e);
      }
      e.textContent = text;
      e.style.opacity = String(alpha);
    },
  };
  window.__pv = lib;
}
