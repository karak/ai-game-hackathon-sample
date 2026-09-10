// ボス戦の進行（Sprint P 後半）: 部屋（arena）の確定と地面探し、ボスの生成と連戦の切り替え、撃破時の演出とクリア判定、表示名。
// World のメソッドから切り出した（第 1 引数 world = 旧 this）。World は委譲を残し、bosses.js からの world.onBossDying() / onBossDefeated() はそのまま通る
import { TILE } from './physics.js';
import { W, H } from './viewport.js';
import { createBoss } from './entities/bosses.js';
import { SONGS } from '../platform/audio.js';
import { BOSS_NAMES } from '../content/story.js';
import { t } from '../shared/i18n.js';

export function startBoss(world) {
  const trig = world.level.bossTriggers[world.bossIdx]; const map = world.level.map; const kind = world.level.bosses[world.bossIdx] ?? world.level.boss;
  const x0 = world.level.vertical ? 0 : Math.max(0, Math.min(trig.x - 24, map.pixelWidth - W)); const x1 = Math.min(map.pixelWidth, x0 + W);
  world.arena = { x0, x1 }; world.bossState = 'fight'; world.audio.sfx('boss'); world.shake(3);
  if (map.pixelHeight > H) { const y1 = Math.min(map.pixelHeight, Math.max(H, trig.y + 2 * TILE)); world.arena.y0 = y1 - H; world.arena.y1 = y1; } // 縦マップ: トリガー行を下端近くに含む 1 画面
  // 地面高さを探す
  const tx = Math.floor((x1 - 40) / TILE); let gy = map.pixelHeight;
  const startTy = Math.max(0, Math.floor((world.player.y + world.player.h) / TILE) - 1);
  for (let ty = startTy; ty < map.height; ty++) if (map.isSolid(tx, ty)) { gy = ty * TILE; break; }
  if (kind === 'serpent') { // 大蛇は川に棲む: 部屋の中央列で最初の '~' の上端を水面にする
    const cx = Math.floor((x0 + x1) / 2 / TILE);
    for (let ty = 0; ty < map.height; ty++) if (map.at(cx, ty) === '~') { gy = ty * TILE; break; }
  }
  world.boss = createBoss(world, kind, x1 - 48, gy);
  if (world.level.bossHpMul !== 1) { world.boss.hpMax = Math.round(world.boss.hpMax * world.level.bossHpMul); world.boss.hp = world.boss.hpMax; } // 連戦強化
  if (world.boss.parts) world.enemies.push(...world.boss.parts); // 胴体（接触判定のみ）
  world.enemies = world.enemies.filter(e => !(e.spawnX >= x0 - 200)); // 周辺の雑魚は消す
  world.enemies.push(world.boss);
  world.audio.playBgm(SONGS[world.level.bossSong ?? 'boss']); // 最終章は bossFinal
  world.fx.bossIntro(bossName(world));
}

export function bossName(world, kind = world.level.bosses[world.bossIdx] ?? world.level.boss) { const n = BOSS_NAMES[kind]; return n ? t(n) : 'BOSS'; }

export function onBossDying(world) { world.cutscene = true; world.audio.stopBgm(); world.fx.bossDefeat(); }

export function onBossDefeated(world) {
  if (world.bossIdx + 1 < world.level.bosses.length) { // 連戦: 次のボスへ（部屋を開放して先へ進ませる）
    world.bossIdx++; world.boss = null; world.arena = null; world.bossState = 'none'; world.cutscene = false; world.enemies = world.enemies.filter(e => !e.isBoss && !e.head);
    world.player.invT = Math.max(world.player.invT, 1.5); world.time = Math.max(world.time, 90); world.toast(t('先へ進め')); world.audio.playBgm(SONGS[world.level.theme]); return;
  }
  world.cleared = true; world.cutscene = true; world.player.vx = 0; world.game.stageClear();
}
