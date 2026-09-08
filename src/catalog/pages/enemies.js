// 敵・ボスシート: フレーム、当たり判定（実クラスから取得）、行動仕様、弾、演出、スコア
import { h1, h2, h3, note, table, frameStrip, paletteStrip, rawSize } from '../sheet.js';
import { createEnemy, ZombieRabbit } from '../../entities/enemies.js';
import { createBoss } from '../../entities/bosses.js';
import { TileMap } from '../../physics.js';

// 行動仕様（コードの状態機械を要約。数値は enemies.js / bosses.js の定数）
const SPEC = {
  mermaid:  { jp: '人魚人形', anim: '待機 / 跳躍 2 コマ', move: '水面下で待機（水面上の半身のみ描く）。主人公が 56 以内・水面より上なら vy -150 で跳ね上がり、放物線で戻る（1.2〜2.0 秒間隔）', shot: 'なし（跳躍中のみ接触）', gore: '骨＋血。水面下は撃てない', spawn: 'r: 直下の ~ の上端を水面にする' },
  umbrella: { jp: '傘の妖精', anim: '傘の開閉 2 コマ 15t', move: '出現位置 ±90 の範囲で主人公の上へ 28/s で寄る、上下 ±5 浮遊', shot: '主人公の真上 24 以内で血の雨滴 3 発（1.6 秒毎）', gore: '血', spawn: 'p: マーカーの 40 上を飛ぶ' },
  zombie:   { jp: 'ゾンビうさぎ', anim: '歩き 2 コマ 12t', move: '湧き 0.7 秒 → 主人公へ 26/s 直進、壁で反転、9 秒で沈む', shot: 'なし（接触）', gore: '綿＋血。歩行中に血痕', spawn: 'z: 主人公 ±150 内で 1.5〜2.6 秒毎、前 60%/後 40%、同時 4 体' },
  mushroom: { jp: '毒キノコ妖精', anim: '羽 2 コマ 10t', move: '定位置で上下 ±6 浮遊', shot: '毒 3 連（扇状、170 以内、2.4 秒毎）→ 着弾で毒溜まり 3.5 秒', gore: '毒＋血', spawn: 'm' },
  unicorn:  { jp: '血まみれユニコーン', anim: '走り 2 コマ 6t', move: '待機 → 130 以内・同じ高さで突進 115/s、壁で反転、260 離れると待機', shot: '走行中に血滴（12%/f）', gore: '血＋肉片', spawn: 'u' },
  cake:     { jp: '腐ったケーキの精', anim: '口 2 コマ（吐く前 0.4 秒）', move: '主人公へ 18/s（30〜200 の距離で）', shot: '蛆 3 連（跳ねる、150 以内、2.6 秒毎）', gore: '血', spawn: 'k' },
  angel:    { jp: '天使の骸骨', anim: '羽 2 コマ 7t', move: '200 以内で主人公の x へ 42/s、上下 ±8 浮遊', shot: '真上に来たら骨/血を落下（1.8 秒毎）', gore: '骨＋綿＋血', spawn: 'a' },
  bear:     { jp: 'テディベア', anim: '地上/空中 2 コマ', move: '180 以内で 0.5〜1.1 秒毎に跳躍（vx 55, vy -190）', shot: 'なし（接触）。着地で血', gore: '綿＋血', spawn: 'b' },
  eye:      { jp: '目玉砲台', anim: '開/閉（開 2.5〜4 秒、閉 0.5 秒）', move: '固定', shot: '開眼中 170 以内で血の弾 95/s を狙い撃ち 1.7 秒毎。閉眼中は無敵', gore: '血', spawn: 'e' },
};
const BOSS_SPEC = {
  serpent: { jp: '涙の大蛇 ララバイ（第三章）', hp: 24, states: 'enter(1.5s 浮上) → sweep(川を横切る、周期 ≈11 秒、水面上 26〜52) → 主人公が 70 以内で strike(0.35s で突き出し、口を開く) | 4.5 秒ごとに rain(血の涙を吐き上げ 1 秒)。HP 50% 以下で速度 1.4 倍、雨 2 倍。胴 6 節＋尾は接触のみ（撃てない）', shots: 'rain', death: '同上' },
  doll:  { jp: '泣き人形ドロシー（第一章）', hp: 16, states: 'enter → walk(2.4s, 14/s) → cry(1.4s: 酸の涙 2 発/0.2s) | throw(腕ブーメラン)。HP 50% 以下で速度 24/s、涙に血が混ざる', shots: 'acid, blood, arm', death: '2.6 秒 血飛沫→大爆散（gore 30 / blood 60 / stuffing 20）' },
  teddy: { jp: 'はらわたテディ（第二章）', hp: 20, states: 'enter → idle(0.9s) → jump(vy -270) 着地で蛆 5 連 | 3 回に 1 回 belly(1.9s: 腹から血を扇状噴射)。HP 50% 以下で idle 0.5s', shots: 'maggot, blood', death: '同上' },
  noir:  { jp: '堕ちた魔法少女ノワール（最終章）', hp: 24, states: 'enter(1.5s) → hover(闇ハート 3 連/1.3s ×3) → teleport | rain(血の雨 2.4s) | dash(180/s)。HP 50% 以下で 5 連/0.9s、dash 230/s', shots: 'darkheart, rain', death: '同上' },
};

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
    main.appendChild(frameStrip([{ name: key + '1 待機', spr: A.bosses[key + '1'], left: true, hit: b ? { w: b.w, h: b.h } : undefined }, ...(A.bosses[key + '2'] ? [{ name: key + '2 攻撃', spr: A.bosses[key + '2'], left: true, hit: b ? { w: b.w, h: b.h } : undefined }] : [])]));
    main.appendChild(paletteStrip(A.bosses[key + '1']));
    main.appendChild(table(['HP', '当たり判定', '状態遷移', '弾', '撃破演出'], [[sp.hp, b ? `${b.w}x${b.h}` : '-', sp.states, sp.shots, sp.death]]));
  }
}

function createZombie(w) { return new ZombieRabbit(w, 0, 16); } // スポナーではなく本体の判定を見る
