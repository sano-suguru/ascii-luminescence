// 見た時の説明（もとは src/game/29-look.js の look）：目（カメラ）から見ている向きに、生き物・備品・扉・巣・罠・床の物・鉄格子を球で当て、
// その手前の壁・床・天井・柱・飾り・結晶・裂け目・ガスを進んで調べ、一番近い物の説明を、0.5秒見続けたら画面に出す。照準の先の生き物（ui.aimMon）も入れる。
// 状態の入れ物 ui（説明の状態と出す所 lookEl、照準の先の生き物）・gfx（カメラの位置。読むだけ）・here（今の階）・player・blaze（火と灰）・adv（年代記）・clock に頼る。
// 呼ぶのは古い JS のメインループ（30-loop-init.js の tick）。
import { lookup, must, nth } from './array.ts';
import { guardedNow } from './altars.ts';
import type { Door, Fixture, Item, Trap } from './generate.ts';
import { ceilAt } from './lightmap.ts';
import { DECO_K, DECO_NAMES, FIX_NAMES, TRAP_INFO, lookLine } from './names.ts';
import { BRANCH_OMEN, REALM_OMEN, SPECIAL_OMEN, STRATUM_OMEN, omenOf, stairsGuarded } from './omens.ts';
import type { Grave } from './progress.ts';
import { RUNE_DEF, runeCol, thingLabel, trList, trName } from './runes.ts';
import { type Monster, adv, blaze, clock, gfx, here, player, ui } from './state.ts';
import {
  BRANCHES,
  CELL,
  D4,
  LQ_BOG,
  LQ_DEEP,
  LQ_LAVA,
  LQ_WATER,
  MH,
  MW,
  NCELL,
  REALMS,
  SF_BRIM,
  SF_DEAD,
  SF_FOLIAGE,
  SF_FUNGFOR,
  SF_GRASS,
  SF_HAY,
  SF_ICE,
  SF_LUMEN,
  SF_MUD,
  SF_OBSIDIAN,
  SF_RUBBLE,
  TC,
  TP,
  TW,
  TX,
  VEIN_COL,
  VEIN_NAME,
  cpos,
} from './world.ts';

/** 今の階 */
const level = () => must(here.D, '今の階 here.D');
/** 見ている物（k が種類。壁などはマス i、壁は手前のマス prev も） */
type Hit = (
  | { k: 'ph' | 'web' | 'gate' | 'lever' | 'gas' }
  | { k: 'm'; m: Monster }
  | { k: 'f'; f: Fixture }
  | { k: 'd' | 'dg'; d: Door }
  | { k: 'trap'; tr: Trap }
  | { k: 'item'; it: Item }
  | { k: 'wall'; i: number; prev: number }
  | { k: 'xtal' | 'pillar' | 'deco' | 'floor' | 'chasm' | 'ceil'; i: number }
) & { i?: number };
/** まだ何も見ていない（型を Hit | null にするため。球に当てる処理の中で入れ替わる） */
const noHit = (): Hit | null => null;

/** 見た時の説明：見ている物を調べ、0.5秒見続けたら説明を出す（探索が始まる前と、階を移る途中は消す） */
export function look(): void {
  ui.aimMon = null;
  if (!ui.started || here.trans) {
    if (ui.lookHTML) {
      ui.lookHTML = '';
      must(ui.lookEl, '見た時の説明を出す所 lookEl').innerHTML = '';
    }
    return;
  }
  const cp = Math.cos(player.pitch),
    dx = -Math.sin(player.yaw) * cp,
    dy = Math.sin(player.pitch),
    dz = -Math.cos(player.yaw) * cp;
  const ox = gfx.camera.position.x,
    oy = gfx.camera.position.y,
    oz = gfx.camera.position.z;
  let best = noHit(),
    bt = 18;
  const sph = (cx: number, cy: number, cz: number, r: number, res: Hit) => {
    const lx = cx - ox,
      ly = cy - oy,
      lz = cz - oz,
      tc = lx * dx + ly * dy + lz * dz;
    if (tc < 0) return;
    const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
    if (d2 > r * r) return;
    const tt = tc - Math.sqrt(r * r - d2);
    if (tt < bt) {
      bt = tt;
      best = res;
    }
  };
  for (const m of here.monsters) {
    const s = m.ty.scale,
      near = Math.hypot(m.x - ox, m.z - oz) < 6;
    if (m.ty.invisible) {
      if (near) sph(m.x, (m.y ?? NaN) + 1.1, m.z, 0.6, { k: 'ph' });
      continue;
    }
    if (!m.visible) continue;
    // 飛ぶ物（吸血コウモリ）は、体の真ん中（m.y）を中心に、攻撃が当たる球（aim.ts の aimPoint）と同じ大きさにする（広げた翼の先まで、当たる所なら説明も出る）
    if (m.ty.flier) sph(m.x, must(m.y, '足もとの高さ y'), m.z, 0.42 + 0.35 * s, { k: 'm', m });
    else sph(m.x, must(m.y, '足もとの高さ y') + (m.ty.fl || m.ty.form === 'eel' ? 0.3 : 0.9 * s), m.z, 0.6 * s, { k: 'm', m });
  }
  for (const f of here.fixtures) {
    if (!FIX_NAMES[f.type] && f.type !== 'bstairs' && f.type !== 'portal') continue;
    const L = level().lights[f.li];
    if (f.type === 'torch') {
      sph((f.wx ?? NaN) + (f.nx ?? NaN) * 0.15, 2.0, (f.wz ?? NaN) + (f.nz ?? NaN) * 0.15, 0.35, { k: 'f', f });
      continue;
    }
    const fy =
      f.type === 'fall'
        ? (ceilAt(f.x, f.z) ?? NaN) * 0.5
        : f.type === 'crater'
          ? 0.2
          : f.type === 'spring'
            ? 1.3
            : f.type === 'orb'
              ? 1.4
              : f.type === 'well'
                ? 1.6
                : f.type === 'firefly'
                  ? 1.5
                  : f.type === 'sun'
                    ? 1.6
                    : f.type === 'bloodwort'
                      ? 0.9
                      : f.type === 'vent'
                        ? 0.2
                        : f.type === 'brazier'
                          ? 0.9
                          : f.type === 'stairs'
                            ? 1.3
                            : f.type === 'rune'
                              ? 0.3
                              : f.type === 'fungus'
                                ? 0.3
                                : L
                                  ? L.y
                                  : 1.2;
    sph(f.x, fy, f.z, f.type === 'stairs' ? 0.9 : f.type === 'rune' ? 1.2 : f.type === 'abyss' ? 1.0 : 0.5, { k: 'f', f });
  }
  for (const d of level().doors) {
    if (d.gone) sph(d.bx, 0.4, d.bz, 0.8, { k: 'dg', d });
    else if (d.o < 0.5) sph(d.bx, 1.4, d.bz, 1.0, { k: 'd', d });
  }
  for (const w of level().webs || []) {
    if (w.gone) continue;
    const [wx, wz] = cpos(w.i);
    sph(wx, 1.3, wz, 0.75, { k: 'web' });
  }
  for (const tr of level().traps || []) {
    if (tr.hidden) continue;
    const [tx3, tz3] = cpos(tr.i);
    sph(tx3, 0.15, tz3, 0.5, { k: 'trap', tr });
  }
  for (const it of level().items || []) {
    if (it.taken) continue;
    const [ix3, iz3] = cpos(it.i);
    sph(ix3, 0.55, iz3, 0.4, { k: 'item', it });
  }
  if (level().gate) {
    const [gx, gz] = cpos(must(level().gate, '鉄格子 gate').cell);
    if (must(level().gate, '鉄格子 gate').o < 0.7) sph(gx, 1.4, gz, 0.95, { k: 'gate' });
    const [lx, lz] = cpos(must(level().gate, '鉄格子 gate').lever);
    sph(lx + must(level().gate, '鉄格子 gate').ld[0] * 0.9, 1.35, lz + must(level().gate, '鉄格子 gate').ld[1] * 0.9, 0.35, { k: 'lever' });
  }
  let gasSeen = false;
  let prevI = -1;
  for (let t = 0.1; t < bt; t += 0.08) {
    const x = ox + dx * t,
      y = oy + dy * t,
      z = oz + dz * t,
      cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= MW || cz >= MH) break;
    const i = cz * MW + cx,
      tt = level().tile[i],
      ccx = (cx + 0.5) * CELL,
      ccz = (cz + 0.5) * CELL,
      pv = prevI;
    if (tt !== TW) prevI = i;
    if (t < 8 && y < 2 && (level().gas[i] ?? NaN) > 0.25) gasSeen = true;
    if (tt === TW) {
      best = { k: 'wall', i, prev: pv };
      break;
    }
    if (tt === TX && y < 3.6) {
      best = { k: 'xtal', i };
      break;
    }
    if (tt === TP && Math.hypot(x - ccx, z - ccz) < 0.5) {
      best = { k: 'pillar', i };
      break;
    }
    const sr = level().solid.get(i);
    if (sr && y < 2.3 && Math.hypot(x - ccx, z - ccz) < sr) {
      best = { k: 'deco', i };
      break;
    }
    if (tt === TC) {
      if (level().pit && must(level().pit, '崩れた穴 pit')[i]) {
        if (y < 0.06) {
          best = { k: 'floor', i };
          break;
        }
      } else if (y < -1) {
        best = { k: 'chasm', i };
        break;
      }
    } else if (y < 0.06) {
      best = { k: 'floor', i };
      break;
    }
    if (y > (level().ceil[i] ?? NaN)) {
      best = { k: 'ceil', i };
      break;
    }
  }
  if (gasSeen && (!best || best.k === 'floor' || best.k === 'wall' || best.k === 'ceil')) best = { k: 'gas' };
  let h = '';
  if (best) {
    const i = best.i,
      ri = i !== undefined ? nth(level().roomOf, i) : -1,
      cave = ri >= 0 && nth(level().rooms, ri).cave;
    if (best.k === 'm') ui.aimMon = best.m;
    switch (best.k) {
      case 'item': {
        if (best.it.forge) {
          h = lookLine('T', [0.7, 0.85, 1.0], '鍛えの祭壇', '今持っている武器を、ひとつ鍛えられる（特性を上げる、または足す）');
          break;
        }
        if (best.it.kind === 'grave') {
          const g: Partial<Grave> = best.it.g || {};
          h = lookLine(
            '+',
            [0.78, 0.78, 0.9],
            '先人の墓',
            `深度${g.depth}で、${g.cause || '何か'}に倒れた。${thingLabel(must(best.it.rune, '墓のルーン'))}が眠っている`,
          );
          break;
        }
        if (best.it.kind === 'spring') {
          h = lookLine('~', [0.5, 0.9, 1], '癒しの泉', best.it.taken ? 'もう光は残っていない' : '触れると、傷がすっかり癒える。一度だけ');
          break;
        }
        if (best.it.guardG !== undefined && guardedNow(best.it)) {
          h = best.it.elitePrize
            ? lookLine('*', [1, 0.5, 0.35], '守られた宝', '強いものが守っている。番人を倒せば、手に取れる')
            : lookLine('_', [0.6, 0.55, 0.65], '眠っている祭壇', '光はまだ眠っている。この部屋に巣くうものを退ければ、灯るだろう');
          break;
        }
        const ru = best.it.rune;
        if (!ru) break;
        if (best.it.opt === 'open') {
          h = lookLine('{', [1, 0.9, 0.6], best.it.label, '空の枠が開けられる所。祭壇と同じく、選んで決める');
          break;
        }
        if (best.it.opt === 'heal') {
          h = lookLine('+', [1, 0.55, 0.6], '癒しの光', '傷が大きく癒える。祭壇の前で、数字キーで選ぶ');
          break;
        }
        if (best.it.vault) {
          const d = lookup(RUNE_DEF, ru.type),
            trs = trList(ru);
          h = lookLine(
            d.ch,
            runeCol(ru),
            thingLabel(ru) + '（宝物庫の宝）',
            d.desc +
              (trs.length ? '。特性：' + trs.map((t) => `${trName(ru.type, t)} Lv${t.lv}`).join('・') : '') +
              '。' +
              (best.it.ev === 'guard' ? '周りの石像が、こちらを見ている気がする' : '頭上の天井に、深いひびが走っている'),
          );
          break;
        }
        const d = lookup(RUNE_DEF, ru.type),
          trs = trList(ru);
        h = lookLine(
          d.ch,
          runeCol(ru),
          thingLabel(ru),
          d.desc +
            (trs.length ? '。特性：' + trs.map((t) => `${trName(ru.type, t)} Lv${t.lv}`).join('・') : '') +
            (best.it.grp ? '。ひとつ手に取ると、残りは消える' : ''),
        );
        break;
      }
      case 'trap': {
        const inf = lookup(TRAP_INFO, best.tr.type),
          c = inf[1];
        h = lookLine(
          '^',
          [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255],
          `${inf[0]}罠${best.tr.used ? '（作動済み）' : ''}`,
          inf[2],
        );
        break;
      }
      case 'gate': {
        const pr = (level().items || []).find((o) => o.vault && !o.taken);
        h = lookLine(
          '#',
          [0.75, 0.72, 0.8],
          '鉄格子',
          '固く閉ざされている。どこかに開ける仕掛けがあるはずだ' +
            (pr ? (pr.ev === 'guard' ? '。奥で、石像の目がかすかに光っている' : '。奥の天井に、大きなひびが走っている') : ''),
        );
        break;
      }
      case 'lever':
        h = lookLine(
          '/',
          [1.0, 0.85, 0.5],
          '壁のレバー',
          must(level().gate, '鉄格子 gate').open ? 'もう引かれている' : '古いレバー。触れれば、引けそうだ',
        );
        break;
      case 'web':
        h = lookLine('%', [0.85, 0.8, 1.0], 'クモの巣', '光る糸が張りめぐらされている。触れると、巣の主に伝わる');
        break;
      case 'ph':
        h = lookLine('?', [0.7, 0.8, 1.0], '空気の揺らぎ', '人の形をした何かが、見えないままそこにいる');
        break;
      case 'm': {
        const m = best.m;
        if (m.hidden) {
          h = lookLine('?', [1.0, 0.82, 0.42], '浮遊する巻物', 'ゆっくりと宙に浮かんでいる……よく見ると、わずかに震えている');
          break;
        }
        if (m.ty.critter) {
          h = lookLine(m.ty.ch, m.ty.col, `${m.ty.name}（${m.ty.ch}）`, (m.flee ?? NaN) > 0 ? '驚いて逃げている' : m.ty.verb);
          break;
        }
        if ((m.hp ?? NaN) < (m.maxHp ?? NaN) && !m.ty.critter) {
          const st2 = m.sleep ? '眠っている' : m.noticed ? 'こちらに気づいている' : 'こちらに気づいていない';
          h = lookLine(m.ty.ch, m.ty.col, `${m.ty.name}（${m.ty.ch}）`, `${st2}　体力 ${Math.max(0, Math.ceil(m.hp ?? NaN))}/${m.maxHp}`);
          break;
        }
        if (m.ty.beast) {
          h = lookLine('X', m.ty.col, m.ty.name, m.sleep ? `眠っている。${m.ty.lore}` : `こちらを見ている。${m.ty.lore}`);
          break;
        }
        const st = m.ty.peaceful
          ? '穏やかにこちらを見ている'
          : m.sleep
            ? '眠っている'
            : m.noticed
              ? 'こちらに気づいている'
              : (m.aware ?? NaN) > 0.35
                ? '辺りを警戒している'
                : 'こちらに気づいていない';
        h = lookLine(m.ty.ch, m.ty.col, `${m.ty.name}（${m.ty.ch}）`, `${st}`);
        break;
      }
      case 'f': {
        if (
          best.f.type === 'relic' &&
          level().gate &&
          must(level().gate, '鉄格子 gate').heir &&
          Math.hypot(best.f.x - player.x, best.f.z - player.z) < 30
        ) {
          const rr = nth(level().roomOf, Math.floor(best.f.z / CELL) * MW + Math.floor(best.f.x / CELL));
          if (
            rr >= 0 &&
            nth(level().rooms, rr).kindMsg &&
            must(nth(level().rooms, rr).kindMsg, '部屋の伝言 kindMsg').includes('鉄格子の奥')
          ) {
            h = lookLine(
              '_',
              best.f.col,
              must(level().gate, '鉄格子 gate').heir,
              '台座の上で、静かに光っている。年代記に記された王のものだ',
            );
            break;
          }
        }
        if (best.f.type === 'bstairs') {
          h = lookLine(
            '>',
            best.f.col,
            `${lookup(BRANCHES, must(level().bstairs, '支道の階段 bstairs').key).name}への階段`,
            '本道を外れて、脇道へと続く下り階段。' + lookup(BRANCH_OMEN, must(level().bstairs, '支道の階段 bstairs').key).look,
          );
          break;
        }
        if (best.f.type === 'portal') {
          h = lookLine(
            '0',
            best.f.col,
            '揺らめく門',
            `門の向こうに、${lookup(REALMS, must(level().portal, '異界の門 portal').key).name}が揺らいで見える。` +
              lookup(REALM_OMEN, must(level().portal, '異界の門 portal').key).look,
          );
          break;
        }
        if (best.f.type === 'stairs' && stairsGuarded()) {
          h = lookLine(
            '>',
            [1, 0.55, 0.6],
            '封じられた下り階段',
            '見えない封が下りを阻んでいる。控えの間に潜むものを退ければ、解けるだろう',
          );
          break;
        }
        if (best.f.type === 'stairs') {
          const o = omenOf(),
            st = o && o.stairs;
          if (st) {
            const look =
              st.kind === 'branch'
                ? (st.strong ? '奥から、主の気配が濃く漂ってくる。' : '') + lookup(BRANCH_OMEN, st.key).look
                : st.kind === 'special'
                  ? lookup(SPECIAL_OMEN, st.key).look
                  : lookup(STRATUM_OMEN, st.key).look;
            h = lookLine('>', best.f.col, '下り階段', look);
            break;
          }
        }
        const n = lookup(FIX_NAMES, best.f.type);
        h = lookLine(n[0], best.f.col, n[1], n[2]);
        break;
      }
      case 'd':
        h = lookLine('+', [0.95, 0.66, 0.38], '木の扉', '閉ざされている。近づけば開く');
        break;
      case 'dg':
        h = lookLine(':', [0.45, 0.38, 0.34], '焼け落ちた扉の跡', '黒く焦げた枠だけが残っている');
        break;
      case 'wall': {
        if (best.prev >= 0) {
          const ddx = ((i ?? NaN) % MW) - (best.prev % MW),
            ddz = (((i ?? NaN) / MW) | 0) - ((best.prev / MW) | 0),
            fi = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].findIndex((d) => d[0] === ddx && d[1] === ddz),
            eg = fi >= 0 && level().engr.get(best.prev * 4 + fi);
          const eg2 = eg && eg.skip ? level().engr.get(eg.mi * 4 + fi) : eg;
          if (eg2) {
            h = lookLine('#', [1.0, 0.86, 0.6], '壁の彫刻', eg2.text);
            break;
          }
        }
        const fx = level().fixCell.get(must(i, 'マス i'));
        if (fx) {
          h = lookLine('#', [1.0, 0.72, 0.32], '壁掛け松明', '壁に据えられた松明が、琥珀色の光を投げかけている');
          break;
        }
        const nearCave =
          D4.some((d) => {
            const j = must(i, 'マス i') + d[0] + d[1] * MW;
            const r2 = j >= 0 && j < NCELL ? nth(level().roomOf, j) : -1;
            return r2 >= 0 && nth(level().rooms, r2).cave;
          }) || cave;
        const ve = level().vein[must(i, 'マス i')];
        if (ve) {
          h = lookLine(
            ve === 1 ? '$' : '*',
            VEIN_COL[ve],
            `${VEIN_NAME[ve]}の鉱脈`,
            `${must(level().rock, '岩 rock').name}の中を${VEIN_NAME[ve]}の鉱脈が走り、光を受けてきらめいている`,
          );
          break;
        }
        h = nearCave
          ? lookLine('%', [0.75, 0.7, 0.9], `${must(level().rock, '岩 rock').name}の岩肌`, '光の届くところだけ、岩の筋が濃く浮かび上がる')
          : lookLine('#', [0.72, 0.7, 1.0], `${must(level().rock, '岩 rock').name}の石壁`, '無数の紋様が刻み込まれた壁');
        break;
      }
      case 'gas':
        h = lookLine('~', [0.6, 0.9, 0.3], '沼のガス', '鼻をつく臭気が低く漂っている。火気は禁物だ');
        break;
      case 'xtal': {
        const xc = level().xtalCol.get(must(i, 'マス i')) || [0.6, 0.85, 1.0];
        h = lookLine('#', xc, '結晶', '透き通った結晶が、内側から淡い光を放っている');
        break;
      }
      case 'pillar':
        h = lookLine('0', [0.8, 0.78, 1.0], '石柱', '縦に連なる石が天井を支えている');
        break;
      case 'deco': {
        const dc = level().decoCell.get(must(i, 'マス i'));
        if (dc && dc.ch === '+') {
          if (must(i, 'マス i') % 3 === 0) {
            const ru = nth(must(adv.HIST, '年代記 HIST').rulers, must(i, 'マス i') % must(adv.HIST, '年代記 HIST').rulers.length);
            h = lookLine('+', dc.col, `${ru.title}${ru.name}の墓`, 'R.I.P. の下に、王の名が刻まれている');
          } else h = lookLine('+', dc.col, `${must(adv.HIST, '年代記 HIST').civ.name}の民の墓`, '名前は風化して、もう読めない');
          break;
        }
        if (dc && dc.k === 'colossus') {
          const ru = nth(must(adv.HIST, '年代記 HIST').rulers, must(i, 'マス i') % must(adv.HIST, '年代記 HIST').rulers.length);
          h = lookLine('&', dc.col, `${ru.title}${ru.name}の巨像`, 'その眼だけが、まだ光を宿している');
          break;
        }
        const n = dc && ((dc.k && DECO_K[dc.k]) || DECO_NAMES[dc.ch]);
        if (n) h = lookLine(n[0], must(dc, '飾り dc').col, n[1], n[2]);
        else h = lookLine('_', [1.0, 0.82, 0.42], '祭壇', '石を積み上げた祭壇');
        break;
      }
      case 'chasm':
        h = lookLine(':', [0.6, 0.4, 1.0], '裂け目', '底知れぬ闇。遥か下で燃える火が見える');
        break;
      case 'ceil':
        h = cave
          ? lookLine('*', [0.7, 0.65, 1.0], '岩の天蓋', '遥か頭上で、星のような光が瞬いている')
          : lookLine('*', [0.7, 0.65, 1.0], '天井', 'まばらな光が、星のように瞬いている');
        break;
      case 'floor': {
        const lq = level().liquid[must(i, 'マス i')],
          sf = level().surface[must(i, 'マス i')],
          dc = level().decoCell.get(must(i, 'マス i'));
        if ((blaze.fire[must(i, 'マス i')] ?? NaN) > 0.05)
          h = lookLine('^', [1.0, 0.55, 0.2], '炎', '燃え移った炎が、隣の草へと広がっていく');
        else if (level().pit && must(level().pit, '崩れた穴 pit')[must(i, 'マス i')])
          h = lookLine(':', [1.0, 0.55, 0.3], '崩落した穴', '遥か下に、次の階層の光が見える。飛び込めば落ちていける');
        else if (blaze.burnt[must(i, 'マス i')] && !level().liquid[must(i, 'マス i')])
          h = lookLine(',', [0.6, 0.55, 0.55], '灰', '燃え尽きた草の名残');
        else if (level().bridge[must(i, 'マス i')] === 1)
          h = lookLine('=', [0.75, 0.55, 0.35], '吊り橋', '板の隙間から、足元の深淵が覗いている');
        else if (level().bridge[must(i, 'マス i')] === 2) h = lookLine('=', [0.7, 0.7, 0.85], '石橋', '深い水の上に架けられた、古い石の道');
        else if (lq === LQ_DEEP)
          h =
            level().algae && level().algae[must(i, 'マス i')]
              ? lookLine('~', [0.3, 1.0, 0.65], '光る藻', '深い水の中で、藻がゆっくりと明滅している')
              : lookLine('~', [0.2, 0.35, 0.9], '深い水', '暗い水底は見通せない。何かが潜んでいるかもしれない');
        else if (lq === LQ_BOG) h = lookLine('~', [0.55, 0.6, 0.25], '沼', '泥の泡がはじけ、ガスが立ち昇っている');
        else if (lq === LQ_LAVA) h = lookLine('~', [1.0, 0.45, 0.12], '溶岩', '灼熱の岩がゆっくりと流れ、空気が揺らいでいる');
        else if (lq === LQ_WATER) h = lookLine('~', [0.35, 0.68, 1.0], '浅い水', '波紋が静かに揺れている');
        else if (dc && dc.k && DECO_K[dc.k])
          h = lookLine(lookup(DECO_K, dc.k)[0], dc.col, lookup(DECO_K, dc.k)[1], lookup(DECO_K, dc.k)[2]);
        else if ((level().darkMul[must(i, 'マス i')] ?? NaN) < 0.4)
          h = lookLine('.', [0.4, 0.4, 0.55], '暗がり', '光を呑み込むような、不自然な闇');
        else if (dc && DECO_NAMES[dc.ch])
          h = lookLine(lookup(DECO_NAMES, dc.ch)[0], dc.col, lookup(DECO_NAMES, dc.ch)[1], lookup(DECO_NAMES, dc.ch)[2]);
        else if (sf === SF_OBSIDIAN) h = lookLine(',', [0.9, 0.4, 0.3], '黒曜石', '冷え固まった溶岩。ひび割れから赤い光が漏れている');
        else if (sf === SF_LUMEN) h = lookLine('"', [0.4, 0.95, 0.85], '発光する苔', '淡い燐光を放っている');
        else if (sf === SF_ICE)
          h = level().thin[must(i, 'マス i')]
            ? lookLine('/', [0.6, 0.8, 1.0], '薄い氷', 'ひびが走っている。下には深い水が眠っている')
            : lookLine('=', [0.7, 0.9, 1.0], '氷', '凍りついた水面。よく滑る');
        else if (sf === SF_RUBBLE) h = lookLine(',', [0.75, 0.62, 0.5], '瓦礫', '崩れ落ちた壁と天井の欠片');
        else if (sf === SF_DEAD) h = lookLine('"', [0.6, 0.5, 0.3], '枯れ草', '湿った沼の縁で朽ちかけている');
        else if (level().glyph && level().glyph[must(i, 'マス i')])
          h = lookLine('*', [1.0, 0.9, 0.6], '聖なる紋様', '獣たちは、この紋様を越えようとしない');
        else if (sf === SF_FOLIAGE)
          h =
            blaze.cellFlag[must(i, 'マス i')] === 20
              ? lookLine(',', [0.3, 0.6, 0.3], '踏み分けられた茂み', 'しばらくすると、また伸びてくる')
              : lookLine('"', [0.4, 0.9, 0.4], '背の高い茂み', '視線を遮る。踏み込むと倒れて、しばらくすると元に戻る');
        else if (sf === SF_FUNGFOR)
          h =
            blaze.cellFlag[must(i, 'マス i')] === 20
              ? lookLine(',', [0.4, 0.6, 0.7], '踏み分けられた茸の森', '倒れた茸が、まだ淡く光っている')
              : lookLine('"', [0.5, 0.9, 1.0], '茸の森', '背の高い光る茸が林立し、視線を遮っている');
        else if (sf === SF_BRIM) h = lookLine('*', [1.0, 0.82, 0.3], '硫黄', '踏むと燃え上がる。燃えた後は、しばらくすると元に戻る');
        else if (sf === SF_MUD) h = lookLine('~', [0.6, 0.42, 0.25], '泥', '足を取られて、歩みが遅くなる');
        else if (sf === SF_HAY) h = lookLine('"', [0.95, 0.8, 0.4], '干し草', '乾いていて、よく燃える');
        else if (sf === SF_GRASS) h = lookLine('"', [0.35, 0.85, 0.5], '苔草', '湿った床にまばらに生えている');
        else
          h = cave
            ? lookLine(':', [0.7, 0.68, 0.85], '砂利の床', '砕けた岩が散らばっている')
            : lookLine('.', [0.7, 0.7, 0.9], '石の床', '細かな石が敷き詰められている');
        break;
      }
    }
  }
  // only describe what the player keeps looking at
  if (h !== ui.lookPend) {
    ui.lookPend = h;
    ui.lookPendT = clock.time;
  }
  const show = clock.time - ui.lookPendT > 0.5 ? h : '';
  if (show !== ui.lookHTML) {
    ui.lookHTML = show;
    must(ui.lookEl, '見た時の説明を出す所 lookEl').innerHTML = show;
  }
}
