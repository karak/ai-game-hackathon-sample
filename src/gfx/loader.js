// 生成済み PNG スプライト（src/gfx/manifest.json）を読み込み、{r,l,w,h} 形式に整える。
// manifest に無いものは呼び出し側が文字列スプライトへフォールバックする。
import { flipH, HD_SCALE } from './sprite.js';

export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

export async function loadImage(url) {
  const im = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('load failed ' + url)); im.src = url; });
  if (im.decode) { try { await im.decode(); } catch {} } // 事前デコード（初回 drawImage のヒッチを避ける。M6）
  return im;
}

function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0); return c;
}

// manifest: { "player/idle": {src,w,h,anchor}, ... } → { "player/idle": {r,l,w,h,anchor} }
// onProgress(done, total) を画像 1 枚ごとに呼ぶ（ロード画面の進捗バー用）
// src はプロジェクトルート相対（assets/sprites/…）。ページ（index.html / catalog.html）の URL を基準に解決する。
// import.meta.url 基準だと `vite build` 後は dist/assets/main-*.js が基準になり、../../ がサイトの外を指して全素材が読めなかった（M7 で発覚）。
// dist には vite.config.js のプラグインが assets/sprites をそのままコピーする
export async function loadManifest(manifest, base = '', onProgress = null) {
  const out = {}; const entries = Object.entries(manifest); let done = 0;
  const root = typeof document !== 'undefined' ? document.baseURI : import.meta.url;
  await Promise.all(entries.map(async ([key, m]) => {
    try {
      const u = new URL(base + m.src, root); u.searchParams.set('v', BUILD_ID); // キャッシュ破棄用の版（vite define）。dev では 'dev'
      const img = await loadImage(u.href);
      const r = toCanvas(img);
      out[key] = { r, l: flipH(r), w: r.width / HD_SCALE, h: r.height / HD_SCALE, hd: true, anchor: m.anchor, brim: m.brim_overlap ? m.brim_overlap / HD_SCALE : undefined }; // w,h は世界単位
    } catch (e) { console.warn('[loader]', e.message); }
    finally { done++; onProgress?.(done, entries.length); }
  }));
  return out;
}

// "group/name" キーをネストに展開: {"enemies/zombie1": s} → {enemies: {zombie1: s}}
export function nest(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) { const [g, n] = k.split('/'); (out[g] ??= {})[n] = v; }
  return out;
}
