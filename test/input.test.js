import { test, expect } from 'vitest';
import { MAP, Input } from '../src/input.js';
import { DEFAULT_PAD, bind } from '../src/settings.js';

// 最小のイベントターゲット（keydown/keyup を手で発火）
const fakeTarget = () => { const ls = {}; return { addEventListener: (t, f) => (ls[t] = f), fire: (t, e) => ls[t]?.({ preventDefault() {}, ...e }) }; };
const pad = (buttons = [], axes = [0, 0]) => { const b = Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })); return { connected: true, buttons: b, axes, mapping: 'standard' }; };

test('every gameplay action has at least one key and arrows/WASD both work', () => {
  const actions = new Set(Object.values(MAP));
  for (const a of ['left', 'right', 'up', 'down', 'shoot', 'jump', 'start', 'pause', 'mute']) expect(actions.has(a), a).toBe(true);
  expect(MAP.ArrowLeft).toBe(MAP.KeyA); expect(MAP.ArrowRight).toBe(MAP.KeyD);
  expect(MAP.Space).toBe('jump');
});

test('default gamepad map covers move/shoot/jump/start via standard-mapping buttons', () => {
  const acts = new Set(Object.values(DEFAULT_PAD));
  for (const a of ['left', 'right', 'up', 'down', 'shoot', 'jump', 'start']) expect(acts.has(a), a).toBe(true);
  expect(DEFAULT_PAD.b12).toBe('up'); expect(DEFAULT_PAD.b13).toBe('down'); expect(DEFAULT_PAD.b14).toBe('left'); expect(DEFAULT_PAD.b15).toBe('right');
  expect(DEFAULT_PAD.b9).toBe('start');
});

test('keyboard: pressed fires once per keydown, held until keyup, repeat ignored', () => {
  const t = fakeTarget(); const inp = new Input(t);
  t.fire('keydown', { code: 'KeyZ' });
  expect(inp.hit('shoot')).toBe(true); expect(inp.down('shoot')).toBe(true);
  inp.endFrame();
  t.fire('keydown', { code: 'KeyZ', repeat: true });
  expect(inp.hit('shoot')).toBe(false); expect(inp.down('shoot')).toBe(true);
  t.fire('keyup', { code: 'KeyZ' });
  expect(inp.down('shoot')).toBe(false);
});

test('gamepad poll: button edge → pressed once, held while down, released on next poll; axes map to directions', () => {
  let cur = pad([0]);
  const inp = new Input(fakeTarget(), null, { getPads: () => [cur] });
  inp.poll();
  expect(inp.padConnected).toBe(true); expect(inp.hit('jump')).toBe(true); expect(inp.down('jump')).toBe(true);
  inp.endFrame(); inp.poll();
  expect(inp.hit('jump')).toBe(false); expect(inp.down('jump')).toBe(true);
  cur = pad([], [-0.9, 0.8]); inp.endFrame(); inp.poll();
  expect(inp.down('jump')).toBe(false); expect(inp.down('left')).toBe(true); expect(inp.down('down')).toBe(true); expect(inp.hit('left')).toBe(true);
  cur = pad([], [0.2, 0.2]); inp.endFrame(); inp.poll();
  expect(inp.down('left')).toBe(false); expect(inp.down('down')).toBe(false);
  cur = null; inp.poll(); expect(inp.padConnected).toBe(false);
});

test('rebinding: setKeys/setPad take effect; captureNext receives the next key or pad button without triggering the action', () => {
  const t = fakeTarget(); let cur = pad([]);
  const inp = new Input(t, null, { getPads: () => [cur] });
  let got = null; inp.captureNext(r => (got = r));
  t.fire('keydown', { code: 'KeyL' });
  expect(got).toEqual({ type: 'key', code: 'KeyL' }); expect(inp.hit('jump')).toBe(false); expect(inp.pressed.size).toBe(0);
  inp.setKeys(bind(inp.keys, 'jump', 'KeyL'));
  t.fire('keydown', { code: 'KeyL' }); expect(inp.hit('jump')).toBe(true); inp.endFrame();
  t.fire('keydown', { code: 'KeyX' }); expect(inp.hit('jump')).toBe(false); // X は外れた
  got = null; inp.captureNext(r => (got = r)); cur = pad([5]); inp.poll();
  expect(got).toEqual({ type: 'pad', code: 'b5' }); expect(inp.pressed.size).toBe(0);
  inp.setPad(bind(inp.padMap, 'shoot', 'b5')); cur = pad([]); inp.poll(); cur = pad([5]); inp.poll();
  expect(inp.hit('shoot')).toBe(true);
});
