import { Enemy } from './enemies.js';
import { rand, grand } from '../util.js';
import { PAL } from '../gfx/palette.js';
import { blit } from '../gfx/sprite.js';

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
      if (grand() < 0.5) this.world.particles.emit('blood', this.x + grand() * this.w, this.y + grand() * this.h, 6, { power: 1.5 });
      if (grand() < 0.3) this.world.particles.emit('gore', this.x + grand() * this.w, this.y + grand() * this.h, 2);
      if (grand() < 0.2) this.world.shake(3);
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
    this.hpMax = this.hp = 16; this.facing = -1; this.enterX = x - 60; this.fitSprite('doll1', 0.6, 0.95);
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
        if (this.stateT > (enraged ? 1.6 : 2.4)) this.setState(grand() < 0.65 ? 'cry' : 'throw');
        break;
      case 'cry':
        this.vx = 0;
        if (Math.floor(this.stateT * 5) !== Math.floor((this.stateT - dt) * 5)) {
          const spd = Math.sign(d) * rand(30, 90);
          this.shoot('acid', spd, -60, this.facing * -5, -14); this.shoot('acid', spd * 0.6, -80, this.facing * 5, -14);
          if (enraged) this.shoot('blood', Math.sign(d) * rand(60, 120), -150, 0, -10);
          if (grand() < 0.3) this.world.audio.sfx('poison');
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
    const ar = this.world.arena; if (this.x < ar.x0 + 8) this.x = ar.x0 + 8; if (this.x + this.w > ar.x1 - 8) this.x = ar.x1 - 8 - this.w;
  }
  spriteName() { return this.state === 'cry' || this.state === 'throw' ? 'doll2' : 'doll1'; } // 2 コマ目（攻撃）は生成済みならそれを使う
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
    this.hpMax = this.hp = 20; this.facing = -1; this.enterX = x - 40; this.cycle = 0; this.fitSprite('teddy1', 0.75, 0.95);
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
          if (grand() < 0.3) this.world.particles.emit('stuffing', this.cx, this.cy + 6, 3);
          if (grand() < 0.2) this.world.audio.sfx('squish');
        }
        if (this.stateT > 1.9) this.setState('idle');
        break;
    }
    this.physics(dt);
    const a = this.world.arena; if (this.x < a.x0 + 4) this.x = a.x0 + 4; if (this.x + this.w > a.x1 - 4) this.x = a.x1 - 4 - this.w;
  }
  spriteName() { return this.state === 'belly' || this.state === 'jump' ? 'teddy2' : 'teddy1'; }
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
    this.hpMax = this.hp = 24; this.facing = -1; this.volleys = 0; this.alpha = 1; this.fitSprite('noir1', 0.45, 0.9); this.hoverY = groundY - this.h - 30;
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
        if (this.volleys >= 3) { this.volleys = 0; const r = grand(); this.setState(r < 0.4 ? 'teleport' : r < 0.7 ? 'rain' : 'dash'); }
        break;
      }
      case 'teleport':
        this.alpha = Math.max(0, 1 - this.stateT * 2);
        if (this.stateT > 0.5 && !this.tp) { this.tp = true; this.x = p.centerX + (grand() < 0.5 ? -90 : 90); this.x = Math.max(a.x0 + 16, Math.min(a.x1 - 32, this.x)); this.world.particles.emit('dark', this.cx, this.cy, 20); }
        if (this.stateT > 0.6) { this.alpha = Math.min(1, (this.stateT - 0.6) * 3); }
        if (this.stateT > 1.0) { this.tp = false; this.alpha = 1; this.setState('hover'); }
        break;
      case 'rain':
        this.y = this.hoverY - 20 + Math.sin(this.t * 2) * 4; this.alpha = 1;
        if (this.stateT > 0.4 && this.stateT < (enraged ? 2.2 : 1.6) && grand() < 0.35) {
          this.world.enemyShots.push(...[0].map(() => { const sx = a.x0 + 16 + grand() * (a.x1 - a.x0 - 32); return this._rainDrop(sx); }));
        }
        if (this.stateT > 2.4) this.setState('hover');
        break;
      case 'dash':
        if (this.stateT < 0.5) { this.facing = Math.sign(dx) || 1; this.targetY = p.y + p.h / 2 - this.h / 2; this.y += (this.targetY - this.y) * 6 * dt; this.vx = 0; }
        else { this.vx = this.facing * (enraged ? 230 : 180); this.x += this.vx * dt; if (grand() < 0.6) this.world.particles.emit('dark', this.cx, this.cy, 2); }
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
  spriteName() { return this.state === 'rain' || this.state === 'dash' ? 'noir2' : 'noir1'; }
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

// ---- 涙の大蛇 (第三章): 川を渡る長い体。頭だけが弱点、胴体は触れると被弾 ----
// かわいい: 赤いリボンと潤んだ大きな目 / えげつない: 鱗の間から血の涙、口内に人形の腕
export class TearSerpent extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 40, 40, 40); this.spriteOff = [4, 2];
    this.hpMax = this.hp = 24; this.facing = -1; this.fitSprite('serpent_head1', 0.7, 0.8);
    this.waterY = groundY;                       // 水面（部屋の '~' の上端。startBoss が渡す groundY）
    this.segCount = 7; this.segGap = 14;         // 胴 6 + 尾 1、間隔（世界単位）
    this.trail = []; this.parts = []; this.pathT = 0; this.mouth = 0; this.rainT = 4;
    for (let i = 0; i < this.segCount; i++) this.parts.push(new SerpentPart(this, i === this.segCount - 1));
    this.enterX = x; this.headOpen = false;
  }
  // 弧を描いて川を横切る基準位置。t の進みで左右に往復
  pathPos(t) {
    const a = this.world.arena; const x0 = a.x0 + 24, x1 = a.x1 - 24;
    const u = (Math.sin(t * 0.55) + 1) / 2;          // 0..1 往復（周期 ≈ 11.4 秒）
    const x = x1 - (x1 - x0) * u;
    const y = this.waterY - 26 - Math.abs(Math.sin(t * 1.6)) * 26; // 波打ちながら水面上 26〜52 を進む
    return [x, y];
  }
  update(dt) {
    if (super.update(dt)) { for (const q of this.parts) q.follow(this); if (this.dead) for (const q of this.parts) q.dead = true; return; }
    const p = this.player; const enraged = this.hpRatio < 0.5;
    this.pathT += dt * (enraged ? 1.4 : 1);
    const [bx, by] = this.pathPos(this.pathT);
    switch (this.state) {
      case 'enter': { // 水面下から浮上
        const ty = this.waterY - 20; this.y += (ty - this.y) * Math.min(1, dt * 2); this.x = bx - this.w / 2;
        if (this.stateT > 1.5) { this.setState('sweep'); this.contact = true; }
        break;
      }
      case 'sweep': { // 川を横切る。主人公が頭の近くに来たら噛みつき
        this.x = bx - this.w / 2; this.y = by - this.h / 2; this.headOpen = false;
        const d = this.distX();
        if (this.stateT > 1.2 && Math.abs(d) < 70 && p.y < this.waterY) { this.setState('strike'); this.strikeFrom = [this.x, this.y]; this.strikeTo = [p.x + p.w / 2 - this.w / 2, Math.max(this.waterY - 110, p.y - 6)]; this.world.audio.sfx('boss'); }
        this.rainT -= dt; if (this.rainT <= 0) { this.rainT = enraged ? 3.2 : 4.5; this.setState('rain'); }
        break;
      }
      case 'strike': { // 0.35 秒で主人公へ突き出し、口を開ける。0.5 秒で戻る
        const k = Math.min(1, this.stateT / 0.35); const e = k < 1 ? 1 - (1 - k) * (1 - k) : 1;
        this.headOpen = k > 0.3;
        if (this.stateT < 0.5) { this.x = this.strikeFrom[0] + (this.strikeTo[0] - this.strikeFrom[0]) * e; this.y = this.strikeFrom[1] + (this.strikeTo[1] - this.strikeFrom[1]) * e; }
        else { const r = Math.min(1, (this.stateT - 0.5) / 0.5); this.x = this.strikeTo[0] + (bx - this.w / 2 - this.strikeTo[0]) * r; this.y = this.strikeTo[1] + (by - this.h / 2 - this.strikeTo[1]) * r; if (r >= 1) this.setState('sweep'); }
        break;
      }
      case 'rain': { // 口を上に向けて血の涙を吐き上げる（落ちてくる）
        this.x = bx - this.w / 2; this.y = by - this.h / 2; this.headOpen = true;
        if (Math.floor(this.stateT * 8) !== Math.floor((this.stateT - dt) * 8) && this.stateT < 1) { const n = enraged ? 2 : 1; for (let i = 0; i < n; i++) this.shoot('rain', rand(-70, 70), -230 + rand(-30, 0), 0, -8, { life: 3.5 }); }
        if (this.stateT > 1.2) this.setState('sweep');
        break;
      }
    }
    this.facing = this.player.centerX < this.cx ? -1 : 1;
    // 軌跡を記録し、胴体を追従させる
    this.trail.unshift([this.cx, this.cy]); if (this.trail.length > 400) this.trail.pop();
    for (const q of this.parts) q.follow(this);
  }
  spriteName() { return this.headOpen ? 'serpent_head2' : 'serpent_head1'; }
}
// 胴体・尾の 1 節。当たると被弾するが撃てない（hp なし）。World.enemies に登録される
class SerpentPart {
  constructor(head, isTail) { this.head = head; this.world = head.world; this.isTail = isTail; this.w = 18; this.h = 18; this.x = head.x; this.y = head.y; this.contact = false; this.dead = false; this.spawnX = -9999; this.facing = -1; }
  update() {}
  follow(head) {
    const idx = head.parts.indexOf(this) + 1; const dist = idx * head.segGap;
    // 軌跡上で頭から dist 離れた点を探す
    let acc = 0, pos = head.trail[0] ?? [head.cx, head.cy];
    for (let i = 1; i < head.trail.length; i++) { const a = head.trail[i - 1], b = head.trail[i]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + d >= dist) { const k = (dist - acc) / (d || 1); pos = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; break; } acc += d; pos = b; }
    this.facing = head.facing;
    const spr = this.world.assets.bosses?.[this.isTail ? 'serpent_tail' : 'serpent_body'];
    if (spr?.hd) { this.w = Math.round(spr.w * 0.7); this.h = Math.round(spr.h * 0.7); }
    this.x = pos[0] - this.w / 2; this.y = pos[1] - this.h / 2;
    this.contact = head.state !== 'enter' && !head.dying && this.y + this.h < head.waterY + 6;
  }
  draw(g, cam, assets) {
    const spr = assets.bosses?.[this.isTail ? 'serpent_tail' : 'serpent_body']; if (!spr) { g.fillStyle = '#5a94b4'; g.fillRect(Math.round(this.x - cam.x), Math.round(this.y - cam.y), this.w, this.h); return; }
    g.save(); g.beginPath(); g.rect(0, 0, 9999, Math.floor(this.head.waterY + 4 - cam.y)); g.clip();
    blit(g, spr, this.facing < 0, Math.round(this.x + this.w / 2 - spr.w / 2 - cam.x), Math.round(this.y + this.h / 2 - spr.h / 2 - cam.y));
    g.restore();
  }
}

// ---- 人形師の機械 (第四章): ベルトコンベアの上で戦う。左右に走り、針を叩き落とし、糸弾と人形の腕を投げる ----
// かわいい: 頰紅の描かれた機械の顔と提灯の目 / えげつない: 骨組みに縫い込まれた人形の胴体、継ぎ目から血の綿
export class DollmakerMachine extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 60, 40, 60); this.spriteOff = [4, 2];
    this.hpMax = this.hp = 28; this.facing = -1; this.fitSprite('machine1', 0.7, 0.95); this.enterX = x - 40; this.attackAnim = 0; this.cycle = 0;
  }
  update(dt) {
    if (super.update(dt)) return;
    const p = this.player, d = this.distX(), enraged = this.hpRatio < 0.5, a = this.world.arena;
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    switch (this.state) {
      case 'enter': this.vx = -30; if (this.x <= this.enterX) { this.vx = 0; this.setState('roll'); this.contact = true; } break;
      case 'roll': // 主人公の方へ転がる。1.6 秒で次の攻撃
        this.facePlayer(); this.vx = this.facing * (enraged ? 40 : 26);
        if (this.stateT > 1.6) { this.cycle++; this.setState(this.cycle % 3 === 0 ? 'toss' : this.cycle % 3 === 1 ? 'slam' : 'thread'); this.vx = 0; }
        break;
      case 'slam': // 主人公の真上に針を落とす（0.5 秒後に落下、着弾で床に針が刺さり 0.6 秒残る）
        if (this.stateT > 0.5 && !this.slammed) { this.slammed = true; this.attackAnim = 0.5; this.shoot('bone', 0, 260, Math.sign(d) * Math.min(Math.abs(d), 120), -40, { life: 1.5 }); this.world.shake(2); this.world.audio.sfx('hit'); }
        if (this.stateT > 1.1) { this.slammed = false; this.setState('roll'); }
        break;
      case 'thread': // 糸弾（bolt）を扇状に 3〜5 発
        if (Math.floor(this.stateT * 6) !== Math.floor((this.stateT - dt) * 6) && this.stateT < (enraged ? 0.9 : 0.55)) { this.attackAnim = 0.3; const n = enraged ? 5 : 3; for (let i = 0; i < n; i++) { const ang = Math.atan2(p.y + p.h / 2 - this.cy, d) + (i - (n - 1) / 2) * 0.22; this.shoot('bolt', Math.cos(ang) * 120, Math.sin(ang) * 120, this.facing * 10, -10, { life: 2.5 }); } this.world.audio.sfx('poison'); }
        if (this.stateT > 1.2) this.setState('roll');
        break;
      case 'toss': // 人形の胴体（arm ブーメラン）を投げる
        if (this.stateT > 0.3 && !this.tossed) { this.tossed = true; this.attackAnim = 0.5; this.shoot('arm', this.facing * 120, -60, this.facing * 12, -14, { life: 3 }); this.world.audio.sfx('hurt'); }
        if (this.stateT > 1.0) { this.tossed = false; this.setState('roll'); }
        break;
    }
    this.physics(dt);
    if (a) { if (this.x < a.x0 + 8) { this.x = a.x0 + 8; this.vx = Math.abs(this.vx); } if (this.x + this.w > a.x1 - 8) { this.x = a.x1 - 8 - this.w; this.vx = -Math.abs(this.vx); } }
  }
  spriteName() { return this.attackAnim > 0 ? 'machine2' : 'machine1'; }
}

// ---- 大観覧車の主 (第五章): 部屋の観覧車（回転足場）を渡って背中側から撃つ想定。鞭の横薙ぎ・人形の頭の射出・ストンプ ----
// かわいい: 骨の顔に描かれた笑顔と頬紅、山高帽 / えげつない: 胸郭の中で回る人形の頭の観覧車、燕尾服を伝う血
export class Ringmaster extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 70, 30, 70); this.spriteOff = [4, 2];
    this.hpMax = this.hp = 30; this.facing = -1; this.fitSprite('ringmaster1', 0.5, 0.95); this.enterX = x - 30; this.attackAnim = 0; this.cycle = 0; this.whipBox = null;
  }
  update(dt) {
    if (super.update(dt)) return;
    const p = this.player, d = this.distX(), enraged = this.hpRatio < 0.5, a = this.world.arena;
    this.attackAnim = Math.max(0, this.attackAnim - dt); this.whipBox = null;
    switch (this.state) {
      case 'enter': this.vx = -20; if (this.x <= this.enterX) { this.vx = 0; this.setState('stand'); this.contact = true; } break;
      case 'stand': // 主人公に向き直り、1.4 秒で次の攻撃
        this.facePlayer(); this.vx = 0;
        if (this.stateT > (enraged ? 1.0 : 1.4)) { this.cycle++; this.setState(this.cycle % 3 === 1 ? 'whip' : this.cycle % 3 === 2 ? 'heads' : 'stomp'); }
        break;
      case 'whip': { // 0.3 秒後に前方 90 の横薙ぎ（主人公の腰の高さ）。しゃがみで避ける
        if (this.stateT > 0.3 && this.stateT < 0.55) { this.attackAnim = 0.3; const len = 90, y = this.y + this.h * 0.45; this.whipBox = { x: this.facing > 0 ? this.x + this.w : this.x - len, y, w: len, h: 10 }; if (p.alive && p.x < this.whipBox.x + this.whipBox.w && p.x + p.w > this.whipBox.x && p.y < y + 10 && p.y + p.h > y) p.hit(this); }
        if (this.stateT > 0.9) this.setState('stand');
        break;
      }
      case 'heads': // 胸郭の観覧車から人形の頭（追尾弾 darkheart）を 3〜5 個
        if (Math.floor(this.stateT * 4) !== Math.floor((this.stateT - dt) * 4) && this.stateT < (enraged ? 1.3 : 0.8)) { this.attackAnim = 0.4; const ang = Math.atan2(p.y - this.cy, d) + rand(-0.5, 0.5); this.shoot('darkheart', Math.cos(ang) * 90, Math.sin(ang) * 90 - 40, this.facing * 6, -10, { life: 3 }); this.world.audio.sfx('poison'); }
        if (this.stateT > 1.6) this.setState('stand');
        break;
      case 'stomp': // 竹馬で跳んで着地、揺れ＋骨の破片
        if (this.stateT < 0.05 && this.onGround) { this.vy = -240; this.vx = Math.sign(d) * 60; }
        if (this.onGround && this.stateT > 0.3) { this.vx = 0; this.world.shake(5); this.attackAnim = 0.3; for (let i = -2; i <= 2; i++) this.shoot('bone', i * 45, -160 - Math.abs(i) * 10, 0, 20, { life: 2 }); this.world.audio.sfx('hit'); this.setState('stand'); }
        break;
    }
    this.physics(dt);
    if (a) { if (this.x < a.x0 + 8) { this.x = a.x0 + 8; } if (this.x + this.w > a.x1 - 8) { this.x = a.x1 - 8 - this.w; } }
  }
  spriteName() { return this.attackAnim > 0 ? 'ringmaster2' : 'ringmaster1'; }
  draw(g, cam, assets) {
    super.draw(g, cam, assets);
    if (this.whipBox) { const b = this.whipBox; g.fillStyle = '#d9262b'; g.fillRect(Math.round(b.x - cam.x), Math.round(b.y + 4 - cam.y), b.w, 2); g.fillStyle = '#fdfbf7'; g.fillRect(Math.round((this.facing > 0 ? b.x + b.w - 6 : b.x) - cam.x), Math.round(b.y + 3 - cam.y), 6, 4); } // 鞭の軌跡
  }
}

// ---- 鏡の女王 (第六章): 鏡の間を瞬間移動し、破片を扇状に撃つ。HP 50% 以下で鏡像（もう 1 体の判定なし分身）が同時に撃つ ----
// かわいい: 銀の冠と描かれた微笑み / えげつない: 顔の半分が割れて空洞、鏡の裾から血、杖のガラスに人形の手
export class MirrorQueen extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 70, 26, 70); this.spriteOff = [4, 2];
    this.hpMax = this.hp = 30; this.facing = -1; this.fitSprite('mirrorqueen1', 0.5, 0.95); this.enterX = x - 20; this.attackAnim = 0; this.alpha = 1; this.cycle = 0; this.mirrorX = null;
  }
  update(dt) {
    if (super.update(dt)) return;
    const p = this.player, d = this.distX(), enraged = this.hpRatio < 0.5, a = this.world.arena;
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    switch (this.state) {
      case 'enter': this.alpha = Math.min(1, this.stateT / 1.2); if (this.stateT > 1.4) { this.setState('pose'); this.contact = true; } break;
      case 'pose': // 主人公を見て 1.2 秒。次は shards → teleport → (enraged) twin の順
        this.facePlayer(); if (this.stateT > (enraged ? 0.9 : 1.2)) { this.cycle++; this.setState(this.cycle % 3 === 1 ? 'shards' : this.cycle % 3 === 2 ? 'teleport' : enraged ? 'twin' : 'shards'); }
        break;
      case 'shards': // 破片を扇状に 5 発（enraged 7）。鏡像がいれば鏡像からも
        if (Math.floor(this.stateT * 5) !== Math.floor((this.stateT - dt) * 5) && this.stateT < 0.6) { this.attackAnim = 0.4; const n = enraged ? 7 : 5; const base = Math.atan2(p.y + p.h / 2 - this.cy, d); for (let i = 0; i < n; i++) { const ang = base + (i - (n - 1) / 2) * 0.2; this.shoot('bolt', Math.cos(ang) * 130, Math.sin(ang) * 130, this.facing * 8, -20, { life: 2.5 }); if (this.mirrorX !== null) this.world.enemyShots.push(new (this.world.classes.EnemyShot)(this.world, 'bolt', this.mirrorX, this.cy - 20, -Math.cos(ang) * 130, Math.sin(ang) * 130, { owner: this, life: 2.5 })); } this.world.audio.sfx('poison'); }
        if (this.stateT > 1.0) this.setState('pose');
        break;
      case 'teleport': // 0.4 秒で消え、部屋の反対側に現れる
        this.alpha = this.stateT < 0.4 ? 1 - this.stateT / 0.4 : Math.min(1, (this.stateT - 0.5) / 0.4); this.contact = this.alpha > 0.6;
        if (this.stateT >= 0.4 && !this.moved) { this.moved = true; const left = this.cx > (a.x0 + a.x1) / 2; this.x = left ? a.x0 + 24 : a.x1 - 24 - this.w; this.world.particles.emit('sparkle', this.cx, this.cy, 16); }
        if (this.stateT > 0.9) { this.moved = false; this.setState('pose'); }
        break;
      case 'twin': // 鏡像を部屋の反対側に置く（3 秒間、破片攻撃に同期）
        if (this.stateT < 0.05) { this.mirrorX = this.cx < (a.x0 + a.x1) / 2 ? a.x1 - 40 : a.x0 + 40; this.world.particles.emit('sparkle', this.mirrorX, this.cy, 14); this.world.audio.sfx('select'); }
        if (this.stateT > 0.3) this.setState('shards');
        break;
    }
    if (this.mirrorX !== null && this.state !== 'twin' && this.state !== 'shards') { if (this.stateT > 2.0) this.mirrorX = null; }
    this.physics(dt);
    if (a) { if (this.x < a.x0 + 8) this.x = a.x0 + 8; if (this.x + this.w > a.x1 - 8) this.x = a.x1 - 8 - this.w; }
  }
  spriteName() { return this.attackAnim > 0 ? 'mirrorqueen2' : 'mirrorqueen1'; }
  draw(g, cam, assets) {
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, this.alpha)); super.draw(g, cam, assets); g.restore();
    if (this.mirrorX !== null) { const spr = assets.bosses[this.spriteName()]; if (spr) { g.save(); g.globalAlpha = 0.5; g.filter = 'saturate(0.2) brightness(1.3)'; blit(g, spr, this.facing > 0, Math.round(this.mirrorX - spr.w / 2 - cam.x), Math.round(this.y + this.h - spr.h - cam.y)); g.restore(); } }
  }
}

// ---- 生まれ直すノワール (最終章 第 2 形態): 白いドレス。ノワールの行動に「光の星の環」を加え、常に激昂状態 ----
// かわいい: 白銀の髪と輝く瞳、整った冠 / えげつない: 手足は黒糸で縫い留められ、背の傷から羽が抜け落ち、唇から血
export class NoirReborn extends Noir {
  constructor(world, x, groundY) { super(world, x, groundY); this.hpMax = this.hp = 30; this.fitSprite('noirw1', 0.45, 0.9); this.ringT = 0; }
  get hpRatio() { return Math.min(0.49, Math.max(0, this.hp / this.hpMax)); } // 常に激昂
  update(dt) {
    super.update(dt);
    if (this.dying || this.state === 'enter') return;
    this.ringT += dt; // 3.5 秒ごとに 8 方向の星の環
    if (this.ringT > 3.5) { this.ringT = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + this.t; this.shoot('bolt', Math.cos(a) * 90, Math.sin(a) * 90, 0, 0, { life: 2.5 }); } this.world.audio.sfx('chargeshot'); this.world.particles.emit('sparkle', this.cx, this.cy, 20); }
  }
  spriteName() { return this.state === 'rain' || this.state === 'dash' ? 'noirw2' : 'noirw1'; }
}

// ---- 砂糖の女王 (第三章): 地上を歩き、ジャムを吐き、飴の破片を扇状に撒き、踏みつける ----
// かわいい: 飴の冠とメレンゲのドレス、頰紅 / えげつない: ドレスの割れ目から血のジャム、腕を這う砂糖の蟻、杖の先の人形の頭
export class SugarQueen extends Boss {
  constructor(world, x, groundY) {
    super(world, x, groundY - 60, 30, 60); this.spriteOff = [4, 2];
    this.hpMax = this.hp = 22; this.facing = -1; this.fitSprite('sugarqueen1', 0.5, 0.95); this.enterX = x - 50; this.attackAnim = 0; this.cycle = 0;
  }
  update(dt) {
    if (super.update(dt)) return;
    const p = this.player, d = this.distX(), enraged = this.hpRatio < 0.5, a = this.world.arena;
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    switch (this.state) {
      case 'enter': this.vx = -20; if (this.x <= this.enterX) { this.vx = 0; this.setState('walk'); this.contact = true; } break;
      case 'walk': this.facePlayer(); this.vx = this.facing * (enraged ? 22 : 14); if (this.stateT > (enraged ? 1.4 : 2.0)) { this.cycle++; this.vx = 0; this.setState(this.cycle % 3 === 1 ? 'jam' : this.cycle % 3 === 2 ? 'shards' : 'stomp'); } break;
      case 'jam': // ジャムを放物線で 3 発（酸として溜まる）
        if (Math.floor(this.stateT * 4) !== Math.floor((this.stateT - dt) * 4) && this.stateT < 0.8) { this.attackAnim = 0.4; this.shoot('acid', Math.sign(d) * rand(50, 110), -170, this.facing * 8, -20); this.world.audio.sfx('poison'); }
        if (this.stateT > 1.2) this.setState('walk');
        break;
      case 'shards': // 飴の破片（骨弾）を扇状に
        if (this.stateT > 0.3 && !this.shot) { this.shot = true; this.attackAnim = 0.4; const n = enraged ? 5 : 3; for (let i = 0; i < n; i++) this.shoot('bone', this.facing * (60 + i * 20), -120 - i * 15, this.facing * 8, -10, { life: 2 }); this.world.audio.sfx('hit'); }
        if (this.stateT > 1.0) { this.shot = false; this.setState('walk'); }
        break;
      case 'stomp': // 跳んで着地、揺れと血のジャムの飛沫
        if (this.stateT < 0.05 && this.onGround) { this.vy = -220; this.vx = Math.sign(d) * 50; }
        if (this.onGround && this.stateT > 0.3) { this.vx = 0; this.world.shake(4); this.attackAnim = 0.3; for (let i = -1; i <= 1; i++) this.shoot('blood', i * 60, -140, 0, 10, { life: 2 }); this.world.audio.sfx('hit'); this.setState('walk'); }
        break;
    }
    this.physics(dt);
    if (a) { if (this.x < a.x0 + 8) this.x = a.x0 + 8; if (this.x + this.w > a.x1 - 8) this.x = a.x1 - 8 - this.w; }
  }
  spriteName() { return this.attackAnim > 0 ? 'sugarqueen2' : 'sugarqueen1'; }
}

export function createBoss(world, kind, x, groundY) {
  switch (kind) {
    case 'doll': return new WeepingDoll(world, x, groundY);
    case 'teddy': return new GutsTeddy(world, x, groundY);
    case 'noir': return new Noir(world, x, groundY);
    case 'serpent': return new TearSerpent(world, x, groundY);
    case 'machine': return new DollmakerMachine(world, x, groundY);
    case 'ringmaster': return new Ringmaster(world, x, groundY);
    case 'mirrorqueen': return new MirrorQueen(world, x, groundY);
    case 'noirw': return new NoirReborn(world, x, groundY);
    case 'sugarqueen': return new SugarQueen(world, x, groundY);
  }
  return null;
}
