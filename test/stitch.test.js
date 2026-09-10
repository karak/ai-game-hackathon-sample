import { test, expect } from 'vitest';
import { stitch } from '../src/content/levels/stitch.js';

test('stitch joins segments row by row', () => {
  expect(stitch(['ab', 'cd'], ['e', 'f'])).toEqual(['abe', 'cdf']);
});
test('stitch rejects mismatched heights or ragged rows', () => {
  expect(() => stitch(['ab'], ['c', 'd'])).toThrow(/height/);
  expect(() => stitch(['ab', 'c'])).toThrow(/width/);
});
