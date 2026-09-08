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
  const A = await buildAssets();
  const sel = document.getElementById('scale');
  if (url.searchParams.get('scale')) sel.value = url.searchParams.get('scale');
  const scale = Number(sel.value);
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
  section('player', '主人公リリカ 全フレーム（衣装3種）', 380, 3 * 64 + 8, g => {
    const frames = ['idle_stand', 'idle_run1', 'idle_run2', 'idle_run3', 'idle_run4', 'attack_stand', 'jump_jump', 'jump_fall', 'hurt_fall', 'crouch', 'dead'];
    Object.keys(COSTUMES).forEach((c, ci) => {
      label(g, c.toUpperCase(), 2, ci * 44 + 2);
      frames.forEach((f, i) => {
        const spr = A.player[c][f]; if (!spr) return;
        const x = 2 + i * 34, y = ci * 64 + 14;
        g.drawImage(spr.r, x, y);
        if (c !== 'plain' && f !== 'dead') g.drawImage(A.hat.r, x, y - 11 + (f === 'crouch' ? 12 : 0));
      });
    });
  });
  section('player_big', '主人公 拡大比較（idle / run / jump / attack）', 170, 64, g => {
    ['idle_stand', 'idle_run1', 'jump_jump', 'attack_stand'].forEach((f, i) => { const spr = A.player.dress[f]; g.drawImage(spr.r, 8 + i * 40, 14); g.drawImage(A.hat.r, 8 + i * 40, 3); });
  });

  // 参照画像との並置（著作物のため同梱せず外部 URL を実行時に読む。docs/art-standard.md §1）
  section('reference', '参照並置: 左=参照(外部URL, 論理 ~40x60)  右=本作の主人公 32x48（同倍率）', 160, 80, g => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 参照画像は 2px/論理px の拡大なので 1/2 に縮めて論理サイズで並べる
      const sw = 96, sh = 128, sx = 0, sy = 0; // 左上 1 キャラ分
      g.imageSmoothingEnabled = false;
      g.drawImage(img, sx, sy, sw, sh, 8, 8, sw / 2, sh / 2);
      const p = A.player.dress.idle_stand; g.drawImage(p.r, 80, 20); g.drawImage(A.hat.r, 80, 9);
      label(g, 'REF', 8, 0); label(g, 'LYRICA', 80, 0);
    };
    img.onerror = () => label(g, 'REF LOAD FAILED (OFFLINE?)', 4, 30);
    img.src = 'https://i.pinimg.com/originals/bb/b9/a0/bbb9a0d099d450252e74ac4672b354d5.jpg';
    label(g, 'LOADING REF...', 4, 30);
  });

  // 敵
  section('enemies', '敵キャラクター（全フレーム）', 256, 84, g => {
    let x = 4, y = 12;
    for (const [name, spr] of Object.entries(A.enemies)) {
      if (x + spr.w > 252) { x = 4; y += 40; }
      g.drawImage(spr.l, x, y + 24 - spr.h); label(g, name.slice(0, 7), x, y - 8);
      x += Math.max(spr.w, 30) + 4;
    }
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
      const p = A.player.dress.idle_stand; g.drawImage(p.r, 24, 128); g.drawImage(A.hat.r, 24, 117);
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
