# ADR-0009: 音は自作シーケンサ（arp / echo / waves / once＋then）とジングル 4 種

- 状態: 採用
- 決定日: 2026-09-08
- 記録日: 2026-09-13
- 関連: `docs/plan/05-systems.md` 5.5、`src/platform/audio.js`

## 背景

外部素材を使わずに BGM・効果音を用意する。

## 決定

Web Audio で合成。シーケンサに `arp` / `echo` / `waves` / `once`＋`then`。ジングル 4（開始・クリア・死亡・ゲームオーバー）、最終ボス曲 `bossFinal`（`stage.bossSong`）。

## 結果

`test/audio-songs.test.js` が曲データの整合を検査する。

## 証跡

`test/audio-songs.test.js`
