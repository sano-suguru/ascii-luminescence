// PV の台本の決まり（tools/pv.mjs が読む）。ブラウザを使わない部分なので、単体テスト（tests/unit/pv-script.test.mjs）で確かめる。
// 1つの場面＝1つのページ。時刻は動画の秒（1秒＝30フレーム）。台本は tools/pv/scenes.mjs。
//   name    : 場面の名前（写真の置き場所の名前にもなる。ほかの場面と重ならないこと）
//   place   : ページの URL の指定（?test=1 の後ろ。例 'seed=7&depth=3&god=1'）。title が真なら要らない
//   title   : 真ならタイトルの画面を撮る（ロゴだけを見せる）
//   sec     : 長さ（秒）
//   setup   : 置く物（上から順に）。['clear'] 生き物を全部消す・['equip', 手, 武器]・['elem', 手, 性質]・['give', 物]（dbg.give）・
//             ['summon', 種類, {ahead: 距離, spread: 向きのずれ（ラジアン。既定 0.3）, as: 名前}]（プレイヤーの前の、見えている床に置く）・
//             ['hold', 名前, {face: 'player'}]（その場に止めて、プレイヤーの方を向かせる）
//   target  : カメラと照準の的にする生き物の名前（summon の as）。倒れた後は、倒れた所を的にする
//   cam     : 無ければプレイヤーの目のまま撮る。
//             {from, to, at}：的とプレイヤーを結ぶ線から見た位置（side 横・back 後ろ（負なら前）・up 高さ）を、from から to へ動かす。
//             {orbit: {r, a0, a1, up}, at}：的のまわりを、半径 r で角度 a0 から a1 へ回る（度。0 がプレイヤーの側）。
//             at は見る所（'target' 的・'between' プレイヤーと的の間）。clear は壁から離す距離（既定 1.2。横にこれだけ、見る向きの斜め前に2倍）。
//             決めた位置が岩の中・壁に近い・見る所まで岩を通る時は、左右を入れ替える・近づけるを試して置ける所を探す
//   eye     : プレイヤーの目のまま撮る時の動き。walk: [始め, 終わり]（W を押す秒）・sway 左右に振る量・pan 左右の向きを変える量（ラジアン）
//   events  : [時刻, 動作, 引数]。時刻の代わりに 'afterHit' と書くと、前の strike が当たってから 0.2 秒後。
//             'strike' 手（押して、溜めきったら的へ向き直して離す。溜めない武器は押した時に当たる）・'key' キー・
//             'click' {bag: 袋のルーンの名前} か {slot: [手, 枠]}（装備の画面のボタン）・'kill'（一番近い生き物を倒す）・
//             'ignite' 半径（的の足もとの、燃える物のあるマスに火をつける）
//   hide    : 消す物。'hud'（画面の表示）・'hands'（手元の武器と詠唱の円）・'others'（的の他の生き物を描かない）。
//             既定は 'hud' と、cam のある場面の 'hands'
//   show    : hud の中で見せる物（'pack' 装備の画面）
//   expect  : 撮った後に確かめること。book: 反応の種類（al_book に記されたか）・visible: 的が半ばで画面に写っているか・
//             burning: 燃えているマスの数の下限・away: 生き物が火から離れた距離の下限（場面の間で一番離れた時。逃げるのは 1.6 秒ほど）・hand: 手の名前が変わったか（真）
//   caption : 字幕（無ければ出さない）
export const FPS = 30;
const SETUP = ['clear', 'equip', 'elem', 'give', 'summon', 'hold'];
const EVENTS = ['strike', 'key', 'click', 'kill', 'ignite'];
const HIDE = ['hud', 'hands', 'others'];
const SHOW = ['pack'];
const EXPECT = ['book', 'visible', 'burning', 'away', 'hand'];
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** 場面 s の誤りの一覧（無ければ空）。names は、それより前の場面の名前（重なりを見る） */
export function checkScene(s, names = new Set()) {
  const errs = [],
    at = (m) => errs.push(`${s && s.name ? s.name : '(名前なし)'}：${m}`);
  if (!s || typeof s !== 'object') return ['場面がオブジェクトでない'];
  if (typeof s.name !== 'string' || !s.name) at('name が無い');
  else if (names.has(s.name)) at('name がほかの場面と重なる');
  if (!num(s.sec) || s.sec <= 0) at('sec は正の数');
  if (!s.title && typeof s.place !== 'string') at('place が無い（title でなければ要る）');
  const named = new Set();
  for (const step of s.setup ?? []) {
    if (!Array.isArray(step) || !SETUP.includes(step[0])) {
      at(`setup に知らない物：${JSON.stringify(step)}`);
      continue;
    }
    if (step[0] === 'summon') {
      const o = step[2];
      if (typeof step[1] !== 'string' || !o || !num(o.ahead) || typeof o.as !== 'string')
        at(`summon には種類と {ahead, as} が要る：${JSON.stringify(step)}`);
      else named.add(o.as);
    }
    if (step[0] === 'hold' && !named.has(step[1])) at(`hold の ${step[1]} は、前の summon で置いていない`);
  }
  if (s.target !== undefined && !named.has(s.target)) at(`target の ${s.target} は summon で置いていない`);
  if (s.cam) {
    const c = s.cam,
      pos = (p) => p && num(p.side) && num(p.back) && num(p.up);
    if (c.orbit) {
      if (!(num(c.orbit.r) && num(c.orbit.a0) && num(c.orbit.a1) && num(c.orbit.up))) at('cam.orbit には r・a0・a1・up が要る');
      if (s.target === undefined) at('cam.orbit には target が要る');
    } else if (!pos(c.from) || !pos(c.to)) at('cam には from と to（side・back・up）か orbit が要る');
    if (!['target', 'between'].includes(c.at)) at("cam.at は 'target' か 'between'");
    if (c.at && s.target === undefined) at('cam.at には target が要る');
  }
  for (const e of s.events ?? []) {
    if (!Array.isArray(e) || !(num(e[0]) || e[0] === 'afterHit') || !EVENTS.includes(e[1])) {
      at(`events に知らない物：${JSON.stringify(e)}`);
      continue;
    }
    if (num(e[0]) && (e[0] < 0 || e[0] >= s.sec)) at(`events の時刻 ${e[0]} が場面の外`);
    if (e[1] === 'click' && !(e[2] && (typeof e[2].bag === 'string' || (Array.isArray(e[2].slot) && e[2].slot.length === 2))))
      at('click には {bag} か {slot} が要る');
    if ((e[1] === 'strike' || e[1] === 'ignite') && s.target === undefined) at(`${e[1]} には target が要る`);
  }
  for (const h of s.hide ?? []) if (!HIDE.includes(h)) at(`hide に知らない物：${h}`);
  for (const h of s.show ?? []) if (!SHOW.includes(h)) at(`show に知らない物：${h}`);
  for (const k of Object.keys(s.expect ?? {})) if (!EXPECT.includes(k)) at(`expect に知らない物：${k}`);
  return errs;
}

/** 台本全体の誤りの一覧 */
export function checkScenes(list) {
  const names = new Set(),
    errs = [];
  for (const s of list) {
    errs.push(...checkScene(s, names));
    if (s && s.name) names.add(s.name);
  }
  return errs;
}

/** 消す物（既定を足した物） */
export const hideOf = (s) => new Set(s.hide ?? (s.cam ? ['hud', 'hands'] : ['hud']));

/** 字幕の濃さ（f フレーム目、全部で n フレーム。出だしと終わりの 12 フレームで出し入れする） */
export const captionAlpha = (f, n) => Math.max(0, Math.min(1, (f - 9) / 12, (n - 6 - f) / 12));

/** 0〜1 の進み k を、ゆっくり始まってゆっくり止まる形にする（カメラの動き） */
export const ease = (k) => k * k * (3 - 2 * k);
