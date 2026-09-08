import { buildSheet, makeSprite, flipH } from './sprite.js';
import { COSTUMES } from './palette.js';
import { PLAYER_TOP, PLAYER_LEGS, PLAYER_FULL, HAT, BROOM, ENEMY, BOSS, SHOT, ITEM } from './sprites.js';
import { buildTileset, THEMES } from './tiles.js';
import { buildBackground } from './background.js';

// 全アセットを起動時に生成
export function buildAssets() {
  const player = {};
  for (const [cname, remap] of Object.entries(COSTUMES)) {
    const defs = {};
    for (const [tn, top] of Object.entries(PLAYER_TOP))
      for (const [ln, legs] of Object.entries(PLAYER_LEGS)) defs[`${tn}_${ln}`] = [...top, ...legs];
    for (const [fn, rows] of Object.entries(PLAYER_FULL)) defs[fn] = rows;
    player[cname] = buildSheet(defs, remap);
  }
  const hatR = makeSprite(HAT), broomR = makeSprite(BROOM);
  const itemRemap = COSTUMES.dress;
  const assets = {
    player,
    hat: { r: hatR, l: flipH(hatR) },
    broom: { r: broomR, l: flipH(broomR) },
    enemies: buildSheet(ENEMY),
    bosses: buildSheet(BOSS),
    shots: buildSheet(SHOT),
    items: buildSheet(ITEM, itemRemap),
    tiles: {}, backgrounds: {},
  };
  for (const th of Object.keys(THEMES)) { assets.tiles[th] = buildTileset(th); assets.backgrounds[th] = buildBackground(th); }
  return assets;
}
