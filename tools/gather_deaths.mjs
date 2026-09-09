// 死亡地点ログの収集ボット（IMP-007 / M5）。人のテスターの代わりに「無敵なし・残機無限」のボットを全ステージ走らせ、
// 死亡地点（座標・原因・経過秒）を docs/plan/logs/deaths-<日付>.json と集計 .md に書き出す。
// 使い方: node tools/gather_deaths.mjs [--runs 3] [--url http://127.0.0.1:5173] [--secs 150]
// ボットは autoplay.spec.js と同じ「右へ走る・止まったら跳ぶ・穴の手前で跳ぶ・15 tick ごとに撃つ」。人の死に方の近似であり、
// 敵弾の見切りをしない分「hit」が多めに出る前提で読む。
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = +arg('--runs', 3), URL = arg('--url', 'http://127.0.0.1:5173'), SECS = +arg('--secs', 150);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${URL}/index.html`); await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
const result = await page.evaluate(async ({ RUNS, SECS }) => {
  const g = window.__game, STEP = 1 / 60; const { STAGES } = await import('/src/levels/index.js');
  const out = []; const startLen = g.deathLog.length;
  for (let run = 0; run < RUNS; run++) for (let si = 0; si < STAGES.length; si++) {
    g.input.held.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
    const w = g.world, p = w.player, map = w.level.map; let frames = 0, lastX = p.x, deaths = 0;
    const ladderX = () => { const fy = Math.floor((p.y + p.h - 1) / 16); for (const ty of [fy, fy - 1]) for (let tx = 0; tx < map.width; tx++) if (map.at(tx, ty) === 'L') return tx * 16 + 8; return null; };
    while (g.state === 'play' && frames < 60 * SECS) {
      g.lives = 9; // 残機無限（ゲームオーバーにしない）
      if (p.state === 'normal') {
        if (w.level.vertical) {
          g.input.held.clear();
          if (p.climbing) g.input.held.add('up');
          else { const lx = ladderX(); let dir = 1; if (lx !== null) { const dx = lx - p.centerX; if (Math.abs(dx) < 3) g.input.held.add('up'); else { dir = dx > 0 ? 1 : -1; g.input.held.add(dir > 0 ? 'right' : 'left'); } } else g.input.held.add('right');
            const ftx = Math.floor((p.centerX + dir * 10) / 16), fty = Math.floor((p.y + p.h + 1) / 16);
            if (p.onGround && !map.isSolid(ftx, fty) && !map.isOneWay(ftx, fty)) g.input.pressed.add('jump');
            if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 5 === 0) g.input.pressed.add('jump'); }
        } else {
          g.input.held.add('right');
          const ftx = Math.floor((p.centerX + p.facing * 12) / 16), fty = Math.floor((p.y + p.h + 1) / 16);
          if (p.onGround && !map.isSolid(ftx, fty) && !map.isOneWay(ftx, fty) && !map.isHazard(ftx, fty)) g.input.pressed.add('jump'); // 穴・沼の手前で跳ぶ
          if (frames % 30 === 0) { if (p.x - lastX < 6) g.input.pressed.add('jump'); lastX = p.x; }
          if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 7 === 0) g.input.pressed.add('jump');
        }
        if (frames % 15 === 0) g.input.pressed.add('shoot');
      } else if (p.state === 'dead') deaths++;
      g.update(STEP); g.input.endFrame(); frames++;
      if (frames % 600 === 0) await new Promise(r => setTimeout(r, 0));
    }
    out.push({ run, stage: STAGES[si].name, endState: g.state, secs: +(frames / 60).toFixed(1), deaths: g.deathLog.filter(d => d.s === STAGES[si].name).length });
  }
  g.input.held.clear();
  return { runs: out, log: g.deathLog.slice(startLen) };
}, { RUNS, SECS });
await browser.close();
const { summarizeDeaths } = await import('../src/deathlog.js');
const date = new Date().toISOString().slice(0, 10);
mkdirSync('docs/plan/logs', { recursive: true });
writeFileSync(`docs/plan/logs/deaths-${date}.json`, JSON.stringify({ date, runs: RUNS, secsPerStage: SECS, bot: 'gather_deaths.mjs (mortal, infinite lives)', results: result.runs, deaths: result.log }, null, 1));
const sum = summarizeDeaths(result.log);
const lines = [`# 死亡地点ログ ${date}（ボット、${RUNS} 周 × 各面最大 ${SECS} 秒、無敵なし・残機無限）`, '', `総死亡 ${sum.total} 件。ボットは敵弾を避けないので hit は人より多め、落下・沼は「跳ぶ判断の遅れ」で人に近い。`, '', '| 面 | 走行結果（run: 終了状態/秒） | 死亡 | 原因別 | 多発地点（x 開始〜、件数） |', '|---|---|---|---|---|'];
for (const st of [...new Set(result.runs.map(r => r.stage))]) {
  const rs = result.runs.filter(r => r.stage === st).map(r => `${r.run}: ${r.endState}/${r.secs}s`).join('<br>');
  const d = sum.byStage[st]; lines.push(`| ${st} | ${rs} | ${d?.total ?? 0} | ${d ? Object.entries(d.byReason).map(([r, n]) => `${r}×${n}`).join(' ') : '-'} | ${d ? d.hotspots.map(h => `${h.x0}〜: ${h.n}`).join('　') : '-'} |`);
}
if (errors.length) lines.push('', '実行時エラー:', ...errors.map(e => '- ' + e));
writeFileSync(`docs/plan/logs/deaths-${date}.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
