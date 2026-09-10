import { test, expect } from 'vitest';
import { cameraTarget, cameraBounds, updateCamera, snapCamera, LOOK_AHEAD } from '../src/stage/camera.js';
import { TileMap } from '../src/stage/physics.js';

const player = (x, y, facing = 1) => ({ centerX: x, x: x - 6, y, h: 28, facing });

test('flat 14-row map never scrolls vertically; x clamps to the map', () => {
  const map = new TileMap(Array.from({ length: 14 }, () => '.'.repeat(64)));
  const cam = snapCamera({ x: 0, y: 0 }, player(10, 100), map, null);
  expect(cam).toEqual({ x: 0, y: 0 });
  snapCamera(cam, player(64 * 16 - 10, 100), map, null); expect(cam.x).toBe(64 * 16 - 256); expect(cam.y).toBe(0);
  snapCamera(cam, player(500, 100, -1), map, null); expect(cam.x).toBe(500 - 128 - LOOK_AHEAD);
});

test('tall map scrolls vertically, keeps the player at 55% height and clamps to the map', () => {
  const map = new TileMap(Array.from({ length: 100 }, () => '.'.repeat(16)));
  const cam = snapCamera({ x: 0, y: 0 }, player(128, 800), map, null);
  expect(cam.x).toBe(0); expect(cam.y).toBeCloseTo(800 + 14 - 224 * 0.55, 3);
  snapCamera(cam, player(128, 5), map, null); expect(cam.y).toBe(0);
  snapCamera(cam, player(128, 100 * 16 - 20), map, null); expect(cam.y).toBe(100 * 16 - 224);
});

test('boss arena bounds override both axes; updateCamera lerps toward the target', () => {
  const map = new TileMap(Array.from({ length: 100 }, () => '.'.repeat(32)));
  const arena = { x0: 128, x1: 128 + 256, y0: 1000, y1: 1224 };
  const b = cameraBounds(map, arena); expect(b).toEqual({ minX: 128, maxX: 128, minY: 1000, maxY: 1000 });
  const cam = { x: 0, y: 0 }; updateCamera(cam, player(200, 1100), map, arena, 1 / 60);
  expect(cam.x).toBe(128); expect(cam.y).toBe(1000);
  const cam2 = { x: 0, y: 0 }; updateCamera(cam2, player(600, 300), map, null, 1 / 60);
  const t = cameraTarget(player(600, 300)); expect(cam2.x).toBeCloseTo(t.x * (1 / 60) * 6, 3); expect(cam2.y).toBeCloseTo(t.y * (1 / 60) * 5, 3);
});
