# ADR-0006: 2 周目は 1 周クリアで開放し、弾速 1.5 倍・湧き 0.8 倍

- 状態: 採用
- 決定日: 2026-09-08
- 記録日: 2026-09-13
- 関連: `docs/plan/05-systems.md` 5.1、`src/stage/balance.js LOOP2`、`src/app/game.js`

## 背景

「真の結末」ルートを 1 周目の難度を変えずに用意したい。

## 決定

`progress.cleared` で 2 周目を開放。敵弾速 1.5 倍・ゾンビ湧き間隔 0.8 倍（`LOOP2`）。真の結末は 1 場面追加（挿絵は当初 scene5 流用、2026-09-12 に scene7 を生成 IMP-018）。

## 結果

1 周目のバランスは不変。E2E `autoplay.spec.js` が 2 周目の規則を検査する。

## 証跡

`test/balance.test.js`、`e2e/autoplay.spec.js`
