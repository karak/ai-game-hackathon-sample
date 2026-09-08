// 3x5 ミニビットマップフォント（HUD 用）
const MINI = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', 'x': '000101010101000', ' ': '000000000000000',
  'S': '111100111001111', 'C': '111100100100111', 'O': '111101101101111', 'R': '110101110101101', 'E': '111100110100111',
  'T': '111010010010010', 'I': '111010010010111', 'M': '101111111101101', 'L': '100100100100111', 'V': '101101101101010',
  'A': '010101111101101', 'P': '111101111100100', 'U': '101101101101111', 'H': '101101111101101', 'B': '110101110101110',
  'N': '110101101101101', 'G': '111100101101111', 'D': '110101101101110', 'Y': '101101010010010', 'W': '101101101111101',
  'F': '111100110100100', 'K': '101101110101101', 'Z': '111001010100111', 'J': '001001001101010', 'X': '101101010101101', 'Q': '111101101111001',
};
import { inScreen, FONT } from './layout.js';

// ミニフォント描画。x,y は論理座標、1 ドット = DOT スクリーン px（2）。1 文字の送りは論理 4px 相当を保つ
const DOT = 2;
// 2026-09-08: HUD の視認性のため、既定の mini() は DotGothic16 の 16px（半角 8px 送り = 論理 8/3、旧ビットマップと同じ送り）で描く。
// 旧 3x5 ビットマップは miniBitmap() として残す（フォント未読込時のフォールバック）
const MINI_PX = 16;
export function mini(g, str, x, y, color = '#fdfbf7', shadow = true) {
  if (typeof document !== 'undefined' && document.fonts && !document.fonts.check(`${MINI_PX}px DotGothic16`)) return miniBitmap(g, str, x, y, color, shadow);
  inScreen(g, S => {
    const X = Math.round(x * S), Y = Math.round(y * S);
    g.font = `${MINI_PX}px ${FONT}`; g.textBaseline = 'top'; g.textAlign = 'left';
    if (shadow) { g.fillStyle = '#1a0f1e'; g.fillText(str, X + 1, Y + 1); }
    g.fillStyle = color; g.fillText(str, X, Y);
  });
}
export function miniBitmap(g, str, x, y, color = '#fdfbf7', shadow = true) {
  inScreen(g, S => {
    const X = Math.round(x * S), Y = Math.round(y * S);
    for (let i = 0; i < str.length; i++) {
      const glyph = MINI[str[i]] ?? MINI[str[i].toUpperCase()] ?? MINI[' '];
      for (let k = 0; k < 15; k++) if (glyph[k] === '1') {
        const px = X + i * 4 * DOT + (k % 3) * DOT, py = Y + Math.floor(k / 3) * DOT;
        if (shadow) { g.fillStyle = '#1a0f1e'; g.fillRect(px + DOT, py + DOT, DOT, DOT); }
        g.fillStyle = color; g.fillRect(px, py, DOT, DOT);
      }
    }
  });
}
// ミニフォント 1 文字の幅（論理 px）
export const MINI_W = 4 * DOT / 3;

