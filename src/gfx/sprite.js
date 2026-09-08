import { PAL } from './palette.js';

// ピクセル文字列配列 → オフスクリーン canvas。
// remap で特定キーの色を差し替える（衣装のパレットスワップ）。
export function makeSprite(rows, remap = null, scale = 1) {
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
      const col = (remap && remap[k]) || PAL[k];
      if (!col) throw new Error(`unknown palette key '${k}'`);
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
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
