import { test, expect } from 'vitest';
import { parseLevel } from '../src/level.js';
import { Player } from '../src/entities/player.js';
import { Enemy } from '../src/entities/enemies.js';
import { castMagic, MAGIC, Meteor, ShadowClone, HeartBurst, FirePillar } from '../src/entities/magic.js';

const STEP = 1 / 60;
const inputOf = (held = [], pressed = []) => ({ down: a => held.includes(a), hit: a => pressed.includes(a) });
function worldOf() {
  const rows = ['.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '..P.............................', '#'.repeat(32), '#'.repeat(32), '#'.repeat(32)];
  const level = parseLevel({ name: 't', rows });
  const w = { level, cutscene: false, cleared: false, shots: [], fires: [], effects: [], enemies: [], boxes: [], enemyShots: [], cam: { x: 0, y: 0 }, particles: { emit() {} }, audio: { sfx() {} }, fx: { hitStop() {} }, toast() {}, shake() {}, crumbles: [], platforms: [], presses: [], assets: {}, decals: { splat() {} }, addScore() {} };
  w.player = new Player(w, level.playerStart.x, level.playerStart.y);
  w.tick = n => { for (let i = 0; i < n; i++) { for (const e of w.effects) e.update(STEP); w.effects = w.effects.filter(e => !e.dead); for (const s of w.shots) s.update(STEP); w.shots = w.shots.filter(s => !s.dead); for (const f of w.fires) f.update(STEP); w.fires = w.fires.filter(f => !f.dead); } };
  return w;
}

test('star → 8 meteors fall from the top within 1 s, each dmg 2 and piercing', () => {
  const w = worldOf(); w.player.weapon = 'star';
  expect(castMagic(w, w.player)).toBe('star');
  const seen = new Set();
  for (let i = 0; i < 70; i++) { w.tick(1); for (const s of w.shots) if (s instanceof Meteor) seen.add(s); } // 地面に当たって消えるので累積で数える
  expect(seen.size).toBe(MAGIC.star.count);
  for (const m of seen) { expect(m.dmg).toBe(2); expect(m.pierce).toBe(true); expect(m.vy).toBeGreaterThan(0); expect(m.y).toBeGreaterThan(-20); }
  expect(w.effects.length).toBe(0); // 8 発出し終えた caster は消える
});

test('knife → 2 clones fire knives every 0.25 s for 3 s then vanish', () => {
  const w = worldOf(); w.player.weapon = 'knife'; castMagic(w, w.player);
  expect(w.effects.filter(e => e instanceof ShadowClone).length).toBe(2);
  w.tick(60); // 1 秒: 2 体 × 4 発
  expect(w.shots.filter(s => s.type === 'knife').length).toBeGreaterThanOrEqual(6);
  w.tick(130);
  expect(w.effects.some(e => e instanceof ShadowClone)).toBe(false);
});

test('heart → burst damages enemies inside radius 40 once, leaves distant enemies alone', () => {
  const w = worldOf(); w.player.weapon = 'heart';
  const near = new Enemy(w, w.player.centerX + 20, w.player.y, 10, 10); near.hp = 10;
  const far = new Enemy(w, w.player.centerX + 120, w.player.y, 10, 10); far.hp = 10;
  w.enemies.push(near, far);
  castMagic(w, w.player); expect(w.effects[0]).toBeInstanceOf(HeartBurst);
  w.tick(40);
  expect(near.hp).toBe(10 - MAGIC.heart.dmg); expect(far.hp).toBe(10);
  expect(w.effects.length).toBe(0);
});

test('candle → 3 fire pillars ahead, 3 tiles tall, lasting 1.5 s', () => {
  const w = worldOf(); w.player.weapon = 'candle'; w.player.facing = 1; castMagic(w, w.player);
  const pillars = w.fires.filter(f => f instanceof FirePillar);
  expect(pillars.length).toBe(3);
  for (const f of pillars) { expect(f.h).toBe(MAGIC.candle.height); expect(f.x).toBeGreaterThan(w.player.centerX); }
  expect(pillars[1].x - pillars[0].x).toBeCloseTo(MAGIC.candle.gap, 3);
  w.tick(80); expect(w.fires.filter(f => f instanceof FirePillar).length).toBe(3);
  w.tick(20); expect(w.fires.filter(f => f instanceof FirePillar).length).toBe(0);
});

test('charged shoot from a gold-costume player casts the current weapon magic (via Player.shoot)', () => {
  const w = worldOf(); const p = w.player; p.costume = 'gold'; p.weapon = 'heart';
  p.shoot(true);
  expect(w.effects.some(e => e instanceof HeartBurst)).toBe(true);
});
