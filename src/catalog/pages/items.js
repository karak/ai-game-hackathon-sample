// アイテム・弾シート: 寸法、武器パラメータ、敵弾の物理
import { h1, h2, h3, note, table, frameStrip, paletteStrip } from '../sheet.js';
import { MAGIC, SUPER, CHARGE_T, SUPER_T } from '../../stage/entities/magic.js';
import { CUTIN_IN, CUTIN_HOLD, CUTIN_OUT } from '../../stage/entities/magic.js';
import { WEAPONS, ENEMY_SHOTS } from '../../stage/entities/projectiles.js';

export async function render(main, A) {
  main.appendChild(h1('アイテム・弾'));
  main.appendChild(h2('1. 自弾（武器 4 種＋溜め撃ち）'));
  main.appendChild(frameStrip(Object.keys(WEAPONS).map(k => ({ name: k, spr: A.shots[WEAPONS[k].sprite] })).concat([{ name: 'charge', spr: A.shots.charge }])));
  main.appendChild(table(['武器', '名前', '速度', '初速 y', '重力', '同時数', '威力', '寿命 s', '判定 w×h', '特性'],
    Object.entries(WEAPONS).map(([k, w]) => [k, w.name, w.speed, w.vy0, w.gravity, w.max, w.dmg, w.life, `${w.w}x${w.h}`, k === 'candle' ? '着弾で炎 1.3 秒（0.35 秒毎に 1 ダメージ）' : k === 'heart' ? '放物線・威力 2' : k === 'knife' ? '高速・直線' : '直線・3 発'])
    .concat([['charge', '溜め撃ち', 160, 0, 0, 1, 3, 1.6, '10x10', 'フルブルーム時、0.9 秒長押しで発射。貫通（現在は武器別の溜め魔法に置換。旧仕様の記録）']])));
  // 溜め魔法（武器別。src/entities/magic.js）
  main.appendChild(h3(`溜め魔法（フルブルーム時、${CHARGE_T} 秒長押し → 離す）`));
  main.appendChild(frameStrip([{ name: 'meteor', spr: A.shots.meteor }, { name: 'burst', spr: A.shots.burst }, { name: 'pillar', spr: A.shots.pillar }].filter(f => f.spr)));
  main.appendChild(table(['武器', '魔法', '内容', 'ダメージ', '持続'], [
    ['スター', MAGIC.star.name, `画面上から ${MAGIC.star.count} 発が ${MAGIC.star.interval} 秒間隔で降る（前方 ±${MAGIC.star.spread / 2}、vy ${MAGIC.star.vy}）。貫通`, MAGIC.star.dmg + '/発', `${(MAGIC.star.count * MAGIC.star.interval).toFixed(2)} 秒`],
    ['ナイフ', MAGIC.knife.name, `主人公の前後 ${MAGIC.knife.offset} に分身 ${MAGIC.knife.clones} 体。${MAGIC.knife.interval} 秒毎にナイフ`, '1/発（通常ナイフ）', `${MAGIC.knife.duration} 秒`],
    ['ハート爆弾', MAGIC.heart.name, `半径 ${MAGIC.heart.radius} の爆発。範囲内の敵と宝箱に 1 回`, String(MAGIC.heart.dmg), `${MAGIC.heart.life} 秒`],
    ['キャンドル', MAGIC.candle.name, `前方 24 から ${MAGIC.candle.gap} 間隔で ${MAGIC.candle.count} 本、高さ ${MAGIC.candle.height}（3 タイル）`, '1/0.35 秒（炎と同じ）', `${MAGIC.candle.life} 秒`],
  ]));

  // 強化魔法（溜め 2 段階目。src/entities/magic.js SUPER）。専用スプライトは持たず、既存の弾・炎・爆発と粒子で組む
  main.appendChild(h3(`強化魔法（${SUPER_T} 秒まで溜める → 光輪が出たら離す。超魔界村の「黄金の鎧＋ブレスレット」に相当）`));
  // 専用素材（magicfx）とカットイン（cutin）
  const M = A.generated?.magicfx ?? {}, CI = A.generated?.cutin ?? {};
  main.appendChild(frameStrip(['aura1', 'aura2', 'comet1', 'comet2', 'starburst1', 'starburst2', 'cortege1', 'cortege2', 'mirror1', 'mirror2', 'shard1', 'shard2', 'shard3', 'shard4'].map(n => ({ name: n, spr: M[n] })).filter(f => f.spr)));
  main.appendChild(frameStrip(['flower1', 'flower2', 'petal1', 'petal2', 'petal3', 'petal4', 'waxpillar1', 'waxpillar2', 'choir1', 'choir2'].map(n => ({ name: n, spr: M[n] })).filter(f => f.spr)));
  main.appendChild(table(['武器', '強化魔法', '内容', 'ダメージ', '持続'], [
    ['スター', SUPER.star.name, `流星 ${SUPER.star.count} 発（${SUPER.star.interval} 秒間隔、前方 ±${SUPER.star.spread / 2}、vy ${SUPER.star.vy}、貫通）。着弾ごとに半径 ${SUPER.star.burst} の小爆発。最後に前方へ巨大流星 → 半径 ${SUPER.star.finale.radius} の衝撃波`, `${SUPER.star.dmg}/発、小爆発 ${SUPER.star.burstDmg}、締め ${SUPER.star.finale.dmg}`, `${(SUPER.star.count * SUPER.star.interval).toFixed(2)} 秒＋着弾`],
    ['ナイフ', SUPER.knife.name, `鏡像 ${SUPER.knife.clones} 体が主人公を中心に半径 ${SUPER.knife.radius}（縦は 0.55 倍の楕円）を角速度 ${SUPER.knife.omega} rad/s で周回し、${SUPER.knife.interval} 秒毎に外向きへナイフ。鏡像は撃つ向きに反転`, '1/発（通常ナイフ）', `${SUPER.knife.duration} 秒`],
    ['ハート爆弾', SUPER.heart.name, `前方 26 から ${SUPER.heart.gap} 間隔で心臓の花を ${SUPER.heart.seeds} つ（${SUPER.heart.plant} 秒間隔で植える）。各 ${SUPER.heart.delay} 秒後に半径 ${SUPER.heart.radius} で破裂し、血の花びらが舞う`, String(SUPER.heart.dmg), `${(SUPER.heart.seeds * SUPER.heart.plant + SUPER.heart.delay + SUPER.heart.life).toFixed(2)} 秒`],
    ['キャンドル', SUPER.candle.name, `前方 20 から ${SUPER.candle.gap} 間隔で ${SUPER.candle.count} 本、高さ ${SUPER.candle.height}（4 タイル）。柱に触れた敵弾を焼き落とす（ブーメランは除く）`, '1/0.35 秒（炎と同じ）', `${SUPER.candle.life} 秒`],
  ]));
  main.appendChild(note(`溜めは 2 段階。${CHARGE_T} 秒で溜め魔法、${SUPER_T} 秒で強化魔法。到達時は主人公が詠唱ポーズ（player/cast1）になり生成した光輪（aura1/2）が回る。発動で詠唱ポーズ cast2・画面揺れ 9・武器色フラッシュ 0.3 秒・${(CUTIN_IN + CUTIN_HOLD + CUTIN_OUT).toFixed(2)} 秒のスロー混じりのカットイン・効果音 superready / supermagic・魔法名のテロップ。専用素材: 彗星 comet1/2、星の衝撃波 starburst1/2、星屑の葬列 cortege1/2、鏡 mirror1/2 と破片 shard1〜4、心臓の花 flower1/2 と花びら petal1〜4、蝋柱 waxpillar1/2（中央帯を縦に繰り返して 4 タイルまで伸ばす）と聖歌隊 choir1/2`));
  main.appendChild(h3(`カットイン（画面固定。滑り込み ${CUTIN_IN} 秒 → 静止 ${CUTIN_HOLD} 秒 → 抜け ${CUTIN_OUT} 秒。武器色の枠と斜めの帯つき）`));
  main.appendChild(table(['武器', 'カットイン', '寸法（セル）', '色数'], [
    ['スター', 'cutin/stardust', CI.stardust ? `${Math.round(CI.stardust.w * 3)}x${Math.round(CI.stardust.h * 3)}` : '-', 24],
    ['ナイフ', 'cutin/mirror', CI.mirror ? `${Math.round(CI.mirror.w * 3)}x${Math.round(CI.mirror.h * 3)}` : '-', 24],
    ['ハート爆弾', 'cutin/heart', CI.heart ? `${Math.round(CI.heart.w * 3)}x${Math.round(CI.heart.h * 3)}` : '-', 24],
    ['キャンドル', 'cutin/wax', CI.wax ? `${Math.round(CI.wax.w * 3)}x${Math.round(CI.wax.h * 3)}` : '-', 24],
  ]));

  main.appendChild(h2('2. 敵弾'));
  main.appendChild(frameStrip(Object.keys(ENEMY_SHOTS).filter(k => A.shots[ENEMY_SHOTS[k].sprite]).map(k => ({ name: k, spr: A.shots[ENEMY_SHOTS[k].sprite], left: true }))));
  main.appendChild(table(['弾', 'スプライト', '判定 w×h', '重力', '特性', '使う敵'],
    Object.entries(ENEMY_SHOTS).map(([k, d]) => [k, d.sprite, `${d.w}x${d.h}`, d.gravity, [d.pool && '着弾で毒溜まり', d.splat && '着弾で血痕', d.bounce && `跳ね ${d.bounce} 回`, d.spin && '回転', d.homing && `誘導 ${d.homing}`, d.boomerang && 'ブーメラン'].filter(Boolean).join('、') || '直線',
      { poison: 'キノコ妖精', blood: 'ユニコーン/天使/テディ', bone: '天使', maggot: 'ケーキ/テディ', acid: '人形', bolt: '目玉', darkheart: 'ノワール', arm: '人形', rain: 'ノワール' }[k] ?? '-'])));

  main.appendChild(h2('3. アイテム'));
  const items = ['box', 'dress', 'golddress', 'oneup', 'potion', 'candy'];
  main.appendChild(frameStrip(items.filter(k => A.items[k]).map(k => ({ name: k, spr: A.items[k] }))));
  main.appendChild(table(['アイテム', '効果', 'スコア', '出現'], [
    ['box（宝箱）', '撃つと開き中身が飛び出す（vy -150）', '-', '配置記号 T'],
    ['dress', '魔法のドレス（変身復帰）', 500, '私服時は必ずこれ'],
    ['golddress', 'フルブルームドレス（溜め撃ち解放）', 1000, 'ドレス時、3 箱に 1 回'],
    ['oneup', 'リリカ人形（残機 +1）', '-', '8%'],
    ['potion', 'いちごポーション', 300, '8% / 配置記号 h'],
    ['candy', 'キャンディ', 200, '（予備）'],
    ['武器', '所持と異なる武器へ切替', 200, '残り'],
  ]));
  main.appendChild(h2('4. 毒溜まり・炎'));
  main.appendChild(frameStrip([{ name: 'pool', spr: A.shots.pool }, { name: 'fire1', spr: A.shots.fire1 }, { name: 'fire2', spr: A.shots.fire2 }]));
  main.appendChild(note('毒溜まり: 3.5 秒、接触で被弾。炎（キャンドル）: 1.3 秒、敵に 0.35 秒毎 1 ダメージ。炎は生成素材 shots/fire1・fire2（2 コマ、hd）。'));
}
