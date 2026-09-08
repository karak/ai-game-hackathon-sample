// アイテム・弾シート: 寸法、武器パラメータ、敵弾の物理
import { h1, h2, note, table, frameStrip, paletteStrip } from '../sheet.js';
import { WEAPONS, ENEMY_SHOTS } from '../../entities/projectiles.js';

export async function render(main, A) {
  main.appendChild(h1('アイテム・弾'));
  main.appendChild(h2('1. 自弾（武器 4 種＋溜め撃ち）'));
  main.appendChild(frameStrip(Object.keys(WEAPONS).map(k => ({ name: k, spr: A.shots[WEAPONS[k].sprite] })).concat([{ name: 'charge', spr: A.shots.charge }])));
  main.appendChild(table(['武器', '名前', '速度', '初速 y', '重力', '同時数', '威力', '寿命 s', '判定 w×h', '特性'],
    Object.entries(WEAPONS).map(([k, w]) => [k, w.name, w.speed, w.vy0, w.gravity, w.max, w.dmg, w.life, `${w.w}x${w.h}`, k === 'candle' ? '着弾で炎 1.3 秒（0.35 秒毎に 1 ダメージ）' : k === 'heart' ? '放物線・威力 2' : k === 'knife' ? '高速・直線' : '直線・3 発'])
    .concat([['charge', '溜め撃ち', 160, 0, 0, 1, 3, 1.6, '10x10', 'フルブルーム時、0.9 秒長押しで発射。貫通']])));

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
  main.appendChild(note('毒溜まり: 3.5 秒、接触で被弾。炎（キャンドル）: 1.3 秒、敵に 0.35 秒毎 1 ダメージ。炎は暫定で旧ドット絵（3 倍表示）。'));
}
