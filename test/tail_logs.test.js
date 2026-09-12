// tools/tail_logs.mjs（Sprint R / R4）: wrangler tail の整形済み JSON ストリームから LogEvent を取り出す
import { test, expect } from 'vitest';
import { extractObjects, eventsFromTail } from '../tools/tail_logs.mjs';

const ev = JSON.stringify({ v: 1, code: 'RUN.START', msg: 'has } brace and "quote"', sid: 'a'.repeat(32) });
const req = (logs) => JSON.stringify({ outcome: 'ok', logs, event: { request: { url: 'https://x/api/log', headers: { 'cf-ray': 'r1' } } } }, null, 4);

test('extractObjects splits top-level objects across chunks and ignores braces inside strings', () => {
  const a = req([{ message: [ev], level: 'log' }]), b = req([]);
  const text = a + '\n' + b + '\n' + '{"partial": {"x": 1';
  const cut = Math.floor(a.length / 2);
  const [o1, r1] = extractObjects(text.slice(0, cut)); expect(o1).toEqual([]); expect(r1.length).toBe(cut);
  const [o2, r2] = extractObjects(r1 + text.slice(cut)); expect(o2.length).toBe(2); expect(JSON.parse(o2[0]).logs[0].message[0]).toBe(ev); expect(r2).toBe('{"partial": {"x": 1');
  const [o3] = extractObjects(r2 + '}}'); expect(o3).toEqual(['{"partial": {"x": 1}}']);
});

test('eventsFromTail keeps JSON messages with a code and counts the rest as skipped', () => {
  const r = eventsFromTail({ logs: [{ message: [ev, 'plain text', '{"no":"code"}', 42] }, { message: [JSON.stringify({ code: 'EDGE.LOG_BATCH' })] }] });
  expect(r.events.map(e => e.code)).toEqual(['RUN.START', 'EDGE.LOG_BATCH']); expect(r.skipped).toBe(3);
  expect(eventsFromTail({ logs: [] })).toEqual({ events: [], skipped: 0 }); expect(eventsFromTail(null)).toEqual({ events: [], skipped: 0 });
});
