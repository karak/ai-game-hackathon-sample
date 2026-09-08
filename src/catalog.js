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

  // 生成スプライトを 1:1（ゲーム表示と同じ画素密度）で並べるヘルパー
  const row = (id, title, group, names, gap = 8) => {
    const sprs = names.map(n => [n, group[n]]).filter(([, s]) => s);
    const W = sprs.reduce((a, [, s]) => a + s.r.width + gap, gap), H = Math.max(40, ...sprs.map(([, s]) => s.r.height)) + 16;
    section(id, title, W, H, g => { let x = gap; for (const [n, s] of sprs) { g.drawImage(s.r, x, H - 4 - s.r.height); label(g, n.slice(0, 10), x, 2); x += s.r.width + gap; } });
  };
  const PF = ['idle', 'run1', 'run2', 'run3', 'run4', 'jump', 'fall', 'attack', 'crouch', 'hurt', 'dead'];
  row('player_dress', '主人公 リリカ（ドレス・帽子あり）1:1', A.player.dress, PF);
  row('player_plain', '主人公（変身解除・私服）1:1', A.player.plain, PF);
  row('player_gold', '主人公（フルブルーム）1:1', A.player.gold, PF);
  row('player_parts', '帽子・ほうき', { hat: A.hat, broom: A.broom }, ['hat', 'broom']);
  row('enemies', '敵キャラクター（全フレーム）1:1', A.enemies, Object.keys(A.enemies));
  row('bosses', 'ボス 1:1', A.bosses, Object.keys(A.bosses));
  row('shots', '弾', A.shots, Object.keys(A.shots));
  row('items', 'アイテム', A.items, Object.keys(A.items));

  // タイル（テーマ別）
  for (const th of Object.keys(A.tiles)) {
    section('tiles_' + th, `タイル: ${th}`, 256, 40, g => {
      const T = A.tiles[th]; let x = 4;
      for (const k of ['top', 'ground', 'edgeL', 'edgeR', 'ceil', 'plat', 'bog0', 'bogtop0', 'spike']) { g.drawImage(T[k], x, 12); label(g, k.slice(0, 4), x, 2); x += 20; }
      for (const k of Object.keys(T).filter(k => k.startsWith('deco_'))) { if (x > 236) break; g.drawImage(T[k], x, 12); label(g, k.slice(5), x, 2); x += 20; }
    });
  }

  // シーン合成: 実際の World 描画（背景層・HD タイル・装飾・毒沼）をそのまま使う
  const { World } = await import('./world.js');
  const { STAGES } = await import('./levels/index.js');
  const stubGame = { assets: A, audio: { sfx() {}, playBgm() {}, stopBgm() {} }, score: 0, lives: 2, stageIndex: 0 };
  for (const [i, st] of STAGES.entries()) {
    section('scene_' + st.theme, `シーン合成: ${st.theme}（768x672、実描画）`, 768, 672, g => {
      const w = new World(stubGame, st); const p = w.player;
      // 見どころ位置: ステージ中盤の足場付近へカメラを置く
      p.x = (st.name === 'stage3' ? 40 : 60) * 16; w.cam.x = p.x - 90; p.invT = 0;
      for (const e of w.enemies) if (e.update && e.hp !== undefined && Math.abs(e.x - p.x) < 300) { /* 位置のみ */ }
      g.save(); g.scale(3, 3); w.draw(g); g.restore();
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
