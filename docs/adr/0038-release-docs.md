# ADR-0038: 配信文書は docs/release/ に置く

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: Sprint J、`docs/release/`

## 背景

配信の手順・本文・トレーラーの置き場を決める。

## 決定

`docs/release/`: `itch-page.md`（手順・日英本文）、`known-issues.md`（08-backlog の ID）、`trailer.gif`（384×336, 5.2 MB）/ `trailer_256.gif`（256×224, 2.55 MB）。再生成は `node tools/make_trailer.mjs`。

## 結果

既知の不具合は backlog の ID で参照する。

## 証跡

`docs/release/`
