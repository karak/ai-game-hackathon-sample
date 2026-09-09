import { test, expect } from 'vitest';
import { loadDeathLog, saveDeathLog, pushDeath, summarizeDeaths, DEATH_KEY, DEATH_MAX } from '../src/deathlog.js';

const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)) }; };

test('push → save → load round-trips entries and normalizes fields', () => {
  const st = mem();
  let log = pushDeath([], { s: 'stage1', x: 100.6, y: 40.2, r: 'fall', t: 12.4, l: 0, at: 1000 });
  log = pushDeath(log, { s: 'stage1', x: 130, y: 40, r: 'weird', t: 3 });
  expect(saveDeathLog(log, st)).toBe(true);
  const back = loadDeathLog(st);
  expect(back).toHaveLength(2);
  expect(back[0]).toEqual({ s: 'stage1', x: 101, y: 40, r: 'fall', t: 12, l: 0, at: 1000 });
  expect(back[1].r).toBe('hit'); // 未知の原因は hit に丸める
  expect(JSON.parse(st.getItem(DEATH_KEY))).toHaveLength(2);
});

test('log is capped at DEATH_MAX, dropping the oldest; corrupt storage loads as empty', () => {
  let log = [];
  for (let i = 0; i < DEATH_MAX + 5; i++) log = pushDeath(log, { s: 's', x: i, y: 0, r: 'hit', t: 0 });
  expect(log).toHaveLength(DEATH_MAX); expect(log[0].x).toBe(5);
  const st = mem(); st.setItem(DEATH_KEY, '{not json');
  expect(loadDeathLog(st)).toEqual([]);
  st.setItem(DEATH_KEY, JSON.stringify([{ s: 'a', x: 1, y: 2 }, { nope: 1 }, 'x']));
  expect(loadDeathLog(st)).toEqual([{ s: 'a', x: 1, y: 2, r: 'hit', t: 0, l: 0, at: 0 }]);
});

test('summarizeDeaths counts per stage / reason and ranks 64-unit hotspots', () => {
  const log = [
    { s: 'A', x: 70, y: 0, r: 'fall' }, { s: 'A', x: 90, y: 0, r: 'fall' }, { s: 'A', x: 100, y: 0, r: 'hit' },
    { s: 'A', x: 500, y: 0, r: 'spike' }, { s: 'B', x: 10, y: 0, r: 'hit' },
  ].map(e => ({ t: 0, l: 0, at: 0, ...e }));
  const sum = summarizeDeaths(log);
  expect(sum.total).toBe(5);
  expect(sum.byStage.A.total).toBe(4); expect(sum.byStage.A.byReason).toEqual({ fall: 2, hit: 1, spike: 1 });
  expect(sum.byStage.A.hotspots[0]).toEqual({ x0: 64, n: 3 });
  expect(sum.byStage.B.hotspots).toEqual([{ x0: 0, n: 1 }]);
});
