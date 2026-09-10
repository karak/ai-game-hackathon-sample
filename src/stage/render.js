// ステージの描画アダプタ（DEBT-004、Sprint P）: World の状態を Canvas に描く。World は状態と更新だけを持ち、描画はここに集める。
// 関数は World のメソッドから切り出したもの（第 1 引数 world = 旧 this）。振る舞いは変えない（e2e/golden.spec.js の画素ハッシュで検査）。
import { TILE } from './physics.js';
import { W, H } from './viewport.js';
import { drawBackground } from '../gfx/background.js';
import { drawBackgroundHD } from '../gfx/hdworld.js';
import { THEMES } from '../gfx/tiles.js';
import { HD_SCALE as HD } from '../gfx/sprite.js';
import { drawEntity } from './entityRender.js';

export function drawWorld(world, g) {
  const cam = { x: Math.floor(world.cam.x), y: Math.floor(world.cam.y) };
  if (world.shakeAmp > 0) { cam.x += Math.floor((Math.random() - 0.5) * world.shakeAmp * 2); cam.y += Math.floor((Math.random() - 0.5) * world.shakeAmp); }
  if (world.bgHD) { if (!world.bgHD.sky) drawBackground(g, [world.bg[0]], world.cam.x, W, H); drawBackgroundHD(g, world.bgHD, world.cam.x, W, H, world.cam.y, world.level.map.pixelHeight); }
  else drawBackground(g, world.bg, world.cam.x, W, H);
  // マップ
  if (world.chunksHD) for (const c of world.chunksHD) { const sx = c.x - cam.x; const cw = c.canvas.width / 3; if (sx > W || sx + cw < 0) continue; g.drawImage(c.canvas, sx, -cam.y, cw, c.canvas.height / 3); }
  else for (const c of world.chunks) { const sx = c.x - cam.x; if (sx > W || sx + c.canvas.width < 0) continue; g.drawImage(c.canvas, sx, -cam.y); }
  // 毒沼アニメ（'~' タイル）
  drawBog(world, g, cam);
  drawEntity(world.decals, g, cam, W, H);
  drawGimmicks(world, g, cam);
  const A = world.assets;
  for (const b of world.boxes) drawEntity(b, g, cam, A.items);
  for (const q of world.pools) drawEntity(q, g, cam, A.shots);
  for (const i of world.items) drawEntity(i, g, cam, A.pickups);
  for (const e of world.enemies) drawEntity(e, g, cam, A);
  drawEntity(world.player, g, cam, A);
  for (const f of world.fires) drawEntity(f, g, cam, A.shots, A);   // 第 4 引数: 強化魔法の生成素材（magicfx）を引くため
  for (const s of world.shots) drawEntity(s, g, cam, A.shots, A);
  for (const s of world.enemyShots) drawEntity(s, g, cam, A.shots);
  for (const e of world.effects) drawEntity(e, g, cam, A);
  drawEntity(world.particles, g, cam);
  drawWeather(world, g, cam);
  // 毒の画面効果（変身解除中にうっすら）
  if (world.player.costume === 'plain' && world.player.alive) { g.fillStyle = 'rgba(180,92,245,0.06)'; g.fillRect(0, 0, W, H); }
  // 撃破フラッシュ / ボス撃破の白飛び
  const fa = world.fx.flashAlpha; if (fa > 0) { g.globalAlpha = fa; g.fillStyle = world.fx.flashColor; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  // 画面固定の演出（カットイン）は最後に、カメラを無視して描く
  for (const e of world.screenFx) drawEntity(e, g, world.assets, W, H);
}

// 動く足場・崩れる足場・はしご（足場画像はテーマの足場タイルを流用。はしごは暫定の幾何描画: 第四章の地形生成で置換予定）
export function drawGimmicks(world, g, cam) {
  const G = world.assets.generated?.tiles ?? {};
  // 生成済みのギミック絵（tiles/ladder, island, plank）があれば使う。無ければ足場タイル／幾何描画
  const drawGen = (spr, x, y, w, h) => { const sw = spr.r.width / HD, sh = spr.r.height / HD; g.drawImage(spr.r, Math.round(x + w / 2 - sw / 2), Math.round(y + h - sh), sw, sh); };
  const plat = (x, y, w, shake = 0, kind = 'plat') => {
    const sx = x - cam.x + shake, sy = y - cam.y;
    if (kind === 'island' && G.island) return drawGen(G.island, sx, sy - 2, w, TILE);
    if (kind === 'plank' && G.plank) return drawGen(G.plank, sx, sy, w, TILE);
    if (kind === 'candyplank' && G.candyplank) return drawGen(G.candyplank, sx, sy, w, TILE); // 第二章の飴の板（IMP-020）
    const n = Math.round(w / TILE);
    for (let i = 0; i < n; i++) {
      if (world.hdTiles) { const v = (i * 7) % world.hdTiles.cols; g.drawImage(world.hdTiles.plat[v], Math.round(sx + i * TILE), Math.round(sy), TILE, TILE); }
      else g.drawImage(world.tiles.plat, Math.round(sx + i * TILE), Math.round(sy));
    }
  };
  for (const p of world.platforms) {
    if (p.x + p.w <= cam.x || p.x >= cam.x + W) continue;
    if (p.kind === 'wheel' && G.gondola) { const sw = G.gondola.r.width / HD, sh = G.gondola.r.height / HD; g.drawImage(G.gondola.r, Math.round(p.x + p.w / 2 - sw / 2 - cam.x), Math.round(p.y - cam.y), sw, sh); continue; }
    if (p.kind === 'cart' && G.cart) { const sw = G.cart.r.width / HD, sh = G.cart.r.height / HD; g.drawImage(G.cart.r, Math.round(p.x + p.w / 2 - sw / 2 - cam.x), Math.round(p.y + p.h - sh - cam.y), sw, sh); continue; }
    plat(p.x, p.y, p.w, 0, p.kind === 'island' ? 'island' : 'plat');
  }
  // 観覧車の軸（中心）とスポーク
  for (const c of world.platforms.filter(p => p.kind === 'wheel' && p.phase === 0)) {
    if (c.cx + 60 < cam.x || c.cx - 60 > cam.x + W) continue;
    g.strokeStyle = '#c0b8a8'; g.lineWidth = 1; for (const q of world.platforms) if (q.kind === 'wheel' && q.cx === c.cx && q.cy === c.cy) { g.beginPath(); g.moveTo(Math.round(c.cx - cam.x), Math.round(c.cy - cam.y)); g.lineTo(Math.round(q.x + q.w / 2 - cam.x), Math.round(q.y + q.h / 2 - cam.y)); g.stroke(); }
    if (G.hub) { const sw = G.hub.r.width / HD, sh = G.hub.r.height / HD; g.drawImage(G.hub.r, Math.round(c.cx - sw / 2 - cam.x), Math.round(c.cy - sh / 2 - cam.y), sw, sh); }
    else { g.fillStyle = '#d9262b'; g.fillRect(Math.round(c.cx - 3 - cam.x), Math.round(c.cy - 3 - cam.y), 6, 6); }
  }
  for (const c of world.crumbles) if (c.state !== 'gone' && c.x + TILE > cam.x && c.x < cam.x + W) plat(c.x, c.y, TILE, c.shake, world.level.theme === 'candyforest' && G.candyplank ? 'candyplank' : 'plank');
  // 綿あめのトランポリン 'W' と糖蜜のノズル 'D'（第二章）
  { const map3 = world.level.map, tx0 = Math.floor(cam.x / TILE), tx1 = tx0 + W / TILE + 1;
    for (let ty = 0; ty < map3.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const c = map3.at(tx, ty);
      if (c !== 'W' && c !== 'D') continue;
      const spr = c === 'W' ? G.trampoline : G.dripper; const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
      if (spr) { const sw = spr.r.width / HD, sh = spr.r.height / HD; g.drawImage(spr.r, Math.round(x + (TILE - sw) / 2), Math.round(c === 'W' ? y + TILE - sh : y), sw, sh); }
      else { g.fillStyle = c === 'W' ? '#f7b8d8' : '#7a0f1f'; g.fillRect(x, y + (c === 'W' ? TILE - 6 : 0), TILE, 6); }
    }
  }
  // プレス機: 吊り鎖 + ブロック（生成絵 tiles/press があれば使う）
  for (const q of world.presses) {
    if (q.x + q.w < cam.x || q.x > cam.x + W) continue;
    const x = q.x - cam.x, y = q.y - cam.y, cx = q.tx * TILE + TILE / 2 - cam.x;
    g.fillStyle = '#5d5d70'; for (let cy = q.topY - cam.y - 4; cy < y; cy += 4) g.fillRect(cx - 1, cy, 2, 3); // 鎖
    if (G.press) { const sw = G.press.r.width / HD, sh = G.press.r.height / HD; g.drawImage(G.press.r, Math.round(cx - sw / 2), Math.round(y), sw, sh); }
    else { g.fillStyle = '#4e4e60'; g.fillRect(x - 2, y, TILE + 4, q.hBlock); g.fillStyle = '#a5a5b8'; g.fillRect(x - 2, y, TILE + 4, 2); g.fillStyle = '#d9262b'; g.fillRect(x, y + q.hBlock - 3, TILE, 3); }
  }
  // ベルトコンベア: 地面タイルの上に動くストライプ
  { const map2 = world.level.map, bx0 = Math.floor(cam.x / TILE), bx1 = bx0 + W / TILE + 1;
    for (let ty = 0; ty < map2.height; ty++) for (let tx = bx0; tx <= bx1; tx++) {
      const c = map2.at(tx, ty); if (c !== ')' && c !== '(') continue;
      const x = tx * TILE - cam.x, y = ty * TILE - cam.y, dir = c === ')' ? 1 : -1, off = ((world.t * 30 * dir) % 8 + 8) % 8;
      if (G.belt) { const B = G.belt.r, bw = B.width / HD, bh = B.height / HD, sx = ((tx * TILE) % Math.max(1, Math.round(bw))) ; g.save(); g.beginPath(); g.rect(x, y - 2, TILE, bh + 2); g.clip(); g.drawImage(B, Math.round(x - sx), Math.round(y + TILE - bh), bw, bh); g.restore(); }
      else { g.fillStyle = '#2d1f4c'; g.fillRect(x, y, TILE, 4); }
      g.fillStyle = '#a5a5b8'; for (let s = -8; s < TILE; s += 8) { const sx = x + s + off; const w = Math.min(3, x + TILE - sx); if (sx >= x && w > 0) g.fillRect(sx, y + 1, w, 2); }
    }
  }
  // はしご（1 タイル 1 段。生成絵は 2 段分なので上半分／下半分を交互に使う）
  const map = world.level.map, tx0 = Math.floor(cam.x / TILE), tx1 = tx0 + W / TILE + 1;
  const th = THEMES[world.level.theme];
  for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (map.at(tx, ty) !== 'L') continue;
    const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
    if (G.ladder) { // 生成絵（2 段分、高さ ≈ 74 セル）を縦方向のテクスチャとして 1 タイル分ずつ切り出す（継ぎ目は横桟の周期でほぼ隠れる）
      const L = G.ladder.r, th16 = TILE * HD, srcY = (ty * th16) % L.height, h1 = Math.min(th16, L.height - srcY), dx = Math.round(x + TILE / 2 - L.width / HD / 2);
      g.drawImage(L, 0, srcY, L.width, h1, dx, Math.round(y), L.width / HD, h1 / HD);
      if (h1 < th16) g.drawImage(L, 0, 0, L.width, th16 - h1, dx, Math.round(y) + h1 / HD, L.width / HD, (th16 - h1) / HD);
      continue;
    }
    g.fillStyle = th.plat[0]; g.fillRect(x + 3, y, 2, TILE); g.fillRect(x + 11, y, 2, TILE);
    g.fillStyle = th.plat[1]; g.fillRect(x + 4, y + 3, 8, 2); g.fillRect(x + 4, y + 11, 8, 2);
  }
}

// 天候: 川面は雨（斜めの雨筋＋薄い霧で視界低下）
export function drawWeather(world, g, cam) {
  if (world.level.theme === 'workshop') { // 綿雪: ゆっくり降る白い粒（決定論的）
    const t = world.t; g.save(); g.fillStyle = 'rgba(253,251,247,0.8)';
    for (let i = 0; i < 40; i++) { const s1 = (i * 7919) % 997 / 997, s2 = (i * 104729) % 991 / 991; const x = ((s1 * 300 + Math.sin(t * 0.7 + i) * 12 - cam.x * 0.2) % 300 + 300) % 300 - 20, y = ((s2 * 240 + t * 22) % 240); const sz = 1 + (i % 3) / 2; g.fillRect(Math.round(x), Math.round(y), sz, sz); }
    g.restore(); return;
  }
  if (world.level.theme !== 'river') return;
  const t = world.t; g.save(); g.globalAlpha = 0.35; g.strokeStyle = '#cbe8f0'; g.lineWidth = 1 / HD;
  g.beginPath();
  for (let i = 0; i < 70; i++) { // 決定論的な雨筋（i ごとの擬似乱数）: 落下速度 220/s、風で左へ 40/s
    const seed = (i * 7919) % 997 / 997, seed2 = (i * 104729) % 991 / 991;
    const x = ((seed * 320 - (t * 40 + cam.x * 0.3) % 320) % 320 + 320) % 320 - 32, y = ((seed2 * 260 + t * 220) % 260) - 20;
    g.moveTo(x, y); g.lineTo(x - 2, y + 9);
  }
  g.stroke(); g.restore();
  g.fillStyle = 'rgba(120,150,170,0.14)'; g.fillRect(0, 0, W, H); // 霧
}

export function drawBog(world, g, cam) {
  const map = world.level.map; const f = Math.floor(world.t * 3) % 2;
  const tx0 = Math.floor(cam.x / TILE), tx1 = tx0 + W / TILE + 1;
  const syrup = world.bogHD?.deep && THEMES[world.level.theme];   // 糖蜜描写（bogStyle: 'syrup' のテーマだけ。IMP-021）
  if (syrup) drawPitWalls(world, g, cam, tx0, tx1);
  for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (map.at(tx, ty) !== '~') continue;
    const top = map.at(tx, ty - 1) !== '~'; const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
    if (syrup) {
      if (top) g.drawImage(world.bogHD[f], x, y + 6, TILE, TILE - 6); else g.drawImage(world.bogHD.deep[f], x, y, TILE, TILE);
      if (top) drawShore(world, g, map, tx, ty, x, y + 6, syrup);
      continue;
    }
    if (world.bogHD) { const img = world.bogHD[f]; if (top) g.drawImage(img, tx * TILE - cam.x, ty * TILE - cam.y + 6, TILE, TILE - 6); else g.drawImage(img, 0, 24, 48, 24, tx * TILE - cam.x, ty * TILE - cam.y, TILE, TILE); }
    else g.drawImage(world.tiles[(top ? 'bogtop' : 'bog') + f], tx * TILE - cam.x, ty * TILE - cam.y);
  }
}

// 沼の穴の奥壁: 沼の上に空いた空気の列は背景の地平色（平らな桃色）が素通しで、穴が「板」に見えた。
// 隣の地面の面の高さから沼の水面までを、地中タイルを暗くして埋める（IMP-021。糖蜜テーマのみ）
export function drawPitWalls(world, g, cam, tx0, tx1) {
  const map = world.level.map; const tiles = world.hdTiles; if (!tiles) return;
  const surfaceRow = tx => { for (let ty = 0; ty < map.height; ty++) if (map.isSolid(tx, ty)) return ty; return map.height; };
  for (let ty = 0; ty < map.height; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (map.at(tx, ty) !== '~' || map.at(tx, ty - 1) === '~') continue;   // 沼の水面タイルだけ
    let L = tx; while (map.at(L - 1, ty) === '~') L--; let R = tx; while (map.at(R + 1, ty) === '~') R++;
    const wallTop = Math.max(surfaceRow(L - 1), surfaceRow(R + 1));        // 両岸のうち低い方の面から下が穴
    for (let wy = wallTop; wy < ty; wy++) {
      if (map.isSolid(tx, wy) || map.at(tx, wy) === '~') continue;
      const v = (tx * 7 + wy * 3) % tiles.cols; const x = tx * TILE - cam.x, y = wy * TILE - cam.y;
      g.drawImage(tiles.fill[v], x, y, TILE, TILE); g.fillStyle = 'rgba(26,15,30,0.55)'; g.fillRect(x, y, TILE, TILE);
    }
    // 水面タイルは 6 px 下げて描くので、その上 6 px も奥壁で埋める（素通しだと地平色の桃色の帯が残る）。水面のすぐ上は沼の光を受けて少し明るい
    const x = tx * TILE - cam.x, y = ty * TILE - cam.y; const v = (tx * 7 + ty * 3) % tiles.cols;
    g.drawImage(tiles.fill[v], 0, 0, TILE * HD, 6 * HD, x, y, TILE, 6); g.fillStyle = 'rgba(26,15,30,0.55)'; g.fillRect(x, y, TILE, 6);
    g.fillStyle = 'rgba(156,255,112,0.10)'; g.fillRect(x, y - 6, TILE, 12);
  }
}

// 岸の滴り: 沼の水面タイルの左右が地面なら、地面の土色を 3 px 幅で沼の面へ垂らす（糖蜜が岸に絡む）
export function drawShore(world, g, map, tx, ty, x, y, th) {
  const drip = (sx, dir) => {
    g.fillStyle = th.dirt[2]; g.fillRect(sx, y - 1, 3, 4); g.fillStyle = th.dirt[0]; g.fillRect(sx + (dir > 0 ? 0 : 2), y + 3, 1, 3);
    g.fillStyle = th.grass[0]; g.fillRect(sx + (dir > 0 ? 1 : 0), y - 2, 2, 1);
  };
  if (map.isSolid(tx - 1, ty)) drip(x, 1);
  if (map.isSolid(tx + 1, ty)) drip(x + TILE - 3, -1);
}
