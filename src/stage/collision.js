// 当たり判定（DEBT-004、Sprint P）: 自弾 vs 敵・宝箱、炎 vs 敵、主人公 vs 敵・敵弾・毒溜まり・アイテム。World.update から毎フレーム呼ばれる。
// World.collide() から切り出した（第 1 引数 world = 旧 this）。順序と早期 return は元のまま
import { aabb } from './physics.js';

export function collide(world) {
  const p = world.player;
  // 自弾 vs 敵・宝箱
  for (const s of world.shots) {
    if (s.dead) continue;
    for (const e of world.enemies) {
      if (e.dead || e.hp === undefined || s.hitIds.has(e.id)) continue;
      if (e.state === 'enter') continue;
      if (aabb(s, e)) { s.hitIds.add(e.id); e.hurt(s.dmg, s); s.onHit(); if (s.dead) break; }
    }
    if (s.dead) continue;
    for (const b of world.boxes) if (!b.dead && aabb(s, b)) { b.hurt(); s.onHit(); break; }
  }
  // 炎 vs 敵
  for (const f of world.fires) for (const e of world.enemies) {
    if (e.dead || e.hp === undefined) continue;
    if (aabb(f, e)) { const last = f.hitIds.get(e.id) ?? -1; if (f.t - last > 0.35) { f.hitIds.set(e.id, f.t); e.hurt(1, f); } }
  }
  if (!p.alive || world.cleared) return;
  const pbox = p;
  // 敵接触
  for (const e of world.enemies) if (!e.dead && e.contact && aabb(pbox, e)) { if (p.hit(e)) break; }
  // 敵弾
  for (const s of world.enemyShots) if (!s.dead && aabb(pbox, s)) { if (p.hit(s)) { if (!s.def.boomerang) s.dead = true; break; } }
  // 毒溜まり
  for (const q of world.pools) if (!q.dead && aabb(pbox, q)) { if (p.hit(q)) break; }
  // アイテム
  for (const i of world.items) if (!i.dead && aabb(pbox, i)) i.pickup(p);
}
