// 構造化ログ（Sprint R / R1）: src/shared/log.js の LogEvent と src/platform/telemetry.js の送信トリガを、偽の window と時計で検査する
import { test, expect } from 'vitest';
import { Log, LIMITS, cleanAttr, serializeError, clip } from '../src/shared/log.js';
import { LOG_CODES, LEVELS } from '../src/shared/logcodes.js';
import { Telemetry, splitBatches, sessionId, envInfo, telemetryEnabled, SID_KEY } from '../src/platform/telemetry.js';

const mk = (o = {}) => new Log({ sid: 'abcdef0123456789abcdef0123456789', now: () => 1_700_000_000_000, clock: () => 1234.6, build: 'b1', ...o });

test('LogEvent has the schema keys, registered lvl, clipped msg, cleaned ctx/attr and the build', () => {
  const l = mk(); l.bind(() => ({ state: 'play', stage: 'stage2', x: 12.3456, name: 'PII', nested: { deep: { too: 1 } } }));
  const ev = l.emit('PLAYER.DEATH', 'x'.repeat(300), { reason: 'bog', by: 'zombie', email: 'a@b', f: 1.006 });
  expect(Object.keys(ev)).toEqual(['v', 'ts', 't', 'sid', 'seq', 'rid', 'src', 'lvl', 'code', 'msg', 'ctx', 'attr', 'build']);
  expect(ev).toMatchObject({ v: 1, ts: '2023-11-14T22:13:20.000Z', t: 1235, sid: 'abcdef0123456789abcdef0123456789', seq: 1, rid: null, src: 'user', lvl: 'info', code: 'PLAYER.DEATH', build: 'b1' });
  expect(ev.msg.length).toBe(LIMITS.str); expect(ev.msg.endsWith('…')).toBe(true);
  expect(ev.ctx).toEqual({ state: 'play', stage: 'stage2', x: 12.35, nested: { deep: '[object Object]' } }); // PII 鍵 name は落ち、入れ子は 2 段まで
  expect(ev.attr).toEqual({ reason: 'bog', by: 'zombie', f: 1.01 });                                              // email は落ちる
  expect(l.stats.truncated).toBe(1); expect(l.dump().map(e => e.code)).toEqual(['PLAYER.DEATH', 'LOG.TRUNCATED']); // 切り詰めは 1 回だけ知らせる
  l.emit('STAGE.START', 'y'.repeat(300)); expect(l.dump().filter(e => e.code === 'LOG.TRUNCATED').length).toBe(1);
});

test('seq is consecutive, sid is shared, source tags merge into attr, unregistered code and bad level throw', () => {
  const l = mk(); l.setSource('bot', { test: 'golden', variant: 3 });
  const a = l.emit('RUN.START', '', { start: 0 }), b = l.emit('STAGE.START', '', { stage: 'stage1' });
  expect([a.seq, b.seq]).toEqual([1, 2]); expect(a.sid).toBe(b.sid); expect(a.src).toBe('bot');
  expect(b.attr).toEqual({ test: 'golden', variant: 3, stage: 'stage1' });
  expect(() => l.emit('NOPE.X')).toThrow(/unregistered/);
  expect(() => l.emit('RUN.START', '', null, { lvl: 'fatal' })).toThrow(/invalid log level/);
  expect(l.warn('SAVE.FAIL', 'w', { key: 'k' }, new Error('boom')).err).toMatchObject({ name: 'Error', message: 'boom' });
  expect(l.setSource('nonsense').src).toBe('user');
});

test('ring buffer keeps the last 500 events and counts drops; oversize events shed attr/ctx/stack to stay under 2 KB', () => {
  const l = mk({ buffer: 5 });
  for (let i = 0; i < 8; i++) l.emit('GAME.STATE', 'st' + i);
  expect(l.dump().map(e => e.msg)).toEqual(['st3', 'st4', 'st5', 'st6', 'st7']); expect(l.stats.dropped).toBe(3); expect(l.dump(2).length).toBe(2);
  const big = {}; for (let i = 0; i < 20; i++) big['k' + i] = 'v'.repeat(190);
  const err = new Error('e'); err.stack = Array.from({ length: 40 }, (_, i) => 'at line ' + i).join('\n');
  const ev = l.error('ERR.UNCAUGHT', 'm', big, err);
  expect(JSON.stringify(ev).length).toBeLessThanOrEqual(LIMITS.eventBytes); expect(ev.attr).toBeUndefined(); expect(ev.err.stack).toBeUndefined(); expect(ev.err.message).toBe('e');
  expect(serializeError(new TypeError('t')).name).toBe('TypeError'); expect(serializeError('str')).toEqual({ name: 'Error', message: 'str' }); expect(serializeError(null)).toBeNull();
  expect(serializeError(Object.assign(new Error('s'), { stack: 'a\nb\nc\nd\ne' })).stack.split('\n').length).toBe(LIMITS.stackLines);
});

test('cleanAttr: PII keys, 20-key cap, arrays, non-finite numbers, non-object input', () => {
  const many = {}; for (let i = 0; i < 25; i++) many['a' + i] = i;
  const [c, t] = cleanAttr(many); expect(Object.keys(c).length).toBe(LIMITS.attrKeys); expect(t).toBe(true);
  expect(cleanAttr({ ip: '1.2.3.4', Token: 'x', ok: true, n: NaN, arr: [1, 'x'.repeat(100), { o: 1 }], fn: () => 1, u: undefined })[0]).toEqual({ ok: true, n: 'NaN', arr: [1, 'x'.repeat(59) + '…', '{"o":1}'] });
  expect(cleanAttr('nope')).toEqual([null, false]); expect(cleanAttr([1, 2])).toEqual([null, false]);
  expect(clip('abc', 2)).toBe('a…'); expect(clip(null)).toBe('');
});

test('every registered code has a valid default level and the level order is debug < info < warn < error', () => {
  for (const [code, lvl] of Object.entries(LOG_CODES)) { expect(code, code).toMatch(/^[A-Z]+\.[A-Z_]+$/); expect(LEVELS, code).toContain(lvl); }
  expect(LEVELS).toEqual(['debug', 'info', 'warn', 'error']);
});

// ---- telemetry（送信・console・トリガ）----
const fakeWin = () => {
  const listeners = {}; const doc = { visibilityState: 'visible', addEventListener: (k, f) => { (listeners['doc:' + k] ??= []).push(f); } };
  const win = { document: doc, addEventListener: (k, f) => { (listeners[k] ??= []).push(f); }, fire: (k, e) => (listeners[k] ?? []).forEach(f => f(e)), location: { href: 'http://x/index.html' }, navigator: { userAgent: 'UA'.repeat(200), language: 'ja', maxTouchPoints: 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 2 };
  return win;
};
const fakeTimers = () => { const t = { fns: [], setInterval: (fn, ms) => { t.fns.push({ fn, ms }); return t.fns.length; }, clearInterval: id => { t.fns[id - 1] = null; }, tick: () => t.fns.forEach(x => x?.fn()) }; return t; };
const fakeConsole = () => { const c = { calls: [] }; for (const k of ['debug', 'info', 'warn', 'error', 'log']) c[k] = (...a) => c.calls.push([k, ...a]); return c; };
const setup = (opts = {}) => {
  const l = mk(); const sent = []; const win = fakeWin(); const timers = fakeTimers(); const con = fakeConsole();
  const tm = new Telemetry(l, { win, timers, console: con, dev: false, send: (u, body) => { sent.push({ u, events: JSON.parse(body) }); return opts.fail ? false : true; }, ...opts }).start();
  return { l, tm, sent, win, timers, con };
};

test('telemetry sends on 50 events, on error immediately, on timer, on hidden (with SESSION.END) and on pagehide; debug is never sent; rid is shared inside a batch', () => {
  const { l, tm, sent, win, timers } = setup();
  for (let i = 0; i < 49; i++) l.emit('STAGE.START', 's' + i); l.emit('GAME.STATE', 'debug-not-sent');
  expect(sent.length).toBe(0);
  l.emit('STAGE.CLEAR', 'fifty'); expect(sent.length).toBe(1); expect(sent[0].events.length).toBe(50); expect(sent[0].u).toBe('/api/log');
  expect(new Set(sent[0].events.map(e => e.rid)).size).toBe(1); expect(sent[0].events[0].rid).toMatch(/^[0-9a-f]{32}$/); expect(sent[0].events.some(e => e.code === 'GAME.STATE')).toBe(false);
  expect(l.dump().find(e => e.msg === 's0').rid).toBe(sent[0].events[0].rid);   // バッファ内の同じオブジェクトにも rid
  l.emit('RUN.START', 'r'); expect(sent.length).toBe(1);
  l.error('ERR.UNCAUGHT', 'boom', null, new Error('boom')); expect(sent.length).toBe(2); expect(sent[1].events.map(e => e.code)).toEqual(['RUN.START', 'ERR.UNCAUGHT']);
  l.emit('RUN.START', 'r2'); timers.tick(); expect(sent.length).toBe(3); expect(timers.fns[0].ms).toBe(15_000);
  l.emit('RUN.START', 'r3'); win.document.visibilityState = 'hidden'; win.fire('doc:visibilitychange'); // 上の fakeWin では doc の listener は 'doc:' 接頭辞
  expect(sent.length).toBe(4); expect(sent[3].events.map(e => e.code)).toEqual(['RUN.START', 'SESSION.END']); expect(sent[3].events[1].attr.sec).toBe(0);
  l.emit('RUN.START', 'r4'); win.fire('pagehide'); expect(sent.length).toBe(5);
  expect(tm.api().stats()).toMatchObject({ sent: 56, batches: 5, sendFail: 0, queued: 0, enabled: true });
  tm.stop(); l.emit('RUN.START', 'after-stop'); expect(tm.queue.length).toBe(0);
});

test('window error / unhandledrejection become ERR.UNCAUGHT / ERR.PROMISE; disabled telemetry drops the queue but keeps the buffer; failures are counted and reported once via LOG.DROP', () => {
  const { l, tm, sent, win } = setup({ fail: true });
  win.fire('error', { message: 'x is not defined', filename: 'http://x/src/app/game.js', lineno: 3, colno: 4, error: new ReferenceError('x is not defined') });
  win.fire('unhandledrejection', { reason: new Error('rej') }); win.fire('unhandledrejection', { reason: 'plain' });
  // 2 回目以降の即時送信では、直前の失敗が LOG.DROP として同じバッチに添えられる
  expect(l.dump().map(e => [e.code, e.lvl, e.err?.name])).toEqual([['ERR.UNCAUGHT', 'error', 'ReferenceError'], ['ERR.PROMISE', 'error', 'Error'], ['LOG.DROP', 'warn', undefined], ['ERR.PROMISE', 'error', 'Error'], ['LOG.DROP', 'warn', undefined]]);
  expect(l.dump()[0].attr).toEqual({ file: 'game.js', line: 3, col: 4 });
  expect(sent.length).toBe(3); expect(tm.sendFail).toBe(3); // 送信は 3 回試みて全部失敗
  l.emit('RUN.START', 'r'); tm.flush('manual');
  const drop = sent[3].events.find(e => e.code === 'LOG.DROP'); expect(drop.attr).toMatchObject({ dropped: 0, sendFail: 3 }); expect(sent[3].events.map(e => e.code)).toEqual(['RUN.START', 'LOG.DROP']);
  l.emit('RUN.START', 'r'); tm.flush('manual'); expect(sent[4].events.map(e => e.code)).toEqual(['RUN.START', 'LOG.DROP']); // 失敗が増えたので再度知らせる
  tm.setEnabled(false); l.emit('RUN.START', 'off'); expect(tm.flush('manual')).toBe(0); expect(sent.length).toBe(5); expect(l.dump().at(-1).msg).toBe('off');
  expect(tm.api().setEnabled(true)).toBe(true);
});

test('console: production prints warn and above only, dev prints everything with the [LYR code sid8] prefix', () => {
  const { l, con } = setup(); l.emit('RUN.START', 'quiet'); l.emit('SAVE.FAIL', 'loud', { key: 'k' });
  expect(con.calls.map(c => [c[0], c[1]])).toEqual([['warn', '[LYR SAVE.FAIL abcdef01]']]);
  const d = setup({ dev: true }); d.l.emit('GAME.STATE', 'dbg'); d.l.emit('RUN.START', 'i'); d.l.error('ERR.PROMISE', 'e', null, new Error('e'));
  expect(d.con.calls.map(c => c[0])).toEqual(['debug', 'info', 'error']); expect(d.con.calls[0][1]).toBe('[LYR GAME.STATE abcdef01]'); expect(d.con.calls[1][2]).toBe('i');
});

test('batches split under 60 KB, PERF.FRAME summarizes 30 s of frames, sessionId persists in sessionStorage, env has no PII, ?telemetry=0 wins over the setting', () => {
  const evs = Array.from({ length: 10 }, (_, i) => ({ i, pad: 'x'.repeat(20_000) }));
  const b = splitBatches(evs, 60_000); expect(b.map(x => x.length)).toEqual([2, 2, 2, 2, 2]); expect(b.flat().length).toBe(10); // 1 件 ≈ 20 KB → 60 KB に 2 件
  expect(splitBatches([{ big: 'y'.repeat(70_000) }, { s: 1 }], 60_000).length).toBe(2); expect(splitBatches([], 60_000)).toEqual([]);
  const { l, tm } = setup(); for (let i = 0; i < 1499; i++) tm.frame(20); expect(l.dump().length).toBe(0); tm.frame(20); // ちょうど 30 秒で 1 件
  const pf = l.dump().find(e => e.code === 'PERF.FRAME'); expect(pf.attr).toEqual({ fps_p50: 50, fps_p95: 50, long: 0, frames: 1500, sec: 30 });
  for (let i = 0; i < 10; i++) tm.frame(80); for (let i = 0; i < 1460; i++) tm.frame(20); // 次の窓: 50 ms 超が 10、p95 は 20 ms のまま
  expect(l.dump().filter(e => e.code === 'PERF.FRAME')[1].attr).toEqual({ fps_p50: 50, fps_p95: 50, long: 10, frames: 1470, sec: 30 });
  const store = new Map(); const st = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const sid = sessionId(st); expect(sid).toMatch(/^[0-9a-f]{32}$/); expect(sessionId(st)).toBe(sid); expect(store.get(SID_KEY)).toBe(sid);
  expect(sessionId({ getItem: () => { throw new Error('blocked'); } })).toMatch(/^[0-9a-f]{32}$/);
  const env = envInfo(fakeWin(), 'Pad (Vendor: 054c)'); expect(env).toEqual({ ua: 'UA'.repeat(99) + 'U…', lang: 'ja', vw: 800, vh: 600, dpr: 2, pad: 'Pad (Vendor: 054c)', touch: false });
  expect(Object.keys(env).some(k => ['ip', 'name', 'email'].includes(k))).toBe(false);
  expect(telemetryEnabled({ location: { href: 'http://x/?telemetry=0' } }, true)).toBe(false); expect(telemetryEnabled({ location: { href: 'http://x/?telemetry=1' } }, false)).toBe(true);
  expect(telemetryEnabled({ location: { href: 'http://x/' } }, false)).toBe(false); expect(telemetryEnabled({}, true)).toBe(true);
});
