# ADR-0024: 構造化ログの核は shared、ブラウザ依存は platform

- 状態: 採用
- 決定日: 2026-09-12
- 記録日: 2026-09-13
- 関連: IMP-027、`docs/plan/09-observability.md` §6、`src/shared/log.js`、`src/platform/telemetry.js`

## 背景

計画では `src/platform/log.js` に全部置く予定だったが、stage・gfx → platform の import は依存の向き（ADR-0018）で禁止されている。

## 決定

`src/shared/log.js`（LogEvent・通番・上限・リングバッファ）はどこからでも `log.emit(code, msg, attr)` できる。console／fetch(keepalive)／onerror／sessionStorage は `src/platform/telemetry.js`。`gfx/loader.js` は失敗を `LOAD_FAILURES` に積み、`main.js` が `ASSET.FAIL` にする。

## 結果

`test/architecture.test.js` を変えずに全コンテキストからログを出せる。

## 証跡

`test/log.test.js`、`test/logcodes.test.js`
