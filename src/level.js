import { TILE, TileMap } from './physics.js';

// マーカー文字 → スポーン種別。マップからは '.' に置換される。
export const MARKERS = {
  P: 'player',
  C: 'checkpoint',
  B: 'boss',
  G: 'goal',
  T: 'treasure',
  z: 'zombie',      // ゾンビうさぎ（地面から湧く）
  m: 'mushroom',    // 毒キノコ妖精
  u: 'unicorn',     // 首なしユニコーン
  k: 'cake',        // 腐ったケーキの精
  a: 'angel',       // 天使の骸骨（飛行）
  b: 'bear',        // テディベア（跳ねる）
  e: 'eye',         // まばたき目玉（据え置き砲台）
  h: 'heartitem',   // 回復/得点アイテム
  r: 'mermaid',     // 人魚人形（水面から噛みつく。'~' の水面行に置く）
  p: 'umbrella',    // 傘の妖精（飛行、血の雨滴を落とす）
  d: 'dollpart',    // 未完成の人形（腕を投げる。第四章）
  q: 'needles',     // 縫い針の群れ（飛行、槍状に突進。第四章）
  g: 'balloon',     // 風船の亡霊（漂い、割れると血の雨。第五章）
  j: 'clown',       // ピエロ骸骨（ナイフ投げ。第五章）
  R: 'cart',        // ジェットコースターの車（右へ 60/s で走る足場。24 タイル走って戻る）
  i: 'mirror',      // 鏡像リリカ（主人公の 1 秒前の動きを鏡の軸で反転して再生。第六章）
  s: 'gargoyle',    // ガーゴイル人形（止まり木から急降下。第六章）
  Y: 'cocoon',      // 綿あめの繭（天井から吊り下がり、真下を通ると落ちる。第二章）
  A: 'syruparm',    // シロップの腕（溜まりから伸び上がって薙ぐ。第二章）
  M: 'platformH',   // 動く足場（水平往復、3 タイル幅）
  V: 'platformV',   // 動く足場（垂直往復）
  '@': 'island',    // 浮島（上下に揺れるすり抜け足場）
  O: 'wheel',       // 回転足場（観覧車: 中心に 4 枚の足場が円運動）
  '%': 'press',     // プレス機（天井から周期的に降りる即死ブロック）
};
// マップに残るギミック記号: ! 崩れる足場  L はしご  > < 水流  } { 風  ) ( ベルトコンベア（地面。右／左に 30/s）  W 綿あめのトランポリン  D 糖蜜のしずく（天井から滴る）

export function parseLevel(stage) {
  const rows = stage.rows.map(r => r.split(''));
  const spawns = [];
  let playerStart = null, bossTrigger = null, goal = null; const bossTriggers = [];
  const checkpoints = [];
  for (let ty = 0; ty < rows.length; ty++) {
    for (let tx = 0; tx < rows[ty].length; tx++) {
      const ch = rows[ty][tx];
      const type = MARKERS[ch];
      if (!type) continue;
      rows[ty][tx] = '.';
      const pos = { x: tx * TILE, y: ty * TILE };
      if (type === 'player') playerStart = pos;
      else if (type === 'boss') { bossTriggers.push(pos); if (!bossTrigger) bossTrigger = pos; } // 複数の B はボス連戦（stage.bosses の順）
      else if (type === 'goal') goal = pos;
      else if (type === 'checkpoint') checkpoints.push(pos);
      else spawns.push({ type, tx, ty, x: pos.x, y: pos.y });
    }
  }
  const map = new TileMap(rows.map(r => r.join('')));
  const crumbles = [];
  for (let ty = 0; ty < rows.length; ty++) for (let tx = 0; tx < rows[ty].length; tx++) if (rows[ty][tx] === '!') crumbles.push({ tx, ty });
  return {
    crumbles,
    name: stage.name,
    title: stage.title ?? stage.name,
    theme: stage.theme ?? 'graveyard',
    timeLimit: stage.timeLimit ?? 180,
    vertical: !!stage.vertical, // 縦スクロール面（高さ > 14 行、ボスはトリガー行より上で開始）
    boss: stage.boss ?? (stage.bosses ? stage.bosses[0] : null),
    bosses: stage.bosses ?? (stage.boss ? [stage.boss] : []), // トリガー順のボス種別
    bossHpMul: stage.bossHpMul ?? 1,                          // 連戦での強化倍率
    bossSong: stage.bossSong ?? null,                         // ボス戦 BGM のキー（省略時 SONGS.boss。最終章は bossFinal）
    bossTriggers: bossTriggers.sort((a, b) => a.x - b.x),
    map, spawns, playerStart, bossTrigger, goal, checkpoints,
  };
}
