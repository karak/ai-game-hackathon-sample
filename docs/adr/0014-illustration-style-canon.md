# ADR-0014: 挿絵級の画風は尊重物（ending/scene1・scene6）に合わせる

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: IMP-022、`docs/art-standard.md` §1.3・§2.6、`tools/style_check.py`、`test/art-standard.test.js` §2.6

## 背景

別リクエストで描くと画風が別人になる。ゲーム内スプライト（チビ）を参照に渡すと絵師がスプライト側に寄る。

## 決定

挿絵級（カットイン・エンディング）は `_illust_style.txt`＋`style_refs`（尊重物 1 枚＋scene1 から切った立ち絵 `assets/gen/ref/lyrica-illust*.png`）を毎回添付する。`style_check.py` で flat / 輪郭 / 色数を尊重物と並べて測り、帯（色数 28〜32、flat ≤ 0.28、dither ≥ 0.07、輪郭 hue 255〜335・val ≤ 0.23）を `test/art-standard.test.js` §2.6 が検査する。ゲーム内スプライトは保留。

## 結果

新しい挿絵級が帯を外れるとテストが落ちる（scene7 は 32 色・flat 0.21・dither 0.13・輪郭 302 / 0.23 で通過）。

## 証跡

`test/art-standard.test.js`、`docs/plan/08-backlog.md` IMP-022
