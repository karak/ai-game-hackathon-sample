import { test, expect } from 'vitest';
import manifest from '../src/gfx/manifest.json';
import { SPEC, BOSS_SPEC } from '../src/catalog/specs.js';
import { DECO_MAP } from '../src/decomap.js';
import { THEMES } from '../src/gfx/tiles.js';
import { GROUP_JP } from '../src/catalog/pages/assets.js';
import { STAGES } from '../src/levels/index.js';

// カタログの掲載漏れ検査（DEBT-009）: manifest にある素材は必ずどこかの章の表に載る
const keys = Object.keys(manifest);
const names = g => keys.filter(k => k.startsWith(g + '/')).map(k => k.split('/')[1]);

test('every enemy in the manifest has a spec row on the enemies sheet (and vice versa)', () => {
  const enemyBases = [...new Set(names('enemies').map(n => n.replace(/(1|2|Rise)$/, '')))];
  for (const b of enemyBases) expect(SPEC[b], `spec row for ${b}`).toBeTruthy();
  for (const k of Object.keys(SPEC)) if (!SPEC[k].noSprite) expect(names('enemies').includes(k + '1'), `sprite for ${k}`).toBe(true); // noSprite: 主人公のコマを流用する敵
});

test('every boss in the manifest has a spec row (multi-part bosses by prefix)', () => {
  const bossBases = [...new Set(names('bosses').map(n => n.replace(/_?(head)?[12]$|_body$|_tail$/, '')))];
  for (const b of bossBases) expect(BOSS_SPEC[b], `boss spec row for ${b}`).toBeTruthy();
  for (const k of Object.keys(BOSS_SPEC)) expect(bossBases.includes(k), `boss sprite for ${k}`).toBe(true);
});

test('every deco name referenced by the deco map exists in the manifest, and every deco sprite is referenced', () => {
  const deco = new Set(names('deco'));
  const referenced = new Set(Object.values(DECO_MAP).flatMap(m => Object.values(m)));
  for (const n of referenced) expect(deco.has(n), `deco/${n}`).toBe(true);
  for (const n of deco) expect(referenced.has(n), `deco/${n} is not placed by any theme`).toBe(true);
});

test('every stage theme has sky, far, mid and a tile strip; every manifest group is titled on the assets sheet', () => {
  const bg = new Set(names('bg')), tiles = new Set(names('tiles'));
  for (const st of STAGES) { for (const l of ['sky', 'far', 'mid']) expect(bg.has(`${st.theme}_${l}`), `${st.theme}_${l}`).toBe(true); expect(tiles.has(st.theme), `tiles/${st.theme}`).toBe(true); expect(THEMES[st.theme], `THEMES.${st.theme}`).toBeTruthy(); expect(DECO_MAP[st.theme], `DECO_MAP.${st.theme}`).toBeTruthy(); }
  for (const g of new Set(keys.map(k => k.split('/')[0]))) expect(GROUP_JP[g], `group ${g}`).toBeTruthy();
});
