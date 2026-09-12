// tools/log_stats.mjs（Sprint R / R4）: 固定の NDJSON から到達ファネル・死亡・エラー・性能の表が出る
import { test, expect } from 'vitest';
import { parseLines, stats, render } from '../tools/log_stats.mjs';

const S1 = 'a'.repeat(32), S2 = 'b'.repeat(32), B = 'c'.repeat(32);
const ev = (sid, seq, code, o = {}) => JSON.stringify({ v: 1, ts: '2026-09-12T03:00:00.000Z', t: seq * 1000, sid, seq, rid: null, src: 'user', lvl: 'info', code, msg: '', build: 'b1', ...o });
const NDJSON = [
  ev(S1, 1, 'SESSION.START', { attr: { env: { lang: 'ja', vw: 800, vh: 600, pad: 'Pad', touch: false } } }),
  ev(S1, 2, 'RUN.START', { attr: { start: 0, loop: 0, mode: 'new' } }),
  ev(S1, 3, 'STAGE.START', { attr: { stage: 'stage1', index: 0 } }),
  ev(S1, 4, 'PLAYER.DEATH', { attr: { stage: 'stage1', reason: 'bog', x: 700, y: 176 }, ctx: { stage: 'stage1' } }),
  ev(S1, 5, 'PLAYER.DEATH', { attr: { reason: 'hit', x: 710, y: 100 }, ctx: { stage: 'stage1' } }),
  ev(S1, 6, 'STAGE.CLEAR', { attr: { stage: 'stage1', sec: 80, deaths: 2 } }),
  ev(S1, 7, 'STAGE.START', { attr: { stage: 'stage2', index: 1 } }),
  ev(S1, 8, 'PERF.FRAME', { attr: { fps_p50: 60, fps_p95: 48, long: 3, frames: 1800 } }),
  ev(S1, 10, 'ERR.UNCAUGHT', { lvl: 'error', err: { name: 'TypeError', message: 'x is not a function' } }), // seq 9 が欠けている
  ev(S1, 11, 'RUN.END', { attr: { reached: 1, cleared: false, deaths: 2, continues: 0, sec: 200 } }),
  ev(S2, 1, 'SESSION.START', { attr: { env: { lang: 'en', vw: 390, vh: 844, pad: null, touch: true } } }),
  ev(S2, 2, 'RUN.START', { attr: { start: 0 } }), ev(S2, 3, 'STAGE.START', { attr: { stage: 'stage1' } }), ev(S2, 4, 'ASSET.FAIL', { lvl: 'warn', msg: 'load failed x.png', attr: { path: 'x.png' } }),
  ev(B, 1, 'RUN.START', { src: 'bot', attr: { test: 'golden' } }), ev(B, 2, 'STAGE.START', { src: 'bot', attr: { test: 'golden', stage: 'stage1' } }), ev(B, 3, 'STAGE.CLEAR', { src: 'bot', attr: { test: 'golden', stage: 'stage1' } }),
  'not json', '{"no":"code"}',
].join('\n');

test('parseLines accepts NDJSON (skipping junk) and JSON arrays', () => {
  const evs = parseLines(NDJSON); expect(evs.length).toBe(17);
  expect(parseLines(JSON.stringify([{ code: 'A.B' }, { nope: 1 }])).length).toBe(1); expect(parseLines('')).toEqual([]);
});

test('stats: sessions (gaps, reached, cleared, deaths, errors, p95), funnel, deaths by stage × reason with x buckets, errors, perf; bots excluded by default', () => {
  const r = stats(parseLines(NDJSON));
  expect(r.events).toBe(14); expect(r.bySrc).toEqual({ user: 14, bot: 3 });
  expect(stats(parseLines(NDJSON), { src: 'bot' }).events).toBe(3);
  expect(r.sessions.length).toBe(2);
  expect(r.sessions[0]).toEqual({ sid: 'aaaaaaaa', src: 'user', build: 'b1', test: null, env: 'ja 800x600 pad', events: 10, edge: 0, gaps: 1, runs: 1, reached: 2, cleared: 1, ended: 0, deaths: 2, errors: 1, fps_p95_min: 48, sec: 10 });
  expect(r.sessions[1]).toMatchObject({ sid: 'bbbbbbbb', env: 'en 390x844 touch', events: 4, gaps: 0, reached: 1, cleared: 0, deaths: 0, errors: 0, fps_p95_min: null });
  expect(r.funnel).toEqual({ stage1: { started: 2, cleared: 1 }, stage2: { started: 1, cleared: 0 } });
  expect(r.deaths).toEqual({ stage1: { total: 2, byReason: { bog: 1, hit: 1 }, xs: { 640: 1, 704: 1 } } }); // 700 → 640、710 → 704 の 64 px 刻み
  expect(r.errors).toEqual({ 'ERR.UNCAUGHT TypeError x is not a function': 1, 'ASSET.FAIL  load failed x.png': 1 });
  expect(r.perf).toEqual({ samples: 1, fps_p95_min: 48, fps_p95_median: 48, long: 3 });
  const bots = stats(parseLines(NDJSON), { src: 'bot' }); expect(bots.sessions).toEqual([expect.objectContaining({ sid: 'cccccccc', src: 'bot', test: 'golden', reached: 1, cleared: 1 })]);
  expect(stats(parseLines(NDJSON), { src: 'all' }).sessions.length).toBe(3);
  const txt = render(r); expect(txt).toContain('stage1           started 2    cleared 1'); expect(txt).toContain('bog=1 hit=1  x: 640:1 704:1'); expect(txt).toContain('fps p95 min 48');
});
