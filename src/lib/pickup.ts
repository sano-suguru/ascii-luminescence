// 足元の物を拾う（もとは src/game/21-altars-heal.js と 24-goal.js）。ルーン・墓・泉・枠・伝説の物を拾った時と、宝物庫の褒美を取った時（番人が起きる・天井が崩れる）と、落石。
// 状態の入れ物 here（今の階の物 items と生き物）・player・adv（探索の記録）・gear（手）・fight（落石 rockfall）・saved（墓と伝説の物）に頼る。
// 呼ぶのは src/lib/loop.ts の tick（pickupItems と、落石だけの段で updateRockfall）、21-altars-heal.js の祭壇の画面（grabItem）、23-debug.js（openSlot）
import { lookup, must, nth } from './array.ts';
import { guardedNow, placeChosen, takeRune, vaultArea } from './altars.ts';
import { sChime, sRumble } from './audio.ts';
import { css } from './color.ts';
import { damageMonster, hurtPlayer } from './combat.ts';
import { MTYPES } from './creatures.ts';
import { applyOpen, makeRune, randomRuneType } from './gear.ts';
import { G } from './glyphs.ts';
import { renderHotbar } from './hotbar.ts';
import { renderInv } from './inventory.ts';
import { getLegend } from './legend.ts';
import { levelSeed } from './levels.ts';
import { msg } from './log.ts';
import { makeMonster } from './monsters.ts';
import { LEGEND_KINDS } from './names.ts';
import { dyn, spawn } from './particles.ts';
import { keyedRand, mpick, mr } from './random.ts';
import { RUNE_DEF, SLOT_MAX, thingLabel, trList, trName } from './runes.ts';
import { saveMeta } from './save.ts';
import { adv, clock, fight, gear, here, player, saved, ui, vfx } from './state.ts';
import { renderStatus } from './status.ts';
import { MW, TF, cpos } from './world.ts';
import type { Item } from './generate.ts';

const level = () => must(here.D, '今の階 here.D');

/** 宝物庫の褒美を取った時：番人が目を覚ます（ev が 'guard'）か、天井が崩れ始める（落石。それ以外） */
export function vaultSprung(it: Item): void {
  const ri = nth(level().roomOf, it.i),
    room = ri >= 0 && level().rooms[ri] && nth(level().rooms, ri).cells.length > 6 ? nth(level().rooms, ri) : { cells: vaultArea(it, 4) };
  if (it.ev === 'guard') {
    const pool = here.monsters.filter((m) => !m.dead && !m.ty.critter && !m.ty.peaceful && !m.ty.boss && m.key !== 'lord' && MTYPES[m.key]);
    const key = pool.length
      ? nth(
          pool.sort((a, b) => (b.maxHp || 0) - (a.maxHp || 0)),
          0,
        ).key
      : 'O';
    const cells = vaultArea(it, 5).filter((c) => {
      const [x, z] = cpos(c);
      return Math.hypot(x - player.x, z - player.z) > 2.0;
    });
    const r = keyedRand('vault', levelSeed(), it.i); // where the guardians stand: its own random, not the look random (mr)
    for (let k = 0; k < 2 && cells.length; k++) {
      const c = nth(cells.splice(Math.floor(r() * cells.length), 1), 0);
      const m = makeMonster({ key, cx: c % MW, cz: (c / MW) | 0, g: -1, lead: true });
      m.sleep = false;
      m.aware = 1;
      m.noticed = true;
      m.alert = 1;
      here.monsters.push(m);
      for (let q = 0; q < 24; q++) {
        const a = mr() * 6.28;
        spawn(
          m.x,
          0.2 + mr() * 1.6,
          m.z,
          Math.cos(a) * 0.8,
          mr() * 0.8,
          Math.sin(a) * 0.8,
          0.9,
          G(mpick(['#', '%', '.'])),
          0.14,
          0.8,
          0.78,
          0.85,
          0,
        );
      }
    }
    sRumble(0.4, 1.2);
    msg('<b style="color:#ffb0a0">!</b>石像の目に光が灯った。宝の番人たちが、目を覚ます。');
  } else if (room.cells.length) {
    fight.rockfall = { t: 0, dur: 9, cells: room.cells.filter((c) => level().tile[c] === TF), rocks: [], next: 0.2 };
    sRumble(0.5, 2.0);
    msg('<b style="color:#ffd0a0">!</b>天井が軋み、崩れ始めた。早く外へ。');
  }
}

/** 落石を dt 秒進める：崩れる間は、プレイヤーの近くを多めに、石を落とす。石は落ちる影と一緒に描き、落ちきった所のプレイヤーと生き物に当たる */
export function updateRockfall(dt: number): void {
  if (!fight.rockfall) return;
  const R = fight.rockfall;
  R.t += dt;
  R.next -= dt;
  if (R.t < R.dur && R.next <= 0) {
    R.next = 0.28 + mr() * 0.2;
    const near = R.cells.filter((c) => {
      const [x, z] = cpos(c);
      return Math.hypot(x - player.x, z - player.z) < 4.5;
    });
    const c = (near.length && mr() < 0.7 ? near : R.cells)[Math.floor(mr() * (near.length && mr() < 0.7 ? near.length : R.cells.length))];
    if (c !== undefined) {
      const [x, z] = cpos(c);
      R.rocks.push({ x: x + (mr() - 0.5) * 1.2, z: z + (mr() - 0.5) * 1.2, t: 0 });
    }
  }
  for (const k of R.rocks) {
    k.t += dt;
    if (k.t < 0.9) {
      const f = k.t / 0.9;
      for (let q = 0; q < 10; q++) {
        const a = (q / 10) * Math.PI * 2;
        dyn(k.x + Math.cos(a) * 0.55, 0.04, k.z + Math.sin(a) * 0.55, G('.'), 0.13, 0.9 + 0.8 * f, 0.45 + 0.3 * f, 0.2, 0, 0);
      }
      dyn(k.x, 3.2 - 2.6 * f * f, k.z, G('#'), 0.3, 0.7, 0.66, 0.6, 0, 0);
    } else if (!k.hit) {
      k.hit = true;
      for (let q = 0; q < 14; q++) {
        const a = mr() * 6.28;
        spawn(
          k.x,
          0.2,
          k.z,
          Math.cos(a) * 1.4,
          0.6 + mr() * 1.2,
          Math.sin(a) * 1.4,
          0.7,
          G(mpick(['#', '%', '.', ','])),
          0.14,
          0.75,
          0.7,
          0.62,
          1,
        );
      }
      if (Math.hypot(k.x - player.x, k.z - player.z) < 0.65) hurtPlayer(6, '落石');
      for (const m of here.monsters) if (!m.dead && Math.hypot(k.x - m.x, k.z - m.z) < 0.65) damageMonster(m, 6, '落石');
    }
  }
  R.rocks = R.rocks.filter((k) => k.t < 1.2);
  if (R.t >= R.dur && !R.rocks.length) fight.rockfall = null;
}

/**
 * 足元の物を拾う（毎フレーム）。番人が倒れた祭壇に光を灯し、伝説の物・墓・泉・枠は近づくと拾い、ルーンは祭壇の物のほかを拾う
 * （祭壇の物は祭壇の画面で選ぶ）
 */
export function pickupItems(): void {
  for (let k = 0; k < (level().items || []).length; k++) {
    const it = nth(level().items, k);
    if (it.taken) continue;
    if (it.kind === 'rune' && it.guardG !== undefined) {
      const gd = guardedNow(it);
      if (it.wasGuarded && !gd && !(level().lit || (level().lit = new Set())).has(it.grp || it.i)) {
        must(level().lit).add(it.grp || it.i);
        const [lx, lz] = cpos(it.i);
        sChime(lx, lz, 0.5);
        msg(
          it.elitePrize
            ? '<b style="color:#ffd27a">*</b>番人が倒れた。守られていたルーンが、手の届く光になった。'
            : '<b style="color:#ffd27a">_</b>祭壇に光が灯った。',
        );
      }
      it.wasGuarded = gd;
      if (gd) continue;
    }
    if (it.kind === 'legend') {
      if (it.born && clock.time - it.born < 1) continue;
      const [lx, lz] = cpos(it.i);
      if (Math.hypot(lx - player.x, lz - player.z) < 0.9) {
        it.taken = true;
        pickLegend(it);
      }
      continue;
    }
    if (it.kind === 'grave') {
      const [gx, gz] = cpos(it.i);
      if (Math.hypot(gx - player.x, gz - player.z) < 0.9) {
        it.taken = true;
        takeRune(must(it.rune));
        msg(`<b style="color:#c8c8d8">+</b>先人の形見を、墓から拾った：${thingLabel(must(it.rune))}`);
        saved.META.grave = null;
        saveMeta();
        sChime(gx, gz, 0.4);
      }
      continue;
    }
    if (it.kind === 'spring') {
      const [sx, sz] = cpos(it.i);
      if (player.hp < adv.PLAYER_MAX - 0.5 && Math.hypot(sx - player.x, sz - player.z) < 0.9) {
        it.taken = true;
        adv.runState.taken.add(levelSeed() + ':' + k + ':spring');
        player.hp = adv.PLAYER_MAX;
        player.rally = 0;
        vfx.hpFlash = 0.6;
        renderStatus();
        sChime(sx, sz, 0.5);
        setTimeout(() => sChime(sx, sz, 0.35), 200);
        msg('<b style="color:#8fe0ff">~</b>泉の光が体を満たし、傷がすっかり癒えた。泉は静かに光を失った。');
        for (let q = 0; q < 30; q++) {
          const a = mr() * 6.28;
          spawn(
            player.x + Math.cos(a) * 0.5,
            0.2 + mr(),
            player.z + Math.sin(a) * 0.5,
            Math.cos(a) * 0.4,
            0.8 + mr(),
            Math.sin(a) * 0.4,
            1.0,
            G(mpick(['*', '.', '~'])),
            0.12,
            0.8,
            1.8,
            2.2,
            0,
          );
        }
      }
      continue;
    }
    if (it.kind === 'slot') {
      if (it.born && clock.time - it.born < 1) continue;
      const [sx, sz] = cpos(it.i);
      if (Math.hypot(sx - player.x, sz - player.z) < 0.9) {
        it.taken = true;
        openSlot(it.i);
      }
      continue;
    }
    if (it.kind !== 'rune' || !it.rune) continue;
    if (it.born && clock.time - it.born < 0.6) continue;
    const [x, z] = cpos(it.i);
    if (it.altar) continue;
    if (Math.hypot(x - player.x, z - player.z) > 0.75) continue;
    grabItem(it, k, x, z);
  }
}

/**
 * 物 it（今の階の k 番目。位置 x・z）を取る。同じ組の物は消え、祭壇の選択肢なら、特性を鍛える・枠を開ける・傷を癒す。ルーンは手か袋に入れる
 * （dest があれば、置き場所を選ぶ）。宝物庫の褒美なら、番人が起きるか天井が崩れる
 */
export function grabItem(it: Item, k: number, x: number, z: number, dest?: unknown): void {
  it.taken = true;
  adv.runState.taken.add(levelSeed() + ':' + k + ':rune');
  if (it.grp) {
    level().items.forEach((o, j) => {
      if (o !== it && o.grp === it.grp && !o.taken) {
        o.taken = true;
        adv.runState.taken.add(levelSeed() + ':' + j + ':rune');
        const [ox, oz] = cpos(o.i);
        for (let q = 0; q < 12; q++) {
          const a = mr() * 6.28;
          spawn(
            ox + (o.altar ? ((o.slot ?? NaN) - 1) * 0.55 : 0),
            0.95,
            oz,
            Math.cos(a) * 0.8,
            0.3 + mr() * 0.6,
            Math.sin(a) * 0.8,
            0.9,
            G('.'),
            0.1,
            0.8,
            0.75,
            1.0,
            0,
          );
        }
      }
    });
  }
  if (it.grp === 'start') adv.runState.startChosen = true;
  if (it.grp === 'altar1') adv.runState.altar1 = true;
  if (it.opt === 'forge') {
    const w = must(it.forgeW),
      t = trList(w).find((t) => t.k === it.forgeK);
    if (t) t.lv = must(it.forgeTo);
    else {
      w.traits = w.traits || [];
      w.traits.push({ k: must(it.forgeK), lv: must(it.forgeTo) });
    }
    msg(
      `<b style="color:#bcdcff">T</b>${lookup(RUNE_DEF, w.type).name}の「${trName(w.type, { k: must(it.forgeK) })}」が Lv${it.forgeTo} になった。`,
    );
    sChime(x, z, 0.5);
    renderHotbar();
    if (ui.invOpen) renderInv();
    return;
  }
  if (it.opt === 'open') {
    applyOpen(must(it.target));
    if (adv.runState.slotPend === it.grp) adv.runState.slotPend = null;
    msg(`<b style="color:#ffe3a0">{ }</b>${it.label}が開いた。`);
    sChime(x, z, 0.5);
    return;
  }
  if (it.opt === 'heal') {
    player.hp = Math.min(adv.PLAYER_MAX, player.hp + adv.PLAYER_MAX * 0.7);
    renderStatus();
    msg('<b style="color:#ff9aa8">+</b>温かな光が、傷を塞いでいく。');
    sChime(x, z, 0.45);
    return;
  }
  if (dest) {
    placeChosen(must(it.rune));
    sChime(x, z, 0.45);
    return;
  }
  takeRune(must(it.rune), it.grp === 'start' ? 'R' : null);
  sChime(x, z, 0.45);
  if (it.vault) vaultSprung(it);
}

/**
 * 空の枠（マス cell）を拾った時：開けられる枠が無ければルーンに変わり、1つなら開け、2つ以上なら、その場に選ぶ祭壇を立てる
 * （選ばなかった枠は、離れた時に src/lib/levels.ts の settleSlotPick が開ける）
 */
export function openSlot(cell: number): void {
  const opts: { target: string; label: string }[] = [];
  for (const h of ['R', 'L'] as const)
    if ((must(gear.hands)[h].slotN || 2) < SLOT_MAX)
      opts.push({ target: 'slot' + h, label: `${h === 'L' ? '左' : '右'}手に、ルーンの枠をもう1つ` });
  if ((adv.runState.bodyOpen || 0) < 2) opts.push({ target: 'body', label: '身の護符の枠' });
  sChime(player.x, player.z, 0.5);
  setTimeout(() => sChime(player.x, player.z, 0.4), 220);
  for (let q = 0; q < 30; q++) {
    const a = mr() * 6.28;
    spawn(
      player.x,
      0.6 + mr(),
      player.z,
      Math.cos(a) * 1.2,
      0.4 + mr() * 1.4,
      Math.sin(a) * 1.2,
      0.9,
      G(mpick(['{', '}', '*', '.'])),
      0.16,
      2.4,
      2.1,
      1.4,
      0,
    );
  }
  if (!opts.length) {
    const ru = makeRune(randomRuneType(keyedRand('slot', levelSeed(), cell)));
    msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。開ける枠はもうない。枠は、ひとつのルーンに姿を変えた。');
    takeRune(ru);
    return;
  }
  if (opts.length === 1) {
    applyOpen(nth(opts, 0).target);
    msg(`<b style="color:#ffe3a0">{ }</b>空の枠を手にした。${nth(opts, 0).label}が開いた。`);
    return;
  }
  const grp = 'slotpick' + ++adv.slotPickN;
  opts.forEach((o, k) =>
    level().items.push({
      i: cell,
      kind: 'rune',
      altar: true,
      grp,
      slot: k,
      opt: 'open',
      target: o.target,
      label: o.label,
      rune: { uid: -1, type: 'slotopt' },
      taken: false,
    }),
  );
  adv.runState.slotPend = grp;
  msg('<b style="color:#ffe3a0">{ }</b>空の枠を手にした。どの枠を開けるか、選ぶ。');
}

/** 伝説の物 it を手にした時（音と伝言。3つそろったら、底へ向かう一言） */
export function pickLegend(it: Item): void {
  const L = must(getLegend()),
    k = must(it.legend),
    kd = lookup(LEGEND_KINDS, k),
    c = kd.col;
  L.have.add(k);
  renderStatus();
  sChime(player.x, player.z, 0.6);
  setTimeout(() => sChime(player.x, player.z, 0.5), 250);
  setTimeout(() => sChime(player.x, player.z, 0.4), 500);
  msg(`<b style="color:${css(c)}">${kd.ch}</b><b style="color:${css(c)}">${lookup(L.items, k).name}</b>を手にした。`);
  msg(`<span class="lab">${lookup(L.items, k).lore}</span>`);
  if (L.have.size === 3)
    setTimeout(() => msg(`<b style="color:#ffe9b0">*</b>三つの光が、手の中で同じ方へ震えている。ずっと下の、闇の底へ。`), 1800);
}
