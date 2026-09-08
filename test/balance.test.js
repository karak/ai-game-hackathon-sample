import { test, expect, vi, afterEach } from 'vitest';
import { parseLevel } from '../src/level.js';
import { STAGES } from '../src/levels/index.js';
import { SAFE_ZONE_X, SAFE_SHOT_T, minTimeLimit, PLAYER_SPEED } from '../src/balance.js';
import { ZombieSpawner, Enemy } from '../src/entities/enemies.js';
import { TILE } from '../src/physics.js';

afterEach(() => vi.restoreAllMocks());

// 平地 40 タイル、開始 P が tx=2、中間地点 C が tx=20
const flat = () => parseLevel({ name: 'flat', rows: ['..P.................C...................', '.'.repeat(40), '#'.repeat(40)] });
const fakeWorld = (level, playerX) => ({
  level, player: { alive: true, centerX: playerX, facing: 1, y: 16 }, boss: null, enemies: [], enemyShots: [],
  safeT: 0, checkpoint: level.playerStart, particles: { emit() {} }, audio: { sfx() {} }, assets: {},
});

test('PLAYER_SPEED matches player.js', async () => {
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/entities/player.js', import.meta.url), 'utf8'));
  expect(src).toMatch(new RegExp(`const SPEED = ${PLAYER_SPEED}\\b`));
});

test('each stage time limit ≥ 3× walk-to-boss time + 90 s boss fight', () => {
  for (const st of STAGES) {
    const L = parseLevel(st);
    expect(L.timeLimit, st.title).toBeGreaterThanOrEqual(minTimeLimit(L.bossTrigger.x));
    expect(L.timeLimit, st.title).toBeLessThanOrEqual(420); // 7 分以内
  }
});

test('zombie spawner never spawns within ±SAFE_ZONE_X of the start or a checkpoint', () => {
  const L = flat();
  // 中間地点 C (tx=20 → x=320) の真上に立つ。湧き位置は ±50..100 なので全て安全地帯 (320±96) 内
  const w = fakeWorld(L, 20 * TILE + 8);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const sp = new ZombieSpawner(w, w.player.centerX);
  for (let i = 0; i < 200; i++) sp.update(1 / 60);
  expect(w.enemies.length).toBe(0);
  // 安全地帯の外（x=32*16=512）では湧く
  const w2 = fakeWorld(L, 32 * TILE);
  const sp2 = new ZombieSpawner(w2, w2.player.centerX);
  for (let i = 0; i < 200; i++) sp2.update(1 / 60);
  expect(w2.enemies.length).toBeGreaterThan(0);
  for (const z of w2.enemies) for (const c of [L.playerStart, ...L.checkpoints]) expect(Math.abs(z.x + z.w / 2 - (c.x + TILE / 2))).toBeGreaterThanOrEqual(SAFE_ZONE_X - 8);
});

test('enemies do not shoot while world.safeT > 0 (respawn grace), and do afterwards', () => {
  const L = flat(); const w = fakeWorld(L, 100);
  const e = new Enemy(w, 200, 0, 10, 10);
  w.safeT = SAFE_SHOT_T; e.shoot('blood', -50, -50);
  expect(w.enemyShots.length).toBe(0);
  w.safeT = 0; e.shoot('blood', -50, -50);
  expect(w.enemyShots.length).toBe(1);
});
