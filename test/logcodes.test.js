// ログコードの登録制（Sprint R）: src/ と worker/ の log.emit / .info / .warn / .error / .debug の第 1 引数（文字列リテラル）が全て logcodes.js に登録されていること。
// 逆に、登録されているのに（Worker 専用 2 件を除いて）どこからも使われないコードも列挙して落とす（表を増やし放題にしない）
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOG_CODES } from '../src/shared/logcodes.js';

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') || p.endsWith('.mjs') ? [p] : []; });
const files = [...walk('src'), ...walk('worker'), ...walk('e2e'), ...walk('tools')].filter(f => !f.includes('/catalog/'));
const RE = /\b(?:(?:log|LOG|this)\.(?:emit|debug|info|warn|error)|edgeEvent)\(\s*['"]([A-Z_.]+)['"]/g; // Worker は edgeEvent('EDGE.…')、Log 自身は this.emit('LOG.TRUNCATED')
const used = new Map();
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(RE)) used.set(m[1], [...(used.get(m[1]) ?? []), f]);

test('every log code used in src/worker/e2e/tools is registered in src/shared/logcodes.js', () => {
  const unregistered = [...used].filter(([c]) => !(c in LOG_CODES)).map(([c, fs]) => `${c} ← ${fs.join(', ')}`);
  expect(unregistered).toEqual([]);
});

test('every registered code is emitted somewhere (dead codes are removed from the table)', () => {
  const dead = Object.keys(LOG_CODES).filter(c => !used.has(c));
  expect(dead).toEqual([]);
});
