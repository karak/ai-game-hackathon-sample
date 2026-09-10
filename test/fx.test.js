import { test, expect } from 'vitest';
import { Fx, irisRadius, HITSTOP_TICKS, BOSS_WHITEOUT_T, BOSS_SLOWMO_T, BOSS_SLOWMO_SCALE, IRIS_T, BOSS_INTRO_T } from '../src/stage/fx.js';

const STEP = 1 / 60;

test('hitstop freezes the world for exactly HITSTOP_TICKS ticks, then resumes', () => {
  const fx = new Fx(); fx.hitStop();
  const dts = Array.from({ length: HITSTOP_TICKS + 2 }, () => fx.tick(STEP));
  expect(dts.slice(0, HITSTOP_TICKS).every(d => d === 0)).toBe(true);
  expect(dts[HITSTOP_TICKS]).toBeCloseTo(STEP); expect(dts[HITSTOP_TICKS + 1]).toBeCloseTo(STEP);
});

test('kill flash decays to 0 and never exceeds its max alpha', () => {
  const fx = new Fx(); fx.killFlash();
  const a0 = fx.flashAlpha; expect(a0).toBeGreaterThan(0); expect(a0).toBeLessThanOrEqual(0.3);
  let n = 0; while (fx.flashAlpha > 0 && n < 100) { fx.tick(STEP); n++; }
  expect(n).toBeLessThanOrEqual(4); expect(fx.flashAlpha).toBe(0);
});

test('boss defeat: full white-out then slow motion at BOSS_SLOWMO_SCALE for BOSS_SLOWMO_T, then normal', () => {
  const fx = new Fx(); fx.bossDefeat();
  expect(fx.flashAlpha).toBe(1);
  const scaled = fx.tick(STEP); expect(scaled).toBeCloseTo(STEP * BOSS_SLOWMO_SCALE);
  let t = STEP; while (fx.timeScale < 1 && t < 10) { fx.tick(STEP); t += STEP; }
  expect(t).toBeGreaterThanOrEqual(BOSS_SLOWMO_T - STEP); expect(t).toBeLessThanOrEqual(BOSS_SLOWMO_T + 2 * STEP);
  expect(fx.tick(STEP)).toBeCloseTo(STEP);
  expect(BOSS_WHITEOUT_T).toBeLessThan(BOSS_SLOWMO_T); // 白飛びはスローの途中で明ける
});

test('boss intro banner lasts BOSS_INTRO_T and keeps the name', () => {
  const fx = new Fx(); fx.bossIntro('泣き人形 ドロシー');
  expect(fx.introActive).toBe(true); expect(fx.introName).toBe('泣き人形 ドロシー');
  for (let t = 0; t < BOSS_INTRO_T + STEP; t += STEP) fx.tick(STEP);
  expect(fx.introActive).toBe(false);
});

test('iris radius: opening goes 0 → beyond the screen corner, closing the reverse, monotonic', () => {
  const W = 256, H = 224, corner = Math.hypot(W, H) / 2;
  expect(irisRadius(0, true, W, H)).toBe(0);
  expect(irisRadius(IRIS_T, true, W, H)).toBeGreaterThan(corner);
  expect(irisRadius(0, false, W, H)).toBeGreaterThan(corner);
  expect(irisRadius(IRIS_T, false, W, H)).toBe(0);
  let prev = -1; for (let t = 0; t <= IRIS_T; t += 0.05) { const r = irisRadius(t, true, W, H); expect(r).toBeGreaterThanOrEqual(prev); prev = r; }
  expect(irisRadius(99, true, W, H)).toBe(irisRadius(IRIS_T, true, W, H));
});
