---
name: verifying-browser-games-with-bots
description: Use when a browser game (Canvas/JS) needs end-to-end verification without a human player — after renderer, physics, level or asset changes, when the user demands evidence-based completion reports, or when Chrome DevTools MCP / Playwright is available and a "screenshot of the title" would be the only proof otherwise.
---

# Verifying Browser Games with Bots

## Overview

「起動してエラーが無い」はゲームの検証ではない。**ゲームを実際に最後まで進める自動プレイ（ボット）を、公開したゲームオブジェクトを通して走らせ、状態遷移とスクリーンショットを証跡にする。**
ユニットテストは物理・レベルデータ・テキスト折り返しなど純粋ロジックに、ボットは「通しで遊べるか」に使う。

## When to Use

- 描画・物理・レベル・素材差し替えなど、画面に出るものを変えた
- 「動作確認しました」と書く前
- 使わない: 純粋関数の変更（ユニットテストで足りる）

## Setup (once per project)

1. `window.__game = game` を起動時に公開する（デバッグ用途。本番ビルドでは無害）
2. ゲームに以下の操作面を用意する: 状態遷移（`startGame / startStage / setState`）、固定ステップ更新（`game.update(1/60)`）、入力オブジェクト（`input.held` `input.pressed` の Set）、ワールド参照（`game.world.player / enemies / boss`）、状態遷移トレース（`game.trace`）
3. Chrome DevTools MCP の `evaluate_script` は `async () => { ... }` を受け付け、JSON を返せる。これがテストランナーになる

## The Bot Recipe

```js
// evaluate_script に渡す関数の骨格（要点だけ。数値はプロジェクトに合わせる）
async () => {
  const g = window.__game, STEP = 1 / 60, errors = [];
  window.addEventListener('error', e => errors.push(e.message));
  const results = [];
  for (let si = 0; si < STAGES; si++) {
    g.input.held.clear();                       // 前回の held が残ると勝手に走り続ける
    g.startGame(); g.stageIndex = si; g.startStage(); g.setState('play');
    const w = g.world, p = w.player; p.invT = 1e9; p.die = () => {};   // 無敵＋死亡停止（検証用スタブ）
    let frames = 0, lastX = p.x;
    while (g.state === 'play' && frames < 60 * 240) {
      g.input.held.add('right'); if (frames % 20 === 0) g.input.pressed.add('shoot');
      if (frames % 30 === 0) { if (p.x - lastX < 6) g.input.pressed.add('jump'); lastX = p.x; }  // 詰まったら跳ぶ
      if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 7 === 0) g.input.pressed.add('jump');  // 二段ジャンプ
      if (p.y > MAP_BOTTOM) { p.y = 60; p.x += 24; p.vy = 0; }        // 落下救済（レベル穴の検出は別テスト）
      if (w.boss && !w.boss.dying && w.boss.state !== 'enter' && frames % 60 === 0) w.boss.hurt(4, null);
      try { g.update(STEP); g.draw(ctx); } catch (e) { errors.push(`s${si} f${frames}: ${e.message}`); break; }
      g.input.endFrame(); frames++;
      if (frames % 600 === 0) await new Promise(r => setTimeout(r, 0));  // UI を固めない
    }
    results.push({ stage: si, endState: g.state, secs: (frames / 60).toFixed(1) });
  }
  return { results, errors: errors.slice(0, 5) };
}
```

**期待値**: 全ステージ `endState === 'clear'`、`errors` 空。1 ステージ 60 秒相当が数秒で終わる（update を直接回すため）。

## Screenshot of a Specific Moment

1. `evaluate_script` で状態を作る（テレポート、無敵、待機）→ **`g.update = () => {}` で更新を止める**（スクリーンショット取得までの遅延で場面が流れるのを防ぐ）→ `take_screenshot` → 元の update を戻す
2. 無敵中の点滅で主人公が消えることがある: 撮る直前に `p.invT = 0.05` にする
3. ボス戦・アイテム取得・被弾変身・死亡復活・ゲームオーバー・クリア・エンディングを **各 1 枚**。タイトルだけでは証跡にならない

## CI Form: Playwright

同じボットを `e2e/*.spec.js` に置けば CI で回る（`playwright.config.js` の `webServer` で Vite を起動、`page.evaluate` 内で上の骨格をそのまま実行）。`pageerror` と console error を集めて `expect(errors).toEqual([])`。開発中は DevTools MCP で対話的に、仕上げは `npm run e2e` で、と使い分ける。

## Evidence in the Report (all four)

1. ボット結果の表（ステージ、終了状態、所要秒、エラー数）
2. ユニットテストの件数と結果（`npm test`）
3. 場面別スクリーンショット（何を確認したか 1 行ずつ）
4. 見つけた不具合と、テスト用スタブが原因の見かけ上の不具合の区別（例: `held` の残留で勝手に歩いた、`die` スタブで残機が減らない）

## Common Mistakes

| 事象 | 原因と対策 |
|------|-----------|
| 起動直後に画面が勝手に進む／キーが押され続ける | ボットが `input.held.add` したまま終了した。各ランの先頭で `held.clear()`。ユーザーがブラウザに触っている可能性も疑う（`input.lastKey` を記録して確認） |
| 数秒後に `gameover` になっている | 別の eval で無敵を切った／`die` スタブなしで敵の湧きに殺され続けた。ランごとに状態を作り直す |
| スクリーンショットに狙った場面が無い | eval 完了から撮影まで 0.5〜2 秒ある。`update` を止めてから撮る |
| `canvas.width === window.innerWidth * 3` のような無意味な断定 | 内部解像度は設計値と比べる。CSS 幅とは無関係 |
| 「テストは書けないので目視で確認」 | ボットで通しプレイ＋状態遷移トレースは書ける。目視は補助 |
| 何百フレームも `await sleep` で待つ | `g.update(STEP)` を直接ループで回して早送りする |
| スクリーンショットに HUD が無い／毎回同じ絵になる | ブラウザ窓が縮んでキャンバス上端が画面外（`canvas.getBoundingClientRect().top < 0`）。`resize_page` で 1340×900 にしてから撮る。キャンバス画素は `getImageData` で直接検査できる |
