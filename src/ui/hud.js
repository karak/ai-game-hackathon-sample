import { LAYOUT } from './layout.js';
import { drawWindow } from './window.js';
import { text, textBox } from './text.js';
import { mini } from './minifont.js';
import { WEAPONS } from '../entities/projectiles.js';
import { blit } from '../gfx/sprite.js';

export function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }

export function drawHud(g, world, game) {
  const W = 256;
  // 武器窓
  drawWindow(g, 2, 2, 22, 22);
  const spr = game.assets.shots[WEAPONS[world.player.weapon].sprite];
  blit(g, spr, false, 13 - spr.w / 2, 13 - spr.h / 2);
  // スコア・タイム
  mini(g, 'SCORE', 28, 4, '#cbaaf5'); mini(g, String(game.score).padStart(7, '0'), 28, 11);
  mini(g, 'TIME', 84, 4, '#cbaaf5'); mini(g, fmtTime(world.time), 84, 11, world.time < 30 ? '#ff6a6a' : '#fdfbf7');
  // 残機（リリカ人形）
  mini(g, 'LIFE', 124, 4, '#cbaaf5');
  const doll = game.assets.items.oneup; const n = Math.min(3, game.lives);
  const dw = doll.hd ? doll.w * 0.75 : 8, dh = doll.hd ? doll.h * 0.75 : 6; // 世界単位（HD は 3/4 = 整数比でない縮小を避けるため 1:1 で描く）
  for (let i = 0; i < n; i++) blit(g, doll, false, 124 + i * (doll.hd ? doll.w + 2 : 10), 26 - (doll.hd ? doll.h : 6) - 1);
  if (game.lives > 3) mini(g, 'x' + game.lives, 124 + n * (doll.hd ? doll.w + 2 : 10), 14);
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
  let ty = LAYOUT.HUD_H + 4;
  for (const t of world.toasts) {
    const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.0 ? (2.4 - t.t) / 0.4 : 1;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    const r = textBox(g, t.msg, { y: ty, pad: 4 });
    ty += r.h + 4;
    g.globalAlpha = 1;
  }
}
