# ADR-0005: 後処理の既定フラグ

- 状態: 採用
- 決定日: 2026-09-09
- 記録日: 2026-09-13
- 関連: `docs/plan/06-asset-pipeline.md`、`assets/gen/specs.json`

## 背景

灰緑の石面がクロマキーで抜ける、血溜まりの滴 3 画素が接地面になる、`keep_bottom` が木の上を水平に切る、一枚絵に額縁が描かれる、といった出力事故が続いた。

## 決定

装飾は `fill_holes`＋`trim_thin_bottom`、主人公は `strip_caption`、一枚絵は `trim_border`、背景層では `keep_bottom` を使わない（月・空が混ざった層は再生成する）。

## 結果

出力チェックの観点が specs のフラグとして残り、再生成の回数が減る。

## 証跡

`.claude/skills/generating-pixel-art-with-gemini/reference/model-behavior.md`「出力チェックの観点」
