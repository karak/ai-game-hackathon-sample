// 構造化ログの核（共有カーネル。docs/plan/09-observability.md §2）。ブラウザ API には触らない:
// 出来事を LogEvent に整え（ctx の自動付与・通番・個人情報鍵の除去・上限の切り詰め）、リングバッファに持ち、購読者（sink）へ渡す。
// console 出力・/api/log への送信・window.onerror・PERF.FRAME の計測は src/platform/telemetry.js（プラットフォーム境界）。
// stage / gfx / platform など上位から呼ぶのはこの `log` 1 つ（依存の向き: どこからでも shared へ。docs/architecture.md §2）。
// OTel へ写すときの対応は 09-observability.md §2 の表（ts→Timestamp、lvl→SeverityText、msg→Body、code→event.name、sid→session.id、rid→request.id）。
import { LOG_CODES, LEVELS, isLogCode } from './logcodes.js';

export const SCHEMA_V = 1;
export const LIMITS = Object.freeze({ str: 200, attrKeys: 20, eventBytes: 2048, buffer: 500, stackLines: 3, depth: 2 });
// 個人情報になり得る鍵は ctx / attr から落とす（大文字小文字を問わない）。UA・言語・画面・パッド名までは許す（テスター手引きと同じ方針）
export const PII_KEYS = Object.freeze(['ip', 'name', 'email', 'user', 'username', 'account', 'password', 'token', 'phone', 'address', 'cookie']);

export function randomId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  let s = ''; for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16); return s;
}

export function clip(s, n = LIMITS.str) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// Error → { name, message, stack(3 行まで) }。Error でない値は message に文字列化
export function serializeError(e) {
  if (e == null) return null;
  if (typeof e !== 'object') return { name: 'Error', message: clip(e) };
  const stack = typeof e.stack === 'string' ? e.stack.split('\n').slice(0, LIMITS.stackLines).map(l => clip(l.trim())).join('\n') : undefined;
  const out = { name: clip(e.name ?? 'Error', 60), message: clip(e.message ?? String(e)) };
  if (stack) out.stack = stack;
  return out;
}

const isPlain = v => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isPii = k => PII_KEYS.includes(String(k).toLowerCase());

// attr / ctx を「数値・真偽・短い文字列・null、1 段までの入れ子、20 鍵まで」に整える。戻りは [値, 切り詰めたか]
export function cleanAttr(a, depth = LIMITS.depth) {
  if (!isPlain(a)) return [null, false];
  const out = {}; let truncated = false; let n = 0;
  for (const [k, v] of Object.entries(a)) {
    if (isPii(k) || v === undefined || typeof v === 'function') continue;
    if (n >= LIMITS.attrKeys) { truncated = true; break; }
    let cv;
    if (v === null || typeof v === 'boolean') cv = v;
    else if (typeof v === 'number') cv = Number.isFinite(v) ? (Number.isInteger(v) ? v : Math.round(v * 100) / 100) : String(v);
    else if (typeof v === 'string') { cv = clip(v); if (cv !== v) truncated = true; }
    else if (Array.isArray(v)) { cv = v.slice(0, LIMITS.attrKeys).map(x => (typeof x === 'object' && x !== null) ? clip(JSON.stringify(x), 60) : typeof x === 'string' ? clip(x, 60) : x); if (v.length > LIMITS.attrKeys) truncated = true; }
    else if (isPlain(v) && depth > 1) { const [sub, t] = cleanAttr(v, depth - 1); cv = sub; truncated ||= t; }
    else cv = clip(String(v), 60);
    out[k] = cv; n++;
  }
  return [out, truncated];
}

const defaultClock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export class Log {
  constructor({ sid = randomId(), now = () => Date.now(), clock = defaultClock, build = 'dev', src = 'user', buffer = LIMITS.buffer } = {}) {
    this.sid = sid; this.now = now; this.clock = clock; this.build = build; this.src = src; this.tags = null;
    this.max = buffer; this.buf = []; this.seq = 0; this.dropped = 0; this.truncated = 0; this.sinks = []; this.ctxFn = null; this._inTrunc = false;
  }
  setSession(sid) { this.sid = sid; return this; }
  // ボットは setSource('bot', { test, variant })。tags は毎イベントの attr に混ざる（集計で src と attr.test を鍵にする）
  setSource(src, tags = null) { this.src = src === 'bot' || src === 'worker' ? src : 'user'; this.tags = isPlain(tags) ? tags : null; return this; }
  // ctx の取り方を注入する（Game の現在値のスナップショット。呼び手は ctx を書かない）
  bind(ctxFn) { this.ctxFn = typeof ctxFn === 'function' ? ctxFn : null; return this; }
  addSink(fn) { this.sinks.push(fn); return () => { this.sinks = this.sinks.filter(s => s !== fn); }; }
  get stats() { return { seq: this.seq, buffered: this.buf.length, dropped: this.dropped, truncated: this.truncated }; }
  dump(n = this.max) { return this.buf.slice(-n); }

  // 出来事を 1 件記録する。code は登録済み（logcodes.js）のみ。lvl は既定を上書きできる。err は Error（error/warn のとき）
  emit(code, msg = '', attr = null, { err = null, lvl = null } = {}) {
    if (!isLogCode(code)) throw new Error(`unregistered log code: ${code} (register it in src/shared/logcodes.js)`);
    const level = lvl ?? LOG_CODES[code];
    if (!LEVELS.includes(level)) throw new Error(`invalid log level: ${level}`);
    const ev = { v: SCHEMA_V, ts: new Date(this.now()).toISOString(), t: Math.round(this.clock()), sid: this.sid, seq: ++this.seq, rid: null, src: this.src, lvl: level, code, msg: clip(msg) };
    let truncated = ev.msg.length !== String(msg ?? '').length;
    let ctx = null; try { ctx = this.ctxFn?.() ?? null; } catch { ctx = null; }
    if (ctx) { const [c, t] = cleanAttr(ctx); if (c && Object.keys(c).length) ev.ctx = c; truncated ||= t; }
    const merged = (attr || this.tags) ? { ...(this.tags ?? {}), ...(isPlain(attr) ? attr : {}) } : null;
    if (merged) { const [a, t] = cleanAttr(merged); if (a && Object.keys(a).length) ev.attr = a; truncated ||= t; }
    if (err) ev.err = serializeError(err);
    ev.build = this.build;
    // 1 イベント 2 KB を超えたら attr → ctx → msg の順に削る
    let size = JSON.stringify(ev).length;
    if (size > LIMITS.eventBytes) { truncated = true; if (ev.err?.stack) delete ev.err.stack; size = JSON.stringify(ev).length; }
    if (size > LIMITS.eventBytes && ev.attr) { delete ev.attr; size = JSON.stringify(ev).length; }
    if (size > LIMITS.eventBytes && ev.ctx) { delete ev.ctx; size = JSON.stringify(ev).length; }
    if (size > LIMITS.eventBytes) ev.msg = clip(ev.msg, 60);
    this.buf.push(ev); if (this.buf.length > this.max) { this.buf.shift(); this.dropped++; }
    for (const s of this.sinks) { try { s(ev); } catch {} }
    if (truncated) { this.truncated++; if (this.truncated === 1 && !this._inTrunc) { this._inTrunc = true; try { this.emit('LOG.TRUNCATED', 'event exceeded limits', { code }); } finally { this._inTrunc = false; } } }
    return ev;
  }
  debug(code, msg, attr) { return this.emit(code, msg, attr, { lvl: 'debug' }); }
  info(code, msg, attr) { return this.emit(code, msg, attr, { lvl: 'info' }); }
  warn(code, msg, attr, err = null) { return this.emit(code, msg, attr, { lvl: 'warn', err }); }
  error(code, msg, attr, err = null) { return this.emit(code, msg, attr, { lvl: 'error', err }); }
}

// 既定のロガー（ゲーム全体で 1 つ）。build は vite define の __BUILD_ID__（dev では 'dev'）。sid は telemetry.start が sessionStorage の値で差し替える
export const log = new Log({ build: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev' });
