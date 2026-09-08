import { buildAssets } from './gfx/assets.js';
import { Audio, SONGS } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { W, H, SCALE } from './world.js';
import { loadSettings } from './settings.js';

async function boot() {
  const canvas = document.getElementById('game');
  canvas.width = W * SCALE; canvas.height = H * SCALE; // 内部解像度 768x672。論理座標（世界単位）は 256x224 を SCALE 倍描画
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  // フォント読み込み（同梱 DotGothic16 / OFL）
  try {
    const fontUrl = new URL('../assets/fonts/DotGothic16-Regular.ttf', import.meta.url);
    const face = new FontFace('DotGothic16', `url(${fontUrl})`);
    await face.load(); document.fonts.add(face);
  } catch (e) { console.warn('font load failed', e); }

  const assets = await buildAssets();
  const settings = loadSettings(localStorage); // キー/パッド割り当て・音量・進行・ハイスコア
  const audio = new Audio();
  const input = new Input(window, settings);
  const game = new Game(assets, audio, input, settings, localStorage);
  window.__game = game; // デバッグ用

  // 最初のキー/タップで AudioContext を起動
  const unlock = () => { if (audio.ensure()) { audio.resume(); if (game.state === 'title' && !audio.bgm) audio.playBgm(SONGS.title); } };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('touchstart', unlock);

  // 拡大表示
  const fit = () => {
    const wrap = document.getElementById('wrap');
    const cw = W * SCALE, ch = H * SCALE;
    const sw = Math.floor(window.innerWidth / cw), sh = Math.floor((window.innerHeight - (window.innerWidth < 600 ? 150 : 40)) / ch);
    const s = Math.max(1, Math.min(sw, sh));
    canvas.style.width = `${cw * s}px`; canvas.style.height = `${ch * s}px`;
    wrap.style.width = `${cw * s}px`;
  };
  fit(); window.addEventListener('resize', fit);

  // 固定ステップループ
  let last = performance.now(), acc = 0; const STEP = 1 / 60;
  const loop = now => {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    input.poll(); // ゲームパッド（押下エッジは次の update まで pressed に残る）
    let steps = 0;
    while (acc >= STEP && steps < 5) { game.update(STEP); input.endFrame(); acc -= STEP; steps++; }
    if (steps === 5) acc = 0;
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0); g.imageSmoothingEnabled = false;
    game.draw(g);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
boot();
