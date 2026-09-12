# ADR-0007: コンティニューは面の先頭・スコア 0・ハイスコア非記録

- 状態: 採用
- 決定日: 2026-09-08
- 記録日: 2026-09-13
- 関連: `src/app/game.js continueGame`、`docs/plan/05-systems.md` 5.1

## 背景

回数無制限のコンティニューをハイスコアと両立させる。

## 決定

コンティニューは面の先頭からスコア 0・残機 2 で再開し、その run のスコアはハイスコアに記録しない（`continued` フラグ）。

## 結果

ハイスコアは通しプレイだけの記録になる。

## 証跡

`e2e/autoplay.spec.js`「pause menu restarts the stage, game over offers continue…」
