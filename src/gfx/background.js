import { THEMES } from './tiles.js';
import { rng } from '../shared/util.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ディザ付き縦グラデーション（SNES 風の帯グラデーション）
function ditherGradient(g, w, h, stops, r) {
  const bands = 28;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const y0 = Math.floor(i * h / bands), y1 = Math.floor((i + 1) * h / bands);
    g.fillStyle = mix(stops, t); g.fillRect(0, y0, w, y1 - y0);
    // 境界にディザ
    if (i < bands - 1) {
      g.fillStyle = mix(stops, (i + 1) / (bands - 1));
      for (let x = 0; x < w; x += 2) if (r() < 0.5) g.fillRect(x + (i & 1), y1 - 1, 1, 1);
    }
  }
}
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(stops, t) {
  const n = stops.length - 1; const i = Math.min(n - 1, Math.floor(t * n)); const lt = t * n - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * lt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// 背景レイヤー群を生成。各レイヤー {canvas, speed, y}
export function buildBackground(themeName, W = 256, H = 224) {
  const th = THEMES[themeName];
  const r = rng(themeName.length * 31 + 7);
  const layers = [];

  // 空（固定）
  const sky = canvas(W, H);
  { const g = sky.getContext('2d');
    ditherGradient(g, W, H, [th.skyTop, th.skyMid, th.skyBot, th.horizon], r);
    if (themeName !== 'castle') {
      g.fillStyle = th.star;
      for (let i = 0; i < 60; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H * 0.6); g.globalAlpha = 0.4 + r() * 0.6; g.fillRect(x, y, 1, 1); }
      g.globalAlpha = 1;
    }
    // 月
    const mx = themeName === 'castle' ? 200 : 190, my = themeName === 'castle' ? 70 : 48, mr = themeName === 'castle' ? 22 : 18;
    for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) {
      const d = x * x + y * y;
      if (d <= mr * mr) { g.fillStyle = (d > (mr - 3) * (mr - 3) && (x + y) % 2 === 0) || (x > mr * 0.3 && y > -mr * 0.2 && r() < 0.15) ? th.moonShade : th.moon; g.fillRect(mx + x, my + y, 1, 1); }
    }
    // 月にかかる雲/血
    g.fillStyle = th.skyMid; g.globalAlpha = 0.7;
    g.fillRect(mx - 26, my + 4, 40, 3); g.fillRect(mx - 18, my + 7, 28, 2); g.fillRect(mx - 30, my + 12, 50, 2);
    g.globalAlpha = 1;
  }
  layers.push({ canvas: sky, speed: 0, y: 0, fixed: true });

  const LW = 512;
  if (themeName === 'graveyard') {
    // 遠景: 丘と枯れ木シルエット
    const far = canvas(LW, H); { const g = far.getContext('2d'); g.fillStyle = th.far;
      for (let x = 0; x < LW; x++) { const y = 130 + Math.sin(x / 45) * 10 + Math.sin(x / 17) * 4; g.fillRect(x, Math.floor(y), 1, H); }
      for (let i = 0; i < 9; i++) { const x = Math.floor(r() * LW); const y = 128 + Math.sin(x / 45) * 10; tree(g, x, y, 22 + r() * 14, th.far); } }
    layers.push({ canvas: far, speed: 0.2, y: 0 });
    // 中景: 墓石と柵と霧
    const mid = canvas(LW, H); { const g = mid.getContext('2d'); g.fillStyle = th.mid;
      for (let x = 0; x < LW; x++) { const y = 160 + Math.sin(x / 30 + 2) * 6; g.fillRect(x, Math.floor(y), 1, H); }
      for (let i = 0; i < 14; i++) { const x = Math.floor(r() * LW), h = 8 + Math.floor(r() * 8); g.fillRect(x, 158 - h, 5 + Math.floor(r() * 3), h + 6); if (r() < 0.4) { g.fillRect(x - 2, 158 - h + 3, 9, 2); } }
      for (let x = 0; x < LW; x += 6) g.fillRect(x, 150, 1, 12); g.fillRect(0, 152, LW, 1);
      for (let i = 0; i < 5; i++) { const x = Math.floor(r() * LW); tree(g, x, 160, 30 + r() * 20, th.mid); }
      // 霧
      g.fillStyle = 'rgba(255,200,230,0.10)'; for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * LW), 150 + Math.floor(r() * 30), 40 + Math.floor(r() * 60), 3); }
    layers.push({ canvas: mid, speed: 0.5, y: 0 });
  } else if (themeName === 'candyforest') {
    const far = canvas(LW, H); { const g = far.getContext('2d'); g.fillStyle = th.far;
      for (let x = 0; x < LW; x++) { const y = 120 + Math.sin(x / 60) * 14 + Math.cos(x / 23) * 5; g.fillRect(x, Math.floor(y), 1, H); }
      for (let i = 0; i < 10; i++) lollipop(g, Math.floor(r() * LW), 118, 18 + r() * 16, th.far); }
    layers.push({ canvas: far, speed: 0.2, y: 0 });
    const mid = canvas(LW, H); { const g = mid.getContext('2d'); g.fillStyle = th.mid;
      for (let x = 0; x < LW; x++) { const y = 158 + Math.sin(x / 33) * 5; g.fillRect(x, Math.floor(y), 1, H); }
      for (let i = 0; i < 8; i++) mushroom(g, Math.floor(r() * LW), 160, 20 + r() * 18, th.mid);
      for (let i = 0; i < 6; i++) lollipop(g, Math.floor(r() * LW), 160, 34 + r() * 20, th.mid);
      g.fillStyle = 'rgba(124,255,112,0.10)'; for (let i = 0; i < 12; i++) g.fillRect(Math.floor(r() * LW), 165 + Math.floor(r() * 20), 40 + Math.floor(r() * 60), 3); }
    layers.push({ canvas: mid, speed: 0.5, y: 0 });
  } else {
    // 城内: 奥の壁（煉瓦）、柱、鎖、血
    const far = canvas(LW, H); { const g = far.getContext('2d');
      g.fillStyle = th.far; g.fillRect(0, 0, LW, H);
      g.fillStyle = th.mid;
      for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < LW; x += 16) { g.fillRect(x, y, 15, 7); }
      g.fillStyle = th.near; for (let i = 0; i < 80; i++) g.fillRect(Math.floor(r() * LW / 16) * 16 + ((Math.floor(r() * 2)) ? 0 : 8), Math.floor(r() * H / 8) * 8, 15, 7);
      // 大窓（月光）
      for (let i = 0; i < 3; i++) { const x = 60 + i * 170; g.fillStyle = th.skyMid; g.fillRect(x, 30, 26, 70); g.fillStyle = th.skyBot; g.fillRect(x + 3, 34, 20, 62);
        g.fillStyle = th.near; g.fillRect(x + 12, 30, 2, 70); g.fillRect(x, 60, 26, 2);
        g.fillStyle = '#d9262b'; g.fillRect(x + 6, 40, 1, 30 + Math.floor(r() * 25)); g.fillRect(x + 18, 45, 1, 20 + Math.floor(r() * 30)); }
    }
    layers.push({ canvas: far, speed: 0.25, y: 0 });
    const mid = canvas(LW, H); { const g = mid.getContext('2d');
      for (let i = 0; i < 6; i++) { const x = 40 + i * 85; g.fillStyle = th.near; g.fillRect(x, 20, 14, H); g.fillStyle = th.mid; g.fillRect(x + 2, 20, 3, H); g.fillStyle = th.far; g.fillRect(x - 3, 20, 20, 5); g.fillRect(x - 3, 168, 20, 6);
        g.fillStyle = '#7a0f1f'; g.fillRect(x + 6, 20, 2, 30 + Math.floor(r() * 60)); }
      // 鎖
      for (let i = 0; i < 5; i++) { const x = Math.floor(r() * LW); g.fillStyle = '#5d5d70'; for (let y = 20; y < 80 + r() * 60; y += 4) g.fillRect(x + (y / 4 % 2), y, 1, 3); }
    }
    layers.push({ canvas: mid, speed: 0.55, y: 0 });
  }
  return layers;
}

function tree(g, x, baseY, h, color) {
  g.fillStyle = color;
  g.fillRect(x, baseY - h, 3, h);
  for (let i = 0; i < 4; i++) { const by = baseY - h + 4 + i * (h / 5); const len = 6 + i * 2; const dir = i % 2 ? 1 : -1;
    for (let k = 0; k < len; k++) g.fillRect(x + 1 + dir * k, Math.floor(by - k * 0.6), 1, 2); }
}
function lollipop(g, x, baseY, h, color) {
  g.fillStyle = color; g.fillRect(x, baseY - h, 2, h);
  const rr = Math.floor(h / 3);
  for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy <= rr * rr) g.fillRect(x + 1 + xx, baseY - h + yy, 1, 1);
}
function mushroom(g, x, baseY, h, color) {
  g.fillStyle = color; g.fillRect(x - 2, baseY - h * 0.6, 5, h * 0.6);
  const rr = Math.floor(h / 2);
  for (let yy = -rr; yy <= 0; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy * 2 <= rr * rr) g.fillRect(x + xx, baseY - h * 0.6 + yy, 1, 1);
}

export function drawBackground(g, layers, camX, W, H) {
  for (const L of layers) {
    if (L.fixed) { g.drawImage(L.canvas, 0, 0); continue; }
    const lw = L.canvas.width;
    let ox = -((camX * L.speed) % lw);
    if (ox > 0) ox -= lw;
    for (let x = ox; x < W; x += lw) g.drawImage(L.canvas, Math.floor(x), L.y);
  }
}
