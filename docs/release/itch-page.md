# itch.io ページ原稿（v1.0）

公開手順とページ本文の正。実際の公開（アカウント・アップロード）は人手。**未公開**（2026-09-09 時点）。

## 公開手順

1. `npm run build` → `dist/`（`index.html` / `catalog.html` / `assets/` / `src/gfx/manifest.json` の相対パス）
2. `cd dist && zip -r ../lyrica-v1.0.zip .`（`index.html` が zip のルート）
3. itch.io: Create new project → Kind of project **HTML** → Upload `lyrica-v1.0.zip` → **This file will be played in the browser** にチェック
4. Embed options: **Viewport dimensions 900 × 760**（内部解像度 768×672 ＋ 説明文）、Fullscreen button ON、Mobile friendly ON（タッチパッドは 600px 未満で表示）、Orientation Landscape
5. Frame options: Enable scrollbars OFF、Automatically start on page load OFF（初回入力で AudioContext を起こす設計のため、ユーザー操作から始める）
6. Metadata: Genre Platformer、Tags `pixel-art` `2d` `action` `retro` `ghouls-n-ghosts` `magical-girl` `dark-fantasy` `japanese` `english`、Made with Vite / Gemini、Average session A few minutes、Inputs Keyboard / Gamepad / Touchscreen、Languages Japanese / English、Accessibility: Configurable controls
7. スクリーンショット: `test-results/shots/`（英語タイトル `en_title.png`、オプション `en_options.png`、章題 `en_intro.png`、スマホ `mobile_title.png`）と `docs/plan/logs/`（各章の実機撮影）。トレーラーは `docs/release/trailer.gif`
8. Content warning: 血・臓物の表現あり（ドット絵）。年齢制限の欄は「Not rated」だが説明文に明記する
9. 公開後: URL を `README.md` と `docs/plan/03-roadmap.md` M7 に書く。バグ報告先は GitHub Issues（`docs/release/known-issues.md`）

## タイトル

マジカル☆リリカと血塗られたおとぎの国 / Magical Lyrica and the Bloodstained Fairyland

## 短い説明（Short description、140 字）

かわいい顔の敵が血を吐く。超魔界村スタイルの 2D アクション、全 8 章＋2 周目。1995 年スクウェア風ドット絵。日本語／English。
Cute enemies, awful attacks. A Ghouls 'n Ghosts-style 2D action game in 8 chapters (+2nd loop), 1995 Square-style pixel art. JP/EN.

## 本文（日本語）

見習い魔女リリカ、15 歳。今日の仕事は、おとぎの国の後始末。

むかしむかし、ひとりの魔法少女が世界を呪った。花は腐り、うさぎは血を吐き、砂糖の城は赤く染まった。可愛い顔をした敵たちの攻撃手段は、血・毒・蛆・臓物・酸の涙。ジャンルの反転がテーマの、超魔界村スタイルの横スクロールアクションです。

- **ジャンプは空中制御なし**。踏み切りの向きと速さで軌道が決まります。空中でもう一度押すと、ほうきで二段ジャンプ（ここだけ方向転換可）
- **魔法のドレス＝鎧**。1 発で変身が解けて私服、もう 1 発で死亡
- **武器 4 種**（スター／ナイフ／ハート爆弾／キャンドル）と、フルブルームドレス時の**溜め魔法**（流星群／影の連射／大爆発／火柱）
- **全 8 章**: 花畑の墓地、毒沼の菓子の森、血染めの砂糖城、涙の川、綿雪の人形工房、骨の遊園地、鏡の塔（縦スクロール）、星の墓標（ボス 7 体連戦）
- **ボス 9 体**、エンディング 6 場面、**2 周目**で「真の結末」
- 動く足場・崩れる板・はしご・水流・風・ベルトコンベア・プレス機・観覧車
- コンティニュー無制限、キー／パッド割り当て、音量、日本語／英語切替、スマホのタッチ操作

**操作**: ←→ 移動、↓ しゃがみ、Z/J 魔法、X/K/Space ジャンプ、P/Esc ポーズ、M ミュート、Enter 決定。ゲームパッド対応。

**表現について**: 血・臓物の描写があります（16bit 風ドット絵）。

**制作**: Vanilla JS + Canvas。ドット絵は Gemini 2.5 Flash Image で生成し、自作ツールで後処理（クロマキー・セル抽出・15 色量子化・帽子合成）。音楽・効果音は Web Audio でリアルタイム合成。フォントは DotGothic16（OFL）。ソースコードは MIT。

## Body (English)

Lyrica, apprentice witch, age 15. Today's job: clean up the fairyland.

Once upon a time a magical girl cursed the world. Flowers rotted, rabbits spat blood, the sugar castle turned red. The enemies still look adorable; what they do to you is not (blood, poison, maggots, guts, acid tears). A side-scrolling action game in the Ghouls 'n Ghosts mold, built around that inversion.

- **No air control.** Your jump's arc is fixed by direction and speed at takeoff. Press again in the air for a broom double jump (the only time you can turn).
- **The magic dress is your armor.** One hit breaks it, a second hit kills you.
- **4 weapons** (star / knife / heart bomb / candle) plus **charge magic** in the Full Bloom dress (meteor shower / shadow volley / big bang / fire pillars).
- **8 chapters**: Graveyard of Flowers, Candy Forest of Poison Bogs, Bloodstained Sugar Castle, River of Tears, Snow-Cotton Doll Workshop, Amusement Park of Bones, Tower of Mirrors (vertical), Grave of Stars (7-boss rush).
- **9 bosses**, a 6-scene ending, and a **2nd loop** with the true end.
- Moving and crumbling platforms, ladders, currents, wind, conveyor belts, presses, a ferris wheel.
- Unlimited continues, rebindable keys and gamepad buttons, volume, Japanese/English, touch controls on phones.

**Controls**: ←→ move, ↓ crouch, Z/J magic, X/K/Space jump, P/Esc pause, M mute, Enter confirm. Gamepad supported.

**Content**: pixel-art blood and gore.

**Made with** vanilla JS + Canvas. Pixel art generated with Gemini 2.5 Flash Image and post-processed by our own tools (chroma key, cell extraction, 15-color quantization, hat compositing). Music and SFX synthesized in real time with Web Audio. Font: DotGothic16 (OFL). Source code: MIT.

## 既知の問題（ページ末尾に貼る）

`known-issues.md` の「プレイに影響するもの」を貼る。要点: 人のテストによる難易度調整は未、実機パッド・実機スマホ未確認、ステージセレクトなし、デモは 4 章まで。
