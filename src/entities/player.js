import { TILE, moveBody } from '../physics.js';
import { PlayerShot, WEAPONS } from './projectiles.js';
import { blit } from '../gfx/sprite.js';
import { castMagic, MAGIC } from './magic.js';
import { carryByPlatform, landOnPlatforms, triggerCrumbles, applyFlow, applyConveyor, ladderAt, ladderBelow, LADDER_SPEED } from './gimmicks.js';
import { t } from '../i18n.js';

const SPEED = 66, GRAV = 560, JUMP_V = -218, DJUMP_V = -196; // 単発ジャンプ 42 世界px(2.6タイル)
const STAND_H = 28, CROUCH_H = 18; // 当たり判定（世界単位）。スプライトは生成 PNG のサイズに従う（docs/art-standard.md §2.1）

// 主人公リリカ。超魔界村式: 空中制御なし・二段ジャンプで軌道修正・被弾で変身解除。
export class Player {
  constructor(world, x, y) {
    this.world = world;
    this.w = 12; this.h = STAND_H; this.x = x + 2; this.y = y + TILE - STAND_H; // マーカーのタイル下端に足を合わせる
    this.vx = 0; this.vy = 0; this.facing = 1; this.onGround = false;
    this.costume = 'dress'; this.weapon = 'star';
    this.state = 'normal'; this.jumps = 0; this.crouch = false;
    this.invT = 0; this.hurtT = 0; this.attackT = 0; this.runT = 0; this.chargeT = 0; this.deathT = 0;
    this.platform = null; this.climbing = false; // 乗っている動く足場 / はしご昇降中
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
    const up = ctrl && input.down('up'), down = ctrl && input.down('down');

    // はしご（超魔界村準拠: 上下で昇降、はしご上で射撃可、ジャンプで離脱）
    if (this.climbing) { this.updateClimb(dt, input, dir, up, down, ctrl); return; }
    if (ctrl && !this.crouch && ((up && ladderAt(map, this)) || (down && this.onGround && ladderBelow(map, this)))) { this.startClimb(map); return; }

    // しゃがみ
    const wantCrouch = ctrl && input.down('down') && this.onGround;
    if (wantCrouch && !this.crouch) { this.crouch = true; this.y += STAND_H - CROUCH_H; this.h = CROUCH_H; }
    else if (!wantCrouch && this.crouch) { this.crouch = false; this.y -= STAND_H - CROUCH_H; this.h = STAND_H; }

    if (this.onGround) {
      this.jumps = 0;
      this.vx = this.crouch ? 0 : dir * SPEED;
      if (dir) this.facing = dir;
      if (dir && !this.crouch) this.runT += dt; // 止まっても位相は保つ（キー連打でコマが 1 に戻り、片足で滑るように見えるのを防ぐ）
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
    if (this.vy < 0) this.platform = null;                 // ジャンプで足場から離れる
    carryByPlatform(this);                                 // 動く足場の移動量を先に加える
    const prevBottom = this.y + this.h;
    const res = moveBody(this, map, dt);
    if (res.hitTop) this.vy = 0;
    landOnPlatforms(this, this.world.platforms ?? [], prevBottom);
    if (this.onGround) triggerCrumbles(this, this.world.crumbles ?? []);
    applyFlow(this, map, dt);                              // 水流（地上）／風（空中）
    applyConveyor(this, map, dt);                          // ベルトコンベア（地上）
    if (this.onGround && this.hurtT > 0) this.vx = 0;

    // 危険タイル・落下
    const cx = Math.floor(this.centerX / TILE), fy = Math.floor((this.y + this.h - 2) / TILE), hy = Math.floor((this.y + this.h / 2) / TILE);
    if (this.world.cleared) return;
    if (this.y > map.pixelHeight + 8) this.die('fall');
    else if (map.isHazard(cx, fy) || map.isHazard(cx, hy)) this.die(map.at(cx, fy) === '^' ? 'spike' : 'bog');
    else if ((this.world.presses ?? []).some(q => q.hits(this))) this.die('press');
    else if (this.x < 0) this.x = 0;
  }

  // ---- はしご ----
  startClimb(map) {
    const l = ladderAt(map, this) ?? ladderBelow(map, this); if (!l) return;
    this.climbing = true; this.platform = null; this.vx = 0; this.vy = 0; this.jumps = 0; this.chargeT = 0;
    this.x = l.tx * TILE + TILE / 2 - this.w / 2; this.onGround = false;
    if (this.crouch) { this.crouch = false; this.y -= STAND_H - CROUCH_H; this.h = STAND_H; }
  }
  updateClimb(dt, input, dir, up, down, ctrl) {
    const map = this.world.level.map;
    if (dir) this.facing = dir;
    if (ctrl && input.hit('jump')) { this.climbing = false; this.vy = JUMP_V * 0.8; this.jumps = 1; this.vx = dir * SPEED; this.world.audio.sfx('jump'); return; }
    if (ctrl && input.hit('shoot')) this.shoot(false);
    const vy = up ? -LADDER_SPEED : down ? LADDER_SPEED : 0;
    this.runT = vy ? this.runT + dt : this.runT;
    this.y += vy * dt;
    const tx = Math.floor(this.centerX / TILE);
    if (vy < 0) {
      // 体の中心がはしごより上に出たら、はしごの最上段の上に立つ
      const topTy = Math.floor((this.y + this.h / 2) / TILE);
      if (map.at(tx, topTy) !== 'L') { let ty = topTy + 1; while (map.at(tx, ty) === 'L' && ty > 0 && map.at(tx, ty - 1) === 'L') ty--; this.y = ty * TILE - this.h; this.climbing = false; this.onGround = true; this.vy = 0; }
    } else if (vy > 0) {
      // 足元が地面に着いたら降りる。はしごの下端を抜けたら落下へ
      const footTy = Math.floor((this.y + this.h + 0.5) / TILE);
      if (map.isSolid(tx, footTy) || map.isOneWay(tx, footTy)) { this.y = footTy * TILE - this.h; this.climbing = false; this.onGround = true; this.vy = 0; }
      else if (map.at(tx, Math.floor((this.y + this.h - 1) / TILE)) !== 'L' && map.at(tx, Math.floor((this.y + this.h / 2) / TILE)) !== 'L') { this.climbing = false; }
    }
    if (this.world.cleared) return;
    if (this.y > map.pixelHeight + 8) this.die('fall');
  }

  shoot(charged) {
    const W = WEAPONS[this.weapon];
    const mine = this.world.shots.filter(s => !s.dead);
    if (!charged && mine.length >= W.max) return;
    const sy = this.crouch ? this.y + 6 : this.y + 12;
    const sx = this.centerX + this.facing * 10;
    if (charged) { // 溜め魔法（武器ごとに別: magic.js）
      castMagic(this.world, this); this.attackT = 0.3; this.world.audio.sfx('chargeshot'); this.world.particles.emit('sparkle', sx, sy, 14);
      this.world.toast?.(MAGIC[this.weapon]?.name ?? ''); return;
    }
    this.world.shots.push(new PlayerShot(this.world, this.weapon, sx, sy, this.facing, charged));
    this.attackT = 0.18;
    this.world.audio.sfx('shoot');
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
    w.audio.sfx('undress'); w.shake(4); w.fx?.hitStop();
    w.toast(t('変身が解けた…！'));
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
    this.x = x + 2; this.y = y + TILE - STAND_H; this.vx = 0; this.vy = 0; this.h = STAND_H; this.crouch = false;
    this.state = 'normal'; this.costume = 'dress'; this.invT = 2.0; this.hurtT = 0; this.jumps = 0; this.chargeT = 0; this.facing = 1; this.platform = null; this.climbing = false;
  }

  // 生成スプライトのフレーム名（idle/run1-4/jump/fall/attack/crouch/hurt/dead）
  frame() {
    if (this.state !== 'normal') return 'dead';
    if (this.climbing) return ['jump', 'fall'][Math.floor(this.runT * 6) % 2]; // 専用コマなし: 上昇／下降コマを交互に
    if (this.crouch) return 'crouch';
    if (this.hurtT > 0) return 'hurt';
    if (!this.onGround) return this.attackT > 0 ? 'attack' : (this.vy < 0 ? 'jump' : 'fall');
    // 走りながら撃っても足は止めない（超魔界村準拠）。連射すると attack コマに固定されて滑走に見えるため、立ち撃ちのみ attack
    if (this.vx !== 0) {
      const ph = Math.floor(this.runT * 10) % 4, rf = ['run1', 'run2', 'run3', 'run4'][ph];
      // 走り撃ち専用コマ（run1s / run3s: 足は接地コマと同じ、上半身だけ射撃）。通過コマは杖が描かれなかったので
      // 射撃中は接地コマ 2 枚を 12 tick ずつ交互に出す（足は止まらない）。素材が無い衣装は走りコマのまま（IMP-016）
      const sf = ph < 2 ? 'run1s' : 'run3s';
      return this.attackT > 0 && this.world.assets?.player?.[this.costume]?.[sf] ? sf : rf;
    }
    if (this.attackT > 0) return 'attack';
    return 'idle';
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
    let spr = sheet[fr] ?? sheet.idle; if (!spr) return;
    if (this.state === 'dying' && this.deathReason !== 'bog' && this.costume !== 'plain' && assets.player.nohat?.[fr]) spr = assets.player.nohat[fr]; // 帽子が飛ぶ間は帽子なし原画
    // スプライト箱の底辺中央を当たり判定の底辺中央に合わせる
    const px = Math.floor(this.centerX - spr.w / 2 - cam.x), py = Math.floor(this.y + this.h - spr.h - cam.y + dy);
    blit(g, spr, this.facing < 0, px, py);
    // 帽子は各コマの原画に描き込まれている（生成時に帽子ありで描かせ、脱落したコマだけ tools/derive_variants.py が合成）。
    // 実行時の重ね描きは二重になって浮くので行わない。死亡時のみ帽子なし原画に差し替えて帽子を飛ばす
    const hat = assets.hat; const hatDy = assets.hatTopOffset !== undefined ? -assets.hatTopOffset : -(hat.h - (hat.brim ?? 2)); // 帽子上端 = 髪上端 − hatTopOffset（元デザインの実測 3）。生成前の旧式: つばが髪に少しかかる
    if (this.state === 'dying' && this.deathReason !== 'bog' && this.costume !== 'plain') {
      // 帽子が飛ぶ
      const t = this.deathT; const hx = this.centerX - hat.w / 2 - cam.x + t * 20 * -this.facing, hy = py + (spr.headY ?? 0) + hatDy - (60 * t - 90 * t * t);
      blit(g, hat, this.facing < 0, hx, Math.min(hy, py + spr.h * 0.5));
    }
    if (this.broomT > 0) blit(g, assets.broom, this.facing < 0, this.centerX - assets.broom.w / 2 - cam.x, this.y + this.h - 4 - cam.y);
    if (this.chargeT > 0.9 && Math.floor(this.chargeT * 20) % 2) blit(g, assets.shots.charge, false, this.centerX + (this.facing > 0 ? 12 : -22) - cam.x, this.y + 8 - cam.y);
  }
}
