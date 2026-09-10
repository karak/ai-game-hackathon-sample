// src/ を境界づけられたコンテキストのディレクトリへ移し、import の相対パスを書き換える（docs/architecture.md、Sprint P）。
// 1 回だけ使う移設スクリプト。git mv で履歴を保ち、src/ test/ e2e/ tools/*.mjs の `from '…'` / `import('…')` を機械的に直す。
//   node tools/move_contexts.mjs --dry   … 予定だけ表示
//   node tools/move_contexts.mjs         … 実行
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const dry = process.argv.includes('--dry');
// 旧 → 新（src/ からの相対）
const MOVES = {
  'game.js': 'app/game.js', 'settings.js': 'app/settings.js', 'runlog.js': 'app/runlog.js', 'deathlog.js': 'app/deathlog.js', 'demo.js': 'app/demo.js',
  'world.js': 'stage/world.js', 'camera.js': 'stage/camera.js', 'physics.js': 'stage/physics.js', 'level.js': 'stage/level.js', 'balance.js': 'stage/balance.js', 'fx.js': 'stage/fx.js', 'decomap.js': 'stage/decomap.js',
  'entities/player.js': 'stage/entities/player.js', 'entities/enemies.js': 'stage/entities/enemies.js', 'entities/bosses.js': 'stage/entities/bosses.js', 'entities/items.js': 'stage/entities/items.js',
  'entities/projectiles.js': 'stage/entities/projectiles.js', 'entities/magic.js': 'stage/entities/magic.js', 'entities/gimmicks.js': 'stage/entities/gimmicks.js', 'entities/particles.js': 'stage/entities/particles.js',
  'levels/index.js': 'content/levels/index.js', 'levels/stitch.js': 'content/levels/stitch.js', 'story.js': 'content/story.js', 'demos.js': 'content/demos.js',
  'input.js': 'platform/input.js', 'audio.js': 'platform/audio.js',
  'util.js': 'shared/util.js', 'i18n.js': 'shared/i18n.js',
};
const absMoves = new Map(Object.entries(MOVES).map(([a, b]) => [join(ROOT, 'src', a), join(ROOT, 'src', b)]));
const newPathOf = abs => absMoves.get(abs) ?? abs;

const files = execSync("git ls-files 'src/*.js' 'src/**/*.js' 'test/*.js' 'e2e/*.js' 'tools/*.mjs'", { cwd: ROOT }).toString().trim().split('\n').map(f => join(ROOT, f));
const SPEC = /((?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"]+)(['"])/g;
let changed = 0, moved = 0;
for (const oldAbs of files) {
  const newAbs = newPathOf(oldAbs);
  let src = readFileSync(oldAbs, 'utf8');
  const out = src.replace(SPEC, (m, pre, spec, post) => {
    const target = resolve(dirname(oldAbs), spec);            // 旧位置から見た参照先（絶対）
    const newTarget = newPathOf(target);                      // 参照先が移るなら新位置
    let rel = relative(dirname(newAbs), newTarget).split('\\').join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return pre + rel + post;
  })
    // ブラウザ内の動的 import（'/src/…'）: e2e・tools が使う絶対パス
    .replace(/(['"])\/src\/([^'"]+)(['"])/g, (m, a, p, b) => a + '/src/' + (MOVES[p] ?? p) + b);
  if (out !== src) { changed++; if (!dry) writeFileSync(oldAbs, out); }
  if (newAbs !== oldAbs) {
    moved++;
    if (!dry) { mkdirSync(dirname(newAbs), { recursive: true }); execSync(`git mv "${relative(ROOT, oldAbs)}" "${relative(ROOT, newAbs)}"`, { cwd: ROOT }); }
    else console.log('mv', relative(ROOT, oldAbs), '->', relative(ROOT, newAbs));
  }
}
console.log(`${dry ? '[dry] ' : ''}files rewritten: ${changed}, moved: ${moved}`);
if (!dry) {
  // 空になったディレクトリ
  for (const d of ['src/entities', 'src/levels']) { try { execSync(`rmdir "${join(ROOT, d)}"`); } catch {} }
}
