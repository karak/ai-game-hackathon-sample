// 章の同じ進行位置を撮って比べる（アートの判断材料。retro-game-art-direction の「証跡」用）。
// 使い方: node tools/shot_stages.mjs [--stages 1,2] [--at 0.35,0.7]
//   test-results/shots/cmp_stage<N>_<位置%>.png を書き、Vite は 5176 で一時的に起こす（ユーザーの見ているタブは触らない）
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const stages = arg('stages', '1,2').split(',').map(n => Number(n) - 1);
const ats = arg('at', '0.35,0.7').split(',').map(Number);
const PORT = 5176;
const server = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const shots = [];
try {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {} await wait(250); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 700 } });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  for (const at of ats) for (const si of stages) {
    await page.evaluate(([si, at]) => {
      const g = window.__game, STEP = 1 / 60;
      g.input.held.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player; p.invT = 1e9; p.die = () => {};
      p.x = Math.floor(w.level.map.pixelWidth * at);
      let ty = 0; while (ty < w.level.map.height - 1 && !w.level.map.isSolid(Math.floor(p.centerX / 16), ty)) ty++;
      p.y = ty * 16 - p.h - 1; p.vy = 0; w.cam.x = Math.max(0, p.x - 120); w.toasts.length = 0;
      for (let i = 0; i < 30; i++) { g.update(STEP); g.input.endFrame(); }
    }, [si, at]);
    await page.waitForTimeout(200);
    const path = `test-results/shots/cmp_stage${si + 1}_${Math.round(at * 100)}.png`;
    await page.screenshot({ path, clip: { x: 26, y: 14, width: 768, height: 672 } }); // キャンバスだけ
    shots.push(path);
  }
  await browser.close();
} finally { server.kill(); }
console.log(shots.join('\n'));
