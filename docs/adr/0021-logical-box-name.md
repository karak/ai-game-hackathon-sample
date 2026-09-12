# ADR-0021: specs.json の box は論理箱で、改名しない

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: DEBT-007、`docs/gen-pipeline.md` §1

## 背景

`box` が「最大値か目標か」曖昧だった。

## 決定

`box` = 論理箱 `[W, H]` セル。prompt の Logical box・後処理 `--logical`・manifest `fits` が同じ値を共有する（上限かつ目標）。改名しない。

## 結果

定義は `docs/gen-pipeline.md` §1 の表が正。

## 証跡

`docs/gen-pipeline.md`
