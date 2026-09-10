// 操作の語彙と既定の割り当て（キーボード / ゲームパッド standard mapping）。プラットフォーム層の入力（input.js）が読む。
// settings.js（進行の永続化）から切り出した: 入力層が設定層に依存する向きを反転させるため（docs/architecture.md §3、Sprint P）。settings.js は再公開する
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

