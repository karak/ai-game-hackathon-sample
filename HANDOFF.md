# HANDOFF — 引き継ぎ（2026-09-11 10:30 JST 時点）

次のセッション（人でも Claude でも）が、このリポジトリの現在地・決定事項・残課題・作業手順を 10 分で把握するための文書。詳細は `docs/plan/` が正で、ここは入口。

## 1. 現在地

- リポジトリ: `/Users/yasushi/projects/poc-square`、**公開リポジトリ https://github.com/karak/ai-game-hackathon-sample**（`origin/main`、public）。HEAD は Sprint Q（デモ全面収録・敵回避ボットの調整・hurt2・box 定義）のコミット（`git log -5`）、`origin/main` へ push 済み、作業ツリー clean
- 検証: `npm test` Vitest **148 件**通過（architecture 5 件、構造化ログ 19 件を含む）、`npm run e2e` Playwright **13 件**通過（構造化ログ `telemetry.spec` 2 件・8 面ボット自走・設定保存・デモ決定論・ポーズ／コンティニュー／2 周目／死亡ログ・実キー回帰・ロード時間・英語 UI・スマホ縦・強化魔法・偽装ゲームパッド・**golden**〔全 8 面の軌跡と画素ハッシュ＋画廊〕）。`npm run build` → `node tools/check_dist.mjs` で dist の素材 282 読込を確認
- 生成予算: Gemini 台帳 `tools/gen_ledger.json` **236 / 280**（当初 200 ＋ 強化魔法に 50 ＋ 2026-09-12 に 30 追加。残 44。台帳の `budget` 欄と `gemini_gen.py` の `BUDGET` が正）。逐次実行、並列禁止。追加分 30 の使い先だった IMP-026 人魚縦長（1）・IMP-018 2 周目挿絵（1）・BUG-008 城の中景 B/C（2）は 2026-09-12 に済（計 4）。残 44 は予備（生成が要る新規項目はユーザー判断）
- **公開中**: https://magical-lyrica.karak97.workers.dev（Cloudflare Workers Static Assets、専用 Worker `magical-lyrica`。`npm run deploy` で更新。`docs/release/deploy.md`）。最終デプロイ Version `b095afbb`（2026-09-13 00:45、デモがドレス優先で取得する再収録を含む。公開 URL で `check_dist` 283 読込・bootMs 653・error 0）。その前 `5102394a`（2026-09-13 00:20、デモ 8 面が全 0 死・BUG-021 を含む。公開 URL で `check_dist` 283 読込・bootMs 760・error 0）。その前 `056b16f7`（2026-09-12 23:40、デモ 8 面の再収録〔総死亡 3〕と BUG-020 を含む。公開 URL で `check_dist` 283 読込・bootMs 615・error 0）。その前 `2aa0c3f2`（2026-09-12 12:35、**Sprint R の Worker `/api/log` と人魚縦長・scene7・城の中景 B/C を含む**。公開 URL で `check_dist` 282 読込・warn 0・error 0、`curl` GET 405 / POST 204、`wrangler tail` で 2 リクエスト 14 イベント受信）。その前 `2e0f11db`（2026-09-12 00:50、第二章の繭移動を含む。公開 URL で 282 読込・bootMs 599）。その前 `a2fb1446`（2026-09-11 13:40、Sprint Q〔デモ全面収録＋敵回避ボット・hurt2・box 定義〕＋ BUG-018/019〔涙の川・第二章の沼 5 タイル化、人魚クリップ〕を含む。公開 URL で `check_dist` 282 読込・bootMs 563 を確認）
- コード構成: `docs/architecture.md`（境界づけられたコンテキスト app / stage / content / gfx / ui / platform / shared）。ファイルを増やす・移すときは `test/architecture.test.js` を通す。振る舞いを変える変更をしたら `GOLDEN_UPDATE=1 npx playwright test e2e/golden.spec.js` で黄金を更新し、差分の理由を commit に書く
- 不具合報告: GitHub Issues https://github.com/karak/ai-game-hackathon-sample/issues/new/choose（テンプレートあり）。テスター計測はオプション「テスター報告を コピー」→ `docs/release/tester-guide.md` → `tools/tester_stats.mjs`
- マイルストーン: M0〜M4 済、M5 は実装分済（テスター計測は人手のため繰延）、M6 済（実機確認のみ繰延）、M7 公開済（バグ報告先と初回ロード短縮 IMP-019 が残）。表は `docs/plan/03-roadmap.md`
- スプリント履歴: E → F → G → H → I → J（公開）→ K（強化魔法）→ L（第二章再設計・カットイン）→ M（挿絵級の画風統一 IMP-022）→ N（毒沼と足場 IMP-021）→ O（テスター計測・パッド診断・Issue テンプレート）→ P（DDD コンテキスト整理とリファクタリング。DEBT-004 / DEBT-011）→ R（観測性: 構造化ログ・Worker `/api/log`・tail/集計。2026-09-12）← Q（人手のいらない残課題: デモ全面収録 IMP-015・hurt2 BUG-007・`box` 定義 DEBT-007、敵回避ボット、沼 5 タイル化 BUG-018・人魚クリップ BUG-019）→ **R（次、計画済み）: 観測性 IMP-027（`docs/plan/09-observability.md`）**（`docs/plan/02-near-term.md` 末尾）

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
| 地面からの隙間は最大 5 タイル | 主人公物理（SPEED 66・JUMP −218・二段 −196）では縁から 6 タイル（96 px）は渡れない（最大到達 96 px、着地に >96 が要る）。レベル編集後は `tools/check_gaps.mjs` を通す。トランポリン・助走・踏み石経路も検査する | BUG-018 |
| 人魚は水の絵の位置でクリップ | `drawBog` は水面タイルの 6 px 下から描くので、人魚のクリップも `waterY + 6`。縦長スプライトへの差し替えは IMP-026（予算要） | BUG-019 |
| 構造化ログの核は shared、ブラウザ依存は platform | `src/shared/log.js`（LogEvent・通番・上限・リングバッファ）はどこからでも `log.emit(code, msg, attr)` できる。console／fetch(keepalive)／onerror／sessionStorage は `src/platform/telemetry.js`。stage・gfx → platform は依存の向きで禁止のため（`09-observability.md` §6） | IMP-027 |
| ログ送信は本番だけ既定 ON | dev サーバーには `/api/log` が無い（404 が console error になり E2E が落ちる）。dev で送信を試すときは `?telemetry=1`、本番で止めるときは `?telemetry=0` かオプション「ログそうしん」OFF。Playwright は `page.route('**/api/log')` で握る | IMP-027 |
| ログコードは登録制で、未使用も落とす | `src/shared/logcodes.js` に無いコードは `log.emit` が throw。`test/logcodes.test.js` が src/worker/e2e/tools を走査し、未登録と未使用の両方を落とす | IMP-027 |
| 鏡像リリカは 22 秒で復活・自分の階でだけ鏡になる | 倒しても消えず `MIRROR_RESPAWN_T`（balance.js）後に同じ軸へ復活（ユーザー指示 2026-09-13）。3 体が同じ軸を共有する塔で全員が主人公の階に重なっていたので、`homeY` ±48 の階でだけ鏡になる（BUG-022） | IMP-028 |
| デモボットはドレスを優先して取る | 落ちている dress / golddress へは後ろでも向かい、価値のある宝箱（私服→dress、3 個目→golddress）は足場へ跳び乗って撃つ。進みは多少落ちてよい（ユーザー指示 2026-09-13）。価値の無い箱は開けない（武器が変わる） | IMP-015 |
| デモの採用基準は死亡 1 回 = 400 | 進んだ距離 − 400 × 死亡 − 400 × ゲームオーバー。以前の 250 では塔で「1 死 1800」が「0 死 1445」に勝った。放置デモで死ぬ方が進みの短さより目立つ | IMP-015 |
| 敵は足場の縁で止まる（ケーキ） | 主人公へ寄る敵が崖から落ちて下の主人公に蛆を降らせていた。縁の先が床でなければ歩かない | BUG-021 |
| デモボットは「止まって撃つ」前に敵の方を向く | 向きは動いた瞬間にしか変わらないので、下がった直後は後ろ向きに撃ち続けて「撃っても減らない」になっていた。1 フレームだけ進行方向へ寄る（`turning`）。敵弾は EnemyShot と同じ物理で軌道を先読みする（`shotPath`） | IMP-015 |
| 風船の亡霊に専用規則は置かない | 跳ばない／待って撃つ／下がる、のどれも死亡を増やした（1 → 3）。一般規則のままが最も遠くまで進む（遊園地 3780・0 死） | IMP-015 |
| 人魚は当たり判定を固定し、絵だけ縦長 | 待機コマを頭〜尾まで描いた 62×66 に差し替えたが、当たり判定は v1 由来の 8×15（`MERMAID_W/H`）、頭頂の位置は `MERMAID_HEAD_ABOVE`（8 セル）で不変。伸びた分は水面下に α0.3 で透かす。スプライト寸法から当たり判定を出す `fitSprite` はこの敵には使わない | IMP-026 |
| 衣装コマの割り当ては 2 パス | 共通コマ → 衣装別コマの順に代入する。1 パスだと manifest の読み込み完了順で共通コマが衣装別を上書きする（BUG-016） | `assets.js assignPlayerFrames`、`test/costume-frames.test.js` |
| 溜めは 2 段階 | 0.9 秒 `CHARGE_T` で溜め魔法、1.8 秒 `SUPER_T` で強化魔法（`magic.js SUPER`）。強化魔法は新規生成素材なしで、既存スプライト＋粒子＋画面演出で作る | 05-systems 5.1、Sprint K |
| 素材の軽量化 | フォントはゲーム用サブセット（`tools/subset_font.py`。文言を足したら作り直す。`test/font-subset.test.js` が漏れを検出）、スプライトはパレット PNG（`tools/optimize_pngs.py`、可逆検査つき）。`/assets/*` は 1 年 immutable なので PNG は `?v=<ビルド ID>` で破棄する | IMP-019、`docs/release/deploy.md` |
| 配信先 | Cloudflare Pages ではなく Workers Static Assets（wrangler 4.130 で Pages 新規作成が Workers に転送される）。`wrangler.jsonc` の `assets.directory=./dist`、Worker 名 `magical-lyrica`。初回ロードはエッジ未キャッシュで 6.6 秒、HIT 後 0.6 秒 | `docs/release/deploy.md`、IMP-019 |
| 配信文書 | `docs/release/`: `itch-page.md`（手順・日英本文）、`known-issues.md`（08-backlog の ID）、`trailer.gif`（384×336, 5.2 MB）/ `trailer_256.gif`（256×224, 2.55 MB）。再生成は `node tools/make_trailer.mjs` | Sprint J |

## 4. 残課題（優先順。ID は 08-backlog）

**Sprint R（観測性 IMP-027）は R1〜R7 済（2026-09-12）。** 残るのはユーザー受入 1 回: 公開 URL を開いて 1 面遊び、DevTools の Console を `[LYR` でフィルタ（本番は warn 以上だけ出る。全件は `window.__log.dump()`）、オプション「テスター報告を コピー」の JSON（`report: 2`、`sid`＋直近 200 件）を `docs/plan/logs/testers/` に置く。開発側は同時に `node tools/tail_logs.mjs --secs 600` を回し、`node tools/log_stats.mjs docs/plan/logs/tail/*.ndjson` の表を `02-near-term.md` Sprint R に追記する（人のセッションでは 30 秒ごとの `PERF.FRAME` も出る）。

**人手待ち（繰延決定済み）**: テスター 5 人の完走率（M5 出口）、IMP-017 死亡多発地点の検証（第三章 x512 棘、涙の川 x1280 沼、工房 x1088 プレス、遊園地 x2688 沼、菓子の森 x2304）、実機ゲームパッド。

**次にやること（優先順）**: 実機ゲームパッドの確認（オプション「ゲームパッド」行、IMP-024）、テスター 5 人の計測（オプション「テスター報告を コピー」→ `docs/release/tester-guide.md` → `tools/tester_stats.mjs`、IMP-023）。itch.io 掲載は任意（原稿 `docs/release/itch-page.md`）。第二章の再設計（IMP-020）と強化魔法は Sprint K・L、挿絵級の画風統一（IMP-022）は Sprint M、毒沼と足場の見え方（IMP-021）は Sprint N で完了。

**M6 の繰延**: 実機スマホ（Playwright の iPhone 13 エミュレーションのみ）、実機パッド。

**技術的負債 P2**: DEBT-003 旧文字列ドット絵の残存（`src/gfx/sprites/*` 1261 行。`assets.js` の敵・ボス・弾・アイテム・主人公シートと `tiles.js` の装飾のフォールバックとして今も参照される。生成素材が全部ある現状では実行時に描かれないが、削除は「読込失敗時に何を出すか」の判断を伴う）、IMP-013 本来の強制スクロール。BUG-008 城の中景（壁面 B/C を 2 リクエストで生成、3 種連結）は 2026-09-12 に済。DEBT-004（world.js 分割）と DEBT-008（生成環境）と DEBT-011（コンテキスト整理）は済。`World` に残るトースト・揺れ・湧きの分離は必要になったときに（`docs/architecture.md` §6）。

**環境メモ（2026-09-11 10:00、ディスク）**: 作業中にディスクが満杯（228 GB 中 186 GB 使用、空き 118 MB）になり Bash の出力ファイルさえ書けなくなった。`uv cache prune`（未使用 3.3 GiB を削除、再取得可）で空き 1.5 GB にして続行。ほかは触っていない。大きいもの: `~/Library/Application Support/MobileSync` 17 GB、`Claude` 9.9 GB、`Notion` 6.6 GB、`~/.colima` 7.0 GB、`~/.npm` 3.1 GB（`_npx` 2.1 GB）、`~/Library/Caches/puccinialin` 2.0 GB（Rust ツールチェーンのキャッシュ）、`ms-playwright` 1.1 GB（E2E に必要）、`~/.claude/projects.bak-20260621-2201` 482 MB。10:07 にユーザー指示で `~/Library/Application Support/Claude/vm_bundles`（Cowork の VM イメージ 8.5 GB）と同 `Cache`（808 MB）を削除し、空き **12 GB**。残りの大物（MobileSync・Notion・colima・npm）は未整理。

**環境メモ（2026-09-11、GitHub MCP）**: Claude Code の GitHub MCP プラグイン（`plugin:github:github`）は環境変数 `GITHUB_PERSONAL_ACCESS_TOKEN`（`~/.zshrc`）を読む。PAT は再生成済みで `api.github.com` / `api.githubcopilot.com/mcp/` とも 200 を確認したが、Claude Code のプロセスが古い環境を引き継いでいると 401 になる。新しいターミナル（またはアプリの再起動）から `claude` を起こしてから `/mcp` を確認する。`gh` CLI（karak）は使える。

**P3**: IMP-009 マイルド表現（血の色。表現の変更なのでユーザー判断）、BUG-006 私服の色分け（手修正）。IMP-015・BUG-007・DEBT-007 は Sprint Q で済。IMP-018（scene7）・IMP-026・BUG-008 は 2026-09-12 に済（台帳 233〜236）。デモのボットは敵回避（候補行動 × 弾の予測のシミュレーション）と放物線先読み入り（総死亡 16 → 6 → 3 → **0**〔2026-09-12 の死因追跡。8 面すべて 0 死、全面 60 秒。塔も賢いボットが選ばれた〕）。ゲーム側の不具合 2 件（BUG-020 針の瞬間移動、BUG-021 ケーキの崖落ち）もこの追跡で見つけて修正。追跡の手順: `--trace <面> --step 3600` で死亡フレーム → `--step 3 --from 秒 --to 秒 --simdump 秒`（DODGE 行に候補ごとの結果と弾・速い敵の座標、mv=向き/理由 j=跳ぶ理由 br=敵待ちの枝 my=自弾）。人手で収録し直すなら `window.__game.startRecording()` → プレイ → `stopRecording()` の JSON を `assets/demo/<面名>.json` に置く。

**ビジュアル保留**: hurt のつば幅 1.45x（傾いた帽子）、fall_nohat 髪幅 1.39x、走り撃ち通過コマの杖。

## 5. 作業手順（コマンド）

```bash
# 開発
npx vite --port 5173 --host 127.0.0.1     # http://127.0.0.1:5173/index.html, /catalog.html
npm test                                   # Vitest
npm run e2e                                # Playwright 11 件（5174 を自動起動、headless）。証跡は test-results/shots/（outputDir は test-results/pw に分離）
npm run build && node tools/check_dist.mjs # dist を vite preview（4174）で起こし素材 282 の読込を確認
node tools/record_demos.mjs [--stages stage2] # デモ入力ログをボットで収録し再生一致を検査（5173 が起きていること。IMP-015）
node tools/check_gaps.mjs [--stages stage-river] # 横スクロール面の「縁から渡れない隙間」を本物の物理で総当たり検査（レベル編集後に必ず。終了コード 1 = 渡れない縁あり）
npm run deploy                             # Cloudflare へ本番デプロイ（wrangler login 済みが前提）。deploy:preview はプレビュー URL のみ
node tools/check_dist.mjs https://magical-lyrica.karak97.workers.dev   # 公開 URL の検証（bootMs・素材・エラー）
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

# 素材生成（Python は本リポの .venv。DEBT-008 で完結済み。外部 HDD の参照プロジェクト venv は不要。PATH の python3 には numpy / google-genai が無い）
PY=".venv/bin/python"
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
- `wrangler tail --format json` は 1 行 1 JSON ではなく整形済み JSON が複数行で流れる。`tools/tail_logs.mjs` は波括弧の深さで切る（行単位の版は 0 件になった）
- Playwright の `page.route` は `navigator.sendBeacon` を捕まえない。ログ送信は `fetch(keepalive)` にしてある。新しい E2E で `/api/log` を検査するときも fetch 前提
- ログコードを増やすときは `src/shared/logcodes.js` → `09-observability.md` §2.1 の表 → 呼び出し、の順。表だけ足して使わないと `test/logcodes.test.js` が落ちる
