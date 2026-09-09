# マジカル☆リリカと血塗られたおとぎの国

**Magical Lyrica and the Bloodstained Fairyland** — ブラウザで動く 2D 横スクロールアクション。**遊ぶ: https://magical-lyrica.karak97.workers.dev**
全 8 章、ボス 9 体、2 周目あり。日本語／英語 UI（オプションで切替、初回はブラウザ言語）。
1995 年のスクウェア RPG（聖剣伝説2・ロマサガ3・クロノ・トリガー）風の 16bit ドット絵の世界観に、
超魔界村スタイルのアクション（固定軌道ジャンプ・二段ジャンプ・被弾で装備喪失・武器切替）を載せています。

配信は Cloudflare Workers Static Assets（`docs/release/deploy.md`、`npm run deploy`）。配信用の文章・既知の問題・トレーラーは `docs/release/`（`itch-page.md` / `known-issues.md` / `trailer.gif`）。

主人公は 15 歳の魔法少女リリカ。敵は見た目こそファンシーですが、攻撃手段はえげつない
（血・毒・蛆・臓物・酸の涙）。ジャンルの反転がテーマです。

## 起動

依存パッケージはありません。ES modules を使うため HTTP サーバー経由で開いてください。

```bash
npm install
npm run dev      # Vite: http://127.0.0.1:5173/ （catalog.html でデザインカタログ）
npm test         # Vitest 98 件: 物理・レベル・ギミック・音・設定・i18n・アート基準（manifest）
npm run e2e      # Playwright 8 件: 8 面ボット自走・設定保存・デモ決定論・ポーズ／コンティニュー／2 周目・実キー・ロード時間・英語 UI・スマホ縦
npm run build    # dist/ に静的ビルド（index.html と catalog.html、相対パス）。npm run preview で確認
npm run deploy   # build → wrangler deploy（Cloudflare Worker magical-lyrica、要 wrangler login）
```

Node 20 以上。`npm run e2e` は初回に `npx playwright install chromium` が必要。

## 操作

| キー | 動作 |
|------|------|
| ← → / A D | 移動 |
| ↓ / S | しゃがみ（低い姿勢で撃てる） |
| X / K / Space | ジャンプ。空中でもう一度押すとほうきで二段ジャンプ（方向転換可） |
| Z / J | 魔法弾。フルブルームドレス時は長押しで溜め撃ち（0.9 秒で溜め魔法、1.8 秒で強化魔法。光輪が出たら離す） |
| P / Esc | ポーズ |
| M | ミュート |
| Enter | スタート / 決定 |

ゲームパッド（standard mapping）対応。オプション画面でキー／パッドの割り当て、音量、言語（日本語／English）を変更できます。
スマホではキャンバス下にタッチボタンが表示され、画面幅に合わせて縮小されます（実機での検証は未実施、Playwright の iPhone 13 エミュレーションのみ）。

## ゲームシステム（超魔界村準拠）

- **ジャンプは空中制御なし**。踏み切りの向きと速度で軌道が決まる。二段ジャンプのみ軌道修正可。
- **魔法のドレス**＝鎧。1 発被弾で変身解除（私服）。私服でもう 1 発当たると死亡。
- **宝箱（プレゼント箱）** を撃つとアイテム：ドレス / フルブルームドレス（溜め撃ち解放）/ 武器 / 1UP / ポーション。
- **武器 4 種**：スター（直線）、ナイフ（高速）、ハート爆弾（放物線・威力 2）、キャンドル（着弾後に炎が残る）。
- **溜め撃ち**（フルブルームドレス時）は武器ごとに違う魔法：流星群・影の連射・大爆発・火柱。さらに **1.8 秒まで溜めると強化魔法**：星屑の葬列（流星 14 発＋巨大流星）・鏡像の舞踏会（鏡像 4 体が周回して連射）・心臓の花園（地面の花が連鎖爆発）・蝋の聖歌隊（火柱 5 本が敵弾を焼き落とす）。
- **制限時間**、**チェックポイント**（十字路）、**残機**。残機 0 でゲームオーバー → コンティニュー（面の先頭・スコア 0）。
- **8 章**：花畑の墓地 → 毒沼の菓子の森 → 血染めの砂糖城 → 涙の川 → 綿雪の人形工房 → 骨の遊園地 → 鏡の塔（縦スクロール）→ 星の墓標（ボス 7 体連戦）。各章末にボス、クリアでエンディング 6 場面＋クレジット。
- **ギミック**：動く足場・浮島・崩れる板・はしご・水流・風・ベルトコンベア・プレス機・観覧車。
- **2 周目**：1 周クリアで開放。敵弾 1.5 倍・ゾンビ湧き 0.8 倍、「真の結末」が 1 場面増える。
- タイトル放置 15 秒でデモ再生。死亡地点は `localStorage` に記録され、`catalog.html` の「ステージ構成」に重ねて表示。

## 敵（見た目はかわいい、中身はひどい）

| 敵 | 挙動 |
|----|------|
| ゾンビうさぎ | 地面から湧いて歩いてくる。倒すと血と綿が飛ぶ |
| 毒キノコ妖精 | 浮遊して毒胞子を吐く。着弾点に毒の水たまりが残る |
| 血まみれユニコーン | 首の傷から血を噴きながら突進する |
| 腐ったケーキの精 | 蛆を吐く |
| 天使の骸骨 | 飛行して骨や血を落とす |
| テディベア | 跳ねて迫る。腹の裂け目から綿と血 |
| 目玉砲台 | 開眼中に血の弾を狙い撃ち。閉眼中は無敵 |
| 人魚・傘の亡霊・未完成の人形・縫い針の群れ・風船の亡霊・ピエロ骸骨・ガーゴイル人形・鏡像リリカ | 第四章以降。詳細は `catalog.html` 「敵・ボス」 |
| ボス：泣き人形ドロシー | 酸の涙、腕投げブーメラン |
| ボス：はらわたテディ | 大ジャンプ、蛆の扇、腹からの血の噴射 |
| ボス：砂糖の女王マリー / 涙の大蛇ララバイ / 人形師の機械マザーグース / 大観覧車の主グランギニョル / 鏡の女王ヴァニタス | 第三〜七章 |
| ボス：堕ちた魔法少女ノワール（2 形態） | 最終章。闇のハート弾、テレポート、血の雨、突進 → 白いドレスで光の攻撃 |

## 技術

- Vanilla JS（ES modules）+ Canvas 2D + Vite。内部解像度 **768×672**（世界座標 256×224 を 3 倍描画、SNES と同じ 16×14 タイル画面）
- キャラ・敵・ボス・背景・地形・アイテムは **Gemini 2.5 Flash Image で生成したドット絵**を後処理（クロマキー→セル抽出→15 色量子化）した PNG（`assets/sprites/`、`docs/gen-pipeline.md`）
- アート基準は `docs/art-standard.md`。`catalog.html` はデザイン資料（キャラクターシート / 敵・ボス / アイテム・弾 / タイル・装飾 / 背景レイヤー / ステージ構成 / UI）で、寸法・色数・フレーム時間・当たり判定・スクロール係数を絵と一緒に示す
- 効果音・BGM は Web Audio API でリアルタイム合成（`src/audio.js`）。外部音源なし
- フォント：[DotGothic16](https://github.com/fontworks-fonts/DotGothic16)（SIL Open Font License 1.1、`assets/fonts/`）

### 素材の生成・更新

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # 初回のみ（fonttools / pillow / numpy / google-genai）
cp .env.example .env                              # GEMINI_API_KEY を入れる（.env は git 管理外）
.venv/bin/python tools/gemini_gen.py enemy-zombie # specs.json のキーで 1 件生成（台帳 tools/gen_ledger.json に記録）
.venv/bin/python tools/build_sprites.py           # raw → assets/sprites/*.png + src/gfx/manifest.json（パレット PNG に最適化）
.venv/bin/python tools/derive_variants.py         # 帽子抽出・衣装パレット置換（リクエスト不要）
.venv/bin/python tools/subset_font.py             # 文言を増やしたらフォントのサブセットを作り直す
.venv/bin/python tools/optimize_pngs.py           # スプライト PNG をパレット化（可逆、転送量 -57%）
```

```
src/
  main.js        起動・ループ・拡大表示
  game.js        タイトル/プロローグ/ステージ/クリア/ゲームオーバー/エンディングの状態機械
  world.js       ステージ実行（カメラ・当たり判定・ボス戦・復活）
  physics.js     タイルマップ物理（すり抜け足場含む）
  level.js       マップ記号 → スポーン情報
  levels/        8 ステージのマップデータ（セグメント連結）
  entities/      主人公・敵・ボス・弾・アイテム・ギミック・溜め魔法・パーティクル・血痕
  gfx/           パレット・HD スプライト・タイル/背景合成・manifest 読み込み
  ui/            クロノ・トリガー風ウィンドウ、HUD、テキスト折り返し
  audio.js       チップチューン合成・楽曲データ（シーケンサ）
  i18n.js        表示言語（日本語がキー、英語辞書）。story.js に物語本文の両言語
  settings.js    セーブ（進行・音量・キー・言語・ハイスコア）、deathlog.js 死亡ログ
test/            Vitest、e2e/ Playwright、tools/ 生成・後処理・死亡ログ収集
docs/            art-standard / gen-pipeline / plan（計画・バックログ）/ release（配信用）
```

## ライセンス

コード：MIT（`LICENSE`）。フォント DotGothic16 は OFL 1.1（`assets/fonts/OFL.txt`）。画像素材は Gemini 2.5 Flash Image で生成し本リポジトリのツールで後処理したもの（`LICENSE` 末尾の注記、`docs/release/known-issues.md`）。
