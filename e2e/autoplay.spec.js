// ボット自走 E2E: 全ステージを無敵＋die スタブで通しプレイし、clear に到達すること・実行時エラーが無いことを確認する。
// 決定論性: 同じデモ入力を 2 回再生して座標が一致すること。スクリーンショットを test-results/ に残す
import { test, expect } from '@playwright/test';

const boot = async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  return errors;
};

test('bot clears every stage (invincible, death stubbed) without runtime errors', async ({ page }) => {
  const errors = await boot(page);
  const results = await page.evaluate(async () => {
    const g = window.__game, STEP = 1 / 60, out = [];
    const { STAGES } = await import('/src/levels/index.js');
    for (let si = 0; si < STAGES.length; si++) {
      g.input.held.clear();
      g.startGame(0); g.stageIndex = si; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player; p.invT = 1e9; p.die = () => {};
      let frames = 0, lastX = p.x;
      while (g.state === 'play' && frames < 60 * 300) {
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
