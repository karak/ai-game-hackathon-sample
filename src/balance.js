// バランス定数（docs/plan/02-near-term.md A-3）
export const SAFE_ZONE_X = 96;      // 復活地点（中間地点・開始地点）±この世界単位はゾンビ湧き禁止
export const SAFE_SHOT_T = 2.0;     // 復活後この秒数は敵が弾を撃たない
export const PLAYER_SPEED = 66;     // 主人公の歩行速度（world units/s、player.js SPEED と一致させる）
export const BOSS_FIGHT_T = 90;     // 制限時間の見積もりに使うボス戦の秒数
// 制限時間の下限: ボス地点までの歩行時間 × 3 + ボス戦 90 秒（死亡時は残り 60 秒までしか補充されないため余裕を持つ）
export const minTimeLimit = bossX => Math.ceil(bossX / PLAYER_SPEED) * 3 + BOSS_FIGHT_T;
// 2 周目（真の結末ルート、05-systems 5.1）: 敵弾の速さ 1.5 倍、ゾンビ湧き間隔 0.8 倍
export const LOOP2 = Object.freeze({ shotSpeed: 1.5, spawnGap: 0.8 });
