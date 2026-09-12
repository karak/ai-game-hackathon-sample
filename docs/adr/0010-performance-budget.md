# ADR-0010: 性能の予算: update 0.03 ms・draw 0.16 ms 以下、rAF 20 ms 超 0 回

- 状態: 採用
- 決定日: 2026-09-08
- 記録日: 2026-09-13
- 関連: `docs/plan/05-systems.md` 5.6

## 背景

内部解像度 768×672 で描画量が増えた。

## 決定

update 0.03 ms・draw 0.16 ms 以下、rAF 20 ms 超 0 回を維持する。バッチ化・背景キャッシュは見送り。粒子上限 400。

## 結果

計測は Playwright の headless で行う（ユーザーの見ているタブで測ると状態を壊す。`docs/dev-guide.md` §2 参照）。

## 証跡

`docs/plan/05-systems.md` 5.6 の計測表
