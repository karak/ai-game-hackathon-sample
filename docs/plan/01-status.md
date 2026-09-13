# 01. 現在地（2026-09-13 Sprint S 時点。M0〜M7 済、公開中。人手の検証〔M5 テスター・M6 実機〕は繰延）

前回の更新は Sprint J（2026-09-09）。以下はすべて 2026-09-13 に `src/gfx/manifest.json`・`tools/gen_ledger.json`・`npm test`・`npm run e2e`・`node tools/check_dist.mjs` で測り直した値。

## 実装済み

| 領域 | 状態 | 証跡 |
|------|------|------|
| コアアクション | 固定ジャンプ・二段ジャンプ（ほうき 2 コマ）・しゃがみ撃ち・武器 4 種・溜め 2 段階（0.9 秒で溜め魔法、1.8 秒で強化魔法）・変身解除・残機・制限時間・中間地点 | `src/stage/entities/player.js`、`magic.js`、8 面ボット自走（`e2e/autoplay.spec.js`）、ADR-0035 |
| ステージ | 8 面: 墓地 272 / 菓子の森 256 / 砂糖城 232 / 涙の川 288 / 人形工房 288 / 骨の遊園地 288 / 鏡の塔 縦 16×122 / 星の墓標 288（ボス連戦 7 体）。制限時間 300 / 300 / 330 / 330 / 330 / 330 / 300 / 600。ギミック: 動く足場・浮島・崩れる板（第二章は飴の板）・はしご・水流・風・綿あめのトランポリン・糖蜜のノズル・ベルト・プレス機・観覧車・走る車。エンディング 7 場面（2 周目は scene7）＋クレジット | `src/content/levels/index.js`、`src/stage/entities/gimmicks.js`、`test/level.test.js`、`test/gimmicks.test.js`・`gimmicks2.test.js`、`tools/check_gaps.mjs`（渡れない縁 0） |
| 敵 | 雑魚 17 種（zombie・mushroom・unicorn・cake・angel・bear・eye・mermaid・umbrella・dollpart・needles・balloon・clown・mirror・gargoyle・cocoon・syruparm）、ボス 9 種（doll・teddy・sugarqueen・serpent・machine・ringmaster・mirrorqueen・noir・noirw）。鏡像リリカは 22 秒で復活・各階固定（ADR-0027） | `src/catalog/specs.js`（SPEC 17・BOSS_SPEC 9）、`src/stage/entities/enemies.js`・`bosses.js`、`test/mirror.test.js` |
| 描画 | 768×672（世界 256×224 の 3 倍）、HD スプライト 1 セル = 1 画面 px、背景 空 / 遠 A・B / 中 ×3（遠・中 1 px/セル、空 3・城の奥壁 2）、地形帯からのタイル合成、HD 粒子・血痕・毒沼・棘、演出（ヒットストップ・フラッシュ・白飛び＋スロー・アイリス・ボス登場・カットイン 4）。文字列ドット絵のフォールバックは撤去し、読めない素材は manifest 寸法の市松プレースホルダ（ADR-0040） | `src/gfx/*`、`src/stage/render.js`・`entityRender.js`、`test/loader.test.js`、`e2e/golden.spec.js`（全 8 面の軌跡・画素ハッシュ・画廊） |
| UI | 論理 256×224 の窓・DotGothic16（サブセット）・HUD・テロップ、タイトル（はじめから／つづきから／2 周目／オプション）／オプション（音量・ミュート・言語・ログ送信・キー／パッド割り当て・テスター報告のコピー）／導入／クリア／ゲームオーバー／エンディング。日本語／英語 | `src/ui/*`、`src/app/screens.js`・`options.js`、`test/text.test.js`、`test/i18n.test.js`、`e2e/boot.spec.js` |
| 音 | Web Audio 合成 SFX 24 種、曲 16（テーマ 8・タイトル・ボス 2・エンディング・ジングル 4）。シーケンサに arp／echo／waves／once＋then | `src/platform/audio.js`、`test/audio-songs.test.js`、ADR-0009 |
| 観測性 | 構造化ログ `LogEvent`（sid / seq / rid / ctx）・登録制コード表・console 出力・`/api/log` → Cloudflare Workers Logs、`tools/tail_logs.mjs`・`log_stats.mjs`、ボットは `src:'bot'`、テスター報告 v2 | `src/shared/log.js`・`logcodes.js`、`src/platform/telemetry.js`、`worker/index.js`、`test/log.test.js`・`logcodes.test.js`・`worker.test.js`、`e2e/telemetry.spec.js`、`docs/plan/09-observability.md`、ADR-0024〜0026 |
| 素材生成 | Gemini 2.5 Flash Image → クロマキー → セル境界検出 → 15 色量子化 → パレット PNG。仕様表 `assets/gen/specs.json`（`box`・`part_sizes`・`shorten_to`）、台帳（逐次・ロック）、派生（帽子合成・衣装置換）。挿絵級は尊重物＋立ち絵ベースを毎回添付し `tools/style_check.py` で比べる | `tools/*.py`、`docs/gen-pipeline.md`、`docs/art-standard.md`、`test/art-standard.test.js`、ADR-0001〜0005・0013・0014・0021・0039 |
| 資料 | デザインカタログ 8 章（キャラ／敵・ボス／アイテム・弾／タイル／背景／ステージ／UI／全素材一覧）。掲載漏れは `test/catalog.test.js` が検査 | `catalog.html`、`src/catalog/*` |
| 入力・保存 | キーボード／Gamepad API（standard mapping、診断行）／タッチ、キーコンフィグ、`localStorage` セーブ（進行・音量・ミュート・言語・ログ送信・割り当て・ハイスコア）、死亡ログ・通しプレイ記録 | `src/platform/input.js`・`keymap.js`、`src/app/settings.js`・`deathlog.js`・`runlog.js`、`test/input.test.js`・`settings.test.js`・`deathlog.test.js`・`runlog.test.js` |
| デモ | 8 面を敵回避ボットで収録（全 0 死、ドレス優先）。面名で照合し再生一致を検査 | `assets/demo/*.json`、`tools/record_demos.mjs`、`test/demo.test.js`、ADR-0019・0028・0029・0031 |
| バランス | 復活地点 ±96 湧き禁止、復活後 2 秒敵弾なし、制限時間は歩行×3＋ボス 90 秒、地面からの隙間は最大 5 タイル。人のデータが出るまで難易度は動かさない | `src/stage/balance.js`、`test/balance.test.js`、ADR-0008・0022 |
| コード構成 | 境界づけられたコンテキスト 8（app / stage / content / gfx / ui / platform / shared / catalog）と依存の向きをテストで守る | `docs/architecture.md`、`test/architecture.test.js`、ADR-0018 |
| テスト | Vitest **152 件**（33 ファイル）＋ Playwright **14 件**（8 ファイル: 8 面ボット自走・golden・実キー・ロード時間／英語 UI／欠落素材のプレースホルダ・スマホ縦・強化魔法・偽装パッド・構造化ログ） | `npm test`、`npm run e2e` |
| ビルド・配信 | Vite（index.html / catalog.html、素材を dist へコピー）、dist 5.4 MB（素材 2.9 MB）。Cloudflare Workers Static Assets、`/assets/*` 1 年 immutable。公開 https://magical-lyrica.karak97.workers.dev Version `d2ab28d0`（check_dist 285 読込・error 0） | `npm run build`、`node tools/check_dist.mjs [URL]`、`npm run deploy`、ADR-0036〜0038 |

## 素材（manifest 285 エントリ、すべて生成素材。文字列ドット絵は 0）

| 種別 | 数 | 内訳 |
|------|----|------|
| 主人公（player 66） | 16 コマ × ドレス／私服／金 ＋ 帽子なし 16 ＋ 帽子・素体 | idle / run1〜4 / run1s・run3s（走り撃ち）/ jump / fall / attack / crouch / hurt / hurt2 / dead / cast1・cast2。私服・金は画素の位置分類で派生（ADR-0041。白・紺・赤の 3 色追加で各 15 色）、割り当ては 2 パス（ADR-0034） |
| 雑魚（enemies 33） | 16 種 × 2 コマ ＋ zombieRise | 人魚 v2 は頭〜尾まで 62×66（当たり判定は固定、ADR-0033）。鏡像は主人公のコマを流用（noSprite） |
| ボス（bosses 20） | 8 体 × 2 コマ ＋ 大蛇（頭 2・胴・尾） | |
| 弾・演出（shots 19） | 自弾 4（star・knife・heart・candle）＋ 溜め charge・meteor・burst・pillar、敵弾 9、毒溜まり、炎 2 コマ | |
| アイテム（items 6） | box・dress・golddress・oneup・potion・candy | 落ちたアイテムも生成素材で描く（BUG-023 修正） |
| 小物（props 2） | ほうき 2 コマ 100×38 / 100×37 | 柄の同一列を削って幅を揃えた。ユーザー評価「部品の合成で生きた動きではない」→ IMP-029 |
| 強化魔法（magicfx 24、cutin 4） | 4 武器 × エフェクト 2〜4 コマ ＋ カットイン 4 枚（1 シート） | ADR-0013 |
| 背景（bg 48） | 8 テーマ × （空 1 + 遠 2 + 中 3） | 遠 A/B・中 3 種を連結（城の中景は BUG-008 で 3 種） |
| 地形・小物（tiles 20、deco 36） | 帯 8 テーマ ＋ ギミック小物 12（はしご・浮島・板・飴の板・トランポリン・ノズル・ベルト・歯車・車・ゴンドラ・軸・プレス）、装飾 36（テーマ別に `DECO_MAP`） | |
| 挿絵（ending 7） | 6 場面 ＋ 2 周目 scene7 | 尊重物 scene1・scene6（ADR-0014） |

## 予算・工数の実測

- 生成リクエスト **238 / 280**（当初 200 ＋ 50 ＋ 30。台帳 232 成功・1 失敗・手動補正 16 を含む）。残 42 は予備。生成が要る項目（IMP-029 ほうき、人魚の尾、hurt のつば幅など）はユーザー判断
- 1 リクエスト 14〜40 秒。1 キャラ（ベース＋モーション 6 シート）≈ 8、1 テーマの背景・地形・装飾 ≈ 8〜10。失敗の主因は契約無視（格子・サイズ・「2 本横並び」を縦に積む）、複数体の分割失敗、衣装変更の無視
- 公開 URL の初回ロード: bootMs 542〜1364（Cloudflare、2026-09-13 の 2 回。目標 3 秒以内）。ローカル preview 153〜199

## 既知の課題（要約。詳細は 08-backlog、docs/release/known-issues.md）

- 人手の検証が未実施: テスター 5 人の完走率（M5）、死亡多発地点の人の目（IMP-017）、実機ゲームパッド（IMP-024）、実機スマホ（M6）、Sprint R のユーザー受入 1 回
- 空だけ 3 px/セル（城は 2）。走り撃ちは 2 コマ運用。hurt のつば幅 1.45x・fall_nohat 髪幅 1.39x（BUG-012 残）。私服の袖口・襟の色分けが単純（BUG-006）
- 本来の強制スクロール（IMP-013）・マイルド表現（IMP-009）は設計／表現の判断待ち
- 素材が読めない環境では市松プレースホルダが見える（旧フォールバックは無い）。テスター報告の `ASSET.FAIL` と突き合わせる
