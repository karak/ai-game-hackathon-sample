import { test, expect } from 'vitest';
import { Particles, PARTICLE_MAX } from '../src/entities/particles.js';

test('particle count is capped at PARTICLE_MAX and the newest particles survive', () => {
  const ps = new Particles({});
  ps.emit('blood', 0, 0, PARTICLE_MAX - 10);
  expect(ps.list.length).toBe(PARTICLE_MAX - 10);
  ps.emit('sparkle', 100, 100, 50); // 40 超過 → 古い blood が 40 個捨てられる
  expect(ps.list.length).toBe(PARTICLE_MAX);
  expect(ps.list.slice(-50).every(p => p.kind === 'sparkle')).toBe(true);
  expect(ps.list.filter(p => p.kind === 'blood').length).toBe(PARTICLE_MAX - 50);
  ps.emit('gore', 0, 0, PARTICLE_MAX * 3);
  expect(ps.list.length).toBe(PARTICLE_MAX); expect(ps.list.every(p => p.kind === 'gore')).toBe(true);
  expect(PARTICLE_MAX).toBe(400); // 05-systems 5.6 の値
});
