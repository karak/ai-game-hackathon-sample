import { test, expect } from 'vitest';
import { wrap, measure, LAYOUT, UI_PX, FONT_PX } from '../src/ui/layout.js';
const FW = 16 * FONT_PX / UI_PX; // 全角 1 文字の論理幅（16px 指定時）

// g.font のサイズを読み、全角 = size px、半角 = size/2 px とみなす疑似コンテキスト
function fakeCtx() {
  const ctx = { font: '32px x' };
  ctx.measureText = s => { const size = parseFloat(ctx.font); return { width: [...s].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x100 ? size / 2 : size), 0) }; };
  return ctx;
}

test('measure uses the canvas measureText width', () => {
  expect(measure(fakeCtx(), 'あい', 16)).toBe(Math.ceil(2 * FW));
  expect(measure(fakeCtx(), 'ab', 16)).toBe(Math.ceil(FW));
});

test('Japanese text without spaces wraps by character within maxWidth', () => {
  const g = fakeCtx();
  const maxW = Math.ceil(10 * FW); // 10 文字/行
  const lines = wrap(g, 'あいうえおかきくけこさしすせそたちつてと', maxW);
  expect(lines).toEqual(['あいうえおかきくけこ', 'さしすせそたちつてと']);
  for (const l of lines) expect(measure(g, l)).toBeLessThanOrEqual(maxW);
});

test('Japanese text containing a space still wraps long runs by character', () => {
  const g = fakeCtx();
  const maxW = Math.ceil(14 * FW);
  const lines = wrap(g, 'これは長いテロップの折り返しテストです。実測幅で 240px 以内に収まります。', maxW);
  for (const l of lines) expect(measure(g, l), l).toBeLessThanOrEqual(maxW);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.join('').replace(/ /g, '')).toBe('これは長いテロップの折り返しテストです。実測幅で240px以内に収まります。');
});

test('ASCII text wraps at word boundaries', () => {
  const lines = wrap(fakeCtx(), 'PUSH START TO PLAY THE GAME', Math.ceil(10 * FW / 2)); // 半角 10 文字
  expect(lines).toEqual(['PUSH START', 'TO PLAY', 'THE GAME']);
});

test('explicit newlines are honoured and short text is untouched', () => {
  expect(wrap(fakeCtx(), 'ab\ncd', 100)).toEqual(['ab', 'cd']);
  expect(wrap(fakeCtx(), 'short', 100)).toEqual(['short']);
});

test('layout constants keep a 14-char body line inside the safe area', () => {
  expect(LAYOUT.W - LAYOUT.MARGIN * 2 - LAYOUT.PAD * 2).toBeGreaterThanOrEqual(Math.ceil(14 * FW));
});
