import { test, expect } from 'vitest';
import { parseLevel } from '../src/level.js';
import { TILE } from '../src/physics.js';
import { Player } from '../src/entities/player.js';
import { MovingPlatform, CrumbleTile, FLOW_SPEED, CRUMBLE_SHAKE_T, CRUMBLE_RESPAWN_T, LADDER_SPEED, PLATFORM } from '../src/entities/gimmicks.js';

const STEP = 1 / 60;
// 入力スタブ: held の集合と 1 回きりの pressed
const inputOf = (held = [], pressed = []) => ({ down: a => held.includes(a), hit: a => pressed.includes(a) });
const NONE = inputOf();
// 最小のワールド。level は parseLevel の結果、platforms/crumbles は World.spawnAll と同じ規則で作る
function worldOf(rows) {
  const level = parseLevel({ name: 't', rows });
  const w = { level, cutscene: false, cleared: false, shots: [], particles: { emit() {} }, audio: { sfx() {} }, fx: { hitStop() {} }, toast() {}, shake() {} };
  w.platforms = level.spawns.filter(s => PLATFORM[s.type]).map(s => new MovingPlatform(w, s.type, s.tx, s.ty));
  w.crumbles = level.crumbles.map(c => new CrumbleTile(w, c.tx, c.ty));
  w.player = new Player(w, level.playerStart.x, level.playerStart.y);
  w.step = (input = NONE, n = 1) => { for (let i = 0; i < n; i++) { for (const p of w.platforms) p.update(STEP); for (const c of w.crumbles) c.update(STEP); w.player.update(STEP, input); } };
  return w;
}

test('moving platform: player lands on it and is carried horizontally (±48 over 4 s)', () => {
  // P は足場の中央列（M の 1 つ右）の真上 1 タイル。足場 M は列 9..11、行 8（t=0 で右へ動き始めるので中央列に落とす）。下は穴
  const w = worldOf([
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........P.....................',
    '.........M......................',
    '................................',
    '................................',
    '................................',
    '................................',
    '################################',
  ]);
  const p = w.player, plat = w.platforms[0];
  expect(plat.w).toBe(3 * TILE); expect(plat.axis).toBe('x');
  w.step(NONE, 60);
  expect(p.platform).toBe(plat); expect(p.onGround).toBe(true); expect(p.y + p.h).toBeCloseTo(plat.y, 3);
  const x0 = p.x, px0 = plat.x;
  w.step(NONE, 60); // 1 秒: 足場が動いた分だけ主人公も動く
  expect(plat.x - px0).not.toBeCloseTo(0, 1);
  expect(p.x - x0).toBeCloseTo(plat.x - px0, 3);
  // 振幅: 4 秒で中心に戻り、最大偏差は amp
  let maxOff = 0; for (let i = 0; i < 240; i++) { w.step(); maxOff = Math.max(maxOff, Math.abs(plat.x + plat.w / 2 - plat.cx)); }
  expect(maxOff).toBeGreaterThan(47); expect(maxOff).toBeLessThanOrEqual(48.01);
});

test('jumping off a moving platform detaches; falling past it without overlap does not land', () => {
  const w = worldOf([
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........P......................',
    '................................',
    '................................',
    '.........V......................',
    '................................',
    '................................',
    '................................',
    '................................',
    '################################',
  ]);
  const p = w.player, plat = w.platforms[0];
  w.step(NONE, 90); expect(p.platform).toBe(plat);
  w.step(inputOf([], ['jump'])); expect(p.platform).toBe(null); expect(p.vy).toBeLessThan(0);
});

test('crumbling platform: shakes 0.6 s after being stood on, disappears, comes back after 8 s', () => {
  const w = worldOf([
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.P..............................',
    '#!!!............................',
    '................................',
    '................................',
    '################################',
  ]);
  const p = w.player, map = w.level.map;
  expect(w.crumbles.length).toBe(3);
  w.step(inputOf(['right']), 20); // 崩れる足場の上へ
  const c = w.crumbles.find(c => c.state === 'shaking'); expect(c).toBeTruthy();
  const shakeFrames = Math.ceil(CRUMBLE_SHAKE_T / STEP);
  w.step(NONE, shakeFrames + 1);
  expect(c.state).toBe('gone'); expect(map.at(c.tx, c.ty)).toBe('.');
  w.step(NONE, 60); expect(p.y).toBeGreaterThan(10 * TILE); // 落ちた
  w.step(NONE, Math.ceil(CRUMBLE_RESPAWN_T / STEP));
  expect(c.state).toBe('solid'); expect(map.at(c.tx, c.ty)).toBe('!');
});

test('ladder: up climbs at LADDER_SPEED, tops out standing on the ledge; down from the ledge re-enters; jump leaves', () => {
  const w = worldOf([
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.....L##########################',
    '.....L..........................',
    '.....L..........................',
    '..P..L..........................',
    '################################',
    '################################',
    '################################',
  ]);
  const p = w.player;
  w.step(inputOf(['right']), 40); // はしごの列へ
  expect(Math.floor(p.centerX / TILE)).toBe(5);
  w.step(inputOf(['up'])); expect(p.climbing).toBe(true);
  const y0 = p.y; w.step(inputOf(['up']), 30); expect(y0 - p.y).toBeCloseTo(LADDER_SPEED * 0.5, 0);
  w.step(inputOf(['up']), 200);
  expect(p.climbing).toBe(false); expect(p.onGround).toBe(true); expect(p.y + p.h).toBeCloseTo(7 * TILE, 3); // はしご最上段(row7)の上に立つ
  // 上に立った状態から下を押すと再びはしごへ
  w.step(inputOf(['down'])); expect(p.climbing).toBe(true);
  w.step(inputOf(['down']), 20);
  w.step(inputOf([], ['jump'])); expect(p.climbing).toBe(false); expect(p.vy).toBeLessThan(0);
});

test('water flow pushes only a grounded body, wind only an airborne body (±FLOW_SPEED)', () => {
  const water = worldOf(['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '.P>>>>>>>>......', '################', '################', '################']);
  const p = water.player; water.step(inputOf(['right']), 12); water.step(NONE, 5); const x0 = p.x; water.step(NONE, 60); // 右に歩いて水流の帯（列 2〜）に入る
  expect(p.x - x0).toBeCloseTo(FLOW_SPEED, 0);
  const wind = worldOf(['................', '................', '................', '................', '................', '................', '................', '................', '.P..............', '.}}}}}}}}}......', '.}}}}}}}}}......', '................', '................', '################']);
  const q = wind.player; const qx = q.x; wind.step(NONE, 20); // 落下中に風の帯を通る
  expect(q.x).toBeGreaterThan(qx); expect(q.onGround).toBe(false);
  const ground = worldOf(['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '.P}}}}}}}}......', '################', '################', '################']);
  const r = ground.player; ground.step(inputOf(['right']), 12); ground.step(NONE, 5); const rx = r.x; ground.step(NONE, 60);
  expect(r.x).toBeCloseTo(rx, 3); // 地上では風は効かない
});
