// 実キー入力での回帰テスト（ユーザー報告 2026-09-09「ジャンプができない」「一定以上進むと勝手に面が切り替わる」の再現確認）。
// window.__game を直接操作せず、Playwright のキーボードイベントだけで遊び、20 秒走っても面が変わらないことを確認する
import { test, expect } from '@playwright/test';

const boot = async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  return errors;
};
// タイトル → はじめから → プロローグ送り → 面開始 → play まで実キーで進める
const toPlay = async page => {
  await page.keyboard.press('Enter'); // はじめから
  await page.waitForFunction(() => window.__game.state === 'prologue');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); if (await page.evaluate(() => window.__game.state !== 'prologue')) break; }
  await page.waitForFunction(() => ['intro', 'play'].includes(window.__game.state), null, { timeout: 10_000 });
  await page.waitForTimeout(600); await page.keyboard.press('Enter'); // イントロを飛ばす
  await page.waitForFunction(() => window.__game.state === 'play', null, { timeout: 10_000 });
};

test('Space / X / K jump from the keyboard; running right for 20 s never changes the stage by itself', async ({ page }) => {
  const errors = await boot(page);
  await toPlay(page);
  const stage0 = await page.evaluate(() => window.__game.stageIndex);
  // ジャンプ: 地上で Space を押した直後に vy < 0 になり、その後に地面へ戻る
  const jumped = [];
  for (const key of ['Space', 'KeyX', 'KeyK']) {
    await page.waitForFunction(() => window.__game.world.player.onGround, null, { timeout: 5_000 });
    await page.keyboard.down(key);
    const vy = await page.evaluate(() => new Promise(r => { let n = 0; const f = () => { const p = window.__game.world.player; if (p.vy < 0 || ++n > 20) r(p.vy); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
    await page.keyboard.up(key); jumped.push({ key, vy });
  }
  for (const j of jumped) expect(j.vy, j.key).toBeLessThan(0);
  // 右へ 20 秒走る（死んでも復活する）。面（stageIndex）と状態が勝手に変わらない
  const p0 = await page.evaluate(() => window.__game.world.player.x);
  await page.keyboard.down('ArrowRight');
  const seen = new Set();
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1000); seen.add(await page.evaluate(() => `${window.__game.stageIndex}:${window.__game.state}`)); }
  await page.keyboard.up('ArrowRight');
  const p1 = await page.evaluate(() => window.__game.world.player.x);
  expect(p1).toBeGreaterThan(p0 + 50); // 実際に進んでいる
  const states = [...seen]; expect(states.every(s => s.startsWith(`${stage0}:`)), states.join(',')).toBe(true); // 面は変わらない
  expect(states.filter(s => !s.endsWith(':play') && !s.endsWith(':gameover')), states.join(',')).toEqual([]); // play（死亡→復活も play のまま）
  expect(errors).toEqual([]);
});
