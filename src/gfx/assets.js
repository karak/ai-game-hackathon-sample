import { buildSheet, makeSprite, flipH } from './sprite.js';
import { COSTUMES } from './palette.js';
import { PLAYER_TOP, PLAYER_LEGS, PLAYER_FULL, HAT, BROOM, ENEMY, BOSS, SHOT, ITEM } from './sprites/index.js';
import { buildTileset, THEMES } from './tiles.js';
import { buildBackground } from './background.js';
import manifest from './manifest.json';
import { loadManifest, nest } from './loader.js';
import { HD_SCALE } from './sprite.js';

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
    // 帽子はコマごとの「髪の上端」に載せる（コマの高さが 94〜135 セルと違うため、スプライト上端基準では浮く）
    for (const c of Object.keys(assets.player)) for (const spr of Object.values(assets.player[c])) if (spr && spr.hd && spr.headY === undefined) spr.headY = findHairTop(spr.r) / HD_SCALE;
  }
  for (const g of ['enemies', 'bosses', 'items', 'shots']) if (gen[g]) Object.assign(assets[g], gen[g]);
  assets.generated = gen;
  return assets;
}

// 髪色（桃色: r>190, b>140, r-g>45）の最上段の行（スクリーン px）。見つからなければ 0
function findHairTop(canvas) {
  const g = canvas.getContext('2d'); const { width: w, height: h } = canvas; const d = g.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 0 && d[i] > 190 && d[i + 2] > 140 && d[i] - d[i + 1] > 45) n++; } if (n >= 3) return y; }
  return 0;
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
