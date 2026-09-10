import { test, expect } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, bind, codesFor, volumeGain, keyName, padName, DEFAULT_KEYS, DEFAULT_PAD, STORAGE_KEY, LEGACY_HI_KEY, REBINDABLE, ACTIONS } from '../src/app/settings.js';

const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('empty storage yields defaults (keys, pad, volume 7, not muted, stage 0)', () => {
  const s = loadSettings(memStorage());
  expect(s.keys).toEqual(DEFAULT_KEYS); expect(s.pad).toEqual(DEFAULT_PAD);
  expect(s.volume).toBe(7); expect(s.muted).toBe(false); expect(s.progress.stage).toBe(0); expect(s.hi).toBe(0);
});

test('save → load round-trips every field and writes to the single storage key', () => {
  const st = memStorage();
  const s = loadSettings(st);
  s.keys = bind(s.keys, 'jump', 'KeyL'); s.pad = bind(s.pad, 'shoot', 'b5'); s.volume = 3; s.muted = true; s.progress.stage = 2; s.hi = 12345;
  expect(saveSettings(s, st)).toBe(true);
  expect(st.m.has(STORAGE_KEY)).toBe(true);
  const back = loadSettings(st);
  expect(back).toEqual(s);
  expect(JSON.parse(st.m.get(STORAGE_KEY)).progress.stage).toBe(2);
});

test('corrupt or hostile stored data falls back to defaults per field', () => {
  expect(loadSettings(memStorage({ [STORAGE_KEY]: '{not json' })).volume).toBe(7);
  const s = loadSettings(memStorage({ [STORAGE_KEY]: JSON.stringify({ keys: { KeyQ: 'fly' }, pad: 'x', volume: 99, muted: 'yes', progress: { stage: -1 }, hi: -5 }) }));
  expect(s.keys).toEqual(DEFAULT_KEYS);           // 'fly' は不正、left/right/shoot/jump が欠けるので既定に戻す
  expect(s.pad).toEqual(DEFAULT_PAD);
  expect(s.volume).toBe(10); expect(s.muted).toBe(true); expect(s.progress.stage).toBe(0); expect(s.hi).toBe(0);
});

test('legacy lyrica_hi is migrated when larger than the saved hi', () => {
  const s = loadSettings(memStorage({ [LEGACY_HI_KEY]: '777' }));
  expect(s.hi).toBe(777);
  const s2 = loadSettings(memStorage({ [LEGACY_HI_KEY]: '5', [STORAGE_KEY]: JSON.stringify({ hi: 900 }) }));
  expect(s2.hi).toBe(900);
});

test('bind replaces all codes of the action and steals the code from other actions', () => {
  const m = bind(DEFAULT_KEYS, 'jump', 'KeyZ'); // Z was shoot
  expect(codesFor(m, 'jump')).toEqual(['KeyZ']);
  expect(codesFor(m, 'shoot')).toEqual(['KeyJ']);
  expect(m.KeyX).toBeUndefined(); expect(m.Space).toBeUndefined();
  for (const a of ACTIONS) expect(codesFor(m, a).length, a).toBeGreaterThanOrEqual(a === 'jump' ? 1 : 1);
});

test('REBINDABLE actions are a subset of ACTIONS and exclude start/mute', () => {
  for (const a of REBINDABLE) expect(ACTIONS).toContain(a);
  expect(REBINDABLE).not.toContain('start'); expect(REBINDABLE).not.toContain('mute');
});

test('volumeGain: 0 → silent, 7 → legacy 0.35, monotonic, clamped', () => {
  expect(volumeGain(0)).toBe(0); expect(volumeGain(7)).toBeCloseTo(0.35, 6);
  for (let v = 1; v <= 10; v++) expect(volumeGain(v)).toBeGreaterThan(volumeGain(v - 1));
  expect(volumeGain(99)).toBe(volumeGain(10)); expect(volumeGain(-3)).toBe(0);
});

test('display names strip prefixes', () => {
  expect(keyName('KeyZ')).toBe('Z'); expect(keyName('ArrowLeft')).toBe('←'); expect(keyName('Digit1')).toBe('1'); expect(keyName('Space')).toBe('SPACE');
  expect(padName('b0')).toBe('A'); expect(padName('b9')).toBe('START'); expect(padName('b20')).toBe('B20');
});

test('progress.cleared (2nd loop unlock) round-trips and defaults to false', () => {
  const m = new Map(); const st = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  const s = defaultSettings(); expect(s.progress.cleared).toBe(false);
  s.progress.cleared = true; s.progress.stage = 3; saveSettings(s, st);
  const back = loadSettings(st); expect(back.progress).toEqual({ stage: 3, cleared: true });
  m.set(STORAGE_KEY, JSON.stringify({ progress: { stage: 1, cleared: 'yes' } })); expect(loadSettings(st).progress.cleared).toBe(false);
});
