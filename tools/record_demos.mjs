// デモ（アトラクト）入力ログの収録ボット（IMP-015）。人の収録の代わりに「無敵なし・残機 2」のボットを各面で走らせ、
// Game.startRecording / stopRecording で得た入力ログを assets/demo/<面名>.json に書く。
// 使い方: node tools/record_demos.mjs [--stages stage1,stage-river] [--url http://127.0.0.1:5173] [--secs 60] [--no-verify]
// 収録は再生と同じ条件（World の seed は面の seed、lives 2、score 0、無敵なし）で行い、ボットの変種（撃つ間隔・跳ぶ判断の間隔・
// 足元を見る距離）をいくつか走らせて「死なずに最も遠くまで進んだ」ものを採る。収録後にページを読み直し、Game.startDemo(k) で
// 再生した軌跡（60 フレームごとの主人公座標）が収録時と一致することを確かめる（一致しなければ終了コード 1）。
// 前提: Vite（--url）が起きていること。ボットの操作は 6 操作（左右上下・撃つ・跳ぶ）だけで、デバッグキーや直接の状態操作はしない。
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://127.0.0.1:5173'), SECS = +arg('--secs', 60), ONLY = arg('--stages', '').split(',').filter(Boolean), VERIFY = !process.argv.includes('--no-verify');
const SAMPLE = 60; // 軌跡の間引き（フレーム）

// ボットの変種。shoot: 撃つ間隔、stuck: 進みが止まったか見る間隔、look: 足元を見る距離（世界単位）、dj: 二段ジャンプの入力間隔
const VARIANTS = [];
for (const shoot of [15, 20]) for (const stuck of [30, 45]) for (const look of [10, 14]) VARIANTS.push({ shoot, stuck, look, dj: 7 });
VARIANTS.push({ shoot: 15, stuck: 30, look: 12, dj: 5 }, { shoot: 20, stuck: 60, look: 16, dj: 9 });
for (const look of [20, 26]) for (const hop of [0, 40, 70]) VARIANTS.push({ shoot: 15, stuck: 30, look, dj: 7, hop }); // hop: 接地中に定期的に跳ぶ間隔（0 = しない）

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const boot = async () => { await page.goto(`${URL}/index.html`); await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 }); };
await boot();
const names = await page.evaluate(async () => (await import('/src/content/levels/index.js')).STAGES.map(s => s.name));
const targets = ONLY.length ? ONLY : names;
for (const n of targets) if (!names.includes(n)) { console.error(`unknown stage: ${n}`); process.exit(2); }

// 1 面 × 1 変種を同期で回す（rAF のループが割り込まないよう、途中で await しない）
const runOne = ({ si, v, SECS, SAMPLE }) => {
  const g = window.__game, STEP = 1 / 60;
  g.input.held.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
  const w = g.world, p = w.player, map = w.level.map; let frames = 0, lastX = p.x, best = w.level.vertical ? p.y : p.x;
  const traj = [];
  const ladderX = () => { const fy = Math.floor((p.y + p.h - 1) / 16); for (const ty of [fy, fy - 1]) for (let tx = 0; tx < map.width; tx++) if (map.at(tx, ty) === 'L') return tx * 16 + 8; return null; };
  g.startRecording();
  while (g.state === 'play' && frames < 60 * SECS) {
    g.input.held.clear();
    if (p.state === 'normal') {
      if (w.level.vertical) {
        if (p.climbing) g.input.held.add('up');
        else { const lx = ladderX(); let dir = 1; if (lx !== null) { const dx = lx - p.centerX; if (Math.abs(dx) < 3) g.input.held.add('up'); else { dir = dx > 0 ? 1 : -1; g.input.held.add(dir > 0 ? 'right' : 'left'); } } else g.input.held.add('right');
          const ftx = Math.floor((p.centerX + dir * v.look) / 16), fty = Math.floor((p.y + p.h + 1) / 16);
          if (p.onGround && !map.isSolid(ftx, fty) && !map.isOneWay(ftx, fty)) g.input.pressed.add('jump');
          if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % v.dj === 0) g.input.pressed.add('jump'); }
        best = Math.min(best, p.y);
      } else {
        g.input.held.add('right');
        const ftx = Math.floor((p.centerX + p.facing * v.look) / 16), fty = Math.floor((p.y + p.h + 1) / 16);
        if (p.onGround && !map.isSolid(ftx, fty) && !map.isOneWay(ftx, fty) && !map.isHazard(ftx, fty)) g.input.pressed.add('jump'); // 穴・沼の手前で跳ぶ
        if (frames % v.stuck === 0) { if (p.x - lastX < 6) g.input.pressed.add('jump'); lastX = p.x; }
        if (v.hop && p.onGround && frames % v.hop === 0) g.input.pressed.add('jump');
        if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % v.dj === 0) g.input.pressed.add('jump');
        best = Math.max(best, p.x);
      }
      if (frames % v.shoot === 0) g.input.pressed.add('shoot');
    }
    if (frames % SAMPLE === 0) traj.push([frames, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.state, g.lives]);
    g.update(STEP); g.input.endFrame(); frames++;
  }
  const json = g.stopRecording(); g.input.held.clear();
  const progress = w.level.vertical ? (map.height * 16 - best) : best;
  return { json, traj, frames, deaths: w.deaths, endState: g.state, progress: Math.round(progress) };
};

mkdirSync('assets/demo', { recursive: true });
const picked = {};
for (const name of targets) {
  const si = names.indexOf(name);
  const runs = [];
  for (const v of VARIANTS) { const r = await page.evaluate(runOne, { si, v, SECS, SAMPLE }); runs.push({ v, ...r }); }
  // 採用基準: ゲームオーバーにならない → 死亡が少ない → 進んだ距離が大きい
  runs.sort((a, b) => (a.endState === 'gameover') - (b.endState === 'gameover') || a.deaths - b.deaths || b.progress - a.progress);
  const b = runs[0];
  picked[name] = b;
  console.log(`${name}: ${b.frames} frames (${(b.frames / 60).toFixed(1)}s), end=${b.endState}, deaths=${b.deaths}, progress=${b.progress}, bot=${JSON.stringify(b.v)}  [variants: ${runs.map(r => `${r.deaths}d/${r.progress}`).join(' ')}]`);
}

// 書き出しは全面の収録が終わってから（JSON を書くと Vite が HMR でページを読み直し、収録中の実行コンテキストが壊れる）
for (const [name, b] of Object.entries(picked)) {
  const out = { ...b.json, recorded: new Date().toISOString().slice(0, 10), bot: `record_demos.mjs ${JSON.stringify(b.v)}`, deaths: b.deaths, progress: b.progress, end: b.endState };
  writeFileSync(`assets/demo/${name}.json`, JSON.stringify(out) + '\n');
}

let failed = 0;
if (VERIFY) {
  // ページを読み直して新しい JSON を読み込み、startDemo で再生した軌跡を収録時と比べる
  await new Promise(r => setTimeout(r, 1500)); await boot();
  mkdirSync('test-results/shots', { recursive: true });
  for (const name of targets) {
    const si = names.indexOf(name), want = picked[name].traj;
    const got = await page.evaluate(({ si, SAMPLE, n }) => {
      const g = window.__game, STEP = 1 / 60; g.input.held.clear();
      if (!g.startDemo(si) || g.demoIdx !== si) return { error: `startDemo(${si}) did not start this stage (demoIdx=${g.demoIdx})` };
      const p = g.world.player, traj = [], level = g.world.level.name;
      for (let f = 0; f < n; f++) { if (g.state !== 'demo' || g.demoIdx !== si) break; if (f % SAMPLE === 0) traj.push([f, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.state, g.lives]); g.update(STEP); g.input.endFrame(); }
      // 証跡の撮影用に、もう一度この面のデモを頭から 10 秒ぶん進めておく（rAF のループが続きを再生する）
      const state = g.state; if (g.startDemo(si)) for (let f = 0; f < 600; f++) { g.update(STEP); g.input.endFrame(); }
      return { traj, level, state };
    }, { si, SAMPLE, n: picked[name].frames });
    await page.screenshot({ path: `test-results/shots/demo_${name}.png` });
    const ok = !got.error && JSON.stringify(got.traj) === JSON.stringify(want);
    if (!ok) { failed++; const i = got.traj ? got.traj.findIndex((t, k) => JSON.stringify(t) !== JSON.stringify(want[k])) : -1; console.error(`VERIFY FAIL ${name}: ${got.error ?? `first diff at sample ${i}: got ${JSON.stringify(got.traj?.[i])} want ${JSON.stringify(want[i])}`}`); }
    else console.log(`verify ${name}: replay matches ${want.length} samples (level=${got.level})`);
  }
}
await browser.close();
if (errors.length) { console.error('page errors:', errors); failed++; }
process.exit(failed ? 1 : 0);
