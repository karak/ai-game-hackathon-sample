import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

// docs/architecture.md §2 の依存の向きを import 文で検査する。コンテキストは src/ 直下のディレクトリ名。
// 許可リストに無い向きの import があれば、どのファイルがどこを読んだかを列挙して落ちる
const SRC = resolve(__dirname, '../src');
const CONTEXT_OF = rel => rel.includes('/') ? rel.split('/')[0] : 'main';
const ALLOWED = {
  main: ['app', 'stage', 'gfx', 'platform', 'shared', 'ui', 'content'],
  app: ['app', 'stage', 'content', 'gfx', 'ui', 'platform', 'shared'],
  stage: ['stage', 'content', 'shared', 'gfx', 'platform'],          // gfx は sprite/palette（entities）と tiles/hdworld/background（render.js）、platform は audio の SONGS
  content: ['content', 'shared'],
  gfx: ['gfx', 'shared', 'stage'],                                    // stage は physics.js の TILE だけ（下で個別に検査）
  ui: ['ui', 'gfx', 'shared', 'stage'],                               // stage は entities/projectiles.js の WEAPONS（表示用）だけ
  platform: ['platform', 'shared'],
  shared: ['shared'],
  catalog: ['catalog', 'app', 'stage', 'content', 'gfx', 'ui', 'platform', 'shared'],
};
// コンテキスト境界をまたぐ import のうち、ファイル単位で限定するもの
const NARROW = { 'gfx→stage': ['stage/physics.js', 'stage/viewport.js'], 'ui→stage': ['stage/entities/projectiles.js'], 'stage→platform': ['platform/audio.js'] };

function walk(dir, out = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p); } return out; }
const files = walk(SRC);
const edges = [];
for (const f of files) {
  const rel = relative(SRC, f); const from = CONTEXT_OF(rel);
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+\.js)['"]/g)) {
    const target = relative(SRC, resolve(dirname(f), m[1])); if (target.startsWith('..')) continue; // assets など src 外
    edges.push({ from, to: CONTEXT_OF(target), file: rel, target });
  }
}

test('every src file belongs to a known context', () => {
  const unknown = files.map(f => relative(SRC, f)).filter(r => !(CONTEXT_OF(r) in ALLOWED));
  expect(unknown, 'src/ 直下に置く単独ファイルは main.js だけ。新しいコンテキストは ALLOWED と docs/architecture.md に登録する').toEqual([]);
});

test('imports only point in the allowed direction (docs/architecture.md §2)', () => {
  const bad = edges.filter(e => !ALLOWED[e.from]?.includes(e.to)).map(e => `${e.file} → ${e.target}`);
  expect(bad).toEqual([]);
});

test('narrow cross-context imports stay on the whitelisted files', () => {
  const bad = [];
  for (const [key, files] of Object.entries(NARROW)) {
    const [from, to] = key.split('→');
    for (const e of edges) if (e.from === from && e.to === to && !files.includes(e.target)) bad.push(`${e.file} → ${e.target}`);
  }
  expect(bad).toEqual([]);
});

test('the map has at least the expected contexts and the graph is non-trivial', () => {
  const ctx = new Set(edges.map(e => e.from));
  for (const c of ['main', 'app', 'stage', 'content', 'gfx', 'ui', 'platform']) expect(ctx.has(c), c).toBe(true);
  expect(edges.length).toBeGreaterThan(80);
});

test('domain entities (stage/entities/*) do not draw: no import of gfx/sprite.js; palette colors as data are allowed', () => {
  const bad = edges.filter(e => e.file.startsWith('stage/entities/') && e.to === 'gfx' && e.target !== 'gfx/palette.js').map(e => `${e.file} → ${e.target}`);
  expect(bad, '描画は stage/entityRender.js（drawEntity）へ。docs/architecture.md §5').toEqual([]);
});
