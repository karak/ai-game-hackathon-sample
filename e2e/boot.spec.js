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
