// エンディング 6 場面を headless Chromium で撮る（IMP-022 の証跡。生成イラストが 256×224 の中央切り出しで黒帯なく出ることを確認する）
//   node tools/shot_ending.mjs            # dev サーバー（vite preview / dev）が http://localhost:5173 で動いている前提
//   node tools/shot_ending.mjs http://localhost:4173
// 出力: test-results/shots/ending_scene<N>.png ＋ 各場面の絵の実寸と黒帯幅を標準出力に
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
mkdirSync('test-results/shots', { recursive: true });
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(base + '/index.html'); await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
const info = await page.evaluate(() => {
  const g = window.__game; g.startGame(0); g.setState('ending'); g.stateT = 5; g.endingIdx = 0;
  return g.endingScenes().map((s, i) => ({ i: i + 1, img: s.img ? { w: s.img.r.width, h: s.img.r.height } : null }));
});
const out = [];
for (const sc of info) {
  await page.evaluate(i => { const g = window.__game; g.endingIdx = i; g.stateT = 5; }, sc.i - 1);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `test-results/shots/ending_scene${sc.i}.png` });
  // 中央 256×224 を切り出すので、絵が 256 未満なら左右に黒帯が出る
  const bars = sc.img ? { left: Math.max(0, 256 - sc.img.w), top: Math.max(0, 224 - sc.img.h) } : null;
  out.push({ scene: sc.i, img: sc.img, blackBars: bars });
}
console.log(JSON.stringify({ scenes: out, errors }, null, 1));
await browser.close();
