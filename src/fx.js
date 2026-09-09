// 画面演出の状態（docs/plan/02-near-term.md A-5）。描画に依存しない純粋なタイマー群で、テスト可能
export const HITSTOP_TICKS = 4;        // 被弾時に世界を止める tick 数
export const KILL_FLASH_T = 0.05;      // 敵撃破の白フラッシュ秒
export const BOSS_WHITEOUT_T = 0.45;   // ボス撃破の白飛び秒
export const BOSS_SLOWMO_T = 1.4;      // 白飛び後のスローモーション秒
export const BOSS_SLOWMO_SCALE = 0.3;
export const IRIS_T = 0.7;             // アイリスワイプ秒
export const BOSS_INTRO_T = 2.0;       // ボス登場バナー秒
export const SUPER_SLOW_T = 0.5;       // 強化魔法の発動で世界が遅くなる秒数
export const SUPER_SLOW_SCALE = 0.35;  // その間の時間倍率

export class Fx {
  constructor() { this.hitstop = 0; this.flashT = 0; this.flashDur = 0; this.flashColor = '#fdfbf7'; this.flashMax = 1; this.slowT = 0; this.slowScale = 1; this.introT = 0; this.introName = ''; }
  // 被弾ヒットストップ: 次の n tick は世界を進めない
  hitStop(ticks = HITSTOP_TICKS) { this.hitstop = Math.max(this.hitstop, ticks); }
  // 画面フラッシュ（alpha は max → 0 に線形減衰）
  flash(dur, color = '#fdfbf7', max = 0.35) { this.flashT = this.flashDur = dur; this.flashColor = color; this.flashMax = max; }
  killFlash() { this.flash(KILL_FLASH_T, '#fdfbf7', 0.3); }
  // ボス撃破: 白飛び → スローモーション
  bossDefeat() { this.flash(BOSS_WHITEOUT_T, '#fdfbf7', 1); this.slowT = BOSS_SLOWMO_T; this.slowScale = BOSS_SLOWMO_SCALE; }
  bossIntro(name) { this.introT = BOSS_INTRO_T; this.introName = name; }
  // 強化魔法の発動: 武器色の強いフラッシュ＋短いスローモーション（SUPER_SLOW_T 秒だけ SUPER_SLOW_SCALE 倍）
  superCast(color = '#fdfbf7') { this.flash(0.3, color, 0.55); this.slowT = Math.max(this.slowT, SUPER_SLOW_T); this.slowScale = SUPER_SLOW_SCALE; }
  get flashAlpha() { return this.flashT > 0 && this.flashDur > 0 ? this.flashMax * (this.flashT / this.flashDur) : 0; }
  get timeScale() { return this.slowT > 0 ? this.slowScale : 1; }
  get introActive() { return this.introT > 0; }
  // 1 tick 進める。戻り値: 世界に与える dt（ヒットストップ中は 0、スロー中は縮む）
  tick(dt) {
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);
    if (this.hitstop > 0) { this.hitstop--; return 0; }
    const scale = this.timeScale;
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    return dt * scale;
  }
}

// アイリスワイプの半径。t: 経過秒、open: true で開く（0 → 対角）、false で閉じる。0 以下なら全面黒
export function irisRadius(t, open, w, h, dur = IRIS_T) {
  const full = Math.hypot(w, h) / 2 + 4;
  const k = Math.max(0, Math.min(1, t / dur));
  const e = open ? 1 - (1 - k) * (1 - k) : (1 - k) * (1 - k); // ease-out で開き、ease-in で閉じる
  return full * e;
}
