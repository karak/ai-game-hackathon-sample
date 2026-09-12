// ログコード表（docs/plan/09-observability.md §2.1）。構造化ログ LogEvent の `code` はここに登録した AREA.EVENT だけを使う。
// 値は既定の lvl。未登録のコードで log.emit() を呼ぶと throw し、test/logcodes.test.js が src/ と worker/ の呼び出しを走査して漏れを検出する。
// 追加するときは、この表 → 09-observability.md §2.1 の表（いつ・attr）→ 呼び出し、の順。集計（tools/log_stats.mjs）の鍵になるので増やし放題にしない。
export const LEVELS = Object.freeze(['debug', 'info', 'warn', 'error']);

export const LOG_CODES = Object.freeze({
  // セッション（ページ読込 1 回）
  'SESSION.START': 'info',   // attr.env: ua / lang / vw / vh / dpr / pad / touch（個人情報は持たない）
  'SESSION.END': 'info',     // visibilitychange: hidden / pagehide。attr.sec
  'GAME.BOOT': 'info',       // 素材ロード完了。attr.bootMs / assets / loaderWarnings
  'GAME.STATE': 'debug',     // Game.setState。attr.from / to（送信しない。バッファと dev console のみ）
  // 1 回の遊び（run）
  'RUN.START': 'info',       // attr.start / loop / mode(new|continue|loop2)
  'RUN.END': 'info',         // attr.reached / cleared / deaths / continues / sec
  'STAGE.START': 'info',     // attr.stage / index
  'STAGE.CLEAR': 'info',     // attr.sec / deaths
  'PLAYER.HIT': 'info',      // 変身解除。attr.by / x / y
  'PLAYER.DEATH': 'info',    // attr.reason(hit|fall|spike|bog|press|time) / x / y
  'PLAYER.CONTINUE': 'info', // attr.stage
  'BOSS.START': 'info',      // attr.boss
  'BOSS.END': 'info',        // attr.boss / sec
  'DEMO.START': 'debug',     // attr.stage
  'DEMO.END': 'debug',       // attr.reason(input|timeout|gameover)
  // 環境・性能
  'INPUT.PAD': 'info',       // attr.id / mapping / connected
  'PERF.FRAME': 'info',      // 30 秒ごと。attr.fps_p50 / fps_p95 / long(>50 ms の数) / frames
  // 異常
  'ASSET.FAIL': 'warn',      // attr.path / kind
  'SAVE.FAIL': 'warn',       // attr.key
  'ERR.UNCAUGHT': 'error',   // err
  'ERR.PROMISE': 'error',    // err
  'ERR.AUDIO': 'warn',       // err
  'LOG.DROP': 'warn',        // attr.dropped / sendFail（送信時に 1 件）
  'LOG.TRUNCATED': 'warn',   // 上限で切り詰めた（セッションで 1 回）。attr.code
  // Worker（worker/index.js。ブラウザからは出さない）
  'EDGE.LOG_BATCH': 'info',  // attr.events / bytes / country / ray
  'EDGE.LOG_REJECT': 'warn', // attr.why / bytes
});

export function isLogCode(code) { return Object.prototype.hasOwnProperty.call(LOG_CODES, code); }
export function levelIndex(lvl) { return LEVELS.indexOf(lvl); }
