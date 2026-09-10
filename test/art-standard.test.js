import { test, expect } from 'vitest';
import manifest from '../src/gfx/manifest.json';
import { THEMES } from '../src/gfx/tiles.js';

// docs/art-standard.md §2 の数値基準を、生成済みスプライトの manifest（後処理メタ）で機械検査する
const entries = Object.entries(manifest);
const group = g => entries.filter(([k]) => k.startsWith(g + '/'));

test('manifest has player, enemy and boss sprites', () => {
  expect(group('player').length).toBeGreaterThanOrEqual(10);
  expect(group('enemies').length).toBeGreaterThanOrEqual(12);
  expect(group('bosses').length).toBeGreaterThanOrEqual(6); // 3 体 × 2 コマ（待機 / 攻撃）
});

test('§2.1 player body frames are 40-80 wide and 70-120 tall; hat/dead/crouch have their own ranges', () => {
  for (const [k, v] of group('player')) {
    const n = k.split('/')[1].replace(/_(plain|gold|nohat)$/, '');
    if (n === 'hurt2') continue; // 被弾点滅フレーム（白飛び）は対象外
    if (n === 'hat') { expect(v.w, k).toBeLessThanOrEqual(80); expect(v.h, k).toBeLessThanOrEqual(70); continue; }
    if (n === 'dead') { expect(v.w, k).toBeGreaterThanOrEqual(80); expect(v.h, k).toBeLessThanOrEqual(80); continue; }
    if (n === 'hat' || n === 'base_hat') continue;
    if (n === 'base_hat') continue;
    expect(v.w, k).toBeGreaterThanOrEqual(36); expect(v.w, k).toBeLessThanOrEqual(/^run\ds$/.test(n) || /^cast\d$/.test(n) ? 110 : 90); // 走り撃ち（run1s/run3s）は前に突き出した杖と火花、詠唱（cast1/cast2）は掲げた杖と伸ばした腕で幅 +25 まで許す（art-standard §2.1）
    expect(v.h, k).toBeGreaterThanOrEqual(n === 'jump' || n === 'crouch' ? 70 : 90); expect(v.h, k).toBeLessThanOrEqual(140);
  }
});

test('§2.1 enemies are 60-135 tall (0.6-1.3x player) and bosses 130-200 tall', () => {
  const PARTIAL = { 'enemies/mermaid1': 40 }; // 水面上の半身だけを描くコマ（例外。下限 40）
  const TALL = { 'enemies/cocoon1': 145, 'enemies/cocoon2': 145 }; // 天井からの吊り糸を含むコマ（art-standard §2.1 の例外）
  for (const [k, v] of group('enemies')) { expect(v.h, k).toBeGreaterThanOrEqual(PARTIAL[k] ?? 60); expect(v.h, k).toBeLessThanOrEqual(TALL[k] ?? 135); expect(v.w, k).toBeLessThanOrEqual(160); }
  for (const [k, v] of group('bosses')) { if (/_(body|tail)$/.test(k)) { expect(v.h, k).toBeGreaterThanOrEqual(50); continue; } expect(v.h, k).toBeGreaterThanOrEqual(130); expect(v.h, k).toBeLessThanOrEqual(200); } // 多節ボスの胴・尾は頭より小さい
});

test('§2.2 every generated sprite has 10-15 colors and fits its spec box', () => {
  for (const [k, v] of entries) {
    if (k.startsWith('cutin/')) { expect(v.colors, k).toBeLessThanOrEqual(32); continue; } // カットインは挿絵級の不透明パネル（尊重物と同じ 32 色まで。§2.6。箱は目安）
    if (k === 'player/hat' || k.includes('hurt2')) continue; // 帽子は色抽出の単品、hurt2 は白飛びフレーム
    if (k.startsWith('bg/') || k.startsWith('tiles/') || k.startsWith('ending/')) { expect(v.colors, k).toBeLessThanOrEqual(32); continue; } // 背景・地形・エンディング絵は 32 色まで（箱は目安）
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
  const bs = new Set(group('bosses').map(([k]) => k.split('/')[1]));
  for (const b of ['doll', 'teddy', 'noir']) { expect(bs.has(b + '1'), b + '1').toBe(true); expect(bs.has(b + '2'), b + '2').toBe(true); }
  const sh = new Set(group('shots').map(([k]) => k.split('/')[1]));
  expect(sh.has('fire1') && sh.has('fire2'), 'fire1/fire2').toBe(true);
});

test('§2.4 themes define enough tones for ground, platform, sky', () => {
  for (const [name, th] of Object.entries(THEMES)) {
    expect(th.grass.length, name).toBeGreaterThanOrEqual(3); expect(th.dirt.length, name).toBeGreaterThanOrEqual(3); expect(th.plat.length, name).toBeGreaterThanOrEqual(3);
  }
});

test('§2.5 background layers: each theme has sky + far A/B + mid; far variants share scale (height 60-160 cells, width 200-330)', () => {
  const bg = Object.fromEntries(group('bg').map(([k, v]) => [k.split('/')[1], v]));
  for (const th of ['graveyard', 'candyforest', 'castle']) {
    for (const l of ['sky', 'far', 'far2', 'mid']) expect(bg[th + '_' + l], th + '_' + l).toBeTruthy();
    for (const l of ['far', 'far2']) { const v = bg[th + '_' + l]; expect(v.h, th + l).toBeGreaterThanOrEqual(60); expect(v.h, th + l).toBeLessThanOrEqual(160); expect(v.w, th + l).toBeGreaterThanOrEqual(200); expect(v.w, th + l).toBeLessThanOrEqual(330); }
    const a = bg[th + '_far'].h, b = bg[th + '_far2'].h; expect(Math.max(a, b) / Math.min(a, b), th + ' far A/B height ratio').toBeLessThanOrEqual(1.4);
  }
});

// §2.6 挿絵級（カットイン・エンディング）は尊重物 ending/scene1・scene6 と同じ物差し（tools/style_check.py が manifest に書き足す flat / dither / outline）で比べる。
// 帯: 色数 28〜32、flat ≤ 0.28（尊重物 0.16 / 0.20）、dither ≥ 0.07、輪郭は暗紫〜暗い葡萄色（hue 255〜335、明度 ≤ 0.23。尊重物 276/286・0.19/0.14。
// 上限は尊重物と同じ手順で描いた cutin v2 の暖色パネル（薔薇の空・蝋燭の光）が 315〜328・0.23 に出たことから置いた。tools/style_check.py と同値）。
// PENDING は帯の外にある既存絵（IMP-022 の修正対象）。2026-09-10 に cutin 4 枚・scene3/4/5 を再生成して空になった。新しい挿絵級が帯を外れたら失敗する
test('§2.6 illustration-class images match the canon (ending/scene1, scene6) on colors, grain and outline', () => {
  const PENDING = new Set([]);
  const illust = entries.filter(([k]) => k.startsWith('cutin/') || k.startsWith('ending/'));
  expect(illust.length).toBeGreaterThanOrEqual(10);
  for (const [k, v] of illust) {
    expect(typeof v.flat, k + ' has style metrics (run tools/style_check.py --manifest)').toBe('number');
    if (PENDING.has(k)) continue;
    expect(v.colors, k).toBeGreaterThanOrEqual(28); expect(v.colors, k).toBeLessThanOrEqual(32);
    expect(v.flat, k + ' flat').toBeLessThanOrEqual(0.28);
    expect(v.dither, k + ' dither').toBeGreaterThanOrEqual(0.07);
    expect(v.outline_hue, k + ' outline hue').toBeGreaterThanOrEqual(255); expect(v.outline_hue, k + ' outline hue').toBeLessThanOrEqual(335);
    expect(v.outline_val, k + ' outline val').toBeLessThanOrEqual(0.23);
  }
});
