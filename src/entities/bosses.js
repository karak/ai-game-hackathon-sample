import { Enemy } from './enemies.js';
import { rand } from '../util.js';
import { PAL } from '../gfx/palette.js';

// ボス基底: HP バー、入場、死亡演出
export class Boss extends Enemy {
  constructor(world, x, y, w, h) {
    super(world, x, y, w, h);
    this.isBoss = true; this.state = 'enter'; this.stateT = 0; this.dying = false; this.dieT = 0; this.contact = false;
    this.score = 5000;
  }
  get hpRatio() { return Math.max(0, this.hp / this.hpMax); }
  setState(s) { this.state = s; this.stateT = 0; }
  hurt(dmg, shot) {
    if (this.dying || this.state === 'enter') return;
    this.hp -= dmg; this.flashT = 0.12;
    this.world.particles.emit('blood', shot ? shot.x + shot.w / 2 : this.cx, shot ? shot.y : this.cy, 8, { power: 1.3 });
    this.world.audio.sfx('bosshit');
    if (this.hp <= 0) { this.hp = 0; this.dying = true; this.dieT = 0; this.contact = false; this.vx = 0; this.world.audio.sfx('bossdie'); this.world.onBossDying(); }
  }
  update(dt) {
    super.update(dt); this.stateT += dt;
    if (this.dying) {
      this.dieT += dt;
      if (Math.random() < 0.5) this.world.particles.emit('blood', this.x + Math.random() * this.w, this.y + Math.random() * this.h, 6, { power: 1.5 });
      if (Math.random() < 0.3) this.world.particles.emit('gore', this.x + Math.random() * this.w, this.y + Math.random() * this.h, 2);
      if (Math.random() < 0.2) this.world.shake(3);
      if (this.dieT > 2.6) { this.dead = true; this.world.addScore(this.score); this.world.particles.emit('gore', this.cx, this.cy, 30); this.world.particles.emit('blood', this.cx, this.cy, 60, { power: 2 }); this.world.particles.emit('stuffing', this.cx, this.cy, 20); this.world.onBossDefeated(); }
      return true;
    }
    return false;
  }
  draw(g, cam, assets) {
    if (this.dying && Math.floor(this.dieT * 14) % 2) { this.flashT = 0.1; }
    super.draw(g, cam, assets);
  }
}

// ---- 泣き人形 (Stage1) ----
export class WeepingDoll extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 46, 24, 46); this.spriteOff = [4, 2];
    this.hpMax = this.hp = 16; this.facing = -1; this.enterX = x - 60;
  }
  update(dt) {
    if (super.update(dt)) return;
    const p = this.player; const d = this.distX(); const enraged = this.hpRatio < 0.5;
    switch (this.state) {
      case 'enter':
        this.vx = -22; if (this.x <= this.enterX) { this.vx = 0; this.setState('walk'); this.contact = true; }
        break;
      case 'walk':
        this.facePlayer(); this.vx = this.facing * (enraged ? 24 : 14);
        if (this.stateT > (enraged ? 1.6 : 2.4)) this.setState(Math.random() < 0.65 ? 'cry' : 'throw');
        break;
      case 'cry':
        this.vx = 0;
        if (Math.floor(this.stateT * 8) !== Math.floor((this.stateT - dt) * 8)) {
          const spd = Math.sign(d) * rand(30, 90);
          this.shoot('acid', spd, -60, this.facing * -5, -14); this.shoot('acid', spd * 0.6, -80, this.facing * 5, -14);
          if (enraged) this.shoot('blood', Math.sign(d) * rand(60, 120), -150, 0, -10);
          if (Math.random() < 0.3) this.world.audio.sfx('poison');
        }
        if (this.stateT > 1.4) this.setState('walk');
        break;
      case 'throw':
        this.vx = 0;
        if (this.stateT > 0.4 && !this.thrown) { this.thrown = true; this.shoot('arm', this.facing * 130, -40, this.facing * 10, -8, { life: 3 }); this.world.audio.sfx('hurt'); this.world.particles.emit('blood', this.x + (this.facing > 0 ? this.w : 0), this.y + 20, 10); }
        if (this.stateT > 1.2) { this.thrown = false; this.setState('walk'); }
        break;
    }
    this.physics(dt);
    if (this.x < this.world.arena.x0 + 8) { this.x = this.world.arena.x0 + 8; }
  }
  spriteName() { return 'doll1'; }
  draw(g, cam, assets) {
    super.draw(g, cam, assets);
    if (this.dying || this.state === 'enter') return;
    // 目から流れる血/酸
    const ex = Math.floor(this.x - cam.x), ey = Math.floor(this.y - cam.y);
    g.fillStyle = this.hpRatio < 0.5 ? PAL.K : PAL.U;
    const len = 6 + Math.floor(Math.sin(this.t * 6) * 2);
    g.fillRect(ex + 6, ey + 12, 1, len); g.fillRect(ex + 17, ey + 12, 1, len + 1);
    if (this.state === 'throw' && this.thrown) { g.fillStyle = PAL.K; g.fillRect(ex + (this.facing > 0 ? 24 : -2), ey + 22, 3, 3); }
  }
}

// ---- はらわたテディ (Stage2) ----
export class GutsTeddy extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 38, 34, 38); this.spriteOff = [3, 2];
    this.hpMax = this.hp = 20; this.facing = -1; this.enterX = x - 40; this.cycle = 0;
  }
  update(dt) {
    if (super.update(dt)) return;
    const d = this.distX(); const enraged = this.hpRatio < 0.5;
    switch (this.state) {
      case 'enter':
        this.vx = -30; if (this.x <= this.enterX) { this.vx = 0; this.setState('idle'); this.contact = true; }
        break;
      case 'idle':
        this.vx = 0; this.facePlayer();
        if (this.stateT > (enraged ? 0.5 : 0.9)) {
          this.cycle++;
          if (this.cycle % 3 === 0) this.setState('belly'); else { this.setState('jump'); this.vy = -270; this.vx = this.facing * Math.min(90, Math.abs(d) * 0.9); }
        }
        break;
      case 'jump':
        if (this.onGround && this.stateT > 0.2) {
          this.vx = 0; this.world.shake(5); this.world.audio.sfx('splat');
          this.world.particles.emit('dust', this.cx, this.y + this.h, 10);
          for (let i = -2; i <= 2; i++) this.shoot('maggot', this.facing * (40 + Math.abs(i) * 20) + i * 15, -120 - Math.abs(i) * 10, this.facing * 8, 4);
          this.setState('idle');
        }
        break;
      case 'belly':
        this.vx = 0;
        if (this.stateT > 0.5 && Math.floor(this.stateT * 12) !== Math.floor((this.stateT - dt) * 12) && this.stateT < 1.6) {
          const a = rand(-2.6, -0.5); const sp = rand(90, 150);
          this.shoot('blood', Math.cos(a) * sp, Math.sin(a) * sp, 0, 6, { life: 3 });
          if (Math.random() < 0.3) this.world.particles.emit('stuffing', this.cx, this.cy + 6, 3);
          if (Math.random() < 0.2) this.world.audio.sfx('squish');
        }
        if (this.stateT > 1.9) this.setState('idle');
        break;
    }
    this.physics(dt);
    const a = this.world.arena; if (this.x < a.x0 + 4) this.x = a.x0 + 4; if (this.x + this.w > a.x1 - 4) this.x = a.x1 - 4 - this.w;
  }
  spriteName() { return 'teddy1'; }
  draw(g, cam, assets) {
    if (this.state === 'belly' && !this.dying) {
      const sx = Math.floor(this.x - cam.x), sy = Math.floor(this.y - cam.y);
      g.fillStyle = PAL.K; g.fillRect(sx + 10, sy + 20, 14, 8); g.fillStyle = PAL.Z; g.fillRect(sx + 13, sy + 22, 8, 4);
    }
    super.draw(g, cam, assets);
  }
}

// ---- 堕ちた魔法少女ノワール (Stage3) ----
export class Noir extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 100, 16, 28); this.spriteOff = [4, 2]; this.gravity = false;
    this.hpMax = this.hp = 24; this.facing = -1; this.volleys = 0; this.alpha = 1; this.hoverY = groundY - 70;
    this.groundY = groundY;
  }
  update(dt) {
    if (super.update(dt)) return;
    const p = this.player; const enraged = this.hpRatio < 0.5; const a = this.world.arena;
    const dx = p.centerX - this.cx;
    switch (this.state) {
      case 'enter':
        this.y += (this.hoverY - this.y) * 2 * dt; this.alpha = Math.min(1, this.stateT / 1.2);
        if (this.stateT > 1.5) { this.setState('hover'); this.contact = true; }
        break;
      case 'hover': {
        this.facing = Math.sign(dx) || 1;
        this.y = this.hoverY + Math.sin(this.t * 2) * 6;
        this.x += Math.sign(dx) * Math.min(30, Math.abs(dx)) * 0.6 * dt;
        const interval = enraged ? 0.9 : 1.3;
        if (Math.floor(this.stateT / interval) !== Math.floor((this.stateT - dt) / interval)) {
          const n = enraged ? 5 : 3; const py = p.y + p.h / 2;
          const ang = Math.atan2(py - this.cy, dx);
          for (let i = 0; i < n; i++) { const aa = ang + (i - (n - 1) / 2) * 0.28; this.shoot('darkheart', Math.cos(aa) * 110, Math.sin(aa) * 110, 0, 0, { life: 3 }); }
          this.world.audio.sfx('shoot'); this.volleys++;
        }
        if (this.volleys >= 3) { this.volleys = 0; const r = Math.random(); this.setState(r < 0.4 ? 'teleport' : r < 0.7 ? 'rain' : 'dash'); }
        break;
      }
      case 'teleport':
        this.alpha = Math.max(0, 1 - this.stateT * 2);
        if (this.stateT > 0.5 && !this.tp) { this.tp = true; this.x = p.centerX + (Math.random() < 0.5 ? -90 : 90); this.x = Math.max(a.x0 + 16, Math.min(a.x1 - 32, this.x)); this.world.particles.emit('dark', this.cx, this.cy, 20); }
        if (this.stateT > 0.6) { this.alpha = Math.min(1, (this.stateT - 0.6) * 3); }
        if (this.stateT > 1.0) { this.tp = false; this.alpha = 1; this.setState('hover'); }
        break;
      case 'rain':
        this.y = this.hoverY - 20 + Math.sin(this.t * 2) * 4; this.alpha = 1;
        if (this.stateT > 0.4 && this.stateT < (enraged ? 2.2 : 1.6) && Math.random() < 0.35) {
          this.world.enemyShots.push(...[0].map(() => { const sx = a.x0 + 16 + Math.random() * (a.x1 - a.x0 - 32); return this._rainDrop(sx); }));
        }
        if (this.stateT > 2.4) this.setState('hover');
        break;
      case 'dash':
        if (this.stateT < 0.5) { this.facing = Math.sign(dx) || 1; this.targetY = p.y + p.h / 2 - this.h / 2; this.y += (this.targetY - this.y) * 6 * dt; this.vx = 0; }
        else { this.vx = this.facing * (enraged ? 230 : 180); this.x += this.vx * dt; if (Math.random() < 0.6) this.world.particles.emit('dark', this.cx, this.cy, 2); }
        if (this.x < a.x0 + 4 || this.x + this.w > a.x1 - 4) { this.x = Math.max(a.x0 + 4, Math.min(a.x1 - 4 - this.w, this.x)); this.setState('hover'); }
        break;
    }
    this.x = Math.max(a.x0 + 4, Math.min(a.x1 - 4 - this.w, this.x));
  }
  _rainDrop(sx) {
    const { EnemyShot } = this.world.classes;
    const map = this.world.level.map; let ty = 0; while (ty < map.height && map.isSolid(Math.floor(sx / 16), ty)) ty++;
    return new EnemyShot(this.world, 'rain', sx, ty * 16 + 4, 0, 40, { owner: this, life: 4 });
  }
  hurt(dmg, shot) { if (this.state === 'teleport' || this.alpha < 0.8) return; super.hurt(dmg, shot); }
  spriteName() { return 'noir1'; }
  draw(g, cam, assets) {
    g.globalAlpha = this.alpha;
    super.draw(g, cam, assets);
    g.globalAlpha = 1;
    if (!this.dying && this.alpha > 0.9) {
      // 血の涙
      const ex = Math.floor(this.x - cam.x), ey = Math.floor(this.y - cam.y);
      g.fillStyle = PAL.K; g.fillRect(ex + (this.facing < 0 ? 4 : 10), ey + 8, 1, 5 + Math.floor(Math.sin(this.t * 5) * 2));
    }
  }
}

export function createBoss(world, kind, x, groundY) {
  switch (kind) {
    case 'doll': return new WeepingDoll(world, x, groundY);
    case 'teddy': return new GutsTeddy(world, x, groundY);
    case 'noir': return new Noir(world, x, groundY);
  }
  return null;
}
