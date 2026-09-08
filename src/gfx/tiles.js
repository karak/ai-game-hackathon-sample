import { PAL } from './palette.js';
import { makeSprite } from './sprite.js';
import { DECO } from './sprites/index.js';
import { rng } from '../util.js';
import { TILE } from '../physics.js';

// テーマごとの配色
export const THEMES = {
  graveyard: {
    grass: ['#3d7a45', '#2f5f38', '#4f9a52'], grassFlower: ['#ff8fc8', '#fdfbf7', '#f8e46e'],
    dirt: ['#5a3a24', '#6a4630', '#4a2e1c'], pebble: '#7d6248',
    plat: ['#8a8aa0', '#a5a5b8', '#6c6c80'], platMoss: '#3f8f3f',
    bog: ['#3a1650', '#4b2470', '#6a35a0'], bogGlow: '#b45cf5', bogBubble: '#cbaaf5',
    skyTop: '#1a0f2e', skyMid: '#3d1f5c', skyBot: '#8b3f7a', horizon: '#c4588f',
    moon: '#ffc0dc', moonShade: '#e896c0', star: '#fdfbf7',
    far: '#2a1540', mid: '#1f1030', near: '#150a22',
  },
  candyforest: {
    grass: ['#ff8fc8', '#ff6fb8', '#ffb0dc'], grassFlower: ['#fdfbf7', '#f8e46e', '#7cff70'],
    dirt: ['#d8a878', '#c89060', '#b87848'], pebble: '#7a3a3a',
    plat: ['#6a3f1c', '#8a5a2c', '#4a2a10'], platMoss: '#ffd3e6',
    bog: ['#2f6a20', '#3f8a28', '#5cb040'], bogGlow: '#7cff70', bogBubble: '#d0ff90',
    skyTop: '#25305c', skyMid: '#4a5a9a', skyBot: '#9a8ac8', horizon: '#e0a8d8',
    moon: '#fff0a0', moonShade: '#f0c860', star: '#fdfbf7',
    far: '#3a3a72', mid: '#2c2c5c', near: '#1e1e44',
  },
  river: { // 第三章 涙の川: 雨・青緑〜灰。'~' は涙の川（薄く血が混じる）
    grass: ['#3f7a6a', '#2f5f52', '#58a08a'], grassFlower: ['#ff8fc8', '#cbe8f0', '#f8e46e'],
    dirt: ['#3a3a48', '#4a4a5c', '#2c2c38'], pebble: '#7d8ea0',
    plat: ['#4a5a6a', '#6a7c8c', '#34404c'], platMoss: '#58a08a',
    bog: ['#2c4c6a', '#3a6a8a', '#5a94b4'], bogGlow: '#9ad8f0', bogBubble: '#ffb0c8',
    skyTop: '#1c2438', skyMid: '#2c4058', skyBot: '#587890', horizon: '#9ab8a0',
    moon: '#e8f0f4', moonShade: '#b8c8d0', star: '#cbe8f0',
    far: '#243448', mid: '#1c2838', near: '#141c28',
  },
  workshop: { // 第四章 綿雪の人形工房: 屋内・灰〜暖色。'~' は血の染みた綿の山（沈む）
    grass: ['#c8c0c8', '#e0dce0', '#a8a0a8'], grassFlower: ['#d9262b', '#ff8fc8', '#f8e46e'],
    dirt: ['#5a4a3a', '#6a5a48', '#4a3c2e'], pebble: '#b08040',
    plat: ['#6a4a2c', '#8a6a3c', '#4a3020'], platMoss: '#e0dce0',
    bog: ['#7a2030', '#9a3040', '#c04858'], bogGlow: '#ff6a6a', bogBubble: '#fdfbf7',
    skyTop: '#1c1824', skyMid: '#3a3040', skyBot: '#6a5060', horizon: '#c89058',
    moon: '#ffd890', moonShade: '#e0a850', star: '#fdfbf7',
    far: '#2c2434', mid: '#221c2a', near: '#181420',
  },
  park: { // 第五章 骨の遊園地: 夜・原色ネオン。'~' は血のプール
    grass: ['#e8e0d0', '#f4eee0', '#c8c0b0'], grassFlower: ['#ff2a6a', '#3af0ff', '#ffe860'],
    dirt: ['#3a3040', '#4a3c50', '#2c2434'], pebble: '#e8e0d0',
    plat: ['#c0b8a8', '#e0d8c8', '#908878'], platMoss: '#3af0ff',
    bog: ['#7a0f1f', '#a01a2c', '#d9262b'], bogGlow: '#ff6a6a', bogBubble: '#ffe860',
    skyTop: '#0a0614', skyMid: '#2a1050', skyBot: '#7a2090', horizon: '#ff2a6a',
    moon: '#3af0ff', moonShade: '#2ab0c0', star: '#fdfbf7',
    far: '#241838', mid: '#1a1028', near: '#100a1c',
  },
  castle: {
    grass: ['#6c6c80', '#7c7c90', '#5d5d70'], grassFlower: ['#d9262b', '#7a0f1f', '#a5a5b8'],
    dirt: ['#5d5d70', '#4e4e60', '#6c6c80'], pebble: '#2d1f4c',
    plat: ['#7a0f1f', '#a01a2c', '#5a0a15'], platMoss: '#f0a838',
    bog: ['#4a1015', '#7a0f1f', '#a01a2c'], bogGlow: '#d9262b', bogBubble: '#ff6a6a',
    skyTop: '#0e0a18', skyMid: '#1c1430', skyBot: '#2d1f4c', horizon: '#4b2470',
    moon: '#ff6a6a', moonShade: '#d9262b', star: '#a5a5b8',
    far: '#241a3c', mid: '#1a1230', near: '#120c22',
  },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function noiseFill(g, w, h, colors, r) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = r();
    g.fillStyle = colors[v < 0.65 ? 0 : v < 0.9 ? 1 : 2];
    g.fillRect(x, y, 1, 1);
  }
}

export function buildTileset(themeName) {
  const th = THEMES[themeName];
  const T = TILE;
  const tiles = {};
  const r = rng(themeName.length * 7919 + 13);

  // 地面(内部)
  const ground = canvas(T, T);
  { const g = ground.getContext('2d'); noiseFill(g, T, T, th.dirt, r);
    for (let i = 0; i < 4; i++) { g.fillStyle = th.pebble; g.fillRect(Math.floor(r() * 14), Math.floor(r() * 14), 2, 1); } }
  tiles.ground = ground;

  // 地面(上端: 草/フロスティング/石床)
  const top = canvas(T, T);
  { const g = top.getContext('2d'); noiseFill(g, T, T, th.dirt, r);
    for (let x = 0; x < T; x++) {
      const hgt = 3 + Math.floor(r() * 3);
      for (let y = 0; y < hgt; y++) { g.fillStyle = th.grass[y === 0 ? 2 : r() < 0.7 ? 0 : 1]; g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = PAL['0']; g.globalAlpha = 0.35; g.fillRect(0, 5, T, 1); g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { g.fillStyle = th.grassFlower[i % 3]; g.fillRect(Math.floor(r() * 15), Math.floor(r() * 2), 1, 1); }
  }
  tiles.top = top;

  // 壁の左右端用(暗いエッジ)
  const edgeL = canvas(T, T), edgeR = canvas(T, T);
  { const gl = edgeL.getContext('2d'); gl.drawImage(ground, 0, 0); gl.fillStyle = 'rgba(26,15,30,0.5)'; gl.fillRect(0, 0, 2, T);
    const gr = edgeR.getContext('2d'); gr.drawImage(ground, 0, 0); gr.fillStyle = 'rgba(26,15,30,0.5)'; gr.fillRect(T - 2, 0, 2, T); }
  tiles.edgeL = edgeL; tiles.edgeR = edgeR;

  // 天井(下端が暗い)
  const ceil = canvas(T, T);
  { const g = ceil.getContext('2d'); g.drawImage(ground, 0, 0); g.fillStyle = 'rgba(26,15,30,0.6)'; g.fillRect(0, T - 2, T, 2); }
  tiles.ceil = ceil;

  // すり抜け足場
  const plat = canvas(T, T);
  { const g = plat.getContext('2d');
    g.fillStyle = th.plat[0]; g.fillRect(0, 1, T, 5);
    g.fillStyle = th.plat[1]; g.fillRect(0, 1, T, 1); g.fillRect(1, 2, 3, 1); g.fillRect(9, 2, 4, 1);
    g.fillStyle = th.plat[2]; g.fillRect(0, 5, T, 1); g.fillRect(6, 3, 1, 2); g.fillRect(12, 3, 1, 2);
    g.fillStyle = PAL['0']; g.fillRect(0, 6, T, 1); g.fillRect(0, 0, T, 1);
    g.fillStyle = th.platMoss; g.fillRect(2, 0, 2, 1); g.fillRect(10, 0, 3, 1); g.fillRect(4, 6, 1, 2); g.fillRect(13, 6, 1, 1);
  }
  tiles.plat = plat;

  // 毒沼(2フレーム)
  for (let f = 0; f < 2; f++) {
    const bog = canvas(T, T);
    const g = bog.getContext('2d');
    noiseFill(g, T, T, th.bog, r);
    g.fillStyle = th.bogGlow; g.fillRect(0, 0, T, 1);
    g.fillStyle = th.bogBubble;
    g.fillRect(3 + f * 5, 3 + f * 4, 2, 2); g.fillRect(11 - f * 3, 8 - f * 2, 1, 1);
    tiles['bog' + f] = bog;
  }
  // 毒沼の表面(上に空気がある場合)
  for (let f = 0; f < 2; f++) {
    const s = canvas(T, T); const g = s.getContext('2d');
    g.fillStyle = th.bog[0]; g.fillRect(0, 8, T, 8);
    g.fillStyle = th.bog[2]; g.fillRect(0, 8 + f, T, 1);
    g.fillStyle = th.bogGlow; g.fillRect(0, 7 + f, T, 1);
    g.fillStyle = th.bogBubble; g.fillRect(4 + f * 6, 10, 2, 1);
    tiles['bogtop' + f] = s;
  }

  // 棘
  const spike = canvas(T, T);
  { const g = spike.getContext('2d');
    for (let i = 0; i < 4; i++) {
      const bx = i * 4;
      g.fillStyle = PAL['S']; g.fillRect(bx + 1, 8, 2, 8); g.fillRect(bx + 1, 6, 1, 2);
      g.fillStyle = PAL['Q']; g.fillRect(bx + 2, 8, 1, 8);
      g.fillStyle = PAL['K']; g.fillRect(bx + 1, 4, 1, 3); g.fillRect(bx + 1, 3, 1, 1);
    }
    g.fillStyle = th.dirt[2]; g.fillRect(0, 14, T, 2);
  }
  tiles.spike = spike;

  // 装飾
  for (const [k, rows] of Object.entries(DECO)) tiles['deco_' + k] = makeSprite(rows);
  return tiles;
}

// マップ全体を静的レイヤーとして事前描画（チャンク単位）
export function renderMapLayer(map, tiles, chunkPx = 512) {
  const chunks = [];
  const w = map.pixelWidth, h = map.pixelHeight;
  for (let cx = 0; cx < w; cx += chunkPx) {
    const cw = Math.min(chunkPx, w - cx);
    const c = canvas(cw, h);
    const g = c.getContext('2d');
    const tx0 = cx / TILE, tx1 = (cx + cw) / TILE;
    for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx < tx1; tx++) {
      const ch = map.at(tx, ty);
      if (ch === '!') continue; // 崩れる足場は World が動的に描く
      const px = (tx - tx0) * TILE, py = ty * TILE;
      if (map.isSolid(tx, ty)) {
        const up = map.isSolid(tx, ty - 1) || ty === 0, down = map.isSolid(tx, ty + 1) || ty === map.height - 1;
        let img = tiles.ground;
        if (!up) img = tiles.top;
        else if (!down) img = tiles.ceil;
        else if (!map.isSolid(tx - 1, ty)) img = tiles.edgeL;
        else if (!map.isSolid(tx + 1, ty)) img = tiles.edgeR;
        g.drawImage(img, px, py);
      } else if (map.isOneWay(tx, ty)) {
        g.drawImage(tiles.plat, px, py);
      } else if (ch === '^') {
        g.drawImage(tiles.spike, px, py);
      } else if (tiles['deco_' + ch]) {
        g.drawImage(tiles['deco_' + ch], px, py);
      }
    }
    chunks.push({ x: cx, canvas: c });
  }
  return chunks;
}
