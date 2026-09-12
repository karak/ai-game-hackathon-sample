# ADR-0015: 公開リポジトリと不具合報告先

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: IMP-025

## 背景

配信と不具合報告の窓口が要る。

## 決定

https://github.com/karak/ai-game-hackathon-sample（public、`origin/main`）。不具合は Issues https://github.com/karak/ai-game-hackathon-sample/issues/new/choose。`.env` は gitignore、鍵が含まれないことを push 前に走査する。

## 結果

push 前の鍵走査が手順になる。

## 証跡

`.gitignore`、`.env.example`
