import { test, expect } from 'vitest';
import { MAP } from '../src/input.js';

test('every gameplay action has at least one key and arrows/WASD both work', () => {
  const actions = new Set(Object.values(MAP));
  for (const a of ['left', 'right', 'up', 'down', 'shoot', 'jump', 'start', 'pause', 'mute']) expect(actions.has(a), a).toBe(true);
  expect(MAP.ArrowLeft).toBe(MAP.KeyA); expect(MAP.ArrowRight).toBe(MAP.KeyD);
  expect(MAP.Space).toBe('jump');
});
