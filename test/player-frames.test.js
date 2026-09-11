// 主人公のコマ選択（frame()）: 走り撃ち専用コマ run*s は素材がある衣装だけで使い、無ければ走りコマに戻る（IMP-016）
import { test, expect } from 'vitest';
import { parseLevel } from '../src/stage/level.js';
import { Player } from '../src/stage/entities/player.js';

function playerWith(assets) {
  const rows = ['.'.repeat(32), '.'.repeat(32), '..P.............................', '#'.repeat(32)];
  const level = parseLevel({ name: 't', rows });
  const w = { level, cutscene: false, shots: [], fires: [], effects: [], enemies: [], boxes: [], enemyShots: [], cam: { x: 0, y: 0 }, particles: { emit() {} }, audio: { sfx() {} }, fx: { hitStop() {} }, toast() {}, shake() {}, crumbles: [], platforms: [], presses: [], assets, decals: { splat() {} }, addScore() {} };
  const p = new Player(w, level.playerStart.x, level.playerStart.y); p.onGround = true; return p;
}

test('running + shooting uses run1s when the costume sheet has it', () => {
  const p = playerWith({ player: { dress: { run1s: {} } } });
  p.vx = 60; p.runT = 0; p.attackT = 0.1;
  expect(p.frame()).toBe('run1s');
});

test('running + shooting falls back to run1 when the sheet lacks run1s (e.g. plain costume without assets)', () => {
  const p = playerWith({ player: { dress: {} } });
  p.vx = 60; p.runT = 0; p.attackT = 0.1;
  expect(p.frame()).toBe('run1');
  p.attackT = 0; expect(p.frame()).toBe('run1');
});

test('run-shoot alternates the two contact frames with the run phase (runT) so the legs keep cycling', () => {
  const p = playerWith({ player: { dress: { run1s: {}, run3s: {} } } });
  p.vx = 60; p.attackT = 0.1;
  const seen = [0, 0.1, 0.2, 0.3].map(t => { p.runT = t; return p.frame(); });
  expect(seen).toEqual(['run1s', 'run1s', 'run3s', 'run3s']);
});

test('hurt shows the white-flash frame hurt2 for the first 0.1 s, then the hurt pose; sheets without hurt2 stay on hurt (BUG-007)', () => {
  const p = playerWith({ player: { dress: { hurt2: {} } } });
  p.hit({ x: p.x + 20, w: 4 });
  expect(p.costume).toBe('plain'); // 変身解除で私服へ。素材は dress にしか無い設定なので hurt へ落ちる
  expect(p.frame()).toBe('hurt');
  p.costume = 'dress'; p.hurtT = 0.35; expect(p.frame()).toBe('hurt2');
  p.hurtT = 0.26; expect(p.frame()).toBe('hurt2');
  p.hurtT = 0.24; expect(p.frame()).toBe('hurt');
  p.hurtT = 0.1; expect(p.frame()).toBe('hurt');
});
