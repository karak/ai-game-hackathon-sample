import { test } from 'vitest';
import assert from 'node:assert/strict';
import { TILE, TileMap, moveBody } from '../src/stage/physics.js';

const rows = [
  '..........',
  '..........',
  '....==....',
  '..........',
  '##########',
];

test('TileMap reports solids and one-way platforms', () => {
  const map = new TileMap(rows);
  assert.equal(map.width, 10);
  assert.equal(map.height, 5);
  assert.equal(map.isSolid(0, 4), true);
  assert.equal(map.isSolid(0, 3), false);
  assert.equal(map.isOneWay(4, 2), true);
  assert.equal(map.isOneWay(4, 3), false);
  // out of bounds: sides are walls, top/bottom are open
  assert.equal(map.isSolid(-1, 0), true);
  assert.equal(map.isSolid(0, 99), false);
});

test('falling body lands on solid ground and sets onGround', () => {
  const map = new TileMap(rows);
  const body = { x: 20, y: 30, w: 10, h: 14, vx: 0, vy: 80 };
  const res = moveBody(body, map, 1 / 2); // large dt to fall far
  assert.equal(res.hitBottom, true);
  assert.equal(body.onGround, true);
  assert.equal(body.y + body.h, 4 * TILE);
  assert.equal(body.vy, 0);
});

test('body moving right stops at a wall', () => {
  const walled = ['....#', '....#', '#####'];
  const map = new TileMap(walled);
  const body = { x: 10, y: 20, w: 10, h: 10, vx: 300, vy: 0 };
  const res = moveBody(body, map, 1 / 4);
  assert.equal(res.hitRight, true);
  assert.equal(body.x + body.w, 4 * TILE);
  assert.equal(body.vx, 0);
});

test('one-way platform: lands from above, passes from below', () => {
  const map = new TileMap(rows);
  const above = { x: 66, y: 10, w: 8, h: 12, vx: 0, vy: 60 };
  moveBody(above, map, 1 / 3);
  assert.equal(above.onGround, true);
  assert.equal(above.y + above.h, 2 * TILE);

  const below = { x: 66, y: 50, w: 8, h: 12, vx: 0, vy: -200 };
  const res = moveBody(below, map, 1 / 10);
  assert.equal(res.hitTop, false);
  assert.ok(below.y < 2 * TILE);
});

test('body standing still on ground keeps onGround true', () => {
  const map = new TileMap(rows);
  const body = { x: 20, y: 4 * TILE - 14, w: 10, h: 14, vx: 0, vy: 0 };
  moveBody(body, map, 1 / 60);
  assert.equal(body.onGround, true);
});

test('gravity is applied by caller, not moveBody', () => {
  const map = new TileMap(rows);
  const body = { x: 20, y: 10, w: 10, h: 14, vx: 0, vy: 0 };
  moveBody(body, map, 1 / 60);
  assert.equal(body.y, 10);
});
