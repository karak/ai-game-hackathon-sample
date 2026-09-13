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
