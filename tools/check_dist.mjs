// `npm run build` の成果物（dist/）を vite preview で起こし、Playwright で素材が全て読めることを確認する（M7）。
// 使い方: node tools/check_dist.mjs（先に npm run build）。出力: 読めた素材数・[loader] 警告・bootMs・test-results/shots/dist_title.png
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4174;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));
try {
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {} await wait(250); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const warns = [], errors = [];
  page.on('console', m => { if (m.type() === 'warning' && m.text().includes('[loader]')) warns.push(m.text()); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => errors.push('requestfailed ' + r.url()));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  const r = await page.evaluate(() => { const g = window.__game; const gen = g.assets.generated ?? {}; const n = Object.values(gen).reduce((a, grp) => a + Object.keys(grp).length, 0); return { loaded: n, bootMs: g.bootMs, playerHd: !!g.assets.player.dress.idle?.hd, state: g.state }; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/shots/dist_title.png' });
  await page.goto(`http://127.0.0.1:${PORT}/catalog.html`);
  await page.waitForTimeout(2500);
  const imgs = await page.evaluate(() => document.querySelectorAll('canvas, img').length);
  await browser.close();
  const ok = r.loaded === 235 && warns.length === 0 && errors.length === 0 && r.playerHd;
  console.log(JSON.stringify({ ...r, loaderWarnings: warns.length, errors, catalogNodes: imgs, ok }, null, 1));
  process.exitCode = ok ? 0 : 1;
} finally { server.kill(); }
