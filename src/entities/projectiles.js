import { TILE, aabb } from '../physics.js';
import { PAL } from '../gfx/palette.js';
import { HD_SCALE } from '../gfx/sprite.js';

// スプライトの描画サイズ（世界単位）。生成 PNG は 1/HD_SCALE
const dims = spr => spr.hd ? [spr.r.width / HD_SCALE, spr.r.height / HD_SCALE] : [spr.r.width, spr.r.height];

// 主人公の魔法弾
export const WEAPONS = {
  star:   { name: 'スター',     speed: 210, vy0: 0,    gravity: 0,   max: 3, dmg: 1, life: 1.1, sprite: 'star',   w: 8,  h: 7 },
  knife:  { name: 'ナイフ',     speed: 330, vy0: 0,    gravity: 0,   max: 3, dmg: 1, life: 0.9, sprite: 'knife',  w: 12, h: 3 },
  heart:  { name: 'ハート爆弾', speed: 110, vy0: -170, gravity: 430, max: 2, dmg: 2, life: 2.0, sprite: 'heart',  w: 8,  h: 6 },
  candle: { name: 'キャンドル', speed: 120, vy0: -110, gravity: 430, max: 2, dmg: 1, life: 2.0, sprite: 'candle', w: 5,  h: 9 },
};
export const WEAPON_ORDER = ['star', 'knife', 'heart', 'candle'];

export class PlayerShot {
  constructor(world, type, x, y, dir, charged = false) {
    const W = WEAPONS[type];
    this.world = world; this.type = type; this.def = W; this.dir = dir; this.charged = charged;
    this.w = charged ? 10 : W.w; this.h = charged ? 10 : W.h;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = dir * (charged ? 160 : W.speed); this.vy = charged ? 0 : W.vy0;
    this.dmg = charged ? 3 : W.dmg;
    this.life = charged ? 1.6 : W.life; this.t = 0; this.dead = false;
    this.pierce = charged; this.hitIds = new Set();
  }
  update(dt) {
    this.t += dt;
    this.vy += (this.charged ? 0 : this.def.gravity) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.t > this.life) this.dead = true;
    const map = this.world.level.map;
    const cx = Math.floor((this.x + this.w / 2) / TILE), cy = Math.floor((this.y + this.h / 2) / TILE);
    if (!this.charged && map.isSolid(cx, cy)) {
      this.dead = true;
      if (this.type === 'candle') this.world.fires.push(new Fire(this.world, this.x, cy * TILE - 8));
      else this.world.particles.emit('sparkle', this.x + this.w / 2, this.y + this.h / 2, 4);
    }
    if (this.y > map.pixelHeight + 32) this.dead = true;
  }
  onHit() {
    if (!this.pierce) this.dead = true;
    if (this.type === 'candle') this.world.fires.push(new Fire(this.world, this.x, this.y));
  }
  draw(g, cam, sheet) {
    const spr = this.charged ? sheet.charge : sheet[this.def.sprite];
    const img = this.dir < 0 ? spr.l : spr.r;
    g.save();
    const cx = Math.floor(this.x + this.w / 2 - cam.x), cy = Math.floor(this.y + this.h / 2 - cam.y);
    g.translate(cx, cy);
    if (this.type === 'star' || this.type === 'heart' || this.charged) g.rotate(this.t * (this.charged ? 6 : 14) * this.dir);
    if (this.type === 'candle') g.rotate(this.t * 8 * this.dir);
    const [dw, dh] = dims(spr);
    g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    g.restore();
  }
}

// キャンドル着弾後の炎（地面で燃え続ける）
export class Fire {
  constructor(world, x, y) {
    this.world = world; this.x = x; this.y = y; this.w = 8; this.h = 8;
    this.t = 0; this.life = 1.3; this.dead = false; this.dmg = 1; this.tick = 0; this.hitIds = new Map();
    // 足元に落とす
    const map = world.level.map;
    let ty = Math.floor((y + 8) / TILE);
    for (let i = 0; i < 4 && !map.isSolid(Math.floor((x + 4) / TILE), ty) && !map.isOneWay(Math.floor((x + 4) / TILE), ty); i++) ty++;
    this.y = ty * TILE - 8;
  }
  update(dt) {
    this.t += dt; if (this.t > this.life) this.dead = true;
    if (Math.random() < 0.3) this.world.particles.emit('fire', this.x + 4, this.y + 2, 1);
  }
  draw(g, cam, sheet) {
    const spr = Math.floor(this.t * 12) % 2 ? sheet.fire1 : sheet.fire2;
    const [dw, dh] = dims(spr);
    g.drawImage(spr.r, Math.floor(this.x - cam.x), Math.floor(this.y + this.h - dh - cam.y), dw, dh);
  }
}

// 敵弾
export const SHOT_HIT_RATIO = 0.6; // 敵弾の当たり判定 = 描画寸法 × 0.6（見た目より少し甘く）
export const ENEMY_SHOTS = {
  poison:    { sprite: 'poison',    w: 5, h: 5, gravity: 380, pool: true },
  blood:     { sprite: 'blood',     w: 4, h: 4, gravity: 480, splat: true },
  bone:      { sprite: 'bone',      w: 8, h: 3, gravity: 300, spin: true },
  maggot:    { sprite: 'maggot',    w: 6, h: 2, gravity: 420, bounce: 2 },
  acid:      { sprite: 'acid',      w: 3, h: 4, gravity: 360, pool: true, poolColor: 'acid' },
  bolt:      { sprite: 'blood',     w: 4, h: 4, gravity: 0 },
  darkheart: { sprite: 'darkheart', w: 8, h: 6, gravity: 0, homing: 40 },
  arm:       { sprite: 'arm',       w: 11, h: 5, gravity: 0, boomerang: true, spin: true },
  rain:      { sprite: 'blood',     w: 4, h: 4, gravity: 260, splat: true },
};

export class EnemyShot {
  constructor(world, kind, x, y, vx, vy, opts = {}) {
    const D = ENEMY_SHOTS[kind];
    this.world = world; this.kind = kind; this.def = D;
    this.w = D.w; this.h = D.h;
    // 生成スプライト（hd）があれば当たり判定を実寸 × SHOT_HIT_RATIO に追従させる（BUG-002。旧定数は非 HD 時のフォールバック）
    const spr = world.assets?.shots?.[D.sprite];
    if (spr?.hd) { this.w = Math.max(3, Math.round(spr.w * SHOT_HIT_RATIO)); this.h = Math.max(3, Math.round(spr.h * SHOT_HIT_RATIO)); }
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = vx; this.vy = vy; this.t = 0; this.dead = false;
    this.owner = opts.owner ?? null; this.bounces = D.bounce ?? 0; this.life = opts.life ?? 4;
    this.dmg = 1;
  }
  update(dt) {
    const D = this.def, map = this.world.level.map;
    this.t += dt; if (this.t > this.life) this.dead = true;
    if (D.homing && this.world.player) {
      const p = this.world.player; const dx = (p.x + p.w / 2) - (this.x + this.w / 2), dy = (p.y + p.h / 2) - (this.y + this.h / 2);
      const d = Math.hypot(dx, dy) || 1; this.vx += dx / d * D.homing * dt; this.vy += dy / d * D.homing * dt;
    }
    if (D.boomerang && this.owner) {
      this.vx += (this.owner.x + this.owner.w / 2 - (this.x + this.w / 2)) * 1.6 * dt;
      if (this.t > 0.8 && aabb(this, this.owner)) this.dead = true;
    }
    this.vy += D.gravity * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const cx = Math.floor((this.x + this.w / 2) / TILE), cy = Math.floor((this.y + this.h) / TILE);
    if (map.isSolid(cx, cy) || (map.isOneWay(cx, cy) && this.vy > 0 && ((this.y + this.h) % TILE) < 5)) {
      if (this.bounces > 0 && this.vy > 0) { this.bounces--; this.vy = -Math.abs(this.vy) * 0.5; this.y = cy * TILE - this.h; this.vx *= 0.7; return; }
      if (D.pool) this.world.pools.push(new PoisonPool(this.world, this.x + this.w / 2, cy * TILE, D.poolColor));
      if (D.splat) this.world.decals.splat(this.x + this.w / 2, cy * TILE, PAL.K, 2);
      if (D.boomerang) { this.vy = 0; this.y = cy * TILE - this.h; return; }
      this.dead = true; return;
    }
    if (map.isSolid(Math.floor(this.x / TILE), Math.floor((this.y + this.h / 2) / TILE)) || map.isSolid(Math.floor((this.x + this.w) / TILE), Math.floor((this.y + this.h / 2) / TILE))) {
      if (D.boomerang) { this.vx = -this.vx; return; }
      this.dead = true; return;
    }
    if (this.y > map.pixelHeight + 32 || this.y < -64) this.dead = true;
  }
  draw(g, cam, sheet) {
    const spr = sheet[this.def.sprite];
    const img = this.vx < 0 ? spr.l : spr.r;
    const cx = Math.floor(this.x + this.w / 2 - cam.x), cy = Math.floor(this.y + this.h / 2 - cam.y);
    const [dw, dh] = dims(spr);
    if (this.def.spin) {
      g.save(); g.translate(cx, cy); g.rotate(this.t * 10); g.drawImage(img, -dw / 2, -dh / 2, dw, dh); g.restore();
    } else g.drawImage(img, cx - Math.floor(dw / 2), cy - Math.floor(dh / 2), dw, dh);
  }
}

// 地面に残る毒/酸の水たまり（触れるとダメージ）
export class PoisonPool {
  constructor(world, x, groundY, color = 'poison') {
    this.world = world; this.w = 14; this.h = 4; this.x = x - 7; this.y = groundY - 3;
    this.t = 0; this.life = 3.5; this.dead = false; this.color = color; this.dmg = 1;
    world.particles.emit('poison', x, groundY - 2, 6);
  }
  update(dt) {
    this.t += dt; if (this.t > this.life) this.dead = true;
    if (Math.random() < 0.08) this.world.particles.emit('poison', this.x + Math.random() * this.w, this.y, 1);
  }
  draw(g, cam, sheet) {
    const a = this.t > this.life - 0.8 ? (this.life - this.t) / 0.8 : 1;
    g.globalAlpha = a;
    const x = Math.floor(this.x - cam.x), y = Math.floor(this.y - cam.y);
    const spr = sheet?.pool;
    if (spr?.hd && this.color !== 'acid') {
      // 生成済みの毒溜まりスプライト（世界単位で 1/HD_SCALE）。泡の点滅は上に重ねる
      const [dw, dh] = dims(spr); g.drawImage(spr.r, x + this.w / 2 - dw / 2, y + this.h - dh + 1, dw, dh);
      if (Math.floor(this.t * 6) % 2) { g.fillStyle = PAL['1']; g.fillRect(x + 3 + Math.floor(this.t * 7) % 8, y, 1 / HD_SCALE * 2, 1 / HD_SCALE * 2); }
      g.globalAlpha = 1; return;
    }
    g.fillStyle = this.color === 'acid' ? PAL.U : PAL.T; g.fillRect(x, y + 1, this.w, 2);
    g.fillStyle = this.color === 'acid' ? PAL.I : PAL.A; g.fillRect(x + 2, y, this.w - 4, 1); g.fillRect(x + 1, y + 3, this.w - 2, 1);
    if (Math.floor(this.t * 6) % 2) { g.fillStyle = PAL['1']; g.fillRect(x + 3 + Math.floor(this.t * 7) % 8, y, 1, 1); }
    g.globalAlpha = 1;
  }
}
