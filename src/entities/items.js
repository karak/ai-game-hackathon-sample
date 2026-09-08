import { TILE, moveBody } from '../physics.js';
import { WEAPON_ORDER } from './projectiles.js';

// 宝箱（プレゼント箱）: 撃つと開いてアイテムが飛び出す
export class TreasureBox {
  constructor(world, x, y) {
    this.world = world; this.x = x + 0; this.y = y; this.w = 16; this.h = 12; this.dead = false;
    this.opened = false; this.hp = 1; this.t = 0;
    // 足場の上に落とす
    const map = world.level.map; let ty = Math.floor((y + 15) / TILE);
    for (let i = 0; i < 6 && !map.isSolid(Math.floor((x + 8) / TILE), ty) && !map.isOneWay(Math.floor((x + 8) / TILE), ty); i++) ty++;
    this.y = ty * TILE - this.h;
  }
  hurt() {
    if (this.opened) return;
    this.opened = true; this.dead = true;
    this.world.audio.sfx('box');
    this.world.particles.emit('sparkle', this.x + 8, this.y + 6, 12);
    this.world.items.push(new Item(this.world, chooseContents(this.world), this.x + 2, this.y - 4));
  }
  update(dt) { this.t += dt; }
  draw(g, cam, sheet) {
    const bob = Math.floor(this.t * 3) % 2;
    g.drawImage(sheet.box.r, Math.floor(this.x - cam.x), Math.floor(this.y - cam.y - 4 + bob));
  }
}

function chooseContents(world) {
  const p = world.player;
  world.boxCount = (world.boxCount ?? 0) + 1;
  if (p.costume === 'plain') return 'dress';
  if (p.costume === 'dress' && world.boxCount % 3 === 0) return 'golddress';
  const r = Math.random();
  if (r < 0.08) return 'oneup';
  if (r < 0.16) return 'potion';
  const others = WEAPON_ORDER.filter(w => w !== p.weapon);
  return others[Math.floor(Math.random() * others.length)];
}

const ITEM_SIZE = { dress: [14, 12], golddress: [14, 12], oneup: [12, 8], candy: [9, 7], potion: [7, 7], star: [8, 7], knife: [12, 3], heart: [8, 6], candle: [5, 9] };

export class Item {
  constructor(world, kind, x, y) {
    this.world = world; this.kind = kind; [this.w, this.h] = ITEM_SIZE[kind] ?? [8, 8];
    this.x = x; this.y = y; this.vx = 0; this.vy = -150; this.t = 0; this.life = 9; this.dead = false;
  }
  update(dt) {
    this.t += dt; if (this.t > this.life) this.dead = true;
    this.vy += 430 * dt;
    moveBody(this, this.world.level.map, dt);
    if (this.y > this.world.level.map.pixelHeight) this.dead = true;
  }
  pickup(player) {
    const w = this.world; this.dead = true;
    switch (this.kind) {
      case 'dress': player.setCostume('dress'); w.audio.sfx('dress'); w.addScore(500); w.toast('魔法のドレス！'); break;
      case 'golddress': player.setCostume('gold'); w.audio.sfx('dress'); w.addScore(1000); w.toast('フルブルームドレス！ためうちが使える'); break;
      case 'oneup': w.lives++; w.audio.sfx('dress'); w.toast('リリカ人形 ＋１'); break;
      case 'potion': w.addScore(300); w.audio.sfx('pickup'); w.toast('いちごポーション'); break;
      case 'candy': w.addScore(200); w.audio.sfx('pickup'); break;
      default: player.weapon = this.kind; w.audio.sfx('pickup'); w.addScore(200); w.toast(`${w.weaponName(this.kind)}を手に入れた`); break;
    }
    w.particles.emit('sparkle', this.x + this.w / 2, this.y, 10);
  }
  draw(g, cam, sheet) {
    if (this.t > this.life - 2.5 && Math.floor(this.t * 10) % 2) return;
    const spr = sheet[this.kind]; if (!spr) return;
    g.drawImage(spr.r, Math.floor(this.x + this.w / 2 - spr.w / 2 - cam.x), Math.floor(this.y + this.h - spr.h - cam.y));
  }
}

// ステージに配置された固定アイテム(h)
export class FloatingItem {
  constructor(world, kind, x, y) {
    this.world = world; this.kind = kind; [this.w, this.h] = ITEM_SIZE[kind] ?? [8, 8];
    this.x = x + 4; this.y = y + 4; this.t = Math.random() * 6; this.dead = false;
  }
  update(dt) { this.t += dt; }
  pickup(player) { Item.prototype.pickup.call(this, player); }
  draw(g, cam, sheet) {
    const spr = sheet[this.kind]; if (!spr) return; const bob = Math.sin(this.t * 3) * 2;
    g.drawImage(spr.r, Math.floor(this.x - cam.x), Math.floor(this.y + bob - cam.y));
  }
}
