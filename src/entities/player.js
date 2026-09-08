import { TILE, moveBody } from '../physics.js';
import { PlayerShot, WEAPONS } from './projectiles.js';

const SPEED = 66, GRAV = 560, JUMP_V = -218, DJUMP_V = -196;
const STAND_H = 22, CROUCH_H = 16;

// 主人公リリカ。超魔界村式: 空中制御なし・二段ジャンプで軌道修正・被弾で変身解除。
export class Player {
  constructor(world, x, y) {
    this.world = world;
    this.w = 10; this.h = STAND_H; this.x = x + 3; this.y = y - 8;
    this.vx = 0; this.vy = 0; this.facing = 1; this.onGround = false;
    this.costume = 'dress'; this.weapon = 'star';
    this.state = 'normal'; this.jumps = 0; this.crouch = false;
    this.invT = 0; this.hurtT = 0; this.attackT = 0; this.runT = 0; this.chargeT = 0; this.deathT = 0;
    this.broomT = 0; this.wasShoot = false; this.poisonT = 0;
  }
  get alive() { return this.state === 'normal'; }
  get centerX() { return this.x + this.w / 2; }

  setCostume(c) { this.costume = c; }

  update(dt, input) {
    const map = this.world.level.map;
    if (this.state === 'dying') { this.deathT += dt; if (this.deathT > 1.9) { this.state = 'dead'; this.world.onPlayerDeath(); } return; }
    if (this.state !== 'normal') return;

    this.invT = Math.max(0, this.invT - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    this.attackT = Math.max(0, this.attackT - dt); this.broomT = Math.max(0, this.broomT - dt);
    this.poisonT = Math.max(0, this.poisonT - dt);
    const ctrl = this.hurtT <= 0 && !this.world.cutscene;

    const left = ctrl && input.down('left'), right = ctrl && input.down('right');
    const dir = left ? -1 : right ? 1 : 0;

    // しゃがみ
    const wantCrouch = ctrl && input.down('down') && this.onGround;
    if (wantCrouch && !this.crouch) { this.crouch = true; this.y += STAND_H - CROUCH_H; this.h = CROUCH_H; }
    else if (!wantCrouch && this.crouch) { this.crouch = false; this.y -= STAND_H - CROUCH_H; this.h = STAND_H; }

    if (this.onGround) {
      this.jumps = 0;
      this.vx = this.crouch ? 0 : dir * SPEED;
      if (dir) this.facing = dir;
      if (dir && !this.crouch) this.runT += dt; else this.runT = 0;
      if (ctrl && input.hit('jump') && !this.crouch) {
        this.vy = JUMP_V; this.jumps = 1; this.onGround = false; this.world.audio.sfx('jump');
        this.world.particles.emit('dust', this.centerX, this.y + this.h, 3);
      }
    } else {
      // 空中: 二段ジャンプのみ軌道変更可（ほうき）
      if (ctrl && input.hit('jump') && this.jumps === 1) {
        this.jumps = 2; this.vy = DJUMP_V; this.vx = dir * SPEED; if (dir) this.facing = dir;
        this.broomT = 0.45; this.world.audio.sfx('djump');
        this.world.particles.emit('sparkle', this.centerX, this.y + this.h, 6);
      }
    }

    // 射撃
    if (ctrl) {
      const shootHeld = input.down('shoot');
      if (input.hit('shoot')) this.shoot(false);
      if (this.costume === 'gold') {
        if (shootHeld) { this.chargeT += dt; if (this.chargeT > 0.9 && Math.random() < 0.5) this.world.particles.emit('sparkle', this.centerX + this.facing * 8, this.y + 10, 1); }
        else { if (this.chargeT > 0.9) this.shoot(true); this.chargeT = 0; }
      } else this.chargeT = 0;
    }

    this.vy += GRAV * dt; if (this.vy > 320) this.vy = 320;
    const res = moveBody(this, map, dt);
    if (res.hitTop) this.vy = 0;
    if (this.onGround && this.hurtT > 0) this.vx = 0;

    // 危険タイル・落下
    const cx = Math.floor(this.centerX / TILE), fy = Math.floor((this.y + this.h - 2) / TILE), hy = Math.floor((this.y + this.h / 2) / TILE);
    if (this.y > map.pixelHeight + 8) this.die('fall');
    else if (map.isHazard(cx, fy) || map.isHazard(cx, hy)) this.die(map.at(cx, fy) === '^' ? 'spike' : 'bog');
    else if (this.x < 0) this.x = 0;
  }

  shoot(charged) {
    const W = WEAPONS[this.weapon];
    const mine = this.world.shots.filter(s => !s.dead);
    if (!charged && mine.length >= W.max) return;
    const sy = this.crouch ? this.y + 8 : this.y + 10;
    const sx = this.centerX + this.facing * 6;
    this.world.shots.push(new PlayerShot(this.world, this.weapon, sx, sy, this.facing, charged));
    this.attackT = 0.18;
    this.world.audio.sfx(charged ? 'chargeshot' : 'shoot');
    if (charged) this.world.particles.emit('sparkle', sx, sy, 14);
  }

  // 被弾
  hit(source) {
    if (this.state !== 'normal' || this.invT > 0) return false;
    const w = this.world;
    if (this.costume === 'plain') { this.die('hit'); return true; }
    // 変身解除
    w.particles.emit('sparkle', this.centerX, this.y + 10, 16);
    w.particles.emit('stuffing', this.centerX, this.y + 12, 6);
    this.costume = 'plain'; this.chargeT = 0;
    this.invT = 1.8; this.hurtT = 0.35;
    this.vx = (source && source.x + (source.w ?? 0) / 2 > this.centerX ? -1 : 1) * 50; this.vy = -120; this.onGround = false;
    w.audio.sfx('undress'); w.shake(4);
    w.toast('変身が解けた…！');
    return true;
  }

  die(reason) {
    if (this.state !== 'normal') return;
    const w = this.world;
    this.state = 'dying'; this.deathT = 0; this.vx = 0; this.vy = 0; this.deathReason = reason;
    w.audio.sfx('death'); w.shake(6);
    if (reason === 'bog') { w.particles.emit('poison', this.centerX, this.y + this.h, 20); this.deathT = 0.8; }
    else if (reason === 'spike') w.particles.emit('blood', this.centerX, this.y + this.h, 24, { power: 1.2 });
    else w.particles.emit('sparkle', this.centerX, this.y + 8, 20);
    w.particles.emit('stuffing', this.centerX, this.y + 10, 6);
    w.onPlayerDying();
  }

  respawn(x, y) {
    this.x = x + 3; this.y = y - 8; this.vx = 0; this.vy = 0; this.h = STAND_H; this.crouch = false;
    this.state = 'normal'; this.costume = 'dress'; this.invT = 2.0; this.hurtT = 0; this.jumps = 0; this.chargeT = 0; this.facing = 1;
  }

  frame() {
    if (this.state !== 'normal') return { full: 'dead' };
    if (this.crouch) return { full: 'crouch' };
    if (this.hurtT > 0) return { top: 'hurt', legs: 'jump' };
    if (!this.onGround) return { top: this.attackT > 0 ? 'attack' : 'jump', legs: 'jump' };
    const top = this.attackT > 0 ? 'attack' : 'idle';
    if (this.vx !== 0) { const f = ['run1', 'run2', 'run3', 'run2'][Math.floor(this.runT * 9) % 4]; return { top, legs: f }; }
    return { top, legs: 'stand' };
  }

  draw(g, cam, assets) {
    if (this.state === 'dead') return;
    if (this.state === 'dying' && this.deathReason === 'bog') {
      // 沼に沈む
      const sink = Math.min(24, this.deathT * 30);
      g.save(); g.beginPath(); g.rect(0, 0, 999, Math.floor(this.y + this.h - cam.y - 2)); g.clip();
      this._drawBody(g, cam, assets, sink); g.restore(); return;
    }
    if (this.state === 'dying') {
      if (this.deathT > 1.0 && Math.floor(this.deathT * 16) % 2) return; // 消えかけの点滅
    } else if (this.invT > 0 && Math.floor(this.invT * 18) % 2) return; // 無敵点滅
    this._drawBody(g, cam, assets, 0);
  }

  _drawBody(g, cam, assets, dy) {
    const fr = this.frame();
    const sheet = assets.player[this.costume];
    const key = fr.full ?? `${fr.top}_${fr.legs}`;
    const spr = sheet[key]; if (!spr) return;
    const img = this.facing < 0 ? spr.l : spr.r;
    const px = Math.floor(this.x - 3 - cam.x), py = Math.floor(this.y - (STAND_H + 2 - this.h) - cam.y + dy);
    g.drawImage(img, px, py);
    if (this.costume !== 'plain' && this.state === 'normal') {
      const hat = this.facing < 0 ? assets.hat.l : assets.hat.r;
      const hy = fr.full === 'crouch' ? 7 : 0;
      g.drawImage(hat, px, py - 6 + hy);
    }
    if (this.state === 'dying' && this.deathReason !== 'bog') {
      // 帽子が飛ぶ
      const t = this.deathT; const hx = px + Math.floor(t * 20 * -this.facing), hy = py - 6 - Math.floor(60 * t - 90 * t * t);
      g.drawImage(this.facing < 0 ? assets.hat.l : assets.hat.r, hx, Math.min(hy, py + 14));
    }
    if (this.broomT > 0) {
      const b = this.facing < 0 ? assets.broom.l : assets.broom.r;
      g.drawImage(b, Math.floor(this.centerX - 10 - cam.x), Math.floor(this.y + this.h - 2 - cam.y));
    }
    if (this.chargeT > 0.9 && Math.floor(this.chargeT * 20) % 2) {
      g.drawImage(assets.shots.charge.r, px + (this.facing > 0 ? 14 : -8), py + 6);
    }
  }
}
