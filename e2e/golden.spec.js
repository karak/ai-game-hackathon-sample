// 回帰の護り（リファクタリング用の特性テスト）: 固定シード・固定入力で全 8 面を回し、
// (1) 30 フレームごとの主人公座標・敵数・弾数・スコア・状態の軌跡、(2) 決められたフレームのキャンバス画素ハッシュ、
// (3) タイトル／オプション／ポーズ画面の画素ハッシュ を test/golden/*.json と突き合わせる。
// 振る舞いを変えないリファクタリングでは 1 ビットも変わらないことを求める。Math.random は起動前にシード付き PRNG へ差し替える
// （粒子・画面揺れが Math.random を使うため。DEBT-001 の対象外だった演出も、この検査の中では決定論にする）。
// 更新: GOLDEN_UPDATE=1 npx playwright test e2e/golden.spec.js（振る舞いを意図して変えたときだけ。差分は commit で説明する）
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const GOLDEN = 'test/golden/stages.json';
const UPDATE = !!process.env.GOLDEN_UPDATE;
const FRAMES = 60 * 20;      // 各面 20 秒ぶん
const SAMPLE = 30;           // 軌跡の間引き
const SHOT_AT = [90, 600];   // 画素ハッシュを取るフレーム

test('golden: trajectories and canvas hashes of all stages and menu screens are unchanged', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    // xorshift32。ページ内のすべての Math.random をこれにする（演出の乱数も決定論に）
    let s = 0x9e3779b9; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    Math.random = rnd; window.__seedRandom = v => { s = v >>> 0 || 1; };
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });

  const got = await page.evaluate(async ({ FRAMES, SAMPLE, SHOT_AT }) => {
    const g = window.__game, STEP = 1 / 60;
    const { STAGES } = await import('/src/content/levels/index.js');
    const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
    const hash = () => { const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4) { h ^= d[i] ^ (d[i + 1] << 8) ^ (d[i + 2] << 16); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
    const drawNow = () => { ctx.setTransform(3, 0, 0, 3, 0, 0); ctx.imageSmoothingEnabled = false; g.draw(ctx); };
    const r2 = v => Math.round(v * 100) / 100;
    const stages = [];
    for (let si = 0; si < STAGES.length; si++) {
      window.__seedRandom(1000 + si);
      g.input.held.clear(); g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player, map = w.level.map;
      const traj = [], shots = {};
      for (let f = 0; f < FRAMES && g.state === 'play'; f++) {
        // 固定入力: 右へ歩き、20 フレームごとに撃ち、45 フレームごとに跳ぶ。縦面ははしごで上へ
        g.input.held.clear(); g.input.held.add(w.level.vertical && p.climbing ? 'up' : 'right');
        if (f % 20 === 0) g.input.pressed.add('shoot');
        if (f % 45 === 0) g.input.pressed.add('jump');
        if (w.level.vertical && !p.climbing && map.at(Math.floor(p.centerX / 16), Math.floor((p.y + p.h - 1) / 16)) === 'L') g.input.held.add('up');
        g.update(STEP); g.input.endFrame();
        if (f % SAMPLE === 0) traj.push([f, r2(p.x), r2(p.y), w.enemies.length, w.shots.length + w.enemyShots.length, g.score, g.lives, p.state, p.costume]);
        if (SHOT_AT.includes(f)) { drawNow(); shots[f] = hash(); }
      }
      stages.push({ name: STAGES[si].name, end: g.state, traj, shots });
    }
    // メニュー画面
    const screens = {};
    g.world = null; g.input.held.clear(); g.setState('title'); g.menuIdx = 0; g.stateT = 1.25; g.titleCam = 40; drawNow(); screens.title = hash();
    g.setState('options'); g.optIdx = 2; g.stateT = 0; drawNow(); screens.options = hash();
    g.startGame(0); g.stageIndex = 0; g.startStage(); g.setState('play'); g.irisT = 99; g.paused = true; g.pauseIdx = 1; for (let i = 0; i < 3; i++) { g.update(STEP); g.input.endFrame(); } drawNow(); screens.pause = hash();
    g.paused = false; g.world = null; g.setState('title');
    // 画廊: 全種の敵・ボス・弾・アイテム・魔法エフェクト・カットインを 1 画面に出して描く（描画コードの切り出しで、通常プレイの 20 秒に出ない種も護る）
    const gallery = {};
    {
      const [{ createEnemy }, { createBoss }, { TreasureBox, Item, FloatingItem }, { EnemyShot, PoisonPool, PlayerShot, WEAPON_ORDER, ENEMY_SHOTS }, { castMagic }] = await Promise.all([
        import('/src/stage/entities/enemies.js'), import('/src/stage/entities/bosses.js'), import('/src/stage/entities/items.js'), import('/src/stage/entities/projectiles.js'), import('/src/stage/entities/magic.js')]);
      window.__seedRandom(4242);
      g.input.held.clear(); g.startGame(0); g.stageIndex = 0; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player; p.invT = 1e9; p.die = () => {}; p.setCostume('gold');
      const cx = Math.floor(w.cam.x); w.arena = { x0: cx, x1: cx + 256 }; // ボスの update は部屋（arena）を前提にする
      ['zombie', 'mushroom', 'unicorn', 'cake', 'angel', 'bear', 'eye', 'mermaid', 'umbrella', 'dollpart', 'needles', 'balloon', 'clown', 'mirror', 'gargoyle', 'cocoon', 'syruparm']
        .forEach((type, i) => { const e = createEnemy(w, { type, x: cx + 8 + i * 14, y: 40 + (i % 3) * 30 }); if (e) w.enemies.push(e); });
      ['doll', 'teddy', 'noir', 'serpent', 'machine', 'ringmaster', 'mirrorqueen', 'noirw', 'sugarqueen'].forEach((k, i) => { const b = createBoss(w, k, cx + 20 + i * 26, 176); if (b) { b.state = 'fight'; w.enemies.push(b); if (b.parts) w.enemies.push(...b.parts); } });
      ['dress', 'golddress', 'oneup', 'candy'].forEach((k, i) => { w.items.push(new Item(w, k, cx + 30 + i * 20, 120)); w.items.push(new FloatingItem(w, k, cx + 30 + i * 20, 100)); });
      w.boxes.push(new TreasureBox(w, cx + 200, 160));
      Object.keys(ENEMY_SHOTS).forEach((k, i) => w.enemyShots.push(new EnemyShot(w, k, cx + 10 + i * 20, 130, 0, 0)));
      w.pools.push(new PoisonPool(w, cx + 40, 176, 'poison'), new PoisonPool(w, cx + 90, 176, 'acid'));
      WEAPON_ORDER.forEach((k, i) => { w.shots.push(new PlayerShot(w, k, cx + 20 + i * 30, 90, 1, false), new PlayerShot(w, k, cx + 20 + i * 30, 80, 1, true)); });
      for (const k of WEAPON_ORDER) { p.weapon = k; castMagic(w, p, 2); castMagic(w, p, 1); }
      drawNow(); gallery.f0 = hash();
      for (let i = 0; i < 12; i++) { g.update(STEP); g.input.endFrame(); }
      drawNow(); gallery.f12 = hash();
      gallery.counts = { enemies: w.enemies.length, shots: w.shots.length, enemyShots: w.enemyShots.length, effects: w.effects.length, screenFx: w.screenFx.length, fires: w.fires.length, items: w.items.length };
      g.world = null; g.setState('title');
    }
    return { stages, screens, gallery, canvas: [canvas.width, canvas.height] };
  }, { FRAMES, SAMPLE, SHOT_AT });
  expect(errors).toEqual([]);

  if (UPDATE || !existsSync(GOLDEN)) {
    mkdirSync('test/golden', { recursive: true });
    writeFileSync(GOLDEN, JSON.stringify(got, null, 0) + '\n');
    console.log(`golden written: ${GOLDEN} (${got.stages.length} stages)`);
    return;
  }
  const want = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  expect(got.canvas).toEqual(want.canvas);
  expect(got.stages.map(s => s.name)).toEqual(want.stages.map(s => s.name));
  for (let i = 0; i < want.stages.length; i++) {
    const a = got.stages[i], b = want.stages[i];
    expect(a.end, `${b.name}: end state`).toBe(b.end);
    expect(a.traj, `${b.name}: trajectory (x, y, enemies, shots, score, lives, state, costume every ${SAMPLE} frames)`).toEqual(b.traj);
    expect(a.shots, `${b.name}: canvas hash at frames ${SHOT_AT}`).toEqual(b.shots);
  }
  expect(got.screens, 'title / options / pause canvas hashes').toEqual(want.screens);
  expect(got.gallery, 'gallery: every enemy / boss / shot / item / magic effect / cut-in drawn at once (frame 0 and 12)').toEqual(want.gallery);
});
