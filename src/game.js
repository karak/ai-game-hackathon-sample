import { World, W, H } from './world.js';
import { STAGES } from './levels/index.js';
import { drawWindow, text, mini, drawHud, fmtTime } from './ui.js';
import { SONGS } from './audio.js';
import { drawBackground } from './gfx/background.js';

const PROLOGUE = [
  'むかしむかし、おとぎの国は',
  'ひとりの魔法少女に',
  '守られていた。',
  '',
  'ある日、彼女は世界を呪った。',
  '花は腐り、うさぎは血を吐き、',
  '砂糖の城は赤く染まった。',
  '',
  '見習い魔女リリカ、15歳。',
  '今日は、その後始末をする日。',
];
const ENDING = [
  '城の奥で、ノワールは',
  '静かに崩れた。',
  '「……ありがとう」',
  'そう聞こえた気がした。',
  '',
  'おとぎの国に朝が来る。',
  '花はまだ腐っているし、',
  '洗濯物は血まみれだけれど。',
  '',
  'リリカは帽子を直して、',
  'ほうきに乗った。',
  '「さ、帰って宿題やろ」',
  '',
  'ＴＨＥ　ＥＮＤ',
];

export class Game {
  constructor(assets, audio, input) {
    this.assets = assets; this.audio = audio; this.input = input;
    this.state = 'title'; this.stateT = 0;
    this.score = 0; this.lives = 2; this.stageIndex = 0; this.world = null;
    this.titleBg = assets.backgrounds.graveyard; this.titleCam = 0;
    this.hi = Number(localStorage.getItem('lyrica_hi') ?? 0) || 0;
    this.paused = false; this.textIdx = 0;
  }
  setState(s) { (this.trace ??= []).push(`${this.state}>${s}@${Math.round(performance.now())}`); this.state = s; this.stateT = 0; }

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
    drawBackground(g, this.titleBg, this.titleCam, W, H);
    // 地面の帯
    g.fillStyle = '#150a22'; g.fillRect(0, 176, W, 48);
    const tiles = this.assets.tiles.graveyard; for (let x = 0; x < W; x += 16) { g.drawImage(tiles.top, x, 176); g.drawImage(tiles.ground, x, 192); g.drawImage(tiles.ground, x, 208); }
    g.drawImage(tiles.deco_t, 40, 160); g.drawImage(tiles.deco_c, 200, 160); g.drawImage(tiles.deco_x, 120, 160); g.drawImage(tiles.deco_f, 70, 160);
    // 主人公
    const p = this.assets.player.dress.idle_stand; g.drawImage(p.r, 120, 152); g.drawImage(this.assets.hat.r, 120, 146);
    // ゾンビ
    const z = this.assets.enemies[Math.floor(this.stateT * 4) % 2 ? 'zombie1' : 'zombie2']; g.drawImage(z.l, 176, 160); g.drawImage(z.l, 22, 160);
    // タイトル
    drawWindow(g, 16, 28, 224, 74);
    text(g, 'マジカル☆リリカと', 128, 36, { align: 'center', color: '#ff8fc8' });
    text(g, '血塗られたおとぎの国', 128, 56, { align: 'center', color: '#fdfbf7' });
    g.fillStyle = '#d9262b'; g.fillRect(60, 78, 136, 1);
    mini(g, 'MAGICAL LYRICA AND THE BLOODSTAINED FAIRYLAND', 128 - 44 * 2, 84, '#cbaaf5');
    if (Math.floor(this.stateT * 2) % 2) text(g, 'PUSH START (Enter / Z / X)', 128, 118, { align: 'center', size: 16, color: '#ffe860' });
    mini(g, 'HI ' + String(this.hi).padStart(7, '0'), 4, 4, '#a5a5b8');
    mini(g, 'ARROWS MOVE  Z SHOOT  X JUMP  DOWN CROUCH', 128 - 41 * 2, 208, '#a5a5b8');
    mini(g, 'M MUTE  P PAUSE', 128 - 15 * 2, 216, '#a5a5b8');
  }
  drawScroll(g, lines, kind) {
    g.fillStyle = kind === 'ending' ? '#2d1f4c' : '#0e0a18'; g.fillRect(0, 0, W, H);
    if (kind === 'ending') { drawBackground(g, this.assets.backgrounds.candyforest, this.stateT * 8, W, H); g.fillStyle = 'rgba(14,10,24,0.55)'; g.fillRect(0, 0, W, H); }
    const shown = Math.min(lines.length, Math.floor(this.stateT / 0.9) + 1);
    const y0 = kind === 'ending' ? Math.max(8, 100 - this.stateT * 6) : 22;
    for (let i = 0; i < shown; i++) text(g, lines[i], 128, y0 + i * 18, { align: 'center', color: i === lines.length - 1 && kind === 'ending' ? '#ffe860' : '#fdfbf7' });
    if (kind === 'ending' && this.stateT > 4) { mini(g, 'SCORE ' + String(this.score).padStart(7, '0'), 128 - 26, 190, '#ff8fc8'); }
    if (shown >= lines.length && Math.floor(this.stateT * 2) % 2) mini(g, 'PUSH START', 128 - 20, 210, '#ffe860');
  }
  drawIntro(g) {
    g.fillStyle = 'rgba(14,10,24,0.6)'; g.fillRect(0, 0, W, H);
    const st = STAGES[this.stageIndex];
    drawWindow(g, 16, 80, 224, 64);
    text(g, st.title, 128, 88, { align: 'center', color: '#ff8fc8' });
    text(g, st.subtitle.length > 14 ? st.subtitle.slice(0, 14) : st.subtitle, 128, 108, { align: 'center', size: 16 });
    if (st.subtitle.length > 14) text(g, st.subtitle.slice(14), 128, 124, { align: 'center', size: 16 });
  }
  drawPause(g) { drawWindow(g, 88, 96, 80, 32); text(g, 'PAUSE', 128, 104, { align: 'center', color: '#ffe860' }); }
  drawClear(g) {
    if (this.stateT < 1.2) return;
    drawWindow(g, 32, 70, 192, 84);
    text(g, 'ステージクリア！', 128, 78, { align: 'center', color: '#ffe860' });
    mini(g, 'TIME BONUS ' + String(this.timeBonus).padStart(5, '0'), 128 - 32, 104, '#fdfbf7');
    mini(g, 'SCORE      ' + String(this.score).padStart(7, '0'), 128 - 36, 114, '#ff8fc8');
    text(g, this.stageIndex + 1 < STAGES.length ? '次の章へ…' : '最終決戦へ…', 128, 128, { align: 'center', size: 16, color: '#cbaaf5' });
  }
  drawGameOver(g) {
    g.fillStyle = 'rgba(122,15,31,0.45)'; g.fillRect(0, 0, W, H);
    drawWindow(g, 40, 80, 176, 64, { top: '#3a1650', bottom: '#150a22' });
    text(g, 'GAME OVER', 128, 88, { align: 'center', color: '#ff6a6a' });
    text(g, 'おとぎの国は赤いまま', 128, 106, { align: 'center', size: 16 });
    mini(g, 'SCORE ' + String(this.score).padStart(7, '0'), 128 - 26, 128, '#fdfbf7');
  }
}
