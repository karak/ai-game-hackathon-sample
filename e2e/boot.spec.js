// M6: 初回ロード時間（game.bootMs、出口条件 3 秒以内）と英語 UI（IMP-008）。
// 英語は保存済み設定（lyrica_save.lang = 'en'）で起動し、タイトル／オプション／面開始の文言が英語になることを確認して撮影する
import { test, expect } from '@playwright/test';

const boot = async page => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  return errors;
};

test('first load (font + 235 assets, predecoded) finishes under 3 s on localhost', async ({ page }) => {
  const errors = await boot(page);
  const bootMs = await page.evaluate(() => window.__game.bootMs);
  console.log(`bootMs=${bootMs}`);
  expect(bootMs).toBeGreaterThan(0); expect(bootMs).toBeLessThan(3000);
  expect(errors).toEqual([]);
});

test('English UI: saved lang=en drives title menu, options, stage intro, boss name and the page notes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lyrica_save', JSON.stringify({ version: 1, lang: 'en', progress: { stage: 2, cleared: true } })));
  const errors = await boot(page);
  await page.setViewportSize({ width: 900, height: 760 });
  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60;
    const tick = n => { for (let i = 0; i < n; i++) { g.update(STEP); g.input.endFrame(); } };
    const menu = g.titleMenu().map(m => m.label);
    const info = [...document.querySelectorAll('#info [data-lang]')].map(el => [el.dataset.lang, el.hidden]);
    g.stageIndex = 0; g.startStage(); tick(1);
    const w = g.world; const bossName = w.bossName();
    return { lang: g.settings.lang, menu, info, htmlLang: document.documentElement.lang, bossName, state: g.state, pause: g.pauseMenu().map(m => m.label) };
  });
  expect(r.lang).toBe('en');
  expect(r.menu).toEqual(['New Game', 'Continue (Chapter 3)', '2nd Loop (True End)', 'Options']);
  expect(r.pause).toEqual(['Resume', 'Restart Stage', 'Quit to Title']);
  expect(r.info).toEqual([['ja', true], ['en', false]]); expect(r.htmlLang).toBe('en');
  expect(r.bossName).toBe('Dorothy the Weeping Doll');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/shots/en_intro.png' }); // 章題「Chapter 1  Graveyard of Flowers」
  // オプション → 言語行で ◀ を押すと日本語へ戻り、保存される。#info も差し替わる
  const back = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60;
    const tick = n => { for (let i = 0; i < n; i++) { g.update(STEP); g.input.endFrame(); } };
    const press = a => { g.input.pressed.add(a); tick(1); };
    g.world = null; g.setState('title'); g.menuIdx = g.titleMenu().findIndex(m => m.id === 'options'); press('start');
    const optRowsEn = g.optionRowText({ kind: 'lang' });
    press('down'); press('down'); press('left'); // volume → mute → lang → ◀
    return { optRowsEn, lang: g.settings.lang, saved: JSON.parse(localStorage.getItem('lyrica_save')).lang, jaVisible: !document.querySelector('#info [data-lang="ja"]').hidden, title: g.titleMenu()[0].label, state: g.state };
  });
  expect(back.optRowsEn).toEqual(['Language', '◀ English ▶']);
  expect(back.lang).toBe('ja'); expect(back.saved).toBe('ja'); expect(back.jaVisible).toBe(true); expect(back.title).toBe('はじめから'); expect(back.state).toBe('options');
  await page.evaluate(() => { const g = window.__game; g.input.pressed.add('right'); g.update(1 / 60); g.input.endFrame(); }); // 英語に戻して撮影
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/shots/en_options.png' });
  await page.evaluate(() => { const g = window.__game; g.leaveOptions(); g.update(1 / 60); g.input.endFrame(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/shots/en_title.png' });
  expect(errors).toEqual([]);
});

// ADR-0040 / DEBT-003: 素材が 1 枚読めなくても起動し、そのキーには manifest の寸法どおりのプレースホルダが入り、ASSET.FAIL が 1 件出る。
// 旧文字列ドット絵へのフォールバックは撤去したので、欠落は「見えない」ではなく「市松で見える」のが正
test('a sprite that fails to load becomes a same-size placeholder, boot continues, ASSET.FAIL is logged once', async ({ page }) => {
  await page.route('**/assets/sprites/enemies/zombie1.png*', r => r.abort()); // route はアクションの前
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60, A = g.assets;
    const tick = n => { for (let i = 0; i < n; i++) { g.update(STEP); g.input.endFrame(); } };
    const z = A.enemies.zombie1, z2 = A.enemies.zombie2;
    g.input.held.clear(); g.startGame(0); g.stageIndex = 0; g.startStage(); g.setState('play'); g.irisT = 99;
    g.input.held.add('right'); tick(240); // ゾンビが湧いて描かれる区間（描画で例外が出ないこと）
    const d = window.__log.dump();
    return { z: { missing: !!z.missing, hd: !!z.hd, w: z.w, h: z.h, rw: z.r.width, rh: z.r.height }, z2missing: !!z2.missing, fails: d.filter(e => e.code === 'ASSET.FAIL').map(e => e.attr.path), boot: d.find(e => e.code === 'GAME.BOOT')?.attr.loaderWarnings, zombies: g.world.enemies.filter(e => e.def?.kind === 'zombie' || /zombie/.test(e.baseSprite ?? '')).length, state: g.state };
  });
  expect(r.z).toEqual({ missing: true, hd: true, w: 64 / 3, h: 101 / 3, rw: 64, rh: 101 }); // manifest enemies/zombie1 = 64×101
  expect(r.z2missing).toBe(false);
  expect(r.fails).toEqual(['assets/sprites/enemies/zombie1.png']); expect(r.boot).toBe(1);
  expect(r.state).toBe('play');
  await page.screenshot({ path: 'test-results/shots/placeholder_zombie1.png' });
  expect(errors.filter(e => !/load failed|net::ERR_FAILED/.test(e))).toEqual([]); // 握った PNG のネットワークエラー（ブラウザの console.error と loader の warn）以外に error は無い
});
