import { FONT, LAYOUT, measure, wrap, inScreen, FONT_PX, rowHeight } from './layout.js';
import { drawWindow } from './window.js';

// テキスト描画。x,y,size は論理座標。フォントは size*FONT_PX px でスクリーン解像度に描く（影 2px）
export function text(g, str, x, y, opts = {}) {
  const size = opts.size ?? LAYOUT.FONT;
  inScreen(g, S => {
    g.font = `${size * FONT_PX}px ${FONT}`; g.textBaseline = 'top'; g.textAlign = opts.align ?? 'left';
    const X = Math.round(x * S), Y = Math.round(y * S);
    if (opts.shadow !== false) { g.fillStyle = opts.shadowColor ?? '#1a0f1e'; g.fillText(str, X + 2, Y + 2); }
    g.fillStyle = opts.color ?? '#fdfbf7';
    g.fillText(str, X, Y);
  });
}


// 内容に合わせてサイズを決めた窓＋テキスト。x 省略時は中央寄せ。戻り値は描いた矩形。
export function textBox(g, content, opts = {}) {
  const size = opts.size ?? LAYOUT.FONT, line = opts.line ?? LAYOUT.LINE, pad = opts.pad ?? LAYOUT.PAD;
  const maxW = opts.maxWidth ?? (LAYOUT.W - LAYOUT.MARGIN * 2 - pad * 2);
  const items = (Array.isArray(content) ? content : [content]).flatMap(c => typeof c === 'string' ? wrap(g, c, maxW, size).map(t => ({ t })) : wrap(g, c.t, maxW, c.size ?? size).map(t => ({ ...c, t })));
  const wTxt = Math.max(0, ...items.map(it => measure(g, it.t, it.size ?? size)));
  const w = Math.min(LAYOUT.W - LAYOUT.MARGIN * 2, Math.max(opts.minWidth ?? 0, wTxt + pad * 2));
  const gap = line - rowHeight(size);                      // 行間（論理 px）
  const rows = items.map(it => rowHeight(it.size ?? size));
  const h = rows.reduce((a, r) => a + r, 0) + gap * Math.max(0, items.length - 1) + pad * 2;
  const x = opts.x ?? Math.floor((LAYOUT.W - w) / 2), y = opts.y ?? Math.floor((LAYOUT.H - h) / 2);
  drawWindow(g, x, y, w, h, opts.window);
  let cy = y + pad;
  items.forEach((it, i) => {
    text(g, it.t, x + w / 2, cy, { align: 'center', size: it.size ?? size, color: it.color ?? opts.color });
    cy += rows[i] + gap;
  });
  return { x, y, w, h };
}

