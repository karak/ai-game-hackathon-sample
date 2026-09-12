# ADR-0025: ログ送信は本番だけ既定 ON、Playwright は route で握る

- 状態: 採用
- 決定日: 2026-09-12
- 記録日: 2026-09-13
- 関連: IMP-027、`src/main.js`、`e2e/telemetry.spec.js`

## 背景

dev サーバーには `/api/log` が無く、404 が console error になって既存 E2E（`keyboard.spec.js`）が落ちた。`navigator.sendBeacon` は Playwright の `page.route` で捕まえられない。

## 決定

送信は `import.meta.env.DEV` でない本番だけ既定 ON。dev で試すときは `?telemetry=1`、本番で止めるときは `?telemetry=0` かオプション「ログそうしん」OFF。送信は `fetch(keepalive: true)` を優先（sendBeacon はフォールバック）。Playwright は `page.route('**/api/log')` で握って本番へ送らない。

## 結果

テスト品質ルール（外部依存は route でモック）に沿う。

## 証跡

`e2e/telemetry.spec.js`（2 件）
