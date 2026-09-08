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
  M: 'platformH',   // 動く足場（水平往復、3 タイル幅）
  V: 'platformV',   // 動く足場（垂直往復）
  '@': 'island',    // 浮島（上下に揺れるすり抜け足場）
};
// マップに残るギミック記号: ! 崩れる足場  L はしご  > < 水流  } { 風

export function parseLevel(stage) {
  const rows = stage.rows.map(r => r.split(''));
  const spawns = [];
  let playerStart = null, bossTrigger = null, goal = null;
  const checkpoints = [];
  for (let ty = 0; ty < rows.length; ty++) {
    for (let tx = 0; tx < rows[ty].length; tx++) {
      const ch = rows[ty][tx];
      const type = MARKERS[ch];
      if (!type) continue;
      rows[ty][tx] = '.';
      const pos = { x: tx * TILE, y: ty * TILE };
      if (type === 'player') playerStart = pos;
      else if (type === 'boss') bossTrigger = pos;
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
    boss: stage.boss ?? null,
    map, spawns, playerStart, bossTrigger, goal, checkpoints,
  };
}
