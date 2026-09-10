import { test, expect } from 'vitest';
import { loadRuns, saveRuns, newRun, pushRun, summarizeRuns, buildReport, RUN_KEY, RUN_MAX } from '../src/app/runlog.js';

const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('runs round-trip through storage, garbage is dropped, cap is RUN_MAX', () => {
  const st = memStorage();
  let runs = [];
  for (let i = 0; i < RUN_MAX + 5; i++) runs = pushRun(runs, { ...newRun({ at: i, start: 0 }), stage: i % 8 });
  expect(runs.length).toBe(RUN_MAX); expect(runs[0].at).toBe(5);
  expect(saveRuns(runs, st)).toBe(true);
  expect(loadRuns(st)).toEqual(runs);
  expect(loadRuns(memStorage({ [RUN_KEY]: 'not json' }))).toEqual([]);
  expect(loadRuns(memStorage({ [RUN_KEY]: JSON.stringify([1, null, { at: 3, stage: 'x' }]) }))).toEqual([{ at: 3, end: null, loop: 0, start: 0, stage: 0, cleared: false, deaths: 0, continues: 0, sec: 0, lang: 'ja' }]);
});

test('summarizeRuns: clear rate, mean time of cleared runs, per-stage reach counts', () => {
  const a = { ...newRun({ start: 0 }), stage: 7, cleared: true, sec: 3600, deaths: 10, end: 1 };
  const b = { ...newRun({ start: 0 }), stage: 2, deaths: 6, continues: 2, end: 1 };
  const c = { ...newRun({ start: 3 }), stage: 4, deaths: 1 };              // 「つづきから」第四章開始、進行中
  const s = summarizeRuns([a, b, c]);
  expect(s).toMatchObject({ runs: 3, finished: 2, cleared: 1, clearRate: 0.33, meanSec: 3600, deaths: 17, continues: 2 });
  expect(s.reached).toEqual([2, 2, 2, 2, 2, 1, 1, 1]);                     // 章 1〜3 は a・b、章 4〜5 は a・c、章 6〜8 は a のみ
  expect(summarizeRuns([]).clearRate).toBeNull();
});

test('buildReport is valid JSON with version, env, run summary and death summary; no raw personal data fields', () => {
  const runs = [{ ...newRun({ start: 0, lang: 'en' }), stage: 1, deaths: 2, sec: 120, end: 5 }];
  const txt = buildReport({ runs, deaths: [{ s: 'graveyard', r: 'hit' }], settings: { volume: 7, muted: false, lang: 'en', progress: { stage: 1, cleared: false } }, env: { version: 'abc123', ua: 'UA', lang: 'en-US', screen: '390x844', pad: 'Fake Pad', now: 0 }, summarizeDeaths: d => ({ count: d.length, byReason: { hit: 1 } }) });
  const j = JSON.parse(txt);
  expect(j.report).toBe(1); expect(j.version).toBe('abc123'); expect(j.at).toBe('1970-01-01T00:00:00.000Z');
  expect(j.env).toEqual({ ua: 'UA', lang: 'en-US', screen: '390x844', pad: 'Fake Pad', touch: false });
  expect(j.runs).toMatchObject({ runs: 1, cleared: 0, deaths: 2 }); expect(j.runList).toHaveLength(1);
  expect(j.deaths).toEqual({ count: 1, byReason: { hit: 1 } });
  expect(Object.keys(j).sort()).toEqual(['at', 'deaths', 'env', 'report', 'runList', 'runs', 'settings', 'version']);
});
