# アーキテクチャ — 境界づけられたコンテキストと依存の向き

DDD の「境界づけられたコンテキスト」で `src/` を切り分けた（2026-09-11、Sprint P）。各コンテキストは自分の語彙（ユビキタス言語）と責務を持ち、依存は下表の向きにだけ許す。
違反は `test/architecture.test.js` が import 文を走査して検出する（コンテキストの表と許可リストはそのテストが正）。

## 1. コンテキスト一覧

| コンテキスト | ディレクトリ | 責務・語彙 | 主な集約／サービス |
|---|---|---|---|
| **進行**（Session） | `src/app/` | 1 回の遊び（run）の状態機械: タイトル → プロローグ → 面 → クリア → エンディング／ゲームオーバー。スコア・残機・章の進行・周回・コンティニュー、設定とセーブ、死亡ログ・run 記録（テスター計測）、デモ（放置再生） | `Game`（状態機械）、`screens.js`（各状態の画面描画）、`options.js`（オプション画面の行と操作）、`settings.js`、`runlog.js`、`deathlog.js`、`demo.js` |
| **ステージ**（Stage） | `src/stage/` | 1 面のシミュレーション: タイルマップと物理、主人公・敵・ボス・弾・アイテム・ギミック・魔法、当たり判定、カメラ、演出のタイミング（ヒットストップ・スロー）、難易度定数 | `World`（面のルート集約）、`collision.js`（当たり判定）、`render.js`（面の描画アダプタ）、`physics.js`、`level.js`（記号 → マップと配置）、`camera.js`、`balance.js`、`fx.js`、`decomap.js`、`entities/*` |
| **コンテンツ**（Content） | `src/content/` | 作品データ: 8 章の地形文字列と章題、物語本文（両言語）、ボス名、デモ入力ログ。コードは持たず、ステージ・進行が読む | `levels/index.js`、`levels/stitch.js`、`story.js`、`demos.js` |
| **描画基盤**（Graphics） | `src/gfx/` | 生成素材の読み込みと切り出し、パレット、HD スプライトの blit、地形帯からのタイル合成、背景層、フォールバックの文字列ドット絵 | `assets.js`、`loader.js`、`sprite.js`、`palette.js`、`tiles.js`、`hdworld.js`、`background.js`、`sprites/*` |
| **UI 部品**（UI） | `src/ui/` | 窓・文字・ミニフォント・HUD の描画部品（256×224 の論理座標で配置、実測幅で折り返し） | `window.js`、`text.js`、`minifont.js`、`hud.js`、`layout.js` |
| **プラットフォーム**（Platform） | `src/platform/` | ブラウザとの境界: キーボード／ゲームパッド／タッチ入力、Web Audio の合成音、キー・パッドの既定割り当て | `input.js`、`keymap.js`、`audio.js` |
| **共有カーネル**（Shared） | `src/shared/` | どこからでも使う小さな道具: シード付き乱数、clamp/lerp、表示言語 `t()` と辞書 | `util.js`、`i18n.js` |
| **制作ツール**（Authoring） | `src/catalog/`、`tools/` | ゲームには同梱しない資料と素材パイプライン。ゲームの全コンテキストを読んでよい | `catalog.html`、`tools/*.py`、`tools/*.mjs` |
| 起動 | `src/main.js` | 合成ルート。素材を読み、プラットフォームと進行を組み立て、固定ステップで回す | — |

## 2. 依存の向き（許可リスト）

```
main ──▶ app ──▶ stage ──▶ content
  │       │        │  └───▶ gfx（sprite/palette は entities から、tiles/hdworld/background は render.js から）
  │       │        └──────▶ platform/audio（曲名 SONGS。音は World が game.audio 経由で鳴らす）
  │       ├──────▶ content, gfx, ui, platform
  │       └──────▶ shared
  ├─────▶ platform ──▶ shared（keymap は自前。設定は keymap を読む）
  ├─────▶ gfx ──▶ shared, stage/physics（TILE 定数のみ）
  └─────▶ ui ──▶ gfx, stage/entities/projectiles（WEAPONS の表示）, shared
content ──▶ shared のみ
shared ──▶ なし
catalog ──▶ なんでも
```

禁止（テストで落ちる）: `stage → app`、`content → stage/app/gfx/ui/platform`、`gfx → app/stage(physics 以外)/ui/platform`、`platform → app/stage/gfx/ui`、`shared → それ以外`、`ui → app/platform`。

## 3. 切り分けの根拠（リファクタリング前の計測、2026-09-11）

- `world.js` 395 行のうち描画（`draw` / `drawGimmicks` / `drawWeather` / `drawBog` / `drawPitWalls` / `drawShore`）が 170 行、当たり判定 `collide` が 30 行（DEBT-004）。→ `stage/render.js`・`stage/collision.js` へ（結果: world.js 202 行）。
- `game.js` 422 行のうち各状態の画面描画（`drawTitle` 〜 `drawGameOver`、`drawOptions`、`drawIris`、`drawBossIntro`）が 190 行、オプションの行定義と操作が 70 行。→ `app/screens.js`・`app/options.js` へ。状態機械・遷移・記録は `Game` に残す（結果: game.js 229 行）。
- `input.js`（プラットフォーム）が `settings.js`（進行の永続化）から既定割り当てを読んでいた（下位が上位に依存）。→ 既定割り当てを `platform/keymap.js` に置き、`settings.js` がそれを読む向きに反転。
- `ui/hud.js` が `entities/projectiles.js` の `WEAPONS` を読む: 表示が領域の定数を読むのは許容（UI → stage）。
- `camera.js` が `world.js` の `W, H` を読む（同じコンテキスト内、循環は無い）。

## 4. 回帰の護り

- `e2e/golden.spec.js`: Math.random をシード付きに差し替え、固定入力で全 8 面を 20 秒ぶん回し、30 フレームごとの軌跡（座標・敵数・弾数・スコア・残機・状態・衣装）と、90・600 フレーム目およびタイトル／オプション／ポーズ画面のキャンバス画素ハッシュを `test/golden/stages.json` と比べる。振る舞いを変えないリファクタリングは 1 ビットも変えない。
- 単体 `npm test`（122 件）と E2E 10 件は移設後も同じ数だけ通ること。
- `test/architecture.test.js`: 依存の向き。

## 5. 今後

- `entities/*` の `draw` メソッドは領域オブジェクトが描画基盤（`gfx/sprite.js`）に直接依存している。描画を `stage/render.js` 側へ寄せる（Renderer が entity の種類ごとに描く）のは次段。
- `World` はまだ「ボスの進行」「トースト」「揺れ」も持つ。ボス戦の進行は `stage/bossflow.js` に切れる。
