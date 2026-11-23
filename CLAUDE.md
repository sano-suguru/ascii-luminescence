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
src/index.html       画面の作りとCSS（Vite の入口。three.js を CDN から読む <script> を含む）
src/main.js          ページの入口のモジュール（ゲーム本体 virtual:legacy-game を読むだけ）
src/game/*.js        ゲーム本体の古い JS（31ファイル、合わせて約7,500行。下の「ゲーム本体の地図」）
src/game/imports.mjs ゲーム本体が使う TypeScript のモジュールを読む import の文（包みの関数の前に置かれる）
src/lib/*.ts         TypeScript に移した物（rng：乱数と clamp、text：パネルの文字の幅と枠、history：年代記）。厳しい型で確かめ、整形もする
tsconfig.json        TypeScript 7 の設定（strict・noUncheckedIndexedAccess・exactOptionalPropertyTypes など）。対象は src/lib/ と tests/unit/*.ts
vite.config.mjs      組み立て（Vite 8）。公開用は dist/、テスト用（--mode test）は .build/test/
tools/vite-plugins.mjs  Vite のプラグイン：legacyGame（src/game をつないで1つのモジュールに）・testPage（テスト版）・privateMaps（ソースマップを公開物の外へ）・noCssStub（ページの <style> の空の部品を消す）
tools/game-source.mjs   ゲーム本体をつなぐ処理（gameSource）・行の対応・ソースマップ・テスト版のフォント
tools/sourcemap.mjs  ソースマップの読み書き（自前の小さな道具）
tools/lint-game.mjs  src/game/ をつないで構文と lint を調べ、場所を元のファイルの行で出す
tools/where.mjs      組み立てた JS の場所 → src/game/ のどのファイルの何行目か（ソースマップで戻す）
tools/map.mjs        ゲーム本体の地図（ファイルごとの行の数と見出し）
tools/serve.mjs      静的ファイルの小さなサーバー
tests/lib.mjs        テストの共通部分（組み立て・配信・ブラウザ・テスト用モードのページ）
tests/smoke.mjs      ふだんのページの起動 ＋ 開発用の冒険で dbg が動くか（画面写真は tests/out/）
tests/determinism.mjs  同じシードで同じ結果になるか
tests/levels.mjs     全部の階（20シード×30か所）を生成し、例外と、歩いて行けるかを確かめる
tests/visual.mjs     画面写真の比較（12場面。基準は tests/baseline/）
tests/panels.mjs     枠のテスト（全部の文字の幅が visW どおりか、操作・装備・メニュー・レベルアップ・祭壇・結果の縦線と、一覧の名前の列が揃うか）
tests/glyphs.mjs     使う文字が、パネルのフォント（M PLUS 1 Code ＋ BIZ UDGothic の補い）で描けるか（ブラウザ不要）
.oxlintrc.json       lint（Oxlint）の設定（エラー＝不具合、警告＝整理の候補）
.oxfmtrc.json        整形（Oxfmt）の設定。src/game/（古い JS）と index.html 以外。古い JS はまとめては整形しない（行が約4倍になる）。TypeScript に移した物から整形する
vitest.config.mjs    単体テスト（Vitest）の設定。テストは tests/unit/*.test.{mjs,ts}
package.json         スクリプトと依存。packageManager で pnpm の版を固定（pnpm@12.22.0）
pnpm-workspace.yaml  pnpm のサプライチェーン対策（公開24時間未満は入れない、信頼の低下を拒む、インストール時のスクリプトは承認制）
.node-version        Node の版（26.13.1）。CI・SessionStart hook・Cloudflare が読む
wrangler.jsonc       Cloudflare Workers（静的アセット）の設定。公開は dist/
.claude/settings.json  権限と hooks
.github/workflows/ci.yml  確かめるだけの CI（check・test・画面写真の比較。どれも違えば失敗）
.github/workflows/dependency-review.yml  PR で増える依存の脆弱性とライセンス
.github/workflows/codeql.yml  CodeQL（JavaScript の静的解析。PR と毎週）
.github/dependabot.yml  依存の更新の PR（Dependabot。毎週。公開から1日たった版だけ。three.js と Playwright は手で上げる）
docs/DESIGN.md       設計の全体、決めた方針、残っている課題
```
組み立ては Vite 8。`src/game/imports.mjs`（import の文）の後ろに、`src/game/*.js` を名前の順につなぎ、`(function(){ 'use strict'; … })();` で
包んだものを置いて、1つのモジュール（`virtual:legacy-game`）にする（`tools/vite-plugins.mjs` の legacyGame）。公開物は `dist/index.html` と `dist/assets/index-<hash>.js`。
- Vite（Rolldown）は JS を書き直して出す（字下げ・引用符・`undefined`→`void 0` など。縮めはしない。コメントは消える）。なので、組み立てた JS の行は元のファイルと違う。
  場所はソースマップで戻す。ソースマップは**公開しない**ので、出力には残さず `.build/maps/<mode>/` に移している（privateMaps）。
- 開発用サーバー（`pnpm dev`）は、src/game/ が変わるとページを読み直す（HMR はしない）。テスト用モード（`?test=1`）は時計が止まっていて
  Vite の読み直し（setTimeout を使う）が動かないので、開発用サーバーの時だけ、ゲーム本体の後ろに「すぐ読み直す」処理を足している（legacyGame）。
- 使っていない関数も消さない（`vite.config.mjs` の `rolldownOptions`。Vite は minify: false でも、使っていないコードを消す設定を渡すため）。
`dist/` と `.build/` は生成物なので git に入れない。直接編集もしない（権限で止めている）。

## 組み立て・実行・テスト（Node 26・pnpm 12）
```
pnpm install --frozen-lockfile   # 依存を入れる（クラウドのセッションでは SessionStart hook が Node・pnpm ごと自動で行う）
pnpm check            # 構文 + lint（エラーだけ。型の情報も使う） + 型（tsc） + 整形の確かめ + 単体テスト（Vite の組み立ても試す） + 使う文字 + 組み立て。数秒。編集のたびにこれ
pnpm lint             # 警告も含めて lint を見る（src/game/ はつないで調べる）
pnpm fmt              # 整形する（Oxfmt。src/game/ の古い JS と index.html 以外）
pnpm typecheck        # 型を確かめる（TypeScript 7 の tsc。src/lib/ と tests/unit/*.ts。1秒かからない）
pnpm test:unit        # 単体テスト（Vitest。tests/unit/）
pnpm map [語]         # ゲーム本体の地図。語を付けると、見出しにその語を含むファイルだけ（例：pnpm map fire）
pnpm where index-D0mETEmY.js:4321:12   # 組み立てた JS のその場所が、src/game/ のどこか（行だけも可。--test でテスト版）
pnpm test             # スモーク・同じ結果・全部の階・枠（オフラインで動く。40秒ほど）
pnpm test:visual      # 画面写真の比較（30秒ほど）。違えば tests/out/visual/ に違いの画像
node tests/visual.mjs --update [--only 場面]   # 基準の画像を作り直す（見た目を意図して変えた時だけ）
node tests/levels.mjs --seed 202               # 1つのシードだけ（--seeds 100 で数を変える）
node tests/smoke.mjs --cdn                     # 公開用と同じく CDN の three.js と Google Fonts で起動
pnpm verify           # check + test + test:visual
pnpm dev              # Vite の開発用サーバー（http://localhost:5173/。src/game/ を変えると読み直す）
pnpm build            # 公開用を dist/ に組み立てる（pnpm build:test でテスト用を .build/test/ に）
pnpm serve            # dist/ を組み立てて http://127.0.0.1:8000/ で配信
pnpm run deploy       # 手元から Cloudflare に公開（ふだんは Workers Builds が git から公開する）。pnpm deploy は pnpm 組み込みの別のコマンドなので使わない
```
- **依存を足す・上げる時**：`pnpm add -D --save-exact 名前@版`（確認が出る）。公開から24時間未満の版は入らない（pnpm-workspace.yaml）。
  インストール時にスクリプトを動かす依存は、中身を確かめてから `pnpm approve-builds` で許可する。npm で入れない（権限で止めている）。
- **依存の更新（Dependabot）**：毎週月曜に PR が来る（npm と GitHub Actions。公開から1日たった版だけ）。自動マージはしない。
  - three.js と Playwright は minor 以上を止めている（patch とセキュリティの更新は来る）。Playwright の patch は、中の Chromium の版が
    変わっていないか確かめてからマージする。minor 以上は手で上げる（上の Playwright の項）。
  - Dependabot は自分の pnpm で lockfile を作る。pnpm 12 や保護の設定に合わない lockfile は、CI の `pnpm install --frozen-lockfile` が止める
    （lockfile の中の依存の公開日なども確かめ直す）。Dependabot の処理そのものの失敗は PR にならず、GitHub の Insights → Dependency graph →
    Dependabot にしか出ないので、PR が長く来ない時はそこを見る。
  - **pnpm（`package.json` の `packageManager`）と Node（`.node-version`）は Dependabot では上がらない**。手で上げる：
    新しい版が公開から24時間以上たっていることを確かめ、版を書き換えて `pnpm install`（Node は SessionStart hook が入れ直す）、
    `pnpm verify` を通してから、専用のコミットにする。CI（setup-node・pnpm/action-setup）も同じ版を読む。
  - ワークフローのアクションは、コミットのハッシュで固定する（`uses: owner/name@<40文字> # vX.Y.Z`）。`pnpm check` の単体テストが確かめる。
- ヘッドレスのChromiumは、`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` で動く。
  とても遅い（960x540で1秒に1フレームくらい）。**テストはテスト用モードで書き、実時間では待たない**。
  例外は、スモークテストの「ふだんのページが描けるか」の確認だけ（テスト用モードではないので、ゲームを止めて進められない）。
  画面写真には `timeout: 90000` を付ける。
- テスト版（`vite build --mode test`。テストが自分で組み立てる）は、three.js とフォント（@fontsource）を node_modules から読む。Google Fonts は読まない。
  テストのブラウザには、システムのフォントを見せない（`tests/fonts.conf`、最後の頼みは npm パッケージの DejaVu だけ）。
  JetBrains Mono を指定した所の日本語は、ふだんはシステムの日本語フォントで描かれるが、テスト版では M PLUS 1 Code
  （全角の ！？ などは BIZ UDGothic）を組み合わせて描く（`tools/game-source.mjs` の `cjkFallback`）。マシンが違っても同じ画素になる。
- ポインタロックは、テストでは `HTMLCanvasElement.prototype.requestPointerLock` を差し替えて止める（tests/lib.mjs）。
- Playwright は 1.63.0 に固定（クラウド環境の /opt/pw-browsers の Chromium と版を合わせている）。上げる時はそろえること。
  上げると描き方が少し変わりうるので、`pnpm test:visual` が落ちたら、違いの画像を見てから基準を作り直す（コミットを分ける）。
- CI では画面写真の比較も失敗にする。CI とクラウド環境の差は数画素（0.01%以下）で、失敗の基準は0.2%。

## TypeScript に移す（段階6で少しずつ）
古い JS（src/game/）の関数を、1つずつ src/lib/*.ts に移す。動きを変えないことが一番大事。
1. src/lib/ に、型を付けて書き直す（`export` する）。古い JS の外の名前に頼る物（`rand`・`D` など、ゲームの状態）は、まだ移さない。
2. `src/game/imports.mjs` に import を足し、src/game/ から元の定義を消す（「〜は src/lib/xx.ts」と1行残す）。
   消し忘れると、包みの中の古い定義が import を黙って隠す。lint-game（pnpm check と編集直後の hook）が、読んだ名前の宣言をエラーにして止める。
3. 移す前の実装と、たくさんの入力で同じ結果になることを確かめる（Node 26 は .ts をそのまま動かせる。古い関数は git の版から取り出す）。
   乱数を引く順番を変えると、同じシードで違う結果になる。移す前の値を、単体テスト（tests/unit/*.test.ts）に残す。
4. `pnpm fmt`・`pnpm check`・`pnpm test`・`pnpm test:visual`（画素まで同じはず）。
- 型を外すだけで組み立てる（Vite）。enum・namespace など、型を外すだけでは動かない書き方は使わない（`erasableSyntaxOnly`）。
- import は `.ts` まで書く（`./rng.ts`）。`noUncheckedIndexedAccess` なので、配列の要素は `undefined` かもしれない物として扱う。
- 文字を調べるテスト（使う文字・文字の幅）は、src/lib/*.ts の文も見る（`gameText`）。コメントの文字も調べるので、フォントに無い文字（＝ など）は
  コメントにも書かない（落ちた時は、場所と「コメント」の印が出る）。

## テスト用モード（`?test=1`）
同じ手順なら、いつも同じ結果になるモード。開発用モードも含む（`seed=`・`depth=`・`god=1` などがそのまま使える）。
ふだんの遊びには影響しない（`src/game/00-test-mode.js` の `TEST` で分けている）。
- `Math.random` はシードで決まる。時計（`performance.now`・`setTimeout`・`setInterval`）は、ゲームが進む時だけ進む。
- ゲームは自分では進まない。`__test.advance(秒)`（描かずに進める。速い）か `__test.frames(n)`（描いて進める）で進める。1フレーム＝ゲームの1/30秒。
- `window.__test`：`ready()`、`error()`、`advance(秒)`、`frames(n)`、`state()`（体力・位置・敵・飛ぶ物・溜め・切り替え など）、
  `equip(手, 武器)`（例：`equip('L','bolt')`）、`bless(n)`（全部の加護を n 段目にする）、`width(文字列)`（visW）、`press(手)`・`release(手)`（ボタンを押す・離す）、`places()`、`gen(シード, 場所)`（生成だけ。描画の状態を壊すので専用のページで）
- 気をつけること：
  - 溜めている間は、ゲームの時間が半分の速さで進む。ヒットストップ中は1/20。
  - 階に入ると、約1.25秒かけて明るくなる。写す前に `advance(2)` する。
  - CSS のアニメーション（タイトルが消える、など）は実時間で進む。画面写真の比較では止めている（`newPage(…, {still:true})`）。
  - `let`/`const` の変数は `window` から見えない。テストに必要な物は `__test` に足す（HTMLに差し込む昔のやり方は使わない）。
  - 祭壇の画面は、祭壇から1.5以内でないと開かない（`dbg.to('altar')` は2マス手前）。tests/lib.mjs の `nearAltar(pg)` を使う。
  - パネルの文字の幅を測る時は、`document.fonts.ready` を待つ（文字の範囲ごとのフォントは、使う時に読まれる）。

## 自動の確かめ（hooks、.claude/settings.json）
- **編集の直後**（PostToolUse）：`src/` などの JS を編集すると、構文と lint を確かめる（`src/game/` は全部をつないで調べる）。TypeScript は型（tsc）と、型の情報を使う lint。エラーなら差し戻されるので、その場で直す。
- **終える前**（Stop）：`src/`・`tools/`・`tests/`・設定が変わっていれば `pnpm check` を通す。通らなければ終われない。
- **セッションの始め**（SessionStart、クラウドのみ）：.node-version の Node と packageManager の pnpm を用意し（~/.cache）、依存が変わっていれば `pnpm install --frozen-lockfile`。
- 権限：`pnpm` のスクリプト（check・lint・test など）・git の読み取り・commit・push・ブランチの切り替えは確認なし。
  依存の追加と更新（`pnpm add`・`pnpm update`・`pnpm approve-builds`・`pnpm dlx`）・公開（`pnpm run deploy`・wrangler）・`rm -rf`・`git reset --hard`・`git clean`・変更を捨てる `git checkout` は確認あり。
  force push（`+ブランチ` の形も）・リモートのブランチの削除、npm での依存のインストール、`dist/` と `pnpm-lock.yaml` の直接編集、`.env`・`.dev.vars` を読むことは禁止。
  ただし権限は文字列の一致で見るだけなので、完全な安全柵ではない（別の書き方ならすり抜けうる）。
- テストは遅めなので hooks では走らせない。動きに関わる変更の後は `pnpm test`、見た目に関わる変更の後は `pnpm test:visual` を自分で走らせる。
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

## ゲーム本体の地図（src/game/）
ファイルは名前の順につながる（後のファイルは、前のファイルの変数や関数を使える。トップレベルで実行する文は順番に気をつける）。
ファイル名は「2桁の番号-名前.js」（違う名前や、改行で終わらないファイルがあると、組み立てが止まる）。
細かい見出しと行は `pnpm map` で見る。ブラウザのエラーの場所は `pnpm where <JS:行:列>` で元のファイルに直す（テストのエラーには自動で付く）。
| ファイル | 中身 |
|---|---|
| 00-test-mode | テスト用モード（`TEST`、時計、乱数） |
| 01-title | タイトルのロゴ |
| 02-constants | 定数（層・支道・異界・特別な階、MTYPES など）、乱数と小さな道具（mr・rand。mulberry32・clamp は src/lib/rng.ts） |
| 03-vaults-history | 洞窟の形、宝物庫の絵（VAULTS）、歴史の飾り（makeHistory は src/lib/history.ts） |
| 04-generate | 迷宮の生成（levelDims、generate。1つの関数で約920行） |
| 05-renderer | 描画（シェーダー、水面、文字の図鑑、dyn、粒子の入れ物） |
| 06-world | 世界の状態（D・depth・monsters・player など）、世界の組み立て（buildWorld） |
| 07-bodies-lords | 生き物の形：忘れられた獣の型、トロル・ゴーレム、人型の見た目、主（不死の王、蜘蛛の女王、ナーガ、竜） |
| 08-bodies-shadow | 生き物の形：王の影、深みの主、機械 |
| 09-bodies-creatures | 生き物の形：小さな生き物、人型、オーガ、四つ足、大きな生き物、死者 |
| 10-bodies-beast | 忘れられた獣の組み立て（buildForm）、獣の記録 |
| 11-monster-move | 生き物を作る（makeMonster）、歩ける所（canStep）、行き先（chooseNext） |
| 12-hud-text | 忍び足と灯り、状態の表示（renderStatus）、操作・年代記の画面、物音（**パネルの文字の幅 visW と枠 boxText は src/lib/text.ts**） |
| 13-creatures | 小さな生き物、群れ、大きな生き物の動き（updateMonster）、描く（drawMonster） |
| 14-lights-fixtures | 灯り、備品、扉 |
| 15-sound-fire | 音、ガス、火、火花 |
| 16-view-input | 視界とミニマップ、伝言（msg）、当たり（solidAt）、入力の状態 |
| 17-meta | 段階D：伝承・解放・墓・試練（META、UNLOCKS、weaponPool、trialOn）、タイトルの画面（buildIntroPanel） |
| 18-level-player | 階の切り替え（newLevel）、罠、生き物の強さ（MSTAT）、生と死、レベルアップ（BLESS、levelChoices、lvlLine） |
| 19-hands-runes | 手元の武器（VM_MODELS、drawViewWeapons）、ルーンの定義（RUNE_DEF、TRAITS）、性質と反応 |
| 20-chant-hits | 詠唱（beginCast、castNow…）、当たり（applyHit）、反応、飛ぶ物 |
| 21-altars-heal | ルーンの手に入れ方、祭壇（altarFill、forgeOptions、mainPathAltars、altarLine）、回復、拾う |
| 22-world-hints | 先にある物の気配、方向の矢印、床のルーン、詠唱の見た目、照準 |
| 23-debug | デバッグ（dbg、F2 の画面、URL の指定） |
| 24-goal | 目的（伝説の物、最深部、王の影）、勝利、稲妻、タイトルへ戻る |
| 25-gallery | 見た物の記録、図鑑、試しの間 |
| 26-spells-hud | 術と世界（扉・氷・雷）、詠唱の声、下の HUD（renderHotbar）、止まっているか（isPaused） |
| 27-rune-screen | 装備の画面（renderInv、packSlot、equipWeapon、ビルド）、魔導書、メニュー（padTo・wrapPlain は src/lib/text.ts） |
| 28-camera-player | 1人称・3人称、プレイヤーの動き（updatePlayer）、空気（updateAtmosphere） |
| 29-look | 見た時の説明（look） |
| 30-loop-init | 大きさ、メインループ（frame・tick）、テスト用の `__test`、初期化（init） |
結果の画面は `die()` / `victory()` / `newRun()`、タイトルは `buildIntroPanel()` / `buildUnlockPanel()`。

## 落とし穴（過去に踏んだもの）
- **宣言の順番（TDZ）**：`buildIntroPanel()` はスクリプトの途中で呼ばれる。そこで使う `let`/`const`（META など）は、
  それより前で宣言すること。`DEVALL` は後で宣言されるので、`devAllSafe()` 経由で読む。
- **パネルの枠と文字の幅**：枠（boxText）は `visW` で幅を数えて縦線を揃える（どちらも src/lib/text.ts）。パネルのフォントは M PLUS 1 Code
  （半角1マス・全角2マス。ただし全角スペース「　」は1マス。なので、列を揃える時は全角スペースで埋めず、visW で数えた半角スペースで埋める）。M PLUS 1 Code に無い文字（← → ！：？［］）は、
  index.html で BIZ UDGothic をその文字だけ読んで補っている（全角2マス）。新しい記号を使う時は、M PLUS 1 Code にあるかを
  `pnpm check`（tests/glyphs.mjs）で確かめ、無ければ別の文字にするか、index.html の text= と visW に足す。
  Ⅱ などは、BIZ UDGothic にも無いので使わない（II にする）。
- **lint の警告**：使っていない関数・変数が約60か所ある（古い仕組みの残り）。消す時は、図鑑や dbg から文字列で呼ばれていないか確かめる。
- **sed の区切り文字**：差し込む文に `|`（`||` など）があると壊れる。置き換えは Python で行う方が安全。
- **/bin/sh**：`mkdir -p a/{b,c}` は展開されない。
- **乱数とシフト**：32bitの値を `>>` で右シフトすると負になりうる。符号なしにしたい時は `>>>`。
- **手元の武器**：dyn の文字は世界の中に描くので、壁に沈みうる（壁が近い時は、目に向かって相似に縮めている）。
  斜めの線の文字は、奥行きを割った「画面での傾き」で選ぶ（vmGlyphS）。
- **右上のミニマップ**：画面の右上3分の1を覆う。手元の武器の頭や刃先を、そこに入れない。
- **開発用モード**：すべて解放済みになるので、解放の確かめは `al_dev` を `0` にして行う。
- **祭壇の画面**：プレイヤーが閉じると、離れて戻るまで開かない。選ぶと、ほかの選択肢は消える。
