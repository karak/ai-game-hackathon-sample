# ADR-0016: テスター計測は run 記録＋クリップボードの報告 JSON

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: IMP-023 / IMP-024、`src/app/runlog.js`、`tools/tester_stats.mjs`、`e2e/gamepad.spec.js`

## 背景

M5 出口条件（5 人・完走率 60%・平均 3 時間以内）の材料を、サーバー無しで集めたい。

## 決定

開始 1 回 = 1 run（`runlog.js`）。オプション「テスター報告を コピー」の JSON を `docs/plan/logs/testers/` に置いて `tools/tester_stats.mjs` で集計。パッドはオプション「ゲームパッド」行で実機診断、経路は偽装パッドの E2E。

## 結果

Sprint R で報告 JSON は v2（`sid`＋直近 200 件の構造化ログ）になった（ADR-0024）。

## 証跡

`test/runlog.test.js`、`docs/release/tester-guide.md`
