// 地形ギミック（docs/plan/05-systems.md 5.2）: 動く足場 M/V、浮島 @、崩れる足場 !、はしご L、水流 > <、風 } {
import { TILE, overlapsSolid } from '../physics.js';

export const FLOW_SPEED = 40;          // 水流・風で加わる速度（世界単位/s）
export const CRUMBLE_SHAKE_T = 0.6;    // 乗ってから落ちるまで
export const CRUMBLE_RESPAWN_T = 8.0;  // 復活まで
export const LADDER_SPEED = 50;        // はしごの昇降速度
export const PLATFORM = {              // 記号ごとの既定
  platformH: { axis: 'x', amp: 48, period: 4, w: 3, oneWay: false },
  platformV: { axis: 'y', amp: 32, period: 4, w: 3, oneWay: false },
  island:    { axis: 'y', amp: 8,  period: 4, w: 2, oneWay: true },
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
