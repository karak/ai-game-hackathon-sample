// 進行の各状態の画面描画（Sprint P）: タイトル／導入／プレイ中の重ね物（アイリス・ボス登場・ポーズ）／クリア／ゲームオーバー／エンディング／デモ。
// Game のメソッドから切り出した（第 1 引数 game = 旧 this）。Game は状態機械と遷移・記録だけを持つ。振る舞いは変えない（e2e/golden.spec.js）
import { W, H } from '../stage/viewport.js';
import { STAGES } from '../content/levels/index.js';
import { text, mini, drawHud, textBox, wrap, LAYOUT, MINI_W, miniX } from '../ui/index.js';
import { drawBackground } from '../gfx/background.js';
import { blit } from '../gfx/sprite.js';
import { drawBackgroundHD } from '../gfx/hdworld.js';
import { story } from '../content/story.js';
import { t } from '../shared/i18n.js';
import { irisRadius, IRIS_T, BOSS_INTRO_T } from '../stage/fx.js';
import { codesFor, keyNameMini } from './settings.js';
import { drawOptions } from './options.js';

export function drawDemo(game, g) {
  game.world.draw(g); drawHud(g, game.world, game);
  if (Math.floor(game.stateT * 2) % 2) text(g, 'DEMO', 128, 100, { align: 'center', color: '#ffe860' });
  mini(g, 'PUSH ANY KEY', miniX('PUSH ANY KEY'), 118, '#fdfbf7');
}

// アイリス（円の外側を黒く塗る）。r は世界単位、中心は主人公
export function drawIris(game, g, r) {
  if (r <= 0) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
  const p = game.world?.player, cam = game.world?.cam ?? { x: 0 };
  const cx = p ? Math.max(0, Math.min(W, p.centerX - Math.floor(cam.x))) : W / 2, cy = p ? Math.max(0, Math.min(H, p.y + p.h / 2)) : H / 2;
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, r, 0, Math.PI * 2, true); g.fillStyle = '#000'; g.fill(); g.restore();
}

export function drawBossIntro(game, g) {
  const fx = game.world.fx, k = Math.min(1, (BOSS_INTRO_T - fx.introT) / 0.3); // 0.3 秒でバーが降りる
  const bar = Math.floor(28 * k);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
  if (k >= 1) textBox(g, [{ t: fx.introName, color: '#ff8fc8' }, { t: 'WARNING', size: 10, color: '#ff6a6a' }], { minWidth: 160, window: { top: '#3a1650', bottom: '#150a22' } });
}

export function drawState(game, g, state) {
  switch (state) {
    case 'title': drawTitle(game, g); break;
    case 'options': drawOptions(game, g); break;
    case 'demo': drawDemo(game, g); break;
    case 'wipe': drawState(game, g, game.wipe.from); drawIris(game, g, irisRadius(game.wipe.t, false, W, H)); break;
    case 'prologue': drawScroll(game, g, story().prologue, 'prologue'); break;
    case 'intro': game.world.draw(g); drawIris(game, g, irisRadius(game.stateT, true, W, H)); drawIntro(game, g); break;
    case 'play':
      game.world.draw(g); drawHud(g, game.world, game);
      if (game.world.fx.introActive) drawBossIntro(game, g);
      if (game.irisT < IRIS_T) drawIris(game, g, irisRadius(game.irisT, true, W, H));
      if (game.paused) drawPause(game, g);
      break;
    case 'clear': game.world.draw(g); drawHud(g, game.world, game); drawClear(game, g); break;
    case 'gameover': if (game.world) game.world.draw(g); drawGameOver(game, g); break;
    case 'ending': drawEnding(game, g); break;
  }
}

export function drawTitle(game, g) {
  const gen = game.assets.generated ?? {};
  if (gen.bg?.graveyard_sky) drawBackgroundHD(g, { sky: gen.bg.graveyard_sky, far: [gen.bg.graveyard_far, gen.bg.graveyard_far2].filter(Boolean), mid: [gen.bg.graveyard_mid, gen.bg.graveyard_mid2, gen.bg.graveyard_mid3].filter(Boolean) }, game.titleCam, W, H);
  else drawBackground(g, game.titleBg, game.titleCam, W, H);
  // 地面の帯（HD タイルがあれば地表＋地中）
  g.fillStyle = '#150a22'; g.fillRect(0, 176, W, 48);
  const strip = gen.tiles?.graveyard;
  if (strip) { const cols = Math.floor(strip.r.width / 48); for (let tx = 0; tx < 16; tx++) { const v = tx % cols; g.drawImage(strip.r, v * 48, 0, 48, 22, tx * 16, 176, 16, 22 / 3); g.drawImage(strip.r, v * 48, Math.round(strip.r.height * 0.52), 48, 48, tx * 16, 176 + 22 / 3, 16, 48 - 22 / 3); } }
  else { const tiles = game.assets.tiles.graveyard; for (let x = 0; x < W; x += 16) { g.drawImage(tiles.top, x, 176); g.drawImage(tiles.ground, x, 192); g.drawImage(tiles.ground, x, 208); } }
  const D = gen.deco ?? {}; for (const [d, x] of [[D.tomb, 40], [D.cross, 205], [D.flowers, 70], [D.blood, 150]]) if (d) blit(g, d, false, x, 176 - d.h);
  // 主人公（生成スプライト、足元を地面 y=176 に）
  const p = game.assets.player.dress.idle; if (p) blit(g, p, false, 128 - p.w / 2, 176 - p.h);
  // ゾンビ
  const z = game.assets.enemies[Math.floor(game.stateT * 4) % 2 ? 'zombie1' : 'zombie2']; if (z) { blit(g, z, true, 190, 176 - z.h); blit(g, z, true, 18, 176 - z.h); }
  // タイトル
  const r = textBox(g, [{ t: t('マジカル☆リリカと'), color: '#ff8fc8' }, { t: t('血塗られたおとぎの国'), color: '#fdfbf7' }, { t: ' ', size: 6 }], { y: 28, minWidth: 224 });
  g.fillStyle = '#d9262b'; g.fillRect(r.x + 24, r.y + r.h - 12, r.w - 48, 1);
  const sub = t('MAGICAL LYRICA AND THE BLOODSTAINED FAIRYLAND'); // 英語 UI では副題が日本語になる
  mini(g, sub, miniX(sub), r.y + r.h - 10, '#cbaaf5');
  // メニュー（はじめから / つづきから / オプション）。主人公の帽子の上端（y≈140、計測値）に掛からないよう下端を 131 に
  const menu = game.titleMenu(), mh = menu.length * 14, my = 131 - mh;
  menu.forEach((m, i) => {
    const sel = i === game.menuIdx, color = sel ? '#ffe860' : '#fdfbf7';
    if (sel && Math.floor(game.stateT * 4) % 4 !== 3) text(g, '▶', 128 - 56, my + i * 14, { color });
    text(g, m.label, 128 - 44, my + i * 14, { color });
  });
  mini(g, 'HI ' + String(game.hi).padStart(7, '0'), 4, 4, '#a5a5b8');
  if (game.input.padConnected) mini(g, 'PAD', 240, 4, '#a5a5b8');
  const k = a => codesFor(game.settings.keys, a).map(keyNameMini).join(' ');
  const l1 = `${k('left')} ${k('right')} MOVE  ${k('shoot')} SHOOT  ${k('jump')} JUMP  ${k('down')} CROUCH`;
  mini(g, l1, miniX(l1), 208, '#a5a5b8');
  const l2 = `M MUTE  ${k('pause')} PAUSE`;
  mini(g, l2, miniX(l2), 216, '#a5a5b8');
}

export function drawScroll(game, g, lines, kind) {
  g.fillStyle = kind === 'ending' ? '#2d1f4c' : '#0e0a18'; g.fillRect(0, 0, W, H);
  if (kind === 'ending') { drawBackground(g, game.assets.backgrounds.candyforest, game.stateT * 8, W, H); g.fillStyle = 'rgba(14,10,24,0.55)'; g.fillRect(0, 0, W, H); }
  // 実測幅で折り返してから表示（1 行は 240px 以内）
  const wrapped = lines.flatMap(l => l === '' ? [''] : wrap(g, l, LAYOUT.W - LAYOUT.MARGIN * 2));
  const shown = Math.min(wrapped.length, Math.floor(game.stateT / 0.9) + 1);
  const total = wrapped.length * LAYOUT.LINE;
  const y0 = kind === 'ending' ? Math.max(8, 100 - game.stateT * 6) : Math.max(8, Math.floor((LAYOUT.H - 30 - total) / 2));
  for (let i = 0; i < shown; i++) text(g, wrapped[i], 128, y0 + i * LAYOUT.LINE, { align: 'center', color: i === wrapped.length - 1 && kind === 'ending' ? '#ffe860' : '#fdfbf7' });
  if (kind === 'ending' && game.stateT > 4) { { const t = 'SCORE ' + String(game.score).padStart(7, '0'); mini(g, t, miniX(t), 190, '#ff8fc8'); } }
  if (shown >= lines.length && Math.floor(game.stateT * 2) % 2) mini(g, 'PUSH START', miniX('PUSH START'), 210, '#ffe860');
}

export function drawEnding(game, g) {
  const scenes = game.endingScenes(), i = game.endingIdx ?? 0;
  if (i < scenes.length) {
    const sc = scenes[i];
    g.fillStyle = '#0e0a18'; g.fillRect(0, 0, W, H);
    if (sc.img) { // 生成イラスト（1 セル = 1 世界単位 = 3 px、SNES 実解像度）。中央を 256×224 に切り出す
      const r = sc.img.r, sx = Math.max(0, Math.floor((r.width - W) / 2)), sy = Math.max(0, Math.floor((r.height - H) / 2));
      const k = Math.min(1, game.stateT / 0.6); g.globalAlpha = k; g.drawImage(r, sx, sy, Math.min(W, r.width), Math.min(H, r.height), 0, 0, Math.min(W, r.width), Math.min(H, r.height)); g.globalAlpha = 1;
    } else drawBackground(g, game.assets.backgrounds.candyforest, game.stateT * 8, W, H);
    // 本文（下部の帯）
    const shown = Math.min(sc.lines.length, Math.floor(game.stateT / 0.9) + 1);
    g.fillStyle = 'rgba(14,10,24,0.72)'; g.fillRect(0, H - 8 - shown * LAYOUT.LINE - 8, W, shown * LAYOUT.LINE + 16);
    for (let k = 0; k < shown; k++) text(g, sc.lines[k], 128, H - 8 - (shown - k) * LAYOUT.LINE, { align: 'center', color: i === scenes.length - 1 && k === sc.lines.length - 1 ? '#ffe860' : '#fdfbf7' });
    const t = `${i + 1} / ${scenes.length}`; mini(g, t, W - 8 - t.length * MINI_W, 4, '#a5a5b8');
    return;
  }
  // クレジット: 下から上へスクロール
  g.fillStyle = '#0e0a18'; g.fillRect(0, 0, W, H);
  const y0 = H - game.stateT * 14;
  const CREDITS = story().credits;
  CREDITS.forEach((line, k) => { const y = y0 + k * LAYOUT.LINE; if (y > -20 && y < H + 20) text(g, line, 128, y, { align: 'center', color: k === 0 || line === 'THANK YOU FOR PLAYING' ? '#ff8fc8' : '#fdfbf7', size: line === CREDITS[0] ? 16 : 12 }); });
  const sc = 'SCORE ' + String(game.score).padStart(7, '0'); mini(g, sc, miniX(sc), 4, '#ff8fc8');
}

export function drawIntro(game, g) {
  g.fillStyle = 'rgba(14,10,24,0.6)'; g.fillRect(0, 0, W, H);
  const st = STAGES[game.stageIndex];
  textBox(g, [{ t: t(st.title), color: '#ff8fc8' }, { t: t(st.subtitle) }], { minWidth: 224 });
}

export function drawPause(game, g) {
  const menu = game.pauseMenu(), rows = [{ t: 'PAUSE', color: '#ffe860' }, { t: ' ', size: 6 }, ...menu.map((m, i) => ({ t: (i === game.pauseIdx ? '▶ ' : '　 ') + m.label, color: i === game.pauseIdx ? '#ffe860' : '#fdfbf7' }))];
  textBox(g, rows, { minWidth: 176 });
}

export function drawClear(game, g) {
  if (game.stateT < 1.2) return;
  const r = textBox(g, [{ t: t('ステージクリア！'), color: '#ffe860' }, { t: ' ', size: 14 }, { t: t(game.stageIndex + 1 < STAGES.length ? '次の章へ…' : '最終決戦へ…'), color: '#cbaaf5' }], { minWidth: 192 });
  const tb = 'TIME BONUS   ' + String(game.timeBonus).padStart(5, '0'), nm = 'NO MISS      ' + (game.noMissBonus ? String(game.noMissBonus).padStart(5, '0') : '  ---'), kl = 'KILLS        ' + String(game.kills ?? 0).padStart(5, ' '), sc = 'SCORE      ' + String(game.score).padStart(7, '0');
  mini(g, tb, miniX(tb), r.y + 30, '#fdfbf7');
  mini(g, nm, miniX(nm), r.y + 39, game.noMissBonus ? '#ffe860' : '#a5a5b8');
  mini(g, kl, miniX(kl), r.y + 48, '#fdfbf7');
  mini(g, sc, miniX(sc), r.y + 57, '#ff8fc8');
}

export function drawGameOver(game, g) {
  g.fillStyle = 'rgba(122,15,31,0.45)'; g.fillRect(0, 0, W, H);
  const menu = game.gameOverMenu(), shown = game.stateT > 1.0;
  const rows = [{ t: 'GAME OVER', color: '#ff6a6a' }, { t: t('おとぎの国は赤いまま') }, { t: ' ', size: 6 }, ...(shown ? menu.map((m, i) => ({ t: (i === game.goIdx ? '▶ ' : '　 ') + m.label, color: i === game.goIdx ? '#ffe860' : '#fdfbf7' })) : []), { t: ' ', size: 6 }];
  const r = textBox(g, rows, { minWidth: 208, window: { top: '#3a1650', bottom: '#150a22' } });
  const sc = 'SCORE ' + String(game.score).padStart(7, '0') + (game.continued ? '  (CONTINUE)' : '');
  mini(g, sc, miniX(sc), r.y + r.h - 12, '#fdfbf7');
}
