# ADR-0012: 素材の URL はページ URL（document.baseURI）基準で解決する

- 状態: 採用
- 決定日: 2026-09-10
- 記録日: 2026-09-13
- 関連: BUG-014、`src/gfx/loader.js`、`vite.config.js copySprites`、`tools/check_dist.mjs`

## 背景

`import.meta.url` 基準だと `vite build` 後は `dist/assets/main-*.js` が基準になり、`../../` がサイトの外を指して全素材が読めなかった。

## 決定

`loader.js` は `document.baseURI` 基準。build は `copySprites` が `assets/sprites` を dist にコピーする。

## 結果

`tools/check_dist.mjs` で dist と公開 URL の読込数を確認する（現在 283）。`import.meta.url` 基準に戻すと dist で全素材が消える。

## 証跡

`docs/plan/08-backlog.md` BUG-014
