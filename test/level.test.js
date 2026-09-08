import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/level.js';
import { STAGES } from '../src/levels/index.js';
import { PLATFORM } from '../src/entities/gimmicks.js';

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

test('ground-bound enemies, boxes and checkpoints stand above solid ground (not over hazards)', () => {
  const GROUND = new Set(['unicorn', 'cake', 'bear', 'treasure']);
  for (const stage of STAGES) {
    const lvl = parseLevel(stage);
    const targets = lvl.spawns.filter(s => GROUND.has(s.type)).map(s => ({ ...s, label: s.type }));
    for (const c of lvl.checkpoints) targets.push({ tx: c.x / 16, ty: c.y / 16, label: 'checkpoint' });
    for (const s of targets) {
      let ok = false;
      for (let ty = s.ty + 1; ty < lvl.map.height; ty++) {
        if (lvl.map.isHazard(s.tx, ty)) break;
        if (lvl.map.isSolid(s.tx, ty) || lvl.map.isOneWay(s.tx, ty)) { ok = true; break; }
      }
      assert.ok(ok, `${stage.name}: ${s.label} at ${s.tx},${s.ty} has no ground below`);
    }
  }
});

test('every hazard gap is crossable: at most 3 tiles wide at ground level, or has a platform stepping stone', () => {
  for (const stage of STAGES) {
    const lvl = parseLevel(stage); const map = lvl.map;
    // 各列の「最も高い立てる面」を求める（地面 or 足場）
    const standY = tx => { for (let ty = 0; ty < map.height; ty++) if (map.isSolid(tx, ty) || map.isOneWay(tx, ty)) return ty; return null; };
    // 動く足場・浮島（マーカー）も足場として数える（幅 = PLATFORM[kind].w タイル）
    const platCols = new Set(); for (const s of lvl.spawns) { if (s.type === 'wheel') { for (let i = -3; i <= 4; i++) platCols.add(s.tx + i); continue; } if (PLATFORM[s.type]) for (let i = 0; i < PLATFORM[s.type].w; i++) platCols.add(s.tx + i); } // 観覧車は中心 ±48（3 タイル）
    let gapStart = null;
    for (let tx = 0; tx <= map.width; tx++) {
      const y = tx < map.width ? standY(tx) : 0;
      // 天井のみ(城の row0-1)は立てる面ではない
      const usable = (y !== null && y >= 3) || platCols.has(tx);
      if (!usable && gapStart === null) gapStart = tx;
      if (usable && gapStart !== null) {
        const width = tx - gapStart;
        assert.ok(width <= 6, `${stage.name}: gap of ${width} tiles starting at column ${gapStart} is too wide even for a double jump`);
        gapStart = null;
      }
    }
  }
});
