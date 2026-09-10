// 画面の論理寸法。World と描画（render.js）・カメラ・進行が共有する定数（world.js から切り出し、循環 import を避ける）
export const W = 256, H = 224; // 論理座標（世界単位）。実キャンバスは SCALE 倍
export const SCALE = 3; // 内部解像度 768x672（docs/art-standard.md §2.1）。HD スプライトは 1 画面画素 = 1/3 世界単位
export const HD_SCALE = 3; // 生成 PNG の 1 画素 = 1/HD_SCALE 世界単位（上の SCALE と一致させる。旧 gfx/sprite.js から移動: 領域側が描画基盤を読まずに済むように）
