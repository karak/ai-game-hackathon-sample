// `npm run build` の成果物（dist/）を vite preview で起こし、Playwright で素材が全て読めることを確認する（M7）。
// 使い方: node tools/check_dist.mjs（先に npm run build）。出力: 読めた素材数・[loader] 警告・bootMs・test-results/shots/dist_title.png
//        node tools/check_dist.mjs https://magical-lyrica.karak97.workers.dev  — 公開 URL を直接検証（preview は起こさない、撮影は deploy_title.png）
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4174;
const REMOTE = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2].replace(/\/$/, '') : null;
const BASE = REMOTE ?? `http://127.0.0.1:${PORT}`, SHOT = REMOTE ? 'deploy' : 'dist';
const server = REMOTE ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));
try {
  for (let i = 0; i < 40 && !REMOTE; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {} await wait(250); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const warns = [], errors = [];
  page.on('console', m => { if (m.type() === 'warning' && m.text().includes('[loader]')) warns.push(m.text()); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => errors.push('requestfailed ' + r.url()));
  const t0 = Date.now(); await page.goto(`${BASE}/index.html?telemetry=0`); // 確認用の読込は構造化ログを送らない（Sprint R）
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  const r = await page.evaluate(() => { const g = window.__game; const gen = g.assets.generated ?? {}; const n = Object.values(gen).reduce((a, grp) => a + Object.keys(grp).length, 0); return { loaded: n, bootMs: g.bootMs, ttfb: performance.getEntriesByType('navigation')[0]?.responseStart | 0, transferKB: Math.round(performance.getEntriesByType('resource').reduce((a, e) => a + (e.transferSize || 0), 0) / 1024), playerHd: !!g.assets.player.dress.idle?.hd, state: g.state }; });
  await page.waitForTimeout(300);
  const wallMs = Date.now() - t0;
  await page.screenshot({ path: `test-results/shots/${SHOT}_title.png` });
  await page.goto(`${BASE}/catalog.html`);
  await page.waitForTimeout(2500);
  const imgs = await page.evaluate(() => document.querySelectorAll('canvas, img').length);
  await browser.close();
  const expected = Object.keys(JSON.parse(readFileSync(new URL('../src/gfx/manifest.json', import.meta.url)))).length; // manifest の全エントリが読めること（件数は増えるので固定値にしない）
  const ok = r.loaded === expected && warns.length === 0 && errors.length === 0 && r.playerHd;
  console.log(JSON.stringify({ url: BASE, ...r, expected, wallMs, loaderWarnings: warns.length, errors, catalogNodes: imgs, ok }, null, 1));
  process.exitCode = ok ? 0 : 1;
} finally { server?.kill(); }
