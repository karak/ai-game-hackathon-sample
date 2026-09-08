// キーボード・ゲームパッド・タッチ入力。pressed = 今フレーム押された、held = 押し続け
import { DEFAULT_KEYS, DEFAULT_PAD } from './settings.js';

// 互換用: 既定のキーマップ
export const MAP = DEFAULT_KEYS;
export const PAD_DEADZONE = 0.5;

const list = v => v == null ? [] : Array.isArray(v) ? v : [v];

export class Input {
  // settings: { keys, pad }（省略時は既定）。opts.getPads で Gamepad 取得を差し替え可能（テスト用）
  constructor(target = globalThis.window, settings = null, opts = {}) {
    this.keys = { ...(settings?.keys ?? DEFAULT_KEYS) };
    this.padMap = { ...(settings?.pad ?? DEFAULT_PAD) };
    this.held = new Set();      // キーボード/タッチで押下中
    this.padHeld = new Set();   // パッドで押下中
    this.pressed = new Set();
    this.anyKey = false; this.padConnected = false; this.capture = null;
    this.getPads = opts.getPads ?? (() => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []));
    this.padButtons = new Set(); // 前回ポーリングで押されていたボタン番号
    if (target?.addEventListener) {
      target.addEventListener('keydown', e => {
        this.lastKey = { code: e.code, t: Math.round((globalThis.performance?.now() ?? 0)) };
        if (this.capture) { e.preventDefault?.(); if (!e.repeat) this._resolveCapture({ type: 'key', code: e.code }); return; }
        const a = this.keys[e.code];
        if (a) { e.preventDefault?.(); if (!this.held.has(a) && !e.repeat) this.pressed.add(a); this.held.add(a); }
        if (!e.repeat) this.anyKey = true;
      });
      target.addEventListener('keyup', e => {
        const a = this.keys[e.code];
        if (a) { e.preventDefault?.(); this.held.delete(a); }
      });
      target.addEventListener('blur', () => this.held.clear());
    }
    this._touch();
  }
  down(a) { return this.held.has(a) || this.padHeld.has(a); }
  hit(a) { return this.pressed.has(a); }
  endFrame() { this.pressed.clear(); this.anyKey = false; }

  // 設定変更の反映
  setKeys(keys) { this.keys = { ...keys }; this.held.clear(); }
  setPad(pad) { this.padMap = { ...pad }; this.padHeld.clear(); }
  // 次に押されたキー/パッドボタンを 1 回だけ受け取る（キーコンフィグ用）。cb({type:'key'|'pad', code})
  captureNext(cb) { this.capture = cb; }
  cancelCapture() { this.capture = null; }
  _resolveCapture(r) { const cb = this.capture; this.capture = null; cb(r); }

  // ゲームパッドをポーリング（毎フレーム、update の前に呼ぶ）
  poll() {
    let gp = null;
    try { for (const p of this.getPads() ?? []) if (p && p.connected !== false) { gp = p; break; } } catch { gp = null; }
    this.padConnected = !!gp;
    const now = new Set(), buttons = new Set();
    if (gp) {
      const bs = gp.buttons ?? [];
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i]; const on = typeof b === 'object' ? (b.pressed || b.value > 0.5) : b > 0.5;
        if (!on) continue;
        buttons.add(i);
        if (!this.padButtons.has(i) && this.capture) { this._resolveCapture({ type: 'pad', code: 'b' + i }); this.padButtons = buttons; return; }
        for (const a of list(this.padMap['b' + i])) now.add(a);
      }
      const ax = gp.axes ?? [];
      if (ax[0] < -PAD_DEADZONE) now.add('left'); if (ax[0] > PAD_DEADZONE) now.add('right');
      if (ax[1] < -PAD_DEADZONE) now.add('up'); if (ax[1] > PAD_DEADZONE) now.add('down');
    }
    if (this.capture) { this.padButtons = buttons; this.padHeld = new Set(); return; } // 割り当て待ち中は操作として扱わない
    for (const a of now) if (!this.padHeld.has(a)) { this.pressed.add(a); this.anyKey = true; }
    this.padHeld = now; this.padButtons = buttons;
  }

  // タッチ操作（スマホ用の簡易ボタン）
  _touch() {
    if (typeof document === 'undefined') return;
    const pad = document.getElementById('touchpad');
    if (!pad) return;
    if (!('ontouchstart' in window)) { pad.style.display = 'none'; return; }
    pad.querySelectorAll('[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      const on = e => { e.preventDefault(); if (!this.held.has(act)) this.pressed.add(act); this.held.add(act); this.anyKey = true; btn.classList.add('on'); };
      const off = e => { e.preventDefault(); this.held.delete(act); btn.classList.remove('on'); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off); btn.addEventListener('touchcancel', off);
    });
  }
}
