import { World, W, H } from './world.js';
import { STAGES } from './levels/index.js';
import { drawWindow, text, mini, drawHud, textBox, wrap, LAYOUT, MINI_W } from './ui/index.js';
const miniX = str => Math.round(128 - str.length * MINI_W / 2); // ミニフォントの中央揃え x
import { SONGS } from './audio.js';
import { drawBackground } from './gfx/background.js';
import { blit } from './gfx/sprite.js';
import { drawBackgroundHD } from './gfx/hdworld.js';
import { PROLOGUE, ENDING } from './story.js';



export class Game {
  constructor(assets, audio, input) {
    this.assets = assets; this.audio = audio; this.input = input;
    this.state = 'title'; this.stateT = 0;
    this.score = 0; this.lives = 2; this.stageIndex = 0; this.world = null;
    this.titleBg = assets.backgrounds.graveyard; this.titleCam = 0;
    this.hi = Number(localStorage.getItem('lyrica_hi') ?? 0) || 0;
    this.paused = false; this.textIdx = 0;
  }
  setState(s) { (this.trace ??= []).push(`${this.state}>${s}@${Math.round(performance.now())}`); if (this.trace.length > 20) this.trace.shift(); this.state = s; this.stateT = 0; }

  // ---- 遷移 ----
  startGame() {
    this.score = 0; this.lives = 2; this.stageIndex = 0;
    this.setState('prologue'); this.textIdx = 0;
    this.audio.playBgm(SONGS.title);
  }
  startStage() {
    this.world = new World(this, STAGES[this.stageIndex]);
    this.setState('intro'); this.audio.stopBgm();
  }
  gameOver() { this.setState('gameover'); this.audio.stopBgm(); this.audio.sfx('bossdie'); this.saveHi(); }
  stageClear() { this.timeBonus = Math.ceil(this.world.time) * 10; this.score += this.timeBonus; this.setState('clear'); this.audio.sfx('clear'); }
  saveHi() { if (this.score > this.hi) { this.hi = this.score; try { localStorage.setItem('lyrica_hi', String(this.hi)); } catch {} } }

  update(dt) {
    const inp = this.input; this.stateT += dt;
    if (inp.hit('mute')) this.audio.toggleMute();
    switch (this.state) {
      case 'title':
        this.titleCam += dt * 20;
        if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) { this.audio.sfx('select'); this.startGame(); }
        break;
      case 'prologue':
        if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) { if (this.stateT < PROLOGUE.length * 0.9) this.stateT = PROLOGUE.length * 0.9 + 0.1; else this.startStage(); }
        break;
      case 'intro':
        if (this.stateT > 2.8 || (this.stateT > 0.5 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')))) { this.setState('play'); this.audio.playBgm(SONGS[this.world.level.theme]); }
        break;
      case 'play':
        if (inp.hit('pause')) { this.paused = !this.paused; this.audio.sfx('select'); }
        if (this.paused) break;
        this.world.update(dt, inp);
        break;
      case 'clear':
        if (this.stateT < 3.5) this.world.update(dt, inp);
        if (this.stateT > 2 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) || this.stateT > 7) {
          this.stageIndex++;
          if (this.stageIndex >= STAGES.length) { this.setState('ending'); this.audio.playBgm(SONGS.ending); this.saveHi(); }
          else this.startStage();
        }
        break;
      case 'gameover':
        if (this.stateT > 1.5 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump'))) { this.setState('title'); this.audio.playBgm(SONGS.title); }
        break;
      case 'ending':
        if (this.stateT > 4 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump'))) { this.setState('title'); this.audio.playBgm(SONGS.title); }
        break;
    }
  }

  draw(g) {
    switch (this.state) {
      case 'title': this.drawTitle(g); break;
      case 'prologue': this.drawScroll(g, PROLOGUE, 'prologue'); break;
      case 'intro': this.world.draw(g); this.drawIntro(g); break;
      case 'play': this.world.draw(g); drawHud(g, this.world, this); if (this.paused) this.drawPause(g); break;
      case 'clear': this.world.draw(g); drawHud(g, this.world, this); this.drawClear(g); break;
      case 'gameover': if (this.world) this.world.draw(g); this.drawGameOver(g); break;
      case 'ending': this.drawScroll(g, ENDING, 'ending'); break;
    }
  }

  drawTitle(g) {
    const gen = this.assets.generated ?? {};
    if (gen.bg?.graveyard_sky) drawBackgroundHD(g, { sky: gen.bg.graveyard_sky, far: [gen.bg.graveyard_far].filter(Boolean), mid: [gen.bg.graveyard_mid, gen.bg.graveyard_mid2, gen.bg.graveyard_mid3].filter(Boolean) }, this.titleCam, W, H);
    else drawBackground(g, this.titleBg, this.titleCam, W, H);
    // 地面の帯（HD タイルがあれば地表＋地中）
    g.fillStyle = '#150a22'; g.fillRect(0, 176, W, 48);
    const strip = gen.tiles?.graveyard;
    if (strip) { const cols = Math.floor(strip.r.width / 48); for (let tx = 0; tx < 16; tx++) { const v = tx % cols; g.drawImage(strip.r, v * 48, 0, 48, 22, tx * 16, 176, 16, 22 / 3); g.drawImage(strip.r, v * 48, Math.round(strip.r.height * 0.52), 48, 48, tx * 16, 176 + 22 / 3, 16, 48 - 22 / 3); } }
    else { const tiles = this.assets.tiles.graveyard; for (let x = 0; x < W; x += 16) { g.drawImage(tiles.top, x, 176); g.drawImage(tiles.ground, x, 192); g.drawImage(tiles.ground, x, 208); } }
    const D = gen.deco ?? {}; for (const [d, x] of [[D.tomb, 40], [D.cross, 205], [D.flowers, 70], [D.blood, 150]]) if (d) blit(g, d, false, x, 176 - d.h);
    // 主人公（生成スプライト、足元を地面 y=176 に）
    const p = this.assets.player.dress.idle; if (p) blit(g, p, false, 128 - p.w / 2, 176 - p.h);
    // ゾンビ
    const z = this.assets.enemies[Math.floor(this.stateT * 4) % 2 ? 'zombie1' : 'zombie2']; if (z) { blit(g, z, true, 190, 176 - z.h); blit(g, z, true, 18, 176 - z.h); }
    // タイトル
    const r = textBox(g, [{ t: 'マジカル☆リリカと', color: '#ff8fc8' }, { t: '血塗られたおとぎの国', color: '#fdfbf7' }, { t: ' ', size: 6 }], { y: 28, minWidth: 224 });
    g.fillStyle = '#d9262b'; g.fillRect(r.x + 24, r.y + r.h - 12, r.w - 48, 1);
    const sub = 'MAGICAL LYRICA AND THE BLOODSTAINED FAIRYLAND';
    mini(g, sub, miniX(sub), r.y + r.h - 10, '#cbaaf5');
    if (Math.floor(this.stateT * 2) % 2) text(g, 'PUSH START', 128, 118, { align: 'center', size: 16, color: '#ffe860' });
    mini(g, 'ENTER / Z / X', miniX('ENTER / Z / X'), 138, '#ffe860');
    mini(g, 'HI ' + String(this.hi).padStart(7, '0'), 4, 4, '#a5a5b8');
    mini(g, 'ARROWS MOVE  Z SHOOT  X JUMP  DOWN CROUCH', miniX('ARROWS MOVE  Z SHOOT  X JUMP  DOWN CROUCH'), 208, '#a5a5b8');
    mini(g, 'M MUTE  P PAUSE', miniX('M MUTE  P PAUSE'), 216, '#a5a5b8');
  }
  drawScroll(g, lines, kind) {
    g.fillStyle = kind === 'ending' ? '#2d1f4c' : '#0e0a18'; g.fillRect(0, 0, W, H);
    if (kind === 'ending') { drawBackground(g, this.assets.backgrounds.candyforest, this.stateT * 8, W, H); g.fillStyle = 'rgba(14,10,24,0.55)'; g.fillRect(0, 0, W, H); }
    // 実測幅で折り返してから表示（1 行は 240px 以内）
    const wrapped = lines.flatMap(l => l === '' ? [''] : wrap(g, l, LAYOUT.W - LAYOUT.MARGIN * 2));
    const shown = Math.min(wrapped.length, Math.floor(this.stateT / 0.9) + 1);
    const total = wrapped.length * LAYOUT.LINE;
    const y0 = kind === 'ending' ? Math.max(8, 100 - this.stateT * 6) : Math.max(8, Math.floor((LAYOUT.H - 30 - total) / 2));
    for (let i = 0; i < shown; i++) text(g, wrapped[i], 128, y0 + i * LAYOUT.LINE, { align: 'center', color: i === wrapped.length - 1 && kind === 'ending' ? '#ffe860' : '#fdfbf7' });
    if (kind === 'ending' && this.stateT > 4) { { const t = 'SCORE ' + String(this.score).padStart(7, '0'); mini(g, t, miniX(t), 190, '#ff8fc8'); } }
    if (shown >= lines.length && Math.floor(this.stateT * 2) % 2) mini(g, 'PUSH START', miniX('PUSH START'), 210, '#ffe860');
  }
  drawIntro(g) {
    g.fillStyle = 'rgba(14,10,24,0.6)'; g.fillRect(0, 0, W, H);
    const st = STAGES[this.stageIndex];
    textBox(g, [{ t: st.title, color: '#ff8fc8' }, { t: st.subtitle }], { minWidth: 224 });
  }
  drawPause(g) { textBox(g, [{ t: 'PAUSE', color: '#ffe860' }], { minWidth: 80 }); }
  drawClear(g) {
    if (this.stateT < 1.2) return;
    const r = textBox(g, [{ t: 'ステージクリア！', color: '#ffe860' }, { t: ' ', size: 14 }, { t: this.stageIndex + 1 < STAGES.length ? '次の章へ…' : '最終決戦へ…', color: '#cbaaf5' }], { minWidth: 192 });
    const tb = 'TIME BONUS ' + String(this.timeBonus).padStart(5, '0'), sc = 'SCORE      ' + String(this.score).padStart(7, '0');
    mini(g, tb, miniX(tb), r.y + 30, '#fdfbf7');
    mini(g, sc, miniX(sc), r.y + 39, '#ff8fc8');
  }
  drawGameOver(g) {
    g.fillStyle = 'rgba(122,15,31,0.45)'; g.fillRect(0, 0, W, H);
    const r = textBox(g, [{ t: 'GAME OVER', color: '#ff6a6a' }, { t: 'おとぎの国は赤いまま' }, { t: ' ', size: 6 }], { minWidth: 176, window: { top: '#3a1650', bottom: '#150a22' } });
    const sc = 'SCORE ' + String(this.score).padStart(7, '0');
    mini(g, sc, miniX(sc), r.y + r.h - 12, '#fdfbf7');
  }
}
