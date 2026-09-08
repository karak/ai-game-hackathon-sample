import { TILE, moveBody } from '../physics.js';
import { EnemyShot } from './projectiles.js';
import { tint, blit } from '../gfx/sprite.js';
import { rand } from '../util.js';
import { SAFE_ZONE_X } from '../balance.js';

let nextId = 1;
const flashCache = new Map();
export function flashImg(img) {
  let f = flashCache.get(img); if (!f) { f = tint(img, '#fdfbf7'); flashCache.set(img, f); } return f;
}

// 敵の基底クラス。見た目はファンシー、死に様はえげつない。
export class Enemy {
  constructor(world, x, y, w, h) {
    this.world = world; this.id = nextId++;
    this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0;
    this.hp = 1; this.score = 100; this.t = Math.random() * 10; this.flashT = 0; this.dead = false;
    this.facing = -1; this.contact = true; this.gravity = true; this.onGround = false; this.spriteOff = [0, 0];
    this.gore = 'blood';
  }
  // 生成 PNG（hd）のサイズに当たり判定を合わせる。足元位置は維持する。
  fitSprite(name, wRatio = 0.6, hRatio = 0.92) {
    const spr = this.world.assets?.enemies?.[name] ?? this.world.assets?.bosses?.[name];
    if (!spr || !spr.hd) return;
    const bottom = this.y + this.h;
    this.w = Math.max(6, Math.round(spr.w * wRatio)); this.h = Math.max(6, Math.round(spr.h * hRatio));
    this.y = bottom - this.h; this.spriteOff = [Math.round((spr.w - this.w) / 2), spr.h - this.h];
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get player() { return this.world.player; }
  facePlayer() { this.facing = this.player.centerX < this.cx ? -1 : 1; }
  distX() { return this.player.centerX - this.cx; }

  hurt(dmg, shot) {
    if (this.dead) return;
    this.hp -= dmg; this.flashT = 0.1;
    this.world.particles.emit('blood', this.cx, this.cy, 5);
    if (this.hp <= 0) this.die(); else this.world.audio.sfx('hit');
  }
  die() {
    this.dead = true; this.world.addScore(this.score);
    const p = this.world.particles;
    if (this.gore === 'blood') { p.emit('blood', this.cx, this.cy, 22, { power: 1.2 }); p.emit('gore', this.cx, this.cy, 6); this.world.audio.sfx('splat'); }
    else if (this.gore === 'stuffing') { p.emit('stuffing', this.cx, this.cy, 14); p.emit('blood', this.cx, this.cy, 10); p.emit('gore', this.cx, this.cy, 3); this.world.audio.sfx('squish'); }
    else if (this.gore === 'poison') { p.emit('poison', this.cx, this.cy, 18); p.emit('blood', this.cx, this.cy, 8); this.world.audio.sfx('squish'); }
    else if (this.gore === 'bone') { p.emit('stuffing', this.cx, this.cy, 6); p.emit('gore', this.cx, this.cy, 5); p.emit('blood', this.cx, this.cy, 12); this.world.audio.sfx('splat'); }
  }
  shoot(kind, vx, vy, ox = 0, oy = 0, opts = {}) {
    if (this.world.safeT > 0) return; // 復活直後は敵弾なし（balance.js SAFE_SHOT_T）
    this.world.enemyShots.push(new EnemyShot(this.world, kind, this.cx + ox, this.cy + oy, vx, vy, { owner: this, ...opts }));
  }
  physics(dt) {
    if (this.gravity) { this.vy += 520 * dt; if (this.vy > 300) this.vy = 300; }
    const res = moveBody(this, this.world.level.map, dt);
    if (this.y > this.world.level.map.pixelHeight + 16) this.dead = true;
    return res;
  }
  update(dt) { this.t += dt; this.flashT = Math.max(0, this.flashT - dt); }
  spriteName() { return null; }
  draw(g, cam, assets) {
    const name = this.spriteName(); if (!name) return;
    const spr = assets.enemies[name] ?? assets.bosses[name]; if (!spr) return;
    const ox = this.facing < 0 ? (spr.w - this.w - this.spriteOff[0]) : this.spriteOff[0];
    const fs = this.flashT > 0 ? { ...spr, r: flashImg(spr.r), l: flashImg(spr.l) } : spr;
    blit(g, fs, this.facing < 0, this.x - ox - cam.x, this.y - this.spriteOff[1] - cam.y);
  }
}

// ---- ゾンビうさぎ: 地面から湧いて歩いてくる ----
export class ZombieRabbit extends Enemy {
  constructor(world, x, groundY) {
    super(world, x, groundY - 22, 12, 22); this.spriteOff = [4, 2];
    this.hp = 1; this.score = 100; this.rise = 0.7; this.life = 9; this.contact = false;
    this.gore = 'stuffing'; this.fitSprite('zombie1');
    world.particles.emit('dirt', this.cx, groundY, 8);
  }
  update(dt) {
    super.update(dt);
    if (this.rise > 0) { this.rise -= dt; if (this.rise <= 0) this.contact = true; this.facePlayer(); return; }
    this.life -= dt;
    if (this.life < 0) { this.dead = true; this.world.particles.emit('dirt', this.cx, this.y + this.h, 6); return; }
    if (this.onGround) { this.vx = this.facing * 26; }
    const res = this.physics(dt);
    if (res.hitLeft || res.hitRight) this.facing = -this.facing;
    if (Math.random() < 0.02) this.world.decals.splat(this.cx, this.y + this.h, '#d9262b', 1);
  }
  spriteName() { return this.rise > 0 ? 'zombieRise' : (Math.floor(this.t * 5) % 2 ? 'zombie1' : 'zombie2'); }
  draw(g, cam, assets) {
    if (this.rise > 0) {
      // 地面から迫り上がる（下をクリップ）
      const groundY = this.y + this.h; const up = Math.min(this.h + 2, (0.7 - this.rise) / 0.7 * (this.h + 2));
      g.save(); g.beginPath(); g.rect(0, 0, 9999, Math.floor(groundY - cam.y)); g.clip();
      const spr = assets.enemies.zombie1;
      blit(g, spr, this.facing < 0, this.x - this.spriteOff[0] - cam.x, groundY - up - cam.y); g.restore(); return;
    }
    super.draw(g, cam, assets);
  }
}

// ゾンビの湧きポイント（プレイヤー接近で周囲に湧く）
export class ZombieSpawner {
  constructor(world, x) { this.world = world; this.x = x; this.timer = 0.5; this.dead = false; this.contact = false; }
  draw() {}
  update(dt) {
    const p = this.world.player; if (!p.alive || this.world.boss) return;
    if (Math.abs(p.centerX - this.x) > 150) return;
    this.timer -= dt; if (this.timer > 0) return;
    this.timer = rand(1.5, 2.6);
    const alive = this.world.enemies.filter(e => e instanceof ZombieRabbit && !e.dead).length;
    if (alive >= 4) return;
    const map = this.world.level.map;
    const side = Math.random() < 0.6 ? p.facing : -p.facing;
    const sx = p.centerX + side * rand(50, 100);
    // 復活地点（開始地点・中間地点）の ±SAFE_ZONE_X には湧かない
    const safe = [this.world.level.playerStart, ...this.world.level.checkpoints];
    if (safe.some(c => c && Math.abs(sx - (c.x + TILE / 2)) < SAFE_ZONE_X)) return;
    const tx = Math.floor(sx / TILE);
    // 足元の地面を探す
    for (let ty = Math.floor(p.y / TILE); ty < map.height; ty++) {
      if (map.isSolid(tx, ty) && !map.isSolid(tx, ty - 1)) { this.world.enemies.push(new ZombieRabbit(this.world, tx * TILE + 3, ty * TILE)); return; }
    }
  }
}

// ---- 毒キノコ妖精: 浮遊して毒胞子を吐く ----
export class MushroomFairy extends Enemy {
  constructor(world, x, y) {
    super(world, x, y, 14, 18); this.spriteOff = [3, 2]; this.baseY = y - 22; this.y = this.baseY;
    this.hp = 2; this.score = 200; this.gravity = false; this.shootT = rand(1, 2); this.gore = 'poison'; this.fitSprite('mushroom1', 0.6, 0.9); this.baseY = this.y;
  }
  update(dt) {
    super.update(dt);
    this.facePlayer();
    this.y = this.baseY + Math.sin(this.t * 2.5) * 6;
    const d = this.distX();
    if (Math.abs(d) < 170) {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.shootT = 2.4;
        for (let i = -1; i <= 1; i++) this.shoot('poison', Math.sign(d) * (55 + i * 18) + i * 8, -140 - i * 20, 0, 4);
        this.world.audio.sfx('poison');
      }
    }
    if (Math.random() < 0.05) this.world.particles.emit('poison', this.cx, this.y + this.h, 1);
  }
  spriteName() { return Math.floor(this.t * 6) % 2 ? 'mushroom1' : 'mushroom2'; }
}

// ---- 首なしユニコーン: 突進し血を撒く ----
export class Unicorn extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 4, 26, 18); this.spriteOff = [3, 4];
    this.hp = 3; this.score = 300; this.state = 'wait'; this.facing = -1; this.fitSprite('unicorn1', 0.7, 0.85);
  }
  update(dt) {
    super.update(dt);
    const d = this.distX();
    if (this.state === 'wait') {
      this.facePlayer(); this.vx = 0;
      if (Math.abs(d) < 130 && Math.abs(this.player.y - this.y) < 40) { this.state = 'charge'; this.world.audio.sfx('hurt'); }
    } else {
      this.vx = this.facing * 115;
      if (Math.random() < 0.12) this.shoot('blood', this.facing * -30 + rand(-20, 20), rand(-120, -60), this.facing * -2, -6, { life: 1.2 });
      if (Math.random() < 0.3) this.world.particles.emit('blood', this.x + (this.facing > 0 ? 4 : this.w - 4), this.y + 2, 2);
    }
    const res = this.physics(dt);
    if (res.hitLeft || res.hitRight) { this.facing = -this.facing; this.state = 'charge'; }
    if (this.state === 'charge' && Math.abs(d) > 260) this.state = 'wait';
  }
  spriteName() { return this.state === 'charge' && Math.floor(this.t * 10) % 2 ? 'unicorn2' : 'unicorn1'; }
}

// ---- 腐ったケーキの精: 蛆を吐く ----
export class RottenCake extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 4, 16, 18); this.spriteOff = [2, 2];
    this.hp = 2; this.score = 200; this.spitT = rand(1, 2); this.gore = 'blood'; this.fitSprite('cake1', 0.7, 0.9);
  }
  update(dt) {
    super.update(dt);
    this.facePlayer();
    const d = this.distX();
    if (this.onGround) this.vx = Math.abs(d) > 30 && Math.abs(d) < 200 ? this.facing * 18 : 0;
    if (Math.abs(d) < 150) {
      this.spitT -= dt;
      if (this.spitT <= 0) { this.spitT = 2.6; for (let i = 0; i < 3; i++) this.shoot('maggot', this.facing * (40 + i * 25), -90 - i * 15, this.facing * 4, -2); this.world.audio.sfx('squish'); }
    }
    this.physics(dt);
  }
  spriteName() { return this.spitT < 0.4 ? 'cake2' : 'cake1'; }
}

// ---- 天使の骸骨: 飛行して骨と臓物を落とす ----
export class AngelSkeleton extends Enemy {
  constructor(world, x, y) {
    super(world, x, y, 16, 18); this.spriteOff = [4, 2]; this.gravity = false;
    this.hp = 1; this.score = 150; this.dropT = rand(0.5, 1.5); this.gore = 'bone'; this.fitSprite('angel1', 0.5, 0.9); this.baseY = Math.max(30, y);
  }
  update(dt) {
    super.update(dt);
    const d = this.distX();
    if (Math.abs(d) < 200) {
      this.facing = Math.sign(d) || 1;
      this.x += Math.sign(d) * 42 * dt;
    }
    this.y = this.baseY + Math.sin(this.t * 3) * 8;
    this.dropT -= dt;
    if (this.dropT <= 0 && Math.abs(d) < 24) { this.dropT = 1.8; this.shoot(Math.random() < 0.5 ? 'bone' : 'blood', rand(-10, 10), 20, 0, 6); }
  }
  spriteName() { return Math.floor(this.t * 8) % 2 ? 'angel1' : 'angel2'; }
}

// ---- テディベア: 跳ねて迫る、腹から綿と血 ----
export class TeddyBear extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 4, 16, 18); this.spriteOff = [2, 4];
    this.hp = 2; this.score = 200; this.hopT = rand(0.3, 1); this.gore = 'stuffing'; this.fitSprite('bear1', 0.7, 0.92);
  }
  update(dt) {
    super.update(dt);
    const d = this.distX();
    if (this.onGround) {
      this.vx = 0; this.hopT -= dt;
      if (this.hopT <= 0 && Math.abs(d) < 180) {
        this.facePlayer(); this.hopT = rand(0.5, 1.1); this.vy = -190; this.vx = this.facing * 55;
        this.world.particles.emit('stuffing', this.cx, this.y + 8, 2);
      }
    }
    const res = this.physics(dt);
    if (res.hitBottom && this.vx !== 0) { this.world.particles.emit('blood', this.cx, this.y + this.h, 3); this.vx = 0; }
  }
  spriteName() { return this.onGround ? 'bear1' : 'bear2'; }
}

// ---- 目玉砲台: 開眼中に血の弾を撃つ ----
export class EyeTurret extends Enemy {
  constructor(world, x, y) {
    super(world, x, y + 1, 18, 14); this.spriteOff = [1, 1]; this.gravity = false;
    this.hp = 3; this.score = 250; this.fireT = rand(0.5, 1.5); this.open = true; this.blinkT = rand(2, 4); this.gore = 'blood'; this.fitSprite('eye1', 0.8, 0.9);
  }
  update(dt) {
    super.update(dt);
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.open = !this.open; this.blinkT = this.open ? rand(2.5, 4) : 0.5; }
    if (!this.open) return;
    const p = this.player; const dx = p.centerX - this.cx, dy = (p.y + p.h / 2) - this.cy; const dist = Math.hypot(dx, dy) || 1;
    this.facing = Math.sign(dx) || 1;
    if (dist < 170) {
      this.fireT -= dt;
      if (this.fireT <= 0) { this.fireT = 1.7; const sp = 95; this.shoot('bolt', dx / dist * sp, dy / dist * sp); this.world.audio.sfx('hit'); }
    }
  }
  hurt(dmg, shot) { if (!this.open) { this.world.audio.sfx('tick'); return; } super.hurt(dmg, shot); }
  spriteName() { return this.open ? 'eye1' : 'eye2'; }
}

export function createEnemy(world, spawn) {
  const { type, x, y } = spawn;
  switch (type) {
    case 'zombie': return new ZombieSpawner(world, x + 8);
    case 'mushroom': return new MushroomFairy(world, x + 2, y);
    case 'unicorn': return new Unicorn(world, x, y + 2);
    case 'cake': return new RottenCake(world, x + 2, y + 2);
    case 'angel': return new AngelSkeleton(world, x + 2, y);
    case 'bear': return new TeddyBear(world, x + 2, y + 2);
    case 'eye': return new EyeTurret(world, x + 1, y);
  }
  return null;
}
