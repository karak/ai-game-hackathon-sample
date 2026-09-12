# ADR-0033: 人魚は当たり判定を固定し、絵だけ縦長にする

- 状態: 採用
- 決定日: 2026-09-12
- 記録日: 2026-09-13
- 関連: IMP-026、`src/stage/entities/enemies.js MERMAID_W/H / MERMAID_HEAD_ABOVE`、`src/stage/entityRender.js drawMermaidDoll`

## 背景

待機コマが胴の途中で切れていた（42×53）。頭〜尾まで描いた縦長版（62×66）に差し替えると、`fitSprite` で寸法を出す既存の仕組みでは当たり判定と跳躍の発生範囲が変わる。

## 決定

当たり判定は v1 由来の 8×15 に固定し、頭頂の位置は `MERMAID_HEAD_ABOVE`（8 セル）で不変。伸びた分は水面下に α0.3 で透かす。この敵には `fitSprite` を使わない。

## 結果

髪幅 40 → 40、色数 15 → 15、水面 `restY = waterY − 7` は同じ。golden は画廊 f0 のみ更新。

## 証跡

`test-results/shots/mermaid_v2_wait.png`・`mermaid_v2_lunge.png`
