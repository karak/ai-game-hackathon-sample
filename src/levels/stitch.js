// セグメント（同じ行数の文字列配列）を横方向に連結する
export function stitch(...segments) {
  const h = segments[0].length;
  for (const s of segments) {
    if (s.length !== h) throw new Error(`segment height mismatch: ${s.length} vs ${h}`);
    const w = s[0].length;
    for (const r of s) if (r.length !== w) throw new Error(`segment row width mismatch: "${r}"`);
  }
  const out = [];
  for (let y = 0; y < h; y++) out.push(segments.map(s => s[y]).join(''));
  return out;
}
