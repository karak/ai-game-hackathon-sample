import { test, expect } from 'vitest';
import { SONGS, NOTE } from '../src/audio.js';

test('every song note name resolves to a frequency and tracks are 16-step aligned', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    expect(song.bpm, name).toBeGreaterThan(40);
    for (const ch of ['lead', 'lead2', 'bass']) {
      const seq = song[ch]; if (!seq) continue;
      expect(seq.length % 16, `${name}.${ch} length`).toBe(0);
      for (const n of seq) if (n !== '-' && n !== '.') expect(NOTE[n], `${name}.${ch} note ${n}`).toBeGreaterThan(20);
    }
    if (song.drums) for (const d of song.drums) expect(['k', 's', 'h', '-']).toContain(d);
  }
});

test('flat and sharp spellings map to the same pitch', () => {
  expect(NOTE['Bb2']).toBeCloseTo(NOTE['A#2'], 6);
  expect(NOTE['A4']).toBeCloseTo(440, 6);
});
