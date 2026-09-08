import { test, expect } from 'vitest';
import { parseLevel } from '../src/level.js';
import { TILE } from '../src/physics.js';
import { Player } from '../src/entities/player.js';
import { MovingPlatform, PressMachine, PRESS, CONVEYOR_SPEED, PLATFORM, makeWheel } from '../src/entities/gimmicks.js';

const STEP = 1 / 60;
const inputOf = (held = [], pressed = []) => ({ down: a => held.includes(a), hit: a => pressed.includes(a) });
const NONE = inputOf();
function worldOf(rows) {
  const level = parseLevel({ name: 't', rows });
  const w = { level, cutscene: false, cleared: false, shots: [], particles: { emit() {} }, audio: { sfx() {} }, fx: { hitStop() {} }, toast() {}, shake() {}, crumbles: [], onPlayerDying() {}, onPlayerDeath() {} };
  w.platforms = level.spawns.flatMap(s => s.type === 'wheel' ? makeWheel(w, s.tx, s.ty) : PLATFORM[s.type] ? [new MovingPlatform(w, s.type, s.tx, s.ty)] : []);
  w.presses = level.spawns.filter(s => s.type === 'press').map(s => new PressMachine(w, s.tx, s.ty));
  w.player = new Player(w, level.playerStart.x, level.playerStart.y);
  w.step = (input = NONE, n = 1) => { for (let i = 0; i < n; i++) { for (const p of w.platforms) p.update(STEP); for (const q of w.presses) q.update(STEP); w.player.update(STEP, input); } };
  return w;
}
const flatWith = row10 => ['.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), '.'.repeat(32), row10, '#'.repeat(32), '#'.repeat(32), '#'.repeat(32)];

test('conveyor moves a standing player at ±CONVEYOR_SPEED and does nothing in the air', () => {
  const rows = flatWith('..P.............................'); rows[11] = '##))))))))))))((((((((((########';
  const w = worldOf(rows); const p = w.player;
  w.step(NONE, 5); const x0 = p.x; w.step(NONE, 60);
  expect(p.x - x0).toBeCloseTo(CONVEYOR_SPEED, 0);
  // 左行きベルトへ移動（列 14〜23。境界で往復しないよう中央の列 20 から）
  p.x = 20 * TILE; w.step(NONE, 5); const x1 = p.x; w.step(NONE, 60);
  expect(p.x - x1).toBeCloseTo(-CONVEYOR_SPEED, 0);
  // 空中では効かない
  p.x = 5 * TILE; w.step(inputOf([], ['jump'])); const xj = p.x; w.step(NONE, 10); expect(p.onGround).toBe(false); expect(p.x).toBeCloseTo(xj, 3);
});

test('press machine cycles wait → drop → down → rise with PRESS timing and kills only while crushing', () => {
  const rows = flatWith('..P......%......................'); rows[5] = '.........#......................';
  // % は行 10 に置くとすぐ床。天井 # を行 5 に、% を行 6 に
  rows[10] = '..P.............................'; rows[6] = '.........%......................';
  const w = worldOf(rows); const q = w.presses[0]; const p = w.player;
  expect(q.floorY).toBe(11 * TILE); expect(q.travel).toBe(11 * TILE - 6 * TILE - PRESS.h * TILE);
  const phases = new Set(); let maxY = 0; q.t = 0;
  for (let i = 0; i < Math.round(PRESS.period / STEP) + 1; i++) { q.update(STEP); phases.add(q.phase); maxY = Math.max(maxY, q.y); }
  expect([...phases].sort()).toEqual(['down', 'drop', 'rise', 'wait']);
  expect(maxY).toBeCloseTo(q.floorY - PRESS.h * TILE, 3);
  // 下で止まっている間に真下にいると死ぬ。待機中は死なない
  q.t = PRESS.dropT + 0.01; q.update(0); expect(q.crushing).toBe(true);
  p.x = 9 * TILE + 2; p.y = 11 * TILE - p.h; w.player.update(STEP, NONE);
  expect(p.state).toBe('dying'); expect(p.deathReason).toBe('press');
  const w2 = worldOf(rows); const q2 = w2.presses[0]; q2.t = PRESS.dropT + PRESS.downT + PRESS.riseT + 0.5; q2.update(0); expect(q2.crushing).toBe(false);
  const p2 = w2.player; p2.x = 9 * TILE + 2; p2.y = 11 * TILE - p2.h; w2.player.update(STEP, NONE); expect(p2.state).toBe('normal');
});

test('wheel spawns 4 one-way platforms on a circle of radius 48 that complete a turn in 8 s', () => {
  const rows = flatWith('..P.............................'); rows[6] = '...............O................';
  const w = worldOf(rows);
  expect(w.platforms.length).toBe(4); expect(w.platforms.every(p => p.oneWay)).toBe(true);
  const c = w.platforms[0]; const cx = c.cx, cy = c.cy;
  for (const p of w.platforms) expect(Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy)).toBeCloseTo(48, 3);
  const start = [c.x, c.y]; w.step(NONE, 480);
  expect(c.x).toBeCloseTo(start[0], 1); expect(c.y).toBeCloseTo(start[1], 1);
  w.step(NONE, 240); expect(Math.hypot(c.x - start[0], c.y - start[1])).toBeCloseTo(96, 0); // 半周で反対側
});
