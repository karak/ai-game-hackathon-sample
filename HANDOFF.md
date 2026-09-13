# HANDOFF — セッション引き継ぎ（動的な内容だけ）

恒常的な内容はここに書かない: 手順・主要ファイル・注意点・環境は `docs/dev-guide.md`、決定は `docs/adr/`（形式は `docs/adr/README.md`）、未済は `docs/plan/08-backlog.md`、受入証跡は `docs/plan/02-near-term.md`。

## 1. 現在地（2026-09-13 13:05 JST）

- HEAD: Sprint S（DEBT-003・BUG-023・BUG-024）をコミット済み、`origin/main` と一致。`git log -4` 参照
- 公開: https://magical-lyrica.karak97.workers.dev Version `68717f69`（2026-09-13 17:40 デプロイ、ユーザー指示。`check_dist` 285 読込・bootMs 582・loaderWarnings 0・error 0。公開 URL で私服 idle が 15 色・赤 124 画素・白 452 画素 = 新私服、`assets.broom` あり、`missing` 0 件）。HEAD のコードと同一（以後のコミットは docs のみ）
- 検証: Vitest 152 件（`test/loader.test.js` 4 件を含む）、Playwright 14 件通過（golden は画廊 f0/f12 と、ほうきの出る 8 面の 90 フレーム目・工房／塔の 600 フレーム目を更新。軌跡・メニューは不変）。build → check_dist 285 読込・bootMs 153・loaderWarnings 0。デモ 8 面はすべて 0 死・再生一致
- 生成予算: 台帳 `tools/gen_ledger.json` **238 / 280**（残 42。予備。生成が要る新規項目はユーザー判断）
- Vite dev server は **127.0.0.1:5175**（`nohup`、ログ `/tmp/claude-501/vite5175.log`）。5173 は別プロジェクト（ALCHEMION）の dev server に取られていて、そこへ当てた確認は無効になる。起こすときは `npx vite --port 5175 --host 127.0.0.1 --strictPort`、確認前に `curl -s http://127.0.0.1:5175/catalog.html | grep src/catalog/index.js`

## 2. 今回のセッション（9/13 昼、Sprint S）でやったこと

1. DEBT-003 旧文字列ドット絵の撤去（0 リクエスト）: 38 種すべてに生成素材があり装飾 9 種は全面で未使用と計測してから `src/gfx/sprites/*`・`tools/gen_player.py`・`makeSprite/buildSheet`・`COSTUMES` を削除。読めない素材は manifest 寸法の市松プレースホルダ（ADR-0040、`test/loader.test.js`、`e2e/boot.spec.js` 1 件追加）
2. 調査で発見した BUG-023 を修正: 宝箱から出たアイテムが公開版でも旧文字列ドット絵で描かれていた（`pickups` を生成素材の合流前に作っていた）。証跡 `test-results/shots/pickups_before_debt003.png` / `_after_`
3. 調査で発見した BUG-024（二段ジャンプのほうきが `w/h` 欠落で一度も描かれていなかった）をユーザー承認で HD 生成して修正（台帳 237〜238）: `props/broom`・`broom2` 100×38 / 100×37 セル・15 色。v1 単体 171×36 は不採用、v2 の柄 59 列を `build_sprites.py shorten()` で削除。証跡 `test-results/shots/broom_vs_idle_3x.png`・`broom_ingame_doublejump.png`
4. デプロイ（ユーザー指示）: Version `d2ab28d0`、公開 URL で 285 読込・error 0
5. ユーザー評価（2026-09-13 15:51）: 現状のほうきは「間に合わせ。部品を合成しただけで、生きた動きとは言い難い」。いったんこのまま採用。実測: 2 コマは同じ raw の縦積み 2 本を別々に切り出したもので、最良の位置合わせ（dx 0, dy −1）でも不透明セル 1942 のうち 891（46%）が異なり、差は 1〜99 列の全幅に散る（穂先だけの制御された揺れではなく、モデルが 2 本を描き直した差）。加えて柄は同一列 59 列の削除で詰めた。 → backlog IMP-029（改善案 3 つ、予算が要るものはユーザー判断）
7. BUG-006 私服の色分け（ユーザー指示 16:15、commit db580a6）: 派生を色 → 色から画素の位置分類へ（ADR-0041）。白・紺・赤の 3 色で襟・袖口・裾を縫い取り、15 コマ × 私服・金が 15 色、桃の残存 0。ユーザーの問い「色数の制約は表現力より重要か」→ 案 1（私服パレットの設計し直し: 髪の暗い 2 色を畳んで白の陰影を確保）で 15 色のまま解決、案 2（派生は 17 色まで）は不要。golden は涙の川・工房の 600 フレーム目と画廊だけ更新。証跡 `test-results/shots/bug006_*`。デプロイ済み（Version `68717f69`）
6. `docs/plan/01-status.md` を Sprint S 時点の実測で更新（manifest 285・予算 238/280・Vitest 152・Playwright 14）。学びは `docs/retro/2026-09-13-retrospective.md`

8. セッション終了時の振り返り: `docs/retro/2026-09-13-retrospective.md` に午後の学び 5 件を追記し、スキル化は 3 件を基準テスト（superpowers:writing-skills の RED → GREEN）にかけて、失敗が再現した generating-pixel-art-with-gemini（細長い小物の寸法 → `shorten_to`）だけ追記・再検証済み（commit a86cce1）。他 2 件は基準で失敗せず追記なし。CLAUDE.md 作業ルールに 5 行追加（dev server の配信確認、基準内で設計し直す案を先に、ユーザー評価の原文記録、Claude メモリ不使用、docs コミット前の diff 確認）。dev-guide の port を 5175 に

### 前回（9/12〜13 夜）

1. Sprint R 観測性（IMP-027）: 構造化ログ・Worker `/api/log`・tail/集計ツール・ボット統合・テスター報告 v2。ADR-0024〜0026
2. 予算 +30 の素材 3 件: 人魚の縦長化 IMP-026（ADR-0033）、2 周目挿絵 scene7 IMP-018、城の中景 B/C BUG-008
3. デモボットの死因追跡（IMP-015 続き）: 8 面の総死亡 6 → 0、ドレス優先（ADR-0028）、採用基準 死亡 400（ADR-0029）。ゲーム側の不具合 3 件を発見して修正: BUG-020 針の瞬間移動、BUG-021 ケーキの崖落ち（ADR-0030）、BUG-022 鏡像の重なり
4. 鏡像リリカの 22 秒復活 IMP-028 と、各階固定 BUG-022（ADR-0027）
5. HANDOFF の恒常的な内容を `docs/dev-guide.md` と `docs/adr/`（39 件）へ移した（ユーザー指示）

## 3. 次にやること（優先順）

1. **Sprint R のユーザー受入 1 回**（未実施）: 公開 URL で 1 面遊び、DevTools Console を `[LYR` でフィルタ、オプション「テスター報告を コピー」の JSON（`report: 2`）を `docs/plan/logs/testers/` へ。開発側は同時に `node tools/tail_logs.mjs --secs 600` → `node tools/log_stats.mjs docs/plan/logs/tail/*.ndjson` の表を `02-near-term.md` Sprint R に追記（人のセッションでは `PERF.FRAME` が初めて出る）
2. 人手待ち（繰延決定済み）: テスター 5 人の完走率（M5）、IMP-017 死亡多発地点の人の検証、実機ゲームパッド（IMP-024）、実機スマホ（M6）
3. 生成が要るもの（ユーザー判断）: IMP-029 ほうきの生きた動き（穂先だけ動かす 2 コマ指定で 1〜2、乗り姿勢なら別に 1〜2）、人魚 v2 待機コマの尾の皮剥け描写（1）、hurt のつば幅 1.45x・fall_nohat 髪幅 1.39x・走り撃ち通過コマの杖（ビジュアル保留）
4. P2/P3: DEBT-003 旧文字列ドット絵の残存、IMP-013 本来の強制スクロール、IMP-009 マイルド表現（ユーザー判断）、BUG-006 私服の色分け。一覧は `docs/plan/08-backlog.md`

## 4. このセッション固有の注意

- ほうき（props/broom）は柄の同一列を削って 100 幅にしている（specs `shorten_to`）。再生成したら `fits` と `shortened_from` を json で確認
- 素材が読めないと市松（マゼンタ／黒）が同じ寸法で出る。公開版で市松を見たら `window.__log.dump()` の `ASSET.FAIL` の `path` を控える（旧フォールバックは無い）
- golden の画廊ハッシュ更新はアイテム 9 個が生成素材になったことによる（`git show` の 1 行差分）。8 面の 90/600 フレーム目とメニューは 1 ビットも変えていない

- 鏡像の復活音は既存の `dress` 効果音を流用している。専用の音が要れば追加
- 工房・遊園地のデモでドレス取得が 0 なのは、60 秒の進み（2570 / 3748）が箱の位置（x=3808）に届かないため
- 公開サイトで古い画面（人魚の切れ目、ボットが川の手前で止まる）が見えた報告があった。計測では現行版に問題なし。Cloudflare のキャッシュ HIT の可能性があるので、再現したら Shift＋再読み込みと `window.__log.dump()[0].build` の値を控える
