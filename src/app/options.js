// オプション画面（Sprint P）: 行の定義（音量／ミュート／言語／パッド診断／割り当て×7／初期化／テスター報告／戻る）、操作、行の文言、描画。
// Game のメソッドから切り出した（第 1 引数 game = 旧 this）。Game には optionRow / leaveOptions / setLanguage / copyReport が残る
import { W, H } from '../stage/viewport.js';
import { drawWindow, text, mini, LAYOUT, rowHeight, miniX } from '../ui/index.js';
import { t, LANGS, LANG_LABEL } from '../shared/i18n.js';
import { volumeGain, bind, codesFor, keyName, padName, REBINDABLE, ACTION_LABEL, VOLUME_MAX, DEFAULT_KEYS, DEFAULT_PAD } from './settings.js';

// オプション画面の行。kind: volume / mute / key(action) / reset / back
export const OPTION_ROWS = [{ kind: 'volume' }, { kind: 'mute' }, { kind: 'lang' }, { kind: 'pad' }, ...REBINDABLE.map(a => ({ kind: 'key', action: a })), { kind: 'reset' }, { kind: 'telemetry' }, { kind: 'report' }, { kind: 'back' }]; // pad = 接続中のパッドと押下ボタンの診断表示、report = テスター報告をクリップボードへ

// ---- オプション（音量 / ミュート / キー・パッド割り当て） ----
export function updateOptions(game, inp) {
  if (game.reportMsg && (game.reportMsg.t -= 1 / 60) <= 0) game.reportMsg = null;
  if (game.capturing) return; // Input.captureNext のコールバック待ち
  const rows = OPTION_ROWS, row = rows[game.optIdx];
  if (inp.hit('up')) { game.optIdx = (game.optIdx + rows.length - 1) % rows.length; game.audio.sfx('select'); }
  if (inp.hit('down')) { game.optIdx = (game.optIdx + 1) % rows.length; game.audio.sfx('select'); }
  if (inp.hit('pause')) { game.leaveOptions(); return; }
  const dir = (inp.hit('right') ? 1 : 0) - (inp.hit('left') ? 1 : 0), ok = inp.hit('start') || inp.hit('shoot') || inp.hit('jump');
  if (row.kind === 'volume' && dir) { game.settings.volume = Math.max(0, Math.min(VOLUME_MAX, game.settings.volume + dir)); game.audio.setVolume(volumeGain(game.settings.volume)); game.audio.sfx('select'); }
  else if (row.kind === 'mute' && (dir || ok)) game.toggleMute();
  else if (row.kind === 'lang' && (dir || ok)) game.setLanguage(LANGS[(LANGS.indexOf(game.settings.lang) + (dir || 1) + LANGS.length) % LANGS.length]);
  else if (row.kind === 'key' && ok) {
    game.capturing = row.action; game.audio.sfx('select');
    game.input.captureNext(r => {
      if (r.type === 'key') { game.settings.keys = bind(game.settings.keys, row.action, r.code); game.input.setKeys(game.settings.keys); }
      else { game.settings.pad = bind(game.settings.pad, row.action, r.code); game.input.setPad(game.settings.pad); }
      game.capturing = null; game.save(); game.audio.sfx('select');
    });
  }
  else if (row.kind === 'reset' && ok) { game.settings.keys = { ...DEFAULT_KEYS }; game.settings.pad = { ...DEFAULT_PAD }; game.input.setKeys(game.settings.keys); game.input.setPad(game.settings.pad); game.save(); game.audio.sfx('select'); }
  else if (row.kind === 'telemetry' && (dir || ok)) { game.settings.telemetry = !game.settings.telemetry; game.telemetry?.setEnabled(game.settings.telemetry); game.save(); game.audio.sfx('select'); } // ログ送信（Sprint R）。OFF でもバッファと console は動く
  else if (row.kind === 'report' && ok) game.copyReport();
  else if (row.kind === 'back' && ok) game.leaveOptions();
}

export function optionRowText(game, row) {
  switch (row.kind) {
    case 'volume': return [t('おんりょう'), `◀ ${'■'.repeat(game.settings.volume)}${'□'.repeat(VOLUME_MAX - game.settings.volume)} ▶`];
    case 'mute': return [t('ミュート'), game.settings.muted ? 'ON' : 'OFF'];
    case 'lang': return [t('げんご'), `◀ ${LANG_LABEL[game.settings.lang] ?? game.settings.lang} ▶`];
    case 'key': {
      if (game.capturing === row.action) return [t(ACTION_LABEL[row.action]), t('キー か ボタン を おしてください')];
      const k = codesFor(game.settings.keys, row.action).map(keyName).join(' '), p = codesFor(game.settings.pad, row.action).map(padName).join(' ');
      return [t(ACTION_LABEL[row.action]), `${k || '--'}  /  PAD ${p || '--'}`];
    }
    case 'pad': { // 診断: 接続中のパッド名（先頭 22 字）と今押されているボタン。実機で「認識されているか」「どのボタンが何番か」を見る
      if (!game.input.padConnected) return [t('ゲームパッド'), t('みけんしゅつ')];
      const id = String(game.input.padId ?? 'PAD').replace(/\s*\(.*$/, '').slice(0, 22), pressed = [...game.input.padButtons].map(i => padName('b' + i)).join(' ');
      return [t('ゲームパッド'), `${id}${pressed ? '  [' + pressed + ']' : ''}`];
    }
    case 'telemetry': return [t('ログそうしん'), game.settings.telemetry === false ? 'OFF' : 'ON'];
    case 'report': return [t('テスター報告を コピー'), game.reportMsg ? t(game.reportMsg.ok ? 'コピーしました' : 'コピーできません') : ''];
    case 'reset': return [t('そうさを しょきかに もどす'), ''];
    case 'back': return [t('タイトルへ もどる'), ''];
  }
}

export function drawOptions(game, g) {
  g.fillStyle = '#0e0a18'; g.fillRect(0, 0, W, H);
  const rows = OPTION_ROWS, line = LAYOUT.LINE, pad = LAYOUT.PAD;
  const x = LAYOUT.MARGIN, w = LAYOUT.W - LAYOUT.MARGIN * 2, h = pad * 2 + rowHeight(LAYOUT.FONT) + 6 + rows.length * line;
  const y = Math.floor((LAYOUT.H - h) / 2);
  drawWindow(g, x, y, w, h);
  text(g, t('オプション'), 128, y + pad, { align: 'center', color: '#ff8fc8' });
  let cy = y + pad + rowHeight(LAYOUT.FONT) + 6;
  rows.forEach((row, i) => {
    const [label, value] = optionRowText(game, row), sel = i === game.optIdx;
    const color = sel ? '#ffe860' : '#fdfbf7';
    if (sel) text(g, '▶', x + pad - 2, cy, { color });
    text(g, label, x + pad + 12, cy, { color });
    if (value) text(g, value, x + w - pad, cy, { align: 'right', color: sel && game.capturing ? '#ff8fc8' : color, size: 12 });
    cy += line;
  });
  const hint = game.input.padConnected ? 'PAD OK  UP/DOWN SELECT  A/B OK  START BACK' : 'UP/DOWN SELECT  ENTER OK  ESC BACK';
  mini(g, hint, miniX(hint), y + h + 6, '#a5a5b8');
}
