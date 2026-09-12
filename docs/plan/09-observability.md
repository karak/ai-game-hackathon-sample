# 09. 観測性（Observability）— 実ユーザー＆ボットの E2E プレイテスト向け（Sprint R 計画）

作成 2026-09-12。ユーザー指示: 「次の sprint に実ユーザーおよび bot による e2e プレイテストのための observability を積み、計画する。スコープは console（Chrome DevTools）と wrangler のログ。OTel や外部ツールは導入しないが、導入可能なように構造化ログ・error code・横断の session-id / request-id・context 情報を埋め込める形式にする」。

## 0. 結論（先に決めること）

| 決定 | 内容 | 理由 |
|------|------|------|
| ログは **1 行 1 JSON**（構造化） | すべての出来事を同じ封筒 `LogEvent` に入れる（§2）。人が読む文は `msg`、機械が読む鍵は `code` と `attr` | DevTools のフィルタ、`wrangler tail --format json`、後の OTel 変換が同じ形で済む |
| 出口は 2 つだけ | ① ブラウザ console（開発時は全部、本番は warn 以上）＋ページ内リングバッファ ② `navigator.sendBeacon('/api/log')` → Worker が `console.log(JSON)` → Workers Logs / `wrangler tail` | 外部ツール無し、既存のデプロイ先（Workers Static Assets）に小さな Worker を足すだけ |
| 横断 ID は 3 つ | `sid`（セッション: ページ読込ごと、sessionStorage で再読込に耐える）、`rid`（送信バッチ = リクエスト。Worker 側で `cf-ray` を併記）、`seq`（セッション内の通番） | ボット・実ユーザー・Worker の記録を 1 本の線でつなぐ。OTel の `session.id` / trace 相当にそのまま写せる |
| コードは登録制 | `src/shared/logcodes.js` に `AREA.EVENT` 形式で列挙し、未登録コードはテストで落とす | 集計と検索の鍵を増やし放題にしない。エラーコードはここが正 |
| 個人情報は入れない | UA・言語・画面・パッド名・国（Worker が `request.cf.country`）まで。IP・氏名・アカウントは持たない。テレメトリはオプションで OFF にできる | テスター手引きの既存方針（`docs/release/tester-guide.md`）と同じ |
| 生成予算 0 | 絵の生成は無い | — |

## 1. 目的と、何を見て判断するか

プレイテスト（M5: 5 人・完走率 60%・平均 3 時間以内）とボット E2E で、次の問いに **記録から** 答えられること。

| 問い | 見るもの | 今（Sprint Q 時点） |
|------|----------|---------------------|
| どこで詰まる・死ぬか | `PLAYER.DEATH`（面・座標・原因）、`STAGE.START/CLEAR` の到達ファネル | `deathlog.js` / `runlog.js` が localStorage に持ち、手動コピーで回収 |
| 落ちた・止まった・読めなかった | `ERR.UNCAUGHT` / `ERR.PROMISE` / `ASSET.FAIL` / `PERF.FRAME` の長フレーム | `window.onerror` なし。`console.warn` 2 箇所のみ。落ちても記録が残らない |
| どの環境か | セッション先頭の `SESSION.START`（版・UA・言語・画面・DPR・パッド） | テスター報告 JSON にあるが、落ちた回は回収できない |
| ボットの run と人の run を同じ物差しで | `src: 'bot'|'user'`、`attr.test`（Playwright のテスト名）、`attr.variant` | ボットは各ツールが独自出力（`record_demos.mjs` の trace など） |
| 配信側の異常 | Worker のリクエストログ（404・サイズ超過・不正 JSON） | Workers Logs は有効（`observability.enabled`）だが Worker コードが無く、資産配信のログしか出ない |

## 2. ログの形（`LogEvent`）

```jsonc
{
  "v": 1,                       // スキーマ版
  "ts": "2026-09-12T00:41:03.120Z", // 壁時計（ISO）
  "t": 12345,                   // ページ起動からの ms（順序・間隔はこちらで見る）
  "sid": "8f2c…",               // session-id（crypto.randomUUID、sessionStorage）
  "seq": 42,                    // セッション内通番（欠落検知）
  "rid": "b1d4…",               // 送信バッチの request-id（Worker が cf-ray を rid_ray として併記）
  "src": "user",                // user | bot | worker
  "lvl": "info",                // debug | info | warn | error
  "code": "PLAYER.DEATH",       // 登録済みコード（src/shared/logcodes.js）
  "msg": "died: bog at stage2 (2246,169)", // 人向け 1 行（任意）
  "ctx": { "state": "play", "stage": "stage2", "loop": 0, "lives": 1, "score": 3200, "x": 2246, "y": 169, "t_stage": 44.6, "costume": "plain", "demo": false },
  "attr": { "reason": "bog" },  // コード固有の値（数値・短い文字列のみ）
  "err": { "name": "TypeError", "message": "…", "stack": "3 行まで" }, // error のときだけ
  "build": "a2fb1446"           // デプロイ版（Vite define で埋める。dev は "dev"）
}
```

- `ctx` は **ロガーが毎回自動で付ける**（`Game` の現在値のスナップショット。呼び手は書かない）。`attr` は呼び手が渡す。
- `SESSION.START` だけ `env`（`ua`, `lang`, `vw`, `vh`, `dpr`, `pad`, `touch`）を持つ。他のイベントは `sid` で引く。
- 文字列は 200 文字、`attr` は 20 鍵、1 イベント 2 KB を上限にロガーが切る（超えたら `LOG.TRUNCATED` を 1 回）。
- **OTel への写像**（導入するとき用。今は実装しない）: `ts`→Timestamp、`lvl`→SeverityText、`msg`→Body、`code`→`event.name`、`sid`→`session.id`、`rid`→`request.id`（Span を切るなら `rid` を trace の種に）、`build`→Resource `service.version`、`ctx`/`attr`→Attributes（鍵は `game.` / `player.` の接頭辞に置換）。

### 2.1 コード一覧（初版。追加は `logcodes.js` に登録してから使う）

| コード | lvl | いつ | attr |
|--------|-----|------|------|
| `SESSION.START` | info | ページ起動、`window.__game` 生成直後 | `env` |
| `SESSION.END` | info | `pagehide` / `visibilitychange: hidden` | `sec` |
| `GAME.BOOT` | info | 素材ロード完了 | `bootMs`, `assets`, `loaderWarnings` |
| `GAME.STATE` | debug | `Game.setState` | `from`, `to` |
| `RUN.START` / `RUN.END` | info | `startGame` / タイトル復帰・エンディング・ゲームオーバー確定 | `start`, `loop`, `mode`(new/continue/loop2) / `reached`, `cleared`, `deaths`, `continues`, `sec` |
| `STAGE.START` / `STAGE.CLEAR` | info | `startStage` / 面クリア | `stage`, `index` / `sec`, `deaths` |
| `PLAYER.HIT` | info | 変身解除（`hurt`） | `by`（敵種・弾種）, `x`, `y` |
| `PLAYER.DEATH` | info | `Player.die` | `reason`(hit/fall/spike/bog/press/time), `by`, `x`, `y` |
| `PLAYER.CONTINUE` | info | コンティニュー | `stage` |
| `BOSS.START` / `BOSS.END` | info | ボス登場 / 撃破 | `boss` / `sec`, `hits` |
| `DEMO.START` / `DEMO.END` | debug | 放置デモ | `stage` / `reason`(input/timeout/gameover) |
| `INPUT.PAD` | info | パッド接続・切断 | `id`, `mapping`, `connected` |
| `PERF.FRAME` | info | 30 秒ごと | `fps_p50`, `fps_p95`, `long`（>50 ms の数）, `dropped` |
| `ASSET.FAIL` | warn | 画像・音の読込失敗（`gfx/loader.js` の warn を置換） | `path`, `kind` |
| `SAVE.FAIL` | warn | localStorage 書込失敗 | `key` |
| `ERR.UNCAUGHT` | error | `window.onerror` | `err` |
| `ERR.PROMISE` | error | `unhandledrejection` | `err` |
| `ERR.AUDIO` | warn | AudioContext 生成・再開失敗 | `err` |
| `LOG.DROP` | warn | リングバッファ溢れ・送信失敗の回数（送信時に 1 件） | `dropped`, `sendFail` |
| Worker 側 `EDGE.LOG_BATCH` | info | `/api/log` 受信 | `events`, `bytes`, `country`, `ray` |
| Worker 側 `EDGE.LOG_REJECT` | warn | 不正 JSON・サイズ超過・スキーマ違反 | `why`, `bytes` |

## 3. 構成

```
ブラウザ                                   Cloudflare Worker (worker/index.js)
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ src/platform/log.js          │ sendBeacon│ POST /api/log                │ console.log(JSON) → Workers Logs
│  ・LogEvent を組む（ctx 自動）│ ────────▶│  ・サイズ/スキーマ検査        │ → wrangler tail --format json
│  ・リングバッファ 500 件      │          │  ・rid_ray, country を併記    │ → tools/tail_logs.mjs (NDJSON 保存)
│  ・console 出力（dev: 全部） │          │  ・1 イベント 1 行で出力      │ → tools/log_stats.mjs（集計）
│  ・15 秒/50 件/hidden で送信 │          │ それ以外 → env.ASSETS.fetch  │
│  ・window.__log（dump/copy） │          └──────────────────────────────┘
└──────────────────────────────┘
        ▲            ▲
   Game/World が     ボット（Playwright）が
   log.info(code,…)  log.setSource('bot', {test, variant})
```

- **置き場所と依存**: `src/platform/log.js`（プラットフォーム境界。`shared` のみ依存、`logcodes.js` は `src/shared/`）。`Game` が `log.bind(() => ctxSnapshot)` で文脈の取り方を注入する（platform → app の依存は作らない。`docs/architecture.md` §2 の向きを守り `test/architecture.test.js` を通す）。Worker は `worker/index.js`（`src/` 外。ブラウザのバンドルに入れない）。
- **wrangler.jsonc**: `"main": "worker/index.js"`, `"assets": { "directory": "./dist", "binding": "ASSETS", "run_worker_first": ["/api/*"] }`。資産はこれまで通り Worker を経由せず配る（`/api/*` だけ Worker が受ける）。デプロイ後は `tools/check_dist.mjs <公開 URL>` で 282 読込を再確認する。
- **console の方針**: dev（`import.meta.env.DEV`）は全 lvl を `console.debug/info/warn/error` に `[LYR code sid8]` 接頭辞で出す。本番は warn 以上だけ console、全件はバッファ。DevTools では `[LYR` でフィルタ、`-[LYR` で除外、`window.__log.dump()` で JSON を得る。
- **送信**: `sendBeacon` を 15 秒ごと／50 件／`visibilitychange: hidden`／`error` 発生時に即時。1 回 ≤ 60 KB（超えたら分割）。失敗は数えて次のバッチの `LOG.DROP` に載せる。設定 `telemetry`（既定 ON、オプション画面で OFF。OFF でもバッファと console は動く）。`?telemetry=0` でも OFF。
- **ボット**: `record_demos.mjs` / `autoplay.spec.js` / `golden.spec.js` が `window.__log.setSource('bot', { test, variant })` を呼ぶ。Playwright は `page.route('**/api/log', …)` で受け、本番へ送らない（`test-quality` ルール: 外部依存は route でモック）。
- **テスター報告**（既存の「テスター報告を コピー」）: `sid` と直近 200 件の `LogEvent` を同じ JSON に同梱する（`report: 2`）。

## 4. 作業項目（順番・見積もり・受入基準）

| # | 作業 | 見積 | 受入基準（証跡） |
|---|------|------|------------------|
| R1 | `src/shared/logcodes.js`（コード表）と `src/platform/log.js`（`LogEvent` 生成・ctx 注入・リングバッファ・console 出力・送信・`window.__log`） | 0.5 日 | `test/log.test.js`: スキーマ（必須鍵・上限切り詰め）、通番、バッファ上限、送信トリガ（時間・件数・hidden・error）、未登録コードで throw、PII 鍵（ip/name/email）を弾く。`test/logcodes.test.js`: `src/` 内で使われる `log.*('X.Y'` のコードが全て登録済み |
| R2 | 計装: `main.js`（SESSION.START、GAME.BOOT、onerror/unhandledrejection、PERF.FRAME）、`Game`（STATE/RUN/STAGE/CONTINUE/DEMO）、`Player.die/hit`、`bossflow`、`loader.js`（ASSET.FAIL）、`settings.js`（SAVE.FAIL）、`input.js`（INPUT.PAD）、`audio.js`（ERR.AUDIO） | 0.5 日 | e2e `telemetry.spec.js`: 自走 1 面で `SESSION.START → RUN.START → STAGE.START → PLAYER.DEATH…` が順に出る、`lvl: error` が 0 件、`sid` が全件同じ、`seq` が連番。既存 Vitest 129・Playwright 11 が通る（architecture テスト含む） |
| R3 | Worker `worker/index.js` と `wrangler.jsonc`（main / binding / run_worker_first） | 0.5 日 | `test/worker.test.js`: `handleLog(new Request(...))` で 204 / 405 / 413 / 400、出力 JSON に `rid_ray`・`country`・`received` が付く、1 イベント 1 行。`npm run deploy:preview` で `/api/log` に POST → `wrangler tail --format json` に `EDGE.LOG_BATCH` が出る（NDJSON を `docs/plan/logs/tail/` に保存）。`check_dist` 282 読込は不変 |
| R4 | 道具: `tools/tail_logs.mjs`（`wrangler tail --format json` を NDJSON に落とす）、`tools/log_stats.mjs`（sid ごとの到達ファネル、死亡の面×原因×座標、`ERR.*` と `ASSET.FAIL` の件数、`PERF.FRAME` の p95、ボット/人の別） | 0.5 日 | `test/log_stats.test.js`: 固定の NDJSON から表が出る。`docs/release/tester-guide.md` に「集め方」を追記 |
| R5 | ボット統合: `record_demos.mjs` / `autoplay.spec.js` / `golden.spec.js` が `setSource('bot', …)` を呼び、ゴールデンは `lvl: error` 0 件を追加で assert | 0.25 日 | `e2e/golden.spec.js` の新 assert、`record_demos.mjs` 出力に `sid` |
| R6 | テスター報告 v2（`sid`＋直近 200 件）、オプションに `telemetry` 行、手引き更新 | 0.25 日 | `test/runlog.test.js` に `report: 2` の鍵、`e2e/gamepad.spec.js` の既存 assert 維持 |
| R7 | 記録: `docs/architecture.md` §1 に platform/log と worker/ を追記、`HANDOFF.md` に運用手順（tail・集計・DevTools フィルタ）、`01-status`/`02-near-term` 更新 | 0.25 日 | ドキュメントの該当行 |

合計 2.75 日（1 スプリント）。生成リクエスト 0。

### 4.1 スプリント出口条件（DoD）

1. 実ブラウザ 1 セッション（人）と Playwright 自走 1 本（ボット）の両方について、`wrangler tail` から取った NDJSON を `docs/plan/logs/tail/` に置き、`tools/log_stats.mjs` の表（到達ファネル・死亡・エラー 0 件・p95）を `02-near-term.md` に貼る。
2. Vitest・Playwright・architecture テストが通り、`check_dist`（公開 URL）282 読込が不変。
3. `docs/plan/08-backlog.md` に IMP として起票し、受入基準の各項目にテスト名・commit・ファイルパスの証跡を書く（`sprint-qa-process`）。ユーザー受入（DevTools で `[LYR` フィルタして 1 面遊び、報告 JSON をコピー）を最後に行う。

## 5. リスクと対策

| リスク | 対策 |
|--------|------|
| 送信量・Workers Logs の上限（無料枠の日次イベント数） | debug は送らない（バッファのみ）、`PERF.FRAME` は 30 秒ごと、`GAME.STATE` は debug。1 セッションあたり数百件に収める。上限に当たったら `LOG.DROP` で見える |
| `run_worker_first` で資産配信の経路が変わる | `/api/*` だけに限定。プレビュー環境で `check_dist` と `bootMs` を比べてから本番へ |
| `sendBeacon` の失敗（サイズ・オフライン） | 60 KB で分割、失敗は数えるだけ（再送はしない。順序は `seq` で復元） |
| 個人情報の混入 | ロガーの鍵の許可リスト（§2）で落とす。`err.message` は 200 文字で切る。国は Worker が付け、ブラウザ側では持たない |
| ボットのログが人のログに混ざる | `src: 'bot'` と `attr.test` で分け、集計は既定で人だけ。Playwright は `/api/log` を route で握り本番へ送らない |
| DevTools の console が騒がしくなる | 本番は warn 以上だけ。dev は `[LYR` 接頭辞で一括フィルタ |

## 6. 実装メモ（2026-09-12、R1〜R7 済）— 計画からの差分

| 計画 | 実装 | 理由 |
|------|------|------|
| `src/platform/log.js` に全部 | 核は **`src/shared/log.js`**（LogEvent・通番・切り詰め・リングバッファ・sink）、ブラウザ依存は **`src/platform/telemetry.js`**（console・送信・onerror・PERF.FRAME・`window.__log`） | stage / gfx → platform の import は依存の向きで禁止（`test/architecture.test.js`）。shared なら `player.js`・`bossflow.js`・`input.js`・`audio.js`・`settings.js` から直接 `log.emit()` できる |
| `navigator.sendBeacon` | **`fetch(keepalive: true)` を優先**、無ければ sendBeacon | Playwright の `page.route` は sendBeacon を捕まえられず、E2E で送信内容を検査できなかった。keepalive fetch は pagehide でも届く |
| 送信は既定 ON | **本番だけ既定 ON**。dev サーバー（`import.meta.env.DEV`）は既定 OFF、`?telemetry=1` で ON | dev には `/api/log` が無く 404 の console error が既存 E2E（`keyboard.spec.js`）を落とした |
| `ASSET.FAIL` は loader.js から | `gfx/loader.js` は `LOAD_FAILURES` に積むだけ。`main.js` が `GAME.BOOT` の前に `ASSET.FAIL` を出す | gfx → shared は可だが、読込は起動前に終わるので main で一括のほうが GAME.BOOT の `loaderWarnings` と揃う |
| `BOSS.END` の `hits` | `sec`（登場からの秒）と `deaths` | 被弾数は追っていない。要るなら `Boss.hurt` に数える |
| `RUN.END` はゲームオーバー確定でも | タイトル復帰・エンディング（`finishRun`）のときだけ。ゲームオーバー画面でコンティニューすると run は続く | run の定義（runlog.js）に合わせた。ゲームオーバーは `GAME.STATE`（debug）と `PLAYER.DEATH` で分かる |
| `wrangler tail --format json` は 1 行 1 JSON | **整形済み（複数行）の JSON** で流れる。`tools/tail_logs.mjs` は波括弧の深さで最上位オブジェクトを切り出す | wrangler 4.130 の実測（最初の版は 0 件になった） |
| `LOG.TRUNCATED` は表に無かった | 追加（切り詰めをセッションで 1 回知らせる） | 上限で黙って削るのを避ける |
| dev の `build` は `"dev"` | vite の define は dev サーバーにも効くので base36 の時刻（例 `mtxtpcjf`）。Vitest だけ `'dev'` | 実害なし。デプロイ版は `BUILD_ID` 環境変数で固定できる |

受入の証跡: `test/log.test.js`（9）・`test/logcodes.test.js`（2）・`test/worker.test.js`（4）・`test/log_stats.test.js`（2）・`test/tail_logs.test.js`（2）、`e2e/telemetry.spec.js`（2）、golden に `lvl: error` 0 件と `src` の assert。公開 URL の `wrangler tail` から取った NDJSON は `docs/plan/logs/tail/2026-09-12-sprint-r.ndjson`（ボット 1 セッション＋ボット扱いにしない Playwright 1 セッション。人の実操作はまだ）。集計は `02-near-term.md` の Sprint R 表。

## 7. スコープ外（今回はやらない）

OTel SDK / Collector、Sentry 等の外部 SaaS、サーバー側の永続化（KV/D1/R2 へのログ保存）、リプレイ動画、ヒートマップ描画（`tools/gather_deaths.mjs` の既存で足りる）。§2 の写像表があるので、必要になったら Worker 側で NDJSON → OTLP 変換を足す。
