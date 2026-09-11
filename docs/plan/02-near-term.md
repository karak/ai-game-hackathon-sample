# 02. 直近ゴール（次の 2 スプリント）

スプリント長: 1 セッション相当。各項目に受入基準（AC）と証跡の取り方を書く。

## Sprint A — 「3 面版を人に遊ばせられる状態」にする

**結果（2026-09-08）**: A-1〜A-5 実装済み（commit e502530 / 94f5396 / 0d46a4e / c262cd8）。証跡は `docs/plan/logs/sprintA-*.png`。**繰延（ユーザー決定 2026-09-08）**: 人手が要る検証（初見テスター計測・死亡地点ログ）はリリース前工程へ後送り。ゲームパッドは購入予定がないため実機検証は保留（ボット注入テストのみ）。

### A-1 ゲームパッド対応とキーコンフィグ
- Gamepad API で十字キー/左スティック・A/B/X/Y・Start をマップ。設定画面で割り当て変更、localStorage 保存
- AC: DualSense / Xbox パッドで全操作が可能。`test/input.test.js` にマッピング表のテスト追加
- 証跡: 設定画面スクリーンショット、テスト結果
- 済: `src/settings.js` / `src/input.js`（standard mapping、左スティック deadzone 0.5、`captureNext` で再割り当て）、`test/input.test.js` 5 件・`test/settings.test.js` 8 件、`logs/sprintA-options.png`。実機パッドでの操作は未検証（ボットは Gamepad オブジェクトを注入）

### A-2 セーブとオプション
- 進行（クリア済みステージ）、ハイスコア、音量、キー設定を localStorage に保存。タイトルに「つづきから」「オプション」
- AC: リロード後に復元。ミュート状態が復元
- 証跡: リロード前後のスクリーンショット
- 済: `lyrica_save`（進行・音量・ミュート・キー・パッド・ハイスコア、旧 `lyrica_hi` 移行）。ボット: 音量 7→5・ミュート ON・ジャンプ=L に変更 → リロード → 復元を確認。`logs/sprintA-title-menu.png`（つづきから 第2章）、`logs/sprintA-continue-stage2-intro.png`

### A-3 バランス初期調整
- 復活直後の安全地帯（中間地点 ±96 世界単位はゾンビ湧き禁止、復活後 2 秒は敵弾なし）
- 各ステージの想定クリア時間 5〜7 分に対して制限時間を再設定（現在 210/210/240）
- AC: ボット自走 3 面クリア。初見テスター 2 人が 1 面を 3 ミス以内でクリア
- 証跡: テスターの死亡地点ログ（座標・原因）を `docs/plan/logs/` に保存
- 済（自動側）: 安全地帯 ±96・復活後 2 秒敵弾なし（`src/balance.js`）、制限時間 300/300/330（歩行×3＋ボス 90 秒の規則、`test/balance.test.js`）。ボット自走 3 面クリア（91.6 / 82.6 / 80.6 秒、復活後の敵弾 0）。**未達**: 初見テスター 2 名の計測

### A-4 素材の穴埋め（生成 ≈ 6 リクエスト）
- 炎スプライト（2 コマ）、キノコ妖精 2 コマ目の再生成、ボス 3 体の 2 コマ目（攻撃／被弾）
- AC: `npm test`（アート基準）通過、カタログ「敵・ボス」で 2 コマ確認
- 証跡: manifest の色数・寸法、カタログスクリーンショット
- 済: 5 リクエスト（台帳 70〜74）。fire1/2 42×53・43×51（10 / 11 色）、mushroom v2 83×94・84×113（15 色）、doll2 160×180・teddy2 126×140・noir2 154×175（各 15 色）。`logs/sprintA-catalog-enemies.png`

### A-5 演出の底上げ（生成不要）
- 被弾時のヒットストップ 4 tick、敵撃破のフラッシュ、ボス撃破の白飛び→スローモーション、画面遷移のアイリスワイプ
- AC: 各演出を確認できるデバッグキー（F1〜）を用意し、スクリーンショット 4 枚
- 済: `src/fx.js`（テスト 5 件）。F1 ヒットストップ 4 tick、F2 撃破フラッシュ、F3 白飛び 0.45 秒→0.3 倍スロー 1.4 秒、F4 アイリス 0.7 秒、F6 ボス登場バナー 2 秒（入力遮断）。`logs/sprintA-fx-boss-intro.png`、`sprintA-fx-iris-wipe.png`、`sprintA-fx-boss-whiteout.png`（ヒットストップと撃破フラッシュは静止画に写らないためボット計測で代替）

## Sprint B — 「4 面目」で新ギミックの型を作る

### B-1 ギミック基盤
- 済（commit efe3570）: `src/entities/gimmicks.js`。M/V 動く足場（±48/±32、周期 4 秒、乗り物処理）、@ 浮島（±8、すり抜け）、! 崩れる板（0.6 秒→消失→8 秒復活）、L はしご（50/s、頂上で立つ、はしご上で射撃、ジャンプで離脱）、> < 水流（地上 ±40/s）、} { 風（空中）。`test/gimmicks.test.js` 5 件
- 動く足場（往復・落下）、崩れる足場、はしご（超魔界村準拠）、水流（横方向の力）、風（空中で横方向の力）
- レベル記号を追加（`M` 動く足場、`L` はしご、`>`/`<` 風・水流、`!` 崩れる足場）。`parseLevel` と `physics` の拡張＋ユニットテスト
- AC: 各ギミックのテストレベル（`test/gimmicks.test.js`）で挙動を数値確認

### B-2 第四章「涙の川」試作（04-stages 参照）
- 済（素材 18 リクエスト、台帳 83〜100。中景 3・遠景 2 は「川面・地面・文字」を描かれて再生成）: 空 201×252、遠景 A/B 236×75・234×74、中景 267×103・253×105・248×70、地形帯 263×260、装飾 4、ギミック小物 3（はしご 44×74・浮島 84×56・板 64×31）、人魚 42×53（半身）・78×77、傘 80×81・70×86、大蛇の頭 82×131・120×131、胴 101×63・尾 83×110（各 15 色）。第三章として `STAGES[2]` に挿入（9 区間 288 タイル）。ボット自走 73.6 秒でクリア、大蛇の enter/sweep/strike/rain を全て通過、エラー 0。`logs/sprintB-river-*.png`
- 素材: 背景 5、地形 1、装飾 4、敵 2 種、ボス 1 ≈ 18 リクエスト
- AC: ボット自走クリア、カタログ「ステージ構成」に俯瞰・セグメント表が出る

### B-3 デモ（アトラクト）モード
- 済: `src/demo.js`（6 操作の held/pressed をビットマスクにし RLE 保存、`DemoRecorder` / `DemoInput`）、`src/util.js` のシード付き乱数 `grand()` にゲーム進行の `Math.random` を置換（enemies 7・bosses 16・items 3・projectiles 3 箇所。粒子・揺れは対象外）。`World` はステージ名ハッシュでシード。タイトル放置 15 秒 → 4 面のデモを 60 秒ずつ順に再生、任意キーで中断。同じデモを 2 回再生して 900 フレーム後の座標・敵数が一致（決定論）。`test/demo.test.js` 4 件。**デモの中身はボット記録（`window.__game.startRecording()`）で、60 秒中に 2〜3 回死ぬ質。人手収録は繰延**
- タイトル放置 15 秒で録画済み入力を再生（`assets/demo/*.json`）。入力で即中断
- AC: 3 面分のデモが 1 分ずつ再生される。決定論性（同じ入力→同じ結果）のテスト

## Sprint C — 「M3: ギミック拡張・溜め魔法・第五章」（2026-09-09）

### C-1 ギミック拡張
- 済（commit ac6b41a）: ベルトコンベア `)` `(`（地上 ±30/s）、プレス機 `%`（3 秒周期: 落下 0.15・停止 0.5・上昇 0.6、落下中と停止中は即死）、観覧車 `O`（半径 48、4 枚、8 秒/周、すり抜け）。`test/gimmicks2.test.js` 3 件

### C-2 溜め魔法 4 種
- 済（commit dbfb9cc）: `src/entities/magic.js`。星=流星群 8 発（各 2、貫通）、ナイフ=分身 2 体が 3 秒連射、ハート=半径 40 の爆発（3、1 回）、キャンドル=火柱 3 本（3 タイル、1.5 秒）。演出スプライト 3 点（台帳 101〜102、ラベル文字を落とす `strip_caption` を後処理に追加）。`test/magic.test.js` 5 件、`logs/sprintC-magic.png`

### C-3 第五章「綿雪の人形工房」試作
- 済: 素材 16 リクエスト（台帳 103〜118。針の群れはサイズ指示を 2 回無視され、4 体横並びで小さく描かせて左 2 体を採用。機械ボスは 2 コマ横並びで 74 セルと低すぎたため単体 2 リクエストで 189/188 セル）。第四章として `STAGES[3]` に挿入（9 区間 288 タイル、プレス機 5・ベルト 2 区間）。敵: 未完成の人形（腕ブーメラン）、縫い針の群れ（槍状突進）。ボス: 人形師の機械 マザーグース（roll/slam/thread/toss）。ボット自走 79.6 秒でクリア、エラー 0。綿雪の天候
- 遠景 B（237×59）は A（248×140）と高さが合わず除外（IMP-011）

### C-4 第六章「骨の遊園地」試作
- 素材 13 リクエスト（台帳 119〜131）: 空 255×211、遠景 270×90・267×125、中景 244×150・239×72・244×98、地形帯 268×173（キー推定を上端サンプルに変更して修正）、装飾 4、ギミック小物 3（車 52×30・ゴンドラ 42×40・軸 41×41）、風船 54×113・69×112、ピエロ 101×107・111×104（箱を 120 幅に拡大）、大観覧車の主 146×187・158×187（各 15 色）
- 第五章として `STAGES[4]` に挿入（9 区間 288 タイル、観覧車 4 基、ジェットコースター 1、血のプール）。敵: 風船の亡霊（膨らんで血の雨）、ピエロ骸骨（ナイフ 2 本）。ボス: 大観覧車の主 グランギニョル（whip / heads / stomp）。ボット自走 69.6 秒でクリア、E2E は全 6 面通過（commit c03ef50）

### 積み残し TODO（ユーザー指示 2026-09-09）
- DEBT-009 デザインカタログの完備（済: manifest 駆動 + 「全素材」章 + `test/catalog.test.js`。`logs/sprintD-catalog-*.png`）
- DEBT-010 ゾンビうさぎの湧きコマを生成に置換（済: 台帳 134、57×63 セル）
- IMP-016 走り撃ち専用コマ 4 枚（走りコマと対）

### Sprint C の未達（08-backlog に登録）
- IMP-010 プレス機の絵が小さい / IMP-011 工房の遠景 B 不使用 / IMP-012 遊園地の中景に暗い地面板 / IMP-013 強制スクロールは乗り物で代替 / IMP-014 章の並び替え（城→第三章、新ボス「砂糖の女王」、ノワール→最終章） / IMP-015 デモ未収録（第四・五章）

## Sprint D — 「M4: 縦スクロール・第七章」（2026-09-09）

### D-1 2 軸カメラ
- 済（commit f1eacda）: `src/camera.js`（横は向きに 16 先読み、縦は主人公を 55% の高さに、部屋とマップでクランプ。3 テスト）。背景層は縦スクロール時に 120 間隔で縦に繰り返し、空は 0.15 倍で流す。ボス部屋はトリガー行を下端に含む 1 画面

### D-2 第六章「鏡の塔」試作
- 素材 11 リクエスト（台帳 136〜146）: 奥壁 266×268（縦横シームレス）、遠景 267×125・262×122、中景 137×75・220×108・205×106、地形帯 247×99、装飾 4（格子キー残りで `tol` 95）、ガーゴイル 98×83・137×93、鏡の女王 105×131・121×131
- 16×122 の塔。床を 9 行ごとに置き、はしごを左右交互に配置。吹き抜けの風は進行方向に押す（ボットが跳んで渡れる向き）。鏡像リリカは主人公の 1 秒前を鏡の軸で反転再生（専用スプライトなし）。E2E の登攀ボット（はしごへ歩く→上を押す→穴は跳ぶ）で 67.6 秒クリア、落下 0、ボスの enter/pose/shards/teleport/twin と 2 コマを確認
- 帽子・走りの修正（ユーザー指摘、commit 1d5836a / a14483f）: 原画の帽子の上に別パーツを重ねていた二重描きを廃止、合成コマは base_hat 実測で配置、走り 3 コマ目を「遠い足が前」で再生成、走行中の射撃で足を止めない

### D-3 最終章「星の墓標」とボス連戦、章の並び替え（IMP-014）
- 済: `parseLevel` が複数の `B` を `bossTriggers` に集め、`stage.bosses` の順に `World.startBoss`。倒すと部屋を開放して次へ（`bossHpMul` で強化）。最終章は 7 体連戦（人形→テディ→機械→観覧車の主→鏡の女王→ノワール→ノワール第 2 形態）。ボット 102.5 秒でクリア、全ボスの状態を確認
- 章順を 8 面版に並び替え: 1 墓地 / 2 菓子の森 / 3 砂糖城（新ボス「砂糖の女王 マリー」）/ 4 涙の川 / 5 人形工房 / 6 遊園地 / 7 鏡の塔 / 最終章 星の墓標。E2E は 8 面通過
- 素材 12 リクエスト（台帳 147〜158）: 星の墓標の空・遠景 2・中景 3・地形帯・装飾 4、ノワール第 2 形態 2、砂糖の女王 2

### D-4 エンディング
- 済: 6 場面のイラスト（台帳 159〜164、各 ≈260×260 セル → 中央 256×224 を 3 px/セルで全画面 = SNES 実解像度）を 6 秒ずつ（1.5 秒後から入力で送れる）表示し、下部の帯に本文 2〜3 行、最後にクレジットのスクロール（`src/story.js ENDING_SCENES / CREDITS`）。`logs/sprintD-ending-*.png`
- 未達: 場面 5 に生成時の暗い枠が残る（中央切り出しで一部は消える）。BGM はエンディング曲を流用（M5 で専用曲）

## 直近の課題（優先順）

| # | 課題 | 対応 | 期限 |
|---|------|------|------|
| 1 | 遠景 2 倍・空 3 倍の密度差 | 済: 遠景 A/B を各テーマ 2 リクエストで生成（台帳 75〜80、82。高さ 83〜111 セル）し 1 px/セルで連結、接地線を y158 に上げて中景の上に出す。空は 3 のまま（城のみ 2）。`test/art-standard.test.js` §2.5、`logs/sprintA-bg-*-far1x.png` | 済 |
| 2 | 城の空が一枚絵（アーチ窓） | 済: 奥壁（石壁＋窓列、横シームレス）として再生成（台帳 81、252×261 セル）。2 px/セルで横に繰り返し、下端 y174 が地面線に一致 | 済 |
| 3 | ボス 1 コマ | A-4 | 済 |
| 4 | 生成台帳の並列書き込み競合 | ファイルロック（`fcntl`）を追加 | 済（`record()`） |
| 5 | 敵弾の当たり判定が旧サイズ（4〜8 世界単位） | 生成スプライトの実寸 ×0.6 に自動追従 | 済（`SHOT_HIT_RATIO`） |
| 6 | E2E が手動スクリプト | 済: `npm run e2e`（`playwright.config.js`、`e2e/autoplay.spec.js` 3 件: 全 4 面ボット自走 clear・エラー 0 / タイトル→オプション→保存 / デモ再生の決定論と中断）。Vite を 5174 で自動起動、6.7 秒 | 済 |
| 7 | ミニフォントの視認性 | 済: `mini()` を DotGothic16 16px（半角 8px 送り = 旧ビットマップと同じ論理 8/3）に置換。旧 3×5 は `miniBitmap()` としてフォント未読込時のフォールバック。`logs/sprintB-hud-minifont.png` | 済 |

## Sprint E — 「ビジュアル残課題の一掃」（2026-09-09、ユーザー指示「ビジュアル面の残課題をまず片付けて」）

| 項目 | 結果 | 証跡 |
|------|------|------|
| BUG-012 コマ寸法 | 仕様を「部位ごとの論理 px」に変更（`specs.json part_sizes` → prompt PART SIZES → build QA）。jump/fall・私服 jump・hurt2・cake を直した | commit（本スプリント）、`tools/gemini_gen.py part_block`、`tools/build_sprites.py measure_parts`、カタログ「キャラクターシート」撮影 `test-results/shots/cat_motion_d1.png` |
| BUG-013 carousel 混入 | 分割を連結成分の所属で切る `split_frames_masked` | `tools/postprocess.py`、`assets/sprites/deco/carousel.png` 79×102 |
| IMP-010 プレス機 | 単体 spec、157×147（3 タイル級） | `test-results/shots/game_workshop_runshoot_d2.png` |
| IMP-011 工房遠景 B | 247×116（A 140 の 0.83 倍、連結条件 0.5〜2 倍を満たす） | `assets/sprites/bg/workshop_far2.png` |
| IMP-012 地面板 | 全 41 層の下端を機械計測、板は残っていない（床帯は意匠） | 08-backlog 記載 |
| IMP-016 走り撃ち | run1s/run3s の 2 コマ（杖込み幅 103）。射撃中は 12 tick 交互 | `test/player-frames.test.js`、上記実機撮影 |
| エンディング場面 5 の額縁 | `--trim-border` で外周の一様色 5 px を除去（場面 4 も 2 px） | `assets/sprites/ending/scene5.png` 265×271 |

未達: 通過コマ（run2s/run4s）に杖を持たせる生成が 2 回とも失敗。hurt のつば幅 1.45x（傾き）。fall_nohat の髪幅 1.39x。台帳 186/200。

## Sprint F — 「M5 前半: 死亡ログ・コンティニュー・2 周目・ポーズ」（2026-09-09）

| 項目 | 結果 | 証跡 |
|------|------|------|
| F-1 死亡地点ログ（IMP-007） | `src/deathlog.js`（記録・上限 600・集計）、`Game.logDeath`、カタログ「ステージ構成」に × と表、収集ボット `tools/gather_deaths.mjs` | `test/deathlog.test.js` 3 件、`docs/plan/logs/deaths-2026-09-09.md`（118 件） |
| F-2 コンティニュー | ゲームオーバーメニュー（コンティニュー／タイトルへ）。面の先頭・スコア 0・ハイスコア非記録 | E2E 4、`test-results/shots/game_gameover_menu_e1.png` |
| F-3 2 周目 | 1 周クリアで `progress.cleared`、タイトルに「2 周目（真の結末）」。敵弾速 1.5 倍・ゾンビ湧き間隔 0.8 倍（`balance.LOOP2`）。エンディングに真の結末 1 場面 | E2E 4、`test/settings.test.js` |
| F-4 ポーズメニュー | つづける／面の はじめから／タイトルへ | `test-results/shots/game_pause_menu_e1.png` |
| F-5 クリア画面 | TIME BONUS／NO MISS 5000／KILLS／SCORE | `Game.stageClear`、`World.kills/deaths` |

死亡ログの所見（ボット 2 周、各面 150 秒）: 多発地点はすべて「足場乗り・沼越え・プレス機のタイミング」で、ボットの行動幅の限界と一致する（IMP-017）。人のテスト前に数値を動かさない。
未達: 2 周目の専用挿絵（IMP-018）、BGM ジングル・最終ボス曲・シーケンサ拡張（次スプリント）。

## Sprint G — 「M5 後半: 音」（2026-09-09）

| 項目 | 結果 | 証跡 |
|------|------|------|
| シーケンサ拡張 | `arp`（和音を 1 ステップずつ分解）、`echo {steps, gain}`、`waves`（チャンネル別波形）、`once`＋`then`（1 回再生→続きの曲） | `src/audio.js playBgm / arpNote / songSteps`、`test/audio-songs.test.js` |
| 最終ボス曲 | `bossFinal`（172 bpm、ハ短調、アルペジオ＋エコー）。`stage.bossSong` → `parseLevel` → `World` | ブラウザ実測: intro 150（jStart）→ play 88（stars）→ ボス 172 |
| ジングル 4 | `jStart`（面開始、intro 中）、`jClear`（クリア画面）、`jDeath`（死亡、復活でテーマ再開）、`jGameOver` | `Game.startStage / stageClear / gameOver`、`World.onPlayerDying` |
| 音量バランス | BGM バス 0.55、`CH_VOL` lead 0.13 / lead2 0.08 / bass 0.28 / arp 0.07 を表として文書化 | 05-systems 5.5 |

未達（M5 出口条件はテスター依存のため繰延）: テスター 5 人の完走率・平均時間、SFX 60 種への拡充、SFX 係数表、繰り返し記法、ADSR。難易度調整は死亡ログ（ボット）を人のデータで裏取りしてから（IMP-017）。
次: M6（描画のバッチ化・アセット事前デコード・ロード画面・モバイル簡易対応・英語 UI）。

## Sprint H — 「M6 前半: 計測・ロード画面」（2026-09-09）

| 項目 | 結果 | 証跡 |
|------|------|------|
| 性能計測 | update 0.01〜0.03 ms、draw 0.07〜0.16 ms、drawImage 18〜42 回/フレーム（塔 215）、rAF 間隔 avg 13.3 ms・20 ms 超 0 回（8 面、ボット走行 300 フレーム） | 05-systems 5.6。バッチ化・背景キャッシュは見送り |
| ロード画面・事前デコード | 進捗バー（フォント → 素材 235 枚）、`img.decode()`、`game.bootMs` | `src/main.js`、`src/gfx/loader.js` |
| 実キー回帰テスト | Space / X / K でジャンプ、右へ 20 秒で面が変わらない | `e2e/keyboard.spec.js`（ユーザー報告の切り分け。原因は DevTools タブへの私の操作） |

残: モバイル簡易対応の確認（タッチパッドは実装済み、実機未確認）、英語 UI（IMP-008）、粒子上限、初回ロード時間の実測（`game.bootMs`）。

## Sprint I — 「M6 後半: 英語 UI・粒子上限・ロード計測・スマホ確認」（2026-09-09）

| 項目 | 結果 | 証跡 |
|------|------|------|
| IMP-008 英語 UI | `src/i18n.js`（日本語文字列がキー、`EN` 辞書、`t()` / `pick()`）。メニュー・ポーズ・ゲームオーバー・クリア・オプション・トースト・章題 8・副題 8・ボス名 9・操作名を翻訳。物語本文（プロローグ 10 行・エンディング 6 場面＋真の結末・クレジット）は `story.js` に両言語、`story()` で選択。設定 `lang`（保存が無ければ `navigator.language`、ja 以外は en）。オプションに「げんご / Language」行。`index.html` の説明文は `[data-lang]` で切替 | `test/i18n.test.js` 5 件（t() の全呼び出し・章題・ボス名・操作名に英語があること、場面数・行数の一致、保存と復元）、`e2e/boot.spec.js` 英語 UI、`test-results/shots/en_title.png` / `en_options.png` / `en_intro.png` |
| 粒子上限 | `PARTICLE_MAX = 400`、超過分は古いものから捨てる | `test/particles.test.js` |
| 初回ロード時間 | `game.bootMs` を E2E で計測し 3 秒未満を検証。実測 110〜445 ms（localhost、Chromium headless、4 並列時が最大） | `e2e/boot.spec.js` |
| スマホ縦 | `main.js fit()` が 768 幅の入らない画面で幅に合わせて縮小（従来は最小 1 倍で横にはみ出していた）。iPhone 13 エミュレーションでキャンバス幅 ≤ 画面幅、タッチパッド表示、▶▶ で開始・X でジャンプ・▶ 長押しで前進 | `e2e/mobile.spec.js`、`test-results/shots/mobile_title.png` / `mobile_play.png` |
| 証跡の保全 | Playwright の `outputDir` を `test-results/pw` に分離（実行ごとに空にされるため `test-results/shots/` が消えていた） | `playwright.config.js` |

未達: 実機スマホ・実機パッド（繰延）。ネット越しのロード時間（公開後に計測）。武器名・溜め魔法名（`projectiles.js` / `magic.js` の `name`）はカタログ専用のため未翻訳。

## Sprint J — 「M7: リリース準備」（2026-09-09）

| 項目 | 結果 | 証跡 |
|------|------|------|
| `npm run build` | **BUG-014**: dist に PNG が 0 枚（`loader.js` が `import.meta.url` 基準で `../../assets/…` を解決し、dist ではサイトの外を指していた）。ページ URL（`document.baseURI`）基準に変更し、`vite.config.js` の `copySprites` プラグインで `assets/sprites` を dist にコピー。dist 6.0 MB、PNG 237 | `node tools/check_dist.mjs`（vite preview → 素材 235 読込・loader 警告 0・エラー 0・bootMs 138）、`test-results/shots/dist_title.png` |
| ライセンス | `LICENSE`（MIT、コード）。生成素材・フォント OFL・自作音源の注記 | `LICENSE` |
| README | 8 章・ギミック・2 周目・言語・テスト件数・ビルド・配信文書への導線 | `README.md` |
| 既知の問題 | `docs/release/known-issues.md`（08-backlog の ID と対応） | 同ファイル |
| itch.io ページ | 手順（HTML zip、Viewport 900×760、タグ、注意表示）と本文（日英） | `docs/release/itch-page.md` |
| トレーラー GIF | `tools/make_trailer.mjs`: ボット自走を 8 fps で撮影（タイトル＋8 章の序盤・中盤＋最終ボス、180 コマ）。`trailer.gif` 384×336（整数 1/2）5.2 MB、`trailer_256.gif` 256×224（世界解像度）2.55 MB（カバー用、3 MB 未満） | `docs/release/trailer*.gif`、`test-results/shots/trailer_contact_2.png` |

| 公開（ユーザー指示 2026-09-10「Cloudflare の静的ページに専用プロジェクト」） | wrangler 4.130 を devDependency に追加。`wrangler pages project create` は Workers デプロイに転送されてエラー（Pages 新規は非推奨）→ Workers Static Assets の専用 Worker `magical-lyrica`（`wrangler.jsonc` assets.directory=dist）。`npm run deploy` / `deploy:preview`。449 ファイル、Version `b1d45468` | https://magical-lyrica.karak97.workers.dev、`node tools/check_dist.mjs <URL>`: 素材 235・エラー 0・bootMs 初回 6640 ms（TTFB 2443）／エッジ HIT 後 627 ms、転送 3.4 MB（フォント 2.07 MB）。`test-results/shots/deploy_title.png` |

未達: バグ報告フォーム（GitHub Issues はリポジトリ公開後）、itch.io 掲載（任意、原稿は `itch-page.md`）、初回ロード 3 秒（IMP-019: フォントのサブセット化・長期キャッシュヘッダ・アトラス化）。

## Sprint K — 「強化魔法・初回ロード短縮・生成環境の自立」（2026-09-10）

| 項目 | 結果 | 証跡 |
|------|------|------|
| 強化魔法（ユーザー指示 2026-09-10「チャージショットの各武器ごとの強化。エフェクトも派手な、魔法扱い。超魔界村を参考に、この世界観に合ったパワーアップ魔法」） | 溜めを 2 段階にした（0.9 秒 = 溜め魔法、1.8 秒 = 強化魔法）。星屑の葬列／鏡像の舞踏会／心臓の花園／蝋の聖歌隊。到達で光輪＋`superready`、発動で揺れ 7・武器色フラッシュ・`supermagic`・魔法名テロップ。新規生成素材なし（既存スプライト＋粒子で構成） | `test/magic.test.js` 11 件（数・威力・周回半径・外向き・遅延爆発・敵弾焼き・段階判定・演出）、`e2e/magic.spec.js`（4 武器を実機で発動、エラー 0）、`test-results/shots/super_star.png` / `super_knife.png` / `super_heart.png` / `super_candle.png`。05-systems 5.1 |
| IMP-019 初回ロード短縮 | フォントを使用文字だけに（457 字 143 KB、全字形 2021 KB。`tools/subset_font.py`、字種は `assets/fonts/game-chars.txt`、`test/font-subset.test.js` が文言追加時の漏れを検出）／スプライト PNG をパレット化（`tools/optimize_pngs.py` 2.61 → 1.12 MB、画素比較で可逆を確認、生成パイプラインにも組み込み）／`public/_headers` で `/assets/*` を 1 年 immutable（PNG は `?v=<ビルド ID>`） | 転送 3.4 → **1.28 MB**、bootMs 初回 6640 → **2070 ms**、以後 **474〜613 ms**（`node tools/check_dist.mjs <URL>`）。タイトル描画はパレット化前後で画素差 0 |
| DEBT-008 生成環境 | 本リポの `.venv` で完結（`requirements.txt`: fonttools/pillow/numpy/google-genai）、`.env.example`、`gemini_gen.py` は 環境変数 → 本リポ `.env` → 参照プロジェクト `.env` の順に探す | `README.md`「素材の生成・更新」、`.venv/bin/python tools/*.py` が動作 |
| モバイル実機（M6 の繰延分） | ユーザーが公開 URL にスマホでアクセスし、操作可能を確認（2026-09-10） | ユーザー報告。エミュレーションの自動確認は `e2e/mobile.spec.js` |
| 残課題の登録 | IMP-020 第二章の再設計（計測付き）、IMP-021 毒沼の見え方 | 08-backlog、`test-results/shots/cmp_stage1_vs_2.png`、`tools/shot_stages.mjs`（章の同位置比較を撮る） |

未達: IMP-020 の実施は**生成予算の判断待ち**（残 14、見積り 8〜10）。バグ報告先（GitHub Issues はリポジトリ公開後）。実機ゲームパッド。

## Sprint L — 「第二章の再設計・カットインの画風統一・衣装の不具合」（2026-09-10）

| 項目 | 結果 | 証跡 |
|------|------|------|
| IMP-020 第二章の再設計（ユーザー承認 2026-09-10。見積り 8〜10 に対し **4 リクエスト**） | 専用敵 2 種: **綿あめの繭**（天井から吊り下がり、真下に来ると落ちて這う。`Y`）、**シロップの腕**（溜まりから 0.4 秒で伸びて 0.5 秒薙ぐ。沈んでいる間は無敵。`A`）。専用ギミック 3 種: **綿あめのトランポリン**（`W`、vy -330）、**糖蜜のノズル**（`D`、1.6 秒ごとに `syrup` 弾＋溜まり）、**飴の板**（`!` を菓子の絵で）。装飾 4 点を菓子版に差し替え（飴の墓標・キャンディケインの十字・砂糖菓子の花・溶けたケーキ）。レベルを全面差し替え（天蓋の上段ルート・沼の谷・飴板の吊り橋・ノズルの回廊） | 台帳 207〜210。計測: 敵は専用 2 種を含む 5 種で **ゾンビうさぎ・天使の骸骨・目玉砲台は 0**（再設計前は 7 種すべて第一章と同じ）、装飾の共有は 8 → **3 点**（tree/blood/bones。いずれも菓子の森向けに描いたもの）、ギミックは沼のみ → **W 4・D 6・! 6・= 27**、地形の段差は 35 → 25 箇所で天井付きの回廊を追加。`test/gimmicks2.test.js` 3 件、`test/level.test.js`、`test-results/shots/cmp_stage2_12.png` / `cmp_stage2_20.png` / `cmp_stage2_40.png` / `cmp_stage2_45.png` |
| カットインの画風統一（ユーザー指摘「絵柄が別人」「4 つ全部一度に生成させるなど、やりようはあるでしょう」） | 4 枚を **1 リクエストの 2×2 シート**で描かせ、緑の隙間で切り出す（`postprocess.py --grid`）。同一キャラ・同一パレット・チビ体型で揃った。焼き込まれた英語題名の帯は上端 12 セルを切って除去（題名はゲーム側のテロップで出す）。表示は整数 2 倍 | 台帳 225。`test-results/shots/cutin_set2.png`（4 枚並び）、`super_candle.png`（実機） |
| フルブルーム衣装のカットイン（ユーザー指摘「衣装がゴールドになっていない」） | プロンプトに金衣装を明記し、参照画像を `idle_gold.png` に変更。5 版試して 2×2 シートで確定 | 台帳 211〜225（うち 3 版は構図・画風が崩れて不採用。判断は art-standard §2.1） |
| BUG-016 衣装のコマ混在（ユーザーがデプロイ版で発見） | `assets.js` の割り当てを 2 パス化（共通 → 衣装別で上書き）。読み込み完了順に依存しなくなった。衣装の色写像も全コマから作るよう変更 | `test/costume-frames.test.js` 3 件（順序をシャッフルして検査）。衣装部分の桃色比 69% → 13〜21%（`idle_gold` 13.4%、`cast1_gold` 21.1%） |
| BUG-017 棒付き飴が出ていない | 記号 `k`（敵マーカーと衝突）→ `l` | `src/decomap.js`、上記スクリーンショット |
| テストの盲点 | 「危険な隙間の渡れるか検査」が天井のある章（城・第二章の回廊）で丸ごと飛んでいた（row 0 から立てる面を探していたため全列が「面なし」になり、assert に到達しなかった）。row 3 以降を見るよう修正 | `test/level.test.js` |

検証: Vitest **118 件**通過、Playwright **9 件**通過（8 面ボット自走を含む）。公開 URL 再デプロイ（Version `b2dcf89b`）、素材 282/282 読込・エラー 0・bootMs 507 ms・転送 1.23 MB。
未達: IMP-021（毒沼の緑と `=` 足場の絵がテーマに合っていない）、実機ゲームパッド、テスター計測。生成台帳 **225/250**。

## Sprint M — 「挿絵級の画風統一（IMP-022）」（2026-09-10）

ユーザー指示: 「画風は `assets/sprites` の scene1, scene6 が尊重物。このフォルダの外の画像は不統一の修正対象。かならずベースになるキャラ画像を入れるなど、絵柄とキャラ立ち絵ベースのデザインを統一する方法を考えよ」。

| 項目 | 結果 | 証跡 |
|------|------|------|
| 尊重物の計測と基準化 | `ending/scene1`・`scene6` を挿絵級の尊重物として art-standard §1.3・§2.6 に登録。`tools/style_check.py` が同じ関数で色数・最暗色（輪郭）・flat（隣接同色率）・dither・彩度/明度を測り、manifest に書き足す。頭身は `--grid` の 4 倍格子で目視 | 尊重物: 32 色・flat 0.16/0.20・輪郭 #220d30/#1e0a24・主人公 4.3 頭身（帽子なし）。旧カットイン: 24 色・flat 0.35〜0.40・2.5 頭身。scene3/4/5: flat 0.30〜0.38。`test-results/shots/canon_vs_cutin_v1.png` |
| 原因 | スプライト級の契約 `_style.txt`（チビ 2.5 頭身）とスプライト `idle_gold.png` を参照に渡していたため、絵師がスプライト側に寄った | v1 プロンプト `assets/gen/prompts/cutin-set-v1.txt` |
| 方法 | ①scene1 からキャラ立ち絵ベースを切り出し `assets/gen/ref/lyrica-illust.png`（桃）、衣装帯（襟〜裾 y 35〜67%）だけ色相を金へ回した `lyrica-illust-gold.png`（0 リクエスト）②挿絵級の契約 `_illust_style.txt`（尊重物の実測値を文章化）③specs の `style` / `style_refs` で**毎回 尊重物 1 枚＋立ち絵ベース 1 枚を添付**（`gemini_gen.py`。無ければ停止）④`build_sprites.py` が挿絵級を尊重物と比べて QA を出し、`test/art-standard.test.js` §2.6 が帯を検査（外れている既存絵は PENDING 列挙） | `tools/style_check.py`、`assets/gen/prompts/_illust_style.txt`、`assets/gen/specs.json cutin-set` |
| カットイン 4 枚の再生成 | 2×2 シート 1 リクエスト（台帳 **226**）。32 色・flat **0.17〜0.23**・輪郭 val 0.19〜0.23・腰上構図（頭 ≈ パネル高の 1/4）。stardust 129×112 / mirror 125×114 / heart 126×117 / wax 126×113。題名は下端に焼き込まれたため `crop_bottom: 12` | `test-results/shots/cutin_v2_vs_v1.png`（上 v1・下 v2・右 立ち絵ベース）、`super_star.png` 〜 `super_candle_after.png`（実機） |
| 後処理の修正 2 件 | 格子の隙間判定を any() から「不透明 5% 未満の行・列」に（モデルが隙間の緑をパレットに寄せて #71a85f で描き、キーから漏れた画素で隙間が見つからなかった）。`trim_border` に行の色数条件 `uniq_max`（粒子で満ちた薔薇の空は std が小さく、額縁と誤認して heart の上 24 行が落ちた） | `tools/postprocess.py grid_main / trim_border` |
| 輪郭の帯 | 尊重物 2 枚（hue 276/286・val 0.19/0.14）から置いた上限 320/0.22 を、同じ手順の v2 暖色パネルが 315〜328 / 0.23 に出たため **335 / 0.23** に広げた（要否はユーザー判断） | `tools/style_check.py`、`test/art-standard.test.js` §2.6 |

| ending scene3/4/5 の再生成（ユーザー承認 2026-09-10「再生成してよい」） | 尊重物 scene1＋立ち絵ベース（桃）添付。台帳 **227〜232**（6 リクエスト）。scene4 は 1 回で 256×256。scene3 は 2 回とも縦長 704×1472（縦長の立ち絵ベースに出力形が引かれた）→ 契約に「正方形 1:1」を追記し、3 回目は参照を正方形切り抜き `lyrica-illust-sq.png` に変えて 262×258。scene5 は夜明けの明るい場面で最暗色 val 0.28 → プロンプトで上空を夜に寄せ（1 回）、残りは `outline_val_max: 0.23`（`postprocess.py clamp_outline`、最暗 1 色・画素比 2.4% のみ）で帯へ | flat 0.30〜0.38 → **0.16 / 0.16 / 0.20**、輪郭 hue 273〜289・val 0.16〜0.23。`test-results/shots/ending_v2_vs_v1.png`、`ending_scene1..6.png`（`tools/shot_ending.mjs`、6 場面とも黒帯 0・エラー 0） |
| 周辺への影響 | `style_check.annotate_manifest` は `cutin/` `ending/` だけに書く（bg/tiles の遠景・中景には触れない。manifest の bg エントリに `flat` なし）。輪郭帯の拡張はこの 2 グループの検査にだけ効く | `src/gfx/manifest.json` の差分は cutin 4・ending 6 のみ |

検証: Vitest **119 件**通過（§2.6 の PENDING は空）、Playwright **9 件**通過、`npm run build` → `check_dist` ok、公開 URL 再デプロイ。
未達: IMP-021、実機ゲームパッド、テスター計測。生成台帳 **232/250**。決定: ゲーム内スプライト（チビ）は統一対象から保留（ユーザー判断 2026-09-10）。輪郭帯の上限拡張（335 / 0.23）はユーザー承認。

## Sprint N — 「第二章の毒沼と足場の見え方（IMP-021）」（2026-09-10、0 リクエスト）

| 項目 | 結果 | 証跡 |
|------|------|------|
| 計測（変更前） | 沼の上の空気の列に背景の地平色が素通し（穴の空気域 flat3x 0.59・11 色）、沼は 1 px 砂目で明度 0.48（地面 0.32）、`=` は菓子の森の地形帯 0.32〜0.42（暗いチョコ礫）を切っていて石に見えた | `test-results/shots/cmp_stage2_36_before.png`、`cmp_stage2_12`（旧） |
| 穴の奥壁 | `world.drawPitWalls`: 沼の両岸の低い方の面から水面まで、地中タイルを 55% 暗くして埋める。水面タイルは 6 px 下げて描くので、その上 6 px も埋める | `cmp_stage2_36.png`、`cmp_stage2_60.png` |
| 糖蜜の水面・深部 | `hdworld.buildSyrupHD`: 2 px の粒、3 px の揺らぐ表面（光・明・中＋暗線）、輪の泡 4 個、桃色・白・黄の砂糖粒。2 段目以降は `bogDeep`（地中帯の苔色）。色を #245a1a/#2f7a22/#4aa034、泡を桃 #ff8fc8 に | 沼の明度 0.48 → 0.35、色数 5 → 11 |
| 岸の滴り | `world.drawShore`: 水面タイルの左右が地面なら土色 3 px を垂らす | 同上 |
| `=` の絵 | `TILE_BANDS.candyforest.plat` 0.32〜0.42 → **0.20〜0.33**（桃色の砂糖衣が滴る帯） | `cmp_stage2_12.png`、`cmp_stage2_60.png` |
| 周辺への影響 | すべて `THEMES.candyforest.bogStyle = 'syrup'` で分岐。他 7 テーマの沼 2 コマ・`=`・地表タイルの画素ハッシュは変更前後で一致 | `tools/hash_tiles.mjs`（before/after の JSON 比較、8 テーマ中 candyforest の bog/plat だけ変化） |

検証: Vitest 119 件、Playwright 9 件、build → check_dist、デプロイ。

## Sprint O — 「残課題の再開: テスター計測・実機パッド・報告経路」（2026-09-10、0 リクエスト）

ユーザー指示「resume them」（残っていた 3 件: バグ報告先・実機ゲームパッド・テスター計測）。人待ちの部分を、人が動けばすぐ測れる形にした。

| 項目 | 結果 | 証跡 |
|------|------|------|
| IMP-023 テスター計測 | `src/runlog.js`: 開始 1 回 = 1 run（開始章・到達章・クリア・死亡・コンティニュー・プレイ秒）、`lyrica_runs` に 50 件。`Game` が startGame / logDeath / continueGame / clear / ending / タイトル復帰で更新。オプション「テスター報告を コピー」が JSON（版・UA・言語・画面・パッド名・run 集計・死亡集計）をクリップボードへ。手引き `docs/release/tester-guide.md`、集計 `tools/tester_stats.mjs` | `test/runlog.test.js` 3 件（丸め・上限・集計・JSON の鍵）、`e2e/gamepad.spec.js`（コピーした JSON に版・パッド名・run・死亡が入る） |
| IMP-024 実機パッド | オプション「ゲームパッド」行にパッド名（先頭 22 字）と押下中のボタン名 `[A] [B]…`。`Input.padId` | `e2e/gamepad.spec.js`: 偽装 standard パッドで START → プロローグ → play、A でジャンプ（vy<0）、十字キー右／左スティックで 30 フレームに 20 単位以上移動、診断行 `Fake Pad` / `Fake Pad  [B]`、「ジャンプ」行で RB を割り当て → 保存。`test-results/shots/options_gamepad.png` |
| IMP-025 報告経路 | Issue テンプレート（日英、テスター報告 JSON 欄・操作方法・スクリーンショット）、README の節、known-issues の更新 | `.github/ISSUE_TEMPLATE/bug_report.yml`、`config.yml`。**残: リポジトリ作成・公開（ユーザー判断）** |
| 文言 | 5 語を i18n に追加、フォントサブセット再生成（463 字・146 KB） | `test/i18n.test.js`、`test/font-subset.test.js` |

検証: Vitest 122 件、Playwright 10 件、build → check_dist、デプロイ。
未達（人待ち）: 実機パッドの確認、テスター 5 人の計測、リポジトリ公開と Issues URL。

## Sprint P — 「境界づけられたコンテキストへの整理とリファクタリング（DEBT-011 / DEBT-004）」（2026-09-11、0 リクエスト）

ユーザー指示「DDD の概念でコンテクストを切り、コンポーネントを整理。次にそれに基づき、回帰テストの保護を入れつつリファクタリング」。

| 項目 | 結果 | 証跡 |
|------|------|------|
| コンテキスト設計 | 進行（app）／ステージ（stage）／コンテンツ（content）／描画基盤（gfx）／UI 部品（ui）／プラットフォーム（platform）／共有カーネル（shared）／制作ツール（catalog, tools）。依存の向きを許可リストで定義 | `docs/architecture.md` §1〜2 |
| 回帰の護り（先に入れた） | `e2e/golden.spec.js`: Math.random をシード付きに差し替え、固定入力で全 8 面 20 秒の軌跡（30 フレームごと 9 値）と 90・600 フレーム目＋タイトル／オプション／ポーズの画素ハッシュを `test/golden/stages.json` に固定。生成直後の再実行で一致を確認 | commit `533401f` |
| 移設 | `tools/move_contexts.mjs`（git mv ＋ import 書き換え 49 ファイル・28 移動） | commit `a9b4ec2`、Vitest 122・Playwright 11 一致 |
| 切り出し | `stage/render.js`（`drawWorld` / `drawGimmicks` / `drawWeather` / `drawBog` / `drawPitWalls` / `drawShore`）、`stage/collision.js`、`stage/viewport.js`（W/H/SCALE、循環回避）、`app/screens.js`（11 画面関数）、`app/options.js`（行定義・操作・文言・描画）、`platform/keymap.js`（既定割り当て。`settings.js` は再公開、`input.js` は keymap を読む向きに反転）。旧メソッドは委譲として残し外部 API（`world.draw` / `game.optionRowText` など）は不変。コメントは本文と一緒に移動 | world.js 395 → 202 行、game.js 422 → 229 行 |
| 依存の検査 | `test/architecture.test.js` 4 件: 全ファイルが既知のコンテキストに属す／許可リスト外の import なし／境界をまたぐ狭い依存（gfx→stage は physics.js、ui→stage は projectiles.js、stage→platform は audio.js）だけ／グラフが空でない | Vitest 126 |

| 後半: エンティティ描画の切り出し（ユーザー指示「残件を進めて」） | 先に護りを拡張（画廊: 全 17 種の敵・9 ボス・11 敵弾・アイテム・毒溜まり・自弾・魔法 16・カットイン 4 を 1 画面に出して 0 / 12 フレーム目を描く。生成直後の再実行で一致）。`entities/*` の `draw` 32 個＋`Player._drawBody`＋`flashImg` を `stage/entityRender.js` へ機械移設（`this` → `e`、`super.draw` → 親の関数）。`drawEntity(e, g, …)` がクラス → 関数の表を継承順に解決。`HD_SCALE` の正を `stage/viewport.js` に移し gfx/sprite.js は再公開。途中の抜け（`SUPER_COLOR` の export、`CHARGE_T` / `CUTIN_SCALE` / `W` / `H` の import、`_drawBody`）はすべて E2E が捕まえた | `test/architecture.test.js` 5 件目「entities は gfx/sprite.js を読まない」、golden 一致 |
| 後半: ボス進行の切り出し | `startBoss` / `bossName` / `onBossDying` / `onBossDefeated` を `stage/bossflow.js` へ。World は委譲（bosses.js・game.js・E2E の呼び出しは不変）。既定引数の `this` 残りを E2E（autoplay）が捕まえて修正 | world.js 395 → **177 行** |

検証: Vitest **127 件**、Playwright **11 件**（golden の軌跡・画素ハッシュ・画廊はリファクタリング前と 1 ビットも違わない）、build → check_dist、デプロイ。

## Sprint Q — 「人手のいらない残課題: デモ全面収録・hurt2・box の定義」（2026-09-11、0 リクエスト）

ユーザー指示「人手のいらない作業を進めて」。生成予算を使う項目（BUG-008・IMP-018）と表現の変更（IMP-009）・設計判断（IMP-013）は触らない。

| 項目 | 結果 | 証跡 |
|------|------|------|
| IMP-015 デモ全面収録 | `tools/record_demos.mjs`: 無敵なし・残機 2 のボット 16 変種を各面 60 秒走らせ「ゲームオーバーにならない → 死亡が少ない → 進んだ距離」で採用、`assets/demo/<面名>.json`（8 面）。収録後にページを読み直し `startDemo` の再生軌跡が収録と一致することを検査。`demos.js` は 8 面を面名で import、`startDemo` は `findDemo` で面名照合、`loop = 0` で 1 周目規則に固定 | 収録結果: stage1 60 s/1 死、stage2 43.8 s/3 死、stage3 35.1 s/3 死、river 60 s/2 死、workshop 51.2 s/3 死、park 60 s/2 死、tower 60 s/2 死、stars 60 s/0 死。8 面とも再生一致。`test/demo.test.js` 5 件目、`test-results/shots/demo_<面名>.png` |
| IMP-015 後半: 敵を避けるボット（ユーザー指示「デモの bot が賢くないので、アクション時に敵を避けるように」） | 敵・敵弾・落下物・沈んだ腕・プレスの先読みと、放物線シミュレーション（単発／頂点で前へ二段／頂点で真下へ二段／歩いて落ちる、トランポリン・動く足場込み）で安全かつ最も遠い跳び方だけ実行。素朴なボットも変種に残し、面ごとにスコアで採用 | 総死亡 16 → 11、stage2 543 → 2266、stage3 524 → 2566、workshop 1106 → 1983、river 2 死 → 0 死。8 面とも再生一致。`test-results/shots/demo_<面名>.png`。調整の道具 `--trace/--simdump` |
| IMP-015 追加調整（ユーザー指示「追加調整をして」） | 弾回避を候補行動のシミュレーション（走る／伏せる／下がる／跳ぶ／跳んで止まる／止まる × 全弾・突進敵の予測）に置換、浮く敵は跳び越えない、ボスは撃ちながら進む、連射、動く足場からの降り方も先読み | 総死亡 11 → 6。stage3 0 死/3668、park 1 死/2613、workshop 1 死/1965。8 面とも再生一致 |
| BUG-007 hurt2 | 被弾直後 0.1 秒は白飛びコマ hurt2、以後は hurt | `test/player-frames.test.js` 4 件目、`test-results/shots/hurt2_frame.png`（私服・白飛び）。golden 一致（ハッシュを取る 90・600 フレーム目に被弾が重ならない） |
| DEBT-007 `box` | 改名せず定義を明文化（論理箱 = prompt・後処理・QA が共有） | `docs/gen-pipeline.md` §1、スキル SKILL.md |
| 環境 | 作業中にディスク残 118 MB で書き込み不能になった。`uv cache prune`（3.3 GiB）で 1.5 GB を確保。ほかは触っていない（下記 HANDOFF 環境メモ） | `df -h` |

検証: Vitest **129 件**、Playwright **11 件**（golden 一致）、build → check_dist 282 読込。デプロイは未実施（ユーザー判断）。

