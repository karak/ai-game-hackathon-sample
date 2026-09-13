# ADR-0040: 読めない素材はプレースホルダで見せ、文字列ドット絵へは戻さない

- 状態: 採用
- 決定日: 2026-09-13
- 記録日: 2026-09-13
- 関連: DEBT-003、BUG-023、BUG-024、`src/gfx/loader.js placeholderSprite`、`src/gfx/assets.js`、`test/loader.test.js` 4 件、`e2e/boot.spec.js`「a sprite that fails to load becomes a same-size placeholder」

## 背景

起動時に manifest の PNG が読めないと、旧文字列ドット絵（`src/gfx/sprites/*`、1 世界単位 = 3 画面 px の粗いドット）で補っていた。計測（2026-09-13、`node` で manifest と文字列定義を突き合わせ）:

- 文字列定義 38 種（敵 15・ボス 3・弾 14・アイテム 6）はすべて manifest に生成素材がある。主人公 28 コマは命名が違い（`idle_stand` 等）実行時に参照されない。装飾 9 種は全 8 面の地形文字列で 1 度も描かれない（`DECO_MAP` の記号と重ならない）
- ところが `assets.pickups`（宝箱から出るアイテムの描画表）は生成素材を合流する**前**に文字列シートから作られ、落ちたドレス・武器・ポーションだけは公開版でも文字列ドット絵で描かれていた（`pickups.dress.hd === false`、16×12 世界単位。生成の `items/dress` は 14×14.7）。BUG-023
- 二段ジャンプのほうき（32×6 の文字列）は `assets.broom` に `w`/`h` が無く、描画座標が NaN になって一度も描かれていなかった。BUG-024
- フォールバックがあると、全素材が読めない不具合（BUG-014）が「粗い絵で動く」ように見えて発見が遅れた

## 決定

1. 文字列ドット絵とその生成器（`src/gfx/sprites/*`、`tools/gen_player.py`、`sprite.js makeSprite / buildSheet`、`palette.js COSTUMES`）を削除する。スプライトの出所は manifest の PNG だけ
2. PNG が読めなかったキーには、loader が manifest の `w`×`h`（セル = 画面 px）どおりのマゼンタ／黒の市松（6 px）を `hd: true, missing: true` で入れる。描画側は分岐しない（位置・当たり判定は本物と同じ）。失敗は従来どおり `LOAD_FAILURES` → `ASSET.FAIL` に記録する
3. `assets.pickups` は生成素材を合流した後に作る（BUG-023 の修正）
4. ほうきは HD 素材を生成するまで `assets.broom = null` とし、描画は `assets.broom` があるときだけ行う（見え方は従来と同じ = 描かれない）。生成するかは予算を使うのでユーザー判断

## 結果

- 欠落は「見えない」ではなく「市松で見える」。テスターの報告 JSON の `ASSET.FAIL` と画面の市松で突き合わせられる
- golden（`test/golden/stages.json`）は 8 面の軌跡・90/600 フレームのハッシュ・タイトル／オプション／ポーズが不変で、画廊（f0 / f12）だけが変わった（アイテム 9 個が生成素材になったため）。途中で全面の 90 フレーム目が変わったのは、ほうきが描かれるようになったからで、決定 4 で従来の見え方に戻した
- 守り: `test/loader.test.js`（寸法・色・欠け無し・`src/gfx/sprites` が無いこと）、`e2e/boot.spec.js`（zombie1.png を握って起動 → 64×101 の市松、`ASSET.FAIL` 1 件、`loaderWarnings` 1、例外 0）
- トレードオフ: ネットワークが不安定な環境では市松が見える。旧フォールバックより目立つが、それが狙い

## 証跡

- `test-results/shots/pickups_before_debt003.png` / `pickups_after_debt003.png`（宝箱から出たドレスとハート。前 = 文字列 16×12、後 = 生成 14×14.7）
- `test-results/shots/golden_stage1_f90_diff.png`（左 = 旧、右 = ほうきが描かれた版。決定 4 で左に戻した）
- `test-results/shots/placeholder_zombie1.png`（zombie1 を欠落させた起動）
- Vitest 152 件、Playwright 14 件、`npm run build && node tools/check_dist.mjs` 283 読込・loaderWarnings 0
