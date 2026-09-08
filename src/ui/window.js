import { inScreen } from './layout.js';

// クロノ・トリガー風の青グラデ窓。引数は論理座標、描画はスクリーン解像度（枠 2px、ベベル 1px）
export function drawWindow(g, x, y, w, h, opts = {}) {
  inScreen(g, S => {
    const X = Math.round(x * S), Y = Math.round(y * S), W = Math.round(w * S), H = Math.round(h * S);
    const grad = g.createLinearGradient(0, Y, 0, Y + H);
    grad.addColorStop(0, opts.top ?? '#2a3a86'); grad.addColorStop(1, opts.bottom ?? '#0c1440');
    g.fillStyle = grad; g.fillRect(X, Y, W, H);
    // 外枠（明）2px → 中間 1px → 内側の暗い線 1px（左上のみ、凹み表現）
    g.fillStyle = '#e8e8f4'; g.fillRect(X, Y, W, 2); g.fillRect(X, Y + H - 2, W, 2); g.fillRect(X, Y, 2, H); g.fillRect(X + W - 2, Y, 2, H);
    g.fillStyle = '#8f8fb0'; g.fillRect(X + 2, Y + 2, W - 4, 1); g.fillRect(X + 2, Y + H - 3, W - 4, 1); g.fillRect(X + 2, Y + 2, 1, H - 4); g.fillRect(X + W - 3, Y + 2, 1, H - 4);
    g.fillStyle = '#1a0f1e'; g.fillRect(X + 3, Y + 3, W - 6, 1); g.fillRect(X + 3, Y + 3, 1, H - 6);
    // 角飾り
    g.fillStyle = '#fdfbf7'; for (const [cx, cy] of [[X, Y], [X + W - 4, Y], [X, Y + H - 4], [X + W - 4, Y + H - 4]]) g.fillRect(cx, cy, 4, 4);
    g.fillStyle = '#2a3a86'; for (const [cx, cy] of [[X + 1, Y + 1], [X + W - 3, Y + 1], [X + 1, Y + H - 3], [X + W - 3, Y + H - 3]]) g.fillRect(cx, cy, 2, 2);
  });
}

