# ADR-0001: スプライトの寸法仕様はパーツ単位の論理 px で書く

- 状態: 採用
- 決定日: 2026-09-09
- 記録日: 2026-09-13
- 関連: BUG-012、`assets/gen/specs.json part_sizes`、`tools/gemini_gen.py part_block`、`tools/build_sprites.py measure_parts`

## 背景

別リクエストで描いたコマは idle 比 ±12% を超える大きさのずれが出ていた（jump 94 / fall 107 / attack 117 / hurt 118 vs idle 111）。「同じ大きさで」という指示は守られない。

## 決定

高さ比ではなく部位ごとの論理 px を仕様にする: 帽子 35 高／つば 57 幅、頭 40 高／髪幅 40、胴 20、スカート 24、脚 18、計 111（私服 103）。`specs.json part_sizes` に置き、`gemini_gen.py` が PART SIZES ブロックとして prompt に付与、`build_sprites.py` が出力コマの同じ部位を測って ±15% 超を WARN する。

## 結果

コマの大きさの検査が数値になる。ユーザー指示「パーツ単位で論理何ピクセルを占めるかを与える」（2026-09-09）に基づく。

## 証跡

`docs/plan/08-backlog.md` BUG-012、`docs/gen-pipeline.md`
