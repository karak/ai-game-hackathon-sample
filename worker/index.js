// Cloudflare Worker（docs/plan/09-observability.md §3）: /api/log にブラウザが sendBeacon した LogEvent の束を受け取り、
// 1 イベント 1 行の JSON で console.log する → Workers Logs（observability.enabled）と `wrangler tail --format json`（tools/tail_logs.mjs）で読む。
// それ以外のパスは Static Assets（env.ASSETS）にそのまま渡す（wrangler.jsonc の run_worker_first は /api/* だけ）。
// サーバー側の永続化（KV/D1）・OTel 変換はしない（§6）。必要になったらここで NDJSON → OTLP に写す（§2 の対応表）。
// src/ の外に置く（ブラウザのバンドルに入れない）。共有カーネルは import せず、検査に要る定数だけ持つ（Worker 単体で動く）。
export const MAX_BYTES = 64 * 1024;   // 1 リクエスト（ブラウザ側は 60 KB で分割する）
export const MAX_EVENTS = 200;        // 1 リクエスト
export const LEVELS = ['debug', 'info', 'warn', 'error'];
const SID = /^[0-9a-f]{16,64}$/, CODE = /^[A-Z]+\.[A-Z_]+$/;

// 1 イベントの形を検査する。問題があれば理由（文字列）、無ければ null
export function validateEvent(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return 'not an object';
  if (ev.v !== 1) return 'bad v';
  if (typeof ev.sid !== 'string' || !SID.test(ev.sid)) return 'bad sid';
  if (typeof ev.code !== 'string' || !CODE.test(ev.code)) return 'bad code';
  if (!LEVELS.includes(ev.lvl)) return 'bad lvl';
  if (!Number.isInteger(ev.seq) || ev.seq < 0) return 'bad seq';
  if (typeof ev.ts !== 'string' || Number.isNaN(Date.parse(ev.ts))) return 'bad ts';
  if (!['user', 'bot', 'worker'].includes(ev.src)) return 'bad src';
  return null;
}

// Worker 自身の出来事（EDGE.*）も同じ封筒で出す
export function edgeEvent(code, lvl, msg, attr, { now, ray, sid }) {
  return { v: 1, ts: now(), t: 0, sid: sid ?? 'worker', seq: 0, rid: ray ?? null, src: 'worker', lvl, code, msg, attr, build: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'worker' };
}

const text = (status, body, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers } });

// POST /api/log。now / out は注入できる（test/worker.test.js）。cf は request.cf（country）
export async function handleLog(request, { now = () => new Date().toISOString(), out = console.log, cf = request.cf } = {}) {
  const ray = request.headers.get('cf-ray') ?? null, country = cf?.country ?? null;
  const reject = (status, why, bytes) => { out(JSON.stringify(edgeEvent('EDGE.LOG_REJECT', 'warn', why, { why, bytes, country, ray }, { now, ray }))); return text(status, why); };
  if (request.method !== 'POST') return text(405, 'method not allowed', { allow: 'POST' });
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) return reject(413, 'payload too large', declared);
  const body = await request.text(); const bytes = body.length;
  if (bytes > MAX_BYTES) return reject(413, 'payload too large', bytes);
  let events; try { events = JSON.parse(body); } catch { return reject(400, 'invalid json', bytes); }
  if (!Array.isArray(events)) events = [events];
  if (!events.length) return reject(400, 'empty batch', bytes);
  if (events.length > MAX_EVENTS) return reject(400, `too many events (${events.length})`, bytes);
  for (let i = 0; i < events.length; i++) { const why = validateEvent(events[i]); if (why) return reject(400, `event ${i}: ${why}`, bytes); }
  const received = now();
  for (const ev of events) out(JSON.stringify({ ...ev, rid_ray: ray, country, received }));   // 1 イベント 1 行（rid は ブラウザの request-id、rid_ray は Cloudflare の ray）
  out(JSON.stringify(edgeEvent('EDGE.LOG_BATCH', 'info', `${events.length} events from ${events[0].src}`, { events: events.length, bytes, country, ray, src: events[0].src }, { now, ray, sid: events[0].sid })));
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/log') return handleLog(request);
    if (url.pathname.startsWith('/api/')) return text(404, 'not found');
    return env.ASSETS.fetch(request);
  },
};
