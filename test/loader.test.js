import { test, expect } from 'vitest';
import { placeholderSprite, PLACEHOLDER_COLORS } from '../src/gfx/loader.js';
import { HD_SCALE } from '../src/stage/viewport.js';
import manifest from '../src/gfx/manifest.json';
import { existsSync } from 'node:fs';

// ADR-0040: 読めなかった素材は manifest の寸法どおりのプレースホルダになる（文字列ドット絵へのフォールバックは DEBT-003 で撤去）
const fakeCanvas = () => {
  const c = { width: 0, height: 0, rects: [], fills: new Set() };
  c.getContext = () => ({ set fillStyle(v) { c.fills.add(v); }, fillRect: (x, y, w, h) => c.rects.push([x, y, w, h]) });
  return c;
};

test('placeholder takes the manifest size (cells = screen px) and is drawn as an hd sprite with missing: true', () => {
  const m = manifest['enemies/zombie1']; // 64×101
  const s = placeholderSprite(m, fakeCanvas);
  expect([s.r.width, s.r.height]).toEqual([m.w, m.h]);
  expect(s.w).toBe(m.w / HD_SCALE); expect(s.h).toBe(m.h / HD_SCALE);
  expect(s.hd).toBe(true); expect(s.missing).toBe(true); expect(s.anchor).toBe(m.anchor); expect(s.l).toBe(s.r);
  expect([...s.r.fills].sort()).toEqual([...PLACEHOLDER_COLORS].sort());
  // 市松がキャンバス全体を覆う（矩形の面積の合計 = w×h、はみ出しなし）
  expect(s.r.rects.reduce((a, [, , w, h]) => a + w * h, 0)).toBe(m.w * m.h);
  for (const [x, y, w, h] of s.r.rects) { expect(x + w).toBeLessThanOrEqual(m.w); expect(y + h).toBeLessThanOrEqual(m.h); }
});

test('placeholder never has a zero size, even for a manifest entry without w/h', () => {
  const s = placeholderSprite({ src: 'x.png' }, fakeCanvas);
  expect(s.r.width).toBeGreaterThan(0); expect(s.r.height).toBeGreaterThan(0); expect(s.missing).toBe(true);
});

test('every manifest entry carries the w/h the placeholder relies on', () => {
  for (const [k, m] of Object.entries(manifest)) { expect(m.w, k).toBeGreaterThan(0); expect(m.h, k).toBeGreaterThan(0); }
});

test('the string-sprite fallback (src/gfx/sprites) stays removed: sprites come from the manifest or are placeholders (DEBT-003)', () => {
  expect(existsSync('src/gfx/sprites')).toBe(false);
});
