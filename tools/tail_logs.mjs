// `wrangler tail --format json` を NDJSON（1 行 1 LogEvent）に落とす（Sprint R / R4、docs/plan/09-observability.md §3）。
//   node tools/tail_logs.mjs [--out docs/plan/logs/tail/<日時>.ndjson] [--secs 600] [--env <wrangler env>]
// wrangler 4.130 の --format json は 1 リクエストを **整形済み（複数行）の JSON オブジェクト**で流す（1 行 1 JSON ではない。2026-09-12 実測）:
//   { outcome, scriptName, logs: [{ message: ["<Worker が console.log した文字列>"], level, timestamp }], event: { request: {...} } }
// そこで波括弧の深さで最上位オブジェクトを切り出し（文字列内の括弧は無視）、logs[].message[] のうち JSON で `code` を持つものだけを書く。
// 資産配信のリクエスト（logs が空）や JSON でない文字列は捨てる。
// 動作確認: 別ターミナルで公開 URL を開いて 1 面遊ぶ → SESSION.START / STAGE.START / PLAYER.DEATH … と EDGE.LOG_BATCH が並ぶ。集計は tools/log_stats.mjs
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// バッファから最上位の JSON オブジェクトを切り出す（文字列内の括弧は無視）。戻り [オブジェクト文字列の配列, 未完の残り]。
// 状態を持たず毎回バッファ全体を走査する（呼び手は「残り ＋ 新しいチャンク」を渡す）。整形済み JSON は数 KB なので走査し直しても軽い
export function extractObjects(buf) {
  const out = []; let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') { if (depth > 0) depth--; if (depth === 0 && start >= 0) { out.push(buf.slice(start, i + 1)); start = -1; } }
  }
  return [out, depth > 0 && start >= 0 ? buf.slice(start) : ''];
}

// wrangler の 1 リクエスト分から LogEvent を取り出す。戻り { events, skipped }
export function eventsFromTail(obj) {
  const events = []; let skipped = 0;
  for (const l of obj?.logs ?? []) for (const m of l.message ?? []) {
    if (typeof m !== 'string' || !m.trimStart().startsWith('{')) { skipped++; continue; }
    try { const ev = JSON.parse(m); if (ev && typeof ev.code === 'string') events.push(ev); else skipped++; } catch { skipped++; }
  }
  return { events, skipped };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2); const flag = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = flag('out') ?? `docs/plan/logs/tail/${stamp}.ndjson`; const secs = Number(flag('secs') ?? 600); const env = flag('env');
  mkdirSync(dirname(out), { recursive: true });
  const file = createWriteStream(out, { flags: 'a' });
  const wr = spawn('npx', ['wrangler', 'tail', '--format', 'json', ...(env ? ['--env', env] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
  let buf = '', n = 0, skipped = 0, requests = 0;
  wr.stdout.on('data', chunk => {
    const [objs, rest] = extractObjects(buf + chunk.toString('utf8')); buf = rest;
    for (const o of objs) {
      let j; try { j = JSON.parse(o); } catch { skipped++; continue; }
      requests++; const r = eventsFromTail(j); skipped += r.skipped;
      for (const ev of r.events) { file.write(JSON.stringify(ev) + '\n'); n++; }
    }
  });
  let done = false;
  const stop = () => { if (done) return; done = true; wr.kill('SIGINT'); file.end(() => { console.error(`tail: ${requests} requests, wrote ${n} events to ${out} (skipped ${skipped} non-event messages)`); process.exit(0); }); };
  setTimeout(stop, secs * 1000); process.on('SIGINT', stop);
  wr.on('exit', code => { if (code && code !== 130 && !done) console.error(`wrangler tail exited ${code}`); stop(); });
  console.error(`tail: writing ${out} for ${secs}s (Ctrl+C to stop)`);
}
