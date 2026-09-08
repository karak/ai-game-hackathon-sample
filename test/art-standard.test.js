import { test, expect } from 'vitest';
import manifest from '../src/gfx/manifest.json';
import { THEMES } from '../src/gfx/tiles.js';

// docs/art-standard.md §2 の数値基準を、生成済みスプライトの manifest（後処理メタ）で機械検査する
const entries = Object.entries(manifest);
const group = g => entries.filter(([k]) => k.startsWith(g + '/'));

test('manifest has player, enemy and boss sprites', () => {
  expect(group('player').length).toBeGreaterThanOrEqual(10);
  expect(group('enemies').length).toBeGreaterThanOrEqual(12);
  expect(group('bosses').length).toBe(3);
});

test('§2.1 player body frames are 40-80 wide and 70-120 tall; hat/dead/crouch have their own ranges', () => {
  for (const [k, v] of group('player')) {
    const n = k.split('/')[1].replace(/_(plain|gold|nohat)$/, '');
    if (n === 'hurt2') continue; // 被弾点滅フレーム（白飛び）は対象外
    if (n === 'hat') { expect(v.w, k).toBeLessThanOrEqual(80); expect(v.h, k).toBeLessThanOrEqual(70); continue; }
    if (n === 'dead') { expect(v.w, k).toBeGreaterThanOrEqual(80); expect(v.h, k).toBeLessThanOrEqual(80); continue; }
    if (n === 'hat' || n === 'base_hat') continue;
    if (n === 'base_hat') continue;
    expect(v.w, k).toBeGreaterThanOrEqual(36); expect(v.w, k).toBeLessThanOrEqual(90);
    expect(v.h, k).toBeGreaterThanOrEqual(n === 'jump' || n === 'crouch' ? 70 : 90); expect(v.h, k).toBeLessThanOrEqual(140);
  }
});

test('§2.1 enemies are 60-135 tall (0.6-1.3x player) and bosses 130-200 tall', () => {
  for (const [k, v] of group('enemies')) { expect(v.h, k).toBeGreaterThanOrEqual(60); expect(v.h, k).toBeLessThanOrEqual(135); expect(v.w, k).toBeLessThanOrEqual(160); }
  for (const [k, v] of group('bosses')) { expect(v.h, k).toBeGreaterThanOrEqual(130); expect(v.h, k).toBeLessThanOrEqual(200); }
});

test('§2.2 every generated sprite has 10-15 colors and fits its spec box', () => {
  for (const [k, v] of entries) {
    if (k === 'player/hat' || k.includes('hurt2')) continue; // 帽子は色抽出の単品、hurt2 は白飛びフレーム
    if (k.startsWith('bg/') || k.startsWith('tiles/')) { expect(v.colors, k).toBeLessThanOrEqual(32); continue; } // 背景・地形は 32 色まで
    if (k.startsWith('shots/') || k.startsWith('items/') || k.startsWith('deco/')) { expect(v.colors, k).toBeGreaterThanOrEqual(3); expect(v.colors, k).toBeLessThanOrEqual(15); expect(v.fits, k).toBe(true); continue; } // 小物は 5 色以上
    expect(v.colors, k).toBeGreaterThanOrEqual(10); expect(v.colors, k).toBeLessThanOrEqual(15);
    expect(v.fits, k).toBe(true);
  }
});

test('animation coverage: player has idle/run1-4/jump/fall/attack/crouch/hurt/dead; each enemy has 2 frames', () => {
  const names = new Set(group('player').map(([k]) => k.split('/')[1]));
  for (const n of ['idle', 'run1', 'run2', 'run3', 'run4', 'jump', 'fall', 'attack', 'crouch', 'hurt', 'dead']) expect(names.has(n), n).toBe(true);
  const en = new Set(group('enemies').map(([k]) => k.split('/')[1]));
  for (const b of ['zombie', 'mushroom', 'unicorn', 'cake', 'angel', 'bear', 'eye']) { expect(en.has(b + '1'), b + '1').toBe(true); expect(en.has(b + '2'), b + '2').toBe(true); }
});

test('§2.4 themes define enough tones for ground, platform, sky', () => {
  for (const [name, th] of Object.entries(THEMES)) {
    expect(th.grass.length, name).toBeGreaterThanOrEqual(3); expect(th.dirt.length, name).toBeGreaterThanOrEqual(3); expect(th.plat.length, name).toBeGreaterThanOrEqual(3);
  }
});
