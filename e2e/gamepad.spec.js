// ゲームパッド経路の回帰: navigator.getGamepads を偽装（standard mapping）し、タイトル開始・ジャンプ・移動・
// オプションの診断行（パッド名と押下ボタン）・パッドボタンでの割り当て変更・テスター報告のコピーが通ることを確認する。
// 実機パッドの物理的な確認は人が行う（docs/release/tester-guide.md）。ここはその前段で「API から操作までの経路」を固定する。
import { test, expect } from '@playwright/test';

const FAKE_ID = 'Fake Pad (Vendor: beef Product: cafe) (STANDARD GAMEPAD)';

test('gamepad: standard-mapping pad starts the game, jumps, moves, shows in options, rebinds; tester report copies', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(id => {
    const pad = { id, index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__pad = pad;
    window.__press = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; pad.timestamp++; };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  }, FAKE_ID);
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });

  const r = await page.evaluate(() => {
    const g = window.__game, STEP = 1 / 60;
    const frame = () => { g.input.poll(); g.update(STEP); g.input.endFrame(); };
    const tap = i => { window.__press(i, true); frame(); window.__press(i, false); frame(); };
    g.input.held.clear(); g.setState('title'); g.menuIdx = 0; frame();
    const connected = g.input.padConnected, id = g.input.padId;
    // START(b9) でタイトル → プロローグ。A(b0) で送って面開始 → play
    tap(9); const afterStart = g.state;
    for (let i = 0; i < 8 && g.state === 'prologue'; i++) { tap(0); for (let k = 0; k < 10; k++) frame(); }
    for (let i = 0; i < 60 * 6 && g.state !== 'play'; i++) { if (g.state === 'intro' && g.stateT > 0.6) tap(0); else frame(); }
    const playing = g.state === 'play';
    const p = g.world.player; p.invT = 1e9; p.die = () => {};
    for (let i = 0; i < 90 && !p.onGround; i++) frame();
    // A でジャンプ → vy < 0
    window.__press(0, true); frame(); const vy = p.vy; window.__press(0, false); frame();
    for (let i = 0; i < 120 && !p.onGround; i++) frame();
    // 十字キー右(b15) を 30 フレーム → x が増える。左スティック(axes[0]=1) でも同じ
    const x0 = p.x; window.__press(15, true); for (let i = 0; i < 30; i++) frame(); window.__press(15, false); frame(); const dxButton = p.x - x0;
    const x1 = p.x; window.__pad.axes[0] = 1; for (let i = 0; i < 30; i++) frame(); window.__pad.axes[0] = 0; frame(); const dxAxis = p.x - x1;
    // run 記録: 開始で 1 件開き、死亡で deaths が増える
    const runsOpen = g.runs.length, deaths0 = g.run.deaths; g.logDeath('hit'); const deaths1 = g.run.deaths;
    // オプションの診断行: パッド名が出て、押している間はボタン名が付く
    g.world = null; g.finishRun(); g.setState('title'); g.optIdx = 0; g.capturing = null; g.setState('options'); frame();
    const padRow = g.optionRowText({ kind: 'pad' }); window.__press(1, true); frame(); const padRowPressed = g.optionRowText({ kind: 'pad' }); window.__press(1, false); frame();
    // 割り当て変更: 「ジャンプ」の行まで十字キー下(b13)で送り、A で待ち受け → RB(b5) を押すと jump に割り当たり保存される
    for (let i = 0; i < 20 && g.optionRow(g.optIdx).action !== 'jump'; i++) tap(13);
    tap(0); const waiting = g.capturing; tap(5); frame();
    const rebound = { waiting, pad: g.settings.pad.b5, saved: JSON.parse(localStorage.getItem('lyrica_save')).pad.b5 };
    return { connected, id, afterStart, playing, vy, dxButton, dxAxis, runsOpen, deaths0, deaths1, runEnded: g.runs.at(-1).end != null, padRow, padRowPressed, rebound };
  });
  expect(r.connected).toBe(true); expect(r.id).toBe(FAKE_ID);
  expect(r.afterStart).toBe('prologue'); expect(r.playing).toBe(true);
  expect(r.vy).toBeLessThan(0);
  expect(r.dxButton).toBeGreaterThan(20); expect(r.dxAxis).toBeGreaterThan(20);
  expect(r.runsOpen).toBeGreaterThanOrEqual(1); expect(r.deaths1).toBe(r.deaths0 + 1); expect(r.runEnded).toBe(true);
  expect(r.padRow[1]).toBe('Fake Pad'); expect(r.padRowPressed[1]).toBe('Fake Pad  [B]');
  expect(r.rebound).toEqual({ waiting: 'jump', pad: 'jump', saved: 'jump' });
  await page.screenshot({ path: 'test-results/shots/options_gamepad.png' });

  // テスター報告のコピー: JSON がクリップボードに入り、版・パッド名・run が入っている
  const rep = await page.evaluate(async () => {
    const g = window.__game; const ok = await g.copyReport();
    const txt = await navigator.clipboard.readText().catch(() => g.lastReport);
    const j = JSON.parse(txt); return { ok, msg: g.optionRowText({ kind: 'report' })[1], version: j.version, pad: j.env.pad, runs: j.runs.runs, deaths: j.runs.deaths };
  });
  expect(typeof rep.version).toBe('string'); expect(rep.version.length).toBeGreaterThan(0); // vite define の BUILD_ID（dev でも base36 の時刻）
  expect(rep.pad).toBe(FAKE_ID); expect(rep.runs).toBeGreaterThanOrEqual(1); expect(rep.deaths).toBeGreaterThanOrEqual(1);
  expect(rep.ok).toBe(true); expect(['コピーしました', 'Copied']).toContain(rep.msg); // ブラウザ言語が en なら英語表示
  expect(errors).toEqual([]);
});
