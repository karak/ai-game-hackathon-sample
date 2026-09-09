// 設定とセーブ（localStorage）。純粋関数群。ストレージは注入可能（テスト用）
export const STORAGE_KEY = 'lyrica_save';
export const LEGACY_HI_KEY = 'lyrica_hi';
export const ACTIONS = ['left', 'right', 'up', 'down', 'shoot', 'jump', 'start', 'pause', 'mute'];
// オプション画面で割り当て変更できる操作（start/mute は固定）
export const REBINDABLE = ['left', 'right', 'up', 'down', 'shoot', 'jump', 'pause'];
export const ACTION_LABEL = { left: 'ひだり', right: 'みぎ', up: 'うえ', down: 'した', shoot: 'まほう', jump: 'ジャンプ', start: 'けってい', pause: 'ポーズ', mute: 'ミュート' };

// キーボード既定（KeyboardEvent.code → 操作）
export const DEFAULT_KEYS = Object.freeze({
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'shoot', KeyJ: 'shoot', KeyK: 'jump', KeyX: 'jump', Space: 'jump',
  Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
});
// ゲームパッド既定（Gamepad API standard mapping のボタン番号 "bN" → 操作）
// 0:A(下) 1:B(右) 2:X(左) 3:Y(上) 8:SELECT 9:START 12-15: 十字キー 上下左右
export const DEFAULT_PAD = Object.freeze({
  b0: 'jump', b1: 'shoot', b2: 'shoot', b3: 'jump',
  b8: 'mute', b9: 'start',
  b12: 'up', b13: 'down', b14: 'left', b15: 'right',
});
export const PAD_BUTTON_NAME = { b0: 'A', b1: 'B', b2: 'X', b3: 'Y', b4: 'LB', b5: 'RB', b6: 'LT', b7: 'RT', b8: 'SELECT', b9: 'START', b10: 'LS', b11: 'RS', b12: 'UP', b13: 'DOWN', b14: 'LEFT', b15: 'RIGHT', b16: 'HOME' };

export const VOLUME_MAX = 10;
export const DEFAULTS = Object.freeze({
  version: 1,
  keys: DEFAULT_KEYS, pad: DEFAULT_PAD,
  volume: 7,          // 0..10。7 で従来のマスター音量 0.35
  muted: false,
  progress: { stage: 0, cleared: false }, // 「つづきから」で始められる最大ステージ index／1 周クリア済み（2 周目を開放）
  hi: 0,
});

export function defaultSettings() { return { ...DEFAULTS, keys: { ...DEFAULT_KEYS }, pad: { ...DEFAULT_PAD }, progress: { ...DEFAULTS.progress } }; }

// 音量段階 → マスターゲイン（線形、7 → 0.35）
export function volumeGain(v) { return Math.max(0, Math.min(VOLUME_MAX, v)) / VOLUME_MAX * 0.5; }

const isMap = o => o && typeof o === 'object' && !Array.isArray(o);
function cleanMap(m, fallback) {
  if (!isMap(m)) return { ...fallback };
  const out = {};
  for (const [code, act] of Object.entries(m)) if (typeof code === 'string' && ACTIONS.includes(act)) out[code] = act;
  // 全操作に少なくとも 1 つ割り当てが無いマップは壊れているとみなす（start/mute はパッド側は任意）
  const acts = new Set(Object.values(out));
  for (const a of ['left', 'right', 'shoot', 'jump']) if (!acts.has(a)) return { ...fallback };
  return out;
}

export function loadSettings(storage) {
  const s = defaultSettings();
  let raw = null;
  try { raw = storage?.getItem(STORAGE_KEY); } catch {}
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (isMap(j)) {
        s.keys = cleanMap(j.keys, DEFAULT_KEYS); s.pad = cleanMap(j.pad, DEFAULT_PAD);
        if (Number.isFinite(j.volume)) s.volume = Math.round(Math.max(0, Math.min(VOLUME_MAX, j.volume)));
        s.muted = !!j.muted;
        if (isMap(j.progress) && Number.isInteger(j.progress.stage) && j.progress.stage >= 0) s.progress.stage = j.progress.stage;
        if (isMap(j.progress)) s.progress.cleared = j.progress.cleared === true;
        if (Number.isFinite(j.hi) && j.hi >= 0) s.hi = Math.floor(j.hi);
      }
    } catch {}
  }
  // 旧版のハイスコアキーを引き継ぐ
  try { const legacy = Number(storage?.getItem(LEGACY_HI_KEY) ?? 0) || 0; if (legacy > s.hi) s.hi = legacy; } catch {}
  return s;
}

export function saveSettings(s, storage) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, keys: s.keys, pad: s.pad, volume: s.volume, muted: s.muted, progress: s.progress, hi: s.hi })); return true; }
  catch { return false; }
}

// 操作 action の割り当てを code 一つに置き換える（他の操作に付いていた同じ code は外す）。新しいマップを返す
export function bind(map, action, code) {
  const out = {};
  for (const [c, a] of Object.entries(map)) if (a !== action && c !== code) out[c] = a;
  out[code] = action;
  return out;
}
export function codesFor(map, action) { return Object.entries(map).filter(([, a]) => a === action).map(([c]) => c); }

// 表示用の短い名前
export function keyName(code) {
  const fixed = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', Backspace: 'BS', Tab: 'TAB' };
  if (fixed[code]) return fixed[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM');
}
// ミニフォント（英数のみ）用の名前
export function keyNameMini(code) {
  const fixed = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN' };
  return fixed[code] ?? keyName(code).replace(/[^A-Za-z0-9 .:-]/g, '').toUpperCase();
}
export function padName(code) { return PAD_BUTTON_NAME[code] ?? code.toUpperCase(); }
