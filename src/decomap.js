// 装飾記号 → 生成装飾スプライト名（テーマ別）。World の描画とカタログ「タイル・装飾」の表が同じ定義を使う
export const DECO_MAP = {
  graveyard:   { t: 'tomb', c: 'cross', f: 'flowers', v: 'candle', y: 'tree', x: 'blood', o: 'bones' },
  candyforest: { t: 'tomb', c: 'cross', f: 'flowers', v: 'candle', y: 'tree', x: 'blood', o: 'bones', k: 'lollipop' },
  river:       { y: 'willow', n: 'bridgepost', f: 'reeds', o: 'dollhead', x: 'blood', t: 'tomb' },
  workshop:    { n: 'dressform', c: 'scissors', y: 'spool', o: 'stuffing', x: 'blood', w: 'window', v: 'candelabra' },
  park:        { n: 'booth', f: 'balloons', y: 'carousel', c: 'popcorn', x: 'blood', o: 'bones' },
  tower:       { n: 'mirror', k: 'gargoyle', v: 'chandelier', o: 'shards', x: 'blood', w: 'window' }, // 's' は敵マーカーなので像は 'k'
  castle:      { n: 'pillar', w: 'window', v: 'candelabra', x: 'blood', o: 'bones', t: 'banner' },
  stars:       { t: 'startomb', o: 'starrock', y: 'rockinghorse', v: 'lanternpost', x: 'blood', c: 'cross' },
};
// テーマの記号表をスプライト実体に解決する（無いものは落とす）
export function resolveDecoMap(theme, D) {
  const out = {};
  for (const [sym, name] of Object.entries(DECO_MAP[theme] ?? {})) if (D?.[name]) out[sym] = D[name];
  return out;
}
