# ADR-0020: hurt2 は被弾直後 0.1 秒の白飛びコマ

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: BUG-007、`src/stage/entities/player.js HURT_FLASH_T`、`test/player-frames.test.js`

## 背景

生成した hurt2 コマが未使用だった。

## 決定

被弾から 0.1 秒（`HURT_FLASH_T`）は hurt2、以後 0.25 秒は hurt。衣装に hurt2 が無ければ hurt。

## 結果

golden の画素ハッシュ（90・600 フレーム）は不変。

## 証跡

`test/player-frames.test.js`
