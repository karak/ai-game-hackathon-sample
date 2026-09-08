// タイルベース物理。gravity は呼び出し側が vy に加える（超魔界村的な固定軌道ジャンプのため）。
export const TILE = 16;

const SOLID = new Set(['#', 'D', 'S', 'R', 'W', 'K', 'Q', '!', ')', '(']); // '!' は崩れる足場（消えると '.' に書き換わる）。')' '(' はベルトコンベア（右／左）
const ONEWAY = new Set(['=', '-']);

export class TileMap {
  constructor(rows) {
    this.rows = rows.map(r => r.split(''));
    this.height = rows.length;
    this.width = rows[0]?.length ?? 0;
  }
  at(tx, ty) {
    if (ty < 0 || ty >= this.height) return '.';
    if (tx < 0 || tx >= this.width) return '#';
    return this.rows[ty][tx];
  }
  set(tx, ty, ch) {
    if (ty < 0 || ty >= this.height || tx < 0 || tx >= this.width) return;
    this.rows[ty][tx] = ch;
  }
  isSolid(tx, ty) {
    return SOLID.has(this.at(tx, ty));
  }
  isOneWay(tx, ty) {
    const c = this.at(tx, ty);
    // はしごの最上段は上から乗れる（超魔界村準拠: はしごの頂上で立てる）
    return ONEWAY.has(c) || (c === 'L' && this.at(tx, ty - 1) !== 'L');
  }
  isHazard(tx, ty) {
    const c = this.at(tx, ty);
    return c === '^' || c === '~';
  }
  get pixelWidth() { return this.width * TILE; }
  get pixelHeight() { return this.height * TILE; }
}

export function overlapsSolid(map, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (map.isSolid(tx, ty)) return true;
  return false;
}

// 足元が one-way platform の上面と一致するか（下降中のみ有効）
function oneWayLanding(map, x, prevBottom, newBottom, w) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const rowStart = Math.floor(prevBottom / TILE), rowEnd = Math.floor(newBottom / TILE);
  for (let ty = rowStart; ty <= rowEnd; ty++) {
    const top = ty * TILE;
    if (top < prevBottom - 0.001 || top > newBottom) continue;
    for (let tx = x0; tx <= x1; tx++) if (map.isOneWay(tx, ty)) return top;
  }
  return null;
}

/**
 * body {x,y,w,h,vx,vy} を dt 秒進め、タイルと衝突解決する。
 * 戻り値: {hitLeft,hitRight,hitTop,hitBottom}
 */
export function moveBody(body, map, dt, opts = {}) {
  const res = { hitLeft: false, hitRight: false, hitTop: false, hitBottom: false };
  const dropThrough = !!opts.dropThrough;
  // X 軸（細分化して貫通防止）
  let dx = body.vx * dt;
  const stepsX = Math.max(1, Math.ceil(Math.abs(dx) / (TILE / 2)));
  for (let i = 0; i < stepsX && dx !== 0; i++) {
    const step = dx / stepsX;
    const nx = body.x + step;
    if (overlapsSolid(map, nx, body.y, body.w, body.h)) {
      if (step > 0) { body.x = Math.floor((nx + body.w) / TILE) * TILE - body.w; res.hitRight = true; }
      else { body.x = Math.floor(nx / TILE + 1) * TILE; res.hitLeft = true; }
      body.vx = 0;
      break;
    }
    body.x = nx;
  }
  // Y 軸
  let dy = body.vy * dt;
  const prevBottom = body.y + body.h;
  const stepsY = Math.max(1, Math.ceil(Math.abs(dy) / (TILE / 2)));
  body.onGround = false;
  for (let i = 0; i < stepsY && dy !== 0; i++) {
    const step = dy / stepsY;
    const ny = body.y + step;
    if (overlapsSolid(map, body.x, ny, body.w, body.h)) {
      if (step > 0) { body.y = Math.floor((ny + body.h) / TILE) * TILE - body.h; res.hitBottom = true; body.onGround = true; }
      else { body.y = Math.floor(ny / TILE + 1) * TILE; res.hitTop = true; }
      body.vy = 0;
      break;
    }
    if (step > 0 && !dropThrough) {
      const top = oneWayLanding(map, body.x, body.y + body.h, ny + body.h, body.w);
      if (top !== null) { body.y = top - body.h; body.vy = 0; res.hitBottom = true; body.onGround = true; break; }
    }
    body.y = ny;
  }
  if (dy === 0 || (!res.hitBottom && body.vy >= 0)) {
    // 静止時・落下開始判定: 足元 1px 下が地面か
    const below = body.y + body.h;
    const x0 = Math.floor(body.x / TILE), x1 = Math.floor((body.x + body.w - 0.001) / TILE);
    const ty = Math.floor((below + 0.5) / TILE);
    if (Math.abs(below - ty * TILE) < 0.01) {
      for (let tx = x0; tx <= x1; tx++) {
        if (map.isSolid(tx, ty) || (map.isOneWay(tx, ty) && !dropThrough)) { body.onGround = true; break; }
      }
    }
  }
  return res;
}

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
