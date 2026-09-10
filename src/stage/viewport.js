// 画面の論理寸法。World と描画（render.js）・カメラ・進行が共有する定数（world.js から切り出し、循環 import を避ける）
export const W = 256, H = 224; // 論理座標（世界単位）。実キャンバスは SCALE 倍
export const SCALE = 3; // 内部解像度 768x672（docs/art-standard.md §2.1）。HD スプライトは 1 画面画素 = 1/3 世界単位
