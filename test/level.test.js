import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/level.js';
import { STAGES } from '../src/levels/index.js';

test('parseLevel extracts markers and leaves tiles clean', () => {
  const rows = [
    '..P.....T.',
    '....z.....',
    '##########',
  ];
  const lvl = parseLevel({ rows, name: 'x' });
  assert.deepEqual(lvl.playerStart, { x: 2 * 16, y: 0 });
  assert.equal(lvl.spawns.length, 2);
  assert.equal(lvl.spawns.find(s => s.type === 'treasure').tx, 8);
  assert.equal(lvl.spawns.find(s => s.type === 'zombie').tx, 4);
  assert.equal(lvl.map.isSolid(2, 0), false);
  assert.equal(lvl.map.rows[0][2], '.');
});

test('every stage parses, has a player start, a goal or boss, and no floating typos', () => {
  for (const stage of STAGES) {
    const lvl = parseLevel(stage);
    assert.ok(lvl.playerStart, `${stage.name} needs P`);
    assert.ok(lvl.bossTrigger || lvl.goal, `${stage.name} needs B or G`);
    const widths = new Set(stage.rows.map(r => r.length));
    assert.equal(widths.size, 1, `${stage.name} rows must be equal width`);
    assert.ok(lvl.map.height <= 14, `${stage.name} must fit 14 rows`);
    // player start must be above solid ground somewhere below
    const tx = lvl.playerStart.x / 16;
    let grounded = false;
    for (let ty = 0; ty < lvl.map.height; ty++) if (lvl.map.isSolid(tx, ty)) grounded = true;
    assert.ok(grounded, `${stage.name} player start has no ground`);
  }
});
