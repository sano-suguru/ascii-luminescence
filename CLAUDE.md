# ASCII LUMINESCENCE — Claude Code 向けの作業メモ

ブラウザで動く、1人称3DのASCIIローグライト（Three.js r147、UIは日本語）。
設計の全体は `docs/DESIGN.md` を読むこと。

## 言葉と進め方（大事）
- **ユーザーへの返事は、いつも日本語**。質問が英語でも日本語で返す（英語に滑ると、ユーザーから直される）。
- ゲーム内の文言も日本語。名前は**素朴で自然な日本語や慣用句**にする。凝った言い回し・中二病っぽい名前・英語の直訳は避ける。
- 新しい仕組みは、**作る前に案（表やスケッチ）を出して、合意を取ってから**作る。
- 作った後は、「変わったこと」「確かめたこと」「見てほしい点」を報告する。
- 見た目の確認は、**画面写真を元の大きさで1枚ずつ見る**。縮小した一覧だけで判断しない（過去に見落としがあった）。
- ほかのゲームの仕組みを聞かれたら、推測せず、調べて（Web検索）から答える。
- テスト環境だけの問題（フォントの幅、遅さ、タイムアウト）は、テスト側の問題だと伝える。

## ファイル
```
src/head.html        画面の作りとCSS（three.js を CDN から読む <script> を含む）
src/game.js          ゲーム本体（約7,500行、1ファイル）
tools/build.mjs      src から dist/index.html を組み立てる（--test でオフラインのテスト用）
tools/serve.mjs      静的ファイルの小さなサーバー
tests/lib.mjs        テストの共通部分（組み立て・配信・ブラウザ・テスト用モードのページ）
tests/smoke.mjs      ふだんのページの起動 ＋ 開発用の冒険で dbg が動くか（画面写真は tests/out/）
tests/determinism.mjs  同じシードで同じ結果になるか
tests/levels.mjs     全部の階（20シード×30か所）を生成し、例外と、歩いて行けるかを確かめる
tests/visual.mjs     画面写真の比較（10場面。基準は tests/baseline/）
eslint.config.js     lint の設定（エラー＝不具合、警告＝整理の候補）
wrangler.jsonc       Cloudflare Workers（静的アセット）の設定。公開は dist/
.claude/settings.json  権限と hooks
.github/workflows/ci.yml  確かめるだけの CI（lint・組み立て・スモークテスト）
docs/DESIGN.md       設計の全体、決めた方針、残っている課題
```
`dist/index.html` = `head.html` + `<script>` + `game.js` + `</script></body></html>`。
`dist/` と `.build/` は生成物なので git に入れない。直接編集もしない（権限で止めている）。

## 組み立て・実行・テスト（Node 22）
```
npm install           # 依存を入れる（クラウドのセッションでは SessionStart hook が自動で行う）
npm run check         # 構文 + lint（エラーだけ） + 組み立て。数秒。編集のたびにこれ
npm run lint          # 警告も含めて lint を見る
npm test              # スモーク・同じ結果・全部の階（オフラインで動く。40秒ほど）
npm run test:visual   # 画面写真の比較（30秒ほど）。違えば tests/out/visual/ に違いの画像
node tests/visual.mjs --update [--only 場面]   # 基準の画像を作り直す（見た目を意図して変えた時だけ）
node tests/levels.mjs --seed 202               # 1つのシードだけ（--seeds 100 で数を変える）
node tests/smoke.mjs --cdn                     # 公開用と同じく CDN の three.js と Google Fonts で起動
npm run verify        # check + test + test:visual
npm run serve         # dist/ を組み立てて http://127.0.0.1:8000/ で配信
npm run deploy        # 手元から Cloudflare に公開（ふだんは Workers Builds が git から公開する）
```
- ヘッドレスのChromiumは、`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` で動く。
  とても遅い（960x540で1秒に1フレームくらい）。**テストはテスト用モードで書き、実時間では待たない**。
  画面写真には `timeout: 90000` を付ける。
- テスト版（`build --test`）は、three.js とフォント（@fontsource）を node_modules から読む。Google Fonts は読まない。
  テストのブラウザには、システムのフォントを見せない（`tests/fonts.conf`、最後の頼みは npm の DejaVu だけ）。
  JetBrains Mono を指定した所の日本語は、ふだんはシステムの日本語フォントで描かれるが、テスト版では M PLUS 1 Code
  （全角の ！？ などは BIZ UDGothic）を組み合わせて描く（`tools/build.mjs` の `cjkFallback`）。マシンが違っても同じ画素になる。
- ポインタロックは、テストでは `HTMLCanvasElement.prototype.requestPointerLock` を差し替えて止める（tests/lib.mjs）。
- Playwright は 1.63.0 に固定（クラウド環境の /opt/pw-browsers の Chromium と版を合わせている）。上げる時はそろえること。

## テスト用モード（`?test=1`）
同じ手順なら、いつも同じ結果になるモード。開発用モードも含む（`seed=`・`depth=`・`god=1` などがそのまま使える）。
ふだんの遊びには影響しない（game.js の先頭の `TEST` で分けている）。
- `Math.random` はシードで決まる。時計（`performance.now`・`setTimeout`・`setInterval`）は、ゲームが進む時だけ進む。
- ゲームは自分では進まない。`__test.advance(秒)`（描かずに進める。速い）か `__test.frames(n)`（描いて進める）で進める。1フレーム＝ゲームの1/30秒。
- `window.__test`：`ready()`、`error()`、`advance(秒)`、`frames(n)`、`state()`（体力・位置・敵・飛ぶ物・溜め・切り替え など）、
  `equip(手, 武器)`（例：`equip('L','bolt')`）、`press(手)`・`release(手)`（ボタンを押す・離す）、`places()`、`gen(シード, 場所)`（生成だけ。描画の状態を壊すので専用のページで）
- 気をつけること：
  - 溜めている間は、ゲームの時間が半分の速さで進む。ヒットストップ中は1/20。
  - 階に入ると、約1.25秒かけて明るくなる。写す前に `advance(2)` する。
  - CSS のアニメーション（タイトルが消える、など）は実時間で進む。画面写真の比較では止めている（`newPage(…, {still:true})`）。
  - `let`/`const` の変数は `window` から見えない。テストに必要な物は `__test` に足す（HTMLに差し込む昔のやり方は使わない）。

## 自動の確かめ（hooks、.claude/settings.json）
- **編集の直後**（PostToolUse）：`src/` などの JS を編集すると、構文と lint を確かめる。エラーなら差し戻されるので、その場で直す。
- **終える前**（Stop）：`src/`・`tools/`・`tests/`・設定が変わっていれば `npm run check` を通す。通らなければ終われない。
- **セッションの始め**（SessionStart、クラウドのみ）：依存が変わっていれば `npm install`。
- 権限：`npm run`・lint・git の読み取り・commit・push・ブランチの切り替えは確認なし。
  公開（`npm run deploy`・wrangler）・`rm -rf`・`git reset --hard`・`git clean`・変更を捨てる `git checkout` は確認あり。
  force push（`+ブランチ` の形も）・リモートのブランチの削除、`dist/` と `package-lock.json` の直接編集、`.env`・`.dev.vars` を読むことは禁止。
  ただし権限は文字列の一致で見るだけなので、完全な安全柵ではない（別の書き方ならすり抜けうる）。
- テストは遅めなので hooks では走らせない。動きに関わる変更の後は `npm test`、見た目に関わる変更の後は `npm run test:visual` を自分で走らせる。
  画面写真の比較が違ったら、違いの画像を元の大きさで見てから、意図した変更なら `--update` で作り直す（作り直しはコミットを分ける）。

## 開発用の道具
**URLの指定**：`?dev=1`（開発用モード：すべて解放済み、dbg が使える）、`seed=`、`depth=`、`god=1`、
`branch=`、`realm=`、`to=`、`give=`、`reveal=`

**dbg（F2の画面と window.dbg）**：
`dbg.help()`、`info()`、`go(深度)`、`inter(key)`（地下の町 town / 大広間 bigroom / 神託所 oracle / 砦 fortress）、
`branch(key,階)`、`realm(key)`、
`to("stairs"|"branch"|"portal"|"lord"|"altar"|"vault"|"hub"|"spring"|"forge")`、`god(on)`、`heal()`、`reveal()`、
`give("slot"|"body"|"runes"|"legends")`、`kill("lord"|"near")`、`open()`、`step(x,z)`、`look(x,y,z)`、`items()`、`clear()`、
`hurt(n)`、`hit(n)`、`hp()`、`exp(n)`（経験）、`lore(n)`（伝承）

**タイトルのボタン**：`#galB`（図鑑）、`#galR`（試しの間：見つけた武器とルーン、特性Lv3/Lv5の武器、起き上がる的）、`#unlockB`（解放）

## 保存データ（localStorage）
`al_meta`（伝承・解放・墓・試練）、`al_book`（魔導書：記した反応）、`al_beasts`（忘れられた獣）、
`al_runes`（見たルーン）、`al_seen`（見た生き物）、`al_cam`（1人称/3人称）、`al_dev`（開発用モード）

## game.js の地図（行番号はおおよそ。`// -----` の見出しで探す）
| 行 | 中身 |
|---|---|
| 63 | 定数（RUNE_DEF、RUNE_TYPES、TRAITS/TRAIT_V、MSTAT など） |
| 326 | 迷宮の生成（generate、部屋、交差点、支道、層ごとの大きさ） |
| 527 | 歴史と碑文 |
| 1516–1849 | 描画（シェーダー、文字の図鑑、dyn、粒子） |
| 1849 | 世界の状態 |
| 2429–3744 | 生き物の形（主、忘れられた獣、各種の体） |
| 3744–4146 | 小さな生き物、群れ、大きな生き物、主 |
| 4146–4860 | 灯り、備品、扉、音、ガス、火、粒子の更新 |
| 4860 | 視界とミニマップ |
| 5004 | 段階D：伝承・解放・墓・試練（META、UNLOCKS、weaponPool、trialOn） |
| 5125 | 階の切り替え（newLevel） |
| 5256–5436 | 生と死、レベルアップ（BLESS、gainExp、levelChoices、openLevelUp） |
| 5436 | 手元の武器（VM_MODELS、drawViewWeapons、vmGlyph） |
| 5535 | ルーン、両手持ち（effHand、atkType、equipWeapon、canPutAt、specOf） |
| 5707 | 詠唱（beginCast、castNow、meleeCast、fireWave、dashCast、castStar、startRain、castRapid） |
| 5872 | 当たり・性質・反応（applyHit、react、hitReact） |
| 5957 | 飛ぶ物（updateProjs、drawWave、moonBurst） |
| 6058–6164 | ルーンの手に入れ方、祭壇（altarFill、forgeOptions、placeAltar、mainPathAltars） |
| 6164 | 回復（取り戻せる傷、泉） |
| 6360 | 方向の矢印 |
| 6532 | デバッグ（dbg） |
| 6596–6758 | 目的（伝説の物、最深部、王の影）、タイトルへ戻る |
| 6803 | 図鑑、試しの間 |
| 6995–7169 | 装備の画面（renderInv、packSlot、ビルド）、祭壇の画面（renderAltar） |
| 7285 | 見た時の説明（look） |
| 7434 | メインループ（frame）、7474 初期化 |
結果の画面は `die()` / `victory()` / `newRun()`、タイトルは `buildIntroPanel()` / `buildUnlockPanel()`。

## 落とし穴（過去に踏んだもの）
- **宣言の順番（TDZ）**：`buildIntroPanel()` はスクリプトの途中で呼ばれる。そこで使う `let`/`const`（META など）は、
  それより前で宣言すること。`DEVALL` は後で宣言されるので、`devAllSafe()` 経由で読む。
- **lint の警告**：使っていない関数・変数が約60か所ある（古い仕組みの残り）。消す時は、図鑑や dbg から文字列で呼ばれていないか確かめる。
- **sed の区切り文字**：差し込む文に `|`（`||` など）があると壊れる。置き換えは Python で行う方が安全。
- **/bin/sh**：`mkdir -p a/{b,c}` は展開されない。
- **乱数とシフト**：32bitの値を `>>` で右シフトすると負になりうる。符号なしにしたい時は `>>>`。
- **手元の武器**：dyn の文字は世界の中に描くので、壁に沈みうる（壁が近い時は、目に向かって相似に縮めている）。
  斜めの線の文字は、奥行きを割った「画面での傾き」で選ぶ（vmGlyphS）。
- **右上のミニマップ**：画面の右上3分の1を覆う。手元の武器の頭や刃先を、そこに入れない。
- **開発用モード**：すべて解放済みになるので、解放の確かめは `al_dev` を `0` にして行う。
- **祭壇の画面**：プレイヤーが閉じると、離れて戻るまで開かない。選ぶと、ほかの選択肢は消える。
