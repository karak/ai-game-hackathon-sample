import { test, expect } from 'vitest';
import { chooseContents } from '../src/stage/entities/items.js';
import { WEAPON_ORDER } from '../src/stage/entities/projectiles.js';

const world = (costume, weapon = 'star', boxCount = 0) => ({ player: { costume, weapon }, boxCount });

test('a de-transformed player always gets the dress back from a box', () => {
  for (let i = 0; i < 20; i++) expect(chooseContents(world('plain'))).toBe('dress');
});

test('every third box in the dress gives the gold dress', () => {
  const w = world('dress'); w.boxCount = 2;
  expect(chooseContents(w)).toBe('golddress');
});

test('weapon drops never repeat the currently held weapon', () => {
  for (let i = 0; i < 200; i++) {
    const w = world('gold', 'knife', 0);
    const c = chooseContents(w);
    expect(c).not.toBe('knife');
    expect([...WEAPON_ORDER, 'oneup', 'potion', 'golddress']).toContain(c);
  }
});
