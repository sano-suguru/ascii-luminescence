// 結果の画面（もとは src/game/18-level-player.js・24-goal.js）：死んだ時と勝った時の画面に出す場所・伝承・墓に遺す物、勝った時の画面。
// 状態の入れ物 adv・saved・here・gear・ui（墓に遺せる物と選んでいる物）に頼る。
import { lookup, must, nth } from './array.ts';
import { sChime } from './audio.ts';
import { css } from './color.ts';
import { getLegend } from './legend.ts';
import { LEGEND_KINDS, LEGEND_ORDER } from './names.ts';
import { UNLOCKS } from './progress.ts';
import { type Rune, serRune, thingLabel } from './runes.ts';
import { saveMeta } from './save.ts';
import { adv, gear, here, keys, clock, player, saved, ui } from './state.ts';
import { placeLabel } from './status.ts';
import { STRATA } from './strata.ts';
import { boxText, clipHtml, padTo } from './text.ts';
import { loreLeft, unlocked } from './unlocks.ts';
import { FINAL_DEPTH } from './world.ts';

/** 伝承の内訳（項目ごとの [名前, 数の説明, 伝承]・合計 base・試練の倍率 mult・得る伝承 total） */
export interface LoreResult {
  parts: [string, string, number][];
  base: number;
  mult: number;
  total: number;
}
/** 結果の画面の場所（数だけの場所の名前なら「深度n（層の名前）」、ほかは「名前（深度n）」） */
export function resultPlace(): string {
  const pl = placeLabel();
  return /^[0-9]+$/.test(String(pl).trim())
    ? `深度${here.depth}（${(here.D && here.D.stratum && here.D.stratum.name) || ''}）`
    : `${pl}（深度${here.depth}）`;
}
/** この探索で得る伝承（届いた深さ・倒した主・最深部へ持ち帰った伝説の物・上がったレベル・新しく記した反応・初めて会った忘れられた獣。試練で倍になる。勝った分の行は、元からコメントの中にあって数えない） */
export function runLore(_victory: boolean): LoreResult {
  const L = getLegend(),
    parts: [string, string, number][] = [],
    add = (lab: string, n: string, v: number) => {
      if (v > 0) parts.push([lab, n, v]);
    },
    md = (adv.runStats && adv.runStats.maxDepth) || here.depth;
  add('到達した深さ', `深度${md}`, md * 2);
  const lords = adv.runState.lordsDone ? adv.runState.lordsDone.size : 0;
  add('倒した支道の主', `${lords}体`, lords * 8);
  const pl = L && md >= FINAL_DEPTH ? L.have.size : 0;
  add('最深部へ持ち帰った伝説の物', `${pl}つ`, pl * 6); // only those brought to the bottom if(victory)add('王の影に勝った','',30);
  const lg = Math.max(0, (adv.lvl.n || 1) - 1);
  add('上がったレベル', `${lg}つ`, lg);
  const nb = Math.max(0, saved.BOOK.size - ((adv.runStats && adv.runStats.book0) || 0));
  add('新しく記した反応', `${nb}つ`, nb * 3);
  const nbe = (adv.runStats && adv.runStats.beastsNew) || 0;
  add('初めて出会った忘れられた獣', `${nbe}体`, nbe * 4);
  const base = parts.reduce((a, p) => a + p[2], 0),
    mult = 1 + 0.25 * adv.runTrials.length;
  return { parts, base, mult, total: Math.round(base * mult) };
}
/** 伝承を受け取る（探索で一度だけ。図鑑では受け取らない。2度目からは前の答え） */
export function awardLore(victory: boolean): LoreResult | null {
  if (!adv.runStats || ui.gallery) return null;
  if (adv.runStats.loreRes) return adv.runStats.loreRes;
  const R = runLore(victory);
  saved.META.lore = (saved.META.lore || 0) + R.total;
  saveMeta();
  adv.runStats.loreRes = R;
  return R;
}
/** 結果の画面の、伝承の行（f は枠の文字を包む関数） */
export function loreRows(R: LoreResult | null, f: (t: string) => string): string[] {
  if (!R) return [];
  const rows = [`${f('|')}  <b>伝承</b>`];
  for (const [lab, n, v] of R.parts) rows.push(`${f('|')}    ${padTo(lab + (n ? `（${n}）` : ''), 34)}${String(v).padStart(4)}`);
  if (R.mult > 1)
    rows.push(
      `${f('|')}    ${padTo(`試練（${adv.runTrials.map((k) => lookup({ dusk: '薄明', fury: '猛り' }, k)).join('・')}）`, 34)}  ×${R.mult.toFixed(2)}`,
    );
  rows.push(
    `${f('|')}    ${padTo('合計', 34)}<b style="color:#ffe3a0">${String('+' + R.total).padStart(4)}</b>`,
    `${f('|')}    <span class="lab">累計 ${saved.META.lore}　　使える伝承 ${loreLeft()}</span>`,
  );
  if (UNLOCKS.some((u) => !unlocked(u.id) && u.cost <= loreLeft()))
    rows.push(`${f('|')}    <span style="color:#ffe3a0">解放できるものがある（タイトルの［解放］から）</span>`);
  else {
    const nx = UNLOCKS.filter((u) => !unlocked(u.id)).sort((a, b) => a.cost - b.cost)[0];
    if (nx) rows.push(`${f('|')}    <span class="lab">次の解放まで あと ${nx.cost - loreLeft()}（${nx.name} ${nx.cost}）</span>`);
  }
  return rows;
}
/** 墓に遺せるルーン（両手の武器・枠・体の枠・袋の順。同じ物は1つ。多くても10） */
export function graveCandidates(): Rune[] {
  const out: Rune[] = [],
    seen = new Set<Rune>(),
    add = (ru: Rune | null | undefined) => {
      if (ru && !seen.has(ru)) {
        seen.add(ru);
        out.push(ru);
      }
    };
  const hands = must(gear.hands, '両手 gear.hands');
  add(hands.L.atk);
  add(hands.R.atk);
  for (const h of ['L', 'R'] as const) for (const r of hands[h].slots) add(r);
  if (hands.B) {
    add(hands.B.b0);
    add(hands.B.b1);
  }
  for (const r of gear.bag) add(r);
  return out.slice(0, 10);
}
/** 選んだ墓を記録する（勝った時は記録しない。遺さない時は墓を消す） */
export function saveGrave(): void {
  if (adv.won || !ui.graveCands) return;
  const ru = ui.graveSel > 0 ? nth(ui.graveCands, ui.graveSel - 1) : null;
  saved.META.grave = ru
    ? {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- 層が見つからない時の空の物（元の読み方のまま。欄を読むための型だけ）
        k: (STRATA.find((st) => here.depth >= st.from && here.depth <= st.to) || ({} as { k?: string })).k || '',
        depth: here.depth,
        cause: adv.runStats.cause || '',
        item: serRune(ru),
      }
    : null;
  saveMeta();
  ui.graveCands = [];
}
/** 結果の画面の、墓に遺す物を選ぶ行（f は枠の文字を包む関数） */
export function graveRows(f: (t: string) => string): string[] {
  const rows = [`${f('|')}  <b>墓に遺すもの</b>　<span class="lab">（ひとつ選ぶ。次の探索で、同じ深さに墓が現れる）</span>`];
  const opt = (i: number, label: string) =>
    `${f('|')}    <button class="row gv" data-gv="${i}"><span class="mk">${ui.graveSel === i ? '&gt;' : ' '}</span> ${label}</button>`;
  rows.push(opt(0, '<span class="lab">遺さない</span>'));
  ui.graveCands.forEach((ru, i) => rows.push(opt(i + 1, clipHtml(thingLabel(ru), 48))));
  return rows;
}
/** 勝った（王の影を倒した）時の画面（死んだ時の画面と同じ所に、明るく。墓は遺さない） */
export function victory(): void {
  if (adv.won) return;
  adv.won = true;
  adv.dead = true;
  keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false;
  const el = document.getElementById('death');
  if (!el) return;
  const L = getLegend();
  const secs = Math.floor(clock.time - adv.runStats.t0),
    mm = Math.floor(secs / 60),
    ss = String(secs % 60).padStart(2, '0'),
    f = (t: string) => `<span class="f">${t}</span>`;
  const R = awardLore(true);
  ui.graveCands = [];
  document.body.classList.add('over');
  el.innerHTML = boxText([
    f('+-- 光 は 戻 っ た ---'),
    f('|'),
    ...LEGEND_ORDER.map(
      (k) =>
        `${f('|')}  <b style="color:${css(lookup(LEGEND_KINDS, k).col)}">${lookup(LEGEND_KINDS, k).ch}</b> ${lookup(must(L, '伝説の物').items, k).name}`,
    ),
    f('|'),
    `${f('|')}  Lv${adv.lvl.n}　倒した敵 ${adv.runStats.kills}　時間 ${mm}:${ss}　シード ${adv.runSeed}`,
    f('|'),
    ...loreRows(R, f),
    f('|'),
    `${f('|')}  ${must(adv.HIST).civ.name}の地の底に、ひとつの灯りがともった。`,
    f('|'),
    `${f('|')}  <b>[Enter]</b> 新しい探索へ`,
    f('+---'),
  ]);
  el.classList.add('show', 'won');
  for (let k = 0; k < 4; k++) setTimeout(() => sChime(player.x, player.z, 0.5), k * 380);
}
