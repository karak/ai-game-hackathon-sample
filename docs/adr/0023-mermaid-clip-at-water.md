# ADR-0023: 人魚は水の絵の位置（waterY + 6）でクリップする

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: BUG-019、`src/stage/entityRender.js drawMermaidDoll`、`src/stage/render.js drawBog`

## 背景

人魚を `waterY` で切っていたが、水の絵は水面タイルの 6 px 下から描くため、切れた縁が水面の 6 px 上に浮いて見えた（ユーザー報告）。

## 決定

クリップを `waterY + 6` にする（`drawBog` の描画開始行と一致）。

## 結果

当たり判定・攻撃範囲は不変。後に縦長スプライトへ差し替え（ADR-0033）。

## 証跡

`test-results/shots/cmp_stage4_26.png`（キャンバス計測: 水 198 行から、人魚 183〜197 行）
