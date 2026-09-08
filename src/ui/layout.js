export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", sans-serif';

// 画面レイアウト仕様: 論理座標 256x224（世界単位）で配置し、描画はスクリーン解像度（UI_PX 倍）で行う。
// フォントは DotGothic16 を FONT_PX 倍（16px → 32px）で描き、枠線は 1〜2 スクリーン px。外周セーフマージン 8、HUD は上 26。
export const UI_PX = 3;      // スクリーン px / 論理 px
export const FONT_PX = 2;    // フォント倍率（size=16 → 32px）
export const LAYOUT = { W: 256, H: 224, MARGIN: 8, HUD_H: 26, FONT: 16, LINE: 13, PAD: 8 };

// 論理サイズ size のテキストの実測幅（論理 px）
export function measure(g, str, size = LAYOUT.FONT) {
  g.font = `${size * FONT_PX}px ${FONT}`;
  return Math.ceil(g.measureText(str).width / UI_PX);
}
// 論理サイズ size のテキストの高さ（論理 px）
export const rowHeight = (size = LAYOUT.FONT) => Math.ceil(size * FONT_PX / UI_PX);

// スクリーン座標系で fn を実行する（引数 S は論理→スクリーンの倍率）
export function inScreen(g, fn) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  try { fn(UI_PX); } finally { g.restore(); }
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

