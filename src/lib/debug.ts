// 開発用：F2 の画面と window.dbg（自動の確かめ用）が同じ命令 dbg を使う。F2 の画面 setDbg・renderDbg と、URL の指定 dbgUrl、
// window.dbg に置く initDbg（開発用モードがオフの時は、命令を動かさずにわけの文を返す）。
import { aimOrigin } from './aim.ts';
import { guardedNow, takeRune } from './altars.ts';
import { lookup, must, nth } from './array.ts';
import { damageMonster, gainExp, hurtPlayer } from './combat.ts';
import { makeRune } from './gear.ts';
import { renderHotbar } from './hotbar.ts';
import { buildIntroPanel } from './intro.ts';
import { getLegend } from './legend.ts';
import { interAt, newLevel, showStratum } from './levels.ts';
import { LEGEND_ORDER } from './names.ts';
import { omenOf, stairsGuarded } from './omens.ts';
import { openSlot } from './pickup.ts';
import { clamp } from './rng.ts';
import { RUNE_DEF, RUNE_TYPES } from './runes.ts';
import { saveMeta } from './save.ts';
import { tryLock } from './screens.ts';
import { adv, clock, fight, here, player, saved, TEST, ui } from './state.ts';
import { isPaused, renderStatus } from './status.ts';
import { SPECIALS, STRATA } from './strata.ts';
import { boxText } from './text.ts';
import { loreLeft } from './unlocks.ts';
import { BRANCHES, CELL, cpos, FINAL_DEPTH, LQ_DEEP, MH, MW, REALMS, TF } from './world.ts';

declare global {
  interface Window {
    /** 開発用の命令（initDbg が置く） */
    dbg: unknown;
  }
}
/** 今の階（無ければ止まる） */
const level = () => must(here.D, '今の階 here.D');
/** 特別な階の表を、無い鍵もある表として読む */
const specials: Readonly<Record<string, (typeof SPECIALS)[keyof typeof SPECIALS] | undefined>> = SPECIALS;

function dbgEnter(): void {
  const keepB = here.branch,
    keepR = here.realm,
    keepI = here.inter,
    keepD = here.depth;
  if (!ui.started) {
    ui.startDepth = keepD;
    must(document.getElementById('enter'), '［迷宮に入る］').click();
  }
  here.branch = keepB;
  here.realm = keepR;
  here.inter = keepI;
  here.depth = keepD;
  newLevel();
  if (here.D) showStratum(here.D.stratum);
}
function dbgNear(cell: number | null | undefined): boolean {
  if (cell == null || cell < 0) return false;
  let best = -1,
    bd = 1e9;
  const cx = cell % MW,
    cz = (cell / MW) | 0;
  for (let dz = -3; dz <= 3; dz++)
    for (let dx = -3; dx <= 3; dx++) {
      if (cx + dx < 0 || cx + dx >= MW || cz + dz < 0 || cz + dz >= MH) continue;
      const i = (cz + dz) * MW + cx + dx;
      if (i === cell || level().tile[i] !== TF || level().liquid[i] === LQ_DEEP) continue;
      const d = Math.abs(Math.hypot(dx, dz) - 2);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  if (best < 0) return false;
  const [tx, tz] = cpos(cell),
    [x, z] = cpos(best);
  player.x = x;
  player.z = z;
  player.yaw = Math.atan2(-(tx - x), -(tz - z));
  player.pitch = -0.25;
  return true;
}
/** 開発用の命令（F2 の画面と window.dbg が使う） */
export const dbg = {
  help(): string {
    return (
      'dbg.info() / go(深度) / branch(key,階) / realm(key) / to("stairs"|"branch"|"portal"|"lord"|"altar"|"vault") / god(on) / heal() / reveal() / give("slot"|"body"|"runes"|"legends") / kill("lord"|"near") / open() / step(x,z) / look(x,y,z) / items() / clear()   支道: ' +
      Object.keys(BRANCHES).join(',') +
      '   異界: ' +
      Object.keys(REALMS).join(',')
    );
  },
  info() {
    const o = here.D ? omenOf() : null;
    return {
      seed: adv.runSeed,
      depth: here.depth,
      inter: here.inter ? here.inter.key : null,
      branch: here.branch ? { ...here.branch } : null,
      realm: here.realm ? { ...here.realm } : null,
      stratum: here.D && here.D.stratum ? here.D.stratum.name : '',
      hp: Math.round(player.hp),
      god: ui.godMode,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 支道の階段の時だけ strong がある（無ければ undefined のまま）
      next: o && o.stairs ? o.stairs.kind + ':' + o.stairs.key + ((o.stairs as { strong?: boolean }).strong ? ' (strong)' : '') : null,
      branchDoor: o && o.branch ? o.branch.key : null,
      portal: o && o.portal ? o.portal.key : null,
      lord: here.monsters.some((m) => m.key === 'lord' && !m.dead),
      monsters: here.monsters.filter((m) => !m.dead).length,
      bodyOpen: adv.runState.bodyOpen || 0,
      // oxlint-disable-next-line unicorn/prefer-set-size -- 元の書き方のまま
      altars: [...new Set((level().items || []).filter((o) => o.altar && !o.taken).map((o) => o.grp))].length,
      springs: (level().items || []).filter((o) => o.kind === 'spring' && !o.taken).length,
      startPos: here.D ? cpos(here.D.start).map((v) => +v.toFixed(1)) : null,
      hub: here.D && here.D.hub ? [+(here.D.hub.cx * CELL + 1).toFixed(1), +(here.D.hub.cz * CELL + 1).toFixed(1)] : null,
      hubNear: here.D ? here.D.hubNear : null,
      stairGuard: here.D && here.D.stairGuard !== undefined ? stairsGuarded() : null,
      stairsPos: here.D && here.D.stairs >= 0 ? cpos(here.D.stairs).map((v) => +v.toFixed(1)) : null,
      /* oxlint-disable unicorn/prefer-set-size -- 元の書き方のまま */
      guarded: [
        ...new Set((level().items || []).filter((o) => o.altar && !o.taken && o.guardG !== undefined && guardedNow(o)).map((o) => o.grp)),
      ].length,
      /* oxlint-enable unicorn/prefer-set-size */
      elite: here.monsters.some((m) => m.elite && !m.dead),
      elitePrize: (level().items || []).some((o) => o.elitePrize && !o.taken),
      eliteWhy: level().eliteWhy || null,
      looseRunes: (level().items || []).filter((o) => o.kind === 'rune' && !o.altar && !o.vault && !o.pedestal && !o.taken).length,
      vault: (() => {
        const v = (level().items || []).find((o) => o.vault);
        return v ? { ev: v.ev, taken: v.taken, gateOpen: !!(level().gate && must(level().gate, '鉄格子 gate').open) } : null;
      })(),
    };
  },
  go(d: number) {
    here.branch = null;
    here.realm = null;
    here.inter = null;
    here.depth = clamp(d | 0, 1, FINAL_DEPTH);
    dbgEnter();
    return dbg.info();
  },
  branch(key: string, lvl?: number) {
    const B = BRANCHES[key];
    if (!B) return 'no such branch: ' + Object.keys(BRANCHES).join(',');
    here.realm = null;
    here.inter = null;
    const at = nth(B.at, 0);
    here.branch = { key, lvl: clamp(lvl || 1, 1, B.len), len: B.len, ret: at + 1 };
    here.depth = at;
    dbgEnter();
    return dbg.info();
  },
  inter(key: string) {
    if (!specials[key]) return 'no such place: ' + Object.keys(SPECIALS).join(',');
    const at = must(interAt(key), '特別な階の場所');
    here.branch = null;
    here.realm = null;
    here.depth = at;
    here.inter = { key, after: at };
    dbgEnter();
    return dbg.info();
  },
  realm(key: string) {
    if (!REALMS[key]) return 'no such realm: ' + Object.keys(REALMS).join(',');
    here.branch = null;
    here.inter = null;
    here.realm = { key, ret: here.depth + 1 };
    dbgEnter();
    return dbg.info();
  },
  to(what: string | null) {
    if (!here.D) return false;
    const cell =
      what === 'forge'
        ? ((here.D.items || []).find((o) => o.forge && !o.taken) || { i: -1 }).i
        : what === 'hub'
          ? here.D.hub
            ? Math.round(here.D.hub.cz) * MW + Math.round(here.D.hub.cx)
            : -1
          : what === 'spring'
            ? ((here.D.items || []).find((o) => o.kind === 'spring' && !o.taken) || { i: -1 }).i
            : what === 'altar'
              ? ((here.D.items || []).find((o) => o.altar && !o.taken) || { i: -1 }).i
              : what === 'elite'
                ? ((here.D.items || []).find((o) => o.elitePrize && !o.taken) || { i: -1 }).i
                : what === 'vault'
                  ? here.D.gate
                    ? here.D.gate.cell
                    : -1
                  : what === 'stairs'
                    ? here.D.stairs
                    : what === 'branch'
                      ? here.D.bstairs && here.D.bstairs.cell
                      : what === 'portal'
                        ? here.D.portal && here.D.portal.cell
                        : what === 'lord'
                          ? (() => {
                              const m = here.monsters.find((m) => (m.key === 'lord' || m.key === 'final') && !m.dead);
                              return m ? m.cz * MW + m.cx : -1;
                            })()
                          : -1;
    return dbgNear(cell);
  },
  god(on?: boolean) {
    ui.godMode = on === undefined ? !ui.godMode : !!on;
    return ui.godMode;
  },
  heal() {
    player.hp = adv.PLAYER_MAX;
    return player.hp;
  },
  reveal() {
    here.explored.fill(1);
    return true;
  },
  give(what: string) {
    if (what === 'slot') openSlot(((player.z / CELL) | 0) * MW + ((player.x / CELL) | 0));
    else if (what === 'body') {
      for (const t of RUNE_TYPES.body) takeRune(makeRune(t));
    } else if (what === 'runes') {
      for (const t of Object.keys(RUNE_DEF))
        if (
          lookup(RUNE_DEF, t).cat !== 'sub' &&
          lookup(RUNE_DEF, t).cat !== 'open' &&
          (lookup(RUNE_DEF, t).cat !== 'mod' || RUNE_TYPES.mod.includes(t))
        )
          takeRune(makeRune(t));
    } else if (what === 'legends') {
      const L = getLegend();
      if (L) {
        for (const k of LEGEND_ORDER) L.have.add(k);
        renderStatus();
      }
    } else return 'give: slot / body / runes / legends';
    renderHotbar();
    return true;
  },
  kill(what?: string) {
    if (what === 'guards') {
      const gs = new Set(
        (level().items || [])
          .filter((o) => !o.taken && o.guardG !== undefined && Math.hypot(cpos(o.i)[0] - player.x, cpos(o.i)[1] - player.z) < 18)
          .map((o) => o.guardG),
      );
      let n = 0;
      for (const m of here.monsters)
        if (!m.dead && gs.has(m.g)) {
          damageMonster(m, 99999, 'debug');
          n++;
        }
      return n;
    }
    const m =
      what === 'lord'
        ? here.monsters.find((m) => (m.key === 'lord' || m.key === 'final') && !m.dead)
        : here.monsters
            .filter((m) => !m.dead)
            .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    if (!m) return false;
    damageMonster(m, 99999, 'debug');
    return true;
  },
  open() {
    if (!here.D || !here.D.gate) return false;
    here.D.gate.open = true;
    return true;
  },
  step(x: number, z: number) {
    player.x = x;
    player.z = z;
    return [x, z];
  },
  lore(n?: number) {
    saved.META.lore = (saved.META.lore || 0) + (n || 50);
    saveMeta();
    return loreLeft();
  },
  exp(n?: number) {
    gainExp(n || 20);
    return { lvl: adv.lvl.n, exp: adv.lvl.exp, pending: adv.lvl.pending };
  },
  hurt(n?: number) {
    const g = ui.godMode;
    ui.godMode = false;
    hurtPlayer(n || 5, 'debug');
    ui.godMode = g;
    return { hp: +player.hp.toFixed(1), rally: +(player.rally || 0).toFixed(1) };
  },
  hit(n?: number) {
    const m = here.monsters
      .filter((m) => !m.dead && !m.ty.critter && !m.ty.peaceful)
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    if (!m) return false;
    m.playerT = clock.time;
    damageMonster(m, n || 4, 'magic');
    return { target: m.ty.name, dead: m.dead };
  },
  hp() {
    return { hp: +player.hp.toFixed(1), rally: +(player.rally || 0).toFixed(1), motes: fight.rallyMotes.length };
  },
  look(x: number, y: number, z: number) {
    const [ox, oy, oz] = aimOrigin();
    player.yaw = Math.atan2(-(x - ox), -(z - oz));
    player.pitch = Math.atan2(y - oy, Math.hypot(x - ox, z - oz));
    return [player.yaw, player.pitch];
  },
  items() {
    return (level().items || [])
      .filter((o) => !o.taken)
      .map((o) => ({
        kind: o.kind,
        opt: o.opt || null,
        altar: !!o.altar,
        vault: !!o.vault,
        lord: !!o.lord,
        type: o.rune ? o.rune.type : null,
        pos: cpos(o.i).map((v) => +v.toFixed(2)),
        slot: o.slot,
      }));
  },
  clear() {
    const n0 = here.monsters.length;
    here.monsters = here.monsters.filter(
      (m) => m.ty.boss || m.key === 'lord' || m.key === 'final' || m.ty.critter || Math.hypot(m.x - player.x, m.z - player.z) > 25,
    );
    return n0 - here.monsters.length;
  },
};
/** window.dbg に置く（開発用モードがオフの時は、命令を動かさずにわけの文を返す） */
export function initDbg(): void {
  window.dbg = new Proxy(dbg, {
    get(o, k) {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- 命令の名前で引く（無い名前なら undefined のまま返す）
      const v = (o as Record<string | symbol, unknown>)[k];
      if (typeof v !== 'function') return v;
      return (...a: unknown[]) =>
        saved.DEVALL ? v(...a) : '開発用モードがオフです（URL に ?dev=1 を付けるか、タイトルの［開発用モード］でオンにしてください）';
    },
  });
}
// the F2 screen
export function setDbg(on: boolean): void {
  if (on === ui.dbgOpen) return;
  if (on && (!saved.DEVALL || !ui.started || adv.dead)) return;
  ui.dbgOpen = on;
  document.body.classList.toggle('paused', isPaused());
  const el = document.getElementById('dbgp');
  if (!el) return;
  el.classList.toggle('show', on);
  if (on) {
    renderDbg();
    if (document.pointerLockElement) document.exitPointerLock();
  } else tryLock();
}
function renderDbg(): void {
  const el = document.getElementById('dbgp');
  if (!el) return;
  const f = (t: string) => `<span class="f">${t}</span>`,
    I = dbg.info(),
    B = (c: string, t: string | number) => `<button class="row" data-c="${c}">[${t}]</button>`;
  const where = I.realm
    ? `異界：${lookup(REALMS, I.realm.key).name}`
    : I.branch
      ? `支道：${lookup(BRANCHES, I.branch.key).name} ${I.branch.lvl}/${I.branch.len}階`
      : `深度 ${I.depth}`;
  const nx = I.next
    ? (() => {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- next は info が作る「種類:鍵」の形
        const [k, v] = I.next.split(':') as [string, string];
        const key = v.replace(' (strong)', '');
        return k === 'stratum'
          ? // oxlint-disable-next-line typescript/consistent-type-assertions -- 無い層なら名前も無い（元の読み方のまま）
            ((STRATA.find((s) => s.k === key) || {}) as { name?: string }).name
          : k === 'special'
            ? lookup(SPECIALS, key).name
            : lookup(BRANCHES, key).name + (v.includes('strong') ? '（主の階へ）' : '');
      })()
    : '変わらない';
  const rows = [
    f('+-- デバッグ ---'),
    `${f('|')} 今　${where}　${I.stratum}　シード ${I.seed}　体力 ${I.hp}/${adv.PLAYER_MAX}`,
    `${f('|')} 先　下り階段の先：${nx}　支道の入口：${I.branchDoor ? lookup(BRANCHES, I.branchDoor).name : 'なし'}　門：${I.portal ? lookup(REALMS, I.portal).name : 'なし'}`,
    `${f('|')} 　　祭壇：${I.altars}　宝物庫：${I.vault ? (I.vault.ev === 'guard' ? '番人' : '崩落') + (I.vault.taken ? '（取った）' : '') : 'なし'}`,
    f('|'),
    `${f('|')} 深度　` + Array.from({ length: FINAL_DEPTH }, (_, i) => B('go:' + (i + 1), i + 1)).join(''),
    ...Object.keys(BRANCHES).map(
      (k) =>
        `${f('|')} 支道　${lookup(BRANCHES, k).name}　` +
        Array.from({ length: lookup(BRANCHES, k).len }, (_, i) => B(`br:${k}:${i + 1}`, i + 1 + '階')).join(''),
    ),
    `${f('|')} 異界　` +
      Object.keys(REALMS)
        .map((k) => B('re:' + k, lookup(REALMS, k).name))
        .join(' '),
    f('|'),
    `${f('|')} 跳ぶ　${B('to:stairs', '下り階段')} ${B('to:branch', '支道の入口')} ${B('to:portal', '異界の門')} ${B('to:lord', '主')} ${B('to:altar', '祭壇')} ${B('to:vault', '宝物庫')}`,
    `${f('|')} 体　　${B('god', '無敵：' + (ui.godMode ? 'オン' : 'オフ'))} ${B('heal', '全快')}　　見る　${B('reveal', '地図を明かす')}`,
    `${f('|')} 得る　${B('give:slot', '空の枠')} ${B('give:body', '補助のルーン全種')} ${B('give:runes', 'すべてのルーン')} ${B('give:legends', '伝説の三つ')}`,
    `${f('|')} 敵　　${B('clear', '周りの敵を消す')} ${B('kill:lord', '主を倒す')}　　仕掛け　${B('open', '鉄格子を開ける')}`,
    f('|'),
    `${f('|')} <span class="lab">F2 か Esc で閉じる。同じことは、コンソールの dbg.help() からもできる</span>`,
    f('+---'),
  ];
  el.innerHTML = boxText(rows);
  for (const b of el.querySelectorAll<HTMLElement>('button[data-c]'))
    b.onclick = () => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- ボタンの data-c は、上で「命令:引数:引数」の形で書いた（無い所は undefined のまま）
      const [c, a, b2] = must(b.dataset['c'], 'ボタンの命令').split(':') as [string, string, string];
      if (c === 'go') dbg.go(+a);
      else if (c === 'br') dbg.branch(a, +b2);
      else if (c === 're') dbg.realm(a);
      else if (c === 'to') dbg.to(a);
      else if (c === 'god') dbg.god();
      else if (c === 'heal') dbg.heal();
      else if (c === 'reveal') dbg.reveal();
      else if (c === 'give') dbg.give(a);
      else if (c === 'clear') dbg.clear();
      else if (c === 'kill') dbg.kill(a);
      else if (c === 'open') dbg.open();
      if (['go', 'br', 're', 'to'].includes(c)) setDbg(false);
      else renderDbg();
    };
}
// URL options: ?dev=1&seed=123&depth=8 | branch=crypt:2 | realm=ice &to=stairs &god=1 &reveal=1 &give=slot,body
export function dbgUrl(): void {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(location.search);
  } catch (e) {
    return;
  }
  if (q.get('dev') === '1' || TEST) {
    saved.DEVALL = true;
    try {
      localStorage.setItem('al_dev', '1');
    } catch (e) {}
    buildIntroPanel();
  }
  if (!saved.DEVALL) return;
  const sd = q.get('seed');
  if (sd && /^[0-9]{1,10}$/.test(sd)) {
    adv.runSeed = Number(sd) >>> 0;
    // oxlint-disable-next-line typescript/consistent-type-assertions -- シードの欄は buildIntroPanel が <input> で作る
    const si = document.getElementById('seedIn') as HTMLInputElement | null;
    if (si) si.value = sd;
  }
  const dp = q.get('depth'),
    br = q.get('branch'),
    re = q.get('realm');
  if (!dp && !br && !re && !q.get('to')) return;
  if (br) {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- 「支道:階」の形（階が無ければ undefined のまま）
    const [k, l] = br.split(':') as [string, string];
    dbg.branch(k, +l || 1);
  } else if (re) {
    if (dp) here.depth = +dp;
    dbg.realm(re);
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- 深さが無ければ null のまま（+null は 0 で、1 になる）
  else dbg.go(+(dp as string) || 1);
  if (q.get('god') === '1') dbg.god(true);
  if (q.get('reveal') === '1') dbg.reveal();
  for (const g of (q.get('give') || '').split(',').filter(Boolean)) dbg.give(g);
  if (q.get('to')) dbg.to(q.get('to'));
}
