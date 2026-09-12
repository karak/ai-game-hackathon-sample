# ADR-0037: 配信先は Cloudflare Workers Static Assets

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: IMP-019、`wrangler.jsonc`、`docs/release/deploy.md`

## 背景

wrangler 4.130 では Cloudflare Pages の新規作成が Workers に転送される。

## 決定

Workers Static Assets（`assets.directory = ./dist`、Worker 名 `magical-lyrica`）。`npm run deploy` = build → `wrangler deploy`。Sprint R で `worker/index.js` を足し `/api/*` だけ Worker が先に受ける（`run_worker_first`）。

## 結果

初回ロードはエッジ未キャッシュで 6.6 秒、HIT 後 0.6 秒。デプロイ後は `tools/check_dist.mjs <公開 URL>` で読込数を確認する。

## 証跡

`docs/release/deploy.md`、`test/worker.test.js`
