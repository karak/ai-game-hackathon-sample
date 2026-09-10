// カメラ（2 軸）。横は主人公の向きに 16 先読み、縦は主人公を画面 55% の高さに置く。範囲は部屋（arena）かマップ
import { W, H } from './world.js';

export const CAM_LERP_X = 6, CAM_LERP_Y = 5, LOOK_AHEAD = 16, V_ANCHOR = 0.55;

// 目標位置（クランプ前）
export function cameraTarget(player) {
  return { x: player.centerX - W / 2 + player.facing * LOOK_AHEAD, y: player.y + player.h / 2 - H * V_ANCHOR };
}
// マップと部屋から可動範囲を求める。縦スクロールしないマップ（高さ ≤ H）は y = 0 固定
export function cameraBounds(map, arena) {
  const b = { minX: 0, maxX: Math.max(0, map.pixelWidth - W), minY: 0, maxY: Math.max(0, map.pixelHeight - H) };
  if (arena) { b.minX = arena.x0; b.maxX = Math.max(arena.x0, arena.x1 - W); if (arena.y0 !== undefined) { b.minY = arena.y0; b.maxY = Math.max(arena.y0, (arena.y1 ?? arena.y0 + H) - H); } }
  return b;
}
export const clampCam = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// 1 tick 進める（dt 秒）。cam を書き換えて返す
export function updateCamera(cam, player, map, arena, dt) {
  const t = cameraTarget(player), b = cameraBounds(map, arena);
  cam.x = clampCam(cam.x + (t.x - cam.x) * Math.min(1, dt * CAM_LERP_X), b.minX, b.maxX);
  cam.y = clampCam(cam.y + (t.y - cam.y) * Math.min(1, dt * CAM_LERP_Y), b.minY, b.maxY);
  return cam;
}
// 即時に主人公へ寄せる（開始・復活時）
export function snapCamera(cam, player, map, arena) {
  const t = cameraTarget(player), b = cameraBounds(map, arena);
  cam.x = clampCam(t.x, b.minX, b.maxX); cam.y = clampCam(t.y, b.minY, b.maxY); return cam;
}
