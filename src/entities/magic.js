// 溜め魔法（フルブルーム時に 0.9 秒長押し → 離す）。武器ごとに別の魔法（docs/plan/05-systems.md 5.1）
//  star   → 流星群: 画面上端から 8 発が斜めに降る（各 2 ダメージ、貫通）
//  knife  → 分身: 主人公の前後に 2 体の影が 3 秒間ナイフを連射（0.25 秒毎）
//  heart  → 大爆発: 半径 40 の爆発。範囲内の敵に 3 ダメージ（1 回）
//  candle → 火柱: 前方に 3 本の火柱（高さ 3 タイル、1.5 秒、0.35 秒毎に 1 ダメージ）
import { TILE, aabb } from '../physics.js';
import { PlayerShot, Fire } from './projectiles.js';
import { HD_SCALE } from '../gfx/sprite.js';
import { blit } from '../gfx/sprite.js';

export const MAGIC = {
  star:   { name: '流星群',   count: 8, dmg: 2, spread: 120, interval: 0.12, vy: 260, vx: 90 },
  knife:  { name: '影の連射', clones: 2, duration: 3.0, interval: 0.25, offset: 24 },
  heart:  { name: '大爆発',   radius: 40, dmg: 3, life: 0.5 },
  candle: { name: '火柱',     count: 3, gap: 32, height: 3 * TILE, life: 1.5 },
};

export function castMagic(world, player) {
  const kind = player.weapon; const cx = player.centerX, cy = player.y + player.h / 2, dir = player.facing;
  switch (kind) {
    case 'star': world.effects.push(new MeteorCaster(world, cx, dir)); break;
    case 'knife': for (let i = 0; i < MAGIC.knife.clones; i++) world.effects.push(new ShadowClone(world, player, i === 0 ? -1 : 1)); break;
    case 'heart': world.effects.push(new HeartBurst(world, cx, cy)); break;
    case 'candle': for (let i = 0; i < MAGIC.candle.count; i++) world.fires.push(new FirePillar(world, cx + dir * (24 + i * MAGIC.candle.gap), player.y + player.h)); break;
  }
  return kind;
}

// ---- 流星: 一定間隔で画面上から降らせる（弾は world.shots に入る） ----
export class MeteorCaster {
  constructor(world, cx, dir) { this.world = world; this.cx = cx; this.dir = dir; this.t = 0; this.n = 0; this.dead = false; }
  update(dt) {
    const M = MAGIC.star; this.t += dt;
    while (this.n < M.count && this.t >= this.n * M.interval) {
      const spread = (this.n / (M.count - 1) - 0.5) * M.spread;                 // 前方 -60〜+60 に散らす
      const x = this.cx + this.dir * 40 + spread, y = Math.max(0, this.world.cam.y ?? 0) - 12;
      this.world.shots.push(new Meteor(this.world, x, y, this.dir * M.vx, M.vy, M.dmg)); this.n++;
    }
    if (this.n >= M.count) this.dead = true;
  }
  draw() {}
}
export class Meteor {
  constructor(world, x, y, vx, vy, dmg) { this.world = world; this.w = 8; this.h = 8; this.x = x - 4; this.y = y; this.vx = vx; this.vy = vy; this.dmg = dmg; this.t = 0; this.dead = false; this.pierce = true; this.hitIds = new Set(); this.type = 'meteor'; }
  update(dt) {
    this.t += dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.random() < 0.6) this.world.particles.emit('sparkle', this.x + 4, this.y + 4, 1);
    const map = this.world.level.map, tx = Math.floor((this.x + 4) / TILE), ty = Math.floor((this.y + 8) / TILE);
    if (map.isSolid(tx, ty) || this.y > map.pixelHeight) { this.dead = true; this.world.particles.emit('sparkle', this.x + 4, this.y + 4, 8); this.world.particles.emit('fire', this.x + 4, this.y + 6, 4); }
  }
  onHit() { this.world.particles.emit('sparkle', this.x + 4, this.y + 4, 4); }
  draw(g, cam, sheet) {
    const spr = sheet.meteor ?? sheet.star; const dw = spr.hd ? spr.r.width / HD_SCALE : spr.r.width, dh = spr.hd ? spr.r.height / HD_SCALE : spr.r.height;
    g.save(); g.translate(Math.floor(this.x + 4 - cam.x), Math.floor(this.y + 4 - cam.y)); g.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2); g.drawImage(spr.r, -dw / 2, -dh / 2, dw, dh); g.restore();
  }
}

// ---- 影の分身: 主人公の前後に浮かび、ナイフを連射する ----
export class ShadowClone {
  constructor(world, player, side) { this.world = world; this.player = player; this.side = side; this.t = 0; this.shotT = 0; this.dead = false; }
  get x() { return this.player.centerX + this.side * MAGIC.knife.offset - this.player.w / 2; }
  get y() { return this.player.y - 6 + Math.sin(this.t * 6) * 2; }
  update(dt) {
    const M = MAGIC.knife; this.t += dt; this.shotT += dt;
    if (this.shotT >= M.interval) { this.shotT -= M.interval; const dir = this.player.facing; this.world.shots.push(new PlayerShot(this.world, 'knife', this.x + this.player.w / 2 + dir * 10, this.y + 12, dir, false)); }
    if (this.t >= M.duration) this.dead = true;
  }
  draw(g, cam, A) {
    const p = this.player, sheet = A.player[p.costume] ?? A.player.dress, spr = sheet[p.frame()] ?? sheet.idle; if (!spr) return;
    g.save(); g.globalAlpha = 0.45 + 0.15 * Math.sin(this.t * 10);
    blit(g, spr, p.facing < 0, Math.floor(this.x + p.w / 2 - spr.w / 2 - cam.x), Math.floor(this.y + p.h - spr.h - cam.y));
    g.restore();
  }
}

// ---- 大爆発: 拡がる輪。範囲内の敵に一度だけダメージ ----
export class HeartBurst {
  constructor(world, cx, cy) { this.world = world; this.cx = cx; this.cy = cy; this.t = 0; this.dead = false; this.hit = new Set(); world.shake?.(5); world.particles.emit('sparkle', cx, cy, 30); world.particles.emit('blood', cx, cy, 10); }
  get radius() { return MAGIC.heart.radius * Math.min(1, this.t / (MAGIC.heart.life * 0.6)); }
  update(dt) {
    this.t += dt; const r = this.radius;
    for (const e of this.world.enemies) {
      if (e.dead || e.hp === undefined || this.hit.has(e.id) || e.state === 'enter') continue;
      if (Math.hypot(e.cx - this.cx, e.cy - this.cy) <= r + Math.max(e.w, e.h) / 2) { this.hit.add(e.id); e.hurt(MAGIC.heart.dmg, { x: this.cx, y: this.cy, w: 0, h: 0 }); }
    }
    for (const b of this.world.boxes) if (!b.dead && Math.hypot(b.x + b.w / 2 - this.cx, b.y + b.h / 2 - this.cy) <= r) b.hurt();
    if (this.t >= MAGIC.heart.life) this.dead = true;
  }
  draw(g, cam, A) {
    const r = this.radius, a = 1 - this.t / MAGIC.heart.life; const spr = A.shots.burst;
    if (spr) { const s = (r * 2) / (spr.r.width / HD_SCALE); g.save(); g.globalAlpha = Math.max(0, a); g.translate(this.cx - cam.x, this.cy - cam.y); g.scale(s, s); g.drawImage(spr.r, -spr.r.width / HD_SCALE / 2, -spr.r.height / HD_SCALE / 2, spr.r.width / HD_SCALE, spr.r.height / HD_SCALE); g.restore(); return; }
    g.save(); g.globalAlpha = Math.max(0, a); g.strokeStyle = '#ff8fc8'; g.lineWidth = 3; g.beginPath(); g.arc(this.cx - cam.x, this.cy - cam.y, r, 0, Math.PI * 2); g.stroke(); g.restore();
  }
}

// ---- 火柱: 背の高い炎（fires に入り、既存の炎 vs 敵 判定を使う） ----
export class FirePillar extends Fire {
  constructor(world, x, groundY) {
    super(world, x - 4, groundY - 8);
    const H = MAGIC.candle.height; this.w = 10; this.h = H; this.y = this.y + 8 - H; this.life = MAGIC.candle.life; this.pillar = true;
    world.particles.emit('fire', this.x + 5, this.y + H - 4, 10);
  }
  update(dt) { this.t += dt; if (this.t > this.life) this.dead = true; if (Math.random() < 0.6) this.world.particles.emit('fire', this.x + 2 + Math.random() * 6, this.y + Math.random() * this.h, 1); }
  draw(g, cam, sheet) {
    const spr = sheet.pillar; const bottom = this.y + this.h - cam.y, x = Math.floor(this.x + this.w / 2 - cam.x);
    if (spr) { const dw = spr.r.width / HD_SCALE, dh = spr.r.height / HD_SCALE; const k = Math.min(1, this.t / 0.2); g.save(); g.globalAlpha = this.t > this.life - 0.3 ? (this.life - this.t) / 0.3 : 1; g.drawImage(spr.r, x - dw / 2, bottom - dh * k, dw, dh * k); g.restore(); return; }
    const f = Math.floor(this.t * 12) % 2 ? sheet.fire1 : sheet.fire2; const dw = f.r.width / HD_SCALE, dh = f.r.height / HD_SCALE;
    for (let yy = bottom; yy > this.y - cam.y; yy -= dh * 0.8) g.drawImage(f.r, x - dw / 2, yy - dh, dw, dh);
  }
}
