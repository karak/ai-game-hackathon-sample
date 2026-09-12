// 構造化ログ（NDJSON: 1 行 1 LogEvent）の集計（Sprint R / R4、docs/plan/09-observability.md §4）。
//   node tools/log_stats.mjs <file.ndjson…> [--src user|bot|all] [--json]
// 入力は tools/tail_logs.mjs が落とした NDJSON、または window.__log.dump() / テスター報告 v2 の log 配列（JSON 配列も受ける）。
// 出す表: sid ごとの到達ファネル（RUN.START → STAGE.START… → STAGE.CLEAR / RUN.END）、死亡の面 × 原因（座標つき）、ERR.* と ASSET.FAIL の件数、
// PERF.FRAME の fps p95 の最小、ボット／人の別。既定は人（src=user）だけ集計する（ボットのログは attr.test で分かる）。
import { readFileSync } from 'node:fs';

export function parseLines(text) {
  const t = text.trim(); if (!t) return [];
  if (t.startsWith('[')) { try { return JSON.parse(t).filter(e => e && e.code); } catch {} }
  const out = [];
  for (const line of t.split('\n')) { const s = line.trim(); if (!s.startsWith('{')) continue; try { const e = JSON.parse(s); if (e && e.code) out.push(e); } catch {} }
  return out;
}

// 集計。src: 'user' | 'bot' | 'all'
export function stats(events, { src = 'user' } = {}) {
  // src の振り分けは sid 単位（ボットの run でも先頭 2 件は user なので、sid に bot が 1 件でもあればその sid 全体をボット扱い）
  const botSids = new Set(events.filter(e => e.src === 'bot').map(e => e.sid));
  const evs = events.filter(e => src === 'all' || (src === 'bot' ? botSids.has(e.sid) : !botSids.has(e.sid) && e.src !== 'worker'));
  const bySid = new Map(); for (const e of evs) { if (!bySid.has(e.sid)) bySid.set(e.sid, []); bySid.get(e.sid).push(e); }
  const sessions = [];
  for (const [sid, all] of bySid) {
    // Worker の EDGE.* は同じ sid を持つが seq 0 なので、通番と src/build の判定からは外して件数だけ持つ
    const list = all.filter(e => e.src !== 'worker'), edge = all.length - list.length; if (!list.length) continue;
    list.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    const seqs = list.map(e => e.seq).filter(Number.isInteger); let gaps = 0; for (let i = 1; i < seqs.length; i++) if (seqs[i] !== seqs[i - 1] + 1) gaps++;
    const start = list.find(e => e.code === 'SESSION.START');
    const stages = [...new Set(list.filter(e => e.code === 'STAGE.START').map(e => e.attr?.stage ?? e.ctx?.stage))].filter(Boolean);
    const clears = [...new Set(list.filter(e => e.code === 'STAGE.CLEAR').map(e => e.attr?.stage ?? e.ctx?.stage))].filter(Boolean);
    const runs = list.filter(e => e.code === 'RUN.START').length, ends = list.filter(e => e.code === 'RUN.END');
    const deaths = list.filter(e => e.code === 'PLAYER.DEATH').length, errors = list.filter(e => e.lvl === 'error').length;
    const perf = list.filter(e => e.code === 'PERF.FRAME').map(e => e.attr?.fps_p95).filter(Number.isFinite);
    const secs = list.length ? Math.round(((list.at(-1).t ?? 0) - (list[0].t ?? 0)) / 1000) : 0;
    const botEv = list.find(e => e.src === 'bot'); // SESSION.START / GAME.BOOT は setSource('bot') の前に出るので user。1 件でも bot があればボットの run
    sessions.push({ sid: sid.slice(0, 8), src: botEv ? 'bot' : (list[0].src ?? 'user'), build: list[0].build, test: botEv?.attr?.test ?? null, env: start?.attr?.env ? `${start.attr.env.lang} ${start.attr.env.vw}x${start.attr.env.vh}${start.attr.env.pad ? ' pad' : ''}${start.attr.env.touch ? ' touch' : ''}` : '', events: list.length, edge, gaps, runs, reached: stages.length, cleared: clears.length, ended: ends.filter(e => e.attr?.cleared).length, deaths, errors, fps_p95_min: perf.length ? Math.min(...perf) : null, sec: secs });
  }
  // 到達ファネル: 面ごとに「開始した sid 数 / クリアした sid 数」
  const funnel = {};
  for (const [, list] of bySid) {
    for (const s of new Set(list.filter(e => e.code === 'STAGE.START').map(e => e.attr?.stage ?? e.ctx?.stage).filter(Boolean))) (funnel[s] ??= { started: 0, cleared: 0 }).started++;
    for (const s of new Set(list.filter(e => e.code === 'STAGE.CLEAR').map(e => e.attr?.stage ?? e.ctx?.stage).filter(Boolean))) (funnel[s] ??= { started: 0, cleared: 0 }).cleared++;
  }
  // 死亡: 面 × 原因、座標の一覧（64 px 刻みで丸めた x のヒストグラム）
  const deaths = {};
  for (const e of evs.filter(e => e.code === 'PLAYER.DEATH')) {
    const st = e.attr?.stage ?? e.ctx?.stage ?? '?', r = e.attr?.reason ?? '?'; const d = (deaths[st] ??= { total: 0, byReason: {}, xs: {} });
    d.total++; d.byReason[r] = (d.byReason[r] ?? 0) + 1; const bx = Math.floor((e.attr?.x ?? e.ctx?.x ?? 0) / 64) * 64; d.xs[bx] = (d.xs[bx] ?? 0) + 1;
  }
  const errors = {}; for (const e of evs.filter(e => e.lvl === 'error' || e.code === 'ASSET.FAIL' || e.code === 'LOG.DROP')) { const k = `${e.code} ${e.err?.name ?? ''} ${e.err?.message ?? e.msg ?? ''}`.trim(); errors[k] = (errors[k] ?? 0) + 1; }
  const perf = evs.filter(e => e.code === 'PERF.FRAME').map(e => e.attr).filter(Boolean);
  const p95 = perf.map(a => a.fps_p95).filter(Number.isFinite), longs = perf.reduce((a, x) => a + (x.long ?? 0), 0);
  const bySrc = {}; for (const e of events) bySrc[e.src ?? 'user'] = (bySrc[e.src ?? 'user'] ?? 0) + 1;
  return { events: evs.length, bySrc, sessions, funnel, deaths, errors, perf: { samples: perf.length, fps_p95_min: p95.length ? Math.min(...p95) : null, fps_p95_median: p95.length ? p95.slice().sort((a, b) => a - b)[Math.floor(p95.length / 2)] : null, long: longs } };
}

const pad = (s, n) => String(s ?? '').padEnd(n);
export function render(r) {
  const L = [];
  L.push(`events ${r.events}  by src: ${Object.entries(r.bySrc).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  L.push('', 'sessions (gap = seq の欠け。サーバー側の NDJSON では debug（GAME.STATE）を送らないので欠けが出るのが正常。dump() / 報告 JSON では 0 のはず)', `${pad('sid', 9)}${pad('src', 5)}${pad('build', 9)}${pad('env', 22)}${pad('ev', 5)}${pad('gap', 4)}${pad('run', 4)}${pad('reach', 6)}${pad('clear', 6)}${pad('end', 4)}${pad('death', 6)}${pad('err', 4)}${pad('p95', 5)}sec`);
  for (const s of r.sessions) L.push(`${pad(s.sid, 9)}${pad(s.src, 5)}${pad(s.build, 9)}${pad(s.env + (s.test ? ` [${s.test}]` : ''), 22)}${pad(s.events, 5)}${pad(s.gaps, 4)}${pad(s.runs, 4)}${pad(s.reached, 6)}${pad(s.cleared, 6)}${pad(s.ended, 4)}${pad(s.deaths, 6)}${pad(s.errors, 4)}${pad(s.fps_p95_min ?? '-', 5)}${s.sec}`);
  L.push('', 'funnel (sessions that started / cleared each stage)');
  for (const [st, f] of Object.entries(r.funnel)) L.push(`  ${pad(st, 16)} started ${pad(f.started, 4)} cleared ${f.cleared}`);
  L.push('', 'deaths (stage: total, by reason, x buckets of 64 px)');
  for (const [st, d] of Object.entries(r.deaths)) L.push(`  ${pad(st, 16)} ${pad(d.total, 4)} ${Object.entries(d.byReason).map(([k, v]) => `${k}=${v}`).join(' ')}  x: ${Object.entries(d.xs).sort((a, b) => a[0] - b[0]).map(([x, n]) => `${x}:${n}`).join(' ')}`);
  L.push('', `errors / asset failures / drops (${Object.values(r.errors).reduce((a, b) => a + b, 0)})`);
  for (const [k, n] of Object.entries(r.errors)) L.push(`  ${pad(n, 4)} ${k}`);
  L.push('', `perf: ${r.perf.samples} samples, fps p95 min ${r.perf.fps_p95_min ?? '-'} median ${r.perf.fps_p95_median ?? '-'}, long frames ${r.perf.long}`);
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2); const flag = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--src');
  if (!files.length) { console.error('usage: node tools/log_stats.mjs <file.ndjson…> [--src user|bot|all] [--json]'); process.exit(2); }
  const events = files.flatMap(f => parseLines(readFileSync(f, 'utf8')));
  const r = stats(events, { src: flag('src') ?? 'user' });
  console.log(args.includes('--json') ? JSON.stringify(r, null, 1) : render(r));
}
