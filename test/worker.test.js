// Cloudflare Worker（worker/index.js、Sprint R / R3）: /api/log の受け入れ・拒否と、1 イベント 1 行の出力を Node の Request で検査する
import { test, expect } from 'vitest';
import worker, { handleLog, validateEvent, MAX_BYTES, MAX_EVENTS } from '../worker/index.js';

const SID = 'abcdef0123456789abcdef0123456789';
const ev = (o = {}) => ({ v: 1, ts: '2026-09-12T03:00:00.000Z', t: 100, sid: SID, seq: 1, rid: 'r'.repeat(32), src: 'user', lvl: 'info', code: 'RUN.START', msg: 'm', attr: { start: 0 }, build: 'b1', ...o });
const post = (body, headers = {}) => new Request('https://x/api/log', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', 'cf-ray': '8a1b2c3d-NRT', ...headers } });
const run = async (req, cf = { country: 'JP' }) => { const lines = []; const res = await handleLog(req, { now: () => '2026-09-12T03:00:01.000Z', out: l => lines.push(JSON.parse(l)), cf }); return { res, lines }; };

test('a valid batch → 204; every event is one JSON line with rid_ray / country / received, followed by EDGE.LOG_BATCH', async () => {
  const { res, lines } = await run(post([ev(), ev({ seq: 2, code: 'STAGE.START', lvl: 'info' })]));
  expect(res.status).toBe(204); expect(lines.length).toBe(3);
  expect(lines[0]).toEqual({ ...ev(), rid_ray: '8a1b2c3d-NRT', country: 'JP', received: '2026-09-12T03:00:01.000Z' });
  expect(lines[1].seq).toBe(2);
  expect(lines[2]).toMatchObject({ v: 1, src: 'worker', lvl: 'info', code: 'EDGE.LOG_BATCH', sid: SID, rid: '8a1b2c3d-NRT', attr: { events: 2, country: 'JP', ray: '8a1b2c3d-NRT', src: 'user' } });
  expect(lines[2].attr.bytes).toBe(JSON.stringify([ev(), ev({ seq: 2, code: 'STAGE.START', lvl: 'info' })]).length);
  const single = await run(post(ev({ src: 'bot' }))); expect(single.res.status).toBe(204); expect(single.lines[1].attr.src).toBe('bot'); // 配列でない 1 件も受ける
  const noCf = await run(post([ev()]), null); expect(noCf.lines[0].country).toBeNull();
});

test('rejections: 405 on GET, 413 over 64 KB (declared or actual), 400 on bad json / empty / too many / schema violations — each with one EDGE.LOG_REJECT line', async () => {
  const get = await run(new Request('https://x/api/log')); expect(get.res.status).toBe(405); expect(get.res.headers.get('allow')).toBe('POST'); expect(get.lines).toEqual([]);
  const declared = await run(post([ev()], { 'content-length': String(MAX_BYTES + 1) })); expect(declared.res.status).toBe(413); expect(declared.lines[0]).toMatchObject({ code: 'EDGE.LOG_REJECT', lvl: 'warn', attr: { why: 'payload too large', bytes: MAX_BYTES + 1 } });
  const big = await run(post([ev({ msg: 'x'.repeat(MAX_BYTES) })])); expect(big.res.status).toBe(413);
  const bad = await run(post('{not json')); expect(bad.res.status).toBe(400); expect(bad.lines[0].attr.why).toBe('invalid json');
  expect((await run(post([]))).res.status).toBe(400);
  expect((await run(post(Array.from({ length: MAX_EVENTS + 1 }, () => ev())))).lines[0].attr.why).toBe(`too many events (${MAX_EVENTS + 1})`);
  const schema = await run(post([ev(), ev({ sid: 'short' })])); expect(schema.res.status).toBe(400); expect(schema.lines[0].attr.why).toBe('event 1: bad sid'); expect(await schema.res.text()).toBe('event 1: bad sid');
});

test('validateEvent names the first broken field', () => {
  expect(validateEvent(ev())).toBeNull();
  expect(validateEvent(null)).toBe('not an object'); expect(validateEvent([1])).toBe('not an object');
  expect(validateEvent(ev({ v: 2 }))).toBe('bad v'); expect(validateEvent(ev({ code: 'lower.case' }))).toBe('bad code'); expect(validateEvent(ev({ lvl: 'fatal' }))).toBe('bad lvl');
  expect(validateEvent(ev({ seq: -1 }))).toBe('bad seq'); expect(validateEvent(ev({ seq: 1.5 }))).toBe('bad seq'); expect(validateEvent(ev({ ts: 'yesterday' }))).toBe('bad ts'); expect(validateEvent(ev({ src: 'alien' }))).toBe('bad src');
});

test('fetch routes /api/log to the handler, other /api/* to 404, everything else to the ASSETS binding', async () => {
  const seen = []; const env = { ASSETS: { fetch: r => { seen.push(new URL(r.url).pathname); return new Response('asset', { status: 200 }); } } };
  const logged = []; const orig = console.log; console.log = l => logged.push(l);
  try {
    expect((await worker.fetch(post([ev()]), env)).status).toBe(204); expect(logged.length).toBe(2);
    expect((await worker.fetch(new Request('https://x/api/other'), env)).status).toBe(404);
    const a = await worker.fetch(new Request('https://x/index.html'), env); expect(await a.text()).toBe('asset'); expect(seen).toEqual(['/index.html']);
  } finally { console.log = orig; }
});
