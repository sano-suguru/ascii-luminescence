// タイトルの画面：記録 META を読む loadMeta、解放の画面 buildUnlockPanel、タイトルの枠 buildIntroPanel（指で触る端末ではキーボードの操作の一覧を出さない）、
// 後から描き直す redrawIntroLater、初めて指で入った時の一言 touchTip と、タイトルの画面を用意する initIntro（記録を読み、タイトルを描き、[迷宮に入る] を受け取る）。
import { must, nth } from './array.ts';
import { sChime, sndInit } from './audio.ts';
import { autoSt, canOfferAuto, startAuto } from './auto.ts';
import { openBestiary, openRange } from './gallery.ts';
import { resetRunes } from './gear.ts';
import { initFitIntro } from './layout.ts';
import { newLevel, showStratum } from './levels.ts';
import { msg } from './log.ts';
import { type Meta, META_DEF, UNLOCKS } from './progress.ts';
import { saveMeta } from './save.ts';
import { tryLock, updateResume } from './screens.ts';
import { adv, clock, fight, gfx, here, player, saved, ui } from './state.ts';
import { setHelp } from './status.ts';
import { STRATA } from './strata.ts';
import { boxText, padTo, visW } from './text.ts';
import { took } from './took.ts';
import { homeHint } from './touch.ts';
import { loreLeft, unlocked } from './unlocks.ts';

/** 記録 META を localStorage から読む（無い欄は初めの値。読めなければ初めの値だけ） */
function loadMeta(): Meta {
  try {
    return Object.assign({}, META_DEF, JSON.parse(localStorage.getItem('al_meta') || '{}'));
  } catch (e) {
    return Object.assign({}, META_DEF);
  }
}
/** 解放の画面（タイトルの［解放］）を #intropanel に描く */
export function buildUnlockPanel(): void {
  const el = document.getElementById('intropanel');
  if (!el) return;
  const f = (t: string) => `<span class="f">${t}</span>`,
    KIND = { weapon: '武器', rune: 'ルーン', bless: '恩恵', build: 'ビルド', trial: '試練' };
  const rows = [
    f('+-- 解放 ---'),
    `${f('|')} 伝承を使って、選べるものを増やす。　使える伝承 <b style="color:#ffe3a0">${loreLeft()}</b>`,
    f('|'),
  ];
  for (const u of UNLOCKS) {
    const done = unlocked(u.id),
      can = !done && u.cost <= loreLeft();
    rows.push(
      `${f('|')} ${done ? '<span class="lab">　解放済み　</span>' : can ? `<button class="sl" type="button" data-unl="${u.id}">[ 解放する ]</button>` : '<span class="dim">　伝承不足　</span>'} ${padTo(`<span class="lab">${KIND[u.kind]}</span>`, 6)} ${padTo(done ? u.name : `<span${can ? '' : ' class="dim"'}>${u.name}</span>`, 24)} <span class="lab">${String(u.cost).padStart(3)}</span>`,
    );
    rows.push(`${f('|')}               <span class="dim">${u.desc}</span>`);
  }
  rows.push(f('|'), `${f('|')} <button class="sl" id="unlBack" type="button">[ もどる ]</button>`, f('+---'));
  el.innerHTML = boxText(rows);
  must(document.getElementById('unlBack'), '［もどる］').addEventListener('click', () => {
    ui.introMode = 'main';
    buildIntroPanel();
  });
  for (const b of el.querySelectorAll<HTMLElement>('button[data-unl]'))
    b.addEventListener('click', () => {
      const u = UNLOCKS.find((x) => x.id === b.dataset['unl']);
      if (!u || unlocked(u.id) || u.cost > loreLeft()) return;
      saved.META.unl = [...(saved.META.unl || []), u.id];
      saved.META.spent = (saved.META.spent || 0) + u.cost;
      saveMeta();
      sndInit();
      sChime(0, 0, 0.5);
      buildUnlockPanel();
    });
}
/** タイトルの枠（#intropanel）を描く。解放の画面を開いていれば、そちらを描く */
export function buildIntroPanel(): void {
  const devOn = saved.DEVALL;
  if (!devOn) ui.startDepth = 1;
  // oxlint-disable-next-line typescript/consistent-type-assertions -- シードの欄は、この関数が <input> で作る（無ければ空の欄として読む）
  const seedKeep = ((document.getElementById('seedIn') || {}) as { value?: string }).value || '';
  // 開発用の物（［開発用モード］・［自動で試す］）は、遊ぶ人には出さない。［開発用モード］は、このページで一度でも開発用モードがオンだった時（?dev=1・al_dev が残っている）か、
  // Artifact の持ち主の時だけ（Artifact では ?dev=1 が届かない）。［自動で試す］は持ち主の時だけ（src/lib/auto.ts の canOfferAuto）
  // 自動で試している間は、どちらも出さない（開発用モードを変えると、台本の中身が変わるため）
  if (devOn) ui.devSeen = true;
  const devBtn = (ui.devSeen || ui.owner) && !autoSt.on,
    autoBtn = canOfferAuto();
  const el = document.getElementById('intropanel');
  if (!el) return;
  const f = (t: string) => `<span class="f">${t}</span>`;
  if (ui.introMode === 'unlock') {
    buildUnlockPanel();
    return;
  }
  const galRow = `${f('|')} <button class="sl" id="galB" type="button">[ 図鑑 ]</button>  <button class="sl" id="galR" type="button">[ 試しの間 ]</button>   `;
  // 指で触る端末（スマホなど）では、キーボードの操作の一覧を出さない（使えない操作で、背の低い画面ではタイトルが収まらなくなるため）
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const keyList: [string, string][] = [
    ['WASD', '移動'],
    ['マウス', '視点'],
    ['左クリック', '左手'],
    ['右クリック', '右手'],
    ['ホイール', 'ビルド切替'],
    ['Space', '回避'],
    ['Shift', '走る'],
    ['Tab', '装備'],
    ['Esc', 'メニュー'],
  ];
  const cell = ([k, v]: [string, string]) => {
    const s = `<b>[${k}]</b> ${v}`;
    return s + ' '.repeat(Math.max(1, 24 - visW(s)));
  };
  const keyRows: string[] = [];
  for (let i = 0; i < keyList.length; i += 2)
    keyRows.push(`${f('|')} ${cell(nth(keyList, i))}${keyList[i + 1] ? cell(nth(keyList, i + 1)) : ''}`);
  const seen = new Set(),
    layers: (typeof STRATA)[number][] = [];
  for (const st of STRATA) {
    if (seen.has(st.n)) continue;
    seen.add(st.n);
    layers.push(st);
  }
  const layerRows = devOn
    ? [
        `${f('|')} 開始する層`,
        ...layers.map(
          (st) =>
            `${f('|')}   <button class="sl${st.from === ui.startDepth ? ' on' : ''}" type="button" data-d="${st.from}"><span class="mk">${st.from === ui.startDepth ? '&gt;' : ' '}</span> 第${st.n}層 ${st.name}</button>`,
        ),
        f('|'),
      ]
    : [];
  el.innerHTML = boxText([
    f('+-- 地下迷宮へ ---'),
    `${f('|')} 壁も床も天井も、そこに棲むものも、`,
    `${f('|')} すべてが光る文字でできた地下迷宮。`,
    `${f('|')} 深く潜るほど闇は濃く、溶岩の光が強くなる。`,
    f('|'),
    // iPhone の Safari で、ホーム画面から開いていない時だけ：ホーム画面に置くと、アドレスバーの無い広い画面で遊べる（src/lib/touch.ts の homeHint）。背の低い横向きの画面に収まるように1行
    ...(homeHint() ? [`${f('|')} <span class="lab">共有の「ホーム画面に追加」で、広い画面で遊べる。</span>`, f('|')] : []),
    ...(coarse ? [] : [...keyRows, f('|')]),
    ...layerRows,
    `${f('|')} シード [<input id="seedIn" type="text" inputmode="numeric" autocomplete="off" maxlength="10" size="10" placeholder="ランダム" aria-label="シード">]`,
    f('|'),
    ...(UNLOCKS.some((u) => u.kind === 'trial' && unlocked(u.id))
      ? [
          `${f('|')} 試練 ` +
            UNLOCKS.filter((u) => u.kind === 'trial' && unlocked(u.id))
              .map(
                (u) =>
                  `<button class="sl${(saved.META.trials || []).includes(must(u.t, '試練の t')) ? ' on' : ''}" type="button" data-trial="${u.t}"><span class="mk">${(saved.META.trials || []).includes(must(u.t, '試練の t')) ? '&gt;' : ' '}</span> ${u.name.replace(/試練|「|」/g, '')}</button>`,
              )
              .join('  '),
          f('|'),
        ]
      : []),
    `${f('|')} 伝承 <b style="color:#ffe3a0">${loreLeft()}</b> <span class="lab">（累計 ${saved.META.lore || 0}）</span>  <button class="sl" id="unlockB" type="button">[ 解放 ]</button>`,
    f('|'),
    `${f('|')}               <button id="enter" type="button">[ 迷宮に入る ]</button>`,
    f('|'),
    galRow + (devBtn ? `<button class="sl" id="galDev" type="button">[開発用モード：${devOn ? 'オン' : 'オフ'}]</button>` : ''),
    // ［自動で試す］は［開発用モード］の真下に並べる
    ...(autoBtn ? [`${f('|')}${' '.repeat(visW(galRow) - 1)}<button class="sl" id="autoB" type="button">[ 自動で試す ]</button>`] : []),
    f('+---'),
  ]);
  must(document.getElementById('galB'), '［図鑑］').addEventListener('click', () => {
    sndInit();
    openBestiary();
  });
  must(document.getElementById('unlockB'), '［解放］').addEventListener('click', () => {
    ui.introMode = 'unlock';
    buildIntroPanel();
  });
  for (const b of el.querySelectorAll<HTMLElement>('button[data-trial]'))
    b.addEventListener('click', () => {
      const k = must(b.dataset['trial'], '試練の鍵'),
        T = new Set(saved.META.trials || []);
      if (T.has(k)) T.delete(k);
      else T.add(k);
      saved.META.trials = [...T];
      saveMeta();
      buildIntroPanel();
    });
  must(document.getElementById('galR'), '［試しの間］').addEventListener('click', () => openRange());
  if (autoBtn) must(document.getElementById('autoB'), '［自動で試す］').addEventListener('click', () => startAuto());
  if (devBtn)
    must(document.getElementById('galDev'), '［開発用モード］').addEventListener('click', () => {
      saved.DEVALL = !saved.DEVALL;
      try {
        localStorage.setItem('al_dev', saved.DEVALL ? '1' : '0');
      } catch (er) {}
      buildIntroPanel();
    });
  for (const b of el.querySelectorAll<HTMLElement>('button.sl[data-d]'))
    b.addEventListener('click', () => {
      ui.startDepth = +must(b.dataset['d'], '始める深さ');
      for (const o of el.querySelectorAll('button.sl[data-d]')) {
        const on = o === b;
        o.classList.toggle('on', on);
        must(o.querySelector('.mk'), '選んだ印').innerHTML = on ? '&gt;' : ' ';
      }
    });
  // oxlint-disable-next-line typescript/consistent-type-assertions -- シードの欄は、上で <input> で作った
  const si = document.getElementById('seedIn') as HTMLInputElement | null;
  if (si) si.value = seedKeep;
}
// 後から（持ち主と分かった時・ゲームの用意ができた時）タイトルを描き直す。シードの欄に打っている間は、離れてから
// （描き直すと欄が作り直され、iPhone では打っている途中にキーボードが閉じるため）
export function redrawIntroLater(): void {
  const si = document.getElementById('seedIn');
  if (si && document.activeElement === si) {
    si.addEventListener('blur', () => buildIntroPanel(), { once: true });
    return;
  }
  buildIntroPanel();
}

/** タイトルの画面を用意する：記録を読み、タイトルを描き、[迷宮に入る] を受け取る */
export function initIntro(): void {
  saved.META = loadMeta();
  // developer mode (al_dev) is read here, before the title is built below (the title's trials row depends on it)
  try {
    saved.DEVALL = localStorage.getItem('al_dev') === '1';
  } catch (e) {}
  buildIntroPanel();
  initFitIntro();
  // the title panel can be rebuilt, so its [迷宮に入る] is caught on the panel itself
  must(document.getElementById('intropanel'), 'タイトルの枠 #intropanel').addEventListener('click', (e) => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- 押された所は画面の部品（元の読み方のまま）
    if (!(e.target && (e.target as Element).closest && (e.target as Element).closest('#enter'))) return;
    const t0 = performance.now();
    sndInit();
    // oxlint-disable-next-line typescript/consistent-type-assertions -- シードの欄は buildIntroPanel が <input> で作る
    const sv = ((document.getElementById('seedIn') as HTMLInputElement).value || '').trim();
    let regen = false;
    if (/^[0-9]{1,10}$/.test(sv)) {
      const n = Number(sv) >>> 0;
      if (n !== adv.runSeed) {
        adv.runSeed = n;
        regen = true;
      }
    }
    if (ui.startDepth !== here.depth) {
      here.depth = ui.startDepth;
      regen = true;
    }
    if (regen) {
      here.branch = null;
      here.realm = null;
      here.inter = null;
    }
    fight.rains = [];
    fight.marks = [];
    fight.zones = [];
    fight.laters = [];
    adv.dead = false;
    {
      const de = document.getElementById('death');
      if (de) de.classList.remove('show', 'won');
    }
    adv.PLAYER_MAX = 40;
    adv.lvl = { n: 1, exp: 0, pending: 0, bless: {}, strata: new Set() };
    adv.runTrials = (saved.META.trials || []).filter((k) => unlocked('t_' + k));
    player.hp = adv.PLAYER_MAX;
    adv.runStats = { kills: 0, t0: clock.time, maxDepth: here.depth, book0: saved.BOOK.size, beastsNew: 0 };
    resetRunes();
    if (regen) newLevel();
    ui.started = true;
    document.body.classList.add('started');
    if (here.D) showStratum(here.D.stratum);
    if (ui.touch) touchTip();
    else {
      setHelp(true);
      ui.helpT = 25;
    }
    must(ui.introEl, 'タイトルの画面 #intro').classList.add('gone');
    must(gfx.canvas, '描く画面 gfx.canvas').focus();
    tryLock();
    updateResume();
    took('start', t0);
  });
}
// 指で遊ぶ時は、始めに操作の案内（キーボードの説明）を出さず、初めて指で迷宮に入った時だけ、左下の伝言に一言を出す（記録 META の touchTip で1回だけ。
// 階に入った時の伝言の後に出るよう、1.5秒待つ）
function touchTip(): void {
  if (saved.META.touchTip) return;
  saved.META.touchTip = true;
  saveMeta();
  setTimeout(() => msg('<b style="color:#bfe4ff">?</b>左半分で動く・右半分で見回す。くわしくはメニューの「操作の案内」'), 1500);
}
