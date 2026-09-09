// キャラクターシート: 衣装 × アニメーション、フレーム時間、当たり判定、サイズ比較、パレット
import { h1, h2, h3, note, table, frameStrip, paletteStrip, canvas, drawRaw, rawSize, state } from '../sheet.js';
import { HD_SCALE } from '../../gfx/sprite.js';

// 主人公のアニメ定義（player.js の frame() と同じ規則）。ticks は 60fps 基準の表示時間
const ANIMS = [
  { name: 'idle', frames: ['idle'], ticks: [0], loop: false, desc: '待機。無敵中は 18Hz で点滅' },
  { name: 'run', frames: ['run1', 'run2', 'run3', 'run4'], ticks: [6, 6, 6, 6], loop: true, desc: '走り 4 コマ（runT×10 → 1 コマ 6 tick）' },
  { name: 'run+shoot', frames: ['run1s', 'run3s'], ticks: [12, 12], loop: true, desc: '走り撃ち 2 コマ（足は run1/run3 の接地コマ、上半身が射撃。射撃後 0.18 秒だけ差し替え）' },
  { name: 'jump / fall', frames: ['jump', 'fall'], ticks: [0, 0], loop: false, desc: '上昇中 jump、下降中 fall。空中制御なし' },
  { name: 'attack', frames: ['attack'], ticks: [11], loop: false, desc: '射撃後 0.18 秒（≈11 tick）表示' },
  { name: 'crouch', frames: ['crouch'], ticks: [0], loop: false, desc: '↓ 押下中。当たり判定 12×18' },
  { name: 'hurt', frames: ['hurt'], ticks: [21], loop: false, desc: '被弾ノックバック 0.35 秒。無敵 1.8 秒' },
  { name: 'dead', frames: ['dead'], ticks: [114], loop: false, desc: '1.9 秒。帽子が飛ぶ演出はドレス時のみ' },
];
const HIT = { stand: { w: 12, h: 28 }, crouch: { w: 12, h: 18 } };

export async function render(main, A) {
  main.appendChild(h1('キャラクターシート — リリカ'));
  main.appendChild(note('基準線 = 足元。当たり判定（緑）は世界単位 12×28（しゃがみ 12×18）、1 世界単位 = 3 px。アンカー（黄）はスプライト箱の底辺中央。数値は 60fps の tick。'));

  // サイズ比較
  main.appendChild(h2('1. サイズ比較（同一基準線・等倍）'));
  const cmp = [{ name: 'リリカ', spr: A.player.dress.idle, hit: HIT.stand }];
  // manifest にある全ての雑魚（*1）とボス（*1 / *_head1）を並べる（固定リストにすると新章の敵が抜ける）
  for (const n of Object.keys(A.enemies).filter(k => /1$/.test(k) && A.enemies[k]?.hd).sort()) cmp.push({ name: n.replace(/1$/, ''), spr: A.enemies[n], left: true });
  for (const n of Object.keys(A.bosses).filter(k => /(^|_head)1$/.test(k) && A.bosses[k]?.hd).sort()) cmp.push({ name: n.replace(/1$/, ''), spr: A.bosses[n], left: true });
  main.appendChild(frameStrip(cmp, { gap: 12 }));
  main.appendChild(table(['対象', '幅×高(px)', '世界単位', '画面高比', '主人公比'], cmp.map(c => { const [w, h] = rawSize(c.spr); const ph = rawSize(A.player.dress.idle)[1]; return [c.name, `${w}x${h}`, `${(w / 3).toFixed(1)}x${(h / 3).toFixed(1)}`, `${(h / 672 * 100).toFixed(0)}%`, `${(h / ph).toFixed(2)}`]; })));

  // 衣装 × アニメ
  main.appendChild(h2('2. モーションシート（衣装別）'));
  main.appendChild(table(['アニメ', 'コマ', '各コマ tick', 'ループ', '備考'], ANIMS.map(a => [a.name, a.frames.length, a.ticks.map(t => t || '—').join(' / '), a.loop ? 'あり' : 'なし', a.desc])));
  for (const [cost, label] of [['dress', 'ドレス（通常・帽子あり）'], ['plain', '私服（変身解除・帽子なし）'], ['gold', 'フルブルーム（強化）']]) {
    main.appendChild(h3(label));
    const frames = [];
    for (const a of ANIMS) a.frames.forEach((f, i) => { const spr = A.player[cost][f]; if (spr) frames.push({ name: f, spr, ticks: a.ticks[i], hit: f === 'crouch' ? HIT.crouch : (f === 'dead' ? undefined : HIT.stand), attack: f === 'attack' ? { x: 10, y: 22, w: 12, h: 8 } : undefined }); });
    main.appendChild(frameStrip(frames, { gap: 10 }));
    main.appendChild(paletteStrip(A.player[cost].idle));
  }

  // 帽子・ほうき（合成パーツ）
  main.appendChild(h2('3. 合成パーツ'));
  main.appendChild(note('帽子はドレス系の帽子なしコマに合成（髪の最上行 +6 セルにつばを重ねる）。死亡時は帽子だけが放物線で飛ぶ。ほうきは二段ジャンプ 0.45 秒間だけ足元に表示。'));
  main.appendChild(frameStrip([{ name: 'hat', spr: A.hat, size: true }, { name: 'broom', spr: A.broom }], { gap: 16 }));

  // 射出位置
  main.appendChild(h2('4. 弾の発生位置'));
  main.appendChild(table(['姿勢', '発生 x（中心から）', '発生 y（頭上から）', '同時弾数上限'], [['立ち', '+10 世界単位（向き側）', '+12', '武器依存 2〜3'], ['しゃがみ', '+10', '+6', '同上'], ['溜め撃ち（フルブルーム）', '+12', '+8', '1（貫通）']]));
}
