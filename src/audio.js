// Web Audio によるチップチューン合成。外部素材なし。
// SFX は関数で合成、BGM は簡易シーケンサで矩形波/三角波/ノイズを鳴らす。

export const NOTE = {}; // 'C4' → Hz
{
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flats = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
  for (let o = 1; o <= 7; o++) names.forEach((n, i) => {
    const f = 440 * Math.pow(2, (o - 4) + (i - 9) / 12);
    NOTE[n + o] = f; if (flats[n]) NOTE[flats[n] + o] = f;
  });
}

export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false; this.volume = 0.35; // volume = マスターゲイン（settings.volumeGain で算出）
    this.bgm = null; this.bgmTimer = null;
  }
  ensure() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume; this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.master);
      this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = 0.55; this.bgmBus.connect(this.master);
      // ノイズバッファ
      const len = this.ctx.sampleRate * 1;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch { return false; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  toggleMute() { return this.setMuted(!this.muted); }
  setMuted(m) { this.muted = !!m; this._applyGain(); return this.muted; }
  setVolume(gain) { this.volume = Math.max(0, Math.min(1, gain)); this._applyGain(); }
  _applyGain() { if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }

  // ---- 基本音源 ----
  tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, delay = 0, curve = 'exp', bus = 'sfx' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); else o.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus === 'sfx' ? this.sfxBus : this.bgmBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noiseBurst({ dur = 0.15, vol = 0.3, delay = 0, hp = 200, lp = 8000, bus = 'sfx' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const hpF = this.ctx.createBiquadFilter(); hpF.type = 'highpass'; hpF.frequency.value = hp;
    const lpF = this.ctx.createBiquadFilter(); lpF.type = 'lowpass'; lpF.frequency.value = lp;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(bus === 'sfx' ? this.sfxBus : this.bgmBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ---- 効果音 ----
  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this.tone({ f0: 300, f1: 700, dur: 0.12, vol: 0.2 }); break;
      case 'djump': this.tone({ f0: 500, f1: 1100, dur: 0.14, vol: 0.2 }); this.tone({ type: 'triangle', f0: 800, f1: 1600, dur: 0.14, vol: 0.15, delay: 0.03 }); break;
      case 'shoot': this.tone({ f0: 900, f1: 300, dur: 0.08, vol: 0.18 }); this.noiseBurst({ dur: 0.04, vol: 0.08, hp: 2000 }); break;
      case 'charge': this.tone({ type: 'sawtooth', f0: 200, f1: 1800, dur: 0.5, vol: 0.15 }); break;
      case 'chargeshot': this.tone({ type: 'sawtooth', f0: 1200, f1: 100, dur: 0.35, vol: 0.3 }); this.noiseBurst({ dur: 0.25, vol: 0.2, hp: 400 }); break;
      case 'hit': this.noiseBurst({ dur: 0.06, vol: 0.2, hp: 800 }); this.tone({ f0: 200, f1: 120, dur: 0.06, vol: 0.15 }); break;
      case 'splat': this.noiseBurst({ dur: 0.25, vol: 0.35, hp: 100, lp: 1800 }); this.tone({ type: 'sawtooth', f0: 180, f1: 40, dur: 0.25, vol: 0.25 }); break;
      case 'squish': this.noiseBurst({ dur: 0.18, vol: 0.25, hp: 200, lp: 1200 }); this.tone({ type: 'triangle', f0: 120, f1: 60, dur: 0.18, vol: 0.2 }); break;
      case 'hurt': this.tone({ type: 'sawtooth', f0: 500, f1: 150, dur: 0.3, vol: 0.3 }); this.noiseBurst({ dur: 0.2, vol: 0.2 }); break;
      case 'undress': this.tone({ f0: 800, f1: 300, dur: 0.3, vol: 0.2 }); this.tone({ type: 'triangle', f0: 600, f1: 200, dur: 0.4, vol: 0.2, delay: 0.08 }); break;
      case 'death': [0, 0.12, 0.24, 0.36].forEach((d, i) => this.tone({ f0: 500 - i * 100, f1: 380 - i * 100, dur: 0.14, vol: 0.25, delay: d })); this.noiseBurst({ dur: 0.6, vol: 0.15, delay: 0.4, lp: 900 }); break;
      case 'pickup': [0, 0.06, 0.12].forEach((d, i) => this.tone({ f0: [660, 880, 1320][i], f1: [660, 880, 1320][i], dur: 0.1, vol: 0.2, delay: d })); break;
      case 'dress': [0, 0.08, 0.16, 0.24].forEach((d, i) => this.tone({ type: 'triangle', f0: [523, 659, 784, 1046][i], f1: [523, 659, 784, 1046][i], dur: 0.2, vol: 0.25, delay: d })); break;
      case 'box': this.tone({ f0: 400, f1: 500, dur: 0.06, vol: 0.2 }); this.tone({ f0: 500, f1: 800, dur: 0.1, vol: 0.2, delay: 0.06 }); break;
      case 'boss': this.tone({ type: 'sawtooth', f0: 80, f1: 40, dur: 0.8, vol: 0.35 }); this.noiseBurst({ dur: 0.8, vol: 0.2, lp: 600 }); break;
      case 'bosshit': this.noiseBurst({ dur: 0.1, vol: 0.25, hp: 400 }); this.tone({ type: 'square', f0: 300, f1: 150, dur: 0.1, vol: 0.2 }); break;
      case 'bossdie': for (let i = 0; i < 6; i++) { this.noiseBurst({ dur: 0.3, vol: 0.3, delay: i * 0.15, lp: 1500 }); this.tone({ type: 'sawtooth', f0: 200 - i * 20, f1: 50, dur: 0.3, vol: 0.25, delay: i * 0.15 }); } break;
      case 'poison': this.noiseBurst({ dur: 0.3, vol: 0.12, hp: 3000 }); this.tone({ type: 'triangle', f0: 300, f1: 200, dur: 0.3, vol: 0.12 }); break;
      case 'clear': [0, 0.12, 0.24, 0.36, 0.6].forEach((d, i) => this.tone({ type: 'square', f0: [523, 659, 784, 1046, 1318][i], f1: [523, 659, 784, 1046, 1318][i], dur: i === 4 ? 0.6 : 0.15, vol: 0.22, delay: d })); break;
      case 'select': this.tone({ f0: 1000, f1: 1000, dur: 0.05, vol: 0.15 }); break;
      case 'tick': this.tone({ f0: 1200, f1: 1200, dur: 0.03, vol: 0.1 }); break;
      case 'fire': this.noiseBurst({ dur: 0.2, vol: 0.15, hp: 1000, lp: 4000 }); break;
      // 強化魔法（magic.js SUPER）: superready = 溜めが 2 段階目に達した合図（上昇 3 音）、supermagic = 発動（下降ノイズ＋和音）
      case 'superready': [0, 0.05, 0.1].forEach((d, i) => this.tone({ type: 'triangle', f0: [880, 1174, 1568][i], f1: [880, 1174, 1568][i], dur: 0.12, vol: 0.18, delay: d })); break;
      case 'supermagic':
        this.tone({ type: 'sawtooth', f0: 1600, f1: 80, dur: 0.6, vol: 0.32 }); this.noiseBurst({ dur: 0.5, vol: 0.25, hp: 200, lp: 6000 });
        [0, 0.08, 0.16].forEach((d, i) => this.tone({ type: 'square', f0: [523, 784, 1046][i], f1: [523, 784, 1046][i], dur: 0.45, vol: 0.2, delay: d }));
        break;
    }
  }

  // ---- BGM シーケンサ ----
  // song: { bpm, lead:[...], lead2:[...], bass:[...], arp:[...], drums:[...], waves?:{ch:type}, echo?:{steps,gain} }
  //   lead/lead2/bass の各要素は 16 分音符ごとの 'C4' | '-'(休) | '.'(継続)
  //   arp は和音 'A2 C3 E3'（空白区切り）を書くと 1 ステップごとに構成音を順に鳴らす（アルペジオ）。'-' 休、'.' で前の和音を継続
  //   echo は steps 後に gain 倍で同じ音を重ねる簡易エコー。opts.once で 1 回だけ再生（ジングル）、終わりに opts.then() を呼ぶ
  playBgm(song, opts = {}) {
    if (!this.ctx) return;
    this.stopBgm();
    this.bgm = song; this.bgmStep = 0; this.bgmOpts = opts;
    const stepDur = 60 / song.bpm / 4, total = songSteps(song);
    this.bgmNext = this.ctx.currentTime + 0.05;
    const schedule = () => {
      if (!this.bgm) return;
      while (this.bgmNext < this.ctx.currentTime + 0.25) {
        const s = this.bgmStep;
        if (opts.once && s >= total) { // 1 回再生の終端: 最後の音が鳴り終わってから then()
          const rest = Math.max(0, this.bgmNext - this.ctx.currentTime) * 1000 + 150; this.bgm = null; this.bgmTimer = null;
          if (opts.then) setTimeout(() => { if (!this.bgm) opts.then(); }, rest); return;
        }
        for (const ch of ['lead', 'lead2', 'bass', 'arp']) {
          const seq = song[ch]; if (!seq) continue;
          let n = seq[s % seq.length], len = 1;
          if (ch === 'arp') { n = arpNote(seq, s); if (!n) continue; }
          else { if (!n || n === '-' || n === '.') continue; while (seq[(s + len) % seq.length] === '.' && len < 16) len++; }
          const f = NOTE[n]; if (!f) continue;
          const type = song.waves?.[ch] ?? (ch === 'bass' ? 'triangle' : 'square');
          const vol = CH_VOL[ch];
          this._bgmNote(type, f, this.bgmNext, stepDur * len * 0.9, vol);
          if (song.echo) this._bgmNote(type, f, this.bgmNext + stepDur * song.echo.steps, stepDur * len * 0.9, vol * song.echo.gain);
        }
        if (song.drums) {
          const d = song.drums[s % song.drums.length];
          if (d === 'k') { this.tone({ type: 'sine', f0: 150, f1: 40, dur: 0.12, vol: 0.35, delay: this.bgmNext - this.ctx.currentTime, bus: 'bgm' }); }
          else if (d === 's') { this.noiseBurst({ dur: 0.1, vol: 0.12, delay: this.bgmNext - this.ctx.currentTime, hp: 1500, bus: 'bgm' }); }
          else if (d === 'h') { this.noiseBurst({ dur: 0.03, vol: 0.05, delay: this.bgmNext - this.ctx.currentTime, hp: 6000, bus: 'bgm' }); }
        }
        this.bgmNext += stepDur; this.bgmStep++;
      }
      this.bgmTimer = setTimeout(schedule, 80);
    };
    schedule();
  }
  _bgmNote(type, f, t, dur, vol) {
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.bgmBus); o.start(t); o.stop(t + dur + 0.02);
  }
  stopBgm() { this.bgm = null; if (this.bgmTimer) { clearTimeout(this.bgmTimer); this.bgmTimer = null; } }
  // ジングル: 1 回だけ鳴らし、終わったら then()（例: 面開始 → テーマ曲）
  playJingle(song, then = null) { this.playBgm(song, { once: true, then }); }
}

// チャンネル音量（音量バランス表、05-systems 5.5。BGM バス 0.55 の内訳）
export const CH_VOL = { lead: 0.13, lead2: 0.08, bass: 0.28, arp: 0.07 };
// 曲の長さ（ステップ数）= 最長チャンネル
export function songSteps(song) { return Math.max(0, ...['lead', 'lead2', 'bass', 'arp', 'drums'].map(ch => song[ch]?.length ?? 0)); }
// アルペジオ: 和音列 seq のステップ s で鳴らす 1 音。'.' は直前の和音を継続、'-' は休み
export function arpNote(seq, s) {
  let i = s % seq.length, back = 0;
  while (seq[i] === '.' && back < seq.length) { i = (i - 1 + seq.length) % seq.length; back++; }
  const chord = seq[i]; if (!chord || chord === '-' || chord === '.') return null;
  const notes = chord.split(' ').filter(Boolean); return notes[s % notes.length] ?? null;
}

// ---- 楽曲 ----
const R = '-';
export const SONGS = {
  title: {
    bpm: 96,
    lead: ['E4', '.', 'G4', '.', 'B4', '.', 'A4', '.', 'G4', '.', 'E4', '.', R, R, 'D4', '.',
           'E4', '.', 'G4', '.', 'B4', '.', 'D5', '.', 'C5', '.', 'B4', '.', 'A4', '.', '.', '.',
           'C5', '.', 'B4', '.', 'A4', '.', 'G4', '.', 'A4', '.', 'B4', '.', 'E4', '.', '.', '.',
           'D4', '.', 'E4', '.', 'F#4', '.', 'A4', '.', 'G4', '.', '.', '.', '.', '.', '.', '.'],
    bass: ['E2', '.', '.', '.', 'E2', '.', '.', '.', 'C2', '.', '.', '.', 'C2', '.', '.', '.',
           'D2', '.', '.', '.', 'D2', '.', '.', '.', 'B1', '.', '.', '.', 'B1', '.', '.', '.'],
    drums: ['k', '-', '-', '-', 'h', '-', '-', '-', 'k', '-', '-', '-', 'h', '-', '-', '-'],
  },
  graveyard: {
    bpm: 132,
    lead: ['A4', '.', 'C5', 'B4', 'A4', '.', 'E4', '.', 'F4', '.', 'E4', '.', 'D4', '.', 'E4', '.',
           'A4', '.', 'C5', 'B4', 'A4', '.', 'E5', '.', 'D5', '.', 'C5', '.', 'B4', '.', '.', '.',
           'G4', '.', 'B4', 'A4', 'G4', '.', 'D4', '.', 'E4', '.', 'F4', '.', 'G4', '.', 'E4', '.',
           'F4', '.', 'E4', '.', 'D4', '.', 'C4', '.', 'E4', '.', '.', '.', 'G#4', '.', '.', '.'],
    lead2: ['E4', '.', '.', '.', 'A3', '.', '.', '.', 'D4', '.', '.', '.', 'A3', '.', '.', '.',
            'E4', '.', '.', '.', 'A3', '.', '.', '.', 'F4', '.', '.', '.', 'G#4', '.', '.', '.'],
    bass: ['A2', '.', 'A2', '.', 'A2', '.', 'E2', '.', 'D2', '.', 'D2', '.', 'D2', '.', 'A2', '.',
           'A2', '.', 'A2', '.', 'A2', '.', 'E2', '.', 'F2', '.', 'F2', '.', 'E2', '.', 'E2', '.',
           'G2', '.', 'G2', '.', 'G2', '.', 'D2', '.', 'C2', '.', 'C2', '.', 'C2', '.', 'G2', '.',
           'F2', '.', 'F2', '.', 'D2', '.', 'D2', '.', 'E2', '.', 'E2', '.', 'E2', '.', 'E2', '.'],
    drums: ['k', '-', 'h', '-', 's', '-', 'h', '-', 'k', '-', 'h', 'k', 's', '-', 'h', 'h'],
  },
  candyforest: {
    bpm: 140,
    lead: ['D5', '.', 'F5', '.', 'E5', '.', 'C5', '.', 'D5', '.', 'A4', '.', 'B4', '.', 'C5', '.',
           'D5', '.', 'F5', '.', 'A5', '.', 'G5', '.', 'F5', '.', 'E5', '.', 'D5', '.', '.', '.',
           'C5', '.', 'E5', '.', 'D5', '.', 'B4', '.', 'C5', '.', 'G4', '.', 'A4', '.', 'B4', '.',
           'C5', '.', 'E5', '.', 'G5', '.', 'F5', '.', 'E5', '.', 'C#5', '.', 'D5', '.', '.', '.'],
    lead2: ['A4', '.', '.', '.', 'F4', '.', '.', '.', 'G4', '.', '.', '.', 'A4', '.', '.', '.',
            'G4', '.', '.', '.', 'E4', '.', '.', '.', 'F4', '.', '.', '.', 'A4', '.', '.', '.'],
    bass: ['D2', '.', 'D3', '.', 'D2', '.', 'D3', '.', 'Bb2', '.', 'Bb2', '.', 'G2', '.', 'G2', '.',
           'D2', '.', 'D3', '.', 'D2', '.', 'D3', '.', 'A2', '.', 'A2', '.', 'A2', '.', 'A2', '.',
           'C2', '.', 'C3', '.', 'C2', '.', 'C3', '.', 'G2', '.', 'G2', '.', 'G2', '.', 'G2', '.',
           'F2', '.', 'F3', '.', 'F2', '.', 'F3', '.', 'A2', '.', 'A2', '.', 'A2', '.', 'A2', '.'],
    drums: ['k', 'h', 'h', 'h', 's', 'h', 'h', 'h', 'k', 'h', 'k', 'h', 's', 'h', 's', 'h'],
  },
  castle: {
    bpm: 120,
    lead: ['D4', '.', '.', 'F4', '.', '.', 'A4', '.', 'G#4', '.', '.', '.', 'A4', '.', 'D5', '.',
           'C5', '.', '.', 'A4', '.', '.', 'F4', '.', 'E4', '.', '.', '.', 'D4', '.', '.', '.',
           'D4', '.', '.', 'F4', '.', '.', 'A4', '.', 'Bb4', '.', '.', '.', 'A4', '.', 'F5', '.',
           'E5', '.', '.', 'C#5', '.', '.', 'A4', '.', 'D5', '.', '.', '.', '.', '.', '.', '.'],
    lead2: ['A3', '.', '.', '.', '.', '.', '.', '.', 'Bb3', '.', '.', '.', '.', '.', '.', '.',
            'A3', '.', '.', '.', '.', '.', '.', '.', 'G3', '.', '.', '.', 'A3', '.', '.', '.'],
    bass: ['D2', '.', '.', '.', 'D2', '.', 'D2', '.', 'D2', '.', '.', '.', 'D2', '.', 'D2', '.',
           'Bb1', '.', '.', '.', 'Bb1', '.', 'Bb1', '.', 'A1', '.', '.', '.', 'A1', '.', 'A1', '.',
           'D2', '.', '.', '.', 'D2', '.', 'D2', '.', 'G2', '.', '.', '.', 'G2', '.', 'G2', '.',
           'A1', '.', '.', '.', 'A1', '.', 'A1', '.', 'D2', '.', '.', '.', 'D2', '.', 'D2', '.'],
    drums: ['k', '-', '-', '-', 's', '-', '-', 'h', 'k', '-', 'k', '-', 's', '-', 'h', 'h'],
  },
  river: { // 涙の川: 雨の 6/8 風、ニ短調、ゆっくり
    bpm: 108,
    lead: ['D5', '.', '.', 'F5', '.', 'E5', 'D5', '.', '.', 'A4', '.', '.', 'Bb4', '.', 'A4', '.',
           'G4', '.', '.', 'A4', '.', 'Bb4', 'A4', '.', '.', 'F4', '.', '.', 'E4', '.', '.', '.',
           'D5', '.', '.', 'F5', '.', 'G5', 'A5', '.', '.', 'G5', '.', 'F5', 'E5', '.', 'D5', '.',
           'C#5', '.', '.', 'E5', '.', 'D5', 'C#5', '.', '.', 'A4', '.', '.', 'D5', '.', '.', '.'],
    lead2: ['F4', '.', '.', '.', '.', '.', '.', '.', 'D4', '.', '.', '.', '.', '.', '.', '.',
            'Bb3', '.', '.', '.', '.', '.', '.', '.', 'A3', '.', '.', '.', 'C#4', '.', '.', '.'],
    bass: ['D2', '.', '.', 'A2', '.', '.', 'D2', '.', '.', 'A2', '.', '.', 'Bb2', '.', 'A2', '.',
           'G2', '.', '.', 'D3', '.', '.', 'G2', '.', '.', 'D3', '.', '.', 'A2', '.', 'A2', '.',
           'D2', '.', '.', 'A2', '.', '.', 'D2', '.', '.', 'A2', '.', '.', 'F2', '.', 'G2', '.',
           'A2', '.', '.', 'E3', '.', '.', 'A2', '.', '.', 'E3', '.', '.', 'D2', '.', '.', '.'],
    drums: ['k', '-', 'h', '-', '-', 'h', 's', '-', 'h', '-', '-', 'h', 'k', '-', 's', 'h'],
  },
  workshop: { // 人形工房: 機械のワルツ 3/4 風、ホ短調、オルゴール
    bpm: 126,
    lead: ['E5', '.', 'G5', '.', 'B5', '.', 'A5', '.', 'G5', '.', 'F#5', '.', 'E5', '.', '.', '.',
           'D5', '.', 'F#5', '.', 'A5', '.', 'G5', '.', 'F#5', '.', 'E5', '.', 'D#5', '.', '.', '.',
           'E5', '.', 'G5', '.', 'B5', '.', 'C6', '.', 'B5', '.', 'A5', '.', 'G5', '.', 'F#5', '.',
           'G5', '.', 'F#5', '.', 'E5', '.', 'D#5', '.', 'E5', '.', '.', '.', '.', '.', '.', '.'],
    lead2: ['B4', '.', '.', '.', 'G4', '.', '.', '.', 'A4', '.', '.', '.', 'F#4', '.', '.', '.',
            'B4', '.', '.', '.', 'C5', '.', '.', '.', 'A4', '.', '.', '.', 'B4', '.', '.', '.'],
    bass: ['E2', '.', 'B2', '.', 'B2', '.', 'E2', '.', 'B2', '.', 'B2', '.', 'D2', '.', 'A2', '.',
           'A2', '.', 'D2', '.', 'A2', '.', 'A2', '.', 'B1', '.', 'F#2', '.', 'F#2', '.', 'B1', '.',
           'E2', '.', 'B2', '.', 'B2', '.', 'C2', '.', 'G2', '.', 'G2', '.', 'A2', '.', 'E3', '.',
           'E3', '.', 'B1', '.', 'F#2', '.', 'F#2', '.', 'E2', '.', 'B2', '.', 'B2', '.', 'E2', '.'],
    drums: ['k', '-', 'h', '-', 'h', '-', 'k', '-', 'h', '-', 'h', '-', 's', '-', 'h', 'h'],
  },
  park: { // 骨の遊園地: 壊れたサーカス行進曲、ハ長調→半音下がる
    bpm: 150,
    lead: ['C5', '.', 'E5', '.', 'G5', '.', 'E5', '.', 'C5', '.', 'E5', '.', 'G5', '.', 'C6', '.',
           'B5', '.', 'G5', '.', 'E5', '.', 'G5', '.', 'F5', '.', 'E5', '.', 'D5', '.', '.', '.',
           'C5', '.', 'E5', '.', 'G5', '.', 'E5', '.', 'A5', '.', 'G5', '.', 'F5', '.', 'E5', '.',
           'Eb5', '.', 'D5', '.', 'Db5', '.', 'C5', '.', 'B4', '.', '.', '.', 'C5', '.', '.', '.'],
    lead2: ['E4', '.', '.', '.', 'G4', '.', '.', '.', 'F4', '.', '.', '.', 'G4', '.', '.', '.',
            'E4', '.', '.', '.', 'A4', '.', '.', '.', 'Ab4', '.', '.', '.', 'G4', '.', '.', '.'],
    bass: ['C2', '.', 'G2', '.', 'C2', '.', 'G2', '.', 'C2', '.', 'G2', '.', 'C2', '.', 'G2', '.',
           'G2', '.', 'D3', '.', 'G2', '.', 'D3', '.', 'F2', '.', 'C3', '.', 'G2', '.', 'G2', '.',
           'C2', '.', 'G2', '.', 'C2', '.', 'G2', '.', 'F2', '.', 'C3', '.', 'F2', '.', 'C3', '.',
           'Eb2', '.', 'D2', '.', 'Db2', '.', 'C2', '.', 'G2', '.', 'G2', '.', 'C2', '.', 'C2', '.'],
    drums: ['k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'k', 's', 's'],
  },
  tower: { // 鏡の塔: 冷たいアルペジオ、イ短調、遅い 4/4
    bpm: 100,
    lead: ['A5', '.', 'E5', '.', 'C5', '.', 'E5', '.', 'A5', '.', 'E5', '.', 'C5', '.', 'E5', '.',
           'G#5', '.', 'E5', '.', 'B4', '.', 'E5', '.', 'G#5', '.', 'E5', '.', 'B4', '.', 'D5', '.',
           'F5', '.', 'C5', '.', 'A4', '.', 'C5', '.', 'F5', '.', 'C5', '.', 'A4', '.', 'C5', '.',
           'E5', '.', 'B4', '.', 'G#4', '.', 'B4', '.', 'E5', '.', '.', '.', '.', '.', '.', '.'],
    lead2: ['C4', '.', '.', '.', '.', '.', '.', '.', 'B3', '.', '.', '.', '.', '.', '.', '.',
            'A3', '.', '.', '.', '.', '.', '.', '.', 'G#3', '.', '.', '.', 'B3', '.', '.', '.'],
    bass: ['A2', '.', '.', '.', 'A2', '.', '.', '.', 'E2', '.', '.', '.', 'E2', '.', '.', '.',
           'E2', '.', '.', '.', 'E2', '.', '.', '.', 'B1', '.', '.', '.', 'B1', '.', '.', '.',
           'F2', '.', '.', '.', 'F2', '.', '.', '.', 'C2', '.', '.', '.', 'C2', '.', '.', '.',
           'E2', '.', '.', '.', 'E2', '.', '.', '.', 'A1', '.', '.', '.', 'A1', '.', '.', '.'],
    drums: ['k', '-', '-', '-', 'h', '-', '-', '-', 'k', '-', '-', '-', 'h', '-', 's', '-'],
  },
  stars: { // 星の墓標: 遅い讃美歌風、ニ長調→短調へ揺れる
    bpm: 88,
    lead: ['D5', '.', '.', '.', 'F#5', '.', 'A5', '.', 'G5', '.', '.', '.', 'F#5', '.', 'E5', '.',
           'D5', '.', '.', '.', 'B4', '.', 'D5', '.', 'C#5', '.', '.', '.', '.', '.', '.', '.',
           'F5', '.', '.', '.', 'A5', '.', 'C6', '.', 'Bb5', '.', '.', '.', 'A5', '.', 'G5', '.',
           'F5', '.', '.', '.', 'D5', '.', 'F5', '.', 'E5', '.', '.', '.', 'D5', '.', '.', '.'],
    lead2: ['A4', '.', '.', '.', '.', '.', '.', '.', 'G4', '.', '.', '.', '.', '.', '.', '.',
            'F4', '.', '.', '.', '.', '.', '.', '.', 'A4', '.', '.', '.', 'G4', '.', '.', '.'],
    bass: ['D2', '.', '.', '.', '.', '.', '.', '.', 'G2', '.', '.', '.', 'A2', '.', '.', '.',
           'D2', '.', '.', '.', '.', '.', '.', '.', 'A1', '.', '.', '.', '.', '.', '.', '.',
           'F2', '.', '.', '.', '.', '.', '.', '.', 'Bb1', '.', '.', '.', 'C2', '.', '.', '.',
           'F2', '.', '.', '.', 'Bb1', '.', '.', '.', 'A1', '.', '.', '.', 'D2', '.', '.', '.'],
    drums: ['k', '-', '-', '-', '-', '-', '-', '-', 'h', '-', '-', '-', '-', '-', '-', '-'],
  },
  boss: {
    bpm: 160,
    lead: ['E4', 'E4', R, 'E4', 'G4', R, 'F#4', R, 'E4', 'E4', R, 'B4', R, 'A4', R, 'G4',
           'E4', 'E4', R, 'E4', 'G4', R, 'F#4', R, 'C5', R, 'B4', R, 'A4', R, 'G#4', R],
    bass: ['E2', 'E2', R, 'E2', 'E2', R, 'E2', R, 'C2', 'C2', R, 'C2', 'D2', R, 'D2', R,
           'E2', 'E2', R, 'E2', 'E2', R, 'E2', R, 'F2', 'F2', R, 'F2', 'G#1', R, 'G#1', R],
    drums: ['k', '-', 's', '-', 'k', 'k', 's', '-', 'k', '-', 's', 'h', 'k', 'k', 's', 's'],
  },
  bossFinal: { // 最終章のボス連戦・ノワール: 速いパッセージ、ハ短調、アルペジオとエコー
    bpm: 172,
    lead: ['C5', R, 'G4', 'C5', 'Eb5', R, 'D5', 'C5', 'B4', R, 'G4', R, 'Ab4', 'G4', 'F4', R,
           'C5', R, 'G4', 'C5', 'Eb5', R, 'F5', 'Eb5', 'D5', R, 'B4', R, 'C5', '.', '.', R,
           'Ab4', R, 'Eb4', 'Ab4', 'C5', R, 'Bb4', 'Ab4', 'G4', R, 'Eb4', R, 'F4', 'Eb4', 'D4', R,
           'G4', 'G4', R, 'G4', 'Ab4', R, 'B4', R, 'C5', '.', '.', '.', 'B4', 'C5', 'D5', 'Eb5'],
    arp: ['C3 Eb3 G3', '.', '.', '.', '.', '.', '.', '.', 'Ab2 C3 Eb3', '.', '.', '.', '.', '.', '.', '.',
          'C3 Eb3 G3', '.', '.', '.', '.', '.', '.', '.', 'G2 B2 D3', '.', '.', '.', '.', '.', '.', '.',
          'Ab2 C3 Eb3', '.', '.', '.', '.', '.', '.', '.', 'Eb3 G3 Bb3', '.', '.', '.', '.', '.', '.', '.',
          'G2 B2 D3', '.', '.', '.', '.', '.', '.', '.', 'C3 Eb3 G3', '.', '.', '.', 'G2 B2 D3', '.', '.', '.'],
    bass: ['C2', R, 'C2', R, 'C2', 'C2', R, 'C2', 'Ab1', R, 'Ab1', R, 'Ab1', 'Ab1', R, 'Ab1',
           'C2', R, 'C2', R, 'C2', 'C2', R, 'C2', 'G1', R, 'G1', R, 'G1', 'G1', R, 'G1',
           'Ab1', R, 'Ab1', R, 'Ab1', 'Ab1', R, 'Ab1', 'Eb2', R, 'Eb2', R, 'Eb2', 'Eb2', R, 'Eb2',
           'G1', R, 'G1', R, 'G1', 'G1', R, 'G1', 'C2', R, 'C2', R, 'G1', R, 'G1', 'G1'],
    drums: ['k', '-', 's', 'h', 'k', 'k', 's', '-', 'k', 'h', 's', 'h', 'k', 'k', 's', 's'],
    echo: { steps: 3, gain: 0.35 }, waves: { lead: 'square', arp: 'triangle' },
  },
  // ---- ジングル（1 回再生） ----
  jStart: { // 面開始: 上昇するファンファーレ
    bpm: 150,
    lead: ['G4', 'C5', 'E5', 'G5', '.', '.', 'E5', 'G5', 'C6', '.', '.', '.', '.', '.', R, R],
    bass: ['C2', '.', '.', '.', 'G2', '.', '.', '.', 'C2', '.', '.', '.', '.', '.', R, R],
    drums: ['k', '-', '-', '-', 's', '-', '-', '-', 'k', '-', '-', '-', '-', '-', '-', '-'],
  },
  jClear: { // 面クリア: 解決する上昇句＋長い終止
    bpm: 140,
    lead: ['C5', 'D5', 'E5', 'G5', 'E5', 'G5', 'C6', '.', '.', '.', 'B5', 'C6', 'D6', '.', '.', '.',
           'E6', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', R, R, R, R],
    lead2: ['E4', 'F4', 'G4', 'C5', 'G4', 'C5', 'E5', '.', '.', '.', 'D5', 'E5', 'F5', '.', '.', '.',
            'G5', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', R, R, R, R],
    bass: ['C2', '.', '.', '.', 'G2', '.', '.', '.', 'F2', '.', '.', '.', 'G2', '.', '.', '.',
           'C2', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', R, R, R, R],
    drums: ['k', '-', '-', '-', 'k', '-', '-', '-', 'k', '-', '-', '-', 's', '-', 's', 's', 'k', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'],
    echo: { steps: 2, gain: 0.3 },
  },
  jDeath: { // 死亡: 半音で沈む短句
    bpm: 100,
    lead: ['E4', '.', 'Eb4', '.', 'D4', '.', 'Db4', '.', 'C4', '.', '.', '.', '.', '.', R, R],
    bass: ['A1', '.', '.', '.', 'Ab1', '.', '.', '.', 'F1', '.', '.', '.', '.', '.', R, R],
    waves: { lead: 'triangle' },
  },
  jGameOver: { // ゲームオーバー: 低い和音のアルペジオが止まる
    bpm: 88,
    lead: ['C4', '.', '.', '.', 'B3', '.', '.', '.', 'Ab3', '.', '.', '.', 'G3', '.', '.', '.', 'F3', '.', '.', '.', '.', '.', '.', '.', 'E3', '.', '.', '.', '.', '.', '.', '.'],
    arp: ['C2 Eb2 G2', '.', '.', '.', '.', '.', '.', '.', 'Ab1 C2 Eb2', '.', '.', '.', '.', '.', '.', '.', 'F1 Ab1 C2', '.', '.', '.', '.', '.', '.', '.', 'C2 E2 G2', '.', '.', '.', '-', '-', '-', '-'],
    waves: { lead: 'triangle', arp: 'triangle' }, echo: { steps: 4, gain: 0.4 },
  },
  ending: {
    bpm: 84,
    lead: ['G4', '.', '.', '.', 'A4', '.', 'B4', '.', 'D5', '.', '.', '.', 'B4', '.', '.', '.',
           'C5', '.', '.', '.', 'B4', '.', 'A4', '.', 'G4', '.', '.', '.', '.', '.', '.', '.',
           'E4', '.', '.', '.', 'G4', '.', 'A4', '.', 'B4', '.', '.', '.', 'A4', '.', 'G4', '.',
           'A4', '.', '.', '.', '.', '.', '.', '.', 'G4', '.', '.', '.', '.', '.', '.', '.'],
    bass: ['G2', '.', '.', '.', '.', '.', '.', '.', 'D2', '.', '.', '.', '.', '.', '.', '.',
           'C2', '.', '.', '.', '.', '.', '.', '.', 'G2', '.', '.', '.', '.', '.', '.', '.',
           'E2', '.', '.', '.', '.', '.', '.', '.', 'B1', '.', '.', '.', '.', '.', '.', '.',
           'D2', '.', '.', '.', '.', '.', '.', '.', 'G2', '.', '.', '.', '.', '.', '.', '.'],
  },
};
