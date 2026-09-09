import { TILE, moveBody } from '../physics.js';
import { EnemyShot } from './projectiles.js';
import { tint, blit } from '../gfx/sprite.js';
import { rand, grand } from '../util.js';
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
    this.hp = 1; this.score = 100; this.t = grand() * 10; this.flashT = 0; this.dead = false;
    this.facing = -1; this.contact = true; this.gravity = true; this.onGround = false; this.spriteOff = [0, 0];
    this.gore = 'blood';
  }
  // 生成 PNG（hd）のサイズに当たり判定を合わせる。足元位置は維持する。
  fitSprite(name, wRatio = 0.6, hRatio = 0.92) {
    const spr = this.world.assets?.enemies?.[name] ?? this.world.assets?.bosses?.[name];
    if (!spr || !spr.hd) return;
    this.baseSprite = name; // 差分コマ（doll2 等）が無いときの描画フォールバック
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
    this.dead = true; this.world.addScore(this.score); this.world.onEnemyKilled?.(); this.world.fx?.killFlash();
    const p = this.world.particles;
    if (this.gore === 'blood') { p.emit('blood', this.cx, this.cy, 22, { power: 1.2 }); p.emit('gore', this.cx, this.cy, 6); this.world.audio.sfx('splat'); }
    else if (this.gore === 'stuffing') { p.emit('stuffing', this.cx, this.cy, 14); p.emit('blood', this.cx, this.cy, 10); p.emit('gore', this.cx, this.cy, 3); this.world.audio.sfx('squish'); }
    else if (this.gore === 'poison') { p.emit('poison', this.cx, this.cy, 18); p.emit('blood', this.cx, this.cy, 8); this.world.audio.sfx('squish'); }
    else if (this.gore === 'bone') { p.emit('stuffing', this.cx, this.cy, 6); p.emit('gore', this.cx, this.cy, 5); p.emit('blood', this.cx, this.cy, 12); this.world.audio.sfx('splat'); }
  }
  shoot(kind, vx, vy, ox = 0, oy = 0, opts = {}) {
    if (this.world.safeT > 0) return; // 復活直後は敵弾なし（balance.js SAFE_SHOT_T）
    const k = this.world.hard?.shotSpeed ?? 1; // 2 周目は弾速 1.5 倍
    this.world.enemyShots.push(new EnemyShot(this.world, kind, this.cx + ox, this.cy + oy, vx * k, vy * k, { owner: this, ...opts }));
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
    const spr = assets.enemies[name] ?? assets.bosses[name] ?? (this.baseSprite && (assets.enemies[this.baseSprite] ?? assets.bosses[this.baseSprite])); if (!spr) return;
    // HD スプライトは寸法がコマごとに違いうる（doll1/doll2 等）ので、底辺中央を当たり判定の底辺中央に合わせる
    const ox = spr.hd ? (spr.w - this.w) / 2 : this.facing < 0 ? (spr.w - this.w - this.spriteOff[0]) : this.spriteOff[0];
    const oy = spr.hd ? spr.h - this.h : this.spriteOff[1];
    const fs = this.flashT > 0 ? { ...spr, r: flashImg(spr.r), l: flashImg(spr.l) } : spr;
    blit(g, fs, this.facing < 0, this.x - ox - cam.x, this.y - oy - cam.y);
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
    if (grand() < 0.02) this.world.decals.splat(this.cx, this.y + this.h, '#d9262b', 1);
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
    this.timer = rand(1.5, 2.6) * (this.world.hard?.spawnGap ?? 1); // 2 周目は湧き間隔 0.8 倍
    const alive = this.world.enemies.filter(e => e instanceof ZombieRabbit && !e.dead).length;
    if (alive >= 4) return;
    const map = this.world.level.map;
    const side = grand() < 0.6 ? p.facing : -p.facing;
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
    if (grand() < 0.05) this.world.particles.emit('poison', this.cx, this.y + this.h, 1);
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
      if (grand() < 0.12) this.shoot('blood', this.facing * -30 + rand(-20, 20), rand(-120, -60), this.facing * -2, -6, { life: 1.2 });
      if (grand() < 0.3) this.world.particles.emit('blood', this.x + (this.facing > 0 ? 4 : this.w - 4), this.y + 2, 2);
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
    if (this.dropT <= 0 && Math.abs(d) < 24) { this.dropT = 1.8; this.shoot(grand() < 0.5 ? 'bone' : 'blood', rand(-10, 10), 20, 0, 6); }
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

// ---- 人魚人形 (第三章): 水面下で待ち、主人公が近づくと跳ね上がって噛みつく ----
export class MermaidDoll extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 6, 14, 20); this.spriteOff = [3, 2];
    this.hp = 3; this.score = 300; this.gravity = false; this.gore = 'bone'; this.fitSprite('mermaid1', 0.6, 0.85);
    // マーカーの真下で最初に見つかる '~' の上端を水面にする
    const map = world.level.map, tx = Math.floor((x + 7) / TILE); let ty = Math.floor(y / TILE);
    while (ty < map.height && map.at(tx, ty) !== '~') ty++;
    this.waterY = ty < map.height ? ty * TILE : y + TILE; this.restY = this.waterY - Math.round(this.h * 0.45); this.y = this.restY; // 胸まで水面上
    this.state = 'wait'; this.waitT = rand(0.4, 1.2); this.lunge = 0;
  }
  update(dt) {
    super.update(dt); this.facePlayer();
    const d = this.distX(), p = this.player;
    switch (this.state) {
      case 'wait':
        this.y = this.restY + Math.sin(this.t * 2) * 2; this.contact = false;
        this.waitT -= dt;
        if (this.waitT <= 0 && Math.abs(d) < 56 && p.y + p.h <= this.waterY + 4) { this.state = 'lunge'; this.lunge = 0; this.vy = -150; this.contact = true; this.world.audio.sfx('squish'); this.world.particles.emit('poison', this.cx, this.waterY, 6); }
        break;
      case 'lunge': // 放物線で跳ね上がり、噛みついて戻る
        this.lunge += dt; this.vy += 380 * dt; this.y += this.vy * dt; this.x += this.facing * 30 * dt;
        if (this.y >= this.restY) { this.y = this.restY; this.state = 'wait'; this.waitT = rand(1.2, 2.0); this.contact = false; this.world.particles.emit('poison', this.cx, this.waterY, 5); }
        break;
    }
  }
  hurt(dmg, shot) { if (this.state === 'wait' && shot && shot.y + shot.h > this.waterY) return; super.hurt(dmg, shot); } // 水面下は撃てない
  spriteName() { return this.state === 'lunge' ? 'mermaid2' : 'mermaid1'; }
  draw(g, cam, assets) {
    // 水面より下は描かない（潜っている表現）
    g.save(); g.beginPath(); g.rect(0, 0, 9999, Math.floor(this.waterY - cam.y)); g.clip();
    super.draw(g, cam, assets); g.restore();
  }
}

// ---- 傘の妖精 (第三章): 主人公の上空を漂い、血の雨滴を落とす ----
export class UmbrellaFairy extends Enemy {
  constructor(world, x, y) {
    super(world, x, y, 14, 18); this.spriteOff = [3, 2]; this.baseY = y - 40; this.y = this.baseY;
    this.hp = 2; this.score = 250; this.gravity = false; this.contact = true; this.gore = 'blood'; this.fitSprite('umbrella1', 0.55, 0.85); this.baseY = this.y;
    this.homeX = x; this.dropT = rand(1, 2); this.dir = -1;
  }
  update(dt) {
    super.update(dt);
    const d = this.distX();
    // 主人公の上へゆっくり寄る（±90 の範囲で追従）、上下にふらふら
    const targetX = Math.max(this.homeX - 90, Math.min(this.homeX + 90, this.player.centerX));
    this.x += Math.sign(targetX - this.cx) * Math.min(Math.abs(targetX - this.cx), 28 * dt);
    this.y = this.baseY + Math.sin(this.t * 1.8) * 5; this.facing = d < 0 ? -1 : 1;
    if (Math.abs(d) < 24) { this.dropT -= dt; if (this.dropT <= 0) { this.dropT = 1.6; for (let i = -1; i <= 1; i++) this.shoot('rain', i * 18, 30, i * 6, 8); this.world.audio.sfx('poison'); } }
    else this.dropT = Math.max(this.dropT, 0.3);
  }
  spriteName() { return Math.floor(this.t * 4) % 2 ? 'umbrella1' : 'umbrella2'; }
}

// ---- 未完成の人形 (第四章): 近づくと腕を外して投げる（ブーメラン弾 'arm'） ----
export class UnfinishedDoll extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 26, 14, 26); this.spriteOff = [3, 2];
    this.hp = 3; this.score = 300; this.gore = 'stuffing'; this.fitSprite('dollpart1', 0.55, 0.92);
    this.throwT = rand(0.8, 1.6); this.anim = 0; this.walkDir = -1;
  }
  update(dt) {
    super.update(dt); this.anim = Math.max(0, this.anim - dt);
    const d = this.distX();
    if (Math.abs(d) < 150) { this.facePlayer(); this.vx = this.onGround && this.anim <= 0 ? this.facing * 12 : 0; }
    else { this.vx = this.onGround ? this.walkDir * 10 : 0; this.facing = this.walkDir; }
    const res = this.physics(dt); if (res.hitLeft || res.hitRight) this.walkDir = -this.walkDir;
    if (Math.abs(d) < 130) {
      this.throwT -= dt;
      if (this.throwT <= 0) { this.throwT = 2.6; this.anim = 0.4; this.shoot('arm', this.facing * 110, -30, this.facing * 8, -8, { life: 2.4 }); this.world.audio.sfx('hurt'); this.world.particles.emit('stuffing', this.cx, this.y + 6, 4); }
    }
  }
  spriteName() { return this.anim > 0 ? 'dollpart2' : 'dollpart1'; }
}

// ---- 縫い針の群れ (第四章): 主人公の周りを漂い、槍の形に固まって突進する ----
export class NeedleSwarm extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 30, 16, 14); this.spriteOff = [2, 2]; this.gravity = false; this.hp = 2; this.score = 250; this.gore = 'blood';
    this.fitSprite('needles1', 0.6, 0.6); this.homeY = this.y; this.state = 'drift'; this.stateT = 0; this.vx = 0; this.vy = 0;
  }
  update(dt) {
    super.update(dt); this.stateT += dt; const p = this.player;
    switch (this.state) {
      case 'drift': { // 主人公の斜め上へ寄る
        const tx = p.centerX - this.facing * 60, ty = p.y - 40;
        this.facing = p.centerX < this.cx ? -1 : 1;
        this.x += Math.sign(tx - this.cx) * Math.min(Math.abs(tx - this.cx), 34 * dt); this.y += Math.sign(ty - this.cy) * Math.min(Math.abs(ty - this.cy), 30 * dt) + Math.sin(this.t * 4) * 0.4;
        if (this.stateT > 1.6 && Math.abs(this.distX()) < 110) { this.state = 'aim'; this.stateT = 0; }
        break;
      }
      case 'aim': // 0.4 秒固まってから突進
        if (this.stateT > 0.4) { const dx = p.centerX - this.cx, dy = p.y + p.h / 2 - this.cy, d = Math.hypot(dx, dy) || 1; this.vx = dx / d * 190; this.vy = dy / d * 190; this.state = 'dash'; this.stateT = 0; this.world.audio.sfx('hit'); }
        break;
      case 'dash':
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.stateT > 0.55 || this.world.level.map.isSolid(Math.floor(this.cx / TILE), Math.floor(this.cy / TILE))) { this.state = 'drift'; this.stateT = 0; this.vx = this.vy = 0; if (this.y > this.homeY + 40) this.y = this.homeY + 40; }
        break;
    }
    if (this.y < 8) this.y = 8;
  }
  spriteName() { return this.state === 'drift' ? 'needles1' : 'needles2'; }
}

// ---- 風船の亡霊 (第五章): ゆっくり主人公へ漂い、近づくか撃たれると膨らんで破裂、血の雨を降らせる ----
export class BalloonGhost extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 40, 14, 16); this.spriteOff = [2, 2]; this.gravity = false; this.hp = 1; this.score = 150; this.gore = 'blood';
    this.fitSprite('balloon1', 0.7, 0.8); this.swell = 0; this.contact = true;
  }
  update(dt) {
    super.update(dt); const p = this.player;
    if (this.swell > 0) { this.swell += dt; this.contact = false; if (this.swell > 0.5) this.burst(); return; }
    const dx = p.centerX - this.cx, dy = p.y + 8 - this.cy, d = Math.hypot(dx, dy) || 1;
    this.facing = dx < 0 ? -1 : 1;
    this.x += dx / d * 18 * dt; this.y += dy / d * 12 * dt + Math.sin(this.t * 2) * 0.3;
    if (d < 28) { this.swell = 0.01; this.world.audio.sfx('squish'); }
  }
  hurt(dmg, shot) { if (this.swell > 0) return; this.swell = 0.01; this.flashT = 0.1; this.world.audio.sfx('squish'); }
  burst() { // 血の雨 5 滴を扇状に落とす
    for (let i = -2; i <= 2; i++) this.shoot('rain', i * 26, 40 + Math.abs(i) * 10, 0, 4, { life: 2.5 });
    this.world.particles.emit('blood', this.cx, this.cy, 18, { power: 1.4 }); this.world.addScore(this.score); this.world.onEnemyKilled?.(); this.world.audio.sfx('splat'); this.dead = true; this.world.fx?.killFlash();
  }
  spriteName() { return this.swell > 0 ? 'balloon2' : 'balloon1'; }
}

// ---- ピエロ骸骨 (第五章): 立ち止まってナイフを投げる。距離を取ろうとする ----
export class ClownSkeleton extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 30, 14, 30); this.spriteOff = [3, 2]; this.hp = 3; this.score = 350; this.gore = 'bone';
    this.fitSprite('clown1', 0.5, 0.92); this.throwT = rand(0.6, 1.4); this.anim = 0;
  }
  update(dt) {
    super.update(dt); this.anim = Math.max(0, this.anim - dt); const d = this.distX();
    this.facePlayer();
    // 60 より近いと後退、160 より遠いと寄る
    this.vx = !this.onGround ? this.vx : Math.abs(d) < 60 ? -this.facing * 22 : Math.abs(d) > 160 ? this.facing * 16 : 0;
    const res = this.physics(dt); if (res.hitLeft || res.hitRight) this.vx = 0;
    if (Math.abs(d) < 200) {
      this.throwT -= dt;
      if (this.throwT <= 0) { this.throwT = 1.8; this.anim = 0.35; const sp = 150; const ang = Math.atan2((this.player.y + 10) - (this.cy - 6), d); for (let i = -1; i <= 1; i += 2) this.shoot('cknife', Math.cos(ang) * sp, Math.sin(ang) * sp - 20 + i * 25, this.facing * 8, -6, { life: 2 }); this.world.audio.sfx('shoot'); }
    }
  }
  spriteName() { return this.anim > 0 ? 'clown2' : 'clown1'; }
}

// ---- 鏡像リリカ (第六章): 鏡の軸 x=axis を挟んで、主人公の 1 秒前の位置・コマを左右反転して再生する。触れると被弾。撃てる（HP 4） ----
export class MirrorLyrica extends Enemy {
  constructor(world, axisX, y) {
    super(world, axisX, y, 12, 28); this.axis = axisX; this.hp = 4; this.score = 500; this.gravity = false; this.gore = 'blood'; this.contact = true;
    this.hist = []; this.delay = 60; this.frame = 'idle'; this.mirrorFacing = 1;
  }
  update(dt) {
    super.update(dt); const p = this.player;
    this.hist.push({ x: p.centerX, y: p.y, h: p.h, frame: p.frame(), facing: p.facing, costume: p.costume });
    if (this.hist.length > this.delay) this.hist.shift();
    const s = this.hist[0];
    // 鏡像: x は軸で反転、y はそのまま。主人公が軸から 200 以上離れると軸の位置で待つ
    const mx = 2 * this.axis - s.x; const far = Math.abs(p.centerX - this.axis) > 200;
    this.x = (far ? this.axis : mx) - this.w / 2; this.y = s.y + (s.h - this.h); this.h = 28; this.frame = far ? 'idle' : s.frame; this.mirrorFacing = -s.facing;
    this.contact = !far;
  }
  spriteName() { return null; }
  draw(g, cam, assets) {
    const sheet = assets.player[this.hist[0]?.costume ?? 'dress'] ?? assets.player.dress; const spr = sheet[this.frame] ?? sheet.idle; if (!spr) return;
    g.save(); g.globalAlpha = 0.75; g.filter = 'saturate(0.2) brightness(1.15)';
    if (this.flashT > 0) g.filter = 'brightness(3)';
    blit(g, spr, this.mirrorFacing < 0, Math.floor(this.x + this.w / 2 - spr.w / 2 - cam.x), Math.floor(this.y + this.h - spr.h - cam.y));
    g.restore();
    // 鏡の軸（薄い光の線）
    g.fillStyle = 'rgba(232,232,244,0.25)'; g.fillRect(Math.round(this.axis - cam.x), 0, 1, 224);
  }
}

// ---- ガーゴイル人形 (第六章): 止まり木で待ち、主人公が下を通ると急降下して戻る ----
export class GargoyleDoll extends Enemy {
  constructor(world, x, y) {
    super(world, x, y - 20, 16, 20); this.spriteOff = [2, 2]; this.gravity = false; this.hp = 3; this.score = 300; this.gore = 'bone';
    this.fitSprite('gargoyle1', 0.6, 0.85); this.perchY = this.y; this.state = 'perch'; this.stateT = 0; this.vx = 0; this.vy = 0; this.contact = true;
  }
  update(dt) {
    super.update(dt); this.stateT += dt; const p = this.player, d = this.distX();
    this.facing = d < 0 ? -1 : 1;
    switch (this.state) {
      case 'perch': if (Math.abs(d) < 70 && p.y > this.y && this.stateT > 0.5) { this.state = 'swoop'; this.stateT = 0; const dy = p.y + p.h / 2 - this.cy, dd = Math.hypot(d, dy) || 1; this.vx = d / dd * 170; this.vy = dy / dd * 170; this.world.audio.sfx('hit'); } break;
      case 'swoop': this.x += this.vx * dt; this.y += this.vy * dt; if (this.stateT > 0.6 || this.world.level.map.isSolid(Math.floor(this.cx / TILE), Math.floor((this.y + this.h) / TILE))) { this.state = 'return'; this.stateT = 0; } break;
      case 'return': { const tx = this.x, ty = this.perchY; this.y += Math.sign(ty - this.y) * Math.min(Math.abs(ty - this.y), 90 * dt); if (Math.abs(this.y - ty) < 1) { this.state = 'perch'; this.stateT = 0; } break; }
    }
  }
  spriteName() { return this.state === 'perch' ? 'gargoyle1' : 'gargoyle2'; }
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
    case 'mermaid': return new MermaidDoll(world, x + 1, y);
    case 'umbrella': return new UmbrellaFairy(world, x + 1, y);
    case 'dollpart': return new UnfinishedDoll(world, x + 1, y + TILE);
    case 'needles': return new NeedleSwarm(world, x, y);
    case 'balloon': return new BalloonGhost(world, x + 1, y);
    case 'clown': return new ClownSkeleton(world, x + 1, y + TILE);
    case 'mirror': return new MirrorLyrica(world, x + TILE / 2, y);
    case 'gargoyle': return new GargoyleDoll(world, x, y + TILE);
  }
  return null;
}
