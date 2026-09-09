import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// tools/subset_font.py が作る字種一覧（assets/fonts/game-chars.txt）に、ソースが描き得る文字が全て入っていることを検査する。
// フォントを再生成せずに「文言を足したらサブセットに字が無くて豆腐になる」事故を検出する（IMP-019）。
// 文字を足したら `.venv/bin/python tools/subset_font.py` を実行して DotGothic16-Game.ttf を作り直す。
const STR_RE = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });

const sourceChars = () => {
  const chars = new Set();
  for (const file of walk('src')) {
    if (file.includes('/catalog/')) continue; // カタログは全字形のフォントを読む
    let s = readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/gm, '$1');
    for (const m of s.matchAll(STR_RE)) for (const c of (m[1] ?? m[2] ?? m[3] ?? '')) chars.add(c);
  }
  const html = readFileSync('index.html', 'utf-8').replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, ' ');
  for (const c of html) chars.add(c);
  return [...chars].filter(c => c.codePointAt(0) >= 0x20 && c !== ' ' && c !== '　');
};

test('every character the game can draw is listed in assets/fonts/game-chars.txt', () => {
  const listed = new Set(readFileSync('assets/fonts/game-chars.txt', 'utf-8'));
  const missing = sourceChars().filter(c => !listed.has(c));
  expect(missing.join(''), 'run: .venv/bin/python tools/subset_font.py').toBe('');
});

test('the subset font is an order of magnitude smaller than the full font and both ship', () => {
  const sub = statSync('assets/fonts/DotGothic16-Game.ttf').size, full = statSync('assets/fonts/DotGothic16-Regular.ttf').size;
  expect(sub).toBeLessThan(full / 5);
  expect(sub).toBeGreaterThan(20_000); // 字形が落ちすぎていない（445 字で 139 KB）
  expect(readFileSync('index.html', 'utf-8')).toContain('DotGothic16-Game.ttf');
  expect(readFileSync('src/main.js', 'utf-8')).toContain('DotGothic16-Game.ttf');
  expect(readFileSync('catalog.html', 'utf-8')).toContain('DotGothic16-Regular.ttf'); // カタログは任意の説明文を出すので全字形
});
