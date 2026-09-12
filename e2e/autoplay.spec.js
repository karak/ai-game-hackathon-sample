// ボット自走 E2E: 全ステージを無敵＋die スタブで通しプレイし、clear に到達すること・実行時エラーが無いことを確認する。
// 決定論性: 同じデモ入力を 2 回再生して座標が一致すること。スクリーンショットを test-results/ に残す
import { test, expect } from '@playwright/test';

const boot = async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/api/log', r => r.fulfill({ status: 204 })); // 構造化ログの送信は握る（Sprint R）
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  await page.evaluate(() => window.__log.setSource('bot', { test: 'autoplay' }));
  return errors;
};

test('bot clears every stage (invincible, death stubbed) without runtime errors', async ({ page }) => {
  const errors = await boot(page);
  const results = await page.evaluate(async () => {
    const g = window.__game, STEP = 1 / 60, out = [];
    const { STAGES } = await import('/src/content/levels/index.js');
    for (let si = 0; si < STAGES.length; si++) {
      g.input.held.clear();
      g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player, map = w.level.map; p.invT = 1e9; p.die = () => {};
      let frames = 0, lastX = p.x;
      // 縦スクロール面: 足元の床の 1 つ上にある 'L' へ歩いて上を押す（登攀ボット）
      const ladderX = () => { const fy = Math.floor((p.y + p.h - 1) / 16); for (const ty of [fy, fy - 1]) for (let tx = 0; tx < map.width; tx++) if (map.at(tx, ty) === 'L') return tx * 16 + 8; return null; };
      while (g.state === 'play' && frames < 60 * 300) {
        if (w.level.vertical) {
          g.input.held.clear();
          if (p.climbing) g.input.held.add('up');
          else { const lx = ladderX(); let dir = 1; if (lx !== null) { const dx = lx - p.centerX; if (Math.abs(dx) < 3) g.input.held.add('up'); else { dir = dx > 0 ? 1 : -1; g.input.held.add(dir > 0 ? 'right' : 'left'); } } else g.input.held.add('right');
            // 進行方向の足元に床が無ければ跳ぶ（穴・風の吹き抜け）
            const ftx = Math.floor((p.centerX + dir * 10) / 16), fty = Math.floor((p.y + p.h + 1) / 16);
            if (p.onGround && !map.isSolid(ftx, fty) && !map.isOneWay(ftx, fty)) g.input.pressed.add('jump');
            if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 5 === 0) g.input.pressed.add('jump'); }
          if (frames % 15 === 0) g.input.pressed.add('shoot');
          if (w.boss && !w.boss.dying && w.boss.state !== 'enter' && frames % 60 === 0) w.boss.hurt(4, null);
          g.update(STEP); g.input.endFrame(); frames++;
          if (frames % 600 === 0) await new Promise(r => setTimeout(r, 0));
          continue;
        }
        g.input.held.add('right'); if (frames % 20 === 0) g.input.pressed.add('shoot');
        if (frames % 30 === 0) { if (p.x - lastX < 6) g.input.pressed.add('jump'); lastX = p.x; }
        if (!p.onGround && p.jumps === 1 && p.vy > 0 && frames % 7 === 0) g.input.pressed.add('jump');
        if (p.y > 224) { p.y = 60; p.x += 24; p.vy = 0; }
        if (w.boss && !w.boss.dying && w.boss.state !== 'enter' && frames % 60 === 0) w.boss.hurt(4, null);
        g.update(STEP); g.input.endFrame(); frames++;
        if (frames % 600 === 0) await new Promise(r => setTimeout(r, 0));
      }
      out.push({ stage: STAGES[si].name, endState: g.state, secs: +(frames / 60).toFixed(1) });
    }
    g.input.held.clear();
    return out;
  });
  for (const r of results) expect(r.endState, r.stage).toBe('clear');
  expect(results.length).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/autoplay-final.png' });
});

test('title menu, options and save round-trip', async ({ page }) => {
  const errors = await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60;
    const key = (code, type = 'keydown') => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    const tap = code => { key(code); g.update(STEP); g.input.endFrame(); key(code, 'keyup'); };
    g.input.held.clear(); g.setState('title'); g.menuIdx = 0;
    const menu = g.titleMenu().map(m => m.id);
    for (let i = 0; i < menu.indexOf('options'); i++) tap('ArrowDown');
    tap('Enter'); const opened = g.state;
    tap('ArrowLeft'); tap('ArrowLeft'); const vol = g.settings.volume;
    tap('Escape');
    return { menu, opened, vol, saved: JSON.parse(localStorage.getItem('lyrica_save')).volume, back: g.state };
  });
  expect(r.menu).toContain('options'); expect(r.opened).toBe('options'); expect(r.vol).toBe(5); expect(r.saved).toBe(5); expect(r.back).toBe('title');
  expect(errors).toEqual([]);
});

test('demo playback is deterministic and any key returns to title', async ({ page }) => {
  const errors = await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60; g.input.held.clear();
    const run = n => { if (!g.startDemo(0)) return null; const p = g.world.player; for (let i = 0; i < n; i++) { g.update(STEP); g.input.endFrame(); } return [g.state, +p.x.toFixed(3), +p.y.toFixed(3), g.world.enemies.length]; };
    const a = run(600), b = run(600);
    g.input.anyKey = true; g.update(STEP); g.input.endFrame();
    return { a, b, after: g.state };
  });
  expect(r.a).not.toBeNull(); expect(r.a).toEqual(r.b); expect(r.after).toBe('title');
  expect(errors).toEqual([]);
});

test('pause menu restarts the stage, game over offers continue, clearing unlocks loop 2 with harder rules, deaths are logged', async ({ page }) => {
  const errors = await boot(page);
  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60;
    const tick = n => { for (let i = 0; i < n; i++) { g.update(STEP); g.input.endFrame(); } };
    const press = a => { g.input.pressed.add(a); tick(1); };
    g.input.held.clear(); g.startGame(0); g.stageIndex = 1; g.startStage(); g.setState('play'); g.irisT = 99;
    const w0 = g.world; w0.player.x += 60;
    // ポーズ → 「面の はじめから」（2 番目）
    press('pause'); const paused = g.paused && g.state === 'play'; press('down'); press('start');
    tick(60 * 4); const restarted = g.world !== w0 && g.state === 'play' && Math.abs(g.world.player.x - g.world.level.playerStart.x) < 4;
    // 残機 0 で死亡 → ゲームオーバー → コンティニュー（1 番目）
    const deathsBefore = g.deathLog.length; g.lives = 0; g.world.player.die('spike'); tick(60 * 2.5);
    const gameover = g.state === 'gameover'; const logged = g.deathLog.length === deathsBefore + 1 ? g.deathLog[g.deathLog.length - 1] : null;
    tick(70); press('start'); tick(60 * 4); const cont = { state: g.state, continued: g.continued, score: g.score, lives: g.lives };
    g.score = 999999; g.saveHi(); const hiKept = g.hi < 999999; // コンティニュー後はハイスコアに記録しない
    // 1 周クリア済みなら「2 周目」がメニューに出て、開始すると敵弾 1.5 倍・湧き 0.8 倍
    g.settings.progress.cleared = true; const menu = g.titleMenu().map(m => m.id);
    g.startGame(0, 1); g.stageIndex = 0; g.startStage(); const hard = g.world.hard, loop = g.loop, scenes = g.endingScenes().length;
    g.input.held.clear();
    return { paused, restarted, gameover, logged, cont, hiKept, menu, hard, loop, scenes };
  });
  expect(r.paused).toBe(true); expect(r.restarted).toBe(true); expect(r.gameover).toBe(true);
  expect(r.logged).toMatchObject({ s: 'stage2', r: 'spike', l: 0 });
  expect(r.cont).toMatchObject({ state: 'play', continued: true, score: 0, lives: 2 }); expect(r.hiKept).toBe(true);
  expect(r.menu).toContain('loop2'); expect(r.hard).toEqual({ shotSpeed: 1.5, spawnGap: 0.8 }); expect(r.loop).toBe(1); expect(r.scenes).toBe(7);
  expect(errors).toEqual([]);
});
