// タイル・装飾シート: ストリップ → 48px タイル（ID 付き）、隣接ルールの配置例、装飾の接地点
import { h1, h2, h3, note, table, canvas, drawRaw, rawSize, state } from '../sheet.js';
import { sliceTileStrip, renderMapLayerHD, TILE_BANDS, buildBogHD, buildSpikeHD } from '../../gfx/hdworld.js';
import { THEMES } from '../../gfx/tiles.js';
import { TileMap } from '../../physics.js';
import { DECO_MAP } from '../../decomap.js';

const SAMPLE = ['..........', '..===.....', '..........', '###....###', '###~~^^###', '###~~^^###'];

export async function render(main, A) {
  main.appendChild(h1('タイル・装飾'));
  main.appendChild(note('タイルは 48×48 px（世界 16 単位）。生成した地形ストリップから帯（地表 / 石壁 / 地中）を切り出し、地表タイル＝地表帯＋地中帯、足場＝石壁帯＋影、地中＝地中帯の縦繰り返し。列ごとにバリエーション（tx*7+ty*3 mod 列数）で連続を崩す。'));
  const gen = A.generated ?? {};
  for (const th of Object.keys(THEMES)) {
    const strip = gen.tiles?.[th]; if (!strip) continue;
    main.appendChild(h2(`テーマ: ${th}`));
    main.appendChild(h3('生成ストリップ（帯の切り出し位置）'));
    const [sw, sh] = rawSize(strip); const c = canvas(sw, sh); const g = c.getContext('2d'); drawRaw(g, strip, 0, 0);
    const b = TILE_BANDS[th]; g.font = '10px DotGothic16'; g.textAlign = 'left';
    for (const [name, [f0, f1], col] of [['surface', b.surface, '#7cff70'], ['plat', b.plat, '#ffe860'], ['fill', b.fill, '#ff8fc8']]) { const y0 = Math.round(sh * f0), y1 = Math.round(sh * f1); g.strokeStyle = col; g.strokeRect(0.5, y0 + 0.5, sw - 1, y1 - y0 - 1); g.fillStyle = col; g.fillText(`${name} ${f0}-${f1}`, 4, y0 + 10); }
    main.appendChild(c);
    const tiles = sliceTileStrip(strip.r, b);
    main.appendChild(h3(`タイル一覧（${tiles.cols} 列 × 地表 / 足場 / 地中）`));
    const tc = canvas(tiles.cols * 56 + 8, 3 * 56 + 8); const tg = tc.getContext('2d');
    [['top', tiles.top], ['plat', tiles.plat], ['fill', tiles.fill]].forEach(([nm, arr], r) => arr.forEach((t, i) => { tg.drawImage(t, 8 + i * 56, 8 + r * 56); tg.fillStyle = '#ffe860'; tg.font = '9px DotGothic16'; tg.fillText(`${nm}${i}`, 8 + i * 56, 8 + r * 56 + 46); }));
    main.appendChild(tc);
    main.appendChild(h3('配置例（隣接ルール: 上が空なら地表、上端が壁なら地中、= は足場、~ 毒沼、^ 棘）'));
    const map = new TileMap(SAMPLE); const chunks = renderMapLayerHD(map, tiles, A.tiles[th], 512, null, buildSpikeHD(THEMES[th]));
    const mc = canvas(map.pixelWidth * 3, map.pixelHeight * 3); const mg = mc.getContext('2d');
    for (const ch of chunks) mg.drawImage(ch.canvas, ch.x * 3, 0);
    const bog = buildBogHD(THEMES[th]);
    for (let ty = 0; ty < map.height; ty++) for (let tx = 0; tx < map.width; tx++) if (map.at(tx, ty) === '~') mg.drawImage(bog[0], tx * 48, ty * 48);
    if (state.grid) { mg.strokeStyle = 'rgba(255,255,255,0.15)'; for (let x = 0; x <= mc.width; x += 48) { mg.beginPath(); mg.moveTo(x + 0.5, 0); mg.lineTo(x + 0.5, mc.height); mg.stroke(); } for (let y = 0; y <= mc.height; y += 48) { mg.beginPath(); mg.moveTo(0, y + 0.5); mg.lineTo(mc.width, y + 0.5); mg.stroke(); } }
    main.appendChild(mc);
  }
  main.appendChild(h2('装飾オブジェクト（接地点 = タイル下端中央）'));
  const D = gen.deco ?? {};
  const names = Object.keys(D);
  const dc = canvas(names.reduce((a, n) => a + Math.max(rawSize(D[n])[0], 56) + 12, 12), Math.max(...names.map(n => rawSize(D[n])[1])) + 40); const dg = dc.getContext('2d');
  let x = 12; const base = dc.height - 20; dg.strokeStyle = '#8f8fb0'; dg.setLineDash([2, 3]); dg.beginPath(); dg.moveTo(0, base + 0.5); dg.lineTo(dc.width, base + 0.5); dg.stroke(); dg.setLineDash([]);
  for (const n of names) { const [w, h] = rawSize(D[n]); const cell = Math.max(w, 56); drawRaw(dg, D[n], x + (cell - w) / 2, base - h); if (state.anchor) { dg.fillStyle = '#ffe860'; dg.fillRect(x + cell / 2 - 3, base - 1, 7, 3); } dg.fillStyle = '#ffe860'; dg.font = '10px DotGothic16'; dg.textAlign = 'center'; dg.fillText(n, x + cell / 2, 10); dg.fillStyle = '#8f8fb0'; dg.fillText(`${w}x${h}`, x + cell / 2, base + 14); x += cell + 12; }
  main.appendChild(dc);
  // 記号 → 装飾（テーマ別、src/decomap.js と同じ定義）
  const themes = Object.keys(DECO_MAP), syms = [...new Set(themes.flatMap(t => Object.keys(DECO_MAP[t])))].sort();
  main.appendChild(table(['記号', ...themes], syms.map(sy => [sy, ...themes.map(t => DECO_MAP[t][sy] ?? '-')])));
  // ギミック小物（tiles/ 配下でテーマ名でないもの）
  const gim = Object.keys(gen.tiles ?? {}).filter(k => !THEMES[k]).sort();
  if (gim.length) {
    main.appendChild(h2('ギミック小物（生成。World.drawGimmicks が使う）'));
    main.appendChild(note('ladder: はしご L（縦にテクスチャ繰り返し） / island: 浮島 @ / plank: 崩れる板 ! / press: プレス機 %（判定は絵の寸法） / belt: ベルト ) ( / gear: 装飾 / cart: ジェットコースター R / gondola・hub: 観覧車 O'));
    const gc = canvas(gim.reduce((a, n) => a + Math.max(rawSize(gen.tiles[n])[0], 56) + 12, 12), Math.max(...gim.map(n => rawSize(gen.tiles[n])[1])) + 40); const gg = gc.getContext('2d');
    let gx = 12; const gbase = gc.height - 20;
    for (const n of gim) { const [w, h] = rawSize(gen.tiles[n]); const cell = Math.max(w, 56); drawRaw(gg, gen.tiles[n], gx + (cell - w) / 2, gbase - h); gg.fillStyle = '#ffe860'; gg.font = '10px DotGothic16'; gg.textAlign = 'center'; gg.fillText(`${n} ${w}x${h}`, gx + cell / 2, gbase + 14); gx += cell + 12; }
    main.appendChild(gc);
  }
}
