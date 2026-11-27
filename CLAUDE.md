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
- PR の CI を待つ時は、GitHub からの知らせ（終わった・落ちた）を待つのに加えて、終わりそうな頃（今の CI は約2〜3分。ブラウザのテストは CPU で描くので、ランナーの当たり外れで倍ほど変わる）に自分で一度見に行く予定を入れる
  （send_later など）。知らせは届かないことがある（push し直した版の「終わった」が届かず、CI が通ったのに気付かなかったことがあった）。
  見に行った時は、CI の結果より先に、PR が main とぶつかっていないか（ぶつかっていると CI が始まらず、結果が1つも無い）と、見ている版が PR の今の head かを確かめる
  （待っている間に push し直すと、前に入れた予定は古い版のことを言っている）。
- 手間と得る物を比べる時は、手間を分けて数える。「手間が大きい」と書く時は、どの手間かを書く。
  - Claude が手を動かす量：ほぼ数えない。
  - ユーザーが差分を読んで確かめる量：数える。差分を小さく・読みやすくする。
  - 動きを壊す危うさ：数える。ただし、確かめる道具（型・指紋・same-code・テスト）で下げられるなら小さく見てよい。
  - 仕組み・規則・依存が増えて、後から触る時に覚えることや壊れる所が増えること：一番重く数える（作った後もずっと続くため）。

## ファイル
```
src/index.html       画面の作りとCSS（Vite の入口）
src/main.js          ページの入口のモジュール（フォント（@fontsource の CSS）と、ゲーム本体 virtual:legacy-game を読む）
src/icons/*.png       ホーム画面のアイコン（公開用の組み立てが出す。作り方は tools/icons.mjs）
src/game/*.js        ゲーム本体の古い JS（27ファイル。下の「ゲーム本体の地図」）
src/game/imports.mjs ゲーム本体が使う TypeScript のモジュールを読む import の文（包みの関数の前に置かれる）
src/lib/*.ts         TypeScript に移した物。厳しい型で確かめ、整形もする
                     array：配列と表を読む nth・lookup・must（無ければその場で止まる。as の代わり）、
                     rng：シードの乱数を作る mulberry32 と clamp、
                     random：見た目の乱数 mr・mpick（一時的な入れ替えは withVisualRand、生き物の並びへの入れ替えは withMobRand）と迷宮の乱数 rand・R・RI・pick（入れ替えは setRand）と音の乱数 sndRand（入れ替えは setSoundRand）と出来事ごとの乱数 keyedRand と混ぜる shuffle、
                     glyphs：文字の絵の表（アトラス）の番号 G と飾りの文字の並び、
                     color：3つの数の組の色の型 Color・css・表の色を css にする cssOf・hsl2rgb、
                     math：角度・稲妻の線など、
                     text：パネルの文字の幅と枠・幅に合わせて HTML を切る clipHtml、
                     history：年代記、
                     world：迷宮の大きさ・タイル・液体と地面・支道と異界・深さごとの係数（depthProfile）と深さごとに順に使う霧の色（FOGS）・岩、
                     light：灯りの計算、
                     runes：ルーンの定義 RUNE_DEF・性質の効き目 RES・特性・反応・手の枠・ルーンの名前と色と付けられるか（表だけに頼る物）、
                     gear：手と持ち物の処理（makeRune・randomRuneType・effHand・isTwo・canPutAt・武器を持つ equipWeapon・空いた枠 freeSlotFor・墓のルーン graveRune・術の中身 specOf と型 Spec・探索の始めの手に戻す resetRunes・枠を開ける applyOpen など。状態 gear に頼る物）、
                     progress：経験・伝承・解放・加護 BLESS（表。状態の入れ物は読まない）、
                     unlocks：解放の確かめ（unlocked・lockedOf・weaponPool。状態 saved に頼る物）と試練（trialOn）と使える伝承 loreLeft、
                     altars：祭壇とルーンを置く（階ごとに置く placeRunesForLevel・mainPathAltars、祭壇の中身 altarFill・番人・鍛え方・泉・石碑のそばか nearStele・祭壇の画面の1行と説明、拾ったルーンを手か袋に入れる takeRune）、
                     pickup：足元の物を拾う pickupItems・物を取る grabItem・宝物庫の褒美を取った時 vaultSprung・落石 updateRockfall・空の枠を拾った時 openSlot・伝説の物を手にした時 pickLegend、
                     levels：階のシード levelSeed と最深部か isFinal と特別な階の場所 interAt・interAfter と、階を移る処理（新しい階 newLevel・次の場所へ進む advance・場所の名前 placeKey・階を作る generate・最深部の支度 setupFinal・最深部を進める updateFinal・王の影を立ち上がらせる spawnFinalBoss・層の名前 showStratum・部屋の出来事 initEvents・見えるマス computeFOV・階の中の出来事 checkEvents・層で強くなる strataGrowth・選ばれなかった枠 settleSlotPick・死んだ時 die・新しい探索 newRun）、
                     monsters：生き物の処理（強さ statOf・作る makeMonster・歩いて行けるか canStep・次に向かうマス chooseNext・critterStep・猟犬が追う匂い houndScent・近くの火 fireNear・敵か hostile・攻撃の的か foe・呼び出す summon・生き物の動き updateMonster・視界の中でも体が描かれないか bodyUnseen（m.visible と目の慣れが使う））と加護の段 BL、
                     ground：地面と小さな生き物（小さな生き物の動き updateCritter・掃除機と修復機の仕事 machineWork・水しぶき splash・火をつける ignite・マスの絵を描画に渡す uploadCells・氷が割れる crackIce・茂み tallAt・trample・硫黄が燃え上がる brimFlare・冷気 chillArea・凍らせた水が溶ける updateFrozen・階に入った時の燃える物のマス initFire・火を進める stepFire・ガスが広がる stepGas・踏み分けた茂みが戻る regrow・燃えた硫黄が戻る brimRecover）、
                     hands：手元の武器の文字と形と色の表（武器ごとの形 VM_MODELS・部位ごとの色と明るさ・弦を引く手 VM_FIST）、
                     held：手元の武器を描く drawViewWeapons（壁が近いと縮め、詠唱・振る・撃った跳ねで動かし、性質の火花を出す）、
                     creatures：生き物の表 MTYPES（探索の途中で種類が足される）と強さの表 MSTAT、
                     strata：層・テーマ・特別な階・支道と異界の中身・地形・群れ、
                     noise：ノイズ（種は setNoiseSeed）、
                     vaults：洞窟と宝物庫の絵と壁の絵 ARTS、
                     shaders：描画のシェーダーのソースと、描画用の配列の大きさ、
                     title：タイトルのロゴ、
                     hud：表示の大きさ（ミニマップ・装備の画面など）と頭の上の印の高さ（MARK_H・markHeight）、
                     minimap：ミニマップ（キャンバスの大きさを画面の倍率に合わせる sizeMap・描く drawMap。今見えているマスの色を here.mem に覚える）、
                     names：名前と説明の表（見た時の説明・罠・伝説の物・図鑑の主・図鑑で眠っている間の説明 GALLERY_SLEEP・部屋の仕掛けの伝言 MACHINE_INFO）、
                     sound：音の小さな表と道具、
                     audio：音を鳴らす（Web Audio。音の部品（タイトルを出した時に先に作って止めておく sndPrep、迷宮に入る時などに鳴らし始める sndInit、状態 sndState）・効果音・術を放つ音 castSound・まわりの音 sndUpdate。状態 SND に頼る物）、
                     log：伝言 msg、
                     hotbar：下の HUD renderHotbar（指の操作の [持ち替え] の出し分けも）と持ち替えられるビルド buildsHave、
                     save：保存 saveSet・saveMeta と忘れられた獣の記録 loadBeasts・recordBeast、
                     inventory：装備の画面 renderInv（中のボタンの処理・ビルドの呼び出し applyBuild も）と、開け閉め setInv・付け替えの詠唱 startSwap、
                     panels：レベルアップの画面（選択肢 levelChoices・開く openLevelUp・選ぶ chooseLevel）と祭壇の画面（開く openAltar・閉じる closeAltar・選ぶ chooseAltar・毎フレーム開け閉めする updateAltarPanel）。どちらも #altarp に描き、指なら選択肢は2回押して決める（confirmTap）、
                     menu：メニュー（描く renderMenu・開け閉め setMenu・項目を押した menuAct・確かめ待ちを4秒で戻す menuArmReset。指で遊ぶ時は、操作の案内・年代記・魔導書をメニューの中に開き、見回す速さの項目も出す）とタイトルへ戻る returnToTitle、
                     status：状態の表示 renderStatus・明るさと気配 updateStealth・年代記・操作の案内・魔導書（枠の行 chronRows・helpRows・bookRows。操作の案内は指で遊ぶ時は指の操作の説明）・表示の量・見つかった時 onNoticed・物音 makeNoise・立ち止まって調べる updateSearch・止まっているか isPaused・場所の名前 placeLabel・下の一言 showHint（自分で消す一言は flashHint、出した一言だけ消すのは clearHint）・頭の上の印 drawMark、
                     layout：画面の大きさに合わせる（タイトルの枠を zoom で縮めて画面に収める fitIntro。指で遊ぶ時のパネル（装備・メニュー・祭壇とレベルアップ・結果）も、[装備] [メニュー] の下から画面の下までに縮め、入らない分は中を送る fitPanels。下限 FIT_MIN）、
                     touch：指で遊ぶ時の土台（指で触れたら指の遊び方 setTouch。指の後にブラウザが出すマウスの事件を止める（iPhone は pointerdown の preventDefault で止まらないので、指の事件から COMPAT_MS 以内のマウスの事件も止める）。タッチのボタン [全画面] [装備] [メニュー] initTouch。パネルの選択肢を指で押した時の2段階（1回目で選んで説明、2回目で決める）confirmTap。操作の説明を遊び方で書き分ける byInput。指で遊んでいて縦向きの間は、探索を止めて横にする案内 #turn を出す updatePortrait。タイトルにホーム画面に置く案内を出すか homeHint（iPhone・iPad の Safari で、指で触れる端末で、ホーム画面から開いていない時だけ）。遊び方が変わった時に古い JS が文言を書き直す処理（initTouch の changed。図鑑の案内）。ゲームのマウスの処理より先に 16-view-input.js が呼ぶ）、
                     touchpad：指の操作（試して合わせる値 TUNE（見回す速さ look（メニューで遅い・ふつう・速いから選ぶ段 LOOK・cycleLook。選んだ段は al_look に残す）・アナログか analog。アナログなら倒し具合を thumb.stick に入れ、src/lib/player.ts がキーの代わりに向きと速さに使う）・左半分に触れた所に出るスティックで移動・右半分のドラッグで見回す・[右手] [左手] で詠唱・[持ち替え]（ビルドを2つ以上保存した時だけ出る）・[回避]・図鑑では1本指のドラッグで回し・見下ろし、2本指でつまんで寄る・引く initTouchpad。ページが隠れた時に、触れている指（図鑑の指も）を離したことにし、溜めている詠唱を放たずに散らす releaseTouch。描く画面は touch-action を既定のままにし、touchmove の preventDefault で送りと拡大を止める。touch-action: none の上で指を動かすと、Chromium は直後のボタンのタップを click にしないため）、
                     diag：診断の記録（claude.ai の Artifact の中で、持ち主が開いた時だけ、端末・速さ・できごと（開け閉め・溜めている手・飛ぶ物があるか・音の部品の状態（先に作った部品も。記録を始めた時の状態も書く）・ボタンと描く画面を押した）・場面が切り替わる時の処理にかかった時間・遅いフレーム・メニューで押した項目（押し間違いの目安）・自動で試した記録・エラーを Artifact のデータベースの diag に書く initDiag。Claude が ArtifactData の道具で読む。window.claude.use が無い所では何もしない。書けると分かったら ui.owner を入れ、呼んだ 17-meta.js がタイトルを描き直して［開発用モード］と［自動で試す］を出す）、
                     took：かかった時間を診断の記録に渡す took（記録していない時は何もしない。levels.ts などが diag.ts を直に読むと輪になるので、間に置く）、
                     auto：自動で試す（タイトルの［自動で試す］（Artifact の中で持ち主が開いた時だけ、［開発用モード］の真下に出す canOfferAuto。押すと startAuto。ゲームの用意ができてから（initAuto の後）出し、開発用モードがオフでも出す。流している間は［開発用モード］とどちらも隠す。AUTO_LAPS 周。claude.ai はリンクに付けた ?auto をゲームのページに渡さないので、iPhone ではこちら）と、URL の ?auto=<周の数 1〜9>・?auto=quick（道具とテストが使う）。台本 AUTO_STEPS（迷宮に入る・歩く・見回す・生き物を置いて撃つ・階段を下りる・メニュー・装備・死んで新しい探索へ）を、ページの中で合成した指の事件で、本物の時計で流す。段ごとのフレームの数・平均・一番遅い1回・遅いフレームの数を autoSt に貯め、診断の記録が欄 auto に書く。自動の間はゲームの保存（al_ で始まる名前）を localStorage に書かない（autoGuard。00-test-mode.js が初めに呼ぶ）。開発用モードはオンにせず、dbg の中身を直に呼ぶ（AutoHooks。30-loop-init.js が渡す）。1周目のシードは AUTO_SEED。生き物は、前と左右斜めの向きに床が続く所だけに置く（壁の向こうに置かない）。死ぬ段の前までは不死。縦向き・隠れている間は待って数えない（隠れている間はフレームが来ないので、visibilitychange で数え直す）。ゲームの中で着くのを待つ所（階段まで歩く・階を移る・新しい探索）と撃つ段は、ゲームの時刻で待つ（遅い端末では1フレームで進むゲームの時間に上限があるため）。撃つ段は、右手を溜めきる（gear.castSt.full）まで押し、左手は前の一撃の戻りと転がりが終わってから押し、飛ぶ物と遅れて起きる当たりが済んでから当たりを数える（短い台本は1回、ふつうは3回）。右手で放てない・左手で撃てない・当たらない時は、うまくいかなかったと書く。レベルアップの画面は1つ目を選び、祭壇の画面は閉じる（段の shut に回数）。止めた時・例外の時も、置いた指は全部離す。Wake Lock を頼む。テスト用モードでは動かない。合成した指の事件なので手触りは、自動再生の決まりで音は、確かめない）、
                     screens：マウスを捕まえる tryLock（指で遊んでいる間は捕まえにいかない）・失敗した時 lockFailed（一度も捕まえていないか、最後に捕まえてから3回続けて失敗したら（外れてから1.5秒の間の分は数えない）、捕まえられないと決め、ドラッグの案内を1回出す。それまでは、次のクリックでまた捕まえる。Esc のキーを処理している間 ui.escKey は捕まえにいかない）・捕まえる遊び方で探索中なのにマウスが外れているか lockLost・描く画面を押した時に、lockLost なら捕まえ直すだけにする relockClick・外れた時にメニューを開くか menuOnUnlock・ページが隠れた時（アプリの切り替えなど。指で遊ぶ時はマウスが外れないので、こちらで止める）にメニューを開くか menuOnHide（どちらも探索中で、止まっている画面が開いていない時だけ）・「クリックで視点操作に戻る」の一言 updateResume（lockLost の時だけ出す。止まっている間・死んだ時・タイトルでは CSS が隠す）・視点 setCamMode・音量 sndToggle（選んだ段は al_snd に残し、ページを開いた時に loadSndLevel で読む）、
                     particles：粒子を出す spawn・消す killP と、世界の中に文字を置く dyn（配列も。描き方 mode は、こちらを向く・床に寝かせる（1 を越えた分は文字を起こす角度）・立てる）と、漂う塵を置く initDust・respawnDust と、描く粒子の配列 ptPos・ptCol・ptSize・ptGly、
                     motes：粒子を動かす（塵・沼のガスの粒 updateGasPoints・川のさざ波 riverFX・粒子と火の粉を動かして GPU に渡す数を書く updateParticles）、
                     camera：霧と目の慣れ updateAtmosphere・3人称の自分の姿 updateAvatar・岩の中か rockAt・カメラと自分の間の岩の断面 drawSection・階の場所ごとの空気 updateSectionAir（分かれ道は明るく、階段へ向かう道は暗く）、
                     debris：倒れた生き物が崩れる（倒れた時の体を写し取る crumble。文字が上から順に外れて落ち、床に寝て小山に積もり、1つずつ縮んで消える。動かして描く updateDebris は tick の段 debris。ばらつきは生き物ごとの鍵の乱数 keyedRand('fall'…) で先に決め、見た目の乱数 mr() は引かない。数の上限：1体に残す文字は、ふつう120・主と大きな物250・試しの間の的40、崩れる体は12・残る文字は全体で3000。テスト用の様子 debrisInfo）、
                     legend：今の探索の伝説の物 getLegend と状態の表示の1行・伝説の物の読み方（legendOfBranch・legendAll・descentSealed）と世界の中に描く drawLegendWorld と神託所の手がかり oracleLegendHints、
                     lightmap：マスの明るさ cellLight と天井の高さ ceilAt・灯りの揺らぎ flicker と灯りを描画に渡す配列を書き直す updateLights（状態に頼る。灯りの計算そのものは light）、
                     fixtures：階に置いてある物を描く（灯りの備品 drawFixtures・扉 drawDoors・泉 drawSprings・墓 drawGraves・クモの巣 drawWebs・罠と鉄格子 drawTraps・床と台と祭壇のルーンと石碑と宝物庫の兆し drawRunesWorld（光線・飛ぶ物・詠唱している手の前と付け替えの間のルーンも））と巣に触れた時 webTouch、
                     arrows：方向の矢印（行き先 arrowTargets・見通せるか inPlainSight・画面に重ねた 2D のキャンバス #arrows に描く drawArrows。キャンバスと下の HUD は 22-world-hints.js が ui に入れる）、
                     chantfx：詠唱の見た目（術が飛ぶ道 simPath・手の前の円と飛ぶ道と落ちる所 drawCastFx・照準の文字 #cross と詠唱の間の画面の色 updateCross）、
                     fx：火と術の跡を描く（火 drawFire・凍らせた水 drawFrozen・稲妻 addBolt・sparkCrown・drawBoltFx・床の目印と魔法の場 drawZones）、
                     omens：先にある物の手がかり（表 STRATUM_OMEN など・computeOmen・omenOf・drawOmens）と階段の封（stairsGuarded・drawStairSeal）、
                     look：見た時の説明 look（照準の先の生き物 ui.aimMon も入れる）、
                     aim：照準（目の位置と向き headPos・aimOrigin・viewDir・handUp、攻撃が当たる生き物か hittable、照準の先の点 aimPoint、手の前の点 centerPoint・handPoint、詠唱の円の位置 castPoint、武器を振った線 drawSwing、照準の先の生き物 aimTarget・狙いを助ける点 assistPoint・撃つ所と向き shotFrame・beamFrame、閉じた扉 doorBlock・見通し losClear・地面に落とす所 groundPoint・跳ね返る向き reflectDir）、
                     combat：詠唱と当たり（術を放つ castNow と武器の種類ごとの撃ち方 meleeCast・dashCast・fireBeam・castStar・castRapid・startRain・fireWave、玉が弾ける orbBurst、当たり applyHit・性質を移す applyElem・反応 react・稲妻 chainLightning・conductWater、火 burstFire・ガスが爆ぜる boom、生き物の傷 damageMonster・プレイヤーの傷 hurtPlayer、生き物の近接の攻撃 monsterStrike、発動のルーン onKilledBy・かわした時 onDodged（かわした時の加護の効く間も始める）、立ち直り rallyOnHit・updateRally、命の一歩 updateLife（火の中で焼ける・体力の表示）、主が倒れた時 dropRune・lordFell、経験 gainExp、遅れて起きること later、魔法の場 addZone など）、
                     chant：詠唱と転がり（ゲームの時間の速さ timeScale・溜め始める beginCast・溜めが散る fizzle・放つ releaseCast・溜めを進める updateCast・転がる startRoll）、
                     projs：飛ぶ物と、毎フレーム続く戦いの跡を進める（飛ぶ物 updateProjs と光の月が弾ける moonBurst、状態異常 updateStatuses・生き物の時間の速さ monTimeK、遅れて起きることと魔法の場 updateZones・雨 updateRains、毒の霧に火が届く cloudsMeetFire）、
                     events：部屋の出来事を進める updateEvents と罠（踏んだ時 triggerTrap・見つける・網・鉄格子のレバー updateTraps）、
                     results：結果の画面（場所・伝承 runLore・awardLore・loreRows・墓に遺す物 graveCandidates・graveRows・saveGrave・勝った時 victory・結果の画面から暗くして新しい探索へ startNewRun）、
                     player：プレイヤーの動き updatePlayer・通れない所の当たり判定 solidAt・3人称のカメラ placeThirdPerson、
                     build：世界の組み立て（階の文字 buildWorld（文字を置く間の作業用の配列は、階ごとに作らず使い回す。持ち続けるのは13万字分だけで、それより多い階では組み立ての間だけ伸ばす）・霧の色 setFog・水面の絵 updateWater）、
                     three：three.js と後処理の部品 T と霧の色 fogCol（作る時に乱数を引く物は置かない）、
                     quality：速さに合わせて画質を下げる段の決め方 nextQuality と、下げ方を進める stepQuality と、数えるのが途切れた時の holdQuality（探索中の平均が 48fps を割ると、1段ずつ、描く細かさを 1 まで → 光のにじみを切る → 描く細かさを下限 0.75 まで。1 より下げると文字がぼやけるので、光のにじみを先に切る。1段下げても、フレームの時間が1割も縮まなければ（低電力モードの iPhone のように、端末が書き換えを1秒に30回までに抑えている時）、その1段を戻して、それからは変えない。変えた後は3秒おいてから数え、比べる前に数えるのが途切れたら（階を移る・止まる）、下げた1段を戻して下げ直す。src/game/30-loop-init.js の frame が呼ぶ。テスト用モードでは呼ばない）
src/lib/state.ts     ゲームの状態の入れ物（分野ごと：clock＝時計（ゲームの時刻 time と、tick が進んだ回数 frame）、blaze＝火と地面のマス（fire・fuel・burnt・scent・凍らせた水 frozen・踏み分けた茂み trampled など）、fight＝戦い（飛ぶ物 projs・光線・毒の霧・魔法の場・遅れて起きること・雨・床の目印・ヒットストップ・稲妻・宝物庫の落石 rockfall・倒れた生き物が崩れて積もった文字 debris など）、vfx＝揺れと光りと目の慣れ expo と階の場所ごとの空気 ambK と詠唱の間の画面の遅さ slowFx、ui＝画面の開け閉め（started・camMode・invOpen・ミニマップのキャンバス mapC と描き手 mctx・方向の矢印のキャンバス arrowCv と描き手 arrowCtx と下の HUD hotbarEl（矢印が避ける。上の端を覚える hotbarTop）・照準の文字を書く所 crossEl とその前の中身 crossKey・レベルアップの選択肢 lvlOpts・近くの祭壇 altarNear・プレイヤーが閉じた祭壇 altarDismissed・メニューの中に開いている物 menuPage・タイトルで選んだ始める深さ startDepth・タイトルの画面 introEl・装備の画面で選んでいるルーン packSel・下の一言 hintHTML とそれを出した回数 hintSeq・メニューの確かめ待ち・マウスを捕まえられないと決めたか plFailed・一度でも捕まえたか lockedOnce・最後に捕まえてから捕まえようとした回数 lockTries・最後に外れた時刻 unlockedAt・Esc のキーを処理している間か escKey・指で遊んでいるか touch・指で遊んでいて縦向きか portrait・タイトルに［開発用モード］を出すか devSeen（このページで一度でもオンだった）・Artifact の持ち主か owner・指でパネルの選択肢を1回押して選んだだけの物 tapArm・3人称のカメラの位置 camPos と自分の姿 avatar・装備の画面を開けた時の両手 packSnap・照準の先の生き物 aimMon・見た時の説明 lookPend・lookPendT・lookHTML と出す所 lookEl・炎から逃げた・叫んだ・草を食べる物が驚いた伝言の時刻と旗 fleeMsgT・shriekMsgT・grazeMsg・照準の先を探した時刻と生き物 aimT・crossMon・墓に遺せる物 graveCands・graveSel・開発用の godMode・茂みの伝言の旗 tallMsg など）、gfx＝描画の部品（three.js のカメラ camera とマスの絵 cellTex（TS の側の型は、TS が使う欄だけ）、場面 scene・描画する部品 renderer・分け合う値 U・後処理 finalPass・文字の部品 staticMat・occMat・区切りごとの文字 chunks・隠す板 occMesh・水面の絵 waterTex・waterLTex・霧の濃さの基 fogBase・粒子を描く形 ptGeo と属性 bpPos・bpCol・bpSize・bpGly。本当の値は 05-renderer.js・06-world.js・30-loop-init.js がその場で入れる）と、生き物の体だけを描くか drawBodyOnly、adv＝今の探索（runSeed・lvl・dead・年代記 HIST など）、gear＝手と詠唱（hands・bag・castSt など）、here＝今いる場所と階の中身（D・depth・branch・monsters・見えたマス・部屋の出来事 events・川のマス riverCells・最深部の状態 finalSt・その階で一度だけの巣・修復機・硫黄の伝言の旗 webMsg・brimMsg・その階で作った生き物の数 mobSeq・着いた階段のマス lockCell・入った部屋 visitedRooms・前の階の層 lastStratum など。monsters の型は makeMonster が必ず入れる欄を必ずある物にした Mob）、saved＝保存する記録（META・BOOK・RSEEN・SEEN・DEVALL と、今の探索の伝説の物 LEGEND）、player・指の操作の入力 thumb（アナログのスティックの倒し具合 stick）・placeMem・伝言の一覧 msgs・音 SND・忍び足 stealth・手元の灯り lantern・表示の数 hudInfo（今の階の見たマスの割合 explored・速さの表示の数・立ち直りの表示の数 rallyShown）・押しているキー keys・描く物の数 buf（置いた文字の数 dn・生きている粒子の数 pN）・灯りを描画に渡す配列 SL・DLP・DLC・マスの絵の中身 cellData・薄い氷に乗っていた秒 iceT・漂う塵 dust・通れない所に押し当てた記録 edge・手元の武器が跳ねた時刻 vmKick・光線を撃ち続けた記録 beamHold。古い JS は clock.time・vfx.shake・ui.started・gfx.camera のように欄で読み書きする。player から keys までと SL・DLP・DLC・cellData・iceT・dust・edge・vmKick・beamHold は丸ごと入れ替えないので名前のまま。buf は入れ物）
src/lib/generate.ts  迷宮の生成（generateLevel。「入力 → 結果」の形。入力 GenInput・古い JS の物 GenEnv・結果 GenResult と、部屋 Room などの型）
src/lib/bodies/*.ts  生き物の形（draw：生き物を描く drawMonster・drawMonster1・drawMonster0 と深みの主の触手 drawTentacles とクラーケンの立ち上がる腕 krakenArms、build：種類から形を選んで作る buildForm と、人型・四つ足の見た目の特徴、表 MTYPES に見た目を書き足す addLooks、kit：点の型と道具 q2・q3、
                     small・beasts・lords：各生き物の形と忘れられた獣（図鑑の見本 beastSamples も）、bosses：主の形（不死の王・蜘蛛の女王・ナーガの女王・古竜・深みの主・王の影の二つ目の姿）、
                     auras：主と一部の生き物のまわりの飾り（lichAura など）・王の影の変身 transformShadow・姿を変える途中 drawMorph）
tsconfig.json        TypeScript 7 の設定（strict・noUncheckedIndexedAccess・exactOptionalPropertyTypes など）。対象は src/lib/ と tests/unit/*.ts
vite.config.mjs      組み立て（Vite 8）。公開用は dist/、テスト用（--mode test）は .build/test/、claude.ai の Artifact 用（--mode artifact）は .build/artifact/index.html
tools/vite-plugins.mjs  Vite のプラグイン：legacyGame（src/game をつないで1つのモジュールに）・testPage（テスト版）・privateMaps（ソースマップを公開物の外へ）・noCssStub（ページの <style> から作られる空のモジュールを消す）・fontCss（@fontsource の CSS を絞る：woff を外し、BIZ UDGothic は BIZ_CHARS を含む面だけ）・homeScreen（公開用：ホーム画面に置くための宣言 manifest.webmanifest とアイコンを出し、HTML から読む。display は standalone）・inlineAll（Artifact 版：JS と CSS を HTML の中に書き込み、HTML 1つにする。16MB 手前の ARTIFACT_MAX を越えたら止める）
tools/game-source.mjs   ゲーム本体をつなぐ処理（gameSource）・行の対応・ソースマップ・テスト版のフォント
tools/icons.mjs      ホーム画面のアイコン src/icons/icon-192.png・icon-512.png を作る（タイトルのロゴの光る「A」。絵を変える時だけ走らせ、PNG を git に入れる）
tools/sourcemap.mjs  ソースマップの読み書き（自前の小さな道具）
tools/check.mjs      pnpm check の中身：構文と lint・型・整形・単体テスト・使う文字・組み立てを同時に走らせる（単体テストを先にし、ほかの段は優先度を下げて空いたコアで。通った段は1行、落ちた段は出力を全部出す）
tools/lint-game.mjs  src/game/ をつないで構文と lint を調べ、場所を元のファイルの行で出す（読んだ名前の宣言し直しと、状態の入れ物の名前の宣言も止める。入れ物の名前は src/lib/state.ts の export から取る）
tools/state-move.mjs 状態を入れ物に移す道具：古い JS の一番外の状態を、src/lib/state.ts の入れ物の欄に移す書き換え（名前の見分けは eslint-scope）。単体テストは tests/unit/state-move.test.mjs（小さな見本で確かめる）
tools/legacy-eval.mjs  テストの道具：古い JS のトップレベルの宣言を名前で取り出して評価する（移す前の古い関数を取り出して、新しい関数と結果を比べる。まだ古い JS にある関数を単体テストで本物のまま使う。型は .d.mts）
tools/same-code.mjs  移した関数が、移す前の古い関数と「同じ文」かを、構文の木で確かめる道具（型を外し、型のための決まった書き換えを元に戻して比べる。
                     規則と使い方はファイルの頭。古い JS は git の版（--rev）から読み、状態を移した名前は --state か --auto-state で古い側にも同じ書き換えをする。
                     PR の CI も、元の版と比べて走らせる）。単体テストは tests/unit/same-code.test.mjs
tools/where.mjs      組み立てた JS の場所 → src/game/ のどのファイルの何行目か（ソースマップで戻す）
tools/map.mjs        ゲーム本体の地図（ファイルごとの行の数と見出し）
tools/serve.mjs      静的ファイルの小さなサーバー（テストでは CORS の見出しを付ける。サンドボックスの iframe は起源が null になり、付けないと JS・CSS・フォントを読めない）
tools/shots.mjs      図鑑の生き物を、見やすい角度で写す（pnpm shots。向き・寄る引く・見下ろす角度は形ごとの表。--views で、生き物ごとに角度の一揃い（正面・斜め前・横・後ろ・上から・歩く姿・遠くの7枚）と、
                     7枚を体のまわりで切り抜いて大きくし横に並べた1枚。--compare で、前に写した物と同じ枠で上下に並べた1枚。写真は tests/out/shots/。切り抜いて並べる処理は tools/sheet.mjs）
tools/case-diff.mjs  指紋を取る単体テストの「場合の書き出し」を、前の版（--rev、既定 origin/main）の src/ と今の src/ で比べ、どのテストの、どの呼び出し・どの生き物の・どの欄が違うかと、
                     行ごとの最初の違いをまとめる（指紋を作り直す前に、違いがねらった所とそれに続く物だけかを確かめる。テストは書き出しの道具 tests/unit/case-out.mjs を使う。
                     まとめは tests/out/case-diff/summary.txt。2分ほど）。--update で、比べ合わせはせず、落ちた指紋の値だけを今の値に書き換える（caseOut のすぐ後の行で、
                     期待していた値がその行の値と同じ時だけ。ほかの失敗は触らない）。単体テストは tests/unit/case-diff.test.mjs
tools/feel.mjs       手触りの試し打ち（node tools/feel.mjs [aim|walk]。人の指のくせを仮に置いた自動の操作で、750×312 のスマホの真似で課題をやらせ、設定ごとの成績を比べる。
                     狙う：見回す速さ（--look）と合わせる幅（--win。照準の助けが効く角度を比べる時に）ごとの、向きを合わせるまでの時間・行き過ぎ・持ち替え。歩く：8方向とアナログのスティックの、道なりに着くまでの時間・壁に押し当てた割合・
                     道からのずれ。指のくせの値はファイルの頭の HAND。比べ合いにだけ使い、気持ちよさは本物の指で確かめる。CI には入れない。結果は tests/out/feel/summary.json）
tools/field.mjs      生き物を本物の階（既定は深さ 1 と 3）に置き、向かってくるところを 4m・3m・2.5m で写し、3m ほどで照準を合わせた1枚も写す（pnpm field <名前>。照準が当たると明るく描くので、ふだんは少し横を見る）。
                     体のまわりで切り抜いて並べた <名前>-field.png。--rev <版> で、src/ だけを前の版にした一時的な作業場所でも写し、階ごとに前・今を同じ枠で上下に並べる。写真は tests/out/field/。
                     見た目を直す時の最後の確かめ（迷宮の灯りの下では図鑑より明るく見える）。主・忘れられた獣は pnpm lords
                     --kill [1,4,10,30,90,240,330] で、距離ごとの代わりに、4m（大きな物は体の大きさの2倍）で倒して、倒してからのフレーム数ごとに写し、時間の順に横に並べた <名前>-kill.png
                     （倒した後は体が無いので、倒す直前の体の範囲を 1.6 倍に広げた枠で切り抜く。積もった文字に重なる、見た時の説明と行く先の矢印は隠す。倒れ方を直す時に）
tools/glare.mjs      敵に攻撃を当てた時の眩しさを数える（pnpm glare [名前…]。本物の階で生き物に照準を合わせ（tests/lib.mjs の aimAt）、近接（blade）と飛ぶ物（bolt）で当て（strike）、
                     当てる前の1枚と、当たった次のフレームから光り終わる（hitT が 0 になる）フレームまでを1枚ずつ写す（場合ごとに自分のページで、3つずつ同時に）。--hide 段,…（tick の段の名前。例：hands,swing。体は 'mob draw'、剣の波は飛ぶ物の 'projs'）で、
                     その段を止めて（__test.skipPhase）撃った数も、止めない時と並べて出す（何が光っているかの切り分けに）。体の範囲の白飛び（3つの色がどれも 245 以上）・眩しさ（明るさ 200 以上）・明るさの平均と、画面全体の眩しさ、写した時の hitT・glow・照準の先かを出す。
                     写真・体のまわりを切り抜いて並べた glare.png・summary.json は tests/out/glare/。CI には入れない）
tools/sheet.mjs      写真を体のまわり（__test.monsterView の画面の範囲）で切り抜いて大きくし、枡に並べた1枚にする（cropRect・writeSheet。shots.mjs・field.mjs・glare.mjs が使う）
tools/lords.mjs      主たちを本当にいる場所（支道の奥の階・最深部）に置き、プレイヤーの目の高さから写す（pnpm lords。主の体が描かれた画面の範囲・はみ出し・
                     主の体が足した眩しい画素の割合を出す。写真・眩しい所を赤く塗った写真・summary.json は tests/out/lords/）
tools/transitions.mjs  場面が切り替わる時の確かめ（node tools/transitions.mjs [--rate 1,4]。Artifact 版をテスト用モードでなく 750×312 で開き、偽の window.claude の持ち主として、
                     迷宮に入る → 階段で3回下りる → 死ぬ → ［新しい探索へ］ → 画面の向きを変えて戻す、を本物の時計で通す。書かれた診断の記録を diag-report.mjs の表で出し、
                     自動再生を許さないブラウザの真似で音の部品が押した時に動き出すか・かかった時間が場面ごとに書かれるか・同じ大きさの resize で作り直さないかを確かめる。
                     時間は CPU で描くこの環境の値。CI には入れない（数分かかる）。記録は tests/out/transitions/）
tools/title-shots.mjs  タイトルの画面を、開き方（ふつうの人・共有された Artifact・持ち主・?dev=1・持ち主で開発用モードがオン）と画面（750×312・iPhone 13 横・1280×720）ごとに写す
                     （node tools/title-shots.mjs [--keep]。Artifact 版をテスト用モードでなく開く。開発用の物が誰に見えるかと、送らずに見えるか・倍率を出す。写真と summary.json は tests/out/title-shots/。CI には入れない。1分半ほど）
tools/auto-run.mjs   自動で試す台本（?auto）を、この環境でスマホの遅さを真似て流す（node tools/auto-run.mjs [--cond lowpower,slow] [--rate 4] [--laps n]。既定は短い台本 ?auto=quick で、条件ごとに5分ほど。--laps n でふつうの台本を n 周（1周で20分を越える）。CI には入れない）。
                     Artifact 版を 750×312 の指の端末として、偽の window.claude の持ち主で開く。CPU を --rate 倍遅くし、ページの performance.now と rAF の時刻を「見かけの時計」にする
                     （この環境は CPU で描くので1秒に数フレームしか出ない。本当にかかった時間を K で割り、K は自動で試さないページのタイトルで測って、見かけの速さが条件の fps になるように決める。Date.now も見かけの時計。
                     lowpower は 50fps を1秒に30回までに抑える＝低電力モードの iPhone、slow は 35fps。どちらも1秒に60回より速くはしない）。記録を diag-report の表で出し、tests/out/auto/<条件>.json に置いて、
                     前の結果（<条件>.prev.json）と段ごとに並べる。確かめること：エラーが無い・全部の段を通る・lowpower では画質を下げても戻して止まる・slow では戻さない
tools/diag-report.mjs  診断の記録を表にする（node tools/diag-report.mjs <ファイルかフォルダ…>。ArtifactData の道具の list に out_dir を付けて保存した JSON。
                     音の部品の移り変わり・かかった時間の名前ごとの回数と中央と最大・遅いフレームを近くの処理ごとに・メニューの押し方（menuRows。1.5秒以内に別の項目を押した・切り替えを押し戻した回数）・自動で試した段の表（autoRows）・画質の移り変わり（qualitySteps）・時刻の順の一覧。--compare で、自動で試した段と画質を前と今で並べる（compareRows））
tests/lib.mjs        テストの共通部分（組み立て・配信・ブラウザ（描き方の引数 GL_ARGS）・テスト用モードのページ。newPage の device で、Playwright の端末の名前（スマホの真似）で開ける。ページはポインタロックを差し替えて止める（realLock で止めない）。環境変数 AL_PREBUILT が 1 なら、組み立て済みとして組み立てない。withBrowser の root で、別の作業場所を組み立てて配信する（tools/field.mjs の --rev）。
                     生き物を撃つ部品：aimAt(pg, 鍵) は、照準の先（__test.mob(n).aimed）になるまで dbg.look で体の高さの真ん中を向いて 1/30 秒ずつ進める（12 回でなれなければ Error）。
                     strike(pg, 手, 鍵) は、押して、近接ならすぐ当たり、溜める武器なら cast.full まで待って向き直してから離し、体力が減るまで描かずに 1/30 秒ずつ進める（{hit, frame} を返す。150 フレームで当たらなければ Error）。
                     tools/glare.mjs と tests/world.mjs の 18 が使う）
tests/run.mjs        ブラウザのテストをまとめて走らせる（pnpm test）：テスト版と Artifact 版を1回だけ組み立て、12のテスト（画面写真の比較 visual も。一覧はおよその秒の表 SEC。tests/ に SEC にも部品の一覧 NOT_TESTS にも無い .mjs があれば止める）を同時に3つずつ走らせる（--jobs で数、名前を挙げるとそれだけ、--shard i/n で n 組に分けた i 組目だけ。分け方はおよその秒の表 SEC で、組ごとの合計が近くなるように決める）。
                     どのテストも自分のブラウザと空いているポートを使うので、ぶつからない。出力（標準出力と標準エラー）はテストごとにまとめて出す。1つが10分を越えたら止めて、それまでの出力を出す。
                     同じ出力を tests/out/run/<名前>.log にも書く（走らせ始める時に前の回の物を書き直し、出力が来るたびに書き足すので、時間切れ・シグナル・この道具ごと止められた時も、そこまでが残る。
                     頭に始めた・終わった日時と終わり方（終わりのコード・時間切れ・シグナル・走っている途中）。走らせなかったテストの前の回のログは残る。CI では、tests/out/ ごとアーティファクト test-out-<組> に上げる）。失敗した時は「失敗：…」の行の後にそのログのパスを出す
tests/smoke.mjs      開発用の探索で dbg が動くか ＋ 探索の始め直しで前の場所や状態が残らないか ＋ メニューの「もう一度押して確かめる」待ちが4秒で消えるか ＋ 図鑑を開いても探索の記録が変わらないか ＋ 閉じた祭壇の画面が、装備の画面やメニューを開いて閉じても、離れるまで開かないか ＋ 起きている竜を見た時の伝言 ＋ 最深部で伝説の物を3つ持つと王の影が出て、背の高さと画面への収まりが決めたとおりか、体力を減らすと二つ目の姿になり、大きさが天井に合うか ＋ 伝説の物が揃っていない時は、12階の異界を抜けても最深部に出ないか（画面写真は tests/out/）
tests/auto.mjs       自動で試す（?auto=quick）を、テスト用モードでなく本物の時計で流し、エラーが無い・全部の段を通る・うまくいかなかった段が無い（撃って当たったかも）・診断の記録の欄 auto・
                     ゲームの保存を localStorage に書かない（ほかの名前は書ける）・途中で開かせたレベルアップの画面を閉じて進む・25秒隠れていた間（フレームを止めて真似る）を最長のフレームに数えない、
                     を確かめる ＋ タイトルの［自動で試す］と［開発用モード］が持ち主の時だけ出て（共有された Artifact を持ち主でない人が開いた時は出ない）、［自動で試す］を押すと3周で始まり、歩いている途中で［止める］を押すと、台本の指が離れてスティックが消えるか（この環境で2分ほど）
tests/title.mjs      タイトルの画面（どれもテスト用モードでない時のページ）：タイトルの画面が出るか（遊ぶ人には［開発用モード］・［自動で試す］が出ない）＋ 開発用モードのまま読み直した時・保存が使えない時（持ち主として開き、遅れて出る［開発用モード］をオン・オフする）のタイトル ＋
                     自動再生を許さないブラウザの真似で、音の部品がタイトルでは動かず、［迷宮に入る］を押すと動き出すか（診断の記録で見る）（画面写真は tests/out/）
tests/page-fakes.mjs  テストと道具の部品：偽の window.claude（fakeClaude）・自動再生を許さないブラウザの音の部品の真似（strictAudio。本物の操作の事件を処理している間に作るか resume した時だけ動く。
                     navigator.userActivation は Playwright の evaluate も操作として数えるので使わない）・診断の記録を今すぐ書かせて読む readDiag
tests/frame.mjs      サンドボックス付きの iframe の中（allow-scripts だけ。claude.ai の Artifact より厳しく、localStorage にさわると SecurityError、ポインタロックは断られる）で、
                     タイトル → 探索 → ドラッグで見回す → Esc でメニュー → レベルアップ → 祭壇 → 死 → 始め直し → タイトル → 図鑑 → 探索が、ページのエラーなしで通るか ＋
                     requestPointerLock が無い・呼んでも何も起きない・音の部品を作れないブラウザ（初めに動く台本で作る）でも、Esc でメニューが開き、ドラッグで見回せるか ＋
                     はじめの流れを Artifact 版（.build/artifact/index.html）でも通し、ほかのファイルを読まないか ＋ Artifact 版を、テスト用モードでなく開いてもタイトルが出るか
tests/touch.mjs      指で遊ぶ時の土台（スマホの真似で、テスト用モード）：タイトルの枠がどの端末でも画面に収まるか（縮める下限まで縮めても収まらない時だけ縦に送る。開発用モードでなければ、ホーム画面に置く案内と試練が出ても、スマホの横向きで送らずに収まる）＋
                     指で「迷宮に入る」を押すとマウスを捕まえにいかずに始まるか ＋ 描く画面を指で押しても左手の詠唱が始まらないか（iPhone と同じ順番の事件（指の後に mousedown）でも）＋ [装備] [メニュー] で開け閉めできるか・
                     [全画面] はタイトルで全画面にできる時だけ出るか ＋ マウスを動かすとタッチのボタンが消えるか ＋ 探索中のタッチのボタンと指の操作のボタンが、状態の表示・ミニマップ・下の HUD・互いと重ならないか（本物の大きさ 750×312 も）＋
                     指の操作（CDP の Input.dispatchTouchEvent で2本の指）：スティックで進む・離すと止まる・右半分で見回す・同時に・拡大されない・見回した直後もボタンが効く・
                     [右手] で溜めて、ずらすと見回し、離すと終わる・指を取り逃しても終わる・[回避]・ページが隠れるとメニューが開いて止まり、触れている指は離したことになり、溜めきった詠唱も放たない・メニューの間は動かない・レベルアップと祭壇は2回押して決まる ＋
                     本物の大きさ 750×312 で：左下の伝言と下の HUD が重ならない・初めて指で入った時の一言・メニュー・装備の画面・レベルアップ・祭壇・結果の画面が画面に収まる（装備の画面は中を送れて、
                     中を書き直しても送った所が残り、袋のルーンを選ぶと、はめられる枠が見える所まで送る）・メニューの中に開く操作の案内と魔導書・メニューの見回す速さ（押すと段が回り、開き直したページにも残る）・ビルドを2つ保存すると [持ち替え] が出て持ち替える（溜めている間は持ち替えない）・
                     レベルアップと祭壇の間は [装備] [メニュー] が隠れる・指の時の案内の文言・パネルの行のボタン（タイトル・メニュー・装備・レベルアップ・祭壇・結果・図鑑）の押せる範囲が文字の外まで広がり、隣のボタンを覆わない ＋ 縦向きの間は探索を止めて横にする案内を出す（タイトルとマウスの時は出さない。縦のまま死んでも、結果の画面から新しい探索へ進める）＋ ホーム画面に置く案内（iPhone の Safari で、ホーム画面から開いていない時だけ。指で触れない端末では出さない）＋ iPhone の横向きの切り欠きとホームの棒（CDP で safe-area-inset を真似る）を、端の表示とボタンが避けるか ＋
                     図鑑を指で動かす（1本指で回す・2本指でつまんで寄る・[向きを戻す]・背の低い画面で枠が画面の上半分に掛からない・マウスで開いた後に指で触ると案内が変わる・離れた知らせを取り逃した指が残っても回せる・回している途中に隠れても、戻ればひとりでに回る）＋
                     診断の記録：偽の window.claude（tests/page-fakes.mjs）で、持ち主なら端末・できごと・速さ・かかった時間・遅いフレーム（40件を越えたら短い物から捨てる）・メニューで押した項目とその前の項目からの秒（閉じて、すぐ開き直しても前の項目を持たない）を書き、持ち主でなければ書かないか・書き込みの途中に頼まれた分も後で書くか
tests/gallery.mjs    図鑑：全部の生き物を立つ・歩く・眠るの姿で出して、例外・描いた文字の数・NaN を確かめる ＋ 図鑑を手で動かす（ホイールで寄る・引く、ドラッグで回す・見下ろす、離すとしばらく止まってまた回る、R と ← → で戻る、ドラッグが外れる、背の高い生き物に寄ると狙う点が上がる） ＋ ほかの所で見た目の乱数を余分に引いても、前に別の生き物を出しても、図鑑の写真（画面写真の比較の4体）が変わらないか（違えば、3つのページの画面写真を tests/out/gallery-rand/ に残す。走らせるたびに空にする） ＋ 出してすぐ __test.galleryDraw で覗いても、後の描いた物が変わらないか
tests/gallery-specimens.mjs  画面写真の比較で写す図鑑の4体と写し方（visual.mjs と gallery.mjs が使う）
tests/world.mjs      世界とのやり取り：扉・火・氷と冷気・小さな生き物（修復機・清掃機・猟犬）がマスや扉を変える処理（扉が視界を遮る・燃え尽きる・修復機が作り直す、階に残る物が階を移ると消える、猟犬が匂いの無いマスを追わない、硫黄・氷・冷気と火、薄い氷に乗っていた秒が階を移ると0に戻る、火口が噴き上がって溶岩が流れ、引き、また噴き上がる、溶岩の上に立つ生き物がいない・引き始める前に生き物のいないマスの穴が残らない、吹き飛ばされた生き物が溶岩の手前で止まる、攻撃を転がってかわすとかわした時の加護が効き、ただ転がっただけでは効かない、宝物庫の落石がゲームの時刻で進む（溜めている間は半分、止まっている間は進まない、階段を下りて暗くなり始めたら進まない）・階を移ると消える）、倒れた生き物が崩れて積もる（残す文字の数の上限・光とみなしてすぐ消す文字は半分より少ない・床より下に沈まない・高い塔にならない・倒れた所の近く・しばらくして全部消える・同時にたくさん倒れても崩れる体は12まで）、敵に攻撃を当てても画面が白く飛ばない（トロルに照準を合わせ、すぐ近くで小剣を当てた時、画面全体の眩しい画素が 25% 以下で、体は当てる前より明るくなる）。生き物は全部消してから、要る物だけ置く
tests/determinism.mjs  同じシードで同じ結果になるか ＋ tick の段の終わりごとと tick の外で見た目の乱数を余分に引いても、戦いと生き物の動き・伝言・画面写真が変わらないか（__test.tickNoise）＋
                     描くだけの段（hands・swing・mob draw）を止めても、戦いと生き物の動き・伝言が変わらず、画面写真は変わるか（__test.skipPhase）＋
                     見た目の乱数を余分に進めても、眠っている生き物・祭壇の中身・レベルアップの選択肢・代わりのルーン・宝物庫の番人の場所と、
                     生き物の形と初めの値（階の生き物・途中で呼び出した生き物・宝物庫の番人。__test.mobLooks）が変わらないか ＋ 世界を組み立てる間に見た目の乱数 mr() を引かないか（__test.worldDraws）
tests/levels.mjs     全部の階（20シード×30か所）をブラウザで生成し、例外と、歩いて行けるかを確かめる
tests/reach.mjs      歩いて行けるかの調べ方（levels.mjs と tests/unit/reach.test.ts が使う。型は reach.d.mts）
tests/visual.mjs     画面写真の比較（16場面：層ごとの世界・手元の武器・パネル、図鑑の生き物4体（1280×720。枠を隠し、__test.galleryShow で向きと姿を止め、寄って真ん中に写す）。基準は tests/baseline/）
tests/inventory.mjs  装備の画面のテスト：持ち物の用意を3通り（全部開ける・何も開けない・一部だけ）にして、ボタンをシードの乱数で押し（選ぶ・はめる・外す・ページ送り・
                     ビルド・ダブルクリックとゆっくり2回・マウスを乗せる・右クリック）、押すたびの装備の画面と下の HUD の HTML の指紋を、基準 tests/baseline/inventory.json と比べる
                     （違えば何回目からかを出す。記録は tests/out/inventory-<用意>.log。--update で基準を作り直す）
tests/panels.mjs     枠のテスト（全部の文字の幅が visW どおりか、操作・装備・メニュー・レベルアップ・祭壇・結果の縦線と、一覧の名前の列が揃うか）＋
                     十字の下の並び（「クリックで視点操作に戻る」は説明があってもなくても同じ場所、説明と、行く手を塞がれた時などの一言は、その下に 8px ずつあけて並ぶ）＋
                     十字の下の一言が消える時（表示・音量・ビルドの持ち替えの一言は自分の時計の後に消え、後から出た一言は消さない。行く手を塞がれた時の一言は、塞がれなくなって 0.9 秒ほどで消える）
tests/unit/generate.test.ts  迷宮の生成の単体テスト（同じ入力なら同じ迷宮・生き物の表に書き込まない・全部の場所の指紋。Node で数秒）。
                     歩いて行けるか（5シード）は reach.test.ts（ファイルを分けて、並べて走らせる）。共通部分（全部の場所・gen）は gen-places.ts
tests/unit/altars.test.mjs  祭壇とルーンを置く処理の単体テスト。たくさんの場合を作る altar-cases.mjs（テストの中で小さな階を作る）を使う
tests/unit/choices.test.mjs  遊びの中身を選ぶ所（祭壇の中身・レベルアップの選択肢）が、見た目の乱数を引かないか・鍵が同じなら順番によらず同じ選択肢か・主の祭壇はほかの祭壇と別の名前の乱数か・選び方が乱数を分ける前と同じか
tests/unit/place.test.ts  階ごとに祭壇とルーンを置く処理と、階のシード・生き物の強さ・墓のルーン・試練の単体テスト。たくさんの場合を作る place-cases.ts（Node で本物の迷宮を生成する。
                     迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/ui.test.mjs  伝言・下の HUD・手の枠・保存・ルーンの説明・拾ったルーンを入れる処理の単体テスト。偽の画面の部品と偽の localStorage で、
                     たくさんの場合を作る ui-cases.mjs を使う
tests/unit/status.test.mjs  状態の表示・気配・年代記・操作の案内・魔導書・見つかった時・物音・立ち止まって調べる・伝説の物・マスの明るさの単体テスト。
                     たくさんの場合を作る status-cases.mjs（Node で本物の迷宮を生成し、偽の画面の部品に書く。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/draw.test.mjs  階に置いてある物と、火と術の跡を描く処理・先にある物の手がかりと階段の封・伝説の物の読み方と描く処理・特別な階の場所・天井の高さの単体テスト。
                     たくさんの場合を作る draw-cases.mjs（Node で本物の迷宮を生成し、全部の種類の備品・巣・床の物・稲妻・生き物を足す。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/monsters.test.mjs  生き物を作る・歩いて行けるか・次に向かうマスと、小さな生き物と地面の処理・叫び声の音の単体テスト。たくさんの場合を作る monsters-cases.mjs
                     （Node で本物の迷宮を生成し、表の全部の種類の生き物をいろいろな湧き方で作り、火・灰・匂い・焼け落ちた扉・苔・茂み・硫黄・薄い氷・水を足して、何歩か続ける。
                     分かれ道ごとの場面（叫ぶ・扉を直し終える・匂いを嗅ぎつける・行き止まり・硫黄がまとめて燃える）も通す。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/mob-rand.test.mjs  生き物が初めて描かれる時に作って覚える見た目（眠った姿・不死の王の剣・古竜の宝・深みの主の灯り）と王の影の二つ目の姿が、それまでに見た目の乱数を何回引いたかで変わらないか
tests/unit/fight.test.mjs  詠唱と当たり・反応・ダメージ・プレイヤーの傷・照準と線・術の中身・結果の画面・プレイヤーと生き物の動きの単体テスト。たくさんの場合を作る fight-cases.mjs
                     （Node で本物の迷宮を生成し、表の全部の種類の生き物と、両手の武器・枠・特性・加護をいろいろにして、武器の種類ごとの詠唱・反応ごとの当たり・分かれ道ごとの場面・崩れた体の上限を越えるまで続けて倒す場面を通す。場面の初めに、たまるだけで読まない飛ぶ物・稲妻の跡・崩れた体を片付ける（呼ぶたびに取る状態の指紋を小さくするため）。
                     遅れて起きることと setTimeout は、時計を進めながらここで流す。偽の画面の部品 fakeDom・偽の setTimeout fakeTimers も。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/step.test.mjs  詠唱と転がり・飛ぶ物と戦いの跡を進める処理・詠唱の声・剣の波を描く・火とガスと地面を進める処理・部屋の出来事と罠・神託所の手がかりの単体テスト。たくさんの場合を作る step-cases.mjs
                     （Node で本物の迷宮を生成し、両手の武器と特性と加護をいろいろにして、詠唱を始めて溜める・離す・溜めすぎる、転がる、的へ向いて撃った飛ぶ物を何歩も進める、状態異常・魔法の場・雨・毒の霧、
                     火とガス、部屋の出来事の種類ごと（火口の噴き上がりは最後まで）、罠の種類ごとの場面を通す。溶岩の流れる道に通れない所があれば、場合の前提が崩れたとして止まる。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/pickup.test.mjs  足元の物を拾う処理・宝物庫の褒美と落石・立ち直りの光の粒・最深部（王の影）の単体テスト。たくさんの場合を作る pickup-cases.mjs
                     （Node で本物の迷宮を生成し、拾う物の種類ごとの物と生き物を置いて、拾える距離の内と外・番人が倒れる・鍛える・枠を開ける・癒す・開ける枠の数ごと・
                     番人が起きる・天井が崩れて石が当たる・光の粒が着く・王の影が二つ目の姿になり亡霊を呼ぶ、の場面を通す。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/panels.test.mjs  レベルアップ・祭壇・メニューのパネルと、命の一歩 updateLife の単体テスト。たくさんの場合を作る panels-cases.mjs
                     （Node で本物の迷宮を生成し、祭壇の組の種類ごと（ルーン・主・鍛え・空の枠・癒し・番人のいる物）と生き物を置いて、レベルアップの画面（説明・開いてすぐのクリック・
                     恩恵とルーン・続けてもう一度・指の2回押し）・祭壇の画面（開く距離・やめる・右クリック・離れるまで開かない・止まっている間・選ぶ）・メニューの全部の項目と
                     確かめ待ちが4秒で戻る・タイトルに戻る・火の中で焼ける、の場面を通す。偽の画面の部品は、書いた HTML からボタンと説明の欄を読み取り、listener に偽のイベントを渡す。
                     新しい階・新しい探索・装備の画面の開け閉めは vi.mock で、呼んだ記録だけ取る物にする。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/lava.test.mjs  溶岩の流れ（火口の噴き上がりと部屋の出来事の流れ）と吹き飛ばしの単体テスト。Node で生成した火山の異界の階に、壁で囲んだ床の区画を書き込み、
                     生き物・出来事を置いて updateEvents・updateStatuses を直に呼ぶ（updateMonster は呼ばないので、生き物は置いた所から動かない）。溶岩に住む生き物のマスに流す・
                     重なる2つの火口がずれて噴き上がる・部屋の出来事の流れと噴き上がりが重なる・速さが 0 になるフレームに壁や溶岩へ入る・両側に溶岩がある・体の真ん中が溶岩に入っている、の場面
tests/unit/level.test.mjs  階を移る処理（newLevel・advance・checkEvents・die・newRun）と世界の組み立て（buildWorld・setFog・updateWater）の単体テスト。たくさんの場合を作る level-cases.mjs
                     （探索を始め、進む向きと場所と着く所を変えて階を移り、階段・門・穴・封じられた階段を踏み、死んで結果の画面のボタンを押す。three.js の物は Node でも本物を作り、
                     描画する部品だけ偽物。迷宮の生成を変えると、この指紋も変わる。単独で15秒ほど、ほかのテストと同時なら25秒ほど。ほとんどは本物の newLevel・buildWorld の時間）を使う
tests/unit/traits.test.mjs  特性を名前で読む所（TL・tv・wTL）が、どれも特性の表（src/lib/runes.ts の TRAITS）にある名前か（src/lib/*.ts と src/game/*.js を構文の木で調べる）
tests/unit/case-out.mjs  指紋の元の文を書き出す caseOut と、状態の指紋 stateFp（環境変数 AL_CASES_OUT がある時だけ、書き出し、状態を欄ごと・生き物ごとの指紋にする。tools/case-diff.mjs が使う）。
                     指紋を取るテストを足す時は、指紋を比べる行の前に caseOut('名前', 文) を置く
tests/unit/same-code.test.mjs  tools/same-code.mjs の単体テスト（規則ごとに同じと言う物・違うと言う物、抜けた文・係数・比べ方・乱数を引く順番の違いを見つけるか）
tests/unit/view.test.mjs  カメラから見て描く・調べる処理（生き物を描く・罠と鉄格子を描く・見た時の説明・灯りの揺らぎと灯りの配列・照準）の単体テスト。たくさんの場合を作る view-cases.mjs
                     （Node で本物の迷宮を生成し、全部の種類の生き物・罠・床の物・灯りの種類を足し、偽のカメラ（位置だけ）を物へ向ける。説明の分かれ道ごとの場面も通す。
                     迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/motes.test.mjs  粒子を動かす処理（塵・沼のガスの粒・川のさざ波・粒子と火の粉、GPU に渡す数）の単体テスト。たくさんの場合を作る motes-cases.mjs
                     （Node で本物の迷宮を生成し、降る物・川のマス・ガスの濃さ（境の値と上限に届く沼）・火の明かり・遠い塵や天井より上の塵・動き方ごとの粒子（尽きる物・数の上限の近く）を変えて、
                     何フレームか進める。迷宮の生成を変えると、この指紋も変わる）を使う ＋ 濃い沼でガスの粒が上限に届いても、プレイヤーに近い所から埋まるか ＋ 上限に届かない時は、ガスのあるマスごとに濃さどおりの数の粒が出るか
tests/unit/hints.test.mjs  方向の矢印・階の場所ごとの空気・床のルーンと置いてある物の光・術が飛ぶ道・詠唱の見た目・照準の文字の単体テスト。たくさんの場合を作る hints-cases.mjs
                     （Node で本物の迷宮を生成し、祭壇の組・台・主の褒美・宝物庫の褒美・空の枠・泉・墓・石碑を、矢印や描く距離の境の前後にも置き、分かれ道・階段までの距離・光線・飛ぶ物・生き物・
                     両手の武器と性質・溜め・付け替え・見たマス・矢印のキャンバスの大きさと画面の倍率・下の HUD の位置を変える。偽の描き手にした全部のことと照準の文字・後処理の uniform に書いた物も記録する。
                     迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/hands.test.mjs  手元の武器（形と色の表・弦を引く手・描く処理 drawViewWeapons）の単体テスト。たくさんの場合を作る hands-cases.mjs
                     （Node で本物の迷宮を生成し、壁・扉・マップの外へいろいろな距離で向け、画面の比・両手の武器・性質・詠唱・振る・撃った跳ね・速さと、描かずに戻る分かれ道を変える。
                     置いた文字と出した粒子を丸めずに記録する。迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/camera.test.mjs  霧と目の慣れ・3人称の自分の姿・岩の中か・岩の断面の単体テスト。たくさんの場合を作る camera-cases.mjs（Node で本物の迷宮を生成し、層の種類と洞窟の部屋・
                     近くの生き物と備品（溶岩・火口）・図鑑の目を合わせる段・1人称と3人称・目の高さ・速さ・転がる・カメラの位置を変える。偽の uniform を使う。迷宮の生成を変えると、この指紋も変わる）を使う ＋ 描かれない生き物（見えない・化けている・潜ったうなぎ・沼に沈んだ・3 より遠い茂みの中）を、目の慣れの明るさに数えないか ＋ bodyUnseen の境（うなぎ 0.08・沼 0.25・茂み 3）
tests/unit/minimap.test.mjs  ミニマップ（キャンバスの大きさと描く処理）の単体テスト ＋ 燃えている枯れ草と飾りのマスは火、燃え尽きた枯れ草は灰で描くか。たくさんの場合を作る minimap-cases.mjs（偽の描き手が、欄に書いた値と呼んだ関数を全部記録する。
                     Node で本物の迷宮を生成し、地面・液体・扉・火・灰・毒の霧・備品・床の物・罠・鉄格子・クモの巣・生き物を散らし、見たマスと今見えているマスとプレイヤーの位置を変える。
                     迷宮の生成を変えると、この指紋も変わる）を使う
tests/unit/screens.test.mjs  粒子と置く文字・頭の上の印・装備の画面の開け閉めと付け替えの詠唱・マウスを捕まえる・視点・音量の単体テスト。たくさんの場合を作る screens-cases.mjs
                     （偽の画面の部品が、したことを記録する。マウスを捕まえる時の返し方も変える）を使う
tests/unit/bodies.test.ts  生き物の形の性質（点の座標が有限か・文字の番号が表の中か・眠った獣の形・深みの主の触手）と、src/lib/bodies/ の各生き物の形の指紋（形と、形を作る時に見た目の乱数を引く順番が、思わず変わっていないか）
tests/unit/bodies-legacy.test.mjs  形を選んで作る処理（buildForm と見た目の特徴）・まわりの飾りと王の影の変身・図鑑の見本の獣・忘れられた獣の記録の指紋（思わず変わっていないか）。
                     たくさんの場合を作る bodies-legacy-cases.mjs（全部の種類と主・古い形・年代記の獣の形、見た目の特徴を直接足す、まわりの飾りを何フレームか続けて呼ぶ、
                     偽の Web Audio と偽の localStorage）を使う。頭の上の印の高さ（src/lib/hud.ts の MARK_H と markHeight）が、表のどの種類でも体の一番上より 0.1 から 0.7 上か
                     （水から出入りする魚・ウナギ・クラーケン、主・忘れられた獣、印を出さない種類は除く）
tests/unit/auto.test.ts  自動で試す（src/lib/auto.ts）の URL の読み方と、台本の段の並び
tests/unit/diag-report.test.mjs  診断の記録の表（tools/diag-report.mjs）の単体テスト（メニューの押し方の数え方・画質の移り変わり・前と今の比べ方）
tests/unit/inline-all.test.mjs  Artifact 版の組み立て（inlineAll）が、JS と CSS を中に書き、壊れる形（</script・<!--・</style）・HTML の外に残るファイル・大きすぎる物を止めるか（出力の束の小さな偽物で）
tests/unit/modules.test.mjs  src/lib のどのモジュールも、単独で読めるか（読み込みが輪になって、まだ作っていない値を使っていないか。ファイルごとに別の Node で読む）
tests/unit/audio.test.mjs  音を鳴らす処理と詠唱の声（chantStart）の単体テスト（音を鳴らす所が見た目の乱数を引かないかを、src/ を構文の木で調べる sound-random-check.mjs も）。偽の Web Audio（fake-audio.mjs。作った部品・値・つなぎ方・鳴らす時刻を全部記録する。Node には Web Audio が無い）と、
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
.github/workflows/ci.yml  確かめるだけの CI。pnpm check（ジョブ static。PR では、移した関数が移す前と同じ文かの比べ合わせ tools/same-code.mjs も）と、ブラウザのテストと画面写真の比較
                     （ジョブ browser。2台のランナーに --shard で半分ずつ。Chromium は headless shell だけ入れる）を別のランナーで同時に走らせ、ジョブ check が結果をまとめる（ブランチの保護で必須にするのは check だけでよい）。どれも違えば失敗
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
- Artifact 版（`--mode artifact`）は、公開用と同じ組み立ての、フォントを CSS の data URI にし（`assetsInlineLimit`）、JS と CSS を `index.html` の中に書き込んだ物（inlineAll）。
  Artifact は外から読める物が決まっていて、同じ所に置いたファイルを読めるかは決まりに無いため、HTML 1つにしている（約7MB）。ソースマップは出さない（中に書くと行が合わない）。
- 使っていない関数も消さない（`vite.config.mjs` の `rolldownOptions`。Vite は minify: false でも、使っていないコードを消す設定を渡すため）。
`dist/` と `.build/` は生成物なので git に入れない。直接編集もしない（権限で止めている）。

## 組み立て・実行・テスト（Node 26・pnpm 12）
```
pnpm install --frozen-lockfile   # 依存を入れる（クラウドのセッションでは SessionStart hook が Node・pnpm ごと自動で行う）
pnpm check            # 構文 + lint（エラーだけ。型の情報も使う） + 型（tsc） + 整形の確かめ + 単体テスト（Vite の組み立ても試す） + 使う文字 + 組み立て（公開用と Artifact 版）。段は tools/check.mjs が同時に走らせる。40秒ほど（4コアのクラウドの環境では1分15秒ほど。単体テストの階の比べ合わせ level.test.mjs が長い。半分ほどは本物の buildWorld）。編集のたびにこれ
pnpm lint             # 警告も含めて lint を見る（src/game/ はつないで調べる）
pnpm fmt              # 整形する（Oxfmt。src/game/ の古い JS と index.html 以外）
pnpm typecheck        # 型を確かめる（TypeScript 7 の tsc。src/lib/ と tests/unit/*.ts。1秒かからない）
pnpm test:unit        # 単体テスト（Vitest。tests/unit/）
pnpm map [語]         # ゲーム本体の地図。語を付けると、見出しにその語を含むファイルだけ（例：pnpm map fire）
pnpm where index-D0mETEmY.js:4321:12   # 組み立てた JS のその場所が、src/game/ のどこか（行だけも可。--test でテスト版）
pnpm test             # スモーク・タイトル・自動で試す・サンドボックスの iframe・画面写真の比較・図鑑・世界とのやり取り・指で遊ぶ時・装備の画面・全部の階・同じ結果・枠（tests/run.mjs が同時に3つずつ走らせる。オフラインで動く。2分ほど。1つだけは node tests/smoke.mjs など）
pnpm test:visual      # 画面写真の比較だけ（1分ほど）。違えば tests/out/visual/ に違いの画像
pnpm shots [名前…]    # 図鑑の生き物を見やすい角度で写す（既定は竜・主たちの12枚（tools/shots.mjs の PICK）。--all で全部、--bare で図鑑の枠を隠す、--out で置き場所、
                      #   --views で生き物ごとに角度の一揃いの7枚（枠を隠し、真ん中の 540×540。形や色を直す時に。例：pnpm shots トロル --views）と、体のまわりを大きくして並べた1枚
                      #   -views.png。--compare <前に --views で写した置き場所> で、前と今を同じ枠で上下に並べた -compare.png）
node tools/case-diff.mjs [テストの名前…] [--rev 版]   # 指紋のテストの書き出しを、前の版の src/ と今の src/ で比べてまとめる（指紋を作り直す前に。2分ほど）
node tools/case-diff.mjs --update [テストの名前…]     # 比べ合わせで確かめた後、落ちた指紋の値を今の値に書き換える
node tools/feel.mjs [aim|walk]   # 手触りの試し打ち（見回す速さ・8方向とアナログのスティックを比べる。4分ほど。--look・--trials・--routes）
pnpm field <名前…>    # 生き物を本物の階で、向かってくるところを距離ごとに写す（--scenes 1:202,3:7 で階、--rev origin/main で前の版と並べる。--kill で倒して時間を追って写す。見た目を直す時の最後に。4分ほど）
pnpm lords [場所…]    # 主たちを本当にいる場所で、目の高さから写し、大きさと眩しさを数で出す（crypt・lair・sunken・nest・snake・final。--dist で距離（既定 8））
pnpm glare [名前…]    # 敵に攻撃を当てた時の眩しさを数で出す（既定はゴブリン・トロル・レイスを小剣と光弾で。--weapons・--scene 1:202・--hide hands,swing。40秒ほど）
node tools/transitions.mjs [--rate 1,4]   # 場面が切り替わる時の確かめ（Artifact 版を本物の時計で通し、診断の記録を表にする。1つの速さで3分ほど）
node tools/diag-report.mjs <フォルダ>     # 診断の記録（ArtifactData の道具で保存した JSON）を表にする（--compare 前.json 今.json で、自動で試した段を並べる）
node tools/auto-run.mjs [--cond lowpower]  # 自動で試す台本を、スマホの遅さを真似て流す（条件ごとに5分ほど）
node tests/visual.mjs --update [--only 場面]   # 基準の画像を作り直す（見た目を意図して変えた時だけ）
node tests/levels.mjs --seed 202               # 1つのシードだけ（--seeds 100 で数を変える）
node tests/smoke.mjs --prod                    # 公開用の版（dist/）で起動（JetBrains Mono の所の日本語はシステムのフォント）。タイトルの画面は node tests/title.mjs --prod
pnpm verify           # check + test
pnpm dev              # Vite の開発用サーバー（http://localhost:5173/。src/game/ を変えると読み直す）
pnpm build            # 公開用を dist/ に組み立てる（pnpm build:test でテスト用を .build/test/ に）
pnpm build:artifact   # claude.ai の Artifact 用を .build/artifact/index.html に組み立てる（HTML 1つ。公開は下の「Artifact に公開する」）
pnpm serve            # dist/ を組み立てて http://127.0.0.1:8000/ で配信
pnpm run deploy       # 手元から Cloudflare に公開（ふだんは Workers Builds が git から公開する）。pnpm deploy は pnpm 組み込みの別のコマンドなので使わない
```
- **Artifact に公開する**：`pnpm build:artifact` の後、Artifact の道具で `.build/artifact/index.html` を公開する。
  診断の記録（src/lib/diag.ts）のため、capabilities は `{db: {rules: [{path: "diag", read: "owner", write: "owner"}]}, user: {}}`（一度渡せば、上げ直す時に省くと、そのまま残る）。
  記録は、ArtifactData の道具の list で、コレクション diag を読む（開くたびに1件。端末 device（ページの URL に付いた物 query も）・速さ fps（10秒ごとの平均 avg と一番遅い1回 min と、その時にいる場所 place。探索中だけで、タイトル・図鑑・試しの間では null）・できごと events・場面が切り替わる時の処理にかかった時間 took（名前 k と ms。newLevel は生成 gen と組み立て build の内訳、applySize は理由 why と大きさ）・100ms を越えた1フレーム slow（ms・place と、その前の1秒にあったできごとか処理の名前 near。溜めている手・飛ぶ物・音の部品の旗の変化は near に数えない。40件を越えたら短い物から捨てる）・自動で試した記録 auto（自動で試した時だけ。始めた時に開発用モードがオンだったか dev と始める深さ depth・段ごとの秒・フレームの数・平均 avg・最長 worst・遅いフレームの数 slow・Wake Lock）・メニューで押した項目 menu（項目 k・その前に押した項目 prev とそれからの秒 dt。メニューを開いて初めての1回は null。人の指の事件だけ。100件まで）・エラー errors）。読んだ記録は `out_dir` に保存して、`node tools/diag-report.mjs` で表にする。公開先の URL は https://claude.ai/artifact/SHDFv8eNiDcWgkmwWvmNn6 。
  本物の iPhone で人が触らずに確かめる時は、公開先のリンクをユーザーに開いてもらい、タイトルの［自動で試す］を押して横向きで置いてもらい（およそ5分）、記録の欄 auto（段ごとの速さ）を読む。
  リンクに付けた `?auto` は、claude.ai がゲームのページに渡さない（記録の device.query で見られる）。
  上げ直す時は、その URL を `url` に渡す（渡さないと別の Artifact になる。初めは非公開で、見せる相手はユーザーが共有の画面で決める）。公開は外に出す操作なので、ユーザーに確かめてから。
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
  例外は tests/title.mjs だけ。1つ目の「テスト用モードでない時に、タイトルの画面が出るか」は、ゲームを止めて進められないので、背景の迷宮を描いたフレームが2つ進むのを待つ。
  2つ目・3つ目（開発用モードのまま読み直した時・保存が使えない時のタイトル）も、`?test=1` を付けずにページを開く（テスト用モードは開発用モードを必ずオンにするので、
  その場面を作れない）。待つのはタイトルが出るまでだけで、時間がたつのは待たない。
  4つ目（音の部品）だけは、本物の音の部品と時計が要るので（テスト用モードの音の部品はいつも動いている扱い）、診断の記録が始まるまでの 1.5 秒と、
  ［迷宮に入る］を押してから音の部品が動いたと記録されるまで（できごとを 0.25 秒ごとに見るので、0.3 秒ごとに最大 6 秒）を、実時間で待つ。
  画面写真には `timeout: 90000` を付ける。
- three.js（r147）は、npm の `three` を組み立てに入れる（`src/game/imports.mjs` で読み、`00-test-mode.js` で画面の後処理の4つの部品（EffectComposer・RenderPass・ShaderPass・光のにじみの UnrealBloomPass）と一緒に `T` にする）。CDN からは読まない。
- フォントも、npm の @fontsource を組み立てに入れる（`src/main.js` で読む。Google Fonts は読まない）。テスト版（`vite build --mode test`。テストが自分で組み立てる）も同じ。
  テストのブラウザには、システムのフォントを見せない（`tests/fonts.conf`、指定したフォントに無い文字の代わり（fallback）は、npm パッケージの DejaVu だけ）。
  JetBrains Mono を指定した所の日本語は、テスト版のほか（公開用の版・開発用サーバー）ではシステムの日本語フォントで描画されるが、テスト版では M PLUS 1 Code
  （全角の ！？ などは BIZ UDGothic）を組み合わせて描く（`tools/game-source.mjs` の `cjkFallback`）。マシンが違っても同じ画素になる。
- ポインタロックは、テストでは `HTMLCanvasElement.prototype.requestPointerLock` を差し替えて止める（tests/lib.mjs）。tests/frame.mjs だけは差し替えず、サンドボックスの iframe でブラウザ本来の動きのまま断られる。
  iframe の中のキー入力は、iframe の中を一度クリックしてから届く。
- Playwright は 1.63.0 に固定（クラウド環境の /opt/pw-browsers の Chromium と版を合わせている）。上げる時はそろえること。
  上げると描き方が少し変わりうるので、`pnpm test:visual` が落ちたら、違いの画像を見てから基準を作り直す（コミットを分ける）。
- CI では画面写真の比較も失敗にする。CI とクラウド環境の差は数画素（0.01%以下）で、失敗の基準は0.2%。

## TypeScript に移す
古い JS（src/game/）の関数を、1つずつ src/lib/*.ts に移す。動きを変えないことが一番大事。
1. src/lib/ に、型を付けて書き直す（`export` する）。状態の多くは src/lib/state.ts の入れ物にあるので、状態に頼る関数も移せる（入れ物を import して読み書きする。確かめ方は手順3）。
   迷宮の乱数（`rand`・`R`・`RI`・`pick`）は src/lib/random.ts にある（入れ替えは `setRand`。`rand=…` とは書けない）。
   まだ古い JS にある状態（src/lib/state.ts に無い物）に頼る関数は、先にその状態を入れ物に移す（下の「状態を入れ物に移す」）。
   TypeScript のモジュールは、古い JS より先に読まれる。読んだ時に値を覚える書き方（`const mr=Math.random` など）は、
   テスト用モードの入れ替えより前の値を覚えてしまうので、呼んだ時に読む形にする（`mr = () => Math.random()`）。
   同じ理由で、作る時に Math.random を引く物（three.js の Scene・Mesh・Material などは uuid を作る）をモジュールの一番外で作らない（その後の見た目の乱数がずれる）。
   古い JS がその場で作り、入れ物（gfx.scene など）に入れる。
2. `src/game/imports.mjs` に import を足し、src/game/ から元の定義を消す（「〜は src/lib/xx.ts」と1行残す）。
   src/lib/ のファイルの頭の「もとは src/game/〜」と、古い JS の「〜は src/lib/xx.ts」の行は、移している間の手がかり。古い JS を全部移し終えたら消す。
   消し忘れると、包みの中の古い定義が import を黙って隠す。lint-game（pnpm check と編集直後の hook）が、包みの一番外での宣言をエラーにして止める
   （関数の中で同じ名前を使い直すのは、その中だけのことなので止めない。色の名前の `EYE` など）。
3. 移した関数が、移す前と同じ文かを `node tools/same-code.mjs --rev origin/main --auto-state src/lib` で確かめる（違いが0、比べていない名前が無いこと。
   比べるのは古い JS から消えた名前だけ。状態を入れ物に移した名前は --auto-state が見つける（src/lib/state.ts の入れ物に初めの値を書いた欄から）。
   見つからない時は --state 入れ物:名前,… で渡す。古い JS でも使われていなかった物や、呼ぶ所も一緒に消した物（今はどこからも使われていない物）は、
   「消した」と出して止めない）。PR の CI も同じことをする。移す時は名前を変えない（変えると、古い名前がどこからも使われなくなり「消した」に見えて、比べない）。
   移す PR では、移した関数の動きを変えない。変えたい時は、移す PR を入れてから別の PR で変える（同じ PR で変えると、CI の比べ合わせが止める。
   写し漏れを直して元の動きに戻すのは止まらない）。移していない所の小さな直しは、コミットを分ければ同じ PR に入れてよい。道具が出す「人が確かめる一覧」は、1件ずつ確かめ、一覧と確かめた結果を PR の説明に書く。
   型のための書き換えは、道具の規則（nth・lookup・must・level()・算術の中の `?? NaN` など。ファイルの頭）の形だけにする。規則に無い書き換えは違いとして出るので、
   写し方を規則に合わせる（無い値をそのまま渡す・返す所は `?? NaN` ではなく `nth`・`must`）。「先に読む」（`const D = here.D` など）は、道具が出す一覧を見て、
   間で中身が変わらないことを確かめる。道具は通るかどうかに関係なく全部の行を見るので、写し漏れ・係数・比べ方・乱数を引く順番の違いはここで見つける。
   そのうえで、移す前の実装と、たくさんの入力で同じ結果になることを確かめる（規則と、状態の入れ物の読み書きを確かめるため。Node 26 は .ts をそのまま動かせる。古い関数は git の版から取り出す）。
   乱数を引く順番を変えると、同じシードで違う結果になる。移す前の値を、単体テスト（tests/unit/*.test.ts）に残す。
   本物の型に合わせられない偽物を使うテスト（音の偽の Web Audio など）は、`as` を使わないように .mjs で書く（その分、型では確かめない）。
   移した物が、まだ古い JS にある関数を使う時は、テストで `tools/legacy-eval.mjs` の legacyValues から本物を取り出す。
   状態に頼る関数は、古い JS を消す前に、legacyValues で取り出した古い関数と新しい関数に同じ状態（gear など）を入れ、たくさんの場合で結果と状態の変わり方を比べてから消す
   （古い関数も、TypeScript の状態の入れ物を同じ物として読む）。比べ方の見本は、tests/unit/gear.test.ts の頭にある。
   迷宮の生成は Node とブラウザで同じ迷宮になる（混ぜるのは shuffle）。生成に関わる変更は、Node の単体テストの指紋（generate.test.ts。欄の並びによらない）で、
   前の版と作り比べる。意図して迷宮を変えた時は、ブラウザの `__test.gen` でも Node と同じ指紋になることを確かめてから、指紋を作り直す
   （生成した迷宮を使う place.test.ts・status.test.mjs・draw.test.mjs の指紋も変わるので、一緒に作り直す）。
   指紋を作り直す前に、`node tools/case-diff.mjs` で前の版と書き出しを比べ、違いがねらった所とそれに続く物だけかを確かめる（生き物の見た目を直した時も同じ）。
   確かめたら、`node tools/case-diff.mjs --update` で指紋の値を書き換える。main を取り込んで指紋の行がぶつかった時は、main の値を取ってから、同じく比べ合わせ → `--update`。
4. `pnpm fmt`・`pnpm check`・`pnpm test`（画面写真の比較も含む。画素まで同じはず）。
- 型を外すだけで組み立てる（Vite）。enum・中身のある namespace など、型を外すだけでは動かない書き方は使わない（`erasableSyntaxOnly`）。
  型だけの `declare namespace`（組み立てで消える）は、関数に覚えさせる欄の型を付ける時だけ使ってよい（monsters.ts の `houndScent.msgT`）。
- import は `.ts` まで書く（`./rng.ts`）。`noUncheckedIndexedAccess` なので、配列の要素は `undefined` かもしれない物として扱う。
- 型の言い切り（`as`。`as const` は除く）と後ろの `!` は使わない（lint がエラーにする。間違っていても tsc が黙って通すため）。
  配列と表は src/lib/array.ts の `nth`・`lookup`、無いかもしれない値は `must` で読む（無ければその場で止まる）。範囲の外や無い欄を
  わざと読む所は、無い時の扱いをその場で書く（`?? 0` など、元と同じ値になる形）。どうしても要る所だけ `oxlint-disable-next-line` と理由。
- **状態を入れ物に移す**：`node tools/state-move.mjs <入れ物> <名前>…`（`--dry` で一覧だけ）。eslint-scope で、ゲームの状態を指す所だけを
  `入れ物.名前` に書き換え、元の宣言を消す（初めの値は一覧に出るので、src/lib/state.ts の入れ物に書く。入れ物は src/game/imports.mjs で読む）。
  初めの値が決まった値（数・文字列・true など、それだけでできた配列・オブジェクト、空の `new Set()`・`new Map()`）でない宣言（`Math.random()`・`Math.random` の読み取り・`new Date()` など）は、
  道具がその場に `入れ物.名前=…;` として残す（TypeScript のモジュールは先に読まれるので、移すと値を作る時と順番が変わる）。
  その場に残す名前が並んだ宣言（`const a=…, b=…;`）の中にある時は、並んだ全部をその場に残す物として一緒に移す（`入れ物.a=…; 入れ物.b=…;` にする）。そうでなければ道具が止める。
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
テスト用モードでない時（`?test=1` なし）の動きには影響しない（テスト用モードかを `src/lib/state.ts` の `TEST` で見て、`src/game/00-test-mode.js` が時計と乱数を入れ替える）。
- `Math.random` はシードで決まる。時計（`performance.now`・`setTimeout`・`setInterval`・音の時計 `AudioContext.currentTime`）は、ゲームが進む時だけ進む。
  音の部品はいつも動いている扱い（`state` が `'running'`）。詠唱の円の文字は、詠唱の声の音節の時刻（音の時計）で光り、声は部品が動いている時だけ鳴るので、
  どちらかが実時間で変わると、絵がずれるため。音の速さ（`sampleRate`）は 44100。始めに作る響きと雑音は音の速さの数だけ音の乱数を引くので、
  マシンで変わると、その後の音がマシンごとに違うため。
- 音は、見た目の乱数（`mr`・`Math.random`）を引かず、音の乱数 `sndRand`（src/lib/random.ts。テスト用モードではシードで決まる）を使う。ゲームの側で
  「この音を鳴らすか」「次にいつ鳴らすか」を音だけのために決める所も `sndRand` で決める。なので、音を足したり鳴らす頻度を変えたりしても、見た目の乱数の並びは変わらない
  （単体テスト audio.test.mjs が、src/ を構文の木で調べて止める。調べる形は tests/unit/sound-random-check.mjs の頭）。
  ただし、音と一緒に見た目やゲームのことも決める時計（間欠泉が噴き上がる時刻 `f.next`、魚が跳ねる時刻 `m.jumpT` など）は、見た目の乱数で決める
  （`sndRand` で決めると、別の所で音を足しただけで、噴き上がる時刻などの見た目がずれるため。確かめる道具も、こういう時計は止めない）。
- 遊びの中身を選ぶ所（祭壇の中身・鍛え方・レベルアップの選択肢・開ける枠が無い時の代わりのルーン・宝物庫の番人の場所・階に入った時に眠っている生き物）も、
  見た目の乱数を引かず、出来事ごとの乱数 `keyedRand(何の出来事か, 鍵…)`（src/lib/random.ts）で選ぶ。鍵は、階のシード `levelSeed()` とマス、探索のシードと何レベル目か、など。
  鍵が同じなら同じ並びなので、見た目だけの変更でも、ほかの出来事の順番でも、選択肢は変わらない（同じ階なら、離れて戻っても、眠っている生き物と宝物庫の番人の場所は同じ、祭壇は手と体力が同じなら同じ中身）。
  新しくこういう所を作る時も keyedRand を使う（単体テスト choices.test.mjs と tests/determinism.mjs が確かめる）
- ゲームの一歩（src/game/30-loop-init.js の tick）は段（プレイヤー・世界・灯り・描く物の種類ごと・粒子・火の広がり・飛ぶ物など）に分け、段ごとに、見た目の乱数 `mr()` が
  `keyedRand('tick '+段の名前, 探索のシード, 何回目の tick か)` を読む（`inPhase`。何回目かは `clock.frame`）。生き物は1体ずつ、動きと描画を `keyedRand('tick mob' か 'tick mob draw', levelSeed(), m.seq, 何回目か)` で読む（`inMobPhase`。
  `m.seq` は makeMonster が覚える、階で何体目か）。本番も同じ。なので、ある段で引く回数が変わっても、ほかの段・ほかの生き物と次の tick は変わらず、見た目だけの変更で
  戦い・生き物の動き・火の広がり・伝言はずれない（tests/determinism.mjs が `__test.tickNoise` で確かめる）。同じ段の中では、その tick の後の物がずれる。
  tick に処理を足す時は、どこかの段に入れる（段の外では Math.random の並びを読み、マウスやキーの処理・setTimeout とずれを分け合う）。図鑑で生き物を出している間は段に分けない（下の図鑑の項）
- 生き物の形と初めの値（向き・待つ秒・歩きと揺れの位相・うなぎが出るまでの秒・攻撃の間、ゴーレムの見回りの道）は、その生き物だけの見た目の乱数の並び `m.rnd` で決める（本番も同じ）。
  `makeMonster(湧く所, 並び)` が `withVisualRand` で包んで作り、並びを生き物に覚えさせる。並びを省くと `keyedRand('mob', levelSeed(), 階で何体目か)`
  （何体目かは `here.mobSeq`。newLevel が生き物を作る前に0に戻す。階に入った時の生き物は生成の順番、途中で湧く物は湧いた順番）。
  初めて描く時に作って覚える見た目（眠った竜と獣の姿 formSleep・不死の王の剣・古竜の宝・深みの主の灯り）と王の影の二つ目の姿も、`withMobRand(m, …)` で `m.rnd` から作る。
  なので、ほかの所で見た目の乱数を引く回数が変わっても、形と初めの値は変わらない（tests/determinism.mjs と単体テスト mob-rand.test.mjs が確かめる）。
  像（src/lib/build.ts の statueForm）も buildForm で作るので、`keyedRand('statue '+種類, levelSeed(), マス)` で包む（像の点の位置は見た目の乱数によらないが、
  包まないと、世界を組み立てる間に共有の見た目の乱数を引き、その後の粒子などが、形の作り方や像の数でずれる。世界の組み立ては見た目の乱数 `mr()` を引かない。tests/determinism.mjs が数える）。生き物が覚えておく見た目を新しく作る時も、`withMobRand` で包む。
  ただし、湧く順番が入れ替わると（戦いや生き物の動きを変えた時など）、途中で湧く物の形も入れ替わる
- 図鑑で生き物を出している間は、見た目の乱数 `mr()` が、その生き物の種類から作った並び（`keyedRand('gallery '+種類)`）を読む（本番も同じ）。
  出す時（showBeast：形・初めの値を作り、降る粒子を作り直す。生き物の並び `m.rnd` もこれにする）と、ゲームの一歩ごと（stepTick。tick の段には分けない）を `withVisualRand`（src/lib/random.ts）で包んでいる。
  出す時はプレイヤーを部屋の真ん中に置き（降る粒子はプレイヤーのまわりに作るので、前の生き物のカメラの位置に左右されないように）、部屋の備品と灯りを図鑑を開いた時の姿に戻し（備品と灯りには、プレイヤーが近い時だけ進む溜めがあるので）、カメラを置いた次の一歩で目の慣れ（露出）と霧をすぐ合わせる（updateAtmosphere）。図鑑の部屋（showroom）は、物・生き物と一緒に部屋の出来事も消す（プレイヤーが近づくと動き出し、マスを書き換えるので）。`__test.galleryDraw` は、いつも同じ別の並びで描き、描く時に生き物に増えた欄（初めて描く時に作る物）は終わると外す（呼んでも、生き物の並びを進めず、跡を残さない）。
  なので、図鑑を出す前や、ゲームの一歩の外で見た目の乱数を引く回数が変わっても、前にどの生き物を出していても、図鑑の写真は変わらない（tests/gallery.mjs が確かめる）。
  図鑑の部屋で毎フレーム動く処理（降る粒子・ランプの揺らぎなど）が乱数を引く回数を変えると、写真は変わる。`mr()` を通らずに `Math.random` を直に呼ぶ所は包まれない
- ゲームは自分では進まない。`__test.advance(秒)`（描かずに進める。速い）か `__test.frames(n)`（描いて進める）で進める。1フレーム＝ゲームの1/30秒。
- `window.__test`：`ready()`、`error()`、`advance(秒)`、`frames(n)`、`state()`（時刻 time・シード seed・場所 place・深さ depth・始まったか started・死んだか dead・体力 hp・位置 pos・向き yaw・レベル lvl・生き物 monsters（種類・位置・体力・眠っているか・攻撃の溜めの残り）・飛ぶ物の数 projs・階を移る途中 trans・届いた深さ maxDepth・溜め cast・立ち直り recover・止まっているか paused・転がっているか roll・かわした時の加護が切れる時刻 quick（身軽な詠唱）・counter（返しの一撃））、
  `equip(手, 武器)`（例：`equip('L','bolt')`）・`open(枠)`（手のルーンの枠 `'slotL'`・`'slotR'` か体の枠 `'body'` を1つ開ける）、`bless(n)`（全部の加護を n 段目にする）、`width(文字列)`（visW）、`press(手)`・`release(手)`（ボタンを押す・離す）、`doors()`（扉の一覧）・`cell(i)`（マスの真ん中・床か・今見えているか・灰の印・硫黄か氷の床か・薄い氷か・薄い氷に乗っていた秒・水か・溶岩か・火の強さ・燃える物）・`size()`（マップの横と縦のマスの数）・`ignite(i, gas)`（火をつける。gas は燃えるガスのように燃える物を少し残す）・`chill(i, r)`（マスの周りに冷気）・`burning(i)`（燃えているマスの一覧に何回入っているか）・`rockfall(on)`（on ならプレイヤーのまわりの床で落石を始める。今の落石の経った秒 t と落ちている石の数。無ければ null）・`debris()`（倒れた生き物が崩れて積もった文字：崩れる体ごとの、文字の数・残す数・消えていない数・様子ごとの数・積もった文字の高さの範囲と倒れた所からの距離・一番高い所）・`events()`（部屋の出来事の一覧（種類・火口のマス・状態・時計・何マス目か・流れる順のマス・終わったか）と、溶岩が流れ込んだマスの数）・`tickNoise(n)`（毎 tick、どの段も終わりに見た目の乱数を n 回余分に引く）・`skipPhase(名前の配列)`（tick の段を名前で飛ばす。段は `inPhase('hands', …)` などと生き物の描画の `inMobPhase('mob draw', …)`。tick に無い名前は受け付けない。空の配列で元に戻す。今止めている名前の一覧を返す）・`touchTune({look, analog})`（指の操作の、試して合わせる値を変える。src/lib/touchpad.ts の TUNE）・`quality({pr, bloom})`（遅い端末で下げる画質（描く細かさと光のにじみ）を、その値にする。テスト用モードではふだんは変わらない。今の値を返す）・`mobLooks(n)`（n 体目から後の生き物の、種類・形の指紋・初めの値）・`worldDraws()`（世界を組み立て直し、その間に見た目の乱数 `mr()` を引いた回数（`Math.random` を直に引く所は数えない。three.js が物の名前に引く）と、階の像の数。迷宮の乱数を使うので、ページの最後に）・`clearAll()`（生き物を全部消す）・`knock(n, kx, kz)`（n 番目（0 から。`state().monsters` の順）の生き物を、当たった時の吹き飛ばしのように速さ kx kz で吹き飛ばす）・`mob(n)`（n 番目の生き物のマス・行き先のマス・体の大きさ・位置・吹き飛びの速さ・当たって光る残りの秒 hitT・明るさの倍率 glow・気づいている度合い alert・照準の先か aimed）・`hideMonster(鍵, true|false)`（その鍵の生き物を1体、一時的に描かない・また描く。階には残るので灯りは消えない）・`monsterView(鍵)`（その鍵の生き物の体（まわりの飾りの粒子や頭の上の印は含めない）が描かれた所：形 form・大きさ scale・世界の中の高さの範囲・真上の天井の高さ・画面の範囲・画面の外に出た文字の割合 cut）・`summon(種類, マス, {unseen})`（生き物を置く。例：`summon('Re', i)`。unseen を true にすると、まだ見ていない物として置き、初めて見た時の伝言が出る）・`fov()`（見えるマスを今すぐ数え直す。ゲームは0.1秒ごと）・`addTraces()`・`traces()`（階に残る物：魔法の場・遅れて当たる攻撃・雨・床の目印・撃っている途中の光線・稲妻・稲妻の光・崩れる体（氷のハウンド（Zi）を作って崩す。階の生き物には足さない）を置く、数える。発動のルーンの待ち時間も置く）・`failLater(文)`（遅れて起きることの中で例外を起こす。テスト用モードではページのエラーになる。テスト用モードでない時は、コンソールに出して続ける）、`gallery()`（タイトルから図鑑を開き、一覧 `[{n,key,name,form,scale}]` を返す。scale は体の大きさ）・`galleryShow(n, {yaw, pose, zoom, pitch, center})`（n 番目を、向きと姿を止めて出す。yaw は0でこちらを向き、＋でこちらから見て右へ回る。pose は `'stand'`・`'walk'`・`'sleep'`。zoom は寄る・引く（距離を 1/zoom 倍。0.5〜3。書かなければ 1。部屋の壁より外には引かず、寄っても体の外で止まる）。pitch は見下ろす角度（ラジアン。0 で真横から、＋で上から。-0.3〜1.3。天井より上には出ない。書かなければ、図鑑が生き物の大きさから決める高さ）。center は true で体の高さの真ん中を画面の真ん中に写す（書かなければ、図鑑の枠の上に立つように少し上に写す））・`galleryDraw()`（出している生き物の、カメラから見た向き turn と、描く物：文字の数 glyphs・火花の数 sparks・数でない値の混じった文字と火花の数 bad・描いた物の指紋 hash・目の慣れ（露出）exposure・描いた範囲 box・カメラの床の上の距離・高さ・角度・狙う点までの距離と、天井の高さ・部屋の壁までの距離・寄った時に体を包む球の半径 camera）、`places()`、`gen(シード, 場所)`（生成だけ。描画の状態を壊すので専用のページで）
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
- テストは遅めなので hooks では走らせない。動きや見た目に関わる変更の後は `pnpm test`（画面写真の比較も含む）を自分で走らせる。見た目だけを直している間は `pnpm test:visual` だけでもよい。
  画面写真の比較が違ったら、違いの画像を元の大きさで見てから、意図した変更なら `--update` で作り直す（作り直しはコミットを分ける）。

## 開発用の道具
**URLの指定**：`?dev=1`（開発用モード：すべて解放済み、dbg が使える）、`seed=`、`depth=`、`god=1`、
`branch=`、`realm=`、`to=`、`give=`、`reveal=`
`?auto=<周の数>`・`?auto=quick`（自動で試す。開発用モードとは別。src/lib/auto.ts。claude.ai の Artifact では届かないので、タイトルの［自動で試す］を使う）

**dbg（F2の画面と window.dbg）**：
`dbg.help()`、`info()`、`go(深度)`、`inter(key)`（地下の町 town / 大広間 bigroom / 神託所 oracle / 砦 fortress）、
`branch(key,階)`、`realm(key)`、
`to("stairs"|"branch"|"portal"|"lord"|"altar"|"vault"|"hub"|"spring"|"forge")`、`god(on)`、`heal()`、`reveal()`、
`give("slot"|"body"|"runes"|"legends")`、`kill("lord"|"near")`、`open()`、`step(x,z)`、`look(x,y,z)`、`items()`、`clear()`、
`hurt(n)`、`hit(n)`、`hp()`、`exp(n)`（経験）、`lore(n)`（伝承）

**タイトルのボタン**：`#galB`（図鑑）、`#galR`（試しの間：見つけた武器とルーン、特性Lv3/Lv5の武器、起き上がる的）、`#unlockB`（解放）、
`#galDev`（開発用モードのオン・オフ。このページで一度でも開発用モードがオンだった時（`?dev=1`・`al_dev`）か、Artifact の持ち主の時だけ出す。遊ぶ人には出さない）、
`#autoB`（自動で試す。Artifact の持ち主の時だけ、`#galDev` の真下）

## 保存データ（localStorage）
`al_meta`（伝承・解放・墓・試練・指で遊ぶ時の始めの一言を出したか）、`al_book`（魔導書：記した反応）、`al_beasts`（忘れられた獣）、
`al_runes`（見たルーン）、`al_seen`（見た生き物）、`al_cam`（1人称/3人称）、`al_look`（指で遊ぶ時の見回す速さの段）、`al_snd`（音量の段）、`al_dev`（開発用モード）

## ゲーム本体の地図（src/game/）
ファイルは名前の順につながる（後のファイルは、前のファイルの変数や関数を使える。トップレベルで実行する文は順番に気をつける）。
ファイル名は「2桁の番号-名前.js」（違う名前や、改行で終わらないファイルがあると、組み立てが止まる）。
細かい見出しと行は `pnpm map` で見る。TypeScript に移した名前のうち、古い JS が読む物の一覧は `src/game/imports.mjs`（生成だけが使う物は載らない。古い JS の「〜は src/lib/…」の行も見る）。ブラウザのエラーの場所は `pnpm where <JS:行:列>` で元のファイルに直す（テストのエラーには自動で付く）。
| ファイル | 中身 |
|---|---|
| 00-test-mode | テスト用モードの時計と乱数（テスト用モードか `TEST` は src/lib/state.ts） |
| 01-title | タイトルのロゴ。ロゴの絵 LOGO_ART・TITLE_LINES は src/lib/title.ts |
| 02-constants | 「〜は src/lib/…」の行だけ。特別な階の場所 interAt・interAfter、場所の名前 placeKey と次の場所へ進む advance は src/lib/levels.ts。生き物の表 MTYPES は src/lib/creatures.ts。部屋の仕掛けの伝言 MACHINE_INFO は src/lib/names.ts。層・テーマ・支道と異界の中身・迷宮の乱数・迷宮の大きさ・タイル・灯りの計算などは src/lib/。飾りの文字の並び（RUNESET など）は src/lib/glyphs.ts、今いる場所の名前 placeLabel は src/lib/status.ts |
| 03-vaults-history | 「〜は src/lib/…」の行だけ。壁の絵 ARTS と洞窟の形と宝物庫の絵は src/lib/vaults.ts、探索ごとの年代記の中身 HIST は src/lib/state.ts の adv、makeHistory は src/lib/history.ts、岩・鉱脈・宝物庫の壁の高さは src/lib/world.ts |
| 04-generate | 「〜は src/lib/…」の行だけ。迷宮の生成の呼び出し口 generate は src/lib/levels.ts（生成そのものは src/lib/generate.ts の generateLevel） |
| 05-renderer | 描画（カメラ gfx.camera・マスの絵 gfx.cellTex・場面 gfx.scene・描画する部品 gfx.renderer・分け合う値 gfx.U・後処理 gfx.finalPass を作る・シェーダー、文字の絵の表、置いた文字と粒子を GPU に渡す部品）。three.js と後処理の部品 T・霧の色 fogCol は src/lib/three.ts、灯りを描画に渡す配列 SL・DLP・DLC とマスの絵の中身 cellData と入れ物 gfx・塵 dust は src/lib/state.ts、シェーダーのソースと描画用の配列の大きさは src/lib/shaders.ts、文字を置く dyn・粒子を出す spawn・消す killP とその配列・描く粒子の配列 ptPos などは src/lib/particles.ts、その数 buf と、粒子を描く形 gfx.ptGeo と属性 gfx.bpPos など（ここでその場で入れる）は src/lib/state.ts、粒子を動かす updateParticles は src/lib/motes.ts |
| 06-world | 水面を作る makeWater と、見えない区切りを描かない処理、組み立てた物の状態。世界の組み立て buildWorld と水面の絵を書き直す updateWater は src/lib/build.ts、区切りごとの文字 chunks・隠す板 occMesh・水面の絵 waterTex は src/lib/state.ts の gfx、入った部屋 visitedRooms は here、通れない所に押し当てた記録 edge は src/lib/state.ts。今の階の中身 D・depth・monsters・player などと、描いた文字の数 glyphCount・chunksDrawn（hudInfo）は src/lib/state.ts。画面の下の一言 showHint は src/lib/status.ts、sstep・flowW は src/lib/math.ts、CHUNK は src/lib/world.ts、天井の高さ ceilAt は src/lib/lightmap.ts |
| 07-bodies-lords | 表 MTYPES に見た目を書き足す（addLooks を呼ぶだけ。addLooks は src/lib/bodies/build.ts）。生き物の形を作る buildForm は src/lib/bodies/build.ts、まわりの飾り・王の影の変身・姿を変える途中は src/lib/bodies/auras.ts、各生き物の形は src/lib/bodies/ |
| 11-monster-move | 「〜は src/lib/…」の行だけ。生き物を作る makeMonster・歩ける所 canStep・行き先 chooseNext は src/lib/monsters.ts |
| 13-creatures | 「〜は src/lib/…」の行だけ。生き物の動き updateMonster は src/lib/monsters.ts、小さな生き物の動き updateCritter・掃除機と修復機の仕事 machineWork・水しぶき splash は src/lib/ground.ts、小さな生き物の次に向かうマス critterStep と猟犬が追う匂い houndScent は src/lib/monsters.ts、叫び声の音 sShriek は src/lib/audio.ts。生き物を描く drawMonster・drawMonster1・drawMonster0 と深みの主の触手 drawTentacles は src/lib/bodies/draw.ts、頭の上の印 drawMark は src/lib/status.ts、主などのまわりの飾り（lichAura など）と姿を変える途中 drawMorph は src/lib/bodies/auras.ts、古い形は src/lib/bodies/small.ts、遠吠えと警報の音 sHowl・sAlarm は src/lib/audio.ts、クモの巣を描く drawWebs と巣に触れた時 webTouch は src/lib/fixtures.ts |
| 14-lights-fixtures | 見出しと「〜は src/lib/…」の行だけ。灯りの揺らぎ flicker と、灯りを描画に渡す配列を書き直す updateLights は src/lib/lightmap.ts、LANTERN は src/lib/light.ts、マスの明るさ cellLight は src/lib/lightmap.ts、備品を描く drawFixtures と扉を描く drawDoors は src/lib/fixtures.ts |
| 15-sound-fire | 「〜は src/lib/…」の行だけ。沼のガスの粒 updateGasPoints・川のさざ波 riverFX・粒子と塵を動かす updateParticles は src/lib/motes.ts、火を進める stepFire・ガスが広がる stepGas は src/lib/ground.ts、部屋の出来事を進める updateEvents は src/lib/events.ts、ガスが広がる時の作業の配列 gasTmp は src/lib/state.ts の blaze。ガスが爆ぜる boom は src/lib/combat.ts、燃える物のマス initFire は src/lib/ground.ts、部屋の出来事を作る initEvents は src/lib/levels.ts、塵を置く initDust・respawnDust は src/lib/particles.ts。音量の切り替え sndToggle は src/lib/screens.ts、音を鳴らす処理（sndInit・効果音・まわりの音 sndUpdate など）は src/lib/audio.ts、SND_NAME・sEnv は src/lib/sound.ts、cpos・FIRE_TYPES は src/lib/world.ts。火と地面のマスの状態（火の備品のマス fireSrc・爆ぜた伝言の時刻 lastBoom も）は src/lib/state.ts の blaze、音 SND も src/lib/state.ts、火を描く drawFire は src/lib/fx.ts。火をつける ignite とマスの絵を描画に渡す uploadCells は src/lib/ground.ts、生き物を呼び出す summon は src/lib/monsters.ts |
| 16-view-input | ミニマップのキャンバス ui.mapC と描き手 ui.mctx を document から読む（大きさを合わせる sizeMap と描く drawMap は src/lib/minimap.ts）、伝言の1秒ごとの描き直し、入力の状態（マウスを捕まえた・捕まえられなかった時の受け取り、指で遊ぶ時の土台 initTouch と指の操作 initTouchpad を呼ぶ）、タイトルの画面 ui.introEl を document から読む。タイトルで選んだ始める深さ startDepth は src/lib/state.ts の ui。見えるマス computeFOV は src/lib/levels.ts、通れない所の当たり判定 solidAt は src/lib/player.ts（通れなかった物 blockType は src/lib/state.ts の player）。マウスを捕まえる tryLock・失敗した時 lockFailed・外れた時にメニューを開くか menuOnUnlock・updateResume は src/lib/screens.ts、伝言 msg・renderLog は src/lib/log.ts、伝言の一覧 msgs は src/lib/state.ts。ミニマップの大きさは src/lib/hud.ts、押しているキー keys は src/lib/state.ts |
| 17-meta | 伝承・解放・墓・試練、タイトルの画面（buildIntroPanel。指で触る端末ではキーボードの操作の一覧を出さない）、迷宮に入った時（指で遊ぶ時は操作の案内を出さず、初めての時だけ伝言に一言 touchTip）、次のビルドに持ち替える nextBuild（ホイールと [持ち替え]）、入力（マウス・キー。装備の画面とメニューの開け閉め togglePack・toggleMenu は Tab・Esc とタッチのボタンが使う）。タイトルの枠を画面に収める fitIntro は src/lib/layout.ts、指で遊ぶ時の土台 initTouch は src/lib/touch.ts（呼ぶのは 16-view-input.js）。UNLOCKS・META_DEF は src/lib/progress.ts、解放の確かめ（unlocked・lockedOf・weaponPool）と試練（trialOn）と使える伝承 loreLeft は src/lib/unlocks.ts、保存する記録 META などは src/lib/state.ts の saved、保存する saveMeta は src/lib/save.ts |
| 18-level-player | 探索のシードの初めの値。目の慣れ expo は src/lib/state.ts の vfx。レベルアップの画面（levelChoices・lvlLine・openLevelUp・chooseLevel）は src/lib/panels.ts、命の一歩 updateLife は src/lib/combat.ts。加護の表 BLESS は src/lib/progress.ts、加護の段 BL は src/lib/monsters.ts。新しい階 newLevel・階の中の出来事 checkEvents・層の名前 showStratum・層で強くなる strataGrowth・選ばれなかった枠 settleSlotPick・死と始め直し die・newRun は src/lib/levels.ts、霧の色 setFog は src/lib/build.ts、プレイヤーと生き物のダメージ hurtPlayer・damageMonster・ひるみと吹き飛び hitReact・近接の攻撃 monsterStrike・経験 gainExp・冷気が弾ける coldSnap は src/lib/combat.ts、結果の画面の場所・伝承・墓（resultPlace・runLore・awardLore・loreRows・graveCandidates・graveRows・saveGrave）は src/lib/results.ts。階のシード levelSeed は src/lib/levels.ts、生き物の強さの表 MSTAT は src/lib/creatures.ts、statOf は src/lib/monsters.ts、墓のルーン graveRune は src/lib/gear.ts。expNeed・expOf は src/lib/progress.ts、serRune は src/lib/runes.ts。TRAP_INFO は src/lib/names.ts、WEAPON・SLEEP_MULT は src/lib/runes.ts、roll は src/lib/random.ts。攻撃が当たる生き物か hittable は src/lib/aim.ts、敵か hostile・攻撃の的か foe・体力を初めの値にする initMonsterLife は src/lib/monsters.ts、薄い氷が割れる crackIce・茂み tallAt・trample・硫黄が燃え上がる brimFlare と、踏み分けた茂みが戻る regrow・燃えた硫黄が戻る brimRecover（戻るまでの秒 brimT は src/lib/state.ts の blaze）は src/lib/ground.ts、罠（triggerTrap・updateTraps）は src/lib/events.ts、罠と鉄格子を描く drawTraps は src/lib/fixtures.ts |
| 19-hands-runes | 魔導書 saved.BOOK を localStorage から読む文と、「〜は src/lib/…」の行だけ。手元の武器の形と色の表（VM_MODELS など）は src/lib/hands.ts、描く drawViewWeapons は src/lib/held.ts。術の中身 specOf・探索の始めの手に戻す resetRunes・ルーンを作る・ルーンの種類を選ぶ・手と持ち物の処理は src/lib/gear.ts、手元の武器が跳ねた時刻 vmKick は src/lib/state.ts、ルーンの名前と色と付けられるか・特性の説明 trDesc は src/lib/runes.ts。ルーンの定義 RUNE_DEF・性質の効き目 RES・TRAITS・REACT・手の枠は src/lib/runes.ts。武器を振った線 drawSwing は src/lib/aim.ts |
| 20-chant-hits | 「〜は src/lib/…」の行だけ。詠唱（timeScale・beginCast・fizzle・releaseCast・updateCast）は src/lib/chant.ts、飛ぶ物 updateProjs・状態異常 updateStatuses・monTimeK・遅れて起きることと魔法の場 updateZones・雨 updateRains は src/lib/projs.ts、剣の波を描く drawWave は src/lib/fx.ts。術を放つ castNow と武器の種類ごとの撃ち方・当たり applyHit・性質を移す applyElem・反応 react・稲妻・玉が弾ける orbBurst・火 burstFire・発動のルーン onKilledBy・遅れて起きること later などは src/lib/combat.ts、光線を撃ち続けた記録 beamHold は src/lib/state.ts、地面に落とす所 groundPoint・跳ね返る向き reflectDir は src/lib/aim.ts。turnDir は src/lib/math.ts、sp_elem は src/lib/runes.ts。戦いの状態は src/lib/state.ts の fight、床の目印と魔法の場を描く drawZones は src/lib/fx.ts。見ている向き viewDir は src/lib/aim.ts |
| 21-altars-heal | 見出しと「〜は src/lib/…」の行だけ。祭壇の画面（renderAltar・openAltar・closeAltar・updateAltarPanel・chooseAltar）は src/lib/panels.ts。足元の物を拾う pickupItems・物を取る grabItem・宝物庫の褒美を取った時 vaultSprung・落石 updateRockfall は src/lib/pickup.ts（落石の状態は src/lib/state.ts の fight.rockfall）、主を倒した時の祭壇 dropRune と立ち直り rallyOnHit・光の粒を動かす updateRally は src/lib/combat.ts、立ち直りの光の粒 rallyMotes は src/lib/state.ts の fight。階ごとに祭壇とルーンを置く・祭壇の中身・番人・鍛え方・泉を置く・石碑のそばか・祭壇の画面の1行と説明と選択肢・拾ったルーンを手か袋に入れる（placeRunesForLevel・mainPathAltars・altarFill・addGuards・forgeOptions・placeSpring・nearStele・altarLine・altarDetail・altarOpts・takeRune・placeChosen など）は src/lib/altars.ts、近くの祭壇 altarNear は src/lib/state.ts の ui、RALLY_FROM は src/lib/runes.ts、ALTAR_W は src/lib/hud.ts、泉を描く drawSprings は src/lib/fixtures.ts |
| 22-world-hints | 方向の矢印のキャンバス ui.arrowCv・描き手 ui.arrowCtx・下の HUD ui.hotbarEl と照準の文字 ui.crossEl を document から読み、下の HUD の大きさを見る ResizeObserver を作る。方向の矢印 drawArrows は src/lib/arrows.ts、床のルーン drawRunesWorld は src/lib/fixtures.ts、階の場所ごとの空気 updateSectionAir は src/lib/camera.ts、詠唱の見た目 drawCastFx・照準の文字 updateCross・術が飛ぶ道 simPath は src/lib/chantfx.ts。照準の先の生き物 aimTarget・狙いを助ける点 assistPoint・撃つ所と向き shotFrame と照準の小さな関数（handUp・aimPoint・centerPoint・castPoint・handPoint）は src/lib/aim.ts（照準の先の生き物 crossMon は src/lib/state.ts の ui）、術を放つ音 castSound は src/lib/audio.ts。先にある物の手がかり（computeOmen・drawOmens：階段から漏れる光と音、支道の入口の跡、異界の門の光）と階段の封（stairsGuarded・drawStairSeal）は src/lib/omens.ts、墓を描く drawGraves は src/lib/fixtures.ts |
| 23-debug | デバッグ（dbg、F2 の画面、URL の指定） |
| 24-goal | 見出しと「〜は src/lib/…」の行だけ。タイトルへ戻る returnToTitle は src/lib/menu.ts、空の枠を拾った時 openSlot・伝説の物を手にした時 pickLegend は src/lib/pickup.ts、最深部を進める updateFinal・王の影を立ち上がらせる spawnFinalBoss は src/lib/levels.ts、勝った時 victory は src/lib/results.ts、支道の主が倒れた時 lordFell は src/lib/combat.ts、最深部の支度 setupFinal は src/lib/levels.ts、枠を開ける applyOpen は src/lib/gear.ts。王の影の大きさ shadowKingScale は src/lib/bodies/lords.ts、二つ目の姿の大きさ shadowSerpentScale は src/lib/bodies/bosses.ts。最深部か isFinal は src/lib/levels.ts、最深部の状態 finalSt は src/lib/state.ts の here、王の影の変身 transformShadow は src/lib/bodies/auras.ts、今の探索の伝説の物 getLegend と状態の表示の1行 legendLine・伝説の物の読み方（legendOfBranch・legendAll・descentSealed）・世界の中に描く drawLegendWorld・神託所の手がかり oracleLegendHints は src/lib/legend.ts、伝説の物の表は src/lib/names.ts、稲妻の見た目 addBolt・sparkCrown・drawBoltFx は src/lib/fx.ts |
| 25-gallery | 見た物の記録、図鑑、試しの間。図鑑の主・試しの間の的の表は src/lib/names.ts、保存する saveSet と忘れられた獣の記録 loadBeasts・recordBeast は src/lib/save.ts、図鑑の見本の獣 beastSamples は src/lib/bodies/lords.ts |
| 26-spells-hud | 「〜は src/lib/…」の行だけ。毒の霧に火が届く cloudsMeetFire は src/lib/projs.ts、詠唱の声 chantStart は src/lib/audio.ts（鳴っている声 humNode は src/lib/state.ts の gear）、転がる startRoll は src/lib/chant.ts。閉じた扉 doorBlock・見通し losClear・光線を撃つ所 beamFrame は src/lib/aim.ts、性質を地面に落とす landElem・水に雷が伝わる conductWater・かわした時 onDodged（かわした時の加護の効く間と発動のルーン）は src/lib/combat.ts。止まっているか isPaused は src/lib/status.ts、下の HUD renderHotbar は src/lib/hotbar.ts、詠唱の声の表は src/lib/sound.ts、凍らせた水を描く drawFrozen は src/lib/fx.ts、冷気 chillArea と凍らせた水が溶ける updateFrozen は src/lib/ground.ts |
| 27-rune-screen | 見出しと「〜は src/lib/…」の行だけ。メニュー（renderMenu・setMenu・menuAct・menuArmReset。指で遊ぶ時は、操作の案内・年代記・魔導書をメニューの中に開き、[戻る] で一覧に戻る）は src/lib/menu.ts。魔導書 renderBook と立ち止まって調べる updateSearch は src/lib/status.ts。装備の画面を作る renderInv と中のボタンの処理（選ぶ・はめる・袋のページ・ビルドの保存と呼び出し applyBuild）・開け閉め setInv・付け替えの詠唱 startSwap は src/lib/inventory.ts、装備の画面の状態（選んでいるルーン packSel・開けた時の両手 packSnap など）は src/lib/state.ts の ui。視点 setCamMode・音量 sndToggle・マウスを捕まえる tryLock は src/lib/screens.ts、枠 boxText は src/lib/text.ts |
| 28-camera-player | 1人称か3人称かを localStorage から読む。霧と目の慣れ updateAtmosphere（霧の濃さ・露出・溶岩の近くの熱のゆらぎ・水中の見え方）・3人称の自分の姿 updateAvatar（姿は src/lib/state.ts の ui.avatar）・岩の断面 drawSection は src/lib/camera.ts。プレイヤーの動き updatePlayer と3人称のカメラ placeThirdPerson は src/lib/player.ts。視点を変える setCamMode は src/lib/screens.ts、3人称のカメラの位置 camPos は src/lib/state.ts の ui、AVATAR_TY は src/lib/names.ts。頭の位置 headPos と、攻撃や投げた物が出る所 aimOrigin は src/lib/aim.ts |
| 29-look | 見た時の説明を出す所 ui.lookEl を document から読む。見た時の説明 look は src/lib/look.ts、説明の表と lookLine は src/lib/names.ts |
| 30-loop-init | 大きさ、メインループ（frame・tick。tick の段ごとの見た目の乱数 inPhase・inMobPhase）、テスト用の `__test`、初期化（init）。ゲームの時刻 time は src/lib/state.ts の clock |
結果の画面は `die()` / `victory()` / `newRun()`（結果の画面のボタンと Enter・R は `startNewRun()`。暗くして、真っ暗になった時に tick が newRun を呼ぶ）、タイトルは `buildIntroPanel()` / `buildUnlockPanel()`。

## 落とし穴
- **宣言の順番（TDZ）**：`buildIntroPanel()` はスクリプトの途中で呼ばれる。そこで使う古い JS の `let`/`const` は、それより前で宣言すること。
  状態の入れ物（src/lib/state.ts）は先に読まれるので TDZ にはならないが、本当の初めの値をその場の代入で入れている欄（`saved.META`・`saved.DEVALL` は
  17-meta.js、`saved.BOOK` は 19-hands-runes.js、`saved.SEEN`・`saved.RSEEN` は 25-gallery.js で localStorage から、カメラ `gfx.camera`・マスの絵 `gfx.cellTex`・場面 `gfx.scene`・描画する部品 `gfx.renderer`・分け合う値 `gfx.U`・後処理 `gfx.finalPass` は 05-renderer.js、文字の部品 `gfx.staticMat`・`gfx.occMat` は 30-loop-init.js、水面の絵 `gfx.waterTex`・`gfx.waterLTex` は 06-world.js、
  見た時の説明を出す所 `ui.lookEl` は 29-look.js、タイトルの画面 `ui.introEl` とミニマップのキャンバス `ui.mapC`・描き手 `ui.mctx` は 16-view-input.js、方向の矢印のキャンバス `ui.arrowCv`・描き手 `ui.arrowCtx`・下の HUD `ui.hotbarEl` と照準の文字 `ui.crossEl` は 22-world-hints.js で document から）は、それより前に読むと、止まらずに黙って仮の値（カメラは位置 0,0,0 と何もしない set だけの物、three.js の物は null か undefined、マスの絵は needsUpdate だけの物、`ui.lookEl`・`ui.introEl`・`ui.mapC`・`ui.mctx`・`ui.arrowCv`・`ui.arrowCtx`・`ui.hotbarEl`・`ui.crossEl` は null）になる。
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
