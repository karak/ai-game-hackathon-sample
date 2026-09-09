import { World, W, H } from './world.js';
import { STAGES } from './levels/index.js';
import { drawWindow, text, mini, drawHud, textBox, wrap, LAYOUT, MINI_W, rowHeight } from './ui/index.js';
const miniX = str => Math.round(128 - str.length * MINI_W / 2); // ミニフォントの中央揃え x
import { SONGS } from './audio.js';
import { drawBackground } from './gfx/background.js';
import { blit } from './gfx/sprite.js';
import { drawBackgroundHD } from './gfx/hdworld.js';
import { PROLOGUE, ENDING, ENDING_SCENES, ENDING_TRUE, CREDITS } from './story.js';
import { irisRadius, IRIS_T, BOSS_INTRO_T } from './fx.js';
import { DemoRecorder, DemoInput, DEMO_MAX_T, DEMO_IDLE_T } from './demo.js';
import { DEMOS } from './demos.js';
import { hashSeed } from './util.js';
import { loadDeathLog, saveDeathLog, pushDeath } from './deathlog.js';
import { defaultSettings, saveSettings, volumeGain, bind, codesFor, keyName, keyNameMini, padName, REBINDABLE, ACTION_LABEL, VOLUME_MAX, DEFAULT_KEYS, DEFAULT_PAD } from './settings.js';

// オプション画面の行。kind: volume / mute / key(action) / reset / back
export const NO_MISS_BONUS = 5000; // クリア画面: 面をノーミスで抜けたときの加点
const OPTION_ROWS = [{ kind: 'volume' }, { kind: 'mute' }, ...REBINDABLE.map(a => ({ kind: 'key', action: a })), { kind: 'reset' }, { kind: 'back' }];

export class Game {
  // settings: settings.js の loadSettings() 結果。storage は保存先（省略時 localStorage）
  constructor(assets, audio, input, settings = null, storage = globalThis.localStorage) {
    this.assets = assets; this.audio = audio; this.input = input;
    this.settings = settings ?? defaultSettings(); this.storage = storage;
    this.state = 'title'; this.stateT = 0;
    this.score = 0; this.lives = 2; this.stageIndex = 0; this.world = null;
    this.titleBg = assets.backgrounds.graveyard; this.titleCam = 0;
    this.hi = this.settings.hi;
    this.paused = false; this.textIdx = 0;
    this.menuIdx = 0; this.optIdx = 0; this.capturing = null; // タイトルメニュー / オプションのカーソル、キー割り当て待ちの操作名
    this.recorder = null; this.demo = null; this.demoIdx = 0; // デモ記録／再生
    this.deathLog = loadDeathLog(this.storage); this.loop = 0; this.continued = false; // 死亡地点ログ（IMP-007）／周回（0=1 周目）／コンティニュー後はハイスコアに記録しない
    this.audio.setVolume(volumeGain(this.settings.volume)); this.audio.setMuted(this.settings.muted);
  }
  setState(s) { (this.trace ??= []).push(`${this.state}>${s}@${Math.round(performance.now())}`); if (this.trace.length > 20) this.trace.shift(); this.state = s; this.stateT = 0; }
  save() { return saveSettings(this.settings, this.storage); }
  // タイトルメニュー項目（進行があれば「つづきから」）
  titleMenu() { const m = [{ id: 'new', label: 'はじめから' }]; if (this.settings.progress.stage > 0) m.push({ id: 'continue', label: `つづきから（第${this.settings.progress.stage + 1}章）` }); if (this.settings.progress.cleared) m.push({ id: 'loop2', label: '2 周目（真の結末）' }); m.push({ id: 'options', label: 'オプション' }); return m; }
  // ポーズメニュー／ゲームオーバーメニュー
  pauseMenu() { return [{ id: 'resume', label: 'つづける' }, { id: 'restart', label: '面の はじめから' }, { id: 'title', label: 'タイトルへ' }]; }
  gameOverMenu() { return [{ id: 'continue', label: 'コンティニュー（面の はじめから）' }, { id: 'title', label: 'タイトルへ' }]; }

  // ---- 遷移 ----
  startGame(stage = 0, loop = 0) {
    this.score = 0; this.lives = 2; this.stageIndex = Math.max(0, Math.min(STAGES.length - 1, stage)); this.loop = loop; this.continued = false;
    if (this.stageIndex === 0) { this.setState('prologue'); this.textIdx = 0; this.audio.playBgm(SONGS.title); }
    else this.startStage();
  }
  startStage() {
    this.world = new World(this, STAGES[this.stageIndex]);
    this.setState('intro'); this.audio.playJingle(SONGS.jStart); this.irisT = 0; // アイリスが開く。開始ジングル → play でテーマ曲
  }
  // アイリスワイプで閉じてから then() を実行する（画面遷移）
  startWipe(then) { if (this.state === 'wipe') return; this.wipe = { from: this.state, t: 0, then }; this.setState('wipe'); }
  gameOver() { if (this.state === 'demo') { this.endDemo(); return; } this.setState('gameover'); this.goIdx = 0; this.audio.playJingle(SONGS.jGameOver); this.saveHi(); }
  // コンティニュー: 面の先頭からスコア 0 で再開。回数無制限、ハイスコアには記録しない（05-systems 5.1）
  continueGame() { this.continued = true; this.score = 0; this.lives = 2; this.startStage(); }
  stageClear() {
    if (this.state === 'demo') { this.endDemo(); return; }
    this.timeBonus = Math.ceil(this.world.time) * 10; this.noMissBonus = this.world.deaths === 0 ? NO_MISS_BONUS : 0; this.kills = this.world.kills;
    this.score += this.timeBonus + this.noMissBonus; this.setState('clear'); this.audio.playJingle(SONGS.jClear);
    // 進行を保存（次章から「つづきから」で再開できる）
    if (this.stageIndex + 1 < STAGES.length && this.stageIndex + 1 > this.settings.progress.stage) { this.settings.progress.stage = this.stageIndex + 1; this.save(); }
  }
  // 死亡地点を記録（デモ中は記録しない）。座標は世界単位、t は面の経過秒
  logDeath(reason) {
    if (this.state === 'demo' || !this.world) return;
    const p = this.world.player;
    this.deathLog = pushDeath(this.deathLog, { s: STAGES[this.stageIndex].name, x: p.centerX, y: p.y + p.h, r: reason, t: this.world.t, l: this.loop, at: Date.now() });
    saveDeathLog(this.deathLog, this.storage);
  }
  saveHi() { if (this.continued) return; if (this.score > this.hi) { this.hi = this.score; this.settings.hi = this.hi; this.save(); } }
  toggleMute() { this.settings.muted = this.audio.toggleMute(); this.save(); }

  update(dt) {
    const inp = this.input; this.stateT += dt;
    if (inp.hit('mute')) this.toggleMute();
    switch (this.state) {
      case 'title': {
        this.titleCam += dt * 20;
        if (inp.anyKey) this.stateT = 0;
        if (this.stateT > DEMO_IDLE_T && this.startDemo()) break; // 放置でデモ
        const menu = this.titleMenu();
        if (inp.hit('up')) { this.menuIdx = (this.menuIdx + menu.length - 1) % menu.length; this.audio.sfx('select'); }
        if (inp.hit('down')) { this.menuIdx = (this.menuIdx + 1) % menu.length; this.audio.sfx('select'); }
        this.menuIdx = Math.min(this.menuIdx, menu.length - 1);
        if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) {
          this.audio.sfx('select');
          const sel = menu[this.menuIdx].id;
          if (sel === 'new') this.startGame(0);
          else if (sel === 'continue') this.startGame(this.settings.progress.stage);
          else if (sel === 'loop2') this.startGame(0, 1);
          else { this.optIdx = 0; this.capturing = null; this.setState('options'); }
        }
        break;
      }
      case 'options': this.updateOptions(inp); break;
      case 'demo': {
        if (inp.anyKey || inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) { this.endDemo(); break; }
        const d = this.demo; d.t += dt;
        this.world.update(dt, d.input); d.input.next();
        if (d.input.done || d.t > DEMO_MAX_T || this.state !== 'demo') { if (this.state === 'demo') { if (!this.startDemo(this.demoIdx + 1)) this.endDemo(); } }
        break;
      }
      case 'wipe':
        this.wipe.t += dt;
        if (this.wipe.from === 'clear' && this.wipe.t < IRIS_T) this.world.update(dt, inp);
        if (this.wipe.t >= IRIS_T) { const w = this.wipe; this.wipe = null; w.then(); }
        break;
      case 'prologue':
        if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) { if (this.stateT < PROLOGUE.length * 0.9) this.stateT = PROLOGUE.length * 0.9 + 0.1; else this.startStage(); }
        break;
      case 'intro':
        if (this.stateT > 2.8 || (this.stateT > 0.5 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')))) { this.setState('play'); this.audio.playBgm(SONGS[this.world.level.theme]); }
        break;
      case 'play':
        if (inp.hit('pause') || (inp.hit('start') && !this.paused)) { this.paused = !this.paused; this.pauseIdx = 0; this.audio.sfx('select'); } // パッドの START でもポーズ
        if (this.paused) { // ポーズメニュー: つづける／面の先頭から／タイトルへ
          const menu = this.pauseMenu();
          if (inp.hit('up')) { this.pauseIdx = (this.pauseIdx + menu.length - 1) % menu.length; this.audio.sfx('select'); }
          if (inp.hit('down')) { this.pauseIdx = (this.pauseIdx + 1) % menu.length; this.audio.sfx('select'); }
          if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) {
            const sel = menu[this.pauseIdx].id; this.paused = false; this.audio.sfx('select');
            if (sel === 'restart') this.startWipe(() => this.startStage());
            else if (sel === 'title') this.startWipe(() => { this.world = null; this.setState('title'); this.audio.playBgm(SONGS.title); });
          }
          break;
        }
        this.debugKeys(inp);
        this.irisT += dt;
        if (this.recorder) this.recorder.record(inp);
        this.world.update(dt, inp);
        break;
      case 'clear':
        if (this.stateT < 3.5) this.world.update(dt, inp);
        if (this.stateT > 2 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) || this.stateT > 7) {
          this.startWipe(() => {
            this.stageIndex++;
            if (this.stageIndex >= STAGES.length) { this.setState('ending'); this.endingIdx = 0; this.audio.playBgm(SONGS.ending); this.saveHi(); if (!this.settings.progress.cleared) { this.settings.progress.cleared = true; this.save(); } } // 1 周クリアで 2 周目を開放
            else this.startStage();
          });
        }
        break;
      case 'gameover':
        if (this.stateT > 1.0) {
          const menu = this.gameOverMenu();
          if (inp.hit('up')) { this.goIdx = (this.goIdx + menu.length - 1) % menu.length; this.audio.sfx('select'); }
          if (inp.hit('down')) { this.goIdx = (this.goIdx + 1) % menu.length; this.audio.sfx('select'); }
          if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) {
            this.audio.sfx('select');
            if (menu[this.goIdx].id === 'continue') this.startWipe(() => this.continueGame());
            else this.startWipe(() => { this.world = null; this.setState('title'); this.audio.playBgm(SONGS.title); });
          }
        }
        break;
      case 'ending': {
        // 場面 1〜6（各 6 秒、1.5 秒後から入力で送れる）→ クレジット（スクロール）→ タイトル
        const scenes = this.endingScenes();
        const adv = inp.hit('start') || inp.hit('shoot') || inp.hit('jump');
        if (this.endingIdx < scenes.length) { if (this.stateT > 6 || (this.stateT > 1.5 && adv)) { this.endingIdx++; this.stateT = 0; } }
        else if (this.stateT > 2 && (adv || this.stateT > 30)) { this.setState('title'); this.audio.playBgm(SONGS.title); }
        break;
      }
    }
  }

  // ---- デモ（アトラクト）モード ----
  // 入力ログの記録: window.__game.startRecording() → プレイ → stopRecording() が JSON を返す（assets/demo/stageN.json に保存）
  startRecording() { const st = STAGES[this.stageIndex]; this.recorder = new DemoRecorder(st.name, st.seed ?? hashSeed(st.name)); return this.recorder; }
  stopRecording() { const r = this.recorder; this.recorder = null; return r ? r.toJSON() : null; }
  // 未収録（frames 0）を飛ばして i 番目以降のデモを開始。無ければ false
  startDemo(i = 0) {
    for (let k = i; k < DEMOS.length && k < STAGES.length; k++) {
      const d = DEMOS[k]; if (!d || !d.frames) continue;
      this.demoIdx = k; this.score = 0; this.lives = 2; this.stageIndex = k;
      this.world = new World(this, { ...STAGES[k], seed: d.seed });
      this.demo = { input: new DemoInput(d), t: 0 }; this.irisT = 99;
      this.audio.playBgm(SONGS[this.world.level.theme]); this.setState('demo'); return true;
    }
    return false;
  }
  endDemo() { this.demo = null; this.world = null; this.demoIdx = 0; this.setState('title'); this.audio.playBgm(SONGS.title); }
  drawDemo(g) {
    this.world.draw(g); drawHud(g, this.world, this);
    if (Math.floor(this.stateT * 2) % 2) text(g, 'DEMO', 128, 100, { align: 'center', color: '#ffe860' });
    mini(g, 'PUSH ANY KEY', miniX('PUSH ANY KEY'), 118, '#fdfbf7');
  }

  // ---- デバッグキー（A-5 の演出確認用。F1 被弾ヒットストップ / F2 最寄りの敵を撃破 / F3 ボス撃破演出 / F4 アイリスワイプ / F6 ボス登場バナー）----
  debugKeys(inp) {
    const w = this.world, p = w.player;
    if (inp.hit('F1')) { p.invT = 0; p.costume = 'dress'; p.hit({ x: p.x + 20, w: 4 }); }
    if (inp.hit('F2')) { const es = w.enemies.filter(e => !e.dead && e.hp !== undefined && !e.isBoss).sort((a, b) => Math.abs(a.cx - p.centerX) - Math.abs(b.cx - p.centerX)); if (es[0]) es[0].hurt(99, null); else w.fx.killFlash(); }
    if (inp.hit('F3')) { if (w.boss && !w.boss.dying) w.boss.hurt(9999, null); else w.fx.bossDefeat(); }
    if (inp.hit('F4')) this.startWipe(() => { this.setState('play'); this.irisT = 0; });
    if (inp.hit('F6')) w.fx.bossIntro(w.bossName());
  }
  // アイリス（円の外側を黒く塗る）。r は世界単位、中心は主人公
  drawIris(g, r) {
    if (r <= 0) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
    const p = this.world?.player, cam = this.world?.cam ?? { x: 0 };
    const cx = p ? Math.max(0, Math.min(W, p.centerX - Math.floor(cam.x))) : W / 2, cy = p ? Math.max(0, Math.min(H, p.y + p.h / 2)) : H / 2;
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, r, 0, Math.PI * 2, true); g.fillStyle = '#000'; g.fill(); g.restore();
  }
  drawBossIntro(g) {
    const fx = this.world.fx, k = Math.min(1, (BOSS_INTRO_T - fx.introT) / 0.3); // 0.3 秒でバーが降りる
    const bar = Math.floor(28 * k);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    if (k >= 1) textBox(g, [{ t: fx.introName, color: '#ff8fc8' }, { t: 'WARNING', size: 10, color: '#ff6a6a' }], { minWidth: 160, window: { top: '#3a1650', bottom: '#150a22' } });
  }

  // ---- オプション（音量 / ミュート / キー・パッド割り当て） ----
  updateOptions(inp) {
    if (this.capturing) return; // Input.captureNext のコールバック待ち
    const rows = OPTION_ROWS, row = rows[this.optIdx];
    if (inp.hit('up')) { this.optIdx = (this.optIdx + rows.length - 1) % rows.length; this.audio.sfx('select'); }
    if (inp.hit('down')) { this.optIdx = (this.optIdx + 1) % rows.length; this.audio.sfx('select'); }
    if (inp.hit('pause')) { this.leaveOptions(); return; }
    const dir = (inp.hit('right') ? 1 : 0) - (inp.hit('left') ? 1 : 0), ok = inp.hit('start') || inp.hit('shoot') || inp.hit('jump');
    if (row.kind === 'volume' && dir) { this.settings.volume = Math.max(0, Math.min(VOLUME_MAX, this.settings.volume + dir)); this.audio.setVolume(volumeGain(this.settings.volume)); this.audio.sfx('select'); }
    else if (row.kind === 'mute' && (dir || ok)) this.toggleMute();
    else if (row.kind === 'key' && ok) {
      this.capturing = row.action; this.audio.sfx('select');
      this.input.captureNext(r => {
        if (r.type === 'key') { this.settings.keys = bind(this.settings.keys, row.action, r.code); this.input.setKeys(this.settings.keys); }
        else { this.settings.pad = bind(this.settings.pad, row.action, r.code); this.input.setPad(this.settings.pad); }
        this.capturing = null; this.save(); this.audio.sfx('select');
      });
    }
    else if (row.kind === 'reset' && ok) { this.settings.keys = { ...DEFAULT_KEYS }; this.settings.pad = { ...DEFAULT_PAD }; this.input.setKeys(this.settings.keys); this.input.setPad(this.settings.pad); this.save(); this.audio.sfx('select'); }
    else if (row.kind === 'back' && ok) this.leaveOptions();
  }
  leaveOptions() { this.input.cancelCapture(); this.capturing = null; this.save(); this.audio.sfx('select'); this.setState('title'); }
  optionRowText(row) {
    switch (row.kind) {
      case 'volume': return ['おんりょう', `◀ ${'■'.repeat(this.settings.volume)}${'□'.repeat(VOLUME_MAX - this.settings.volume)} ▶`];
      case 'mute': return ['ミュート', this.settings.muted ? 'ON' : 'OFF'];
      case 'key': {
        if (this.capturing === row.action) return [ACTION_LABEL[row.action], 'キー か ボタン を おしてください'];
        const k = codesFor(this.settings.keys, row.action).map(keyName).join(' '), p = codesFor(this.settings.pad, row.action).map(padName).join(' ');
        return [ACTION_LABEL[row.action], `${k || '--'}  /  PAD ${p || '--'}`];
      }
      case 'reset': return ['そうさを しょきかに もどす', ''];
      case 'back': return ['タイトルへ もどる', ''];
    }
  }
  drawOptions(g) {
    g.fillStyle = '#0e0a18'; g.fillRect(0, 0, W, H);
    const rows = OPTION_ROWS, line = LAYOUT.LINE, pad = LAYOUT.PAD;
    const x = LAYOUT.MARGIN, w = LAYOUT.W - LAYOUT.MARGIN * 2, h = pad * 2 + rowHeight(LAYOUT.FONT) + 6 + rows.length * line;
    const y = Math.floor((LAYOUT.H - h) / 2);
    drawWindow(g, x, y, w, h);
    text(g, 'オプション', 128, y + pad, { align: 'center', color: '#ff8fc8' });
    let cy = y + pad + rowHeight(LAYOUT.FONT) + 6;
    rows.forEach((row, i) => {
      const [label, value] = this.optionRowText(row), sel = i === this.optIdx;
      const color = sel ? '#ffe860' : '#fdfbf7';
      if (sel) text(g, '▶', x + pad - 2, cy, { color });
      text(g, label, x + pad + 12, cy, { color });
      if (value) text(g, value, x + w - pad, cy, { align: 'right', color: sel && this.capturing ? '#ff8fc8' : color, size: 12 });
      cy += line;
    });
    const hint = this.input.padConnected ? 'PAD OK  UP/DOWN SELECT  A/B OK  START BACK' : 'UP/DOWN SELECT  ENTER OK  ESC BACK';
    mini(g, hint, miniX(hint), y + h + 6, '#a5a5b8');
  }

  draw(g) { this.drawState(g, this.state); }
  drawState(g, state) {
    switch (state) {
      case 'title': this.drawTitle(g); break;
      case 'options': this.drawOptions(g); break;
      case 'demo': this.drawDemo(g); break;
      case 'wipe': this.drawState(g, this.wipe.from); this.drawIris(g, irisRadius(this.wipe.t, false, W, H)); break;
      case 'prologue': this.drawScroll(g, PROLOGUE, 'prologue'); break;
      case 'intro': this.world.draw(g); this.drawIris(g, irisRadius(this.stateT, true, W, H)); this.drawIntro(g); break;
      case 'play':
        this.world.draw(g); drawHud(g, this.world, this);
        if (this.world.fx.introActive) this.drawBossIntro(g);
        if (this.irisT < IRIS_T) this.drawIris(g, irisRadius(this.irisT, true, W, H));
        if (this.paused) this.drawPause(g);
        break;
      case 'clear': this.world.draw(g); drawHud(g, this.world, this); this.drawClear(g); break;
      case 'gameover': if (this.world) this.world.draw(g); this.drawGameOver(g); break;
      case 'ending': this.drawEnding(g); break;
    }
  }

  drawTitle(g) {
    const gen = this.assets.generated ?? {};
    if (gen.bg?.graveyard_sky) drawBackgroundHD(g, { sky: gen.bg.graveyard_sky, far: [gen.bg.graveyard_far, gen.bg.graveyard_far2].filter(Boolean), mid: [gen.bg.graveyard_mid, gen.bg.graveyard_mid2, gen.bg.graveyard_mid3].filter(Boolean) }, this.titleCam, W, H);
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
    // メニュー（はじめから / つづきから / オプション）。主人公の帽子の上端（y≈140、計測値）に掛からないよう下端を 131 に
    const menu = this.titleMenu(), mh = menu.length * 14, my = 131 - mh;
    menu.forEach((m, i) => {
      const sel = i === this.menuIdx, color = sel ? '#ffe860' : '#fdfbf7';
      if (sel && Math.floor(this.stateT * 4) % 4 !== 3) text(g, '▶', 128 - 56, my + i * 14, { color });
      text(g, m.label, 128 - 44, my + i * 14, { color });
    });
    mini(g, 'HI ' + String(this.hi).padStart(7, '0'), 4, 4, '#a5a5b8');
    if (this.input.padConnected) mini(g, 'PAD', 240, 4, '#a5a5b8');
    const k = a => codesFor(this.settings.keys, a).map(keyNameMini).join(' ');
    const l1 = `${k('left')} ${k('right')} MOVE  ${k('shoot')} SHOOT  ${k('jump')} JUMP  ${k('down')} CROUCH`;
    mini(g, l1, miniX(l1), 208, '#a5a5b8');
    const l2 = `M MUTE  ${k('pause')} PAUSE`;
    mini(g, l2, miniX(l2), 216, '#a5a5b8');
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
  // ---- エンディング ----
  endingScenes() { const E = this.assets.generated?.ending ?? {}; const scenes = ENDING_SCENES.map((lines, i) => ({ lines, img: E['scene' + (i + 1)] })); if (this.loop > 0) scenes.push({ lines: ENDING_TRUE, img: E.scene7 ?? E.scene5 }); return scenes; } // 2 周目は「真の結末」1 場面を追加
  drawEnding(g) {
    const scenes = this.endingScenes(), i = this.endingIdx ?? 0;
    if (i < scenes.length) {
      const sc = scenes[i];
      g.fillStyle = '#0e0a18'; g.fillRect(0, 0, W, H);
      if (sc.img) { // 生成イラスト（1 セル = 1 世界単位 = 3 px、SNES 実解像度）。中央を 256×224 に切り出す
        const r = sc.img.r, sx = Math.max(0, Math.floor((r.width - W) / 2)), sy = Math.max(0, Math.floor((r.height - H) / 2));
        const k = Math.min(1, this.stateT / 0.6); g.globalAlpha = k; g.drawImage(r, sx, sy, Math.min(W, r.width), Math.min(H, r.height), 0, 0, Math.min(W, r.width), Math.min(H, r.height)); g.globalAlpha = 1;
      } else drawBackground(g, this.assets.backgrounds.candyforest, this.stateT * 8, W, H);
      // 本文（下部の帯）
      const shown = Math.min(sc.lines.length, Math.floor(this.stateT / 0.9) + 1);
      g.fillStyle = 'rgba(14,10,24,0.72)'; g.fillRect(0, H - 8 - shown * LAYOUT.LINE - 8, W, shown * LAYOUT.LINE + 16);
      for (let k = 0; k < shown; k++) text(g, sc.lines[k], 128, H - 8 - (shown - k) * LAYOUT.LINE, { align: 'center', color: i === scenes.length - 1 && k === sc.lines.length - 1 ? '#ffe860' : '#fdfbf7' });
      const t = `${i + 1} / ${scenes.length}`; mini(g, t, W - 8 - t.length * MINI_W, 4, '#a5a5b8');
      return;
    }
    // クレジット: 下から上へスクロール
    g.fillStyle = '#0e0a18'; g.fillRect(0, 0, W, H);
    const y0 = H - this.stateT * 14;
    CREDITS.forEach((line, k) => { const y = y0 + k * LAYOUT.LINE; if (y > -20 && y < H + 20) text(g, line, 128, y, { align: 'center', color: k === 0 || line === 'THANK YOU FOR PLAYING' ? '#ff8fc8' : '#fdfbf7', size: line === CREDITS[0] ? 16 : 12 }); });
    const sc = 'SCORE ' + String(this.score).padStart(7, '0'); mini(g, sc, miniX(sc), 4, '#ff8fc8');
  }

  drawIntro(g) {
    g.fillStyle = 'rgba(14,10,24,0.6)'; g.fillRect(0, 0, W, H);
    const st = STAGES[this.stageIndex];
    textBox(g, [{ t: st.title, color: '#ff8fc8' }, { t: st.subtitle }], { minWidth: 224 });
  }
  drawPause(g) {
    const menu = this.pauseMenu(), rows = [{ t: 'PAUSE', color: '#ffe860' }, { t: ' ', size: 6 }, ...menu.map((m, i) => ({ t: (i === this.pauseIdx ? '▶ ' : '　 ') + m.label, color: i === this.pauseIdx ? '#ffe860' : '#fdfbf7' }))];
    textBox(g, rows, { minWidth: 176 });
  }
  drawClear(g) {
    if (this.stateT < 1.2) return;
    const r = textBox(g, [{ t: 'ステージクリア！', color: '#ffe860' }, { t: ' ', size: 14 }, { t: this.stageIndex + 1 < STAGES.length ? '次の章へ…' : '最終決戦へ…', color: '#cbaaf5' }], { minWidth: 192 });
    const tb = 'TIME BONUS   ' + String(this.timeBonus).padStart(5, '0'), nm = 'NO MISS      ' + (this.noMissBonus ? String(this.noMissBonus).padStart(5, '0') : '  ---'), kl = 'KILLS        ' + String(this.kills ?? 0).padStart(5, ' '), sc = 'SCORE      ' + String(this.score).padStart(7, '0');
    mini(g, tb, miniX(tb), r.y + 30, '#fdfbf7');
    mini(g, nm, miniX(nm), r.y + 39, this.noMissBonus ? '#ffe860' : '#a5a5b8');
    mini(g, kl, miniX(kl), r.y + 48, '#fdfbf7');
    mini(g, sc, miniX(sc), r.y + 57, '#ff8fc8');
  }
  drawGameOver(g) {
    g.fillStyle = 'rgba(122,15,31,0.45)'; g.fillRect(0, 0, W, H);
    const menu = this.gameOverMenu(), shown = this.stateT > 1.0;
    const rows = [{ t: 'GAME OVER', color: '#ff6a6a' }, { t: 'おとぎの国は赤いまま' }, { t: ' ', size: 6 }, ...(shown ? menu.map((m, i) => ({ t: (i === this.goIdx ? '▶ ' : '　 ') + m.label, color: i === this.goIdx ? '#ffe860' : '#fdfbf7' })) : []), { t: ' ', size: 6 }];
    const r = textBox(g, rows, { minWidth: 208, window: { top: '#3a1650', bottom: '#150a22' } });
    const sc = 'SCORE ' + String(this.score).padStart(7, '0') + (this.continued ? '  (CONTINUE)' : '');
    mini(g, sc, miniX(sc), r.y + r.h - 12, '#fdfbf7');
  }
}
