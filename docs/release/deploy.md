# 配信（Cloudflare Workers Static Assets）

公開 URL: **https://magical-lyrica.karak97.workers.dev**（初回デプロイ 2026-09-10 00:06 JST、Version `b1d45468`）。カタログは `https://magical-lyrica.karak97.workers.dev/catalog.html`。

## 構成

- 専用 Worker `magical-lyrica`（アカウント karak97）。`wrangler.jsonc` の `assets.directory = ./dist` で `dist/` をそのまま静的配信。Worker コードは無し（静的リクエストは無課金）
- **Pages ではなく Workers を使う理由**: 2026-09 時点で Cloudflare は新規の静的サイトを Workers Static Assets に寄せており、wrangler 4.130 の `wrangler pages project create` は Workers デプロイに転送されてエラーになる（`runPagesToWorkersDeploy: missing worker entrypoint or assets directory`）。移行ガイド: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- 認証は `wrangler login`（OAuth、`~/Library/Preferences/.wrangler/config/default.toml`）。トークンに `workers (write)` が必要

## 手順

```bash
npm run deploy            # = npm run build && wrangler deploy（本番 URL を更新）
npm run deploy:preview    # = npm run build && wrangler versions upload（プレビュー URL だけ発行、本番は変えない）
node tools/check_dist.mjs https://magical-lyrica.karak97.workers.dev   # 公開 URL を Playwright で検証（素材 235 読込・エラー 0・bootMs）
npx wrangler versions list        # 版の一覧 / npx wrangler rollback で戻す
```

## 計測（2026-09-10、Chromium headless、東京）

| 条件 | bootMs（フォント＋素材 235 の事前デコード完了まで） | TTFB | 転送量 |
|------|------|------|------|
| 初回（エッジのキャッシュ無し、449 ファイル） | 6640 ms | 2443 ms | 3.4 MB |
| 2 回目（エッジ HIT） | 627 ms | 100 ms | 3.4 MB |

- M6 の出口条件「初回ロード 3 秒以内」は **エッジが温まった状態では満たし、完全な初回は満たさない**。転送 3.4 MB の内訳はフォント 2.07 MB（DotGothic16 全字形 TTF）、PNG 237 枚 ≈ 1.3 MB
- 短縮の候補（未着手、IMP-019）: フォントのサブセット化（使用文字だけなら数百 KB）、`_headers` で `/assets/*`（ハッシュ付き JS・TTF）を長期キャッシュ、スプライトを 1 枚のアトラスにまとめてリクエスト数を減らす
- 既定のヘッダは `cache-control: public, max-age=0, must-revalidate`（etag 再検証）。`cf-cache-status: HIT`

## itch.io との関係

`itch-page.md` は itch.io にも出す場合の原稿。Cloudflare を一次の公開先とし、itch には同じ zip を上げるか、外部リンクとして URL を載せる。
