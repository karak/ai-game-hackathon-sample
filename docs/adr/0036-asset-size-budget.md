# ADR-0036: 素材の軽量化: フォントはサブセット、PNG はパレット化、/assets/* は 1 年 immutable

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: IMP-019、`tools/subset_font.py`、`tools/optimize_pngs.py`、`public/_headers`、`docs/release/deploy.md`

## 背景

初回ロードが長かった（フォント 2.07 MB、PNG 未最適化）。

## 決定

フォントはゲーム用サブセット（文言を足したら作り直す。`test/font-subset.test.js` が漏れを検出）。スプライトはパレット PNG（可逆検査つき）。`/assets/*` は 1 年 immutable なので PNG は `?v=<ビルド ID>` で破棄する。

## 結果

公開 URL の bootMs は 600〜760 ms（`tools/check_dist.mjs`）。

## 証跡

`test/font-subset.test.js`
