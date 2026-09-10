import { test, expect } from 'vitest';
import { SONGS, NOTE, songSteps, arpNote, CH_VOL } from '../src/platform/audio.js';

test('every song note name resolves to a frequency and tracks are 16-step aligned', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    expect(song.bpm, name).toBeGreaterThan(40);
    for (const ch of ['lead', 'lead2', 'bass']) {
      const seq = song[ch]; if (!seq) continue;
      expect(seq.length % 16, `${name}.${ch} length`).toBe(0);
      for (const n of seq) if (n !== '-' && n !== '.') expect(NOTE[n], `${name}.${ch} note ${n}`).toBeGreaterThan(20);
    }
    if (song.drums) for (const d of song.drums) expect(['k', 's', 'h', '-']).toContain(d);
    if (song.arp) { expect(song.arp.length % 16, `${name}.arp length`).toBe(0); for (const c of song.arp) if (c !== '-' && c !== '.') for (const n of c.split(' ')) expect(NOTE[n], `${name}.arp ${n}`).toBeGreaterThan(20); }
    if (song.echo) { expect(song.echo.steps).toBeGreaterThan(0); expect(song.echo.gain).toBeLessThan(1); }
  }
});

test('jingles (once) exist for start / clear / death / game over and are 16-32 steps; final boss song exists', () => {
  for (const k of ['jStart', 'jClear', 'jDeath', 'jGameOver']) { expect(SONGS[k], k).toBeTruthy(); expect(songSteps(SONGS[k]), k).toBeGreaterThanOrEqual(16); expect(songSteps(SONGS[k]), k).toBeLessThanOrEqual(32); }
  expect(SONGS.bossFinal.bpm).toBeGreaterThan(SONGS.boss.bpm); expect(songSteps(SONGS.bossFinal)).toBe(64);
  // 8 章すべてにテーマ曲がある
  for (const th of ['graveyard', 'candyforest', 'castle', 'river', 'workshop', 'park', 'tower', 'stars']) expect(SONGS[th], th).toBeTruthy();
});

test('arpNote cycles the chord tones per step and carries the chord through "."', () => {
  const seq = ['C3 E3 G3', '.', '.', '.', '-', '.', 'A2 C3', '.'];
  expect([0, 1, 2, 3].map(s => arpNote(seq, s))).toEqual(['C3', 'E3', 'G3', 'C3']);
  expect(arpNote(seq, 4)).toBeNull(); expect(arpNote(seq, 5)).toBeNull(); // 休符とその継続
  expect(arpNote(seq, 6)).toBe('A2'); expect(arpNote(seq, 7)).toBe('C3'); // 2 音の和音は step 偶奇で回る（step 6 → 0 番目）
  expect(CH_VOL.arp).toBeLessThan(CH_VOL.lead);
});

test('flat and sharp spellings map to the same pitch', () => {
  expect(NOTE['Bb2']).toBeCloseTo(NOTE['A#2'], 6);
  expect(NOTE['A4']).toBeCloseTo(440, 6);
});
