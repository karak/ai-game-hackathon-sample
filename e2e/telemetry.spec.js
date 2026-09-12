// 構造化ログ（Sprint R / R2 の受入）: 1 面をボットで遊び、SESSION.START → GAME.BOOT → RUN.START → STAGE.START → PLAYER.DEATH … が順に出る、
// lvl: error が 0 件、sid が全件同じ、seq が連番、/api/log への送信はバッチごとに同じ rid、?telemetry=0 なら送らない
import { test, expect } from '@playwright/test';

const play = async (page, url) => {
  const posts = [];
  await page.route('**/api/log', r => { posts.push(JSON.parse(r.request().postData())); r.fulfill({ status: 204 }); }); // route はアクションの前（test-quality）
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60; window.__log.setSource('bot', { test: 'telemetry' });
    g.input.held.clear(); g.startGame(0); g.stageIndex = 0; g.startStage(); g.setState('play'); g.irisT = 99;
    const w = g.world, p = w.player; p.invT = 0;
    g.input.held.add('right'); for (let i = 0; i < 180; i++) { g.update(STEP); g.input.endFrame(); }
    p.hit({ x: p.x + 20, w: 8, def: { kind: 'zombie' } }); p.invT = 0; for (let i = 0; i < 5; i++) { g.update(STEP); g.input.endFrame(); }
    p.die('bog'); w.onPlayerDeath();
    for (let i = 0; i < 30; i++) { g.update(STEP); g.input.endFrame(); }
    window.__log.flush();
    const d = window.__log.dump();
    return { sid: window.__log.sid, stats: window.__log.stats(), codes: d.map(e => e.code), seqs: d.map(e => e.seq), sids: [...new Set(d.map(e => e.sid))], errors: d.filter(e => e.lvl === 'error'), death: d.find(e => e.code === 'PLAYER.DEATH'), hit: d.find(e => e.code === 'PLAYER.HIT'), boot: d.find(e => e.code === 'GAME.BOOT'), start: d.find(e => e.code === 'SESSION.START'), enabled: window.__log.stats().enabled };
  });
  await page.waitForTimeout(200);
  return { r, posts, errors };
};

test('one stage of bot play produces the ordered event chain with shared sid, consecutive seq, zero errors, and batched sends with one rid per batch', async ({ page }) => {
  const { r, posts, errors } = await play(page, '/index.html?telemetry=1'); // dev サーバーでは送信は既定 OFF なので ?telemetry=1 で入れる
  expect(errors).toEqual([]); expect(r.errors).toEqual([]);
  const order = ['SESSION.START', 'GAME.BOOT', 'RUN.START', 'STAGE.START', 'PLAYER.HIT', 'PLAYER.DEATH'];
  const idx = order.map(c => r.codes.indexOf(c)); expect(idx.every(i => i >= 0)).toBe(true); expect(idx).toEqual([...idx].sort((a, b) => a - b));
  expect(r.sids).toEqual([r.sid]); expect(r.sid).toMatch(/^[0-9a-f]{32}$/);
  expect(r.seqs).toEqual(r.seqs.map((_, i) => i + 1));
  expect(r.start.attr.env).toMatchObject({ lang: expect.any(String), vw: expect.any(Number), vh: expect.any(Number), dpr: expect.any(Number), touch: expect.any(Boolean) });
  expect(Object.keys(r.start.attr.env).some(k => ['ip', 'name', 'email'].includes(k))).toBe(false);
  expect(r.boot.attr.assets).toBeGreaterThanOrEqual(282); expect(r.boot.attr.loaderWarnings).toBe(0); expect(r.boot.attr.bootMs).toBeGreaterThan(0);
  expect(r.hit.attr.by).toBe('zombie'); expect(r.hit.src).toBe('bot'); expect(r.hit.attr.test).toBe('telemetry');
  expect(r.death.attr).toMatchObject({ reason: 'bog', by: 'zombie' }); expect(r.death.ctx).toMatchObject({ state: 'play', stage: 'stage1', loop: 0, costume: 'plain' }); expect(r.death.ctx.x).toBeGreaterThan(0);
  // 送信: SESSION.START / GAME.BOOT は起動時に流し、残りは flush でまとめて送られる。debug（GAME.STATE）は送られない。バッチ内の rid は 1 つ
  expect(posts.length).toBeGreaterThanOrEqual(1);
  const sent = posts.flat(); expect(sent.some(e => e.code === 'GAME.STATE')).toBe(false); expect(sent.map(e => e.code)).toContain('PLAYER.DEATH');
  for (const b of posts) { expect(new Set(b.map(e => e.rid)).size).toBe(1); expect(b[0].rid).toMatch(/^[0-9a-f]{32}$/); }
  expect(r.stats.sendFail).toBe(0); expect(r.enabled).toBe(true);
});

test('?telemetry=0 (and the dev default) keeps the buffer and console but sends nothing', async ({ page }) => {
  const { r, posts, errors } = await play(page, '/index.html?telemetry=0');
  expect(errors).toEqual([]); expect(posts).toEqual([]); expect(r.enabled).toBe(false);
  expect(r.codes).toContain('PLAYER.DEATH'); expect(r.stats.buffered).toBe(r.codes.length);
});
