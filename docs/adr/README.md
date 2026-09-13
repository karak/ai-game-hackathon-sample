# ADR（Architecture Decision Records）— 決定の記録

このプロジェクトで「後から変えると影響が大きい決定」（寸法基準、依存の向き、配信先、ゲーム規則、ボットの採用基準など）は 1 決定 1 ファイルでここに置く。
HANDOFF.md には書かない（HANDOFF はセッションごとに変わる内容だけ。ユーザー指示 2026-09-13）。

## 形式（`test/adr.test.js` が検査する）

- ファイル名: `NNNN-<slug>.md`（`NNNN` は 4 桁の連番、`slug` は英小文字・数字・ハイフン）。番号は欠番なし・重複なし
- 1 行目: `# ADR-NNNN: <題名>`（番号はファイル名と一致）
- 続けてメタ情報を箇条書きで、この順に:
  - `- 状態: 採用 | 提案 | 廃止 | 置換（→ ADR-MMMM）`
  - `- 決定日: YYYY-MM-DD`（日付が分からなければ `Sprint X 頃` のように書き、記録日で補う）
  - `- 記録日: YYYY-MM-DD`
  - `- 関連: `（backlog の ID、スプリント、ファイル、テスト名。証跡へのポインタ）
- 見出しは次の 4 つをこの順で（`## ` 見出し）: `背景`（何が問題だったか・計測値）、`決定`（何をどうすると決めたか。数値と根拠を含める）、`結果`（影響・トレードオフ・守り方〔テスト／ツール〕）、`証跡`（コミット・テスト・スクリーンショット・計測ログ）
- 採用済みの ADR の「決定」は書き換えない。変えるときは新しい ADR を起こし、旧 ADR の状態を `置換（→ ADR-MMMM）` にする。誤りの訂正・証跡の追記は可（末尾に `追記 YYYY-MM-DD:` で）
- 主観語（いい感じ／統一／確認済み）は使わない。数値・出典・証跡で書く（`retro-game-art-direction` と同じ）
- 新しい ADR を足したら下の一覧にも 1 行足す（`test/adr.test.js` が一覧とファイルの対応を検査する）

## 一覧

| 番号 | 題名 | 状態 | 関連 |
|------|------|------|------|
| [ADR-0001](0001-part-size-spec.md) | スプライトの寸法仕様はパーツ単位の論理 px で書く | 採用 | BUG-012 |
| [ADR-0002](0002-hat-from-source-frame.md) | 帽子は原画のものを使い、実行時に重ね描きしない | 採用 | BUG-009 |
| [ADR-0003](0003-run-shoot-two-frames.md) | 走り撃ちは 2 コマ（run1s / run3s）で表す | 採用 | IMP-016 |
| [ADR-0004](0004-split-frames-by-components.md) | コマの分割は連結成分で切る | 採用 | BUG-013 |
| [ADR-0005](0005-postprocess-defaults.md) | 後処理の既定フラグ | 採用 | `docs/plan/06-asset-pipeline.md` |
| [ADR-0006](0006-second-loop-rules.md) | 2 周目は 1 周クリアで開放し、弾速 1.5 倍・湧き 0.8 倍 | 採用 | `docs/plan/05-systems.md` 5.1 |
| [ADR-0007](0007-continue-rule.md) | コンティニューは面の先頭・スコア 0・ハイスコア非記録 | 採用 | `src/app/game.js continueGame` |
| [ADR-0008](0008-death-log-local.md) | 死亡地点ログは localStorage に蓄積し、難易度は人のデータが出るまで動かさない | 採用 | IMP-007 / IMP-017 |
| [ADR-0009](0009-audio-sequencer.md) | 音は自作シーケンサ（arp / echo / waves / once＋then）とジングル 4 種 | 採用 | `docs/plan/05-systems.md` 5.5 |
| [ADR-0010](0010-performance-budget.md) | 性能の予算: update 0.03 ms・draw 0.16 ms 以下、rAF 20 ms 超 0 回 | 採用 | `docs/plan/05-systems.md` 5.6 |
| [ADR-0011](0011-english-ui-dictionary.md) | 英語 UI は日本語文字列をキーにした辞書と t() | 採用 | IMP-008 |
| [ADR-0012](0012-asset-url-base.md) | 素材の URL はページ URL（document.baseURI）基準で解決する | 採用 | BUG-014 |
| [ADR-0013](0013-cutin-single-sheet.md) | カットインは 2×2 の 1 枚シートで生成して切る | 採用 | Sprint L |
| [ADR-0014](0014-illustration-style-canon.md) | 挿絵級の画風は尊重物（ending/scene1・scene6）に合わせる | 採用 | IMP-022 |
| [ADR-0015](0015-public-repo.md) | 公開リポジトリと不具合報告先 | 採用 | IMP-025 |
| [ADR-0016](0016-tester-report-clipboard.md) | テスター計測は run 記録＋クリップボードの報告 JSON | 採用 | IMP-023 / IMP-024 |
| [ADR-0017](0017-bog-style-per-theme.md) | 沼・足場の見え方は章ごとの分岐（bogStyle）で直す | 採用 | IMP-021 |
| [ADR-0018](0018-bounded-contexts.md) | コード構成は境界づけられたコンテキストで、依存の向きをテストで守る | 採用 | Sprint P |
| [ADR-0019](0019-demo-by-stage-name.md) | デモは面名で照合し、ボットで全面収録する | 採用 | IMP-015 |
| [ADR-0020](0020-hurt2-flash.md) | hurt2 は被弾直後 0.1 秒の白飛びコマ | 採用 | BUG-007 |
| [ADR-0021](0021-logical-box-name.md) | specs.json の box は論理箱で、改名しない | 採用 | DEBT-007 |
| [ADR-0022](0022-max-gap-five-tiles.md) | 地面からの隙間は最大 5 タイル | 採用 | BUG-018 |
| [ADR-0023](0023-mermaid-clip-at-water.md) | 人魚は水の絵の位置（waterY + 6）でクリップする | 採用 | BUG-019 |
| [ADR-0024](0024-log-core-in-shared.md) | 構造化ログの核は shared、ブラウザ依存は platform | 採用 | IMP-027 |
| [ADR-0025](0025-telemetry-prod-only.md) | ログ送信は本番だけ既定 ON、Playwright は route で握る | 採用 | IMP-027 |
| [ADR-0026](0026-log-codes-registry.md) | ログコードは登録制で、未登録も未使用も落とす | 採用 | IMP-027 |
| [ADR-0027](0027-mirror-respawn-and-floor.md) | 鏡像リリカは 22 秒で復活し、自分の階でだけ鏡になる | 採用 | IMP-028 |
| [ADR-0028](0028-demo-bot-prefers-dresses.md) | デモボットはドレスを優先して取る | 採用 | IMP-015 |
| [ADR-0029](0029-demo-selection-score.md) | デモの採用基準は 進み − 400×死亡 − 400×ゲームオーバー | 採用 | IMP-015 |
| [ADR-0030](0030-enemies-stop-at-ledges.md) | 主人公へ寄る敵は足場の縁で止まる（腐ったケーキ） | 採用 | BUG-021 |
| [ADR-0031](0031-demo-bot-faces-before-shooting.md) | デモボットは止まって撃つ前に敵の方を向き、敵弾は実物の物理で先読みする | 採用 | IMP-015 |
| [ADR-0032](0032-no-special-rule-for-balloon-ghost.md) | 風船の亡霊に専用規則は置かない | 採用 | IMP-015 |
| [ADR-0033](0033-mermaid-fixed-hitbox.md) | 人魚は当たり判定を固定し、絵だけ縦長にする | 採用 | IMP-026 |
| [ADR-0034](0034-costume-frames-two-pass.md) | 衣装コマの割り当ては 2 パス（共通 → 衣装別） | 採用 | BUG-016 |
| [ADR-0035](0035-charge-two-stages.md) | 溜めは 2 段階（0.9 秒で溜め魔法、1.8 秒で強化魔法） | 採用 | Sprint K |
| [ADR-0036](0036-asset-size-budget.md) | 素材の軽量化: フォントはサブセット、PNG はパレット化、/assets/* は 1 年 immutable | 採用 | IMP-019 |
| [ADR-0037](0037-deploy-workers-static-assets.md) | 配信先は Cloudflare Workers Static Assets | 採用 | IMP-019 |
| [ADR-0038](0038-release-docs.md) | 配信文書は docs/release/ に置く | 採用 | Sprint J |
| [ADR-0039](0039-generation-sequential-ledger.md) | 素材生成は逐次実行し、台帳に全リクエストを記録する | 採用 | `tools/gen_ledger.json` |
| [ADR-0040](0040-missing-sprite-placeholder.md) | 読めない素材はプレースホルダで見せ、文字列ドット絵へは戻さない | 採用 | DEBT-003 / BUG-023 / BUG-024 |
| [ADR-0041](0041-costume-recolor-by-position.md) | 私服・金衣装の派生は画素の位置分類で行い、私服は白・紺・赤の 3 色を足して 15 色に収める | 採用 | BUG-006 |
