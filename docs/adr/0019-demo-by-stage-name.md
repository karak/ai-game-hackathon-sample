# ADR-0019: デモは面名で照合し、ボットで全面収録する

- 状態: 採用
- 決定日: 2026-09-11
- 記録日: 2026-09-13
- 関連: IMP-015、Sprint Q、`src/app/demo.js findDemo`、`tools/record_demos.mjs`、`assets/demo/<面名>.json`

## 背景

デモ入力ログを配列の位置で参照していて、章の並び替えで別の面のログが再生されていた。人手の収録は時間がかかる。

## 決定

`assets/demo/<面名>.json`（8 面）。`startDemo` は `findDemo` で記録時の面名と照合、`loop = 0`。収録は `node tools/record_demos.mjs`（無敵なし・残機 2 のボット。敵・敵弾・落下物・プレスの先読みと放物線シミュレーションで安全な跳び方だけ実行、素朴な変種も含めて面ごとにスコアで採用。再生と同じ条件で録り、ページを読み直して再生軌跡の一致を検査する）。JSON を書くと Vite が再読込するので書き出しは全面の収録後。

## 結果

調整は `--trace <面> --step 6 --from 秒 --to 秒 --simdump 秒`。採用基準は ADR-0029。

## 証跡

`test/demo.test.js`、`e2e/autoplay.spec.js`「demo playback is deterministic」
