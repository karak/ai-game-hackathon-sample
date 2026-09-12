# HANDOFF — セッション引き継ぎ（動的な内容だけ）

恒常的な内容はここに書かない: 手順・主要ファイル・注意点・環境は `docs/dev-guide.md`、決定は `docs/adr/`（形式は `docs/adr/README.md`）、未済は `docs/plan/08-backlog.md`、受入証跡は `docs/plan/02-near-term.md`。

## 1. 現在地（2026-09-13 00:30 JST、セッション終了時点）

- HEAD: `origin/main` と一致、作業ツリー clean（`git log -15` で 9/12〜13 の作業を追える）
- 公開: https://magical-lyrica.karak97.workers.dev Version `a1deb407`（`check_dist` 283 読込・bootMs 611・error 0）。HEAD のコードと同一（以後のコミットは docs のみ）
- 検証: Vitest 153 件（`test/adr.test.js` 3 件を含む）、Playwright 13 件通過。デモ 8 面はすべて 0 死・再生一致（第一章・第二章はドレス各 1 着取得）
- 生成予算: 台帳 `tools/gen_ledger.json` **236 / 280**（残 44。予備。生成が要る新規項目はユーザー判断）
- Vite dev server は 127.0.0.1:5173 で起きていた（`nohup`、ログ `/tmp/claude-501/vite5173.log`）。次のセッションで死んでいたら `npx vite --port 5173 --host 127.0.0.1 --strictPort`

## 2. 今回のセッション（9/12〜13）でやったこと

1. Sprint R 観測性（IMP-027）: 構造化ログ・Worker `/api/log`・tail/集計ツール・ボット統合・テスター報告 v2。ADR-0024〜0026
2. 予算 +30 の素材 3 件: 人魚の縦長化 IMP-026（ADR-0033）、2 周目挿絵 scene7 IMP-018、城の中景 B/C BUG-008
3. デモボットの死因追跡（IMP-015 続き）: 8 面の総死亡 6 → 0、ドレス優先（ADR-0028）、採用基準 死亡 400（ADR-0029）。ゲーム側の不具合 3 件を発見して修正: BUG-020 針の瞬間移動、BUG-021 ケーキの崖落ち（ADR-0030）、BUG-022 鏡像の重なり
4. 鏡像リリカの 22 秒復活 IMP-028 と、各階固定 BUG-022（ADR-0027）
5. HANDOFF の恒常的な内容を `docs/dev-guide.md` と `docs/adr/`（39 件）へ移した（ユーザー指示）

## 3. 次にやること（優先順）

1. **Sprint R のユーザー受入 1 回**（未実施）: 公開 URL で 1 面遊び、DevTools Console を `[LYR` でフィルタ、オプション「テスター報告を コピー」の JSON（`report: 2`）を `docs/plan/logs/testers/` へ。開発側は同時に `node tools/tail_logs.mjs --secs 600` → `node tools/log_stats.mjs docs/plan/logs/tail/*.ndjson` の表を `02-near-term.md` Sprint R に追記（人のセッションでは `PERF.FRAME` が初めて出る）
2. 人手待ち（繰延決定済み）: テスター 5 人の完走率（M5）、IMP-017 死亡多発地点の人の検証、実機ゲームパッド（IMP-024）、実機スマホ（M6）
3. 生成が要るもの（ユーザー判断）: 人魚 v2 待機コマの尾の皮剥け描写（1）、hurt のつば幅 1.45x・fall_nohat 髪幅 1.39x・走り撃ち通過コマの杖（ビジュアル保留）
4. P2/P3: DEBT-003 旧文字列ドット絵の残存、IMP-013 本来の強制スクロール、IMP-009 マイルド表現（ユーザー判断）、BUG-006 私服の色分け。一覧は `docs/plan/08-backlog.md`

## 4. このセッション固有の注意

- 鏡像の復活音は既存の `dress` 効果音を流用している。専用の音が要れば追加
- 工房・遊園地のデモでドレス取得が 0 なのは、60 秒の進み（2570 / 3748）が箱の位置（x=3808）に届かないため
- 公開サイトで古い画面（人魚の切れ目、ボットが川の手前で止まる）が見えた報告があった。計測では現行版に問題なし。Cloudflare のキャッシュ HIT の可能性があるので、再現したら Shift＋再読み込みと `window.__log.dump()[0].build` の値を控える
