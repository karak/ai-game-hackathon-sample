import { PAL } from '../gfx/palette.js';
import { TILE } from '../physics.js';
import { rand, pick } from '../util.js';

// 血・綿・火花などの粒子。地面に落ちた血は decal として残る。
export class Particles {
  constructor(world) { this.world = world; this.list = []; }

  emit(kind, x, y, n = 8, opts = {}) {
    for (let i = 0; i < n; i++) {
      const p = { x, y, life: 0, kind, size: 1 };
      switch (kind) {
        case 'blood':
          p.vx = rand(-90, 90) * (opts.power ?? 1); p.vy = rand(-160, -20) * (opts.power ?? 1);
          p.color = pick([PAL.K, PAL.K, PAL.L, PAL.M]); p.g = 500; p.max = rand(0.6, 1.4); p.size = Math.random() < 0.3 ? 2 : 1; p.decal = true; break;
        case 'gore': // 内臓・肉片
          p.vx = rand(-70, 70); p.vy = rand(-180, -60); p.color = pick([PAL.Z, PAL.L, PAL.K, PAL.M]); p.g = 500; p.max = rand(1, 2); p.size = pick([2, 2, 3]); p.decal = true; p.bounce = true; break;
        case 'stuffing': // 綿
          p.vx = rand(-50, 50); p.vy = rand(-90, -20); p.color = pick([PAL['1'], PAL['5'], PAL['2']]); p.g = 120; p.max = rand(1, 2); p.size = pick([1, 2, 2]); break;
        case 'poison':
          p.vx = rand(-30, 30); p.vy = rand(-40, 10); p.color = pick([PAL.T, PAL.U, PAL.A]); p.g = 60; p.max = rand(0.5, 1.2); break;
        case 'sparkle':
          p.vx = rand(-40, 40); p.vy = rand(-70, -10); p.color = pick([PAL.D, PAL.Y, PAL['6'], PAL['1'], PAL.B]); p.g = -20; p.max = rand(0.4, 1); p.size = pick([1, 1, 2]); p.twinkle = true; break;
        case 'dust':
          p.vx = rand(-30, 30); p.vy = rand(-30, -5); p.color = pick([PAL.W, PAL.Q]); p.g = 40; p.max = rand(0.3, 0.6); break;
        case 'fire':
          p.vx = rand(-20, 20); p.vy = rand(-60, -20); p.color = pick([PAL.X, PAL.Y, PAL.K]); p.g = -40; p.max = rand(0.3, 0.7); break;
        case 'dark':
          p.vx = rand(-40, 40); p.vy = rand(-40, 40); p.color = pick([PAL['9'], PAL.A, PAL.C]); p.g = 0; p.max = rand(0.4, 0.9); p.size = pick([1, 2]); break;
        case 'dirt':
          p.vx = rand(-40, 40); p.vy = rand(-120, -40); p.color = pick([PAL.G, PAL.F]); p.g = 400; p.max = rand(0.4, 0.8); p.size = pick([1, 2]); break;
      }
      this.list.push(p);
    }
  }

  update(dt) {
    const map = this.world.level.map;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life > p.max) { this.list.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.decal || p.bounce) {
        const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
        if (map.isSolid(tx, ty) || (map.isOneWay(tx, ty) && p.vy > 0 && (p.y % TILE) < 6)) {
          if (p.bounce && p.vy > 60 && Math.random() < 0.6) { p.vy *= -0.4; p.vx *= 0.5; p.y = ty * TILE - 1; }
          else {
            if (p.decal) this.world.decals.splat(p.x, ty * TILE, p.color, p.size + (p.kind === 'gore' ? 2 : 0));
            this.list.splice(i, 1);
          }
        }
      }
    }
  }

  draw(g, cam) {
    for (const p of this.list) {
      if (p.twinkle && Math.floor(p.life * 20) % 2) continue;
      g.fillStyle = p.color;
      g.fillRect(Math.floor(p.x - cam.x), Math.floor(p.y - cam.y), p.size, p.size);
    }
  }
}

// 地面に残る血痕レイヤー（マップ全幅の canvas に描き込む）
export class Decals {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width; this.canvas.height = height;
    this.g = this.canvas.getContext('2d');
  }
  splat(x, groundY, color, size = 1) {
    const g = this.g;
    g.fillStyle = color;
    const w = 2 + Math.floor(Math.random() * size * 3);
    g.fillRect(Math.floor(x - w / 2), groundY - 1, w, 1);
    if (Math.random() < 0.5) g.fillRect(Math.floor(x - w / 4), groundY, Math.max(1, Math.floor(w / 2)), 1);
    if (size >= 2) g.fillRect(Math.floor(x - w / 2) + 1, groundY - 2, Math.max(1, w - 2), 1);
    // 壁への飛び散り
    if (Math.random() < 0.25) g.fillRect(Math.floor(x + (Math.random() - 0.5) * 12), groundY - 2 - Math.floor(Math.random() * 6), 1, 1);
  }
  draw(g, cam, W, H) {
    const sx = Math.max(0, Math.floor(cam.x)), sw = Math.min(W, this.canvas.width - sx);
    if (sw <= 0) return;
    g.drawImage(this.canvas, sx, 0, sw, H, sx - Math.floor(cam.x), 0, sw, H);
  }
}
