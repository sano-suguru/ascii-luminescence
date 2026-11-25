# ASCII LUMINESCENCE — Claude Code 向けの作業メモ

ブラウザで動く、1人称3DのASCIIローグライト（Three.js r147、UIは日本語）。
設計の全体は `docs/DESIGN.md` を読むこと。

## 言葉と進め方（大事）
- **ユーザーへの返事は、いつも日本語**。質問が英語でも日本語で返す。
- ゲーム内の文言も日本語。名前は**素朴で自然な日本語や慣用句**にする。凝った言い回し・中二病っぽい名前・英語の直訳は避ける。
- 新しい仕組みは、**作る前に案（表やスケッチ）を出して、合意を取ってから**作る。
- 作った後は、「変わったこと」「確かめたこと」「見てほしい点」を報告する。
  「自動のテストが無い」と書く時は、先にテストを足せないか考える。足せない時は、その理由と、どんな道具（`__test` に足す物など）があれば足せるかを書く。
- 見た目の確認は、**画面写真を元の大きさで1枚ずつ見る**。縮小した一覧だけで判断しない。
- ほかのゲームの仕組みを聞かれたら、推測せず、調べて（Web検索）から答える。
- テスト環境だけの問題（フォントの幅、遅さ、タイムアウト）は、テスト側の問題だと伝える。
- **ドキュメント（docs/・CLAUDE.md・コメント）には、今有効な仕様だけを書く**。仕様を変えたら、元の記載をその場で書き直すか消す。
  古い記載を残したまま、訂正・撤回・補足を書き足さない。重複や矛盾する記載は1つにまとめる。廃止した機能の説明は消す。
  変更の履歴は Git（コミットと PR）に書く。経緯や、やめたこと（とその理由）が今後の判断に要る時だけ、今の決まりとして書く。

## ファイル
```
src/index.html       画面の作りとCSS（Vite の入口）
src/main.js          ページの入口のモジュール（フォント（@fontsource の CSS）と、ゲーム本体 virtual:legacy-game を読む）
src/game/*.js        ゲーム本体の古い JS（31ファイル。下の「ゲーム本体の地図」）
src/game/imports.mjs ゲーム本体が使う TypeScript のモジュールを読む import の文（包みの関数の前に置かれる）
src/lib/*.ts         TypeScript に移した物。厳しい型で確かめ、整形もする
                     array：配列と表を読む nth・lookup・must（無ければその場で止まる。as の代わり）、rng：シードの乱数を作る mulberry32 と clamp、random：見た目の乱数 mr・mpick と迷宮の乱数 rand・R・RI・pick（入れ替えは setRand）と混ぜる shuffle、glyphs：文字の絵の表（アトラス）の番号 G と飾りの文字の並び、color：css・表の色を css にする cssOf・hsl2rgb、math：角度・稲妻の線など、
                     text：パネルの文字の幅と枠、history：年代記、world：迷宮の大きさ・タイル・液体と地面・支道と異界・深さごとの係数（depthProfile）と深さごとに順に使う霧の色（FOGS）・岩、
                     light：灯りの計算、runes：ルーンの定義 RUNE_DEF・性質の効き目 RES・特性・反応・手の枠・ルーンの名前と色と付けられるか（表だけに頼る物）、
                     gear：手と持ち物の処理（makeRune・randomRuneType・effHand・isTwo・canPutAt・武器を持つ equipWeapon・空いた枠 freeSlotFor・墓のルーン graveRune など。状態 gear に頼る物）、progress：経験・伝承・解放・加護 BLESS（表）と加護の段 BL、
                     unlocks：解放の確かめ（unlocked・lockedOf・weaponPool。状態 saved に頼る物）と試練（trialOn）、altars：祭壇とルーンを置く（階ごとに置く placeRunesForLevel・mainPathAltars、祭壇の中身 altarFill・番人・鍛え方・泉・石碑のそばか nearStele・祭壇の画面の1行と説明、拾ったルーンを手か袋に入れる takeRune）、
                     levels：階のシード levelSeed、monsters：生き物の処理（強さ statOf）、hands：手元の武器の文字、
                     creatures：生き物の表 MTYPES（探索の途中で種類が足される）と強さの表 MSTAT、
                     strata：層・テーマ・特別な階・支道と異界の中身・地形・群れ、noise：ノイズ（種は setNoiseSeed）、vaults：洞窟と宝物庫の絵、
                     shaders：描画のシェーダーのソースと、描画用の配列の大きさ、title：タイトルのロゴ、hud：表示の大きさ（ミニマップ・装備の画面など）、
                     names：名前と説明の表（見た時の説明・罠・伝説の物・図鑑の主）、sound：音の小さな表と道具、
                     audio：音を鳴らす（Web Audio。音の部品・効果音・まわりの音 sndUpdate。状態 SND に頼る物）、log：伝言 msg、hotbar：下の HUD renderHotbar、save：保存 saveSet・saveMeta、
                     redraw：まだ古い JS にある描き直し（装備の画面）を TypeScript から呼ぶ呼び口（古い JS が読み込みの時に本物を入れる）
src/lib/state.ts     ゲームの状態の入れ物（分野ごと：clock＝時計（ゲームの時刻 time）、blaze＝火と地面のマス（fire・fuel・burnt・scent・凍らせた水 frozen など）、fight＝戦い（飛ぶ物 projs・光線・毒の霧・魔法の場・遅れて起きること・雨・床の目印・ヒットストップ・稲妻など）、vfx＝揺れと光り、ui＝画面の開け閉め（started・camMode・invOpen・近くの祭壇 altarNear など）、adv＝今の探索（runSeed・lvl・dead など）、gear＝手と詠唱（hands・bag・castSt など）、here＝今いる場所と階の中身（D・depth・branch・monsters・見えたマス・部屋の出来事 events・川のマス riverCells など）、saved＝保存する記録（META・BOOK・RSEEN・SEEN・DEVALL と、今の探索の伝説の物 LEGEND）、player・placeMem・伝言の一覧 msgs・音 SND・忍び足 stealth・手元の灯り lantern・表示の数 hudInfo（今の階の見たマスの割合 explored）・押しているキー keys。古い JS は clock.time・vfx.shake・ui.started のように欄で読み書きする。player から keys までは丸ごと入れ替えないので名前のまま）
src/lib/generate.ts  迷宮の生成（generateLevel。「入力 → 結果」の形。入力 GenInput・古い JS の物 GenEnv・結果 GenResult と、部屋 Room などの型）
src/lib/bodies/*.ts  生き物の形（kit：点の型と道具 q2・q3、small・beasts・lords：各生き物の形、bosses：主の形（不死の王・蜘蛛の女王・ナーガの女王・古竜・王の影の二つ目の姿））
tsconfig.json        TypeScript 7 の設定（strict・noUncheckedIndexedAccess・exactOptionalPropertyTypes など）。対象は src/lib/ と tests/unit/*.ts
vite.config.mjs      組み立て（Vite 8）。公開用は dist/、テスト用（--mode test）は .build/test/
tools/vite-plugins.mjs  Vite のプラグイン：legacyGame（src/game をつないで1つのモジュールに）・testPage（テスト版）・privateMaps（ソースマップを公開物の外へ）・noCssStub（ページの <style> から作られる空のモジュールを消す）・fontCss（@fontsource の CSS を絞る：woff を外し、BIZ UDGothic は BIZ_CHARS を含む面だけ）
tools/game-source.mjs   ゲーム本体をつなぐ処理（gameSource）・行の対応・ソースマップ・テスト版のフォント
tools/sourcemap.mjs  ソースマップの読み書き（自前の小さな道具）
tools/lint-game.mjs  src/game/ をつないで構文と lint を調べ、場所を元のファイルの行で出す（読んだ名前の宣言し直しと、状態の入れ物の名前の宣言も止める。入れ物の名前は src/lib/state.ts の export から取る）
tools/state-move.mjs 状態を入れ物に移す道具：古い JS の一番外の状態を、src/lib/state.ts の入れ物の欄に移す書き換え（名前の見分けは eslint-scope）。単体テストは tests/unit/state-move.test.mjs（小さな見本で確かめる）
tools/legacy-eval.mjs  テストの道具：古い JS のトップレベルの宣言を名前で取り出して評価する（移す前の古い関数を取り出して、新しい関数と結果を比べる。まだ古い JS にある関数を単体テストで本物のまま使う。型は .d.mts）
tools/where.mjs      組み立てた JS の場所 → src/game/ のどのファイルの何行目か（ソースマップで戻す）
tools/map.mjs        ゲーム本体の地図（ファイルごとの行の数と見出し）
tools/serve.mjs      静的ファイルの小さなサーバー
tools/shots.mjs      図鑑の生き物を、見やすい角度で写す（pnpm shots。向き・寄る引く・見下ろす角度は形ごとの表。写真は tests/out/shots/）
tests/lib.mjs        テストの共通部分（組み立て・配信・ブラウザ・テスト用モードのページ）
tests/smoke.mjs      テスト用モードでない時に、タイトルの画面が出るか ＋ 開発用の探索で dbg が動くか ＋ 探索の始め直しで前の場所や状態が残らないか ＋ メニューの「もう一度押して確かめる」待ちが4秒で消えるか ＋ 図鑑を開いても探索の記録が変わらないか ＋ 開発用モードのまま読み直した時・保存が使えない時のタイトル ＋ 閉じた祭壇の画面が、装備の画面やメニューを開いて閉じても、離れるまで開かないか ＋ 図鑑の全部の生き物を立つ・歩く・眠るの姿で出して、例外・描いた文字の数・NaN を確かめる（画面写真は tests/out/）
tests/world.mjs      世界とのやり取り：扉・火・氷と冷気・小さな生き物（修復機・清掃機・猟犬）がマスや扉を変える処理（扉が視界を遮る・燃え尽きる・修復機が作り直す、階に残る物が階を移ると消える、猟犬が匂いの無いマスを追わない、硫黄・氷・冷気と火）。生き物は全部消してから、要る物だけ置く
tests/determinism.mjs  同じシードで同じ結果になるか
tests/levels.mjs     全部の階（20シード×30か所）をブラウザで生成し、例外と、歩いて行けるかを確かめる
tests/reach.mjs      歩いて行けるかの調べ方（levels.mjs と tests/unit/reach.test.ts が使う。型は reach.d.mts）
tests/visual.mjs     画面写真の比較（12場面。基準は tests/baseline/）
tests/panels.mjs     枠のテスト（全部の文字の幅が visW どおりか、操作・装備・メニュー・レベルアップ・祭壇・結果の縦線と、一覧の名前の列が揃うか）
tests/unit/generate.test.ts  迷宮の生成の単体テスト（同じ入力なら同じ迷宮・生き物の表に書き込まない・全部の場所の指紋。Node で数秒）。
                     歩いて行けるか（5シード）は reach.test.ts（ファイルを分けて、並べて走らせる）。共通部分（全部の場所・gen）は gen-places.ts
tests/unit/altars.test.mjs  祭壇とルーンを置く処理の単体テスト。たくさんの場合を作る altar-cases.mjs（テストの中で小さな階を作る）を使う
tests/unit/place.test.ts  階ごとに祭壇とルーンを置く処理と、階のシード・生き物の強さ・墓のルーン・試練の単体テスト。たくさんの場合を作る place-cases.ts（Node で本物の迷宮を生成する。
                     迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/ui.test.mjs  伝言・下の HUD・手の枠・保存・ルーンの説明・拾ったルーンを入れる処理の単体テスト。偽の画面の部品と偽の localStorage で、
                     たくさんの場合を作る ui-cases.mjs を使う
tests/unit/audio.test.mjs  音を鳴らす処理の単体テスト。偽の Web Audio（fake-audio.mjs。作った部品・値・つなぎ方・鳴らす時刻を全部記録する。Node には Web Audio が無い）と、
                     たくさんの場合を作る audio-cases.mjs を使う
tests/glyphs.mjs     使う文字が、パネルのフォント（M PLUS 1 Code ＋ BIZ UDGothic の補い）に字形があるか（ブラウザ不要）
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
.github/dependabot.yml  依存の更新の PR（Dependabot。毎週。公開から1日たった版だけ。three.js と Playwright は minor 以上を手で上げる）
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
pnpm test             # スモーク・世界とのやり取り・同じ結果・全部の階・枠（オフラインで動く。40秒ほど）
pnpm test:visual      # 画面写真の比較（30秒ほど）。違えば tests/out/visual/ に違いの画像
pnpm shots [名前…]    # 図鑑の生き物を見やすい角度で写す（既定は竜・主たちの12枚（tools/shots.mjs の PICK）。--all で全部、--bare で図鑑の枠を隠す、--out で置き場所）
node tests/visual.mjs --update [--only 場面]   # 基準の画像を作り直す（見た目を意図して変えた時だけ）
node tests/levels.mjs --seed 202               # 1つのシードだけ（--seeds 100 で数を変える）
node tests/smoke.mjs --prod                    # 公開用の版（dist/）で起動（JetBrains Mono の所の日本語はシステムのフォント）
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
    変わっていないか確かめてからマージする。minor 以上は手で上げる（下の Playwright の項）。
  - Dependabot は自分の pnpm で lockfile を作る。pnpm 12 や保護の設定に合わない lockfile は、CI の `pnpm install --frozen-lockfile` が止める
    （lockfile の中の依存の公開日なども確かめ直す）。Dependabot の処理そのものの失敗は PR にならず、GitHub の Insights → Dependency graph →
    Dependabot にしか出ないので、PR が長く来ない時はそこを見る。
  - **pnpm（`package.json` の `packageManager`）と Node（`.node-version`）は Dependabot では上がらない**。手で上げる：
    新しい版が公開から24時間以上たっていることを確かめ、版を書き換えて `pnpm install`（Node は SessionStart hook が入れ直す）、
    `pnpm verify` を通してから、専用のコミットにする。CI（setup-node・pnpm/action-setup）も同じ版を読む。
  - ワークフローのアクションは、コミットのハッシュで固定する（`uses: owner/name@<40文字> # vX.Y.Z`）。`pnpm check` の単体テストが確かめる。
- ヘッドレスのChromiumは、`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` で動く。
  とても遅い（960x540で1秒に1フレームくらい）。**テストはテスト用モードで書き、実時間では待たない**。
  例外は、スモークテストの「テスト用モードでない時に、タイトルの画面が出るか」の確認だけ（テスト用モードではないので、ゲームを止めて進められない）。
  スモークテストの 8・9（開発用モードのまま読み直した時・保存が使えない時のタイトル）も、`?test=1` を付けずにページを開く（テスト用モードは開発用モードを必ずオンにするので、
  その場面を作れない）。待つのはタイトルが出るまでだけで、時間がたつのは待たない。
  画面写真には `timeout: 90000` を付ける。
- three.js（r147）は、npm の `three` を組み立てに入れる（`src/game/imports.mjs` で読み、`00-test-mode.js` で画面の後処理の4つの部品（EffectComposer・RenderPass・ShaderPass・光のにじみの UnrealBloomPass）と一緒に `T` にする）。CDN からは読まない。
- フォントも、npm の @fontsource を組み立てに入れる（`src/main.js` で読む。Google Fonts は読まない）。テスト版（`vite build --mode test`。テストが自分で組み立てる）も同じ。
  テストのブラウザには、システムのフォントを見せない（`tests/fonts.conf`、指定したフォントに無い文字の代わり（fallback）は、npm パッケージの DejaVu だけ）。
  JetBrains Mono を指定した所の日本語は、テスト版のほか（公開用の版・開発用サーバー）ではシステムの日本語フォントで描画されるが、テスト版では M PLUS 1 Code
  （全角の ！？ などは BIZ UDGothic）を組み合わせて描く（`tools/game-source.mjs` の `cjkFallback`）。マシンが違っても同じ画素になる。
- ポインタロックは、テストでは `HTMLCanvasElement.prototype.requestPointerLock` を差し替えて止める（tests/lib.mjs）。
- Playwright は 1.63.0 に固定（クラウド環境の /opt/pw-browsers の Chromium と版を合わせている）。上げる時はそろえること。
  上げると描き方が少し変わりうるので、`pnpm test:visual` が落ちたら、違いの画像を見てから基準を作り直す（コミットを分ける）。
- CI では画面写真の比較も失敗にする。CI とクラウド環境の差は数画素（0.01%以下）で、失敗の基準は0.2%。

## TypeScript に移す
古い JS（src/game/）の関数を、1つずつ src/lib/*.ts に移す。動きを変えないことが一番大事。
1. src/lib/ に、型を付けて書き直す（`export` する）。状態の多くは src/lib/state.ts の入れ物にあるので、状態に頼る関数も移せる（入れ物を import して読み書きする。確かめ方は手順3）。
   迷宮の乱数（`rand`・`R`・`RI`・`pick`）は src/lib/random.ts にある（入れ替えは `setRand`。`rand=…` とは書けない）。
   まだ古い JS にある状態（src/lib/state.ts に無い物）に頼る関数は、先にその状態を入れ物に移す（下の「状態を入れ物に移す」）。
   まだ古い JS にある画面の描き直し（装備の画面 renderInv）を呼ぶ関数は、src/lib/redraw.ts の呼び口から呼ぶ（古い JS が読み込みの時に本物を入れる。描き直しを移したら、その呼び口は消す）。
   TypeScript のモジュールは、古い JS より先に読まれる。読んだ時に値を覚える書き方（`const mr=Math.random` など）は、
   テスト用モードの入れ替えより前の値を覚えてしまうので、呼んだ時に読む形にする（`mr = () => Math.random()`）。
2. `src/game/imports.mjs` に import を足し、src/game/ から元の定義を消す（「〜は src/lib/xx.ts」と1行残す）。
   src/lib/ のファイルの頭の「もとは src/game/〜」と、古い JS の「〜は src/lib/xx.ts」の行は、移している間の手がかり。古い JS を全部移し終えたら消す。
   消し忘れると、包みの中の古い定義が import を黙って隠す。lint-game（pnpm check と編集直後の hook）が、包みの一番外での宣言をエラーにして止める
   （関数の中で同じ名前を使い直すのは、その中だけのことなので止めない。色の名前の `EYE` など）。
3. 移す前の実装と、たくさんの入力で同じ結果になることを確かめる（Node 26 は .ts をそのまま動かせる。古い関数は git の版から取り出す）。
   乱数を引く順番を変えると、同じシードで違う結果になる。移す前の値を、単体テスト（tests/unit/*.test.ts）に残す。
   本物の型に合わせられない偽物を使うテスト（音の偽の Web Audio など）は、`as` を使わないように .mjs で書く（その分、型では確かめない）。
   移した物が、まだ古い JS にある関数を使う時は、テストで `tools/legacy-eval.mjs` の legacyValues から本物を取り出す。
   状態に頼る関数は、古い JS を消す前に、legacyValues で取り出した古い関数と新しい関数に同じ状態（gear など）を入れ、たくさんの場合で結果と状態の変わり方を比べてから消す
   （古い関数も、TypeScript の状態の入れ物を同じ物として読む）。比べ方の見本は、tests/unit/gear.test.ts の頭にある。
   迷宮の生成は Node とブラウザで同じ迷宮になる（混ぜるのは shuffle）。生成に関わる変更は、Node の単体テストの指紋（generate.test.ts。欄の並びによらない）で、
   前の版と作り比べる。意図して迷宮を変えた時は、ブラウザの `__test.gen` でも Node と同じ指紋になることを確かめてから、指紋を作り直す
   （生成した迷宮に祭壇などを置く place.test.ts の指紋も変わるので、一緒に作り直す）。
4. `pnpm fmt`・`pnpm check`・`pnpm test`・`pnpm test:visual`（画素まで同じはず）。
- 型を外すだけで組み立てる（Vite）。enum・namespace など、型を外すだけでは動かない書き方は使わない（`erasableSyntaxOnly`）。
- import は `.ts` まで書く（`./rng.ts`）。`noUncheckedIndexedAccess` なので、配列の要素は `undefined` かもしれない物として扱う。
- 型の言い切り（`as`。`as const` は除く）と後ろの `!` は使わない（lint がエラーにする。間違っていても tsc が黙って通すため）。
  配列と表は src/lib/array.ts の `nth`・`lookup`、無いかもしれない値は `must` で読む（無ければその場で止まる）。範囲の外や無い欄を
  わざと読む所は、無い時の扱いをその場で書く（`?? 0` など、元と同じ値になる形）。どうしても要る所だけ `oxlint-disable-next-line` と理由。
- **状態を入れ物に移す**：`node tools/state-move.mjs <入れ物> <名前>…`（`--dry` で一覧だけ）。eslint-scope で、ゲームの状態を指す所だけを
  `入れ物.名前` に書き換え、元の宣言を消す（初めの値は一覧に出るので、src/lib/state.ts の入れ物に書く。入れ物は src/game/imports.mjs で読む）。
  初めの値が決まった値（数・文字列・true など、それだけでできた配列・オブジェクト、空の `new Set()`・`new Map()`）でない宣言（`Math.random()`・`Math.random` の読み取り・`new Date()` など）は、
  道具がその場に `入れ物.名前=…;` として残す（TypeScript のモジュールは先に読まれるので、移すと値を作る時と順番が変わる）。
  丸ごと入れ替えない `const`（`player` など）は、道具を使わず、宣言を state.ts に移して import するだけでよい（名前はそのまま）。
  書き漏れは lint（定義されていない名前）が止める。入れ物の名前は、古い JS の局所の名前とぶつからない物にする（道具が確かめ、lint-game も
  関数の中での宣言し直しを止める。例：座標の `fx` があるので、揺れと光りの入れ物は `vfx`）。書き換えた後は、変わった行が「名前に入れ物を付けただけ」か確かめる。
- 例外：生き物の表 `MTYPES`（src/lib/creatures.ts）と性質の効き目 `RES`（src/lib/runes.ts）は表だが、探索の途中で種類が足される（その階の主・忘れられた獣・王の影・
  図鑑の見本・試しの間の的）。古い JS が初めからある種類と同じ `MTYPES[key]` で読むので、表のモジュールに置いている（生き物の処理を移す時に分ける）。
- 関数の多重定義（同じ名前の function を型ごとに並べる書き方）は使わない。組み立てた JS では1つになり、ソースマップのテストの関数の数が合わなくなる。
- 文字を調べるテスト（使う文字・文字の幅）は、src/lib/*.ts の文も見る（`gameText`）。コメントの文字も調べるので、フォントに無い文字（＝ など）は
  コメントにも書かない（落ちた時は、場所と「コメント」の印が出る）。

## テスト用モード（`?test=1`）
同じ手順なら、いつも同じ結果になるモード。開発用モードも含む（`seed=`・`depth=`・`god=1` などがそのまま使える）。
テスト用モードでない時（`?test=1` なし）の動きには影響しない（`src/game/00-test-mode.js` の `TEST` で分けている）。
- `Math.random` はシードで決まる。時計（`performance.now`・`setTimeout`・`setInterval`）は、ゲームが進む時だけ進む。
- ゲームは自分では進まない。`__test.advance(秒)`（描かずに進める。速い）か `__test.frames(n)`（描いて進める）で進める。1フレーム＝ゲームの1/30秒。
- `window.__test`：`ready()`、`error()`、`advance(秒)`、`frames(n)`、`state()`（時刻 time・シード seed・場所 place・深さ depth・始まったか started・死んだか dead・体力 hp・位置 pos・向き yaw・レベル lvl・生き物 monsters・飛ぶ物の数 projs・階を移る途中 trans・届いた深さ maxDepth・溜め cast・立ち直り recover・止まっているか paused）、
  `equip(手, 武器)`（例：`equip('L','bolt')`）、`bless(n)`（全部の加護を n 段目にする）、`width(文字列)`（visW）、`press(手)`・`release(手)`（ボタンを押す・離す）、`doors()`（扉の一覧）・`cell(i)`（マスの真ん中・床か・今見えているか・灰の印・硫黄か氷の床か・水か・火の強さ・燃える物）・`size()`（マップの横と縦のマスの数）・`ignite(i, gas)`（火をつける。gas は燃えるガスのように燃える物を少し残す）・`chill(i, r)`（マスの周りに冷気）・`burning(i)`（燃えているマスの一覧に何回入っているか）・`clearAll()`（生き物を全部消す）・`summon(種類, マス)`（生き物を置く。例：`summon('Re', i)`）・`fov()`（見えるマスを今すぐ数え直す。ゲームは0.1秒ごと）・`addTraces()`・`traces()`（階に残る物：魔法の場・遅れて当たる攻撃・雨・床の目印・撃っている途中の光線・稲妻・稲妻の光を置く、数える。発動のルーンの待ち時間も置く）・`failLater(文)`（遅れて起きることの中で例外を起こす。テスト用モードではページのエラーになる。テスト用モードでない時は、コンソールに出して続ける）、`gallery()`（タイトルから図鑑を開き、一覧 `[{n,key,name,form}]` を返す）・`galleryShow(n, {yaw, pose, zoom, pitch})`（n 番目を、向きと姿を止めて出す。yaw は0でこちらを向き、＋でこちらから見て右へ回る。pose は `'stand'`・`'walk'`・`'sleep'`。zoom は寄る・引く（距離を 1/zoom 倍。0.5〜3。書かなければ 1。部屋の壁より外には引かず、寄っても体の外で止まる）。pitch は見下ろす角度（ラジアン。0 で真横から、＋で上から。-0.3〜1.3。天井より上には出ない。書かなければ、図鑑が生き物の大きさから決める高さ））・`galleryDraw()`（出している生き物が描く物：文字の数 glyphs・火花の数 sparks・数でない値の混じった文字と火花の数 bad・描いた範囲 box・カメラの床の上の距離・高さ・角度・狙う点までの距離と、天井の高さ・部屋の壁までの距離・寄った時に体を包む球の半径 camera）、`places()`、`gen(シード, 場所)`（生成だけ。描画の状態を壊すので専用のページで）
- 気をつけること：
  - 溜めている間は、ゲームの時間が半分の速さで進む。ヒットストップ中は1/20。
  - 階に入ると、約1.25秒かけて明るくなる。写す前に `advance(2)` する。
  - CSS のアニメーション（タイトルが消える、など）は実時間で進む。画面写真の比較では止めている（`newPage(…, {still:true})`）。
  - `let`/`const` の変数は `window` から見えない。テストに必要な物は `__test` に足す。
  - 祭壇の画面は、祭壇から1.5以内でないと開かない（`dbg.to('altar')` は2マス手前）。tests/lib.mjs の `nearAltar(pg)` を使う。
  - パネルの文字の幅を測る時は、`document.fonts.ready` を待つ（文字の範囲ごとのフォントは、使う時に読まれる）。

## 自動の確かめ（hooks、.claude/settings.json）
- **編集の直後**（PostToolUse）：`src/` などの JS を編集すると、構文と lint を確かめる（`src/game/` は全部をつないで調べる）。TypeScript は型（tsc）と、型の情報を使う lint。エラーなら差し戻されるので、その場で直す。
- **終える前**（Stop）：`src/`・`tools/`・`tests/`・設定が変わっていれば `pnpm check` を通す。通らなければ終われない。
- **セッションの始め**（SessionStart、クラウドのみ）：.node-version の Node と packageManager の pnpm を用意し（~/.cache）、依存が変わっていれば `pnpm install --frozen-lockfile`。
- 権限：`pnpm run` のスクリプト（`pnpm run deploy` を除く）と、check・lint・fmt・test・build・typecheck・dev・map・where・verify・serve などの `pnpm` の直接の呼び出し、`pnpm exec` の oxlint・oxfmt・vitest・vite、`node tools/*`・`node tests/*`、
  git の読み取り・add・commit・push・fetch・merge・stash・ブランチの切り替えは確認なし（一覧は .claude/settings.json の allow）。
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
細かい見出しと行は `pnpm map` で見る。TypeScript に移した名前のうち、古い JS が読む物の一覧は `src/game/imports.mjs`（生成だけが使う物は載らない。古い JS の「〜は src/lib/…」の行も見る）。ブラウザのエラーの場所は `pnpm where <JS:行:列>` で元のファイルに直す（テストのエラーには自動で付く）。
| ファイル | 中身 |
|---|---|
| 00-test-mode | テスト用モード（`TEST`、時計、乱数） |
| 01-title | タイトルのロゴ。ロゴの絵 LOGO_ART・TITLE_LINES は src/lib/title.ts |
| 02-constants | 特別な階の場所（interAt）。生き物の表 MTYPES は src/lib/creatures.ts。層・テーマ・支道と異界の中身・迷宮の乱数・迷宮の大きさ・タイル・灯りの計算などは src/lib/。飾りの文字の並び（RUNESET など）は src/lib/glyphs.ts |
| 03-vaults-history | 歴史の飾り（壁の絵 ARTS）と、探索ごとの歴史（HIST。年代記の中身）。洞窟の形と宝物庫の絵は src/lib/vaults.ts、makeHistory は src/lib/history.ts、岩・鉱脈・宝物庫の壁の高さは src/lib/world.ts |
| 04-generate | 迷宮の生成の呼び出し口（generate）：今のゲームの状態から入力を作り、src/lib/generate.ts の generateLevel を呼び、結果（階・主の種類・忘れられた獣）をゲームの状態に入れる |
| 05-renderer | 描画（シェーダー、水面、文字の絵の表、dyn、粒子の配列）。シェーダーのソースと描画用の配列の大きさは src/lib/shaders.ts |
| 06-world | 世界の組み立て（buildWorld）と、組み立てた物の状態（区切りごとの壁と床の形・壁の向こうを隠す板 occMesh・入った部屋 visitedRooms など）。今の階の中身 D・depth・monsters・player などは src/lib/state.ts。sstep は src/lib/math.ts、CHUNK は src/lib/world.ts、flowW は src/lib/math.ts |
| 07-bodies-lords | 生き物の形：人型の見た目（lookHumanoid・extraLook）、主のまわりの飾りの粒子と音（lichAura・spiderAura・nagaAura・dragonAura：周りに立つ剣・霜の輪・霧・低い音など）。主の形は src/lib/bodies/bosses.ts、古いトロル・古い獣・ゴーレムの形は src/lib/bodies/ |
| 08-bodies-shadow | 生き物の形：王の影（変身 transformShadow、裾から台座へ流れる影と暗い霧 shadowAura）、深みの主（形 deepKrakenForm、まわりの粒子 krakenAura）、猟犬のまわりの粒子（houndAura）。一つ目の姿と機械の形は src/lib/bodies/lords.ts、二つ目の姿は src/lib/bodies/bosses.ts |
| 09-bodies-creatures | 生き物の形：人型、リッチ、サラマンダーと沼の生き物のまわりの粒子（salamanderAura・bogAura）。小さな生き物・四つ足・大きな生き物（オーガ・竜も）・亡霊・幻影の形は src/lib/bodies/ |
| 10-bodies-beast | 忘れられた獣の組み立て（buildForm）、獣の記録（眠った姿 beastSleep は src/lib/bodies/lords.ts） |
| 11-monster-move | 生き物を作る（makeMonster）、歩ける所（canStep）、行き先（chooseNext） |
| 12-hud-text | 忍び足と灯り、状態の表示（renderStatus）、操作・年代記の画面、物音（**パネルの文字の幅 visW と枠 boxText は src/lib/text.ts**、lerpAngle は src/lib/math.ts）。灯りの段階の名前・印の高さは src/lib/hud.ts、mname は src/lib/names.ts。忍び足 stealth・手元の灯り lantern・表示の数 hudInfo は src/lib/state.ts |
| 13-creatures | 小さな生き物、群れ、大きな生き物の動き（updateMonster）、描く（drawMonster）。古い形は src/lib/bodies/small.ts |
| 14-lights-fixtures | 灯り、備品、扉。LANTERN は src/lib/light.ts |
| 15-sound-fire | 音量の切り替え（sndToggle）、ガス、火、火花、部屋の出来事、粒子。音を鳴らす処理（sndInit・効果音・まわりの音 sndUpdate など）は src/lib/audio.ts、SND_LV・sEnv は src/lib/sound.ts、cpos・FIRE_TYPES は src/lib/world.ts。火と地面のマスの状態は src/lib/state.ts の blaze、音 SND も src/lib/state.ts |
| 16-view-input | 視界とミニマップ、伝言の1秒ごとの描き直し、通れない所の当たり判定（solidAt：壁・崖・溶岩・柱など）、入力の状態。伝言 msg・renderLog は src/lib/log.ts、伝言の一覧 msgs は src/lib/state.ts。ミニマップの大きさは src/lib/hud.ts、押しているキー keys は src/lib/state.ts |
| 17-meta | 伝承・解放・墓・試練、タイトルの画面（buildIntroPanel）。UNLOCKS・META_DEF は src/lib/progress.ts、解放の確かめ（unlocked・lockedOf・weaponPool）と試練（trialOn）は src/lib/unlocks.ts、保存する記録 META などは src/lib/state.ts の saved、保存する saveMeta は src/lib/save.ts |
| 18-level-player | 階の切り替え（newLevel）、罠、プレイヤーと生き物のダメージ（hurtPlayer・damageMonster）、当たった生き物のひるみと吹き飛び（hitReact）、生き物の近接の攻撃（monsterStrike）、死と始め直し（die・newRun）、レベルアップ（levelChoices、lvlLine。加護の表 BLESS と加護の段 BL は src/lib/progress.ts）。階のシード levelSeed は src/lib/levels.ts、生き物の強さの表 MSTAT は src/lib/creatures.ts、statOf は src/lib/monsters.ts、墓のルーン graveRune は src/lib/gear.ts。expNeed・expOf は src/lib/progress.ts、serRune は src/lib/runes.ts。TRAP_INFO は src/lib/names.ts、WEAPON・SLEEP_MULT は src/lib/runes.ts、roll は src/lib/random.ts |
| 19-hands-runes | 手元の武器（VM_MODELS、drawViewWeapons）、性質と反応、術の中身（specOf）。ルーンを作る・ルーンの種類を選ぶ・手と持ち物の処理は src/lib/gear.ts、ルーンの名前と色と付けられるか・特性の説明 trDesc は src/lib/runes.ts。ルーンの定義 RUNE_DEF・性質の効き目 RES・TRAITS・REACT・手の枠は src/lib/runes.ts |
| 20-chant-hits | 詠唱（beginCast、castNow…）、攻撃の当たり（applyHit）、反応、飛ぶ物。turnDir は src/lib/math.ts、sp_elem は src/lib/runes.ts。戦いの状態は src/lib/state.ts の fight |
| 21-altars-heal | ルーンの手に入れ方（主を倒した時の祭壇）、宝物庫の褒美を取った時、祭壇の画面、回復、拾う。階ごとに祭壇とルーンを置く・祭壇の中身・番人・鍛え方・泉を置く・石碑のそばか・祭壇の画面の1行と説明と選択肢・拾ったルーンを手か袋に入れる（placeRunesForLevel・mainPathAltars・altarFill・addGuards・forgeOptions・placeSpring・nearStele・altarLine・altarDetail・altarOpts・takeRune・placeChosen など）は src/lib/altars.ts、近くの祭壇 altarNear は src/lib/state.ts の ui、RALLY_FROM は src/lib/runes.ts、ALTAR_W は src/lib/hud.ts |
| 22-world-hints | 先にある物の手がかり（computeOmen・drawOmens：階段から漏れる光と音、支道の入口の跡、異界の門の光）、方向の矢印、床のルーン、詠唱の見た目、照準。stratumAtDepth は src/lib/strata.ts |
| 23-debug | デバッグ（dbg、F2 の画面、URL の指定） |
| 24-goal | 目的（伝説の物、最深部、王の影）、勝利、稲妻、タイトルへ戻る。伝説の物の表は src/lib/names.ts、jagged は src/lib/math.ts |
| 25-gallery | 見た物の記録、図鑑、試しの間。図鑑の主・試しの間の的の表は src/lib/names.ts、保存する saveSet は src/lib/save.ts |
| 26-spells-hud | 術と世界（扉・氷・雷）、詠唱の声、止まっているか（isPaused）。下の HUD renderHotbar は src/lib/hotbar.ts、詠唱の声の表は src/lib/sound.ts |
| 27-rune-screen | 装備の画面（renderInv、packSlot、ビルド。renderInv は読み込みの時に src/lib/redraw.ts の呼び口 redraw.inv に入れる）、魔導書、メニュー。武器を持つ equipWeapon・手の枠に入れる slotSet・空いた枠 freeSlotFor・着けた護符の数 bodyN は src/lib/gear.ts、ルーンの説明の5行 detailLines は src/lib/runes.ts。padTo・wrapPlain は src/lib/text.ts、CAT_BR・CAT_NAME・emptyChip・reactionOf は src/lib/runes.ts、PACK_W・PACK_SLOT・BAG_LINES は src/lib/hud.ts |
| 28-camera-player | 1人称・3人称、プレイヤーの動き（updatePlayer）、霧と目の慣れ（updateAtmosphere：霧の濃さ・露出・溶岩の近くの熱のゆらぎ・水中の見え方）。AVATAR_TY は src/lib/names.ts |
| 29-look | 見た時の説明（look）。説明の表と lookLine は src/lib/names.ts |
| 30-loop-init | 大きさ、メインループ（frame・tick）、テスト用の `__test`、初期化（init）。ゲームの時刻 time は src/lib/state.ts の clock |
結果の画面は `die()` / `victory()` / `newRun()`、タイトルは `buildIntroPanel()` / `buildUnlockPanel()`。

## 落とし穴
- **宣言の順番（TDZ）**：`buildIntroPanel()` はスクリプトの途中で呼ばれる。そこで使う古い JS の `let`/`const` は、それより前で宣言すること。
  状態の入れ物（src/lib/state.ts）は先に読まれるので TDZ にはならないが、本当の初めの値をその場の代入で入れている欄（`saved.META`・`saved.DEVALL` は
  17-meta.js、`saved.BOOK` は 19-hands-runes.js、`saved.SEEN`・`saved.RSEEN` は 25-gallery.js で localStorage から）は、それより前に読むと、止まらずに黙って仮の値になる。
- **パネルの枠と文字の幅**：枠（boxText）は `visW` で幅を数えて縦線を揃える（どちらも src/lib/text.ts）。パネルのフォントは M PLUS 1 Code
  （半角1マス・全角2マス。ただし全角スペース「　」は1マス。なので、列を揃える時は全角スペースで埋めず、visW で数えた半角スペースで埋める）。M PLUS 1 Code に無い文字（← → ！：？［］）は、
  BIZ UDGothic で補っている（全角2マス。補ってよい文字の一覧は src/lib/text.ts の `BIZ_CHARS`。組み立ては、それを含む BIZ UDGothic の面だけ入れる）。新しい記号を使う時は、M PLUS 1 Code にあるかを
  `pnpm check`（tests/glyphs.mjs）で確かめ、無ければ別の文字にするか、`BIZ_CHARS` と visW に足す。
  Ⅱ などは、BIZ UDGothic にも無いので使わない（II にする）。
- **lint の警告**：使っていない関数・変数が残っている（古い仕組みの残り。`pnpm lint` の警告）。消す時は、図鑑や dbg から文字列で呼ばれていないか確かめる。
- **sed の区切り文字**：差し込む文に `|`（`||` など）があると壊れる。置き換えは Python で行う方が安全。
- **/bin/sh**：`mkdir -p a/{b,c}` は展開されない。
- **混ぜる**：`.sort(() => rand() - 0.5)` は使わず、`shuffle(配列, 乱数)`（src/lib/random.ts）を使う。でたらめな値を返す比べる関数での並びは
  エンジン次第で、Chromium では最適化（Maglev）の前と後でも変わる（同じシードで違う迷宮になる。Node とブラウザでも違う）。単体テストが src/ を調べて止める。
- **乱数とシフト**：32bitの値を `>>` で右シフトすると負になりうる。符号なしにしたい時は `>>>`。
- **手元の武器**：dyn の文字は世界の中に描くので、壁に沈みうる（壁が近い時は、目に向かって相似に縮めている）。
  斜めの線の文字は、奥行きで割った「画面での傾き」で選ぶ（vmGlyphS）。
- **右上のミニマップ**：画面の右上3分の1を覆う。手元の武器の頭や刃先を、そこに入れない。
- **開発用モード**：すべて解放済みになるので、解放の確かめは `al_dev` を `0` にして行う。
- **祭壇の画面**：プレイヤーが閉じると、祭壇の真ん中の台から1.5より離れて、また近づくまで開かない。選ぶと、ほかの選択肢は消える。
