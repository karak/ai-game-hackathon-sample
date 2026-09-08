import { PAL } from './gfx/palette.js';
import { WEAPONS } from './entities/projectiles.js';

export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", sans-serif';

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

export function text(g, str, x, y, opts = {}) {
  const size = opts.size ?? 16;
  g.font = `${size}px ${FONT}`; g.textBaseline = 'top'; g.textAlign = opts.align ?? 'left';
  if (opts.shadow !== false) { g.fillStyle = opts.shadowColor ?? '#1a0f1e'; g.fillText(str, x + 1, y + 1); }
  g.fillStyle = opts.color ?? '#fdfbf7';
  g.fillText(str, x, y);
}

// 3x5 ミニビットマップフォント（HUD 用）
const MINI = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', 'x': '000101010101000', ' ': '000000000000000',
  'S': '111100111001111', 'C': '111100100100111', 'O': '111101101101111', 'R': '110101110101101', 'E': '111100110100111',
  'T': '111010010010010', 'I': '111010010010111', 'M': '101111111101101', 'L': '100100100100111', 'V': '101101101101010',
  'A': '010101111101101', 'P': '111101111100100', 'U': '101101101101111', 'H': '101101111101101', 'B': '110101110101110',
  'N': '110101101101101', 'G': '111100101101111', 'D': '110101101101110', 'Y': '101101010010010', 'W': '101101101111101',
  'F': '111100110100100', 'K': '101101110101101', 'Z': '111001010100111', 'J': '001001001101010', 'X': '101101010101101', 'Q': '111101101111001',
};
export function mini(g, str, x, y, color = '#fdfbf7', shadow = true) {
  for (let i = 0; i < str.length; i++) {
    const glyph = MINI[str[i]] ?? MINI[str[i].toUpperCase()] ?? MINI[' '];
    for (let k = 0; k < 15; k++) if (glyph[k] === '1') {
      const px = x + i * 4 + (k % 3), py = y + Math.floor(k / 3);
      if (shadow) { g.fillStyle = '#1a0f1e'; g.fillRect(px + 1, py + 1, 1, 1); }
      g.fillStyle = color; g.fillRect(px, py, 1, 1);
    }
  }
}

export function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

export function drawHud(g, world, game) {
  const W = 256;
  // 武器窓
  drawWindow(g, 2, 2, 22, 22);
  const spr = game.assets.shots[WEAPONS[world.player.weapon].sprite];
  g.drawImage(spr.r, 13 - Math.floor(spr.w / 2), 13 - Math.floor(spr.h / 2));
  // スコア・タイム
  mini(g, 'SCORE', 28, 4, '#cbaaf5'); mini(g, String(game.score).padStart(7, '0'), 28, 11);
  mini(g, 'TIME', 84, 4, '#cbaaf5'); mini(g, fmtTime(world.time), 84, 11, world.time < 30 ? '#ff6a6a' : '#fdfbf7');
  // 残機（リリカ人形）
  mini(g, 'LIFE', 124, 4, '#cbaaf5');
  const doll = game.assets.items.oneup.r; const n = Math.min(5, game.lives);
  for (let i = 0; i < n; i++) g.drawImage(doll, 2, 0, 8, 6, 124 + i * 10, 10, 8, 6);
  if (game.lives > 5) mini(g, 'x' + game.lives, 124, 11);
  // 衣装状態
  const cst = world.player.costume;
  mini(g, cst === 'gold' ? 'FULL BLOOM' : cst === 'dress' ? 'DRESS' : 'BROKEN', 176, 4, cst === 'gold' ? '#ffe860' : cst === 'dress' ? '#ff8fc8' : '#ff6a6a');
  mini(g, 'ST' + (game.stageIndex + 1), 176, 11, '#a5a5b8');
  if (game.audio.muted) mini(g, 'MUTE', 232, 11, '#a5a5b8');
  // ボス HP
  const b = world.boss;
  if (b && !b.dead) {
    drawWindow(g, 48, 200, 160, 14, { top: '#3a1650', bottom: '#150a22' });
    mini(g, 'BOSS', 52, 204, '#ff8fc8');
    g.fillStyle = '#1a0f1e'; g.fillRect(74, 204, 130, 6);
    g.fillStyle = b.hpRatio < 0.3 ? '#d9262b' : '#ff8fc8'; g.fillRect(75, 205, Math.floor(128 * b.hpRatio), 4);
  }
  // トースト
  world.toasts.forEach((t, i) => {
    const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.0 ? (2.4 - t.t) / 0.4 : 1;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    const w = Math.min(248, t.msg.length * 16 + 16);
    drawWindow(g, (W - w) / 2, 30 + i * 24, w, 22);
    text(g, t.msg, W / 2, 33 + i * 24, { align: 'center' });
    g.globalAlpha = 1;
  });
}
