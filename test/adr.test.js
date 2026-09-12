// ADR（docs/adr/）の形式検査。形式の定義は docs/adr/README.md。1 決定 1 ファイル、連番、必須メタ情報、4 見出し、一覧との対応
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'docs/adr';
const files = readdirSync(DIR).filter(f => /^\d{4}-[a-z0-9-]+\.md$/.test(f)).sort();
const others = readdirSync(DIR).filter(f => f !== 'README.md' && !/^\d{4}-[a-z0-9-]+\.md$/.test(f));
const readme = readFileSync(`${DIR}/README.md`, 'utf8');
const STATUS = /^- 状態: (採用|提案|廃止|置換（→ ADR-\d{4}）)$/;

test('ADR files are numbered consecutively from 0001 with a valid slug and nothing else lives in docs/adr', () => {
  expect(others, 'docs/adr には NNNN-slug.md と README.md だけを置く').toEqual([]);
  expect(files.length).toBeGreaterThan(0);
  files.forEach((f, i) => expect(f.slice(0, 4), f).toBe(String(i + 1).padStart(4, '0')));
});

test('every ADR has the title line, the four metadata lines in order, and the four headings in order', () => {
  for (const f of files) {
    const n = f.slice(0, 4), lines = readFileSync(`${DIR}/${f}`, 'utf8').split('\n');
    expect(lines[0], f).toMatch(new RegExp(`^# ADR-${n}: \\S`));
    const meta = lines.slice(1).filter(l => l.startsWith('- ')).slice(0, 4);
    expect(meta[0], f).toMatch(STATUS);
    expect(meta[1], f).toMatch(/^- 決定日: (\d{4}-\d{2}-\d{2}|Sprint [A-Z] 頃)/);
    expect(meta[2], f).toMatch(/^- 記録日: \d{4}-\d{2}-\d{2}$/);
    expect(meta[3], f).toMatch(/^- 関連: \S/);
    const heads = lines.filter(l => l.startsWith('## ')).map(l => l.slice(3).trim());
    expect(heads, f).toEqual(['背景', '決定', '結果', '証跡']);
    for (const h of heads) { const i = lines.indexOf('## ' + h); expect(lines.slice(i + 1).find(l => l.trim() && !l.startsWith('## ')), `${f}: ${h} が空`).toBeTruthy(); }
    if (/^- 状態: 置換/.test(meta[0])) { const to = meta[0].match(/ADR-(\d{4})/)[1]; expect(files.some(g => g.startsWith(to)), `${f}: 置換先 ADR-${to} が無い`).toBe(true); }
  }
});

test('the index table in README lists every ADR exactly once with a matching title', () => {
  for (const f of files) {
    const n = f.slice(0, 4), title = readFileSync(`${DIR}/${f}`, 'utf8').split('\n')[0].replace(/^# ADR-\d{4}: /, '');
    const rows = readme.split('\n').filter(l => l.includes(`](${f})`));
    expect(rows.length, `${f} の一覧行`).toBe(1);
    expect(rows[0], f).toContain(`| ${title} |`);
  }
  const listed = [...readme.matchAll(/\]\((\d{4}-[a-z0-9-]+\.md)\)/g)].map(m => m[1]);
  expect(listed.filter(l => !files.includes(l)), '一覧にあってファイルが無い').toEqual([]);
});
