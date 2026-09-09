// トレーラー GIF（docs/release/trailer.gif、M7）。Vite を 5175 で起こし、Playwright のボット（無敵）で各章を数秒ずつ走らせ、
// canvas.toDataURL で 8 fps のコマを取り、PIL（python3）で GIF に束ねる。出力は 384×336（768×672 の整数 1/2、最近傍）。
// 使い方: node tools/make_trailer.mjs [--fps 8] [--secs 1.25] [--scale 0.5] [--colors 128] [--lang ja|en] [--out docs/release/trailer.gif]
// カバー用の小さい版: node tools/make_trailer.mjs --scale 0.3333 --out docs/release/trailer_256.gif（256×224 = 世界解像度、整数 1/3）
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const FPS = arg('fps', 8), SECS = arg('secs', 1.25), SCALE = arg('scale', 0.5), COLORS = arg('colors', 128), PORT = 5175;
const str = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const LANG = str('lang', 'ja'), OUT = str('out', 'docs/release/trailer.gif');
const TMP = new URL('../test-results/trailer-frames/', import.meta.url).pathname;
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'pipe' });
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
const save = data => writeFileSync(`${TMP}f${String(n++).padStart(4, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
try {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {} await wait(250); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  await page.addInitScript(l => localStorage.setItem('lyrica_save', JSON.stringify({ version: 1, lang: l })), LANG); // 表示言語（既定 ja。headless Chromium は en-US なので明示する）
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  // 1 コマ = ゲームを 60/FPS ステップ進めて rAF の描画を 1 回待ち、canvas を PNG で取る
  const grab = async (steps, bot) => page.evaluate(async ({ steps, bot }) => {
    const g = window.__game, STEP = 1 / 60;
    for (let i = 0; i < steps; i++) { if (bot) window.__trailerBot(); g.update(STEP); g.input.endFrame(); }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.getElementById('game').toDataURL('image/png');
  }, { steps, bot });
  await page.evaluate(() => {
    // autoplay.spec.js と同じ自走ボット（右へ走る・撃つ・詰まったら跳ぶ・縦面は登攀）。無敵、死亡スタブ
    window.__trailerBot = () => {
      const g = window.__game, w = g.world; if (!w || g.state !== 'play') return; const p = w.player, map = w.level.map; g.__f = (g.__f ?? 0) + 1; const f = g.__f;
      g.input.held.clear();
      if (w.level.vertical) {
        const fy = Math.floor((p.y + p.h - 1) / 16); let lx = null; for (const ty of [fy, fy - 1]) for (let tx = 0; tx < map.width && lx === null; tx++) if (map.at(tx, ty) === 'L') lx = tx * 16 + 8;
        if (p.climbing) g.input.held.add('up'); else if (lx !== null && Math.abs(lx - p.centerX) < 3) g.input.held.add('up'); else g.input.held.add(lx !== null && lx < p.centerX ? 'left' : 'right');
        if (f % 15 === 0) g.input.pressed.add('shoot'); return;
      }
      g.input.held.add('right'); if (f % 20 === 0) g.input.pressed.add('shoot');
      if (f % 30 === 0) { if (p.x - (g.__lx ?? 0) < 6) g.input.pressed.add('jump'); g.__lx = p.x; }
      if (!p.onGround && p.jumps === 1 && p.vy > 0 && f % 7 === 0) g.input.pressed.add('jump');
      if (p.y > 224) { p.y = 60; p.x += 24; p.vy = 0; }
      if (w.boss && !w.boss.dying && w.boss.state !== 'enter' && f % 40 === 0) w.boss.hurt(4, null);
    };
  });
  const per = Math.round(60 / FPS), frames = Math.round(SECS * FPS);
  // タイトル
  await page.evaluate(() => { const g = window.__game; g.input.held.clear(); g.setState('title'); g.menuIdx = 0; });
  for (let k = 0; k < frames; k++) save(await grab(per, false));
  // 各章: 序盤を走る → 中盤（ボス直前 1/4 手前）へ飛ばして走る
  const { STAGES } = await import('../src/levels/index.js');
  for (let si = 0; si < STAGES.length; si++) {
    await page.evaluate(si => { const g = window.__game; g.input.held.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99; g.__f = 0; g.__lx = 0; const p = g.world.player; p.invT = 0; p.die = () => {}; p.hit = () => {}; g.world.time = 240; }, si);
    for (let k = 0; k < frames; k++) save(await grab(per, true));
    if (!STAGES[si].vertical) {
      await page.evaluate(() => { const g = window.__game, w = g.world, p = w.player; const bx = w.level.bossTriggers?.[0]?.x ?? w.level.bossX ?? 0; if (bx > 400) { p.x = Math.max(0, bx - 480); let ty = 0; while (ty < w.level.map.height - 1 && !w.level.map.isSolid(Math.floor(p.centerX / 16), ty)) ty++; p.y = ty * 16 - p.h - 1; p.vy = 0; w.cam.x = Math.max(0, p.x - 100); w.checkpoint = { ...w.checkpoint, x: p.x }; w.toasts.length = 0; } }); // 飛ばした先で中間地点のトーストが出ないようにする
      for (let k = 0; k < frames; k++) save(await grab(per, true));
    }
  }
  // 最終章のボス連戦（ノワール）
  await page.evaluate(() => { const g = window.__game, w = g.world; if (w && w.level.bossTriggers?.length) { const p = w.player; const bx = w.level.bossTriggers[w.level.bossTriggers.length - 2]?.x ?? w.level.bossTriggers[0].x; p.x = bx - 40; w.cam.x = Math.max(0, p.x - 100); w.checkpoint = { ...w.checkpoint, x: p.x }; w.toasts.length = 0; w.bossIdx = Math.max(0, (w.level.bosses?.length ?? 1) - 2); } });
  for (let k = 0; k < frames * 2; k++) save(await grab(per, true));
  await browser.close();
} finally { server.kill(); }
console.log(`frames=${n}`);
// PIL で GIF に束ねる（最近傍で整数比縮小、フレームごとに 256 色適応パレット）
const py = spawn('python3', ['-c', `
import glob, sys
from PIL import Image
fps, scale, colors, out = ${FPS}, ${SCALE}, ${COLORS}, '${OUT}'
files = sorted(glob.glob('${TMP}f*.png'))
ims = []
for f in files:
    im = Image.open(f).convert('RGB')
    if scale != 1: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.NEAREST)
    ims.append(im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
ims[0].save(out, save_all=True, append_images=ims[1:], duration=int(1000 / fps), loop=0, optimize=True, disposal=1)
import os; print(f'{out}: {len(ims)} frames, {ims[0].width}x{ims[0].height}, {os.path.getsize(out) / 1e6:.2f} MB')
`], { stdio: 'inherit' });
await new Promise(r => py.on('exit', r));
