// 生成済み PNG スプライト（src/gfx/manifest.json）を読み込み、{r,l,w,h} 形式に整える。
// manifest に無いものは呼び出し側が文字列スプライトへフォールバックする。→ DEBT-003（2026-09-13）で文字列スプライトは撤去。読めなかった素材は placeholderSprite() を入れる（ADR-0040）
import { flipH, HD_SCALE } from './sprite.js';

export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const LOAD_FAILURES = []; // 読めなかった素材 { path, error }。main.js が GAME.BOOT の前に ASSET.FAIL として記録する（gfx から log を読まないのは依存の向きのため。Sprint R）

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
    } catch (e) { console.warn('[loader]', e.message); LOAD_FAILURES.push({ path: m.src, error: e.message }); out[key] = placeholderSprite(m); } // 欠落でも同じキーに寸法どおりの絵を入れ、描画側は分岐しない（ADR-0040）
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

// 読めなかった素材の代わり（ADR-0040）: manifest の寸法（セル = 画面 px）どおりのマゼンタ／黒の市松。hd として描かれるので位置・当たり判定は本物と同じ。
// 旧文字列ドット絵へのフォールバックは、全素材が読めない不具合（BUG-014）を見えなくしたので置かない。missing: true で catalog やログから判別できる
export const PLACEHOLDER_COLORS = ['#ff00ff', '#000000'];
export function placeholderSprite(m, createCanvas = () => document.createElement('canvas')) {
  const w = Math.max(1, Math.round(m?.w ?? 16)), h = Math.max(1, Math.round(m?.h ?? 16)), cell = 6;
  const c = createCanvas(); c.width = w; c.height = h; const g = c.getContext('2d');
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { g.fillStyle = PLACEHOLDER_COLORS[((x / cell) + (y / cell)) % 2]; g.fillRect(x, y, Math.min(cell, w - x), Math.min(cell, h - y)); }
  return { r: c, l: c, w: w / HD_SCALE, h: h / HD_SCALE, hd: true, missing: true, anchor: m?.anchor };
}
