// 鏡像リリカ（MirrorLyrica）: 倒しても消えず、MIRROR_RESPAWN_T 秒の不在の後に同じ軸へ復活する（ユーザー指示 2026-09-13）
import { test, expect } from 'vitest';
import { MirrorLyrica } from '../src/stage/entities/enemies.js';
import { MIRROR_RESPAWN_T } from '../src/stage/balance.js';

const STEP = 1 / 60;
function worldOf() {
  const w = { shots: [], enemyShots: [], safeT: 0, hard: { shotSpeed: 1 }, particles: { emit() {} }, audio: { sfx() {} }, fx: { killFlash() {} }, addScore() {}, onEnemyKilled() {}, level: { map: { pixelHeight: 224, isSolid: () => false, isOneWay: () => false, at: () => '.' } } };
  w.player = { x: 100, y: 148, w: 12, h: 28, centerX: 106, facing: 1, costume: 'dress', frame: () => 'idle' };
  return w;
}

test('killing the mirror clone gives score once, hides it for MIRROR_RESPAWN_T seconds, then it returns at the axis with full hp', () => {
  const w = worldOf(); let score = 0, kills = 0; w.addScore = s => { score += s; }; w.onEnemyKilled = () => { kills++; };
  const m = new MirrorLyrica(w, 200, 148);
  for (let i = 0; i < 70; i++) m.update(STEP);                        // 履歴が貯まる（1 秒 = 60 コマ）
  expect(m.contact).toBe(true); expect(Math.round(m.x + m.w / 2)).toBe(2 * 200 - 106);
  m.hurt(4, null);
  expect(m.dead).toBe(false); expect(m.gone).toBe(MIRROR_RESPAWN_T); expect(score).toBe(500); expect(kills).toBe(1);
  m.hurt(4, null); expect(score).toBe(500);                             // 不在中は撃っても何も起きない
  for (let i = 0; i < 60 * (MIRROR_RESPAWN_T - 1); i++) m.update(STEP);
  expect(m.gone).toBeGreaterThan(0); expect(m.contact).toBe(false);
  for (let i = 0; i < 60 * 1.1; i++) m.update(STEP);
  expect(m.gone).toBe(0); expect(m.hp).toBe(4);
  for (let i = 0; i < 70; i++) m.update(STEP);
  expect(m.contact).toBe(true); expect(Math.round(m.x + m.w / 2)).toBe(2 * 200 - 106); // 同じ軸で再び鏡像になる
  m.hurt(4, null); expect(score).toBe(1000); expect(kills).toBe(2);                     // 二度目も倒せる
});

test('a mirror clone only mirrors the player on its own floor; on other floors it waits at its axis without contact', () => {
  const w = worldOf(); const m = new MirrorLyrica(w, 200, 148);
  w.player.y = 148 - 96; // 別の階（96 px 上）
  for (let i = 0; i < 70; i++) m.update(STEP);
  expect(m.contact).toBe(false); expect(Math.round(m.x + m.w / 2)).toBe(200); expect(m.y).toBe(148);
  w.player.y = 148 + 20; // 同じ階（差 20）
  for (let i = 0; i < 70; i++) m.update(STEP);
  expect(m.contact).toBe(true); expect(Math.round(m.x + m.w / 2)).toBe(2 * 200 - 106); expect(m.y).toBe(168);
});
