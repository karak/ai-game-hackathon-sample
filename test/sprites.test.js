import { test, expect } from 'vitest';
import * as S from '../src/gfx/sprites/index.js';
import { PAL, COSTUMES } from '../src/gfx/palette.js';

const VALID = new Set([...Object.keys(PAL), '.']);
function checkRows(name, rows) {
  expect(rows.length, `${name} has rows`).toBeGreaterThan(0);
  const w = rows[0].length;
  rows.forEach((r, i) => {
    expect(r.length, `${name} row ${i} width`).toBe(w);
    for (const ch of r) expect(VALID.has(ch), `${name} row ${i} unknown key '${ch}'`).toBe(true);
  });
}

test('all sprite definitions are rectangular and use only palette keys', () => {
  for (const [g, defs] of Object.entries({ PLAYER_TOP: S.PLAYER_TOP, PLAYER_LEGS: S.PLAYER_LEGS, PLAYER_FULL: S.PLAYER_FULL, ENEMY: S.ENEMY, BOSS: S.BOSS, SHOT: S.SHOT, ITEM: S.ITEM, DECO: S.DECO }))
    for (const [k, rows] of Object.entries(defs)) checkRows(`${g}.${k}`, rows);
  checkRows('HAT', S.HAT); checkRows('BROOM', S.BROOM);
});

test('player top + legs compose to a consistent frame size', () => {
  const tops = Object.values(S.PLAYER_TOP), legs = Object.values(S.PLAYER_LEGS), fulls = Object.values(S.PLAYER_FULL);
  const w = tops[0][0].length, h = tops[0].length + legs[0].length;
  for (const t of tops) { expect(t[0].length).toBe(w); expect(t.length).toBe(tops[0].length); }
  for (const l of legs) { expect(l[0].length).toBe(w); expect(l.length).toBe(legs[0].length); }
  for (const f of fulls) { expect(f[0].length).toBe(w); expect(f.length).toBe(h); }
});

test('animation frame pairs exist for every enemy that animates', () => {
  for (const base of ['zombie', 'mushroom', 'unicorn', 'cake', 'angel', 'bear', 'eye']) {
    expect(S.ENEMY[base + '1'], base + '1').toBeDefined();
    expect(S.ENEMY[base + '2'], base + '2').toBeDefined();
    expect(S.ENEMY[base + '1'][0].length).toBe(S.ENEMY[base + '2'][0].length);
  }
});

test('decoration tiles are 16x16 and every level decoration char has a sprite', () => {
  for (const [k, rows] of Object.entries(S.DECO)) { expect(rows.length, k).toBe(16); expect(rows[0].length, k).toBe(16); }
  for (const ch of ['t', 'c', 'f', 'y', 'x', 'v', 'n', 'w', 'o']) expect(S.DECO[ch], ch).toBeDefined();
});

test('palette colors are #rrggbb and costume remaps cover the costume keys', () => {
  for (const [k, v] of Object.entries(PAL)) expect(v, k).toMatch(/^#[0-9a-f]{6}$/);
  for (const [name, remap] of Object.entries(COSTUMES)) for (const key of ['p', 'q', 'r', 's', 't']) expect(remap[key], `${name}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
});
