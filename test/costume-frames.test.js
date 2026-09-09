import { test, expect } from 'vitest';
import { assignPlayerFrames } from '../src/gfx/assets.js';
import manifest from '../src/gfx/manifest.json';

// BUG-016（デプロイ版でユーザーが発見）: 素材の読み込み完了順で共通コマが衣装別コマを上書きし、
// 私服・金衣装の一部のコマにドレスの絵が出ていた。割り当ては順序に依存しないこと。
const sheets = () => ({ dress: {}, plain: {}, gold: {} });
const spr = name => ({ name });
const genOf = frames => Object.fromEntries(frames.map(f => [f, spr(f)]));

test('costume-specific frames win over the common frame whatever order the manifest arrives in', () => {
  const frames = ['idle', 'idle_plain', 'idle_gold', 'idle_nohat', 'run2', 'run2_gold', 'run2_plain', 'hat', 'base'];
  for (const order of [frames, [...frames].reverse(), ['run2_gold', 'run2', 'run2_plain', 'idle_gold', 'idle', 'idle_plain', 'idle_nohat']]) {
    const p = sheets();
    assignPlayerFrames(p, genOf(order));
    expect(p.gold.idle.name, order.join(',')).toBe('idle_gold');
    expect(p.plain.idle.name).toBe('idle_plain');
    expect(p.dress.idle.name).toBe('idle');
    expect(p.gold.run2.name).toBe('run2_gold');
    expect(p.plain.run2.name).toBe('run2_plain');
    expect(p.nohat.idle.name).toBe('idle_nohat'); // 帽子なし原画は別枠
    expect(p.dress.hat).toBeUndefined();          // 帽子・素体はコマではない
  }
});

test('the real manifest has a plain and a gold sprite for every animation frame the player can show', () => {
  const player = Object.keys(manifest).filter(k => k.startsWith('player/')).map(k => k.split('/')[1]);
  const base = player.filter(n => !/_(plain|gold|nohat)$/.test(n) && n !== 'hat' && n !== 'base' && n !== 'base_hat');
  const missing = [];
  for (const n of base) { for (const c of ['plain', 'gold']) if (!player.includes(`${n}_${c}`)) missing.push(`${n}_${c}`); }
  expect(missing, '衣装別コマの取りこぼし（derive_variants.py を実行する）').toEqual([]);
  expect(base).toContain('cast1'); expect(base).toContain('cast2');
});

test('assignPlayerFrames leaves a costume sheet complete: every common frame is present in all three costumes', () => {
  const p = sheets();
  const gen = genOf(['idle', 'idle_plain', 'run1', 'attack', 'attack_gold', 'dead', 'dead_plain', 'dead_gold']);
  assignPlayerFrames(p, gen);
  for (const c of ['dress', 'plain', 'gold']) for (const f of ['idle', 'run1', 'attack', 'dead']) expect(p[c][f], `${c}.${f}`).toBeTruthy();
  expect(p.plain.run1.name).toBe('run1');   // 衣装別が無いコマは共通コマのまま（絵が消えるより望ましい）
  expect(p.gold.attack.name).toBe('attack_gold');
});
