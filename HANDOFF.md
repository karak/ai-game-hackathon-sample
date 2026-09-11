# HANDOFF — 引き継ぎ（2026-09-11 10:30 JST 時点）

次のセッション（人でも Claude でも）が、このリポジトリの現在地・決定事項・残課題・作業手順を 10 分で把握するための文書。詳細は `docs/plan/` が正で、ここは入口。

## 1. 現在地

- リポジトリ: `/Users/yasushi/projects/poc-square`、**公開リポジトリ https://github.com/karak/ai-game-hackathon-sample**（`origin/main`、public）。HEAD は Sprint Q（デモ全面収録・hurt2・box 定義）のコミット（`git log -3`）、作業ツリー clean
- 検証: `npm test` Vitest **129 件**通過（architecture 5 件を含む）、`npm run e2e` Playwright **11 件**通過（8 面ボット自走・設定保存・デモ決定論・ポーズ／コンティニュー／2 周目／死亡ログ・実キー回帰・ロード時間・英語 UI・スマホ縦・強化魔法・偽装ゲームパッド・**golden**〔全 8 面の軌跡と画素ハッシュ＋画廊〕）。`npm run build` → `node tools/check_dist.mjs` で dist の素材 282 読込を確認
- 生成予算: Gemini 台帳 `tools/gen_ledger.json` **232 / 250**（当初 200 ＋ 強化魔法に 50 追加。残 18）。逐次実行、並列禁止
- **公開中**: https://magical-lyrica.karak97.workers.dev（Cloudflare Workers Static Assets、専用 Worker `magical-lyrica`。`npm run deploy` で更新。`docs/release/deploy.md`）。最終デプロイ Version `0fa29898`（2026-09-11、Sprint P 後半と同内容。**Sprint Q は未デプロイ**: `npm run deploy` で反映）
- コード構成: `docs/architecture.md`（境界づけられたコンテキスト app / stage / content / gfx / ui / platform / shared）。ファイルを増やす・移すときは `test/architecture.test.js` を通す。振る舞いを変える変更をしたら `GOLDEN_UPDATE=1 npx playwright test e2e/golden.spec.js` で黄金を更新し、差分の理由を commit に書く
- 不具合報告: GitHub Issues https://github.com/karak/ai-game-hackathon-sample/issues/new/choose（テンプレートあり）。テスター計測はオプション「テスター報告を コピー」→ `docs/release/tester-guide.md` → `tools/tester_stats.mjs`
- マイルストーン: M0〜M4 済、M5 は実装分済（テスター計測は人手のため繰延）、M6 済（実機確認のみ繰延）、M7 公開済（バグ報告先と初回ロード短縮 IMP-019 が残）。表は `docs/plan/03-roadmap.md`
- スプリント履歴: E → F → G → H → I → J（公開）→ K（強化魔法）→ L（第二章再設計・カットイン）→ M（挿絵級の画風統一 IMP-022）→ N（毒沼と足場 IMP-021）→ O（テスター計測・パッド診断・Issue テンプレート）→ P（DDD コンテキスト整理とリファクタリング。DEBT-004 / DEBT-011）→ Q（人手のいらない残課題: デモ全面収録 IMP-015・hurt2 BUG-007・`box` 定義 DEBT-007）（`docs/plan/02-near-term.md` 末尾）

## 2. 最初に読むもの（順番）

1. `CLAUDE.md` — 作業ルール（4 要素報告、codex-review 不使用、既存コメント削除禁止、生成は逐次）
2. `docs/plan/README.md` → `01-status.md`（現在地）→ `02-near-term.md`（スプリント履歴と受入証跡）→ `08-backlog.md`（未済一覧）
3. `docs/art-standard.md`、`docs/gen-pipeline.md`（絵と生成の基準）
4. `.claude/skills/` の 3 スキル: `retro-game-art-direction` / `generating-pixel-art-with-gemini`（`reference/model-behavior.md` に失敗の記録）/ `verifying-browser-games-with-bots`
5. Claude 用メモリ（`~/.claude/projects/-Users-yasushi-projects-poc-square/memory/MEMORY.md`）: 人手検証と実機パッドは繰延、codex-review 不使用、寸法仕様はパーツ単位の論理 px

## 3. 本日の主な決定（変更するなら理由を docs/plan に書く）

| 決定 | 内容 | 場所 |
|------|------|------|
| 寸法仕様はパーツ単位 | 「同じ大きさ」ではなく部位ごとの論理 px（帽子 35 高／つば 57 幅、頭 40 高／髪幅 40、胴 20、スカート 24、脚 18、計 111、私服 103）。`specs.json part_sizes` → `gemini_gen.py` が PART SIZES ブロックを付与 → `build_sprites.py measure_parts` が QA | ユーザー指示。08-backlog BUG-012 |
| 帽子は原画のもの | 実行時の重ね描き禁止。脱落コマだけ `derive_variants.py ensure_hat` で合成。私服セットは v2 固定 | BUG-009 |
| 走り撃ちは 2 コマ | `run1s` / `run3s`（帽子なし生成＋帽子合成、杖込み幅 103）。通過コマは 2 回とも杖が描かれず不採用。射撃中は 12 tick ずつ交互 | IMP-016、`player.js frame()` |
| 分割は連結成分で切る | `postprocess.py split_frames_masked`（隣コマの部品混入防止）、欠片は最寄りコマへ | BUG-013 |
| 後処理の既定 | 装飾 `fill_holes`＋`trim_thin_bottom`、主人公 `strip_caption`、一枚絵 `trim_border`、背景層に `keep_bottom` 不使用 | 06-asset-pipeline |
| 2 周目 | `progress.cleared` で開放。敵弾速 1.5 倍・ゾンビ湧き間隔 0.8 倍（`balance.LOOP2`）。真の結末 1 場面（挿絵は場面 5 流用） | 05-systems 5.1 |
| コンティニュー | 面の先頭・スコア 0・ハイスコア非記録 | `Game.continueGame` |
| 死亡ログ | `localStorage lyrica_deaths`（600 件上限）。収集は `node tools/gather_deaths.mjs`（無敵なし・残機無限のボット）→ `docs/plan/logs/`。難易度は人のデータが出るまで動かさない | IMP-007 / IMP-017 |
| 音 | シーケンサに `arp` / `echo` / `waves` / `once`＋`then`。ジングル 4（開始・クリア・死亡・ゲームオーバー）、最終ボス曲 `bossFinal`（`stage.bossSong`） | 05-systems 5.5 |
| 性能 | update 0.03 ms・draw 0.16 ms 以下、rAF 20 ms 超 0 回。バッチ化・背景キャッシュは見送り。粒子上限 400 | 05-systems 5.6 |
| 英語 UI | 日本語文字列をキーにした辞書 `src/shared/i18n.js EN` と `t()`。物語本文は `story.js` に両言語（場面数・行数を揃える）。初回はブラウザ言語、以後は保存 `lang`。辞書漏れは `test/i18n.test.js` が t() の呼び出しを走査して検出 | IMP-008 |
| 素材の URL 解決 | `loader.js` はページ URL（`document.baseURI`）基準。build は `vite.config.js copySprites` が `assets/sprites` を dist にコピー。`import.meta.url` 基準に戻すと dist で全素材が消える | BUG-014 |
| カットインは 1 枚のシートで作る | 4 枚を別リクエストで描かせると画風が別人になる。2×2 シートを 1 リクエストで描かせ `postprocess.py --grid` で切る。上端 12 セルは焼き込まれた題名なので落とす | Sprint L、ユーザー指摘 |
| 挿絵級の画風は尊重物に合わせる（済: カットイン 4・ending 3/4/5。ゲーム内スプライトは保留） | `ending/scene1`・`scene6` が画風の尊重物（ユーザー指定）。挿絵級（カットイン・エンディング）は `_illust_style.txt`＋`style_refs`（尊重物 1 枚＋scene1 から切った立ち絵ベース `assets/gen/ref/lyrica-illust*.png`）を毎回添付して生成する。スプライト級の `_style.txt`（チビ）やスプライトを参照に渡すと絵師がスプライト側に寄る。`tools/style_check.py` で flat / 輪郭 / 色数を尊重物と並べて測る | IMP-022、art-standard §1.3・§2.6 |
| 公開リポジトリ | https://github.com/karak/ai-game-hackathon-sample（public、`origin/main`）。不具合報告は Issues https://github.com/karak/ai-game-hackathon-sample/issues/new/choose。`.env` は gitignore、鍵は含まれていないことを push 前に走査 | IMP-025 |
| テスター計測は run 記録＋クリップボード | `src/app/runlog.js`（開始 1 回 = 1 run）。オプション「テスター報告を コピー」の JSON を `docs/plan/logs/testers/` に置いて `tools/tester_stats.mjs`。パッドはオプション「ゲームパッド」行で実機診断、経路は `e2e/gamepad.spec.js` の偽装パッド | IMP-023 / 024 |
| 沼・足場の見え方は章ごとの分岐で直す | 菓子の森だけ `bogStyle: 'syrup'`（糖蜜の水面・深部・穴の奥壁・岸の滴り、`=` は砂糖衣の帯）。他テーマに触れないことは `tools/hash_tiles.mjs` の画素ハッシュで示す | IMP-021、`hdworld.buildSyrupHD`、`world.drawPitWalls` |
| コード構成は境界づけられたコンテキスト | `src/app`（進行）／`stage`（面のシミュレーション）／`content`（作品データ）／`gfx`／`ui`／`platform`／`shared`。依存の向きは `docs/architecture.md` §2、`test/architecture.test.js` が import を走査して検査。回帰の護りは `e2e/golden.spec.js`（全 8 面の軌跡と画素ハッシュ。振る舞いを変えたときだけ `GOLDEN_UPDATE=1` で更新） | Sprint P |
| デモは面名で照合し、ボットで全面収録 | `assets/demo/<面名>.json`（8 面）。`startDemo` は `findDemo` で記録時の面名と照合（章の並び替えで位置がずれない）、`loop = 0`。収録は `node tools/record_demos.mjs`（無敵なし・残機 2 のボット。敵・敵弾・落下物・プレスの先読みと放物線シミュレーションで安全な跳び方だけ実行、素朴な変種も含めて面ごとにスコアで採用。再生と同じ条件で録り、ページを読み直して再生軌跡の一致を検査する）。JSON を書くと Vite が再読込するので書き出しは全面の収録後。調整は `--trace <面> --step 6 --from 秒 --to 秒 --simdump 秒` | IMP-015、Sprint Q |
| hurt2 は被弾直後の白飛び | 被弾から 0.1 秒（`HURT_FLASH_T`）は hurt2、以後 0.25 秒は hurt。衣装に hurt2 が無ければ hurt | BUG-007 |
| `box` は論理箱で改名しない | prompt の Logical box・後処理 `--logical`・manifest `fits` が同じ値を共有する（上限かつ目標）。`docs/gen-pipeline.md` §1 | DEBT-007 |
| 衣装コマの割り当ては 2 パス | 共通コマ → 衣装別コマの順に代入する。1 パスだと manifest の読み込み完了順で共通コマが衣装別を上書きする（BUG-016） | `assets.js assignPlayerFrames`、`test/costume-frames.test.js` |
| 溜めは 2 段階 | 0.9 秒 `CHARGE_T` で溜め魔法、1.8 秒 `SUPER_T` で強化魔法（`magic.js SUPER`）。強化魔法は新規生成素材なしで、既存スプライト＋粒子＋画面演出で作る | 05-systems 5.1、Sprint K |
| 素材の軽量化 | フォントはゲーム用サブセット（`tools/subset_font.py`。文言を足したら作り直す。`test/font-subset.test.js` が漏れを検出）、スプライトはパレット PNG（`tools/optimize_pngs.py`、可逆検査つき）。`/assets/*` は 1 年 immutable なので PNG は `?v=<ビルド ID>` で破棄する | IMP-019、`docs/release/deploy.md` |
| 配信先 | Cloudflare Pages ではなく Workers Static Assets（wrangler 4.130 で Pages 新規作成が Workers に転送される）。`wrangler.jsonc` の `assets.directory=./dist`、Worker 名 `magical-lyrica`。初回ロードはエッジ未キャッシュで 6.6 秒、HIT 後 0.6 秒 | `docs/release/deploy.md`、IMP-019 |
| 配信文書 | `docs/release/`: `itch-page.md`（手順・日英本文）、`known-issues.md`（08-backlog の ID）、`trailer.gif`（384×336, 5.2 MB）/ `trailer_256.gif`（256×224, 2.55 MB）。再生成は `node tools/make_trailer.mjs` | Sprint J |

## 4. 残課題（優先順。ID は 08-backlog）

**人手待ち（繰延決定済み）**: テスター 5 人の完走率（M5 出口）、IMP-017 死亡多発地点の検証（第三章 x512 棘、涙の川 x1280 沼、工房 x1088 プレス、遊園地 x2688 沼、菓子の森 x2304）、実機ゲームパッド。

**次にやること（優先順）**: 実機ゲームパッドの確認（オプション「ゲームパッド」行、IMP-024）、テスター 5 人の計測（オプション「テスター報告を コピー」→ `docs/release/tester-guide.md` → `tools/tester_stats.mjs`、IMP-023）。itch.io 掲載は任意（原稿 `docs/release/itch-page.md`）。第二章の再設計（IMP-020）と強化魔法は Sprint K・L、挿絵級の画風統一（IMP-022）は Sprint M、毒沼と足場の見え方（IMP-021）は Sprint N で完了。

**M6 の繰延**: 実機スマホ（Playwright の iPhone 13 エミュレーションのみ）、実機パッド。

**技術的負債 P2**: DEBT-003 旧文字列ドット絵の残存（`src/gfx/sprites/*` 1261 行。`assets.js` の敵・ボス・弾・アイテム・主人公シートと `tiles.js` の装飾のフォールバックとして今も参照される。生成素材が全部ある現状では実行時に描かれないが、削除は「読込失敗時に何を出すか」の判断を伴う）、BUG-008 城の中景 1 種（2 リクエスト）、IMP-013 本来の強制スクロール。DEBT-004（world.js 分割）と DEBT-008（生成環境）と DEBT-011（コンテキスト整理）は済。`World` に残るトースト・揺れ・湧きの分離は必要になったときに（`docs/architecture.md` §6）。

**環境メモ（2026-09-11 10:00、ディスク）**: 作業中にディスクが満杯（228 GB 中 186 GB 使用、空き 118 MB）になり Bash の出力ファイルさえ書けなくなった。`uv cache prune`（未使用 3.3 GiB を削除、再取得可）で空き 1.5 GB にして続行。ほかは触っていない。大きいもの: `~/Library/Application Support/MobileSync` 17 GB、`Claude` 9.9 GB、`Notion` 6.6 GB、`~/.colima` 7.0 GB、`~/.npm` 3.1 GB（`_npx` 2.1 GB）、`~/Library/Caches/puccinialin` 2.0 GB（Rust ツールチェーンのキャッシュ）、`ms-playwright` 1.1 GB（E2E に必要）、`~/.claude/projects.bak-20260621-2201` 482 MB。10:07 にユーザー指示で `~/Library/Application Support/Claude/vm_bundles`（Cowork の VM イメージ 8.5 GB）と同 `Cache`（808 MB）を削除し、空き **12 GB**。残りの大物（MobileSync・Notion・colima・npm）は未整理。

**環境メモ（2026-09-11、GitHub MCP）**: Claude Code の GitHub MCP プラグイン（`plugin:github:github`）は環境変数 `GITHUB_PERSONAL_ACCESS_TOKEN`（`~/.zshrc`）を読む。PAT は再生成済みで `api.github.com` / `api.githubcopilot.com/mcp/` とも 200 を確認したが、Claude Code のプロセスが古い環境を引き継いでいると 401 になる。新しいターミナル（またはアプリの再起動）から `claude` を起こしてから `/mcp` を確認する。`gh` CLI（karak）は使える。

**P3**: IMP-018 2 周目専用挿絵（1 リクエスト）、IMP-009 マイルド表現（血の色。表現の変更なのでユーザー判断）、BUG-006 私服の色分け（手修正）。IMP-015・BUG-007・DEBT-007 は Sprint Q で済。デモのボットは敵回避（候補行動 × 弾の予測のシミュレーション）と放物線先読み入り（総死亡 16 → 6、全面 60 秒。塔だけ素朴なボットが選ばれ 2 死）。残る死因は妖精の毒の至近弾・針の群れの突進・ピエロのナイフ・塔の蛆弾。人手で収録し直すなら `window.__game.startRecording()` → プレイ → `stopRecording()` の JSON を `assets/demo/<面名>.json` に置く。

**ビジュアル保留**: hurt のつば幅 1.45x（傾いた帽子）、fall_nohat 髪幅 1.39x、走り撃ち通過コマの杖。

## 5. 作業手順（コマンド）

```bash
# 開発
npx vite --port 5173 --host 127.0.0.1     # http://127.0.0.1:5173/index.html, /catalog.html
npm test                                   # Vitest
npm run e2e                                # Playwright 11 件（5174 を自動起動、headless）。証跡は test-results/shots/（outputDir は test-results/pw に分離）
npm run build && node tools/check_dist.mjs # dist を vite preview（4174）で起こし素材 282 の読込を確認
node tools/record_demos.mjs [--stages stage2] # デモ入力ログをボットで収録し再生一致を検査（5173 が起きていること。IMP-015）
npm run deploy                             # Cloudflare へ本番デプロイ（wrangler login 済みが前提）。deploy:preview はプレビュー URL のみ
node tools/check_dist.mjs https://magical-lyrica.karak97.workers.dev   # 公開 URL の検証（bootMs・素材・エラー）
node tools/shot_stages.mjs --stages 1,2 --at 0.35,0.7  # 章の同じ位置を撮って比べる（アートの判断材料）
.venv/bin/python tools/subset_font.py      # 文言を増やしたらフォントのサブセットを作り直す（テストが漏れを検出）
.venv/bin/python tools/optimize_pngs.py    # スプライト PNG のパレット化（可逆検査つき。build_sprites/derive_variants から自動で呼ばれる）
node tools/make_trailer.mjs                # トレーラー GIF 再生成（5175）。--scale 0.3333 --out docs/release/trailer_256.gif でカバー用
node tools/gather_deaths.mjs --runs 2 --secs 150   # 死亡ログ収集（5173 が起きていること）

# 素材生成（Python は参照プロジェクトの venv。DEBT-008）
PY="/Volumes/Mac external HDD/Projects/claude-virtual-office-materialized/.venv/bin/python"
"$PY" tools/gemini_gen.py <spec> [--ref raw.png]   # 1 件ずつ。台帳に記録される
"$PY" tools/build_sprites.py <spec…>               # 後処理 → assets/sprites, manifest。QA WARN を読む
"$PY" tools/derive_variants.py                     # 主人公の帽子合成・衣装・hurt2・run*s
```

- 生成後は必ず `catalog.html` の該当章（キャラクターシート／敵・ボス／背景レイヤー）をスクリーンショットで確認する。比較画像は新しいファイル名で作る（Read ツールは同名画像をキャッシュする）
- 撮影・検証は **Playwright の headless ブラウザ**で行う。Chrome DevTools MCP のタブはユーザーが見ている localhost と同じなので、状態を触ったら `reload` で戻す（本日、性能計測をそのタブで走らせて「勝手に面が切り替わる／ジャンプできない」と見えた事故あり。`verifying-browser-games-with-bots/SKILL.md` に記録）
- 報告は「テスト結果 / ボット結果 / スクリーンショット / 未達と次の手」の 4 要素。主観語は使わない
- 未達・繰延は `docs/plan/08-backlog.md` に ID を付けて記録し、`02-near-term.md` のスプリント表に証跡を書く

## 6. 主要ファイル

| 領域 | ファイル |
|------|---------|
| ゲーム進行・画面（app） | `src/app/game.js`（状態機械・遷移・記録）、`src/app/demo.js`（デモの記録・再生・`findDemo`）、`src/content/demos.js`＋`assets/demo/<面名>.json`（8 面の入力ログ）、`src/app/screens.js`（各状態の画面描画）、`src/app/options.js`（オプション画面）、`src/main.js`（起動・ロード画面・ループ・縮小表示・言語の反映）、`src/shared/i18n.js`（表示言語）、`src/content/story.js`（物語本文 両言語・ボス名） |
| 世界・物理（stage / content） | `src/stage/world.js`（面のルート集約）、`src/stage/render.js`（面の描画）、`src/stage/entityRender.js`（エンティティの描画 `drawEntity`）、`src/stage/collision.js`（当たり判定）、`src/stage/bossflow.js`（ボス戦の進行）、`src/stage/physics.js`、`src/stage/camera.js`、`src/stage/level.js`、`src/content/levels/index.js`（8 面） |
| キャラ（状態と更新。描画は entityRender.js） | `src/stage/entities/player.js`（コマ選択 `frame()`）、`enemies.js`、`bosses.js`、`gimmicks.js`、`magic.js`、`projectiles.js` |
| 描画・素材 | `src/gfx/assets.js`、`loader.js`、`hdworld.js`、`manifest.json`（235 エントリ、生成物） |
| 音・入力（platform） | `src/platform/audio.js`（`SONGS`、`CH_VOL`、`playJingle`）、`src/platform/input.js`、`src/platform/keymap.js`（既定の割り当て） |
| 保存・ログ | `src/app/settings.js`（`lyrica_save`）、`src/app/deathlog.js`（`lyrica_deaths`）、`src/app/runlog.js`（`lyrica_runs`）、`src/stage/balance.js` |
| 生成 | `assets/gen/specs.json`（`part_sizes`、spec ごとの `use` / `frame_use` / `skip_out` / 後処理フラグ）、`assets/gen/prompts/*.txt`、`assets/gen/raw/`（原画は全保存） |
| 資料 | `catalog.html` + `src/catalog/`（manifest 駆動。`test/catalog.test.js` が掲載漏れを検出） |
| 証跡 | `test-results/shots/`（本日の撮影。git 管理外）、`docs/plan/logs/`（死亡ログ）、`docs/release/`（配信原稿・GIF） |

## 7. 既知の注意点

- `src/` や `manifest.json` を書くと Vite の HMR でブラウザが再読み込みされ、撮影用に作った状態は消える。状態を作る→撮る、の間にファイルを書かない
- ブラウザ窓は 1340×900 に `resize_page` してから撮る（縮むと HUD が画面外）
- zsh で `for n in $LIST` は分割されない。名前を列挙する
- `Bash` の `sleep` 連結は使えない。長い処理は `run_in_background` と完了通知
- 生成の再試行は 2 回まで。3 回目は仕様（部位のセル数・箱の大きさ・参照画像）を変える
