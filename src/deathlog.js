// 死亡地点ログ（IMP-007 / M5）。localStorage に蓄積し、難易度調整の根拠にする。純粋関数群（ストレージは注入）
// 1 件 = { s: ステージ名, x, y: 世界座標（整数）, r: 原因（hit/fall/spike/bog/press/time）, t: 面の経過秒, l: 周回（0/1）, at: epoch ms }
export const DEATH_KEY = 'lyrica_deaths';
export const DEATH_MAX = 600;          // 超えたら古い順に捨てる
export const DEATH_REASONS = ['hit', 'fall', 'spike', 'bog', 'press', 'time'];

const isNum = v => Number.isFinite(v);
function clean(e) {
  if (!e || typeof e !== 'object' || typeof e.s !== 'string' || !isNum(e.x) || !isNum(e.y)) return null;
  return { s: e.s, x: Math.round(e.x), y: Math.round(e.y), r: DEATH_REASONS.includes(e.r) ? e.r : 'hit', t: isNum(e.t) ? Math.round(e.t) : 0, l: e.l === 1 ? 1 : 0, at: isNum(e.at) ? e.at : 0 };
}
export function loadDeathLog(storage) {
  try { const j = JSON.parse(storage?.getItem(DEATH_KEY) ?? '[]'); return Array.isArray(j) ? j.map(clean).filter(Boolean).slice(-DEATH_MAX) : []; } catch { return []; }
}
export function saveDeathLog(log, storage) { try { storage?.setItem(DEATH_KEY, JSON.stringify(log)); return true; } catch { return false; } }
// 追記して上限で切る（新しい配列を返す）
export function pushDeath(log, entry) { const e = clean(entry); if (!e) return log; const out = [...log, e]; return out.length > DEATH_MAX ? out.slice(out.length - DEATH_MAX) : out; }

// 集計: ステージ別に 件数・原因別・x を bucket 世界単位で丸めた多発地点（多い順）
export function summarizeDeaths(log, bucket = 64) {
  const byStage = {};
  for (const e of log) {
    const st = (byStage[e.s] ??= { total: 0, byReason: {}, buckets: {} });
    st.total++; st.byReason[e.r] = (st.byReason[e.r] ?? 0) + 1;
    const b = Math.floor(e.x / bucket) * bucket; st.buckets[b] = (st.buckets[b] ?? 0) + 1;
  }
  for (const st of Object.values(byStage)) {
    st.hotspots = Object.entries(st.buckets).map(([x0, n]) => ({ x0: +x0, n })).sort((a, b) => b.n - a.n || a.x0 - b.x0).slice(0, 5);
    delete st.buckets;
  }
  return { total: log.length, byStage };
}
