import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t, setLang, getLang, detectLang, EN, LANGS, pick } from '../src/shared/i18n.js';
import { story, PROLOGUE, PROLOGUE_EN, ENDING_SCENES, ENDING_SCENES_EN, ENDING_TRUE, ENDING_TRUE_EN, CREDITS, CREDITS_EN, BOSS_NAMES } from '../src/content/story.js';
import { STAGES } from '../src/content/levels/index.js';
import { ACTION_LABEL, REBINDABLE, loadSettings, saveSettings, STORAGE_KEY } from '../src/app/settings.js';
import { MAGIC, SUPER, magicName } from '../src/stage/entities/magic.js';

const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });

test('t() returns the Japanese key in ja and the dictionary entry in en; variables are substituted; unknown keys pass through', () => {
  setLang('ja'); expect(t('はじめから')).toBe('はじめから'); expect(t('つづきから（第{n}章）', { n: 3 })).toBe('つづきから（第3章）');
  setLang('en'); expect(t('はじめから')).toBe('New Game'); expect(t('つづきから（第{n}章）', { n: 3 })).toBe('Continue (Chapter 3)');
  expect(t('（辞書に無い文字列）')).toBe('（辞書に無い文字列）');
  expect(setLang('xx')).toBe('ja'); expect(getLang()).toBe('ja');
});

test('every literal passed to t() in src/ has an English entry', () => {
  const missing = [];
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) { const key = m[1].replace(/\\'/g, "'"); if (!(key in EN)) missing.push(`${file}: ${key}`); }
  }
  expect(missing).toEqual([]);
});

test('stage titles/subtitles, boss names and rebindable action labels are all translated', () => {
  const missing = [];
  for (const st of STAGES) for (const k of [st.title, st.subtitle]) if (!(k in EN)) missing.push(k);
  for (const n of Object.values(BOSS_NAMES)) if (!(n in EN)) missing.push(n);
  for (const a of REBINDABLE) if (!(ACTION_LABEL[a] in EN)) missing.push(ACTION_LABEL[a]);
  expect(missing).toEqual([]);
  setLang('en'); expect(t(STAGES[0].title)).toMatch(/^Chapter 1/); expect(t(BOSS_NAMES.noir)).toContain('Noir');
  for (const v of Object.values(EN)) expect(v.trim().length, v).toBeGreaterThan(0);
  setLang('ja');
});

test('magic names (charge L1 and super L2) are all translated and reachable through magicName()', () => {
  const missing = [];
  for (const m of [MAGIC, SUPER]) for (const v of Object.values(m)) if (!(v.name in EN)) missing.push(v.name);
  expect(missing).toEqual([]);
  setLang('en');
  expect(t(magicName('star', 1))).toBe('Meteor Shower'); expect(t(magicName('star', 2))).toBe('Stardust Cortege');
  expect(t(magicName('candle', 2))).toBe('Wax Choir');
  setLang('ja');
  expect(magicName('knife', 2)).toBe('鏡像の舞踏会'); expect(magicName('nope', 2)).toBe('');
});

test('story(): English texts mirror the Japanese structure (same scene count, same line counts per scene, same credits length)', () => {
  expect(PROLOGUE_EN.length).toBe(PROLOGUE.length);
  expect(ENDING_SCENES_EN.length).toBe(ENDING_SCENES.length);
  ENDING_SCENES.forEach((sc, i) => expect(ENDING_SCENES_EN[i].length, `scene ${i + 1}`).toBe(sc.length));
  expect(ENDING_TRUE_EN.length).toBe(ENDING_TRUE.length);
  expect(CREDITS_EN.length).toBe(CREDITS.length);
  expect(CREDITS_EN.at(-1)).toBe('THANK YOU FOR PLAYING');
  setLang('en'); expect(story().prologue).toBe(PROLOGUE_EN); expect(story().scenes).toBe(ENDING_SCENES_EN);
  setLang('ja'); expect(story().prologue).toBe(PROLOGUE); expect(pick({ ja: 1, en: 2 })).toBe(1);
});

test('settings: lang defaults from navigator.language, is saved and reloaded, hostile values fall back', () => {
  expect(detectLang({ language: 'ja-JP' })).toBe('ja'); expect(detectLang({ language: 'en-US' })).toBe('en'); expect(detectLang({ language: 'fr' })).toBe('en'); expect(detectLang(null)).toBe('ja');
  expect(loadSettings(memStorage(), { language: 'en-GB' }).lang).toBe('en');
  expect(loadSettings(memStorage(), { language: 'ja' }).lang).toBe('ja');
  const st = memStorage(); const s = loadSettings(st, { language: 'ja' }); s.lang = 'en'; saveSettings(s, st);
  expect(JSON.parse(st.m.get(STORAGE_KEY)).lang).toBe('en');
  expect(loadSettings(st, { language: 'ja' }).lang).toBe('en'); // 保存済みの言語はブラウザ言語より優先
  expect(loadSettings(memStorage({ [STORAGE_KEY]: JSON.stringify({ lang: 'klingon' }) }), { language: 'ja' }).lang).toBe('ja');
  for (const l of LANGS) expect(['ja', 'en']).toContain(l);
});
