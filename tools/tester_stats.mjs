// テスター報告（オプション「テスター報告を コピー」の JSON）を集計する。
//   node tools/tester_stats.mjs [dir=docs/plan/logs/testers]
// 各ファイルは buildReport() の出力（1 人 1 ファイル）。完走率・完走者の平均秒・章ごとの到達・死亡合計を表にする。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'docs/plan/logs/testers';
let files = [];
try { files = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { console.log(`no reports in ${dir}`); process.exit(0); }
const reports = files.map(f => ({ f, j: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
if (!reports.length) { console.log(`no reports in ${dir}`); process.exit(0); }

const stages = Math.max(...reports.map(r => r.j.runs?.reached?.length ?? 8));
const reached = Array.from({ length: stages }, () => 0);
let testers = 0, cleared = 0, secs = [], deaths = 0, continues = 0;
const rows = [];
for (const { f, j } of reports) {
  const s = j.runs ?? {}; testers++;
  const done = (j.runList ?? []).some(r => r.cleared); if (done) cleared++;
  for (const r of j.runList ?? []) if (r.cleared) secs.push(r.sec);
  const best = Math.max(-1, ...(j.runList ?? []).map(r => r.stage));
  for (let i = 0; i <= best && i < stages; i++) reached[i]++;
  deaths += s.deaths ?? 0; continues += s.continues ?? 0;
  rows.push(`| ${f} | ${j.version ?? ''} | ${j.env?.pad ? 'pad' : j.env?.touch ? 'touch' : 'kbd'} | ${done ? '完走' : `第${best + 1}章まで`} | ${s.deaths ?? 0} | ${s.continues ?? 0} | ${Math.round((j.runList ?? []).reduce((a, r) => a + r.sec, 0) / 60)} 分 |`);
}
const mean = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length / 60) : null;
console.log(`テスター ${testers} 人、完走 ${cleared} 人（完走率 ${Math.round(cleared / testers * 100)}%）、完走者の平均 ${mean == null ? '—' : mean + ' 分'}、死亡 ${deaths}、コンティニュー ${continues}`);
console.log(`到達人数（章 1〜${stages}）: ${reached.join(' / ')}`);
console.log(`目標: 完走率 60% 以上・平均 180 分以内 → ${cleared / testers >= 0.6 && (mean ?? 0) <= 180 ? '達成' : '未達'}`);
console.log('\n| 報告 | ビルド | 操作 | 結果 | 死亡 | コンティニュー | プレイ時間 |\n|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
