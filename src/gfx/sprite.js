import { PAL } from './palette.js';

const LINE_KEYS = new Set(['0', 'f']);
const isEmpty = (rows, x, y) => y < 0 || y >= rows.length || x < 0 || x >= rows[y].length || rows[y][x] === '.' || rows[y][x] === ' ' || LINE_KEYS.has(rows[y][x]);

function hexToRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mixHex(c, target, t) {
  const a = hexToRgb(c); const b = target === 'w' ? [255, 250, 245] : [20, 10, 30];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

// ピクセル文字列配列 → オフスクリーン canvas。
// remap で特定キーの色を差し替える（衣装のパレットスワップ）。
// shade=true で輪郭に接する内側ピクセルに上面ハイライト・下面シャドウを自動付与し、SNES 風の立体感を出す。
export function makeSprite(rows, remap = null, scale = 1, opts = {}) {
  const shade = opts.shade ?? false; // 基準: 陰影は手置き（docs/art-standard.md §2.2）
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k === '.' || k === ' ') continue;
      let col = (remap && remap[k]) || PAL[k];
      if (!col) throw new Error(`unknown palette key '${k}'`);
      if (shade && !LINE_KEYS.has(k)) {
        const up = isEmpty(rows, x, y - 1), down = isEmpty(rows, x, y + 1), left = isEmpty(rows, x - 1, y), right = isEmpty(rows, x + 1, y);
        if (up) col = mixHex(col, 'w', 0.22); else if (down) col = mixHex(col, 'k', 0.22);
        else if (left) col = mixHex(col, 'w', 0.10); else if (right) col = mixHex(col, 'k', 0.12);
      }
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

// スプライト描画。hd（生成 PNG、1 画面画素 = 0.5 世界単位）は世界座標系(2x スケール)で半分サイズに描く。
export { HD_SCALE } from '../stage/viewport.js'; // 正は stage/viewport.js（SCALE と同じ値）。従来の import 元のために再公開
import { HD_SCALE } from '../stage/viewport.js';
export function blit(g, spr, facingLeft, x, y) {
  const img = facingLeft ? spr.l : spr.r;
  if (spr.hd) {
    // 画面画素に整列させる（世界座標 1/HD_SCALE 単位に丸める）
    const rx = Math.round(x * HD_SCALE) / HD_SCALE, ry = Math.round(y * HD_SCALE) / HD_SCALE;
    g.drawImage(img, rx, ry, img.width / HD_SCALE, img.height / HD_SCALE);
  } else g.drawImage(img, Math.floor(x), Math.floor(y));
}

export function flipH(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1);
  g.drawImage(canvas, 0, 0);
  return c;
}

// {name: rows[]} → {name: {r: canvas, l: canvas}}
export function buildSheet(defs, remap = null) {
  const out = {};
  for (const [name, rows] of Object.entries(defs)) {
    const r = makeSprite(rows, remap);
    out[name] = { r, l: flipH(r), w: r.width, h: r.height };
  }
  return out;
}

// 単色シルエット（被弾フラッシュ用）
export function tint(canvas, color) {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
