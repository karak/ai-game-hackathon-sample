import { buildAssets } from './gfx/assets.js';
import { Audio, SONGS } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { W, H, SCALE } from './world.js';
import { loadSettings } from './settings.js';
import { setLang } from './i18n.js';

async function boot() {
  const canvas = document.getElementById('game');
  canvas.width = W * SCALE; canvas.height = H * SCALE; // 内部解像度 768x672。論理座標（世界単位）は 256x224 を SCALE 倍描画
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const t0 = performance.now();
  // ロード画面（M6）: フォント → 素材 235 枚の順に進捗バーを描く。フォント未読込の間はシステムフォント
  const drawLoading = (label, frac) => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0e0a18'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#3a3a52'; g.fillRect(184, 340, 400, 12); g.fillStyle = '#ff8fc8'; g.fillRect(184, 340, Math.round(400 * frac), 12);
    g.fillStyle = '#fdfbf7'; g.font = '20px DotGothic16, monospace'; g.textAlign = 'center'; g.fillText(label, 384, 320);
  };
  drawLoading('NOW LOADING', 0);

  // フォント読み込み（同梱 DotGothic16 / OFL）
  try {
    const fontUrl = new URL('../assets/fonts/DotGothic16-Game.ttf', import.meta.url); // サブセット（tools/subset_font.py）。カタログは全字形を読む
    const face = new FontFace('DotGothic16', `url(${fontUrl})`);
    await face.load(); document.fonts.add(face);
  } catch (e) { console.warn('font load failed', e); }
  drawLoading('NOW LOADING', 0.1);
  let lastDraw = 0;
  const assets = await buildAssets((done, total) => { const now = performance.now(); if (now - lastDraw > 50 || done === total) { lastDraw = now; drawLoading(`NOW LOADING  ${done}/${total}`, 0.1 + 0.9 * done / total); } });
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; // ロード画面で変えた文字設定を戻す
  const settings = loadSettings(localStorage); // キー/パッド割り当て・音量・進行・ハイスコア・表示言語
  setLang(settings.lang);
  // index.html の説明文（#info 内の [data-lang]）を表示言語に合わせる。オプションで切り替えた直後にも呼ばれる
  const applyLang = l => { document.documentElement.lang = l; document.querySelectorAll('#info [data-lang]').forEach(el => { el.hidden = el.dataset.lang !== l; }); };
  applyLang(settings.lang);
  const audio = new Audio();
  const input = new Input(window, settings);
  const game = new Game(assets, audio, input, settings, localStorage);
  window.__game = game; // デバッグ用
  game.onLangChange = applyLang;
  game.bootMs = Math.round(performance.now() - t0); // 初回ロード時間（M6 の出口条件 3 秒以内の計測用）

  // 最初のキー/タップで AudioContext を起動
  const unlock = () => { if (audio.ensure()) { audio.resume(); if (game.state === 'title' && !audio.bgm) audio.playBgm(SONGS.title); } };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('touchstart', unlock);

  // 拡大表示
  const fit = () => {
    const wrap = document.getElementById('wrap');
    const cw = W * SCALE, ch = H * SCALE;
    const reserve = window.innerWidth < 600 ? 150 : 40; // 下部の説明文／タッチパッドの高さ
    const sw = Math.floor(window.innerWidth / cw), sh = Math.floor((window.innerHeight - reserve) / ch);
    // 整数倍で入るならその最大倍率。768 幅が入らない画面（スマホ縦）は幅に合わせて縮小する（M6 モバイル簡易対応。従来は最小 1 倍で横にはみ出していた）
    const s = sw >= 1 ? Math.max(1, Math.min(sw, sh)) : Math.min(window.innerWidth / cw, Math.max(0.2, (window.innerHeight - reserve) / ch));
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
