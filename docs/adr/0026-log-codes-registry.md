# ADR-0026: ログコードは登録制で、未登録も未使用も落とす

- 状態: 採用
- 決定日: 2026-09-12
- 記録日: 2026-09-13
- 関連: IMP-027、`src/shared/logcodes.js`、`test/logcodes.test.js`

## 背景

集計と検索の鍵を増やし放題にしない。

## 決定

`logcodes.js` に無いコードは `log.emit` が throw。`test/logcodes.test.js` が src/worker/e2e/tools を走査し、未登録と未使用の両方を落とす。追加は `logcodes.js` → `09-observability.md` §2.1 の表 → 呼び出し、の順。

## 結果

表だけ足して使わないとテストが落ちる。

## 証跡

`test/logcodes.test.js`
