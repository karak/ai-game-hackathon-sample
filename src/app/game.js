import { World } from '../stage/world.js';
import { drawState } from './screens.js';
import { OPTION_ROWS, updateOptions, optionRowText } from './options.js';
import { STAGES } from '../content/levels/index.js';
import { SONGS } from '../platform/audio.js';
import { story } from '../content/story.js';
import { t, setLang } from '../shared/i18n.js';
import { IRIS_T } from '../stage/fx.js';
import { DemoRecorder, DemoInput, DEMO_MAX_T, DEMO_IDLE_T, findDemo } from './demo.js';
import { DEMOS } from '../content/demos.js';
import { hashSeed } from '../shared/util.js';
import { loadDeathLog, saveDeathLog, pushDeath, summarizeDeaths } from './deathlog.js';
import { loadRuns, saveRuns, newRun, pushRun, buildReport } from './runlog.js';
import { BUILD_ID } from '../gfx/loader.js';
import { defaultSettings, saveSettings, volumeGain, DEFAULT_KEYS, DEFAULT_PAD } from './settings.js';
import { log } from '../shared/log.js'; // 構造化ログ（Sprint R）。ctx は ctxSnapshot() を main.js が log.bind() で注入する

export const NO_MISS_BONUS = 5000; // クリア画面: 面をノーミスで抜けたときの加点

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
    this.runs = loadRuns(this.storage); this.run = null; this.reportMsg = null; // 通しプレイの記録（runlog.js、テスター計測）／オプションの「コピーしました」表示
    this.audio.setVolume(volumeGain(this.settings.volume)); this.audio.setMuted(this.settings.muted);
    setLang(this.settings.lang); this.onLangChange = null; // 表示言語（IMP-008）。main.js が index.html の説明文を差し替えるコールバックを置く
  }
  setState(s) { (this.trace ??= []).push(`${this.state}>${s}@${Math.round(performance.now())}`); if (this.trace.length > 20) this.trace.shift(); log.emit('GAME.STATE', `${this.state} > ${s}`, { from: this.state, to: s }); this.state = s; this.stateT = 0; }
  // ログの ctx（LogEvent.ctx）: 進行の現在値のスナップショット。ロガーが毎イベント自動で付ける（呼び手は書かない）
  ctxSnapshot() {
    const w = this.world, p = w?.player, st = STAGES[this.stageIndex];
    const c = { state: this.state, stage: st?.name ?? null, loop: this.loop, lives: this.lives, score: this.score, demo: this.state === 'demo' };
    if (w) { c.t_stage = Math.round(w.t * 10) / 10; c.costume = p?.costume; c.x = Math.round(p?.centerX ?? 0); c.y = Math.round((p?.y ?? 0) + (p?.h ?? 0)); if (w.boss) c.boss = w.level.bosses?.[w.bossIdx] ?? w.level.boss; }
    return c;
  }
  save() { return saveSettings(this.settings, this.storage); }
  // タイトルメニュー項目（進行があれば「つづきから」）
  titleMenu() { const m = [{ id: 'new', label: t('はじめから') }]; if (this.settings.progress.stage > 0) m.push({ id: 'continue', label: t('つづきから（第{n}章）', { n: this.settings.progress.stage + 1 }) }); if (this.settings.progress.cleared) m.push({ id: 'loop2', label: t('2 周目（真の結末）') }); m.push({ id: 'options', label: t('オプション') }); return m; }
  // ポーズメニュー／ゲームオーバーメニュー
  pauseMenu() { return [{ id: 'resume', label: t('つづける') }, { id: 'restart', label: t('面の はじめから') }, { id: 'title', label: t('タイトルへ') }]; }
  gameOverMenu() { return [{ id: 'continue', label: t('コンティニュー（面の はじめから）') }, { id: 'title', label: t('タイトルへ') }]; }

  // ---- 遷移 ----
  startGame(stage = 0, loop = 0) {
    this.score = 0; this.lives = 2; this.stageIndex = Math.max(0, Math.min(STAGES.length - 1, stage)); this.loop = loop; this.continued = false;
    this.finishRun(); this.run = newRun({ loop, start: this.stageIndex, lang: this.settings.lang }); this.runs = pushRun(this.runs, this.run); this.saveRuns();
    log.emit('RUN.START', `run from stage ${this.stageIndex + 1} loop ${loop}`, { start: this.stageIndex, loop, mode: loop > 0 ? 'loop2' : this.stageIndex > 0 ? 'continue' : 'new' });
    if (this.stageIndex === 0) { this.setState('prologue'); this.textIdx = 0; this.audio.playBgm(SONGS.title); }
    else this.startStage();
  }
  startStage() {
    this.world = new World(this, STAGES[this.stageIndex]);
    log.emit('STAGE.START', STAGES[this.stageIndex].name, { stage: STAGES[this.stageIndex].name, index: this.stageIndex });
    this.setState('intro'); this.audio.playJingle(SONGS.jStart); this.irisT = 0; // アイリスが開く。開始ジングル → play でテーマ曲
  }
  // アイリスワイプで閉じてから then() を実行する（画面遷移）
  startWipe(then) { if (this.state === 'wipe') return; this.wipe = { from: this.state, t: 0, then }; this.setState('wipe'); }
  gameOver() { if (this.state === 'demo') { this.endDemo('gameover'); return; } this.setState('gameover'); this.goIdx = 0; this.audio.playJingle(SONGS.jGameOver); this.saveHi(); this.saveRuns(); }
  // ---- 通しプレイの記録（runlog.js）。run は startGame で開き、エンディング到達かタイトル復帰で閉じる ----
  saveRuns() { saveRuns(this.runs, this.storage); }
  finishRun() {
    if (this.run && this.run.end == null) {
      this.run.end = Date.now(); this.saveRuns();
      const r = this.run; log.emit('RUN.END', `reached stage ${r.stage + 1}${r.cleared ? ' cleared' : ''}`, { reached: r.stage, cleared: r.cleared, deaths: r.deaths, continues: r.continues, sec: Math.round((r.end - r.at) / 1000) });
    }
    this.run = null;
  }
  // テスター報告をクリップボードへ（オプション「テスター報告を コピー」）。戻り値は Promise<boolean>
  reportText() {
    const nav = globalThis.navigator, scr = globalThis.screen;
    return buildReport({ runs: this.runs, deaths: this.deathLog, settings: { ...this.settings, keysChanged: JSON.stringify(this.settings.keys) !== JSON.stringify(DEFAULT_KEYS) || JSON.stringify(this.settings.pad) !== JSON.stringify(DEFAULT_PAD) },
      env: { version: BUILD_ID, ua: nav?.userAgent ?? '', lang: nav?.language ?? '', screen: scr ? `${scr.width}x${scr.height}` : '', pad: this.input.padId, touch: typeof window !== 'undefined' && 'ontouchstart' in window }, sid: log.sid, log: log.dump(200), summarizeDeaths, stages: STAGES.length });
  }
  async copyReport() {
    const txt = this.reportText(); let ok = false;
    try { await globalThis.navigator?.clipboard?.writeText(txt); ok = true; } catch { ok = false; }
    this.lastReport = txt; this.reportMsg = { ok, t: 2.5 }; this.audio.sfx('select'); return ok;
  }
  // コンティニュー: 面の先頭からスコア 0 で再開。回数無制限、ハイスコアには記録しない（05-systems 5.1）
  continueGame() { this.continued = true; this.score = 0; this.lives = 2; if (this.run) { this.run.continues++; this.saveRuns(); } log.emit('PLAYER.CONTINUE', STAGES[this.stageIndex].name, { stage: STAGES[this.stageIndex].name }); this.startStage(); }
  stageClear() {
    if (this.state === 'demo') { this.endDemo(); return; }
    this.timeBonus = Math.ceil(this.world.time) * 10; this.noMissBonus = this.world.deaths === 0 ? NO_MISS_BONUS : 0; this.kills = this.world.kills;
    this.score += this.timeBonus + this.noMissBonus; this.setState('clear'); this.audio.playJingle(SONGS.jClear);
    log.emit('STAGE.CLEAR', `${STAGES[this.stageIndex].name} in ${Math.round(this.world.t)}s`, { stage: STAGES[this.stageIndex].name, sec: Math.round(this.world.t), deaths: this.world.deaths, kills: this.kills });
    // 進行を保存（次章から「つづきから」で再開できる）
    if (this.stageIndex + 1 < STAGES.length && this.stageIndex + 1 > this.settings.progress.stage) { this.settings.progress.stage = this.stageIndex + 1; this.save(); }
  }
  // 死亡地点を記録（デモ中は記録しない）。座標は世界単位、t は面の経過秒
  logDeath(reason) {
    if (this.state === 'demo' || !this.world) return;
    const p = this.world.player;
    this.deathLog = pushDeath(this.deathLog, { s: STAGES[this.stageIndex].name, x: p.centerX, y: p.y + p.h, r: reason, t: this.world.t, l: this.loop, at: Date.now() });
    saveDeathLog(this.deathLog, this.storage);
    if (this.run) { this.run.deaths++; this.saveRuns(); }
    log.emit('PLAYER.DEATH', `died: ${reason} at ${STAGES[this.stageIndex].name} (${Math.round(p.centerX)},${Math.round(p.y + p.h)})`, { reason, x: Math.round(p.centerX), y: Math.round(p.y + p.h), by: p.lastHitBy ?? null });
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
        if (d.input.done || d.t > DEMO_MAX_T || this.state !== 'demo') { if (this.state === 'demo') { if (!this.startDemo(this.demoIdx + 1)) this.endDemo('timeout'); } }
        break;
      }
      case 'wipe':
        this.wipe.t += dt;
        if (this.wipe.from === 'clear' && this.wipe.t < IRIS_T) this.world.update(dt, inp);
        if (this.wipe.t >= IRIS_T) { const w = this.wipe; this.wipe = null; w.then(); }
        break;
      case 'prologue':
        if (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) { const n = story().prologue.length; if (this.stateT < n * 0.9) this.stateT = n * 0.9 + 0.1; else this.startStage(); }
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
            else if (sel === 'title') this.startWipe(() => { this.world = null; this.finishRun(); this.setState('title'); this.audio.playBgm(SONGS.title); });
          }
          break;
        }
        this.debugKeys(inp);
        this.irisT += dt; if (this.run) this.run.sec += dt;
        if (this.recorder) this.recorder.record(inp);
        this.world.update(dt, inp);
        break;
      case 'clear':
        if (this.stateT < 3.5) this.world.update(dt, inp);
        if (this.stateT > 2 && (inp.hit('start') || inp.hit('shoot') || inp.hit('jump')) || this.stateT > 7) {
          this.startWipe(() => {
            this.stageIndex++;
            if (this.run) { this.run.stage = Math.max(this.run.stage, Math.min(STAGES.length - 1, this.stageIndex)); if (this.stageIndex >= STAGES.length) this.run.cleared = true; this.saveRuns(); }
            if (this.stageIndex >= STAGES.length) { this.setState('ending'); this.endingIdx = 0; this.audio.playBgm(SONGS.ending); this.saveHi(); this.finishRun(); if (!this.settings.progress.cleared) { this.settings.progress.cleared = true; this.save(); } } // 1 周クリアで 2 周目を開放
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
            else this.startWipe(() => { this.world = null; this.finishRun(); this.setState('title'); this.audio.playBgm(SONGS.title); });
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
  // 2026-09-11 から保存名は面名（assets/demo/<面名>.json）。全面をボットで録るなら node tools/record_demos.mjs（IMP-015）
  startRecording() { const st = STAGES[this.stageIndex]; this.recorder = new DemoRecorder(st.name, st.seed ?? hashSeed(st.name)); return this.recorder; }
  stopRecording() { const r = this.recorder; this.recorder = null; return r ? r.toJSON() : null; }
  // 未収録（frames 0）を飛ばして i 番目以降のデモを開始。無ければ false
  // ログは配列の位置ではなく面名で照合する（findDemo。章の並び替えで位置がずれていた）
  startDemo(i = 0) {
    for (let k = i; k < STAGES.length; k++) {
      const d = findDemo(DEMOS, STAGES[k].name); if (!d) continue;
      this.demoIdx = k; this.score = 0; this.lives = 2; this.stageIndex = k; this.loop = 0; // デモは 1 周目の規則で再生（収録条件と同じ）
      this.world = new World(this, { ...STAGES[k], seed: d.seed });
      this.demo = { input: new DemoInput(d), t: 0 }; this.irisT = 99;
      this.audio.playBgm(SONGS[this.world.level.theme]); this.setState('demo'); log.emit('DEMO.START', STAGES[k].name, { stage: STAGES[k].name }); return true;
    }
    return false;
  }
  endDemo(reason = 'input') { log.emit('DEMO.END', reason, { reason }); this.demo = null; this.world = null; this.demoIdx = 0; this.setState('title'); this.audio.playBgm(SONGS.title); }

  // ---- デバッグキー（A-5 の演出確認用。F1 被弾ヒットストップ / F2 最寄りの敵を撃破 / F3 ボス撃破演出 / F4 アイリスワイプ / F6 ボス登場バナー）----
  debugKeys(inp) {
    const w = this.world, p = w.player;
    if (inp.hit('F1')) { p.invT = 0; p.costume = 'dress'; p.hit({ x: p.x + 20, w: 4 }); }
    if (inp.hit('F2')) { const es = w.enemies.filter(e => !e.dead && e.hp !== undefined && !e.isBoss).sort((a, b) => Math.abs(a.cx - p.centerX) - Math.abs(b.cx - p.centerX)); if (es[0]) es[0].hurt(99, null); else w.fx.killFlash(); }
    if (inp.hit('F3')) { if (w.boss && !w.boss.dying) w.boss.hurt(9999, null); else w.fx.bossDefeat(); }
    if (inp.hit('F4')) this.startWipe(() => { this.setState('play'); this.irisT = 0; });
    if (inp.hit('F6')) w.fx.bossIntro(w.bossName());
  }

  // 表示言語を切り替えて保存する（IMP-008）。index.html の説明文は onLangChange で差し替える
  setLanguage(l) { this.settings.lang = setLang(l); this.save(); this.audio.sfx('select'); this.onLangChange?.(this.settings.lang); }
  // オプション画面の操作・文言・描画は app/options.js、各状態の画面は app/screens.js へ切り出した。ここは委譲だけ（E2E は optionRowText を読む）
  updateOptions(inp) { updateOptions(this, inp); }
  optionRowText(row) { return optionRowText(this, row); }
  draw(g) { drawState(this, g, this.state); }
  optionRow(i) { return OPTION_ROWS[i]; } // オプション行（E2E がカーソル位置の行種を読む）
  leaveOptions() { this.input.cancelCapture(); this.capturing = null; this.save(); this.audio.sfx('select'); this.setState('title'); }


  // ---- エンディング ----
  endingScenes() { const E = this.assets.generated?.ending ?? {}; const st = story(); const scenes = st.scenes.map((lines, i) => ({ lines, img: E['scene' + (i + 1)] })); if (this.loop > 0) scenes.push({ lines: st.trueEnd, img: E.scene7 ?? E.scene5 }); return scenes; } // 2 周目は「真の結末」1 場面を追加

}
