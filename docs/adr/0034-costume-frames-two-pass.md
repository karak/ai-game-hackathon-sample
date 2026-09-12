# ADR-0034: 衣装コマの割り当ては 2 パス（共通 → 衣装別）

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: BUG-016、`src/gfx/assets.js assignPlayerFrames`、`test/costume-frames.test.js`

## 背景

1 パスだと manifest の読み込み完了順で共通コマが衣装別コマを上書きした。

## 決定

共通コマを先に代入し、衣装別コマを後で代入する。

## 結果

`test/costume-frames.test.js` が順序を固定する。

## 証跡

`test/costume-frames.test.js`
