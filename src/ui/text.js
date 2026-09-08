import { FONT, LAYOUT, measure, wrap } from './layout.js';
import { drawWindow } from './window.js';

export function text(g, str, x, y, opts = {}) {
  const size = opts.size ?? 16;
  g.font = `${size}px ${FONT}`; g.textBaseline = 'top'; g.textAlign = opts.align ?? 'left';
  if (opts.shadow !== false) { g.fillStyle = opts.shadowColor ?? '#1a0f1e'; g.fillText(str, x + 1, y + 1); }
  g.fillStyle = opts.color ?? '#fdfbf7';
  g.fillText(str, x, y);
}


// 内容に合わせてサイズを決めた窓＋テキスト。x 省略時は中央寄せ。戻り値は描いた矩形。
export function textBox(g, content, opts = {}) {
  const size = opts.size ?? LAYOUT.FONT, line = opts.line ?? LAYOUT.LINE, pad = opts.pad ?? LAYOUT.PAD;
  const maxW = opts.maxWidth ?? (LAYOUT.W - LAYOUT.MARGIN * 2 - pad * 2);
  const items = (Array.isArray(content) ? content : [content]).flatMap(c => typeof c === 'string' ? wrap(g, c, maxW, size).map(t => ({ t })) : wrap(g, c.t, maxW, c.size ?? size).map(t => ({ ...c, t })));
  const wTxt = Math.max(0, ...items.map(it => measure(g, it.t, it.size ?? size)));
  const w = Math.min(LAYOUT.W - LAYOUT.MARGIN * 2, Math.max(opts.minWidth ?? 0, wTxt + pad * 2));
  const h = items.reduce((a, it) => a + (it.size ?? size) + (line - size), 0) + pad * 2 - (line - size);
  const x = opts.x ?? Math.floor((LAYOUT.W - w) / 2), y = opts.y ?? Math.floor((LAYOUT.H - h) / 2);
  drawWindow(g, x, y, w, h, opts.window);
  let cy = y + pad;
  for (const it of items) {
    const sz = it.size ?? size;
    text(g, it.t, x + w / 2, cy, { align: 'center', size: sz, color: it.color ?? opts.color });
    cy += sz + (line - size);
  }
  return { x, y, w, h };
}

