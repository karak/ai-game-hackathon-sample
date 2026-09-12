# ADR-0017: 沼・足場の見え方は章ごとの分岐（bogStyle）で直す

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: IMP-021、`src/gfx/hdworld.js buildSyrupHD`、`src/stage/render.js drawPitWalls`、`tools/hash_tiles.mjs`

## 背景

第二章の毒沼が平らな緑の板に見えた（穴の空気域 flat 0.59・11 色、沼の明度 0.48 vs 地面 0.32）。他の章の見え方は変えたくない。

## 決定

菓子の森だけ `bogStyle: 'syrup'`（糖蜜の水面・深部・穴の奥壁・岸の滴り、`=` は砂糖衣の帯）。他 7 テーマに触れないことは `tools/hash_tiles.mjs` の画素ハッシュで示す。

## 結果

計測: 穴の空気域 flat 0.59 → 0.13、沼の明度 0.48 → 0.35。

## 証跡

`docs/plan/08-backlog.md` IMP-021、`test-results/shots/cmp_stage2_36.png`
