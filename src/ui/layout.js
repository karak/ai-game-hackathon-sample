export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", sans-serif';

// 画面レイアウト仕様: 内部解像度 256x224、外周セーフマージン 8px、HUD は上 26px、本文フォント 16px / 行送り 18px
export const LAYOUT = { W: 256, H: 224, MARGIN: 8, HUD_H: 26, FONT: 16, LINE: 18, PAD: 8 };

export function measure(g, str, size = LAYOUT.FONT) {
  g.font = `${size}px ${FONT}`;
  return Math.ceil(g.measureText(str).width);
}

// 実測幅で折り返す（日本語は文字単位、空白を含む英文は単語単位）
export function wrap(g, str, maxWidth, size = LAYOUT.FONT) {
  const lines = [];
  for (const para of String(str).split('\n')) {
    if (measure(g, para, size) <= maxWidth) { lines.push(para); continue; }
    // 空白があれば単語単位、単語自体が長すぎる（日本語の長文など）場合は文字単位に落とす
    const words = para.includes(' ') ? para.split(' ').map((w, i, a) => i < a.length - 1 ? w + ' ' : w) : [para];
    const units = words.flatMap(w => measure(g, w, size) > maxWidth ? [...w] : [w]);
    let cur = '';
    for (const u of units) {
      if (cur && measure(g, (cur + u).trimEnd(), size) > maxWidth) { lines.push(cur.trimEnd()); cur = u; } else cur += u;
    }
    if (cur) lines.push(cur.trimEnd());
  }
  return lines;
}

