// 生成済み PNG スプライト（src/gfx/manifest.json）を読み込み、{r,l,w,h} 形式に整える。
// manifest に無いものは呼び出し側が文字列スプライトへフォールバックする。
import { flipH, HD_SCALE } from './sprite.js';

export async function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('load failed ' + url)); im.src = url; });
}

function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0); return c;
}

// manifest: { "player/idle": {src,w,h,anchor}, ... } → { "player/idle": {r,l,w,h,anchor} }
export async function loadManifest(manifest, base = '') {
  const out = {};
  await Promise.all(Object.entries(manifest).map(async ([key, m]) => {
    try {
      const img = await loadImage(new URL(base + m.src, import.meta.url).href);
      const r = toCanvas(img);
      out[key] = { r, l: flipH(r), w: r.width / HD_SCALE, h: r.height / HD_SCALE, hd: true, anchor: m.anchor, brim: m.brim_overlap ? m.brim_overlap / HD_SCALE : undefined }; // w,h は世界単位
    } catch (e) { console.warn('[loader]', e.message); }
  }));
  return out;
}

// "group/name" キーをネストに展開: {"enemies/zombie1": s} → {enemies: {zombie1: s}}
export function nest(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) { const [g, n] = k.split('/'); (out[g] ??= {})[n] = v; }
  return out;
}
