import { buildTileset, THEMES } from './tiles.js';
import { buildBackground } from './background.js';
import manifest from './manifest.json';
import { loadManifest, nest } from './loader.js';
import { HD_SCALE } from './sprite.js';

// 全アセットを起動時に生成。生成済み PNG（manifest）があればそれを優先し、無い分は文字列スプライトで補う。
// → DEBT-003（2026-09-13）: 文字列スプライトは撤去。スプライトは manifest の PNG だけで、読めなかったものは loader.js がプレースホルダを入れる（ADR-0040）。
//   手描きで残るのは地形の手続き描画（tiles.js / background.js）のみ。二段ジャンプのほうき（旧 32×6 の文字列ドット絵）は w/h が無く一度も描かれていなかった（BUG-024）ので、絵ごと外し broom は null
export async function buildAssets(onProgress = null) {
  const assets = baseAssets();
  const gen = nest(await loadManifest(manifest, '', onProgress)); // src はルート相対、ページ URL 基準（loader.js）
  if (gen.player) {
    assignPlayerFrames(assets.player, gen.player);
    assets.player.generated = true;
    if (gen.player.hat) assets.hat = gen.player.hat;
    // 帽子はコマごとの「髪の上端」に載せる（コマの高さが 94〜135 セルと違うため、スプライト上端基準では浮く）
    for (const c of Object.keys(assets.player)) for (const spr of Object.values(assets.player[c])) if (spr && spr.hd && spr.headY === undefined) spr.headY = findHairTop(spr.r) / HD_SCALE;
    // 帽子の上端は髪の上端より hatTopOffset 上（元デザイン base_hat の実測: 帽子上端 0 行、髪上端 9 行 → 3 世界単位）。帽子画像の高さで決めると 7 単位浮く
    assets.hatTopOffset = gen.player.base_hat ? Math.max(1, (findHairTop(gen.player.base_hat.r) - firstOpaqueRow(gen.player.base_hat.r)) / HD_SCALE) : 3;
  }
  for (const g of ['enemies', 'bosses', 'items', 'shots']) if (gen[g]) Object.assign(assets[g], gen[g]);
  assets.pickups = { ...assets.items, ...assets.shots }; // 宝箱から出る武器アイテムは弾のスプライトを流用。生成素材を合流した後に作る（BUG-023: 合流前に作ると落ちたアイテムだけ旧文字列ドット絵で描かれた）
  assets.generated = gen;
  return assets;
}

// 生成済み主人公フレームを衣装別シートに割り当てる。
// 2 パスで行う: (1) 共通コマ（衣装の接尾辞なし）を全衣装へ、(2) `_plain` / `_gold` で上書き。
// 1 パスでキーの順に処理すると、manifest の読み込み完了順（loadManifest は Promise.all なので不定）によって
// 共通コマが衣装別コマを上書きし、私服や金衣装にドレスのコマが混ざる（BUG-016。デプロイ版でユーザーが発見）。
export function assignPlayerFrames(player, gen) {
  const costumes = Object.keys(player).filter(c => typeof player[c] === 'object' && player[c] !== null);
  const specific = [];
  for (const [frame, spr] of Object.entries(gen)) {
    if (frame === 'hat' || frame === 'base' || frame === 'base_hat') continue;
    if (frame.endsWith('_nohat')) { (player.nohat ??= {})[frame.replace(/_nohat$/, '')] = spr; continue; } // 帽子なし原画（死亡演出で帽子を飛ばすときに使う）
    const m = frame.match(/^(.+)_(plain|gold)$/);
    if (m) { specific.push(m); continue; }
    for (const c of costumes) player[c][frame] = spr;      // (1) 共通コマ
  }
  for (const [, frame, costume] of specific) if (player[costume]) player[costume][frame] = gen[`${frame}_${costume}`]; // (2) 衣装別で上書き
  return player;
}

// 髪色（桃色: r>190, b>140, r-g>45）の最上段の行（スクリーン px）。見つからなければ 0
function findHairTop(canvas) {
  const g = canvas.getContext('2d'); const { width: w, height: h } = canvas; const d = g.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 0 && d[i] > 190 && d[i + 2] > 140 && d[i] - d[i + 1] > 45) n++; } if (n >= 3) return y; }
  return 0;
}

// 最初の不透明行
function firstOpaqueRow(canvas) {
  const g = canvas.getContext('2d'); const { width: w, height: h } = canvas; const d = g.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) return y;
  return 0;
}

export const COSTUME_NAMES = ['dress', 'plain', 'gold']; // 衣装別シート。manifest の接尾辞 _plain / _gold、接尾辞なしはドレス（assignPlayerFrames）

// スプライト以外の土台: 衣装別の空シート、テーマごとの手続き地形と背景
function baseAssets() {
  const player = {};
  for (const cname of COSTUME_NAMES) player[cname] = {};
  const assets = {
    player,
    hat: null, // 生成の player/hat を buildAssets が入れる
    broom: null, // 二段ジャンプのほうき。HD 素材を生成したら { r, l, w, h } を入れる（BUG-024、ユーザー判断）
    enemies: {}, bosses: {}, shots: {}, items: {},
    tiles: {}, backgrounds: {},
  };
  for (const th of Object.keys(THEMES)) { assets.tiles[th] = buildTileset(th); assets.backgrounds[th] = buildBackground(th); }
  return assets;
}
