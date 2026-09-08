import { buildAssets } from './gfx/assets.js';
import { Audio, SONGS } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { W, H } from './world.js';

async function boot() {
  const canvas = document.getElementById('game');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  // フォント読み込み（同梱 DotGothic16 / OFL）
  try {
    const face = new FontFace('DotGothic16', 'url(assets/fonts/DotGothic16-Regular.ttf)');
    await face.load(); document.fonts.add(face);
  } catch (e) { console.warn('font load failed', e); }

  const assets = buildAssets();
  const audio = new Audio();
  const input = new Input();
  const game = new Game(assets, audio, input);
  window.__game = game; // デバッグ用

  // 最初のキー/タップで AudioContext を起動
  const unlock = () => { if (audio.ensure()) { audio.resume(); if (game.state === 'title' && !audio.bgm) audio.playBgm(SONGS.title); } };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('touchstart', unlock);

  // 拡大表示
  const fit = () => {
    const wrap = document.getElementById('wrap');
    const sw = Math.floor(window.innerWidth / W), sh = Math.floor((window.innerHeight - (window.innerWidth < 600 ? 150 : 40)) / H);
    const s = Math.max(1, Math.min(sw, sh));
    canvas.style.width = `${W * s}px`; canvas.style.height = `${H * s}px`;
    wrap.style.width = `${W * s}px`;
  };
  fit(); window.addEventListener('resize', fit);

  // 固定ステップループ
  let last = performance.now(), acc = 0; const STEP = 1 / 60;
  const loop = now => {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) { game.update(STEP); input.endFrame(); acc -= STEP; steps++; }
    if (steps === 5) acc = 0;
    g.imageSmoothingEnabled = false;
    game.draw(g);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
boot();
