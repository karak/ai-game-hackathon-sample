import { buildSheet, makeSprite, flipH } from './sprite.js';
import { COSTUMES } from './palette.js';
import { PLAYER_TOP, PLAYER_LEGS, PLAYER_FULL, HAT, BROOM, ENEMY, BOSS, SHOT, ITEM } from './sprites/index.js';
import { buildTileset, THEMES } from './tiles.js';
import { buildBackground } from './background.js';
import manifest from './manifest.json';
import { loadManifest, nest } from './loader.js';

// 全アセットを起動時に生成。生成済み PNG（manifest）があればそれを優先し、無い分は文字列スプライトで補う。
export async function buildAssets() {
  const assets = buildProcedural();
  const gen = nest(await loadManifest(manifest, '../../'));
  if (gen.player) {
    // 生成済み主人公フレーム。衣装は当面 dress のみ（plain/gold は後段のパレット置換で生成）
    for (const [frame, spr] of Object.entries(gen.player)) {
      if (frame === 'hat' || frame === 'base' || frame.endsWith('_nohat')) continue;
      const m = frame.match(/^(.+)_(plain|gold)$/);
      if (m) assets.player[m[2]][m[1]] = spr;             // 衣装別フレーム
      else for (const c of Object.keys(assets.player)) assets.player[c][frame] = spr; // 共通フレーム
    }
    assets.player.generated = true;
    if (gen.player.hat) assets.hat = gen.player.hat;
  }
  for (const g of ['enemies', 'bosses', 'items', 'shots']) if (gen[g]) Object.assign(assets[g], gen[g]);
  assets.generated = gen;
  return assets;
}

function buildProcedural() {
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
  assets.pickups = { ...assets.items, ...assets.shots }; // 宝箱から出る武器アイテムは弾のスプライトを流用
  for (const th of Object.keys(THEMES)) { assets.tiles[th] = buildTileset(th); assets.backgrounds[th] = buildBackground(th); }
  return assets;
}
