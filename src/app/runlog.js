// 通しプレイの記録（テスター計測、M5 出口条件「完走率 60% 以上・平均 3 時間以内」の材料）。純粋関数群、ストレージは注入可能。
// 1 回の「はじめから／つづきから／2 周目」開始 = 1 run。到達した章・クリア・死亡数・コンティニュー数・プレイ秒を持つ。
// オプション画面「テスター報告を コピー」が buildReport() の文字列をクリップボードに置き、テスターはそれを Issue や連絡に貼る。
// 集計は tools/tester_stats.mjs（docs/plan/logs/testers/*.json）。
import { log } from '../shared/log.js'; // 構造化ログ（Sprint R）: SAVE.FAIL

export const RUN_KEY = 'lyrica_runs';
export const RUN_MAX = 50;              // 超えたら古い順に捨てる
export const REPORT_VERSION = 2;           // 2: sid と直近の構造化ログ（log）を同梱（Sprint R）

const isMap = o => o && typeof o === 'object' && !Array.isArray(o);
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

export function loadRuns(storage) {
  try { const j = JSON.parse(storage?.getItem(RUN_KEY) ?? '[]'); return Array.isArray(j) ? j.filter(isMap).map(cleanRun) : []; } catch { return []; }
}
export function saveRuns(runs, storage) { try { storage?.setItem(RUN_KEY, JSON.stringify(runs)); return true; } catch (e) { log.warn('SAVE.FAIL', 'runs', { key: RUN_KEY }, e); return false; } }

function cleanRun(r) {
  return { at: num(r.at), end: r.end == null ? null : num(r.end), loop: num(r.loop), start: num(r.start), stage: num(r.stage), cleared: r.cleared === true, deaths: num(r.deaths), continues: num(r.continues), sec: num(r.sec), lang: typeof r.lang === 'string' ? r.lang : 'ja' };
}

// 新しい run。start = 開始した章 index、stage = 到達した最大の章 index（開始章から）
export function newRun({ at = Date.now(), loop = 0, start = 0, lang = 'ja' } = {}) {
  return { at, end: null, loop, start, stage: start, cleared: false, deaths: 0, continues: 0, sec: 0, lang };
}
export function pushRun(runs, run) { const out = [...runs, run]; return out.length > RUN_MAX ? out.slice(out.length - RUN_MAX) : out; }

// 集計: 完走率（cleared / runs）、完走 run の平均秒、章ごとの到達数、死亡・コンティニューの合計
export function summarizeRuns(runs, stages = 8) {
  const done = runs.filter(r => r.end != null || r.cleared);
  const cleared = runs.filter(r => r.cleared);
  const reached = Array.from({ length: stages }, () => 0);
  for (const r of runs) for (let i = r.start; i <= Math.min(stages - 1, r.stage); i++) reached[i]++;
  const meanSec = cleared.length ? Math.round(cleared.reduce((a, r) => a + r.sec, 0) / cleared.length) : null;
  return { runs: runs.length, finished: done.length, cleared: cleared.length, clearRate: runs.length ? +(cleared.length / runs.length).toFixed(2) : null, meanSec, reached, deaths: runs.reduce((a, r) => a + r.deaths, 0), continues: runs.reduce((a, r) => a + r.continues, 0) };
}

// テスター報告（JSON 文字列）。runs と死亡ログの集計、環境、設定の要約。個人情報は含めない（UA・言語・画面サイズのみ）
export function buildReport({ runs = [], deaths = [], settings = null, env = {}, summarizeDeaths = null, stages = 8, sid = null, log = [] } = {}) {
  const rep = {
    report: REPORT_VERSION, at: new Date(env.now ?? Date.now()).toISOString(), version: env.version ?? 'dev', sid,
    env: { ua: env.ua ?? '', lang: env.lang ?? '', screen: env.screen ?? '', pad: env.pad ?? null, touch: env.touch ?? false },
    settings: settings ? { volume: settings.volume, muted: settings.muted, lang: settings.lang, progress: settings.progress, keysChanged: settings.keysChanged ?? false } : null,
    runs: summarizeRuns(runs, stages), runList: runs.slice(-RUN_MAX),
    deaths: summarizeDeaths ? summarizeDeaths(deaths) : { count: deaths.length },
    log: Array.isArray(log) ? log.slice(-200) : [], // 直近 200 件の LogEvent（tools/log_stats.mjs がそのまま読める）
  };
  return JSON.stringify(rep, null, 1);
}
