// 装備の画面（もとは src/game/27-rune-screen.js）。状態の入れ物 gear（両手・袋・ビルド）・ui（選んでいるルーンなど）・adv（体の枠）に頼り、画面の #pack に書く。
// 大きさの決まった画面を、中身が変わるたびに作り直す。マウスを乗せる・選ぶ時は、下の説明の5行と枠の印だけを変える。
// 画面を開け閉めする・付け替えの詠唱は、古い JS（27-rune-screen.js の setInv・startSwap）にある。
import { lookup, must, nth } from './array.ts';
import { sChime } from './audio.ts';
import { cssOf } from './color.ts';
import { type Side, allRunes, canPutAt, effHand, equipWeapon, freeSlotFor, handsKey, isTwo, slotSet, syncHands } from './gear.ts';
import { renderHotbar } from './hotbar.ts';
import { BAG_LINES, PACK_SLOT, PACK_W } from './hud.ts';
import {
  CAT_BR,
  CAT_NAME,
  ELEM_POW,
  RUNE_DEF,
  type Rune,
  TIER_COL,
  TWO_SLOTS,
  detailLines,
  elemCount,
  emptyChip,
  handName,
  handRunes,
  modWorks,
  runeCol,
  runeName,
  runeShort,
  syncHand,
  weaponCol,
} from './runes.ts';
import { type Hands, adv, gear, player, ui } from './state.ts';
import { boxText, clipHtml, padTo, visW } from './text.ts';
import { unlocked } from './unlocks.ts';

/** 手（左右と、体の枠 B） */
export type HandKey = Side | 'B';
/** 両手（探索が始まってから使うので、無ければその場で止まる） */
const hands = (): Hands => must(gear.hands, '両手 gear.hands');
/** 体の枠 b0・b1 のルーン（ほかの名前は無い） */
const bodyOf = (B: Hands['B'], s: string): Rune | null | undefined => (s === 'b0' ? B.b0 : s === 'b1' ? B.b1 : undefined);
/** 画面のボタンに書いた手の名前（L・R・B のほかは、その場で止まる） */
const handOf = (h: string | undefined): HandKey => {
  if (h === 'L' || h === 'R' || h === 'B') return h;
  throw new Error(`装備の画面：手の名前が違う（${String(h)}）`);
};
/** 左右の手（体の枠 B は武器を持たないので、その場で止まる） */
const sideOf = (h: HandKey): Side => {
  if (h === 'B') throw new Error('装備の画面：体の枠に武器は持てない');
  return h;
};

/** ルーン ru のボタン（attrs は data-h・data-s などの欄。左に選んだ印の欄 .mk） */
export function runeChip(ru: Rune, attrs: string): string {
  const d = lookup(RUNE_DEF, ru.type),
    br = CAT_BR[d.cat] || ['', ''];
  if (d.cat === 'atk')
    return `<button class="row rs" data-u="${ru.uid}" ${attrs}><span class="mk"> </span><span${weaponCol(ru) ? ` style="color:${weaponCol(ru)}"` : ''}>${d.name}</span></button>`;
  return `<button class="row rs" data-u="${ru.uid}" ${attrs}><span class="mk"> </span>${br[0]}<b class="rn" style="color:${cssOf(runeCol(ru))}">${String(d.ch)}</b> <span${ru.strong ? ` style="color:${cssOf(TIER_COL[3])}"` : ''}>${runeShort(ru)}</span>${br[1]}</button>`;
}
/** 手 h が何をするか（性質と重ねた強さ・発動・その武器に効かない効き方のルーン） */
export function handSummary(h: Side): string {
  const H = effHand(h);
  syncHand(H);
  const rs = handRunes(H),
    els = [...new Set(rs.filter((r) => lookup(RUNE_DEF, r.type).cat === 'elem').map((r) => r.type))],
    parts: string[] = [];
  const w = H.atk ? lookup(RUNE_DEF, H.atk.type).name : '素手';
  const pow = (n: number): number => Math.round(nth(ELEM_POW, Math.min(4, n)) * 100);
  const nm = (t: string): string => {
    const n = elemCount(H, t);
    return lookup(RUNE_DEF, t).name + (n > 1 ? `×${n}（${pow(n)}%）` : '');
  };
  const e0 = els[0];
  if (els.length === 2) parts.push(`${nm(nth(els, 0))}と${nm(nth(els, 1))}を、交互に撃つ${w}`);
  else if (els.length === 1 && e0 !== undefined) {
    const n = elemCount(H, e0);
    parts.push(`${String(lookup(RUNE_DEF, e0).pre)}${w}` + (n > 1 ? `（${lookup(RUNE_DEF, e0).name} ×${n}：${pow(n)}%）` : ''));
  } else parts.push(w);
  if (H.trig) parts.push(`${lookup(RUNE_DEF, H.trig.type).name}、ひとりでに撃つ`);
  const no = rs
    .filter((r) => lookup(RUNE_DEF, r.type).cat === 'mod' && !modWorks(lookup(RUNE_DEF, r.type).mk ?? '', H))
    .map((r) => runeName(r));
  if (no.length) parts.push(`<span class="dim">${no.join('・')}はこの手には効かない</span>`);
  return parts.join('　');
}
/** 手 h の名前（発動があれば、その名前を前に）。ビルドの名前に使う */
export const handResult = (h: Side): string => {
  const H = hands()[h];
  return (H.trig ? `${lookup(RUNE_DEF, H.trig.type).name}：` : '') + handName(H);
};
/** 下の説明の5行に、ルーン ru の説明を書く */
export function setPackDetail(ru: Rune | null | undefined): void {
  const el = document.getElementById('pack');
  if (!el) return;
  const L = detailLines(ru);
  el.querySelectorAll('.pdet').forEach((sp, i) => {
    sp.innerHTML = padTo(clipHtml(L[i] || '', PACK_W - 3), PACK_W - 2);
  });
}
/** 選んだ印と、はめられる枠の光りだけを変える（画面は作り直さない） */
export function updatePackSel(): void {
  const el = document.getElementById('pack');
  if (!el) return;
  el.querySelectorAll<HTMLElement>('button.rs').forEach((b) => {
    const sel = ui.packSel,
      u = Number(b.dataset['u']) || 0,
      mk = b.querySelector('.mk');
    if (mk) mk.innerHTML = sel && u && sel.ru.uid === u ? '&gt;' : ' ';
    b.classList.toggle('sel', !!(sel && u && sel.ru.uid === u));
    const s = b.dataset['s'];
    if (s) {
      const ok = !!sel && slotAccepts(handOf(b.dataset['h']), s, sel.ru);
      b.classList.toggle('can', ok);
      b.classList.toggle('dimmed', !!sel && !ok);
    }
  });
  setPackDetail(ui.packHover || (ui.packSel && ui.packSel.ru));
}
/** 装備の画面を作り直す（両手の武器とルーンの枠・体の枠・袋（種類ごとにページを分ける）・説明の5行・ビルド） */
export function renderInv(): void {
  const el = document.getElementById('pack');
  if (!el || !gear.hands) return;
  const hs = gear.hands,
    f = (t: string): string => `<span class="f">${t}</span>`,
    W = PACK_SLOT;
  const slot = (h: Side, s: string): string => {
    const ru = slotGet(h, s);
    if (s !== 'atk' && +s.slice(1) >= (hs[h].slotN || 2)) return padTo(` <span class="dim">· 閉じ</span>`, W);
    return padTo(
      ru ? runeChip(ru, `data-h="${h}" data-s="${s}"`) : emptyChip(s === 'atk' ? 'atk' : 'rune', `data-h="${h}" data-s="${s}"`),
      W,
    );
  };
  const B = hs.B,
    bodyOpen = adv.runState.bodyOpen || 0;
  const bslot = (i: number): string => {
    const s = 'b' + i,
      ru = bodyOf(B, s);
    if (i >= bodyOpen) return padTo(` <span class="dim">" 閉じ</span>`, W);
    return padTo(ru ? runeChip(ru, `data-h="B" data-s="${s}"`) : emptyChip('body', `data-h="B" data-s="${s}"`), W);
  };
  const bodyFx = [0, 1]
    .slice(0, bodyOpen)
    .map((i) => bodyOf(B, 'b' + i))
    .filter((r): r is Rune => Boolean(r))
    .map((r) => lookup(RUNE_DEF, r.type).name)
    .join('・');
  const rows = [
    f('+-- 装備 ---'),
    `${f('|')}        ${padTo(' <span class="lab">武器</span>', W)}<span class="lab"> ルーン（性質は2つまで、発動は1つまで、同じ変化は2つまで）</span>`,
  ];
  const two = isTwo();
  for (const h of ['L', 'R'] as const) {
    const wcell = two && h === 'R' ? padTo(' <span class="dim">（両手）</span>', W) : slot(h, 'atk');
    rows.push(
      `${f('|')} ${two ? (h === 'L' ? '両手' : '　　') : h === 'L' ? '左手' : '右手'}   ${wcell}${slot(h, 's0')}${slot(h, 's1')}${slot(h, 's2')}${slot(h, 's3')}`,
    );
    if (!two || h === 'R') rows.push(`${f('|')}        ` + clipHtml(`<span class="lab">→ ${handSummary(h)}</span>`, PACK_W - 11));
  }
  if (two) rows.push(`${f('|')}        <span class="dim">両手で持つ間、両手のルーンの枠は合わせて${TWO_SLOTS}つまで使える</span>`);
  rows.push(
    `${f('|')} 身     ${bslot(0)}${bslot(1)}${padTo('', W)} <span class="lab">→</span> ${bodyFx || '<span class="dim">護符なし</span>'}`,
  );
  rows.push(f('|'), `${f('|')} 袋`);
  for (const cat of ['atk', 'elem', 'trig', 'mod', 'body']) {
    const list = gear.bag.filter((r) => lookup(RUNE_DEF, r.type).cat === cat).sort((a, b) => a.type.localeCompare(b.type));
    // ページは BAG_LINES 行ずつ。最後の行には、ページ送りのボタンの場所を空けておく
    const head = `${f('|')}   <span class="lab">${String(CAT_NAME[cat])}</span>  `,
      cont = `${f('|')}         `,
      lim = PACK_W - 6,
      pagerW = 16;
    const pages: { c: string; li: number }[][] = [];
    let cur: { c: string; li: number }[] = [],
      li = 0,
      lw = visW(head);
    for (const r of list) {
      const c = runeChip(r, `data-b="${r.uid}"`),
        cw = visW(c) + 1,
        cap = lim - (li === BAG_LINES - 1 ? pagerW : 0);
      if (lw + cw > cap) {
        li++;
        lw = visW(cont);
        if (li >= BAG_LINES) {
          pages.push(cur);
          cur = [];
          li = 0;
          lw = visW(head);
        }
      }
      cur.push({ c, li });
      lw += cw;
    }
    if (cur.length || !pages.length) pages.push(cur);
    const n = pages.length,
      p = Math.min(ui.bagPage[cat] || 0, n - 1);
    ui.bagPage[cat] = p;
    ui.bagPageN[cat] = n;
    const page = nth(pages, p),
      lines = Array.from({ length: BAG_LINES }, (_, k) => (k === 0 ? head : cont));
    for (const it of page) lines[it.li] = nth(lines, it.li) + it.c + ' ';
    if (!list.length) lines[0] = nth(lines, 0) + '<span class="dim">-</span>';
    if (n === 1) {
      const usedL = Math.max(1, ...page.map((it) => it.li + 1));
      lines.length = usedL;
    }
    if (n > 1)
      lines[BAG_LINES - 1] =
        padTo(nth(lines, BAG_LINES - 1), lim - pagerW + 3) +
        `<button class="row" data-pg="${cat}:-1">[&lt;]</button> ${p + 1}/${n} <button class="row" data-pg="${cat}:1">[&gt;]</button>`;
    rows.push(...lines);
  }
  rows.push(f('|'));
  for (let i = 0; i < 5; i++) rows.push(`${f('|')} <span class="pdet">${padTo('', PACK_W - 2)}</span>`);
  rows.push(f('|'));
  for (const k of unlocked('build3') ? [0, 1, 2] : [0, 1]) {
    const b = gear.builds[k];
    rows.push(
      `${f('|')} ビルド${k + 1} <button class="row" data-save="${k}">[保存]</button> <button class="row${b ? '' : ' off'}" data-load="${k}">[呼び出す]</button>  <span class="lab">${b && b.label ? b.label : '-'}</span>`,
    );
  }
  rows.push(
    f('|'),
    `${f('|')} <span class="lab">選んで、光る枠をクリック　ダブルクリックで自動ではめる　右クリックで取り消し</span>`,
    `${f('|')} <span class="lab">閉じると付け替えの詠唱（約1.5秒）。石碑のそばなら一瞬</span>`,
    f('+---'),
  );
  el.innerHTML = boxText(rows, PACK_W);
  updatePackSel();
  if (!el.dataset['bound']) {
    el.dataset['bound'] = '1';
    el.addEventListener('click', onPackClick);
    el.addEventListener('mouseover', (e) => {
      const t = e.target,
        b = t instanceof Element ? t.closest<HTMLElement>('button[data-u]') : null,
        ru = b ? allRunes().find((r) => r.uid === Number(b.dataset['u'])) || null : null;
      if (ru !== ui.packHover) {
        ui.packHover = ru;
        setPackDetail(ui.packHover || (ui.packSel && ui.packSel.ru));
      }
    });
    el.addEventListener('mouseleave', () => {
      if (ui.packHover) {
        ui.packHover = null;
        setPackDetail(ui.packSel && ui.packSel.ru);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (ui.packSel) {
        ui.packSel = null;
        updatePackSel();
      }
    });
  }
}
/** 装備の画面のクリック（ボタンの無い所：選んだ物を取り消す。ページ送り・枠・袋のルーン（続けて押すと自動ではめる）・ビルドの保存と呼び出し） */
function onPackClick(e: MouseEvent): void {
  const t = e.target,
    b = t instanceof Element ? t.closest('button') : null;
  if (!b) {
    if (ui.packSel) {
      ui.packSel = null;
      updatePackSel();
    }
    return;
  }
  e.stopPropagation();
  const hs = hands(),
    d = b.dataset;
  if (d['pg']) {
    const [cat = '', dir] = d['pg'].split(':'),
      n = ui.bagPageN[cat] || 1;
    ui.bagPage[cat] = ((ui.bagPage[cat] || 0) + Number(dir) + n) % n;
    renderInv();
    return;
  }
  if (d['h']) {
    packSlot(handOf(d['h']), String(d['s']));
    return;
  }
  if (d['b']) {
    const u = Number(d['b']),
      ru = gear.bag.find((r) => r.uid === u);
    if (!ru) return;
    if (ui.packClick.u === u && performance.now() - ui.packClick.t < 600) {
      ui.packClick = { u: 0, t: 0 };
      autoEquip(ru);
      renderInv();
      renderHotbar();
      return;
    }
    ui.packClick = { u, t: performance.now() };
    ui.packSel = { ru, from: 'bag' };
    updatePackSel();
    return;
  }
  if (d['save'] !== undefined) {
    const k = Number(d['save']),
      uid = (r: Rune | null): number => (r ? r.uid : 0);
    gear.builds[k] = {
      L: { atk: uid(hs.L.atk), slots: hs.L.slots.map(uid) },
      R: { atk: uid(hs.R.atk), slots: hs.R.slots.map(uid) },
      label: `${handResult('L')} / ${handResult('R')}`,
    };
    gear.buildIdx = k;
    sChime(player.x, player.z, 0.2);
    renderInv();
    return;
  }
  if (d['load'] !== undefined) {
    const k = Number(d['load']);
    if (gear.builds[k]) {
      applyBuild(k);
      ui.packSel = null;
      renderInv();
      renderHotbar();
    }
  }
}
/** 手 h の枠 s のルーン（'atk' は武器、's0' から 's3' はルーンの枠、手 'B' の 'b0'・'b1' は体の枠） */
export function slotGet(h: HandKey, s: string): Rune | null | undefined {
  const hs = hands();
  if (h === 'B') return bodyOf(hs.B, s);
  if (s === 'atk') return hs[h].atk;
  return hs[h].slots[+s.slice(1)] || null;
}
/** 手 h の枠 s に、ルーン ru をはめられるか（体の枠は開いている枠だけ） */
export function slotAccepts(h: HandKey, s: string, ru: Rune): boolean {
  const c = lookup(RUNE_DEF, ru.type).cat;
  if (h === 'B') return c === 'body' && +s.slice(1) < (adv.runState.bodyOpen || 0);
  if (s === 'atk') return c === 'atk';
  return canPutAt(h, +s.slice(1), ru);
}
/** 袋のルーン ru を、はめられる所に自動ではめる（空いた枠が無ければ、同じ種類のルーンと入れ替える）。はめたら true */
export function autoEquip(ru: Rune): boolean {
  const cat = lookup(RUNE_DEF, ru.type).cat,
    hs = hands();
  let pick: [HandKey, string] | null = null;
  if (cat === 'body') {
    const n = adv.runState.bodyOpen || 0;
    if (!n) return false;
    let i = [0, 1].slice(0, n).find((x) => !bodyOf(hs.B, 'b' + x));
    if (i === undefined) i = 0;
    pick = ['B', 'b' + i];
  } else if (cat === 'atk') {
    const j = gear.bag.indexOf(ru);
    if (j >= 0) gear.bag.splice(j, 1);
    const out = equipWeapon(isTwo() ? 'R' : (['R', 'L'] as const).find((h) => !hs[h].atk) || 'R', ru);
    gear.bag.push(...out);
    ui.packSel = null;
    return true;
  } else {
    pick = freeSlotFor(ru);
    if (!pick) {
      for (const h of ['R', 'L'] as const) {
        const H = hs[h];
        for (let i = 0; i < (H.slotN || 2) && !pick; i++) {
          const o = H.slots[i];
          if (o && lookup(RUNE_DEF, o.type).cat === cat && canPutAt(h, i, ru)) pick = [h, 's' + i];
        }
      }
    }
  }
  if (!pick) return false;
  const old = slotGet(pick[0], pick[1]),
    j = gear.bag.indexOf(ru);
  if (j >= 0) gear.bag.splice(j, 1);
  if (old) gear.bag.push(old);
  slotSet(pick[0], pick[1], ru);
  ui.packSel = null;
  syncHands();
  return true;
}
/**
 * 装備の画面で、手 h の枠 s を押した。袋から選んでいれば、そこにはめる（前の物は袋へ）。枠から選んでいれば、同じ枠なら外して袋へ、
 * 別の枠なら入れ替える（はめられない組み合わせと、武器と枠の入れ替えはしない）。何も選んでいなければ、その枠のルーンを選ぶ
 */
export function packSlot(h: HandKey, s: string): void {
  const hs = hands(),
    cur = slotGet(h, s),
    sel = ui.packSel;
  if (sel && sel.from === 'bag') {
    const ru = sel.ru;
    if (slotAccepts(h, s, ru)) {
      const i = gear.bag.indexOf(ru);
      if (i >= 0) gear.bag.splice(i, 1);
      if (s === 'atk') gear.bag.push(...equipWeapon(sideOf(h), ru));
      else {
        if (cur) gear.bag.push(cur);
        slotSet(h, s, ru);
      }
      ui.packSel = null;
    }
  } else if (sel && sel.from === 'slot') {
    if (sel.h === h && sel.s === s) {
      if (cur) {
        gear.bag.push(cur);
        if (s === 'atk') {
          if (isTwo()) {
            hs.L.atk = null;
            hs.R.atk = null;
          } else hs[sideOf(h)].atk = null;
        } else slotSet(h, s, null);
      }
    } else if ((sel.s === 'atk' || s === 'atk') && (isTwo() || sel.s !== s)) {
      // 武器とルーンの枠は入れ替えない。両手持ちの間は、武器どうしも入れ替えない
    } else {
      const ru = sel.ru;
      slotSet(sel.h, sel.s, null);
      const okA = slotAccepts(h, s, ru),
        okB = !cur || slotAccepts(sel.h, sel.s, cur);
      slotSet(sel.h, sel.s, ru);
      if (okA && okB) {
        slotSet(sel.h, sel.s, cur ?? null);
        slotSet(h, s, ru);
      }
    }
    ui.packSel = null;
  } else if (cur) ui.packSel = { ru: cur, from: 'slot', h, s };
  syncHands();
  renderInv();
  renderHotbar();
}
/** ビルド k を呼び出す（持っているルーンから、保存した番号の物を、保存した枠に戻す。ほかは袋へ）。手が変わったら true */
export function applyBuild(k: number): boolean {
  const b = gear.builds[k];
  if (!b) return false;
  const hs = hands(),
    pool = allRunes(),
    byU = (u: number | undefined): Rune | null => (u ? pool.find((r) => r.uid === u) || null : null),
    before = handsKey(),
    used = new Set<Rune>([hs.B.b0, hs.B.b1].filter((r): r is Rune => Boolean(r)));
  const take = (u: number | undefined): Rune | null => {
    const r = byU(u);
    if (!r || used.has(r)) return null;
    used.add(r);
    return r;
  };
  const twoB = b.L.atk && b.L.atk === b.R.atk,
    w2 = twoB ? take(b.L.atk) : null;
  for (const h of ['L', 'R'] as const) {
    const H = hs[h],
      Bh = b[h];
    H.atk = twoB ? w2 : take(Bh.atk);
    const sl = Bh.slots || [];
    H.slots = Array.from({ length: Math.max(H.slotN || 2, H.slots.length) }, (_, i) => (i < (H.slotN || 2) ? take(sl[i]) : null));
  }
  gear.bag = pool.filter((r) => !used.has(r));
  gear.buildIdx = k;
  syncHands();
  return handsKey() !== before;
}
