import { PAL } from '../gfx/palette.js';
import { TILE } from '../physics.js';
import { rand, pick } from '../util.js';
import { HD_SCALE } from '../gfx/sprite.js';
const S = 1 / HD_SCALE; // 1 スクリーン px の世界単位

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
      const sz = (p.size + 1) * S; // 粒子は 2〜4 スクリーン px
      g.fillRect(Math.round((p.x - cam.x) / S) * S, Math.round((p.y - cam.y) / S) * S, sz, sz);
    }
  }
}

// 地面に残る血痕レイヤー（マップ全幅の canvas に描き込む）
export class Decals {
  // 血痕レイヤーはスクリーン解像度（HD_SCALE 倍）で持ち、描画時に 1/HD_SCALE で貼る
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width * HD_SCALE; this.canvas.height = height * HD_SCALE;
    this.g = this.canvas.getContext('2d');
  }
  splat(x, groundY, color, size = 1) {
    const g = this.g; const K = HD_SCALE; const X = x * K, Y = groundY * K;
    g.fillStyle = color;
    const w = (3 + Math.floor(Math.random() * size * 4)) * 2;      // 6〜30 スクリーン px の楕円状の染み
    g.fillRect(Math.floor(X - w / 2), Y - 2, w, 2);
    g.fillRect(Math.floor(X - w / 3), Y - 4, Math.floor(w * 2 / 3), 2);
    if (size >= 2) g.fillRect(Math.floor(X - w / 5), Y - 6, Math.floor(w * 2 / 5), 2);
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(X + (Math.random() - 0.5) * w * 1.6), Y - 2 - Math.floor(Math.random() * 3) * 2, 2, 2); // 飛沫
    if (Math.random() < 0.3) g.fillRect(Math.floor(X + (Math.random() - 0.5) * 30), Y - 8 - Math.floor(Math.random() * 16), 2, 2);
  }
  draw(g, cam, W, H) {
    const K = HD_SCALE; const sx = Math.max(0, Math.floor(cam.x * K)), sw = Math.min(W * K, this.canvas.width - sx);
    if (sw <= 0) return;
    g.drawImage(this.canvas, sx, 0, sw, H * K, (sx - Math.floor(cam.x * K)) / K, 0, sw / K, H);
  }
}
