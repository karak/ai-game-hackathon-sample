# ADR-0008: 死亡地点ログは localStorage に蓄積し、難易度は人のデータが出るまで動かさない

- 状態: 採用
- 決定日: 2026-09-09
- 記録日: 2026-09-13
- 関連: IMP-007 / IMP-017、`src/app/deathlog.js`、`tools/gather_deaths.mjs`

## 背景

難易度調整の根拠が無かった。ボットの死亡は足場乗りと弾避けをしないため過大になる。

## 決定

`localStorage lyrica_deaths`（600 件上限）に面・座標・原因を記録。収集は `node tools/gather_deaths.mjs` → `docs/plan/logs/`。難易度は人のテストのデータが出るまで変えない。

## 結果

IMP-017 の多発地点（第三章 x512 棘、涙の川 x1280 沼、工房 x1088 プレス、遊園地 x2688 沼、菓子の森 x2304）は人のデータ待ち。Sprint R の構造化ログ（ADR-0024）が同じ内容を PLAYER.DEATH として送る。

## 証跡

`test/deathlog.test.js`
