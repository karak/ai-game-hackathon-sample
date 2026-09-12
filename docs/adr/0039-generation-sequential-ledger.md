# ADR-0039: 素材生成は逐次実行し、台帳に全リクエストを記録する

- 状態: 採用
- 決定日: 2026-09-08
- 記録日: 2026-09-13
- 関連: `tools/gen_ledger.json`、`tools/gemini_gen.py BUDGET`、CLAUDE.md

## 背景

並列に生成したとき台帳の計数が競合し、手で 16 件に直した。予算はユーザーが決める。

## 決定

1 件ずつ実行。台帳 `gen_ledger.json` の `requests` / `budget`（現在 280）と `gemini_gen.py` の `BUDGET` を一致させる。予算超過は停止。再試行は 2 回まで、3 回目は仕様（部位のセル数・箱・参照画像）を変える。

## 結果

予算の増減はユーザー指示で行い、HANDOFF に残数を書く。

## 証跡

`tools/gen_ledger.json`
