// デザインカタログ: 全アセットをラベル付きで並べ、スクリーンショットで品質を確認するための画面
import { buildAssets } from './gfx/assets.js';
import { drawBackground } from './gfx/background.js';
import { renderMapLayer } from './gfx/tiles.js';
import { TileMap } from './physics.js';
import { drawWindow, text, mini, textBox, LAYOUT } from './ui/index.js';
import { COSTUMES } from './gfx/palette.js';

const url = new URL(location.href);
const only = url.searchParams.get('section'); // ?section=player など単一セクション表示

async function boot() {
  try { const fontUrl = new URL('../assets/fonts/DotGothic16-Regular.ttf', import.meta.url); const face = new FontFace('DotGothic16', `url(${fontUrl})`); await face.load(); document.fonts.add(face); } catch {}
  const A = buildAssets();
  const scale = Number(document.getElementById('scale').value);
  document.getElementById('scale').addEventListener('change', () => location.reload());
  const root = document.getElementById('sections');

  const section = (id, title, w, h, draw) => {
    if (only && only !== id) return;
    const hd = document.createElement('h2'); hd.textContent = `${title}  (${w}x${h})`; root.appendChild(hd);
    const c = document.createElement('canvas'); c.id = id; c.width = w; c.height = h; c.style.width = `${w * scale}px`; c.style.height = `${h * scale}px`;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#3a3a52'; g.fillRect(0, 0, w, h);
    // 市松の下地
    g.fillStyle = '#44445e'; for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < w; x += 16) g.fillRect(x, y, 8, 8);
    draw(g);
    root.appendChild(c);
  };
  const label = (g, s, x, y) => mini(g, s, x, y, '#ffe860');

  // 主人公: 衣装 × フレーム
  section('player', '主人公リリカ 全フレーム（衣装3種）', 256, 3 * 44 + 8, g => {
    const frames = ['idle_stand', 'idle_run1', 'idle_run2', 'idle_run3', 'attack_stand', 'jump_jump', 'attack_jump', 'hurt_jump', 'crouch', 'dead'];
    Object.keys(COSTUMES).forEach((c, ci) => {
      label(g, c.toUpperCase(), 2, ci * 44 + 2);
      frames.forEach((f, i) => {
        const spr = A.player[c][f]; if (!spr) return;
        const x = 4 + i * 25, y = ci * 44 + 10;
        g.drawImage(spr.r, x, y);
        if (c !== 'plain' && f !== 'dead') g.drawImage(A.hat.r, x, y - 6 + (f === 'crouch' ? 7 : 0));
      });
    });
  });
  section('player_big', '主人公 拡大比較（idle / run / jump / attack）', 128, 40, g => {
    ['idle_stand', 'idle_run1', 'jump_jump', 'attack_stand'].forEach((f, i) => { const spr = A.player.dress[f]; g.drawImage(spr.r, 8 + i * 30, 8); g.drawImage(A.hat.r, 8 + i * 30, 2); });
  });

  // 敵
  section('enemies', '敵キャラクター', 256, 64, g => {
    let x = 4;
    for (const [name, spr] of Object.entries(A.enemies)) { g.drawImage(spr.l, x, 12); label(g, name.slice(0, 6), x, 2); x += Math.max(spr.w, 26) + 4; if (x > 230) break; }
    let x2 = 4; for (const n of Object.keys(A.enemies).slice(9)) { const spr = A.enemies[n]; g.drawImage(spr.l, x2, 40); label(g, n.slice(0, 6), x2, 32); x2 += Math.max(spr.w, 26) + 4; }
  });
  section('bosses', 'ボス', 200, 80, g => {
    let x = 4; for (const [name, spr] of Object.entries(A.bosses)) { g.drawImage(spr.l, x, 78 - spr.h); label(g, name, x, 2); x += spr.w + 12; }
  });
  section('shots_items', '弾・アイテム・帽子・ほうき', 256, 48, g => {
    let x = 4; for (const [name, spr] of Object.entries(A.shots)) { g.drawImage(spr.r, x, 10); label(g, name.slice(0, 4), x, 2); x += Math.max(spr.w, 16) + 2; }
    x = 4; for (const [name, spr] of Object.entries(A.items)) { g.drawImage(spr.r, x, 30); label(g, name.slice(0, 5), x, 22); x += Math.max(spr.w, 20) + 4; }
    g.drawImage(A.hat.r, x, 30); x += 24; g.drawImage(A.broom.r, x, 34);
  });

  // タイル（テーマ別）
  for (const th of Object.keys(A.tiles)) {
    section('tiles_' + th, `タイル: ${th}`, 256, 40, g => {
      const T = A.tiles[th]; let x = 4;
      for (const k of ['top', 'ground', 'edgeL', 'edgeR', 'ceil', 'plat', 'bog0', 'bogtop0', 'spike']) { g.drawImage(T[k], x, 12); label(g, k.slice(0, 4), x, 2); x += 20; }
      for (const k of Object.keys(T).filter(k => k.startsWith('deco_'))) { if (x > 236) break; g.drawImage(T[k], x, 12); label(g, k.slice(5), x, 2); x += 20; }
    });
  }

  // 背景＋地形の合成（ゲーム画面相当）
  const sampleRows = [
    '................', '................', '................', '................', '................', '................',
    '........===.....', '................', '................', '...t..f.....v...', '......x.........', '####....########', '####~~~~########', '####~~~~########',
  ];
  for (const th of Object.keys(A.backgrounds)) {
    section('scene_' + th, `シーン合成: ${th}`, 256, 224, g => {
      drawBackground(g, A.backgrounds[th], 300, 256, 224);
      const map = new TileMap(sampleRows);
      const chunks = renderMapLayer(map, A.tiles[th]);
      for (const c of chunks) g.drawImage(c.canvas, c.x, 0);
      for (let tx = 4; tx < 8; tx++) { g.drawImage(A.tiles[th].bogtop0, tx * 16, 12 * 16); g.drawImage(A.tiles[th].bog0, tx * 16, 13 * 16); }
      const p = A.player.dress.idle_stand; g.drawImage(p.r, 24, 152); g.drawImage(A.hat.r, 24, 146);
      g.drawImage(A.enemies.zombie1.l, 150, 160); g.drawImage(A.enemies.mushroom1.l, 200, 130);
    });
  }

  // UI
  section('ui', 'UI: 窓・テキスト折り返し・HUD ミニフォント', 256, 224, g => {
    g.fillStyle = '#1a0f2e'; g.fillRect(0, 0, 256, 224);
    drawWindow(g, 2, 2, 22, 22); g.drawImage(A.shots.star.r, 9, 9);
    mini(g, 'SCORE', 28, 4, '#cbaaf5'); mini(g, '0001200', 28, 11); mini(g, 'TIME', 84, 4, '#cbaaf5'); mini(g, '2:45', 84, 11);
    textBox(g, '第一章　花畑の墓地（タイトル）', { y: 30, color: '#ff8fc8' });
    textBox(g, 'これは長いテロップの折り返しテストです。実測幅で 240px 以内に収まるように改行されます。', { y: 62 });
    textBox(g, [{ t: 'ステージクリア！', color: '#ffe860' }, { t: '次の章へ…', color: '#cbaaf5' }], { y: 120, minWidth: 192 });
    textBox(g, 'フルブルームドレス！ためうちが使える', { y: 176, pad: 4 });
  });
}
boot();
