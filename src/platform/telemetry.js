// テレメトリ（プラットフォーム境界。docs/plan/09-observability.md §3）: shared/log.js の LogEvent を
// ① console（dev は全 lvl、本番は warn 以上。接頭辞 [LYR code sid8] で DevTools のフィルタに掛ける）
// ② fetch(keepalive) / sendBeacon で POST /api/log → Cloudflare Worker（worker/index.js）→ Workers Logs / wrangler tail
// に流す。送信は 15 秒ごと／50 件／visibilitychange: hidden・pagehide／lvl: error のとき即時。1 回 ≤ 60 KB（超えたら分割）。
// 送信失敗は数えるだけ（再送しない。順序は seq で復元）。debug は送らない（バッファと console のみ）。
// 設定 telemetry（既定 ON、オプション画面で OFF）と ?telemetry=0 で送信だけ止める（バッファと console は動く）。
// 依存: shared のみ。ブラウザ API は win 経由で注入できる（test/log.test.js が偽の window で送信トリガを検査する）。
import { log as defaultLog, randomId, clip } from '../shared/log.js';
import { levelIndex } from '../shared/logcodes.js';

export const SID_KEY = 'lyrica_sid';       // sessionStorage: 再読込に耐え、タブを閉じると消える
export const LOG_URL = '/api/log';
export const PERF_EVERY_MS = 30_000;
export const LONG_FRAME_MS = 50;

// session-id。sessionStorage に無ければ作る（32 桁 hex）
export function sessionId(storage) {
  try { const s = storage?.getItem(SID_KEY); if (typeof s === 'string' && /^[0-9a-f]{16,64}$/.test(s)) return s; const n = randomId(); storage?.setItem(SID_KEY, n); return n; }
  catch { return randomId(); }
}

// SESSION.START の env。個人情報は持たない（UA・言語・画面・DPR・タッチ可否・パッド名まで）
export function envInfo(win, padId = null) {
  const n = win?.navigator ?? {};
  return { ua: clip(n.userAgent ?? '', 200), lang: String(n.language ?? ''), vw: win?.innerWidth | 0, vh: win?.innerHeight | 0, dpr: Math.round((win?.devicePixelRatio ?? 1) * 100) / 100, pad: padId ? clip(padId, 80) : null, touch: (n.maxTouchPoints | 0) > 0 };
}

// 送信の ON/OFF: URL の ?telemetry=0/1 が最優先、次に設定（既定 ON）
export function telemetryEnabled(win, setting = true) {
  try { const q = new URL(win.location.href).searchParams.get('telemetry'); if (q === '0') return false; if (q === '1') return true; } catch {}
  return setting !== false;
}

export class Telemetry {
  constructor(log = defaultLog, { win = globalThis, url = LOG_URL, flushMs = 15_000, maxEvents = 50, maxBytes = 60_000, enabled = true, dev = false, minSend = 'info', send = null, console: con = globalThis.console, timers = globalThis } = {}) {
    this.log = log; this.win = win; this.url = url; this.flushMs = flushMs; this.maxEvents = maxEvents; this.maxBytes = maxBytes;
    this.enabled = enabled; this.dev = dev; this.minSend = levelIndex(minSend); this.con = con; this.timers = timers;
    // 既定の送信: fetch(keepalive) を優先（Playwright の page.route が捕まえられる。sendBeacon は route を通らない）。無ければ sendBeacon。
    // 戻りは「送信を始められたか」。fetch の失敗は非同期に sendFail へ数える
    this.send = send ?? ((u, body) => {
      try {
        if (typeof win.fetch === 'function') { win.fetch(u, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).then(r => { if (!r.ok) this.sendFail++; }, () => { this.sendFail++; }); return true; }
        return !!win.navigator?.sendBeacon?.(u, new win.Blob([body], { type: 'application/json' }));
      } catch { return false; }
    });
    this.queue = []; this.sent = 0; this.batches = 0; this.sendFail = 0; this.reportedDrop = 0; this.reportedFail = 0; this.timer = null; this.unsub = null; this.startedAt = null;
    this.perf = { samples: [], long: 0, since: 0 };
  }
  // sink を登録し、タイマーとページのイベントを掛ける。win に addEventListener が無ければ（テスト）イベントは掛けない
  start() {
    if (this.unsub) return this;
    this.startedAt = this.log.clock();
    this.unsub = this.log.addSink(ev => this.onEvent(ev));
    if (this.flushMs > 0 && this.timers?.setInterval) this.timer = this.timers.setInterval(() => this.flush('timer'), this.flushMs);
    const doc = this.win?.document;
    if (this.win?.addEventListener) {
      this.win.addEventListener('error', e => { this.log.emit('ERR.UNCAUGHT', e?.message ?? 'error', { file: e?.filename ? String(e.filename).split('/').pop() : undefined, line: e?.lineno, col: e?.colno }, { err: e?.error ?? new Error(String(e?.message ?? 'error')) }); });
      this.win.addEventListener('unhandledrejection', e => { const r = e?.reason; this.log.emit('ERR.PROMISE', r?.message ?? String(r), null, { err: r instanceof Error ? r : new Error(String(r)) }); });
      this.win.addEventListener('pagehide', () => this.flush('pagehide'));
    }
    if (doc?.addEventListener) doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') { this.log.emit('SESSION.END', 'hidden', { sec: Math.round((this.log.clock() - this.startedAt) / 1000) }); this.flush('hidden'); } });
    return this;
  }
  stop() { this.unsub?.(); this.unsub = null; if (this.timer && this.timers?.clearInterval) this.timers.clearInterval(this.timer); this.timer = null; }
  setEnabled(on) { this.enabled = !!on; if (!on) this.queue.length = 0; return this.enabled; }

  onEvent(ev) {
    this.toConsole(ev);
    if (levelIndex(ev.lvl) < this.minSend) return;   // debug は送らない
    this.queue.push(ev);
    if (ev.lvl === 'error') this.flush('error');
    else if (this.queue.length >= this.maxEvents) this.flush('count');
  }
  // dev: 全 lvl。本番: warn 以上。DevTools では "[LYR" でフィルタ、"-[LYR" で除外
  toConsole(ev) {
    if (!this.con) return;
    if (!this.dev && levelIndex(ev.lvl) < levelIndex('warn')) return;
    const fn = this.con[ev.lvl === 'debug' ? 'debug' : ev.lvl] ?? this.con.log;
    try { fn.call(this.con, `[LYR ${ev.code} ${String(ev.sid).slice(0, 8)}]`, ev.msg, ev); } catch {}
  }
  // 溜まった分を送る。戻りは送ったバッチ数。無効時は捨てる（バッファには残る）
  flush(reason = 'manual') {
    if (!this.queue.length) return 0;
    if (!this.enabled) { this.queue.length = 0; return 0; }
    // 落とした数・失敗数が増えていれば LOG.DROP を 1 件添える（sink 経由で queue の末尾に入る）
    const { dropped } = this.log.stats;
    if (dropped > this.reportedDrop || this.sendFail > this.reportedFail) { this.reportedDrop = dropped; this.reportedFail = this.sendFail; this.log.emit('LOG.DROP', 'buffer overflow / send failures', { dropped, sendFail: this.sendFail, reason }); }
    const events = this.queue; this.queue = [];
    let n = 0;
    for (const batch of splitBatches(events, this.maxBytes)) {
      const rid = randomId(); for (const ev of batch) ev.rid = rid;   // バッファ内の同じオブジェクトにも rid が付く（dump で追える）
      const body = JSON.stringify(batch);
      if (this.send(this.url, body)) { this.sent += batch.length; this.batches++; n++; } else this.sendFail++;
    }
    return n;
  }
  // 固定ステップループから毎フレーム呼ぶ。30 秒ごとに PERF.FRAME（fps の p50 / p95、50 ms 超のフレーム数）
  frame(dtMs) {
    const p = this.perf; p.samples.push(dtMs); if (dtMs > LONG_FRAME_MS) p.long++;
    p.since += dtMs;
    if (p.since >= PERF_EVERY_MS) {
      const s = p.samples.slice().sort((a, b) => a - b); const q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))];
      const fps = ms => ms > 0 ? Math.round(1000 / ms) : 0;
      this.log.emit('PERF.FRAME', `fps p50 ${fps(q(0.5))} p95 ${fps(q(0.95))}`, { fps_p50: fps(q(0.5)), fps_p95: fps(q(0.95)), long: p.long, frames: s.length, sec: Math.round(p.since / 1000) });
      p.samples = []; p.long = 0; p.since = 0;
    }
  }
  // window.__log: DevTools から dump() / setSource() / flush() / stats()
  api() {
    const self = this;
    return { get sid() { return self.log.sid; }, dump: n => self.log.dump(n), setSource: (s, tags) => { self.log.setSource(s, tags); return self.log.src; }, flush: () => self.flush('manual'), stats: () => ({ ...self.log.stats, queued: self.queue.length, sent: self.sent, batches: self.batches, sendFail: self.sendFail, enabled: self.enabled }), setEnabled: on => self.setEnabled(on) };
  }
}

// 60 KB を超えないように分ける（1 件で超えるものはそれだけで 1 バッチ）
export function splitBatches(events, maxBytes) {
  const out = []; let cur = [], bytes = 2;
  for (const ev of events) {
    const n = JSON.stringify(ev).length + 1;
    if (cur.length && bytes + n > maxBytes) { out.push(cur); cur = []; bytes = 2; }
    cur.push(ev); bytes += n;
  }
  if (cur.length) out.push(cur);
  return out;
}
