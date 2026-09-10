# マジカル☆リリカと血塗られたおとぎの国 — プロジェクト指針

超魔界村スタイル × 1995 年スクウェア風ドット絵の 2D ACT。Vanilla JS + Canvas + Vite、内部解像度 768×672（世界座標 256×224 の 3 倍）。

## 最初に読むもの
- `docs/art-standard.md` — アート基準（数値・出典）。絵に関する判断はこれに照らす
- `docs/gen-pipeline.md` — 素材生成パイプライン（Gemini → セル抽出 → manifest）
- `HANDOFF.md` — セッション引き継ぎ（現在地・決定・残課題・手順の入口）
- `docs/architecture.md` — コード構成（境界づけられたコンテキストと依存の向き）。ファイルを増やす／移すときはこれに従い `test/architecture.test.js` を通す
- `docs/plan/README.md` — 現在地・直近ゴール・ロードマップ
- `docs/retro/` — 過去の失敗と学び

## 必ず使うスキル（`.claude/skills/`）
- `retro-game-art-direction` — 絵の品質を判断・報告・決定する前に。主観語（いい感じ／統一／確認済み）禁止、数値と出典と証跡で語る
- `generating-pixel-art-with-gemini` — 素材を生成・後処理するとき。縮小禁止、2 フレーム横並び、後処理で帽子・衣装
- `verifying-browser-games-with-bots` — 動作確認と完了報告の前に。`window.__game` をボットで通しプレイし、状態遷移とスクリーンショットを証跡にする

## 作業ルール
- 承認が要る決定（解像度、寸法基準、予算超過、表現の変更）は根拠の計測を先に示す。誤計測が分かったら即撤回して再提案
- 生成リクエストは `tools/gen_ledger.json` で管理（セッション予算はユーザーが指定）。逐次実行
- 完了報告は「テスト結果 / ボット結果 / スクリーンショット / 未達と次の手」の 4 要素
- codex-review は使わない（ユーザー指示）
- コマンド: `npm run dev`（Vite）、`npm test`（Vitest）、`npm run e2e`（Playwright ボット自走）、`npm run build`、素材は `python3 tools/gemini_gen.py <spec>` → `tools/build_sprites.py` → `tools/derive_variants.py`（PIL / numpy / google-genai 入りの Python）
- カタログ `catalog.html` は資料（キャラシート／敵・ボス／アイテム・弾／タイル／背景／ステージ／UI）。素材を変えたら必ず該当章を確認
