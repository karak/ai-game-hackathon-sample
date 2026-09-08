// 地形ギミック（docs/plan/05-systems.md 5.2）: 動く足場 M/V、浮島 @、崩れる足場 !、はしご L、水流 > <、風 } {
import { TILE, overlapsSolid } from '../physics.js';
import { HD_SCALE } from '../gfx/sprite.js';

export const FLOW_SPEED = 40;          // 水流・風で加わる速度（世界単位/s）
export const CRUMBLE_SHAKE_T = 0.6;    // 乗ってから落ちるまで
export const CRUMBLE_RESPAWN_T = 8.0;  // 復活まで
export const LADDER_SPEED = 50;        // はしごの昇降速度
export const CONVEYOR_SPEED = 30;      // ベルトコンベアで地上の体に加わる速度
export const PRESS = { period: 3.0, downT: 0.5, dropT: 0.15, riseT: 0.6, h: 3 }; // プレス機: 3 秒周期、0.15 秒で落ちて 0.5 秒下で留まり 0.6 秒で戻る。ブロック高 3 タイル
export const PLATFORM = {              // 記号ごとの既定
  platformH: { axis: 'x', amp: 48, period: 4, w: 3, oneWay: false },
  platformV: { axis: 'y', amp: 32, period: 4, w: 3, oneWay: false },
  island:    { axis: 'y', amp: 8,  period: 4, w: 2, oneWay: true },
  wheel:     { axis: 'circle', amp: 48, period: 8, w: 2, oneWay: true, count: 4 }, // 観覧車: 半径 48、4 枚、8 秒で 1 周
};

// 往復する足場。update で 1 フレームの移動量 dx/dy を記録し、乗っている物体が同じだけ動く
export class MovingPlatform {
  constructor(world, kind, tx, ty) {
    const d = PLATFORM[kind]; this.world = world; this.kind = kind;
    this.w = d.w * TILE; this.h = TILE; this.axis = d.axis; this.amp = d.amp; this.period = d.period; this.oneWay = d.oneWay;
    // マーカー位置を往復の中心にする（足場の上面 = マーカータイルの上面）
    this.cx = tx * TILE + this.w / 2; this.cy = ty * TILE + this.h / 2; this.t = 0; this.dx = 0; this.dy = 0; this.dead = false;
    this.x = this.cx - this.w / 2; this.y = this.cy - this.h / 2;
  }
  get top() { return this.y; }
  positionAt(t) {
    if (this.axis === 'circle') { // 円運動（回転足場）。phase で同じ中心の他の足場と位相をずらす
      const a = t / this.period * Math.PI * 2 + (this.phase ?? 0);
      return [this.cx + Math.cos(a) * this.amp - this.w / 2, this.cy + Math.sin(a) * this.amp - this.h / 2];
    }
    const off = Math.sin(t / this.period * Math.PI * 2) * this.amp;
    return this.axis === 'x' ? [this.cx - this.w / 2 + off, this.cy - this.h / 2] : [this.cx - this.w / 2, this.cy - this.h / 2 + off];
  }
  update(dt) {
    this.t += dt; const [nx, ny] = this.positionAt(this.t);
    this.dx = nx - this.x; this.dy = ny - this.y; this.x = nx; this.y = ny;
  }
  // body が乗り続けているか（x が重なり、足が上面に接している）
  carries(body) { return body.x + body.w > this.x && body.x < this.x + this.w && Math.abs(body.y + body.h - this.y) < 1.5; }
  // 落下中の body が今フレーム上面を通過したら着地させる。prevBottom は移動前の足の高さ
  tryLand(body, prevBottom) {
    if (body.vy < 0) return false;
    if (body.x + body.w <= this.x || body.x >= this.x + this.w) return false;
    const bottom = body.y + body.h;
    if (prevBottom <= this.y - this.dy + 0.01 + Math.max(0, -this.dy) && bottom >= this.y - 0.01) {
      body.y = this.y - body.h; body.vy = 0; body.onGround = true; body.platform = this; return true;
    }
    return false;
  }
}

// 乗り物処理: 移動前に呼ぶ（足場の移動量を body に加える）。乗っていなければ platform を外す
export function carryByPlatform(body) {
  const p = body.platform; if (!p) return;
  if (p.dead || !p.carries(body)) { body.platform = null; return; }
  body.x += p.dx; body.y += p.dy; body.onGround = true;
}
// 移動後に呼ぶ: どれかの足場に着地したか
export function landOnPlatforms(body, platforms, prevBottom) {
  if (body.platform && body.platform.carries(body)) { body.y = body.platform.y - body.h; body.vy = 0; body.onGround = true; return body.platform; } // 上面に吸着（重力の蓄積を消す）
  body.platform = null;
  for (const p of platforms) if (!p.dead && p.tryLand(body, prevBottom)) return p;
  return null;
}

// 観覧車（マーカー O）: 同じ中心に count 枚の足場を等間隔の位相で置く
export function makeWheel(world, tx, ty) {
  const d = PLATFORM.wheel, out = [];
  for (let i = 0; i < d.count; i++) { const p = new MovingPlatform(world, 'wheel', tx, ty); p.phase = i / d.count * Math.PI * 2; const [x, y] = p.positionAt(0); p.x = x; p.y = y; out.push(p); }
  return out;
}

// プレス機（マーカー %）: マーカーの位置を上端として天井から吊られ、周期的に床まで落ちる。降下中・停止中に触れると即死
export class PressMachine {
  constructor(world, tx, ty) {
    this.world = world; this.tx = tx; this.ty = ty; this.w = TILE; this.dead = false;
    const spr = world.assets?.generated?.tiles?.press; // 生成絵があれば判定の高さ・幅を絵に合わせる（既定は 3 タイル）
    this.hBlock = spr ? Math.max(TILE, Math.round(spr.r.height / HD_SCALE)) : PRESS.h * TILE; if (spr) this.w = Math.max(TILE, Math.round(spr.r.width / HD_SCALE));
    const map = world.level.map; let fy = ty + 1; while (fy < map.height && !map.isSolid(tx, fy)) fy++; // 直下の床
    this.topY = ty * TILE; this.floorY = fy * TILE; this.travel = Math.max(0, this.floorY - this.topY - this.hBlock);
    this.t = (tx * 0.7) % PRESS.period; this.y = this.topY; // 位相は列でずらす
  }
  get phase() { const t = this.t % PRESS.period; if (t < PRESS.dropT) return 'drop'; if (t < PRESS.dropT + PRESS.downT) return 'down'; if (t < PRESS.dropT + PRESS.downT + PRESS.riseT) return 'rise'; return 'wait'; }
  get x() { return this.tx * TILE + TILE / 2 - this.w / 2; } get h() { return this.hBlock; } // 判定はタイル中央揃え
  get crushing() { const p = this.phase; return p === 'drop' || p === 'down'; }
  update(dt) {
    this.t += dt; const t = this.t % PRESS.period, ph = this.phase;
    let k = 0;
    if (ph === 'drop') k = t / PRESS.dropT; else if (ph === 'down') k = 1; else if (ph === 'rise') k = 1 - (t - PRESS.dropT - PRESS.downT) / PRESS.riseT;
    const prev = this.y; this.y = this.topY + this.travel * k;
    if (ph === 'down' && prev < this.y) { this.world.shake?.(3); this.world.audio?.sfx('hit'); }
  }
  // 体と重なっているか（降下・停止中のみ致死）
  hits(body) { return this.crushing && body.x < this.x + this.w && body.x + body.w > this.x && body.y < this.y + this.hBlock && body.y + body.h > this.y; }
}

// ベルトコンベア: 足元のタイルが ')' なら右、'(' なら左へ CONVEYOR_SPEED。地上のみ
export function conveyorAt(map, body) {
  const x0 = Math.floor(body.x / TILE), x1 = Math.floor((body.x + body.w - 0.001) / TILE), ty = Math.floor((body.y + body.h + 0.5) / TILE);
  for (let tx = x0; tx <= x1; tx++) { const c = map.at(tx, ty); if (c === ')') return 1; if (c === '(') return -1; }
  return 0;
}
export function applyConveyor(body, map, dt) {
  if (!body.onGround) return 0;
  const dir = conveyorAt(map, body); if (!dir) return 0;
  const dx = dir * CONVEYOR_SPEED * dt;
  if (!overlapsSolid(map, body.x + dx, body.y, body.w, body.h)) { body.x += dx; return dx; }
  return 0;
}

// 崩れる足場（タイル '!'）。乗ると揺れ、CRUMBLE_SHAKE_T 後に消え、CRUMBLE_RESPAWN_T 後に戻る
export class CrumbleTile {
  constructor(world, tx, ty) { this.world = world; this.tx = tx; this.ty = ty; this.state = 'solid'; this.t = 0; this.dead = false; }
  get x() { return this.tx * TILE; } get y() { return this.ty * TILE; }
  trigger() { if (this.state === 'solid') { this.state = 'shaking'; this.t = 0; } }
  // 描画用の揺れオフセット（世界単位）
  get shake() { return this.state === 'shaking' ? Math.sin(this.t * 60) * 1 : 0; }
  update(dt) {
    if (this.state === 'solid') return;
    this.t += dt;
    const map = this.world.level.map;
    if (this.state === 'shaking' && this.t >= CRUMBLE_SHAKE_T) {
      this.state = 'gone'; this.t = 0; map.set(this.tx, this.ty, '.');
      this.world.particles?.emit('dirt', this.x + TILE / 2, this.y + TILE / 2, 8); this.world.audio?.sfx('tick');
    } else if (this.state === 'gone' && this.t >= CRUMBLE_RESPAWN_T) {
      // 誰かが重なっていれば戻さない（めり込み防止）
      const p = this.world.player; const box = { x: this.x, y: this.y, w: TILE, h: TILE };
      if (p && p.x < box.x + box.w && p.x + p.w > box.x && p.y < box.y + box.h && p.y + p.h > box.y) return;
      this.state = 'solid'; this.t = 0; map.set(this.tx, this.ty, '!');
    }
  }
}
// body の足元にある崩れる足場を起動する
export function triggerCrumbles(body, crumbles) {
  const map = body.world.level.map;
  const x0 = Math.floor(body.x / TILE), x1 = Math.floor((body.x + body.w - 0.001) / TILE), ty = Math.floor((body.y + body.h + 0.5) / TILE);
  for (let tx = x0; tx <= x1; tx++) if (map.at(tx, ty) === '!') for (const c of crumbles) if (c.tx === tx && c.ty === ty) c.trigger();
}

// 水流（地上のみ）・風（空中のみ）。体の中心タイルの記号で判定し、壁にぶつからない範囲で x を押す
export const FLOW_TILES = { '>': ['water', 1], '<': ['water', -1], '}': ['wind', 1], '{': ['wind', -1] };
export function flowAt(map, body) {
  const f = FLOW_TILES[map.at(Math.floor((body.x + body.w / 2) / TILE), Math.floor((body.y + body.h / 2) / TILE))];
  return f ? { kind: f[0], dir: f[1] } : null;
}
export function applyFlow(body, map, dt) {
  const f = flowAt(map, body); if (!f) return 0;
  if (f.kind === 'water' && !body.onGround) return 0;
  if (f.kind === 'wind' && body.onGround) return 0;
  const dx = f.dir * FLOW_SPEED * dt;
  if (!overlapsSolid(map, body.x + dx, body.y, body.w, body.h)) { body.x += dx; return dx; }
  return 0;
}

// はしご
export const isLadder = (map, tx, ty) => map.at(tx, ty) === 'L';
// body の中心列にはしごがあるか（体の中心か足元）
export function ladderAt(map, body) {
  const tx = Math.floor((body.x + body.w / 2) / TILE);
  const tyMid = Math.floor((body.y + body.h / 2) / TILE), tyFoot = Math.floor((body.y + body.h - 1) / TILE);
  if (isLadder(map, tx, tyMid)) return { tx, ty: tyMid };
  if (isLadder(map, tx, tyFoot)) return { tx, ty: tyFoot };
  return null;
}
// 足元のすぐ下がはしごの最上段か（立っている状態から下りる）
export function ladderBelow(map, body) {
  const tx = Math.floor((body.x + body.w / 2) / TILE), ty = Math.floor((body.y + body.h + 0.5) / TILE);
  return isLadder(map, tx, ty) ? { tx, ty } : null;
}
