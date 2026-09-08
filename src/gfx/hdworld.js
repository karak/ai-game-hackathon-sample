// 生成済み背景レイヤー / 地形タイル（HD: 1 世界単位 = HD_SCALE 画素）の描画。
// タイルストリップ（tiles/<theme>.png）を 48px 角に切り、上段 = 地表、下段 = 地中として使う。
import { HD_SCALE } from './sprite.js';
import { TILE } from '../physics.js';

const T = TILE * HD_SCALE; // 48

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ストリップ画像 → { top: [canvas...], fill: [canvas...] }。幅は 48 の倍数に切り詰め、余りは捨てる。
// bands: ストリップ高さに対する帯の [開始, 終了]（0..1）。生成物の実測: 地表(草) / 石壁 / 地中
export const TILE_BANDS = {
  graveyard:   { surface: [0.00, 0.22], plat: [0.22, 0.40], fill: [0.52, 0.88] },
  candyforest: { surface: [0.00, 0.19], plat: [0.32, 0.42], fill: [0.55, 0.95] },
  castle:      { surface: [0.00, 0.20], plat: [0.50, 0.62], fill: [0.50, 1.00] },
};
export function sliceTileStrip(img, bands = TILE_BANDS.graveyard) {
  const cols = Math.max(1, Math.floor(img.width / T));
  const yOf = f => Math.min(Math.max(0, Math.round(img.height * f)), img.height);
  const [s0, s1] = bands.surface.map(yOf), [p0, p1] = bands.plat.map(yOf), [f0, f1] = bands.fill.map(yOf);
  const sh = Math.max(8, Math.min(T, s1 - s0)), fh = Math.max(8, f1 - f0), ph = Math.max(8, Math.min(T - 8, p1 - p0));
  const top = [], fill = [], plat = [];
  for (let i = 0; i < cols; i++) {
    // 地表タイル: 上に草帯、残りは地中の帯で埋める
    const t = canvas(T, T); const g = t.getContext('2d');
    g.drawImage(img, i * T, s0, T, sh, 0, 0, T, sh);
    for (let y = sh; y < T; y += fh) g.drawImage(img, i * T, f0, T, Math.min(fh, T - y), 0, y, T, Math.min(fh, T - y));
    top.push(t);
    // 地中タイル: 地中帯を縦に繰り返す
    const f = canvas(T, T); const gf = f.getContext('2d');
    for (let y = 0; y < T; y += fh) gf.drawImage(img, i * T, f0, T, Math.min(fh, T - y), 0, y, T, Math.min(fh, T - y));
    fill.push(f);
    // 足場: 石壁帯、下端に影
    const p = canvas(T, T); const gp = p.getContext('2d');
    gp.drawImage(img, i * T, p0, T, ph, 0, 2, T, ph); gp.fillStyle = 'rgba(26,15,30,0.55)'; gp.fillRect(0, ph + 2, T, 3);
    plat.push(p);
  }
  return { top, fill, plat, cols };
}

// HD 毒沼タイル（2 フレーム）。テーマ色から 48px 解像度で生成する
export function buildBogHD(theme, seed = 7) {
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const out = [];
  for (let f = 0; f < 2; f++) {
    const c = canvas(T, T); const g = c.getContext('2d');
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = rnd(); g.fillStyle = theme.bog[v < 0.7 ? 0 : v < 0.93 ? 1 : 2]; g.fillRect(x, y, 1, 1); }
    // 揺らぐ表面ライン
    for (let x = 0; x < T; x++) { const yy = 1 + Math.round(Math.sin((x + f * 6) / 5) * 1.5); g.fillStyle = theme.bogGlow; g.fillRect(x, yy, 1, 1); g.fillStyle = theme.bogBubble; if (x % 9 === (f * 4) % 9) g.fillRect(x, yy + 1, 1, 1); }
    // 泡
    for (let i = 0; i < 5; i++) { const bx = Math.floor(rnd() * (T - 6)) + 3, by = Math.floor(rnd() * (T - 10)) + 6, r = 1 + Math.floor(rnd() * 2); g.fillStyle = theme.bogGlow; g.fillRect(bx - r, by, r * 2 + 1, 1); g.fillRect(bx, by - r, 1, r * 2 + 1); g.fillStyle = theme.bogBubble; g.fillRect(bx, by - r, 1, 1); }
    out.push(c);
  }
  return out;
}

// HD 棘タイル（48px）: 6 本の鋼の棘、先端に血
export function buildSpikeHD(theme) {
  const c = canvas(T, T); const g = c.getContext('2d');
  g.fillStyle = theme.dirt[2]; g.fillRect(0, T - 6, T, 6); g.fillStyle = theme.dirt[0]; g.fillRect(0, T - 4, T, 2);
  for (let i = 0; i < 6; i++) {
    const bx = i * 8 + 1;
    for (let y = 0; y < 40; y++) { const hw = Math.max(0, Math.round(3 * y / 40)); g.fillStyle = '#d8d8e6'; g.fillRect(bx + 3 - hw, 6 + y, hw * 2 + 1, 1); g.fillStyle = '#a5a5b8'; g.fillRect(bx + 3 + hw, 6 + y, 1, 1); if (hw > 1) { g.fillStyle = '#5d5d70'; g.fillRect(bx + 3 - hw, 6 + y, 1, 1); } }
    g.fillStyle = '#d9262b'; g.fillRect(bx + 3, 4, 1, 8); g.fillRect(bx + 2, 9, 3, 2); g.fillStyle = '#7a0f1f'; g.fillRect(bx + 3, 11, 1, 3);
  }
  return c;
}

// マップ全体を HD チャンクに事前描画（世界 512px 幅 = 1536 HD px ごと）
export function renderMapLayerHD(map, tiles, decoTiles, chunkWorld = 512, decoHD = null, spikeHD = null) {
  const chunks = [];
  for (let cx = 0; cx < map.pixelWidth; cx += chunkWorld) {
    const cw = Math.min(chunkWorld, map.pixelWidth - cx);
    const c = canvas(cw * HD_SCALE, map.pixelHeight * HD_SCALE); const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const tx0 = cx / TILE, tx1 = (cx + cw) / TILE;
    for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx < tx1; tx++) {
      const ch = map.at(tx, ty); const px = (tx - tx0) * T, py = ty * T; const v = (tx * 7 + ty * 3) % tiles.cols;
      if (map.isSolid(tx, ty)) {
        const up = map.isSolid(tx, ty - 1) || ty === 0;
        g.drawImage(up ? tiles.fill[v] : tiles.top[v], px, py);
        if (!map.isSolid(tx, ty + 1) && ty < map.height - 1) { g.fillStyle = 'rgba(26,15,30,0.45)'; g.fillRect(px, py + T - 4, T, 4); }
      } else if (map.isOneWay(tx, ty)) g.drawImage(tiles.plat[v], px, py);
      else if (decoHD && decoHD[ch]) { const d = decoHD[ch].r; g.drawImage(d, px + Math.round((T - d.width) / 2), py + T - d.height); } // 生成装飾: 足元をタイル下端に
      else if (decoTiles && decoTiles['deco_' + ch]) g.drawImage(decoTiles['deco_' + ch], px, py, T, T); // 旧装飾は 3 倍表示（暫定）
      else if (ch === '^') { if (spikeHD) g.drawImage(spikeHD, px, py); else if (decoTiles) g.drawImage(decoTiles.spike, px, py, T, T); }
    }
    chunks.push({ x: cx, canvas: c });
  }
  return chunks;
}

// 背景レイヤー描画: sky は画面全体に、far/mid は下端を地平線に合わせて横方向に繰り返す
// 背景の画素密度: 空 3 画面px/セル（ディザ空は粗くても成立）、遠景 2、中景 1（スプライトと同じ）。
// 1 リクエストで得られる横幅（約 250 セル）の制約による妥協。docs/art-standard.md §2.4 参照。
const BG_PX = { sky: 3, far: 1, mid: 1 }; // 遠景は A/B 2 変異体（高さ ≈ 130〜160 セル）を連結して 1 画面 px/セル。空のみ 3 倍のまま（docs/plan/02-near-term.md 課題 1）
export function drawBackgroundHD(g, layers, camX, W, H) {
  // 下地: 空が画面全体を覆わない場合（城の奥壁 2 px/セル = y174 まで）に前フレームが残らないよう、先に暗色で塗る
  g.fillStyle = layers.base ?? '#150a22'; g.fillRect(0, 0, W, H);
  if (layers.sky) {
    // 空は既定 3 px/セル。layers.skyPx で層ごとに上書き（城の奥壁は 2: 261 セル × 2 = 522 px = 地面線 y174 まで届く）。幅が足りなければ横に繰り返す
    const s = (layers.skyPx ?? BG_PX.sky) / HD_SCALE, sw = layers.sky.r.width * s, sh = layers.sky.r.height * s;
    for (let x = 0; x < W; x += sw) g.drawImage(layers.sky.r, Math.round(x * HD_SCALE) / HD_SCALE, 0, sw, sh);
  }
  // 遠景の接地線は中景（上端 ≈ y138）より上の y=158 に置き、1 倍化した遠景（高さ 28〜37 世界単位）が中景の背後に隠れないようにする
  for (const [name, speed, bottom] of [['far', 0.2, 158], ['mid', 0.5, 176]]) {
    const list = layers[name]; if (!list || !list.length) continue;
    const s = BG_PX[name] / HD_SCALE;
    // 複数バリアントを順に連結した 1 本の帯として繰り返す（両端に余白があるので順序を問わず継ぎ目なし）
    const widths = list.map(L => L.r.width * s); const total = widths.reduce((a, b) => a + b, 0);
    let ox = -((camX * speed) % total); if (ox > 0) ox -= total;
    for (let x = ox; x < W; x += total) {
      let cx = x;
      list.forEach((L, i) => { const lw = widths[i], lh = L.r.height * s; if (cx + lw > 0 && cx < W) g.drawImage(L.r, Math.round(cx * HD_SCALE) / HD_SCALE, bottom - lh, lw, lh); cx += lw; });
    }
  }
}
