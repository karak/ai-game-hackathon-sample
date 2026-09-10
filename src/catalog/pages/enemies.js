// 敵・ボスシート: フレーム、当たり判定（実クラスから取得）、行動仕様、弾、演出、スコア
import { h1, h2, h3, note, table, frameStrip, paletteStrip, rawSize } from '../sheet.js';
import { createEnemy, ZombieRabbit } from '../../stage/entities/enemies.js';
import { createBoss } from '../../stage/entities/bosses.js';
import { SPEC, BOSS_SPEC } from '../specs.js';
import { TileMap } from '../../stage/physics.js';

// 行動仕様（コードの状態機械を要約。数値は enemies.js / bosses.js の定数）

// 実クラスから当たり判定を取る（スタブ World）
function stubWorld(A) {
  const map = new TileMap(['................', '################']);
  return { assets: A, level: { map }, particles: { emit() {} }, decals: { splat() {} }, audio: { sfx() {} }, enemyShots: [], enemies: [], player: { centerX: 0, x: 0, y: 0, h: 28, alive: true, facing: 1 }, arena: { x0: 0, x1: 256 }, addScore() {}, shake() {}, onBossDying() {}, onBossDefeated() {}, classes: {} };
}

export async function render(main, A) {
  main.appendChild(h1('敵・ボスシート'));
  main.appendChild(note('当たり判定（緑）は実クラスの生成時の値。数値の単位: 距離・速度は世界単位（1 = 3px）、時間は秒、t = tick（60fps）。'));
  const w = stubWorld(A);
  main.appendChild(h2('1. 雑魚敵'));
  const rows = [];
  for (const [key, sp] of Object.entries(SPEC)) {
    const e = createEnemy(w, { type: key, x: 0, y: 0 }); const inst = e && e.hp !== undefined ? e : (key === 'zombie' ? createZombie(w) : null);
    const frames = [1, 2].map(i => A.enemies[key + i]).filter(Boolean).map((spr, i) => ({ name: `${key}${i + 1}`, spr, left: true, hit: inst ? { w: inst.w, h: inst.h } : undefined }));
    if (A.enemies[key + 'Rise']) frames.push({ name: 'rise', spr: A.enemies[key + 'Rise'], left: true });
    main.appendChild(h3(`${sp.jp}（${key}）`));
    main.appendChild(frameStrip(frames));
    if (frames[0]) main.appendChild(paletteStrip(frames[0].spr));
    rows.push([sp.jp, inst?.hp ?? '-', inst?.score ?? '-', inst ? `${inst.w}x${inst.h}` : '-', sp.anim, sp.move, sp.shot, sp.gore, sp.spawn]);
  }
  main.appendChild(h3('仕様一覧'));
  main.appendChild(table(['敵', 'HP', 'スコア', '当たり判定', 'アニメ', '移動', '攻撃', '死亡演出', '配置記号'], rows));

  main.appendChild(h2('2. ボス'));
  for (const [key, sp] of Object.entries(BOSS_SPEC)) {
    const b = createBoss(w, key, 200, 176);
    main.appendChild(h3(sp.jp));
    // 1 = 待機（基準コマ）、2 = 攻撃コマ（生成済みなら）。当たり判定は 1 コマ目基準で共通
    // 1 = 待機（基準コマ）、2 = 攻撃コマ。多節ボス（serpent_head1/2, _body, _tail）は key で始まる全スプライトを並べる
    const bossKeys = Object.keys(A.bosses).filter(k => k === key + '1' || k === key + '2' || k.startsWith(key + '_')).sort();
    const label = k => k === key + '1' ? key + '1 待機' : k === key + '2' ? key + '2 攻撃' : k.endsWith('head1') ? k + ' 待機' : k.endsWith('head2') ? k + ' 攻撃' : k;
    main.appendChild(frameStrip(bossKeys.map(k => ({ name: label(k), spr: A.bosses[k], left: true, hit: b && (k.endsWith('1') || k.endsWith('2')) ? { w: b.w, h: b.h } : undefined }))));
    if (bossKeys[0]) main.appendChild(paletteStrip(A.bosses[bossKeys[0]]));
    main.appendChild(table(['HP', '当たり判定', '状態遷移', '弾', '撃破演出'], [[sp.hp, b ? `${b.w}x${b.h}` : '-', sp.states, sp.shots, sp.death]]));
  }
}

function createZombie(w) { return new ZombieRabbit(w, 0, 16); } // スポナーではなく本体の判定を見る
