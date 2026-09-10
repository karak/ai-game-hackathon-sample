// テーマごとの生成タイル（HD 毒沼 2 コマ・すり抜け足場）の画素ハッシュを出す。
// 地形の描き方を変えたとき、対象外のテーマが 1 画素も変わっていないことの証跡にする（IMP-021: 第二章だけを変える）。
//   node tools/hash_tiles.mjs > before.json   … 変更前
//   node tools/hash_tiles.mjs > after.json    … 変更後、diff で比べる
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 5177;
const server = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));
try {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {} await wait(250); }
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  const out = await page.evaluate(async () => {
    const { THEMES } = await import('/src/gfx/tiles.js');
    const { buildBogHD, sliceTileStrip, TILE_BANDS } = await import('/src/gfx/hdworld.js');
    const hash = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
    const A = window.__game.assets;
    const res = {};
    for (const [name, th] of Object.entries(THEMES)) {
      const bog = buildBogHD(th);
      const r = { bog: bog.map(hash) };
      const strip = A.generated?.tiles?.[name];
      if (strip && TILE_BANDS[name]) { const t = sliceTileStrip(strip.r, TILE_BANDS[name]); r.plat = t.plat.map(hash); r.top = t.top.map(hash); }
      res[name] = r;
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
} finally { server.kill(); }
