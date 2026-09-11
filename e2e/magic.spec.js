// 強化魔法（L2）の実機確認: フルブルームドレスで SUPER_T まで溜めて 4 武器ぶんを撃ち、
// エフェクトが出る・実行時エラーが無い・スクリーンショットが残ることを確認する（verifying-browser-games-with-bots）
import { test, expect } from '@playwright/test';

test('super magic: each weapon casts its L2 spell in game, with effects on screen and no errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });

  const out = [];
  for (const weapon of ['star', 'knife', 'heart', 'candle']) {
    const r = await page.evaluate(async weapon => {
      const g = window.__game, STEP = 1 / 60;
      const { SUPER_T } = await import('/src/stage/entities/magic.js');
      const tick = (n, held = []) => { for (let i = 0; i < n; i++) { g.input.held.clear(); for (const a of held) g.input.held.add(a); g.update(STEP); g.input.endFrame(); } };
      g.input.held.clear(); g.startGame(0); g.stageIndex = 0; g.startStage(); g.setState('play'); g.irisT = 99;
      const w = g.world, p = w.player;
      p.invT = 1e9; p.die = () => {}; p.setCostume('gold'); p.weapon = weapon;   // フルブルームドレス（溜め撃ち解放）
      tick(30);
      tick(Math.ceil(60 * (SUPER_T + 0.2)), ['shoot']);                          // 溜める
      const ready = p.superReady, charging = p.frame();                          // 溜め切ると詠唱ポーズ
      tick(1);                                                                   // 離す → 強化魔法
      const cast = { effects: w.effects.length, fires: w.fires.length, shots: w.shots.length, toast: w.toasts.at(-1)?.msg ?? '', cutins: w.screenFx.length, pose: p.frame(), flash: +g.world.fx.flashAlpha.toFixed(2), slow: +g.world.fx.timeScale.toFixed(2) };
      tick(12);                                                                  // カットインが滑り込んだところで撮る
      return { ready, charging, cast, after: { effects: w.effects.length, fires: w.fires.length, shots: w.shots.length, cutins: w.screenFx.length }, weapon };
    }, weapon);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test-results/shots/super_${weapon}.png` });        // カットインが出ている瞬間
    const alive = await page.evaluate(() => { const g = window.__game, STEP = 1 / 60; for (let i = 0; i < 45; i++) { g.input.held.clear(); g.update(STEP); g.input.endFrame(); } return { state: g.world.player.state, costume: g.world.player.costume, gameState: g.state }; });
    r.alive = alive;
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test-results/shots/super_${weapon}_after.png` });  // カットインが抜けて魔法が展開したところ
    out.push(r);
  }
  for (const r of out) {
    expect(r.ready, `${r.weapon}: 溜めが 2 段階目に達する`).toBe(true);
    expect(r.charging, `${r.weapon}: 詠唱ポーズ`).toBe('cast1');
    expect(r.cast.toast, `${r.weapon}: 魔法名のテロップ`).not.toBe('');
    const live = r.cast.effects + r.cast.fires + r.cast.shots;
    expect(live, `${r.weapon}: 発動直後にエフェクトが存在する`).toBeGreaterThan(0);
  }
  for (const r of out) {
    expect(r.cast.cutins, `${r.weapon}: カットインが 1 枚出る`).toBe(1);
    expect(r.after.cutins, `${r.weapon}: カットインは撮影時点でまだ出ている`).toBe(1);
    expect(r.cast.pose, `${r.weapon}: 発動ポーズ`).toBe('cast2');
    expect(r.cast.flash, `${r.weapon}: 画面フラッシュ`).toBeGreaterThan(0.3);
    expect(r.cast.slow, `${r.weapon}: 一瞬のスロー`).toBeLessThan(1);
    expect(r.alive, `${r.weapon}: 詠唱後も主人公は生きていて play のまま`).toMatchObject({ state: 'normal', costume: 'gold', gameState: 'play' });
  }
  expect(out.find(r => r.weapon === 'candle').cast.fires).toBe(5);   // 蝋の聖歌隊: 火柱 5 本
  expect(out.find(r => r.weapon === 'knife').cast.effects).toBe(8); // 鏡像の舞踏会: 鏡像 4 体＋鏡の枠 4 枚（枠は 0.25 秒後に割れて破片を出す）
  expect(out.find(r => r.weapon === 'star').cast.effects).toBeGreaterThanOrEqual(2); // 流星の caster と葬列
  expect(errors).toEqual([]);
});
