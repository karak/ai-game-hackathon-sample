// デモ（アトラクト）モードの入力記録・再生。1 フレーム = 6 操作の held ビット + pressed ビットのマスクを RLE で保存する
export const DEMO_ACTIONS = ['left', 'right', 'up', 'down', 'shoot', 'jump'];
export const DEMO_MAX_T = 60;      // 1 本の再生上限（秒）
export const DEMO_IDLE_T = 15;     // タイトル放置でデモへ

const HELD_BIT = a => 1 << DEMO_ACTIONS.indexOf(a);
const PRESSED_BIT = a => 1 << (6 + DEMO_ACTIONS.indexOf(a));

// 今フレームの入力をマスクにする
export function maskOf(input) {
  let m = 0;
  for (const a of DEMO_ACTIONS) { if (input.down(a)) m |= HELD_BIT(a); if (input.hit(a)) m |= PRESSED_BIT(a); }
  return m;
}
// RLE: [[mask, count], ...]
export function encodeRLE(masks) {
  const out = [];
  for (const m of masks) { const last = out[out.length - 1]; if (last && last[0] === m) last[1]++; else out.push([m, 1]); }
  return out;
}
export function decodeRLE(rle) { const out = []; for (const [m, n] of rle) for (let i = 0; i < n; i++) out.push(m); return out; }

export class DemoRecorder {
  constructor(stageName, seed) { this.stage = stageName; this.seed = seed; this.masks = []; }
  record(input) { this.masks.push(maskOf(input)); }
  get seconds() { return this.masks.length / 60; }
  toJSON() { return { stage: this.stage, seed: this.seed, frames: this.masks.length, rle: encodeRLE(this.masks) }; }
}

// 記録を再生する Input 互換オブジェクト。next() で 1 フレーム進める
export class DemoInput {
  constructor(demo) { this.masks = decodeRLE(demo.rle ?? []); this.i = 0; this.padConnected = false; }
  get done() { return this.i >= this.masks.length; }
  get mask() { return this.masks[Math.min(this.i, this.masks.length - 1)] ?? 0; }
  down(a) { const b = DEMO_ACTIONS.indexOf(a); return b >= 0 && !!(this.mask & (1 << b)); }
  hit(a) { const b = DEMO_ACTIONS.indexOf(a); return b >= 0 && !!(this.mask & (1 << (6 + b))); }
  next() { this.i++; }
}
