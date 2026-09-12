# ADR-0018: コード構成は境界づけられたコンテキストで、依存の向きをテストで守る

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: Sprint P、`docs/architecture.md` §2、`test/architecture.test.js`、`e2e/golden.spec.js`

## 背景

`world.js` 395 行・`game.js` 422 行に描画・当たり判定・画面描画が混ざり、`input.js`（下位）が `settings.js`（上位）を読んでいた。

## 決定

`src/app`（進行）／`stage`（面のシミュレーション）／`content`／`gfx`／`ui`／`platform`／`shared`。依存の向きは `docs/architecture.md` §2 の許可リスト、`test/architecture.test.js` が import を走査して検査。回帰の護りは `e2e/golden.spec.js`（全 8 面の軌跡と画素ハッシュ、振る舞いを変えたときだけ `GOLDEN_UPDATE=1`）。

## 結果

新しいファイルは表に登録しないとテストが落ちる。振る舞いを変える変更は golden の差分を commit で説明する。

## 証跡

`docs/architecture.md`
