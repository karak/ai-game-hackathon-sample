# ADR-0035: 溜めは 2 段階（0.9 秒で溜め魔法、1.8 秒で強化魔法）

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: Sprint K、`docs/plan/05-systems.md` 5.1、`src/stage/entities/magic.js CHARGE_T / SUPER_T`

## 背景

強化魔法を追加するにあたり、新規の生成素材を使わずに演出したい。

## 決定

0.9 秒 `CHARGE_T` で溜め魔法、1.8 秒 `SUPER_T` で強化魔法（`SUPER`）。強化魔法は既存スプライト＋粒子＋画面演出（カットインは別途 Sprint L で生成）。

## 結果

`e2e/magic.spec.js` が各武器の L2 発動を検査する。

## 証跡

`test/magic.test.js`、`e2e/magic.spec.js`
