---
name: generating-pixel-art-with-gemini
description: Use when producing pixel-art game sprites, tiles or backgrounds with an image-generation model (Gemini 2.5 Flash Image / nano-banana or similar 1024px generators) for a retro-style game, especially when the user forbids downscaling, hand-drawn pixel strings were rejected, or sprite sizes/animation frames must be consistent across many assets.
---

# Generating Pixel Art with Gemini

## Overview

画像生成モデルは「1 ドット = N px」「この枠に収めろ」という指示を守らない。自前の密度（1024px キャンバスで 1 セル ≈ 4〜6 px）で描き、格子は数 px 単位で歪む。
**縮小フィルタで合わせるのではなく、出力のセルを実測して抽出し、ゲーム側の解像度を密度に合わせる。**
付属物（帽子）・衣装・欠損表現はモデルが一貫させないので、後処理（色抽出・色相置換・合成）で作る前提で設計する。

## When to Use

- ドット絵の主人公・敵・ボス・背景・タイルを大量に、統一した密度で作る
- ユーザーが「高解像度→縮小は禁止」「1 ドットのサイズを決めて描かせろ」と言っている
- 手描き（ピクセル文字列）が「ファミコン水準」と却下された
- 使わない: 1〜2 枚のアイコン程度（手動で十分）、写実的な絵

## The Pipeline (do these in order)

1. **密度を実測してから解像度を決める（1 リクエスト）**
   主人公を **2 フレーム横並び**で生成し、`scripts/postprocess.py` でセル数を測る。実測: 2 フレーム構図で 1 体 ≈ 45×100 セル、単体だと ≈ 70×108（キャンバスを埋める）。
   その高さが画面高の 14〜16% になる内部解像度を選ぶ（例: 100 セル → 768×672）。**決める前に必ず 4 倍ズーム画像でセル幅を目視確認する**（周期推定は 2 倍・1/2 に誤爆する）。
2. **仕様表（`specs.json`）を先に書く**: 素材ごとに `box`（論理箱 `[W, H]` セル。prompt の Logical box・後処理の `--logical`・manifest `fits` の QA が共有する上限かつ目標）、`frames`（1〜2、小物は 4）、`anchor`、`out`（出力名）、`ref`（参照 raw）、`palette`（共有パレット）。テンプレートは `scripts/specs.example.json`。
3. **生成**: `python3 scripts/gemini_gen.py <spec>`。プロンプト = `style-contract.txt`（画風・背景 #00FF00・色数）＋ SIZE ブロック（自動）＋ 主題ファイル。台帳 `gen_ledger.json` に全リクエストを記録し予算を守る。**逐次実行**（並列は台帳が競合）。
4. **後処理**: `postprocess.py` — クロマキー → 列/行の色変化投影でセル境界検出 → 中央値ピッチの規則格子を境界へスナップ → 各セルの最頻色を 1 画素 → 落ち影除去 → 15 色量子化 → 連結成分でフレーム分割（期待数に足りなければ占有最小列で割る）。**`resize` は使わない**。
5. **一括構築**: `build_sprites.py` が raw → `assets/sprites/<group>/<name>.png` + `.json`（w,h,colors,fits）→ `manifest.json`。
6. **派生（リクエスト不要）**: `derive_variants.py` — 帽子を色域＋上部 30% で抽出し、帽子なしコマの髪上端に合成。衣装は色相規則（桃〜赤紫、体の下 58% に多い色）で置換。
7. **検査**: manifest を読むテスト（色数 10〜15、`fits`、サイズレンジ、コマ網羅）＋ カタログで 1:1 並置。合格報告は数値とスクリーンショットで行う。

## Quick Reference

| 目的 | やること | やらないこと |
|------|----------|-------------|
| サイズを揃える | 2 フレーム横並びで生成 | 「64×64 で描け」「4×4 グリッドに」（無視される、細部が潰れる） |
| 向き | 全コマ同じ向き（右）で生成し、反転はエンジンで | 左右を別リクエストで描く（配色・形が揺れる） |
| モーションの割り方 | 1 リクエスト = 2 コマ（idle/hat無し、run1-2、run3-4、jump/fall、attack/crouch、hurt/dead） | 1 枚に全モーション |
| 論理画像にする | セル境界検出＋最頻色抽出 | `resize`（LANCZOS/BOX）、固定 16px 刻みのサンプリング |
| 透明化 | 純緑 #00FF00 背景＋クロマキー。「影・床・月・空を描くな」を明記 | 「透過 PNG で出力」（できない） |
| 帽子・小物 | 帽子ありコマから色で抽出して合成 | 差分抽出（体のスケールが変わる）、毎コマ「帽子必須」と書く（脱落する） |
| 衣装差分 | 色相規則で置換（1 リクエストも使わない） | 衣装ごとに再生成（守られない、予算を食う） |
| 欠損表現（首なし等） | 1 回で見切り、別表現へ | 3 回再生成 |
| 背景層 | 両端に余白のある層を 2〜3 種生成して連結 | 1 枚を画面幅に引き伸ばす |
| 予算 | 1 キャラ ≈ 8、1 テーマ（空・遠・中×3・地形・装飾）≈ 8〜10、失敗率 15〜20% を予備に | 単価を測らずに進める |

## Common Mistakes

| 思い込み | 現実 |
|----------|------|
| 「1024 を 64 で割れば 64×64 のスプライトが 16 個取れる」 | モデルは 1 スロットに 200〜250 px ・50 セルの絵を描く。切り出し ≠ 論理サイズ |
| 「規則的な周期推定でセル幅が出る」 | 格子が歪み、約数・倍数に誤爆する。境界投影＋スナップ、そして目視 |
| 「間引きサンプリングは縮小ではない」 | 1 セルおきに拾えば 1/2 縮小と同じ。輪郭線が消える |
| 「テンプレート画像を渡せば格子に従う」 | 従わない。むしろ絵が劣化した |
| 「1 枚に 8 コマ入れれば安い」 | 小さくなり細部が潰れ、コマ間の一貫性も落ちる。2 コマまで |
| 「SNES は 320×240」 | 256×224。数値は出典を添える（実機スプライト実寸表） |

## Scripts

`scripts/` に実運用コピーがある（PIL・numpy・google-genai が必要）。使い方は各ファイル先頭の docstring。API キーは環境変数か `.env` から読み、リポジトリに置かない。
背景やモデルの挙動の詳細は [reference/model-behavior.md](reference/model-behavior.md)。
