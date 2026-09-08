export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// ゲーム進行に影響する乱数はこのシード付き生成器を通す（デモ再生・E2E の決定論性。DEBT-001）。演出（粒子・揺れ）は Math.random のままでよい
let _g = rng(1);
export function seedGame(seed) { _g = rng(seed); }
export const grand = () => _g();
export const hashSeed = str => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rand = (a, b) => a + grand() * (b - a);
export const pick = arr => arr[Math.floor(grand() * arr.length)];
