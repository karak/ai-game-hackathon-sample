import { test, expect } from 'vitest';
import { encodeRLE, decodeRLE, maskOf, DemoRecorder, DemoInput, DEMO_ACTIONS } from '../src/app/demo.js';
import { seedGame, grand, rand, hashSeed } from '../src/shared/util.js';
import { parseLevel } from '../src/stage/level.js';
import { MushroomFairy, ZombieSpawner } from '../src/stage/entities/enemies.js';

const inputOf = (held = [], pressed = []) => ({ down: a => held.includes(a), hit: a => pressed.includes(a) });

test('RLE round-trips and compresses runs', () => {
  const masks = [0, 0, 0, 3, 3, 64, 0, 0];
  const rle = encodeRLE(masks);
  expect(rle).toEqual([[0, 3], [3, 2], [64, 1], [0, 2]]);
  expect(decodeRLE(rle)).toEqual(masks);
});

test('recorder captures held and pressed per frame; DemoInput replays the identical sequence', () => {
  const rec = new DemoRecorder('stage1', 7);
  const seq = [inputOf(['right']), inputOf(['right'], ['jump']), inputOf(['right', 'jump']), inputOf([], ['shoot']), inputOf()];
  for (const inp of seq) rec.record(inp);
  const json = JSON.parse(JSON.stringify(rec.toJSON()));
  expect(json.frames).toBe(5); expect(json.stage).toBe('stage1'); expect(json.seed).toBe(7);
  const play = new DemoInput(json);
  for (const inp of seq) {
    for (const a of DEMO_ACTIONS) { expect(play.down(a), a).toBe(inp.down(a)); expect(play.hit(a), a).toBe(inp.hit(a)); }
    play.next();
  }
  expect(play.done).toBe(true);
  expect(maskOf(inputOf(['left'], ['jump']))).toBe(1 | (1 << 11));
});

test('seeded gameplay RNG is deterministic and hashSeed is stable', () => {
  seedGame(hashSeed('stage1')); const a = [grand(), grand(), rand(0, 10)];
  seedGame(hashSeed('stage1')); const b = [grand(), grand(), rand(0, 10)];
  expect(a).toEqual(b);
  seedGame(hashSeed('stage2')); expect(grand()).not.toBe(a[0]);
  expect(hashSeed('stage1')).toBe(hashSeed('stage1'));
});

test('same seed + same ticks → identical enemy behaviour (spawner positions, fairy shot timing)', () => {
  const rows = ['.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '.'.repeat(40), '..........m.........................', '..P..............z..................', '#'.repeat(40), '#'.repeat(40), '#'.repeat(40)];
  const run = () => {
    seedGame(hashSeed('det'));
    const level = parseLevel({ name: 'det', rows });
    const w = { level, player: { alive: true, centerX: 18 * 16, x: 18 * 16, y: 148, h: 28, facing: 1 }, boss: null, enemies: [], enemyShots: [], safeT: 0, checkpoint: level.playerStart, particles: { emit() {} }, audio: { sfx() {} }, assets: {}, decals: { splat() {} } };
    const sp = new ZombieSpawner(w, 17 * 16 + 8); const m = new MushroomFairy(w, 10 * 16 + 2, 9 * 16);
    const log = [];
    for (let i = 0; i < 600; i++) { sp.update(1 / 60); m.update(1 / 60); for (const e of w.enemies) e.update(1 / 60); log.push([w.enemies.length, w.enemyShots.length, Math.round(m.y * 100)]); }
    return JSON.stringify(log) + JSON.stringify(w.enemies.map(e => Math.round(e.x)));
  };
  expect(run()).toBe(run());
});
