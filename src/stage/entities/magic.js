// 溜め魔法（フルブルーム時に 0.9 秒長押し → 離す）。武器ごとに別の魔法（docs/plan/05-systems.md 5.1）
//  star   → 流星群: 画面上端から 8 発が斜めに降る（各 2 ダメージ、貫通）
//  knife  → 分身: 主人公の前後に 2 体の影が 3 秒間ナイフを連射（0.25 秒毎）
//  heart  → 大爆発: 半径 40 の爆発。範囲内の敵に 3 ダメージ（1 回）
//  candle → 火柱: 前方に 3 本の火柱（高さ 3 タイル、1.5 秒、0.35 秒毎に 1 ダメージ）
//
// 強化魔法（SUPER、2 段階目。CHARGE_T 0.9 秒で L1、SUPER_T 1.8 秒まで溜めると L2。超魔界村の「黄金の鎧＋ブレスレット」に相当）
//  star   → 星屑の葬列: 流星 14 発（各 3、貫通）が着弾ごとに小爆発（半径 14、2）。最後に前方へ巨大流星 → 半径 34 の衝撃波（5）
//  knife  → 鏡像の舞踏会: 鏡像 4 体が主人公を中心に半径 28 で周回し、0.15 秒毎に外向きへナイフを放つ（4 秒）
//  heart  → 心臓の花園: 前方の地面に心臓の花を 3 つ植え、0.5 秒後に順に破裂（半径 34、4）。血の花びらが舞う
//  candle → 蝋の聖歌隊: 火柱 5 本（高さ 4 タイル、2.5 秒）。柱は触れた敵弾を蝋で包んで焼き落とす
import { TILE, aabb } from '../physics.js';
import { PlayerShot, Fire } from './projectiles.js';
import { HD_SCALE } from '../viewport.js';

const CUTIN = { star: 'stardust', knife: 'mirror', heart: 'heart', candle: 'wax' }; // 武器 → カットイン画
export const SUPER_COLOR = { star: '#cbaaf5', knife: '#d8e4ff', heart: '#ff8fc8', candle: '#ffd27f' };
// スプライトを世界座標に 1:1（1 セル = 1 画面 px）で描く。spr は {r,w,h}
export const drawSpr = (g, spr, cx, cy, alpha = 1, angle = 0) => {
  if (!spr) return;
  const w = spr.w ?? spr.r.width / HD_SCALE, h = spr.h ?? spr.r.height / HD_SCALE;
  g.save(); g.globalAlpha = alpha; g.translate(cx, cy); if (angle) g.rotate(angle);
  g.drawImage(spr.r, -w / 2, -h / 2, w, h); g.restore();
};

export const MAGIC = {
  star:   { name: '流星群',   count: 8, dmg: 2, spread: 120, interval: 0.12, vy: 260, vx: 90 },
  knife:  { name: '影の連射', clones: 2, duration: 3.0, interval: 0.25, offset: 24 },
  heart:  { name: '大爆発',   radius: 40, dmg: 3, life: 0.5 },
  candle: { name: '火柱',     count: 3, gap: 32, height: 3 * TILE, life: 1.5 },
};

// 強化魔法（L2）。溜めを SUPER_T まで伸ばしたときだけ出る
export const SUPER = {
  star:   { name: '星屑の葬列',   count: 14, dmg: 3, spread: 200, interval: 0.07, vy: 300, vx: 110, burst: 14, burstDmg: 2, finale: { radius: 34, dmg: 5, life: 0.7 } },
  knife:  { name: '鏡像の舞踏会', clones: 4, duration: 4.0, interval: 0.15, radius: 28, omega: 2.4 },
  heart:  { name: '心臓の花園',   seeds: 3, gap: 34, plant: 0.3, delay: 0.5, radius: 34, dmg: 4, life: 0.6 },
  candle: { name: '蝋の聖歌隊',   count: 5, gap: 26, height: 4 * TILE, life: 2.5, wax: true },
};
export const CHARGE_T = 0.9;   // ここまで溜めると L1 の溜め魔法
export const SUPER_T = 1.8;    // ここまで溜めると L2（強化魔法）。フルブルームドレス限定
// トーストに出す表示名。level 2 なら強化魔法の名前
export const magicName = (kind, level = 1) => (level >= 2 ? SUPER : MAGIC)[kind]?.name ?? '';

// level: 1 = 溜め魔法、2 = 強化魔法。戻り値は武器の種類
export function castMagic(world, player, level = 1) {
  const kind = player.weapon; const cx = player.centerX, cy = player.y + player.h / 2, dir = player.facing;
  if (level >= 2) {
    const S = SUPER[kind];
    switch (kind) {
      case 'star': world.effects.push(new MeteorCaster(world, cx, dir, 2)); break;
      case 'knife': for (let i = 0; i < S.clones; i++) {
        const angle = i * 2 * Math.PI / S.clones;
        world.effects.push(new MirrorFrame(world, cx + Math.cos(angle) * S.radius, player.y + player.h, i * 0.06)); // 鏡が割れて鏡像が出る
        world.effects.push(new ShadowClone(world, player, 1, { orbit: true, angle, radius: S.radius, omega: S.omega, interval: S.interval, duration: S.duration, shard: i }));
      } break;
      case 'heart': world.effects.push(new HeartGarden(world, cx, player.y + player.h, dir)); break;
      case 'candle': for (let i = 0; i < S.count; i++) world.fires.push(new FirePillar(world, cx + dir * (20 + i * S.gap), player.y + player.h, S)); break;
    }
    // 派手さ: 画面揺れ＋武器色フラッシュ＋短いスロー＋カットイン。星は空を渡る葬列も出す
    world.shake?.(9);
    if (world.fx?.superCast) world.fx.superCast(SUPER_COLOR[kind]); else world.fx?.flash?.(0.25, SUPER_COLOR[kind], 0.5);
    world.screenFx?.push(new CutIn(kind));
    if (kind === 'star') world.effects.push(new Cortege(world, cx, dir));
    return kind;
  }
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
  // level 2（星屑の葬列）は数と威力が増え、着弾ごとに小爆発し、最後に巨大流星（finale）を落とす
  constructor(world, cx, dir, level = 1) { this.world = world; this.cx = cx; this.dir = dir; this.t = 0; this.n = 0; this.dead = false; this.level = level; this.finaleDone = false; }
  update(dt) {
    const M = this.level >= 2 ? SUPER.star : MAGIC.star; this.t += dt;
    while (this.n < M.count && this.t >= this.n * M.interval) {
      const spread = (this.n / (M.count - 1) - 0.5) * M.spread;                 // 前方 -60〜+60 に散らす
      const x = this.cx + this.dir * 40 + spread, y = Math.max(0, this.world.cam.y ?? 0) - 12;
      this.world.shots.push(new Meteor(this.world, x, y, this.dir * M.vx, M.vy, M.dmg, this.level >= 2 ? { burst: M.burst, burstDmg: M.burstDmg } : {})); this.n++;
    }
    if (this.n >= M.count && this.level >= 2 && !this.finaleDone) { // 締めの巨大流星（主人公の正面へ）
      const f = SUPER.star.finale;
      this.world.shots.push(new Meteor(this.world, this.cx + this.dir * 40, Math.max(0, this.world.cam.y ?? 0) - 24, this.dir * 40, SUPER.star.vy * 0.8, f.dmg, { burst: f.radius, burstDmg: f.dmg, big: true }));
      this.finaleDone = true;
    }
    if (this.n >= M.count && (this.level < 2 || this.finaleDone)) this.dead = true;
  }
}
export class Meteor {
  // opts.burst: 着弾で半径この大きさの衝撃波を出す（星屑の葬列）。opts.big: 締めの巨大流星
  constructor(world, x, y, vx, vy, dmg, opts = {}) { this.world = world; this.w = opts.big ? 14 : 8; this.h = this.w; this.x = x - this.w / 2; this.y = y; this.vx = vx; this.vy = vy; this.dmg = dmg; this.t = 0; this.dead = false; this.pierce = true; this.hitIds = new Set(); this.type = 'meteor'; this.burst = opts.burst ?? 0; this.burstDmg = opts.burstDmg ?? 0; this.big = !!opts.big; }
  update(dt) {
    this.t += dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.random() < 0.6) this.world.particles.emit('sparkle', this.x + 4, this.y + 4, 1);
    const map = this.world.level.map, tx = Math.floor((this.x + 4) / TILE), ty = Math.floor((this.y + 8) / TILE);
    if (map.isSolid(tx, ty) || this.y > map.pixelHeight) {
      this.dead = true; this.world.particles.emit('sparkle', this.x + 4, this.y + 4, 8); this.world.particles.emit('fire', this.x + 4, this.y + 6, 4);
      if (this.burst) { // 星屑の葬列: 着弾で小爆発。巨大流星はさらに大きく、画面も揺れる
        this.world.effects.push(new HeartBurst(this.world, this.x + this.w / 2, this.y + this.h / 2, { radius: this.burst, dmg: this.burstDmg, life: this.big ? 0.7 : 0.3, color: '#cbaaf5', art: 'starburst' }));
        if (this.big) this.world.shake?.(6);
      }
    }
  }
  onHit() { this.world.particles.emit('sparkle', this.x + 4, this.y + 4, 4); }
}

// ---- 影の分身: 主人公の前後に浮かび、ナイフを連射する ----
export class ShadowClone {
  // opts.orbit: 鏡像の舞踏会（L2）。主人公を中心に半径 radius で角速度 omega で周り、外向きにナイフを放つ
  constructor(world, player, side, opts = {}) {
    this.world = world; this.player = player; this.side = side; this.t = 0; this.shotT = 0; this.dead = false;
    this.orbit = !!opts.orbit; this.angle = opts.angle ?? 0; this.radius = opts.radius ?? 0; this.omega = opts.omega ?? 0; this.shard = opts.shard ?? 0;
    this.interval = opts.interval ?? MAGIC.knife.interval; this.duration = opts.duration ?? MAGIC.knife.duration;
  }
  // 周回中の角度（時間で進む）
  get theta() { return this.angle + this.omega * this.t; }
  get x() { return this.orbit ? this.player.centerX + Math.cos(this.theta) * this.radius - this.player.w / 2 : this.player.centerX + this.side * MAGIC.knife.offset - this.player.w / 2; }
  get y() { return this.orbit ? this.player.y - 6 + Math.sin(this.theta) * this.radius * 0.55 : this.player.y - 6 + Math.sin(this.t * 6) * 2; }
  update(dt) {
    this.t += dt; this.shotT += dt;
    if (this.shotT >= this.interval) { // 周回中は外向き（円の接線ではなく中心から見た向き）に撃つ
      this.shotT -= this.interval;
      const dir = this.orbit ? (Math.cos(this.theta) >= 0 ? 1 : -1) : this.player.facing;
      this.world.shots.push(new PlayerShot(this.world, 'knife', this.x + this.player.w / 2 + dir * 10, this.y + 12, dir, false));
      if (this.orbit) this.world.particles.emit('sparkle', this.x + this.player.w / 2, this.y + 12, 2);
    }
    if (this.t >= this.duration) this.dead = true;
  }
}

// ---- 大爆発: 拡がる輪。範囲内の敵に一度だけダメージ ----
export class HeartBurst {
  // opts: { radius, dmg, life, color }。省略時は L1 の大爆発（MAGIC.heart）。心臓の花園と流星の着弾もこれを使う
  constructor(world, cx, cy, opts = {}) {
    this.world = world; this.cx = cx; this.cy = cy; this.t = 0; this.dead = false; this.hit = new Set();
    this.maxR = opts.radius ?? MAGIC.heart.radius; this.dmg = opts.dmg ?? MAGIC.heart.dmg; this.life = opts.life ?? MAGIC.heart.life; this.color = opts.color ?? '#ff8fc8';
    this.art = opts.art ?? null; // 'starburst'（星の衝撃波）| 'petals'（血の花びら）| null（従来の burst 画）
    world.shake?.(5); world.particles.emit('sparkle', cx, cy, 30); world.particles.emit('blood', cx, cy, 10);
  }
  get radius() { return this.maxR * Math.min(1, this.t / (this.life * 0.6)); }
  update(dt) {
    this.t += dt; const r = this.radius;
    for (const e of this.world.enemies) {
      if (e.dead || e.hp === undefined || this.hit.has(e.id) || e.state === 'enter') continue;
      if (Math.hypot(e.cx - this.cx, e.cy - this.cy) <= r + Math.max(e.w, e.h) / 2) { this.hit.add(e.id); e.hurt(this.dmg, { x: this.cx, y: this.cy, w: 0, h: 0 }); }
    }
    for (const b of this.world.boxes) if (!b.dead && Math.hypot(b.x + b.w / 2 - this.cx, b.y + b.h / 2 - this.cy) <= r) b.hurt();
    if (this.t >= this.life) this.dead = true;
  }
}

// ---- 心臓の花園（heart の強化魔法）: 前方の地面に心臓の花を順に植え、少し遅れて破裂させる ----
export class HeartGarden {
  constructor(world, cx, groundY, dir) {
    this.world = world; this.dir = dir; this.t = 0; this.dead = false; this.n = 0;
    const S = SUPER.heart;
    // 種の位置（地面の上）。植えた時刻を持ち、delay 後に破裂する
    this.seeds = Array.from({ length: S.seeds }, (_, i) => ({ x: cx + dir * (26 + i * S.gap), y: groundY - 6, plantAt: i * S.plant, burst: false }));
    world.particles.emit('blood', cx + dir * 12, groundY - 4, 8);
  }
  update(dt) {
    const S = SUPER.heart; this.t += dt;
    for (const s of this.seeds) {
      if (s.burst || this.t < s.plantAt + S.delay) continue;
      s.burst = true; this.n++;
      this.world.effects.push(new HeartBurst(this.world, s.x, s.y, { radius: S.radius, dmg: S.dmg, life: S.life, color: '#ff6a6a', art: 'petals' }));
      this.world.particles.emit('blood', s.x, s.y, 18, { power: 1.4 }); // 血の花びら
    }
    if (this.n >= this.seeds.length) this.dead = true;
  }
}

// ---- 火柱: 背の高い炎（fires に入り、既存の炎 vs 敵 判定を使う） ----
export class FirePillar extends Fire {
  // opts: { height, life, wax }。省略時は L1（MAGIC.candle）。wax = true は蝋の聖歌隊（L2）で、触れた敵弾を焼き落とす
  constructor(world, x, groundY, opts = {}) {
    super(world, x - 4, groundY - 8);
    const H = opts.height ?? MAGIC.candle.height; this.w = 10; this.h = H; this.y = this.y + 8 - H; this.life = opts.life ?? MAGIC.candle.life; this.pillar = true; this.wax = !!opts.wax;
    world.particles.emit('fire', this.x + 5, this.y + H - 4, 10);
  }
  update(dt) {
    this.t += dt; if (this.t > this.life) this.dead = true;
    if (Math.random() < 0.6) this.world.particles.emit('fire', this.x + 2 + Math.random() * 6, this.y + Math.random() * this.h, 1);
    if (this.wax) for (const s of this.world.enemyShots) { // 蝋が敵弾を包んで落とす（ボスの弾も対象。ブーメランは戻るので除く）
      if (s.dead || s.def?.boomerang || !aabb(this, s)) continue;
      s.dead = true; this.world.particles.emit('fire', s.x + s.w / 2, s.y + s.h / 2, 6); this.world.particles.emit('dust', s.x + s.w / 2, s.y + s.h / 2, 3);
    }
  }
}

// ---- 鏡の枠（knife の強化魔法）: 鏡像が出てくる鏡。0.25 秒で割れて破片が飛ぶ ----
export class MirrorFrame {
  constructor(world, cx, groundY, delay = 0) { this.world = world; this.cx = cx; this.groundY = groundY; this.t = -delay; this.dead = false; this.broke = false; }
  update(dt) {
    this.t += dt;
    if (!this.broke && this.t >= 0.25) {
      this.broke = true; this.world.particles.emit('sparkle', this.cx, this.groundY - 24, 14); this.world.audio?.sfx?.('hit');
      for (let i = 0; i < 4; i++) this.world.effects.push(new Shard(this.world, this.cx, this.groundY - 26, i)); // 破片が四方へ
    }
    if (this.t > 0.75) this.dead = true;
  }
}

// ---- 星屑の葬列（star の強化魔法）: 小さな幽霊 3 体が星の棺を担いで画面を渡る ----
export class Cortege {
  constructor(world, cx, dir) { this.world = world; this.dir = dir; this.t = 0; this.dead = false; this.x = cx - dir * 90; this.y = (world.cam?.y ?? 0) + 42; }
  update(dt) {
    this.t += dt; this.x += this.dir * 46 * dt; this.y += Math.sin(this.t * 3) * 6 * dt;
    if (Math.random() < 0.5) this.world.particles.emit('sparkle', this.x, this.y + 10, 1);
    if (this.t > 3.2) this.dead = true;
  }
}

// ---- カットイン（画面固定）: 斜めの帯とともに武器ごとの一枚絵が滑り込み、0.5 秒とどまって抜ける ----
export const CUTIN_IN = 0.16, CUTIN_HOLD = 0.5, CUTIN_OUT = 0.18;
export const CUTIN_SCALE = 2; // カットインの表示倍率（整数倍のみ）
export class CutIn {
  constructor(kind) { this.kind = kind; this.name = CUTIN[kind]; this.t = 0; this.dead = false; }
  get phase() { return this.t < CUTIN_IN ? 'in' : this.t < CUTIN_IN + CUTIN_HOLD ? 'hold' : 'out'; }
  // 0（画面外）→ 1（定位置）
  get slide() {
    if (this.phase === 'in') { const k = this.t / CUTIN_IN; return 1 - (1 - k) * (1 - k); }
    if (this.phase === 'hold') return 1;
    return Math.max(0, 1 - (this.t - CUTIN_IN - CUTIN_HOLD) / CUTIN_OUT);
  }
  update(dt) { this.t += dt; if (this.t > CUTIN_IN + CUTIN_HOLD + CUTIN_OUT) this.dead = true; }
}

// ---- 鏡の破片: 割れた鏡から飛び散り、回りながら落ちて消える（knife の強化魔法の演出） ----
export class Shard {
  constructor(world, x, y, i) {
    this.world = world; this.x = x; this.y = y; this.i = i; this.t = 0; this.dead = false;
    const th = (-0.25 - i * 0.17) * Math.PI;                 // 上方向に扇状
    this.vx = Math.cos(th) * (60 + i * 12) * (i % 2 ? -1 : 1); this.vy = Math.sin(th) * 90;
    this.spin = (i % 2 ? -1 : 1) * (3 + i);
  }
  update(dt) { this.t += dt; this.vy += 320 * dt; this.x += this.vx * dt; this.y += this.vy * dt; if (this.t > 0.7) this.dead = true; }
}
