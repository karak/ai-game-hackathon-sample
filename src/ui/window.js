// クロノ・トリガー風の青グラデ窓
export function drawWindow(g, x, y, w, h, opts = {}) {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, opts.top ?? '#2a3a86'); grad.addColorStop(1, opts.bottom ?? '#0c1440');
  g.fillStyle = grad; g.fillRect(x, y, w, h);
  g.fillStyle = '#e8e8f4'; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = '#8f8fb0'; g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + 1, y + 1, 1, h - 2); g.fillRect(x + w - 2, y + 1, 1, h - 2);
  g.fillStyle = '#1a0f1e'; g.fillRect(x + 2, y + 2, w - 4, 1); g.fillRect(x + 2, y + 2, 1, h - 4);
  // 角飾り
  g.fillStyle = '#fdfbf7'; for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) g.fillRect(cx, cy, 2, 2);
}

