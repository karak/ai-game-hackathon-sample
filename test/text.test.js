import { test, expect } from 'vitest';
import { wrap, measure, LAYOUT } from '../src/ui/layout.js';

// 全角 = size px、半角 = size/2 px とみなす疑似コンテキスト
function fakeCtx(size = 16) {
  return { font: '', measureText: s => ({ width: [...s].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x100 ? size / 2 : size), 0) }) };
}

test('measure uses the canvas measureText width', () => {
  expect(measure(fakeCtx(), 'あい', 16)).toBe(32);
  expect(measure(fakeCtx(), 'ab', 16)).toBe(16);
});

test('Japanese text without spaces wraps by character within maxWidth', () => {
  const g = fakeCtx();
  const lines = wrap(g, 'あいうえおかきくけこさしすせそたちつてと', 160); // 10 文字/行
  expect(lines).toEqual(['あいうえおかきくけこ', 'さしすせそたちつてと']);
  for (const l of lines) expect(measure(g, l)).toBeLessThanOrEqual(160);
});

test('Japanese text containing a space still wraps long runs by character', () => {
  const g = fakeCtx();
  const lines = wrap(g, 'これは長いテロップの折り返しテストです。実測幅で 240px 以内に収まります。', 224);
  for (const l of lines) expect(measure(g, l), l).toBeLessThanOrEqual(224);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.join('').replace(/ /g, '')).toBe('これは長いテロップの折り返しテストです。実測幅で240px以内に収まります。');
});

test('ASCII text wraps at word boundaries', () => {
  const lines = wrap(fakeCtx(), 'PUSH START TO PLAY THE GAME', 80); // 10 half-width chars
  expect(lines).toEqual(['PUSH START', 'TO PLAY', 'THE GAME']);
});

test('explicit newlines are honoured and short text is untouched', () => {
  expect(wrap(fakeCtx(), 'ab\ncd', 100)).toEqual(['ab', 'cd']);
  expect(wrap(fakeCtx(), 'short', 100)).toEqual(['short']);
});

test('layout constants keep a body line inside the safe area', () => {
  expect(LAYOUT.W - LAYOUT.MARGIN * 2 - LAYOUT.PAD * 2).toBeGreaterThanOrEqual(14 * LAYOUT.FONT);
});
