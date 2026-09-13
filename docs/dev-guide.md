# 開発の手引き（恒常的な手順・主要ファイル・注意点）

セッションごとに変わる内容（現在地・直近の変更・次にやること）は `HANDOFF.md`、決定の記録は `docs/adr/`、未済は `docs/plan/08-backlog.md`。ここには変わらない手順だけを置く（2026-09-13 に HANDOFF から移した）。

## 1. 最初に読むもの（順番）

1. `CLAUDE.md` — 作業ルール（4 要素報告、codex-review 不使用、既存コメント削除禁止、生成は逐次）
2. `HANDOFF.md` — 現在地と次にやること
3. `docs/plan/README.md` → `01-status.md`（現在地）→ `02-near-term.md`（スプリント履歴と受入証跡）→ `08-backlog.md`（未済一覧）
4. `docs/adr/README.md` — 決定の一覧（形式もここ）
5. `docs/art-standard.md`、`docs/gen-pipeline.md`（絵と生成の基準）、`docs/architecture.md`（コード構成）
6. `.claude/skills/` の 3 スキル: `retro-game-art-direction` / `generating-pixel-art-with-gemini`（`reference/model-behavior.md` に失敗の記録）/ `verifying-browser-games-with-bots`
7. （Claude 用メモリは使わない。ユーザー指示 2026-09-13。引き継ぎはこの文書と HANDOFF・ADR・retro）

## 2. 作業手順（コマンド）

```bash
# 開発
npx vite --port 5175 --host 127.0.0.1 --strictPort   # http://127.0.0.1:5175/index.html, /catalog.html。5173 は別プロジェクト（ALCHEMION）が使うことがある。起こしたら curl で src/catalog/index.js を含むことを確認
npm test                                   # Vitest
npm run e2e                                # Playwright（5174 を自動起動、headless）。証跡は test-results/shots/（outputDir は test-results/pw に分離）
npm run build && node tools/check_dist.mjs # dist を vite preview（4174）で起こし素材の読込数を確認
node tools/record_demos.mjs [--stages stage2] # デモ入力ログをボットで収録し再生一致を検査（dev server が起きていること。port は record_demos.mjs の既定を確認。ADR-0019）
node tools/check_gaps.mjs [--stages stage-river] # 横スクロール面の「縁から渡れない隙間」を本物の物理で総当たり検査（レベル編集後に必ず。終了コード 1 = 渡れない縁あり。ADR-0022）
npm run deploy                             # Cloudflare へ本番デプロイ（wrangler login 済みが前提）。deploy:preview はプレビュー URL のみ
node tools/check_dist.mjs https://magical-lyrica.karak97.workers.dev   # 公開 URL の検証（bootMs・素材・エラー）。読込は ?telemetry=0 で行う
node tools/shot_stages.mjs --stages 1,2 --at 0.35,0.7  # 章の同じ位置を撮って比べる（アートの判断材料）
.venv/bin/python tools/subset_font.py      # 文言を増やしたらフォントのサブセットを作り直す（テストが漏れを検出）
.venv/bin/python tools/optimize_pngs.py    # スプライト PNG のパレット化（可逆検査つき。build_sprites/derive_variants から自動で呼ばれる）
node tools/make_trailer.mjs                # トレーラー GIF 再生成（5175）。--scale 0.3333 --out docs/release/trailer_256.gif でカバー用
node tools/gather_deaths.mjs --runs 2 --secs 150   # 死亡ログ収集（5173 が起きていること）

# 構造化ログ（Sprint R、docs/plan/09-observability.md）
node tools/tail_logs.mjs --secs 600 [--out docs/plan/logs/tail/<名>.ndjson]   # 公開 Worker の wrangler tail を NDJSON に落とす（wrangler login 済み）
node tools/log_stats.mjs docs/plan/logs/tail/*.ndjson [--src user|bot|all] [--json]   # sid 表・到達ファネル・死亡 面×原因×x・エラー・fps p95
npx wrangler tail --format json                    # 生のまま見る（整形済み JSON が複数行で流れる）
# ブラウザ側: DevTools Console を "[LYR" でフィルタ、window.__log.dump() / .sid / .flush() / .setSource('bot', {test}) / .stats()。送信の ON/OFF は ?telemetry=1/0

# 素材生成（Python は本リポの .venv。PATH の python3 には numpy / google-genai が無い）
PY=".venv/bin/python"
"$PY" tools/gemini_gen.py <spec> [--ref raw.png]   # 1 件ずつ。台帳に記録される（ADR-0039）
"$PY" tools/build_sprites.py <spec…>               # 後処理 → assets/sprites, manifest。QA WARN を読む
"$PY" tools/derive_variants.py                     # 主人公の帽子合成・衣装・hurt2・run*s
```

- 生成後は必ず `catalog.html` の該当章（キャラクターシート／敵・ボス／背景レイヤー）をスクリーンショットで確認する。比較画像は新しいファイル名で作る（Read ツールは同名画像をキャッシュする）
- 撮影・検証は **Playwright の headless ブラウザ**で行う。Chrome DevTools MCP のタブはユーザーが見ている localhost と同じなので、状態を触ったら `reload` で戻す（性能計測をそのタブで走らせて「勝手に面が切り替わる／ジャンプできない」と見えた事故あり。`verifying-browser-games-with-bots/SKILL.md` に記録）
- 報告は「テスト結果 / ボット結果 / スクリーンショット / 未達と次の手」の 4 要素。主観語は使わない
- 未達・繰延は `docs/plan/08-backlog.md` に ID を付けて記録し、`02-near-term.md` のスプリント表に証跡を書く。後から変えると影響が大きい決定は `docs/adr/` に起こす
- 振る舞いを変える変更をしたら `GOLDEN_UPDATE=1 npx playwright test e2e/golden.spec.js` で golden を更新し、どの面・画面が変わったかを commit で説明する

### デモボットの死因追跡

`node tools/record_demos.mjs --trace <面> --bot '<採用された変種の JSON>' --step 3600` で死亡フレーム（`DIED … frame=N`）を得る → `--step 3 --from 秒 --to 秒 --simdump 秒` で拡大。行の読み方: `mv=向き/理由`（dr）、`j=跳ぶ理由`（jr）、`br=敵待ちの枝`、`co=衣装/武器`、`my=自弾`、`b=塞ぐ敵[y 範囲 hp]`、`sh=弾の予測高さ`、`it=ドレス品`、`mir=鏡像`、`near=近い敵(状態, vy, spitT/hopT)@dx,dy`。`DODGE` 行に回避候補ごとの結果と弾・速い敵の座標。人手で収録し直すなら `window.__game.startRecording()` → プレイ → `stopRecording()` の JSON を `assets/demo/<面名>.json` に置く。

## 3. 主要ファイル

| 領域 | ファイル |
|------|---------|
| ゲーム進行・画面（app） | `src/app/game.js`（状態機械・遷移・記録・`ctxSnapshot`）、`src/app/demo.js`（デモの記録・再生・`findDemo`）、`src/content/demos.js`＋`assets/demo/<面名>.json`（8 面の入力ログ）、`src/app/screens.js`（各状態の画面描画）、`src/app/options.js`（オプション画面）、`src/main.js`（起動・ロード画面・ループ・縮小表示・言語・ログの結線）、`src/shared/i18n.js`（表示言語）、`src/content/story.js`（物語本文 両言語・ボス名） |
| 世界・物理（stage / content） | `src/stage/world.js`（面のルート集約）、`src/stage/render.js`（面の描画）、`src/stage/entityRender.js`（エンティティの描画 `drawEntity`）、`src/stage/collision.js`（当たり判定）、`src/stage/bossflow.js`（ボス戦の進行）、`src/stage/physics.js`、`src/stage/camera.js`、`src/stage/level.js`、`src/stage/balance.js`（難度・復活の定数）、`src/content/levels/index.js`（8 面） |
| キャラ（状態と更新。描画は entityRender.js） | `src/stage/entities/player.js`（コマ選択 `frame()`）、`enemies.js`、`bosses.js`、`gimmicks.js`、`magic.js`、`projectiles.js`、`items.js` |
| 描画・素材 | `src/gfx/assets.js`、`loader.js`（`LOAD_FAILURES`）、`hdworld.js`、`manifest.json`（生成物） |
| 音・入力・ログ（platform） | `src/platform/audio.js`（`SONGS`、`playJingle`）、`input.js`、`keymap.js`（既定の割り当て）、`telemetry.js`（console・送信・onerror・PERF.FRAME） |
| 共有カーネル | `src/shared/log.js`（LogEvent の核）、`logcodes.js`（コード表）、`util.js`、`i18n.js` |
| 配信側 | `worker/index.js`（`/api/log`）、`wrangler.jsonc`、`public/_headers` |
| 保存・ログ | `src/app/settings.js`（`lyrica_save`）、`deathlog.js`（`lyrica_deaths`）、`runlog.js`（`lyrica_runs`、テスター報告 v2） |
| 生成 | `assets/gen/specs.json`（`part_sizes`、spec ごとの `use` / `frame_use` / `skip_out` / 後処理フラグ）、`assets/gen/prompts/*.txt`、`assets/gen/raw/`（原画は全保存）、`tools/gen_ledger.json`（台帳・予算） |
| 道具 | `tools/record_demos.mjs`、`check_gaps.mjs`、`check_dist.mjs`、`shot_stages.mjs`、`tail_logs.mjs`、`log_stats.mjs`、`gather_deaths.mjs`、`tester_stats.mjs`、`hash_tiles.mjs`、`make_trailer.mjs` |
| 資料 | `catalog.html` + `src/catalog/`（manifest 駆動。`test/catalog.test.js` が掲載漏れを検出）、`docs/adr/`（決定）、`docs/plan/`（計画・受入証跡・backlog） |
| 証跡 | `test-results/shots/`（撮影。git 管理外）、`docs/plan/logs/`（死亡ログ・tail の NDJSON・テスター報告）、`docs/release/`（配信原稿・GIF） |

## 4. 既知の注意点

- `src/` や `manifest.json` や `assets/demo/*.json` を書くと Vite の HMR でブラウザが再読み込みされ、撮影用に作った状態は消える。状態を作る→撮る、の間にファイルを書かない。収録ツールの JSON 書き出しは全面の収録後
- ブラウザ窓は 1340×900 に `resize_page` してから撮る（縮むと HUD が画面外）
- 本番バンドルはクラス名が縮められるので、ボットや検証スクリプトで `e.constructor.name` に頼らない（人魚は `waterY`、鏡像は `axis`、繭は `crawlT`、亡霊は `swell` のような固有のフィールドで見る）
- zsh で `for n in $LIST` は分割されない。名前を列挙する
- `Bash` の `sleep` 連結は使えない。長い処理は `run_in_background` と完了通知
- macOS の `sed -i` は `''` が要る。zsh では `--include='*.js'` を引用する
- Python の一括置換で `assert old in s` が落ちると、そのスクリプトの全置換が書かれない（例外で `write_text` に届かない）。落ちたら該当文字列を確かめて全体をやり直す
- 生成の再試行は 2 回まで。3 回目は仕様（部位のセル数・箱の大きさ・参照画像）を変える（ADR-0039）
- `wrangler tail --format json` は 1 行 1 JSON ではなく整形済み JSON が複数行で流れる。`tools/tail_logs.mjs` は波括弧の深さで切る（行単位の版は 0 件になった）
- Playwright の `page.route` は `navigator.sendBeacon` を捕まえない。ログ送信は `fetch(keepalive)` にしてある（ADR-0025）。新しい E2E で `/api/log` を検査するときも fetch 前提
- ログコードを増やすときは `src/shared/logcodes.js` → `09-observability.md` §2.1 の表 → 呼び出し、の順（ADR-0026）
- 公開サイトの index.html は `max-age=0` だが Cloudflare で `cf-cache-status: HIT` が出ることがある。古い画面が出たら Shift＋再読み込み、`window.__log.dump()[0].build` で版を見分ける

## 5. 環境メモ

- ディスク（2026-09-11）: 空き 118 MB で Bash の出力ファイルさえ書けなくなった。`uv cache prune`（再取得可）で回復。ユーザー指示で `~/Library/Application Support/Claude/vm_bundles`（8.5 GB）と同 `Cache`（808 MB）を削除。大きいまま残っているもの: `~/Library/Application Support/MobileSync` 17 GB、`Notion` 6.6 GB、`~/.colima` 7.0 GB、`~/.npm` 3.1 GB、`~/Library/Caches/puccinialin` 2.0 GB、`ms-playwright` 1.1 GB（E2E に必要）、`~/.claude/projects.bak-20260621-2201` 482 MB。ENOSPC が出たらまず `df -h /System/Volumes/Data`、再取得できるキャッシュ以外は消さずにユーザーへ返す
- GitHub MCP（2026-09-11）: プラグイン `plugin:github:github` は `GITHUB_PERSONAL_ACCESS_TOKEN`（`~/.zshrc`）を読む。PAT が有効でも Claude Code のプロセスが古い環境を引き継いでいると 401 になる。新しいターミナルから `claude` を起こして `/mcp` を確認。`gh` CLI（karak）は使える
- Serena MCP は接続がタイムアウトすることがある。ファイル操作は標準ツールで代替できる
- Python は本リポの `.venv`（`requirements.txt`: fonttools/pillow/numpy/google-genai）。外部 HDD の参照プロジェクトは不要
