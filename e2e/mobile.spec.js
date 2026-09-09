// M6 モバイル簡易対応: スマホ縦（390×844、タッチ）でキャンバスが画面幅に収まり、タッチパッドが出て、ボタンで開始・ジャンプできる
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' });

test('phone portrait: canvas fits the viewport width, touchpad visible, taps start the game and jump', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  const vw = page.viewportSize().width;
  const box = await page.locator('#game').boundingBox();
  expect(box.width, 'canvas must not overflow the phone width').toBeLessThanOrEqual(vw + 0.5);
  expect(box.width).toBeGreaterThan(vw * 0.9); // 幅いっぱいに縮小されている
  const pad = page.locator('#touchpad');
  await expect(pad).toBeVisible();
  const padBox = await pad.boundingBox();
  expect(padBox.y + padBox.height).toBeLessThanOrEqual(page.viewportSize().height + 0.5); // パッドも画面内
  await page.screenshot({ path: 'test-results/shots/mobile_title.png' });
  // ▶▶（start）でタイトル → プロローグ → 面開始 → play
  const start = page.locator('[data-act="start"]');
  await start.tap(); await page.waitForFunction(() => window.__game.state === 'prologue');
  for (let i = 0; i < 6; i++) { await start.tap(); await page.waitForTimeout(150); if (await page.evaluate(() => window.__game.state !== 'prologue')) break; }
  await page.waitForFunction(() => ['intro', 'play'].includes(window.__game.state), null, { timeout: 10_000 });
  await page.waitForTimeout(600); await start.tap();
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__game.world.player.onGround, null, { timeout: 5_000 });
  // X（jump）をタップした直後に vy < 0
  const jump = page.locator('[data-act="jump"]');
  const vyP = page.evaluate(() => new Promise(r => { let n = 0; const f = () => { const p = window.__game.world.player; if (p.vy < 0 || ++n > 40) r(p.vy); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  await jump.tap();
  expect(await vyP).toBeLessThan(0);
  // ▶（right）を押し続けると進む（入力経路の確認なので、敵との接触で位置が戻らないよう無敵にし、着地を待つ）
  await page.evaluate(() => { const p = window.__game.world.player; p.invT = 1e9; p.die = () => {}; });
  await page.waitForFunction(() => window.__game.world.player.onGround, null, { timeout: 5_000 });
  const x0 = await page.evaluate(() => window.__game.world.player.x);
  const right = page.locator('[data-act="right"]'); const rb = await right.boundingBox();
  await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height / 2); // touchstart+touchend: 1 フレーム分
  const held = await page.evaluate(async () => {
    // touchstart のみをディスパッチして押し続けを再現し、1 秒後に離す
    const btn = document.querySelector('[data-act="right"]');
    const ev = type => new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchstart' ? [new Touch({ identifier: 1, target: btn })] : [] });
    btn.dispatchEvent(ev('touchstart')); await new Promise(r => setTimeout(r, 1000)); const on = btn.classList.contains('on'); btn.dispatchEvent(ev('touchend'));
    return on;
  });
  expect(held).toBe(true);
  const x1 = await page.evaluate(() => window.__game.world.player.x);
  expect(x1).toBeGreaterThan(x0 + 30);
  await page.screenshot({ path: 'test-results/shots/mobile_play.png' });
  expect(errors).toEqual([]);
});
