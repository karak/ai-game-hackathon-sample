// キーボード入力。pressed = 今フレーム押された、held = 押し続け
export const MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'shoot', KeyJ: 'shoot', KeyK: 'jump', KeyX: 'jump', Space: 'jump',
  Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
};

export class Input {
  constructor(target = window) {
    this.held = new Set();
    this.pressed = new Set();
    this.anyKey = false;
    target.addEventListener('keydown', e => {
      const a = MAP[e.code];
      this.lastKey = { code: e.code, t: Math.round(performance.now()) };
      if (a) { e.preventDefault(); if (!this.held.has(a) && !e.repeat) this.pressed.add(a); this.held.add(a); }
      if (!e.repeat) this.anyKey = true;
    });
    target.addEventListener('keyup', e => {
      const a = MAP[e.code];
      if (a) { e.preventDefault(); this.held.delete(a); }
    });
    window.addEventListener('blur', () => this.held.clear());
    this._touch();
  }
  down(a) { return this.held.has(a); }
  hit(a) { return this.pressed.has(a); }
  endFrame() { this.pressed.clear(); this.anyKey = false; }

  // タッチ操作（スマホ用の簡易ボタン）
  _touch() {
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
