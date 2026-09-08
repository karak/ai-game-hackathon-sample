// カタログ描画ヘルパー: セクション/キャンバス生成、基準線付きフレーム列、当たり判定・アンカーの重ね表示、パレット抽出
import { HD_SCALE } from '../gfx/sprite.js';

export const state = { scale: 2, hit: true, anchor: true, grid: false };

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
  for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
export const h1 = t => el('h1', { text: t }); export const h2 = t => el('h2', { text: t }); export const h3 = t => el('h3', { text: t });
export const note = t => el('p', { class: 'note', text: t });

// 表: rows = [[...], ...]、head = [...]
export function table(head, rows) {
  const t = el('table');
  t.appendChild(el('thead', {}, [el('tr', {}, head.map(h => el('th', { text: String(h) })))]));
  t.appendChild(el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => {
    if (c && c.nodeType) return el('td', {}, [c]);
    const num = typeof c === 'number' || /^-?[\d.]+(x[\d.]+)?(px|%|s|tick)?$/.test(String(c));
    return el('td', { class: num ? 'num' : '', text: String(c) });
  })))));
  return t;
}

// キャンバス（生ピクセル幅 w, 高さ h、表示は state.scale 倍）
export function canvas(w, h) {
  const c = el('canvas'); c.width = w; c.height = h; c.style.width = `${w * state.scale}px`; c.style.height = `${h * state.scale}px`;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#2a2a3e'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#33334a'; for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) g.fillRect(x, y, 16, 16);
  return c;
}

// 生成スプライトの生画像（hd は画素 1:1、旧文字列スプライトは HD_SCALE 倍で揃える）
export function raw(spr, left = false) { return left ? spr.l : spr.r; }
export function rawSize(spr) { return spr.hd ? [spr.r.width, spr.r.height] : [spr.r.width * HD_SCALE, spr.r.height * HD_SCALE]; }
export function drawRaw(g, spr, x, y, left = false) {
  const img = raw(spr, left); const [w, h] = rawSize(spr);
  g.drawImage(img, x, y, w, h);
}

// フレーム列: frames = [{name, spr, ticks, hit:{w,h}(世界単位), anchor:{x,y}(px, 基準線からの相対)}]
// 基準線（足元）を揃えて並べ、名前・時間・当たり判定を重ねる。戻り値: canvas
export function frameStrip(frames, opts = {}) {
  const gap = opts.gap ?? 16, top = 24, bottom = 26;
  const sizes = frames.map(f => f.spr ? rawSize(f.spr) : [32, 32]);
  const H = Math.max(...sizes.map(s => s[1])) + top + bottom;
  const W = sizes.reduce((a, s) => a + Math.max(s[0], 56) + gap, gap);
  const c = canvas(W, H); const g = c.getContext('2d');
  const base = H - bottom;
  g.strokeStyle = '#8f8fb0'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(0, base + 0.5); g.lineTo(W, base + 0.5); g.stroke(); g.setLineDash([]);
  let x = gap;
  frames.forEach((f, i) => {
    const [w, h] = sizes[i]; const cell = Math.max(w, 56); const sx = x + Math.floor((cell - w) / 2), sy = base - h;
    if (state.grid) { g.strokeStyle = 'rgba(255,255,255,0.08)'; for (let gx = sx; gx <= sx + w; gx += 8) { g.beginPath(); g.moveTo(gx + 0.5, sy); g.lineTo(gx + 0.5, base); g.stroke(); } }
    if (f.spr) drawRaw(g, f.spr, sx, sy, f.left);
    if (state.hit && f.hit) { // 当たり判定: 世界単位 → px、足元中央基準
      const hw = f.hit.w * HD_SCALE, hh = f.hit.h * HD_SCALE; const hx = x + Math.floor(cell / 2 - hw / 2), hy = base - hh;
      g.strokeStyle = '#7cff70'; g.lineWidth = 1; g.strokeRect(hx + 0.5, hy + 0.5, hw - 1, hh - 1);
      if (f.attack) { const a = f.attack; g.strokeStyle = '#ff6a6a'; g.strokeRect(x + cell / 2 + a.x * HD_SCALE + 0.5, base - a.y * HD_SCALE + 0.5, a.w * HD_SCALE, a.h * HD_SCALE); }
    }
    if (state.anchor) { const ax = x + Math.floor(cell / 2); g.fillStyle = '#ffe860'; g.fillRect(ax - 3, base - 1, 7, 3); g.fillRect(ax, base - 4, 1, 9); }
    g.font = '10px DotGothic16, sans-serif'; g.fillStyle = '#ffe860'; g.textAlign = 'center';
    g.fillText(f.name ?? '', x + cell / 2, 10);
    if (f.ticks !== undefined) { g.fillStyle = '#a5a5b8'; g.fillText(f.ticks === 0 ? '—' : `${f.ticks}t`, x + cell / 2, 20); }
    if (f.size !== false) { g.fillStyle = '#8f8fb0'; g.fillText(`${w}x${h}`, x + cell / 2, base + 12); }
    if (f.sub) { g.fillStyle = '#cbaaf5'; g.fillText(f.sub, x + cell / 2, base + 22); }
    x += cell + gap;
  });
  return c;
}

// 使用色を抽出（不透明画素、出現数順）
export function palette(spr) {
  const img = spr.r; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const cnt = new Map();
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const k = `#${[d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')}`; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]);
}
export function paletteStrip(spr) {
  const pal = palette(spr); const wrap = el('div', { class: 'legend' });
  for (const [hex, n] of pal) wrap.appendChild(el('span', { html: `<i class="swatch" style="background:${hex}"></i>${hex} <small>${n}</small>` }));
  wrap.appendChild(el('span', { text: `計 ${pal.length} 色` }));
  return wrap;
}
